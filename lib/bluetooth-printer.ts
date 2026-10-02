'use client';

// Web Bluetooth Thermal Printer Service for ESC/POS (58mm & 80mm)

export interface PrinterDevice {
  id: string;
  name: string;
  connected: boolean;
  paperWidth: '58mm' | '80mm';
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  rate: number;
  amount: number;
  unit?: string;
  taxPercent?: number;
}

export interface ReceiptData {
  companyName: string;
  legalName?: string;
  gstin?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  fssaiNo?: string;
  documentNumber: string;
  documentType?: string;
  date: string;
  time?: string;
  customerName?: string;
  customerPhone?: string;
  customerGstin?: string;
  items: ReceiptItem[];
  subTotal: number;
  totalTax: number;
  discountAmount?: number;
  grandTotal: number;
  paymentMode?: string;
  cashierName?: string;
  footerMessage?: string;
}

// Common Bluetooth Printer Service UUIDs
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Posiflex / Everycom
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent / Bluetooth Serial
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HMSoft / Feasycom / Generic SPP
  '0000ff00-0000-1000-8000-00805f9b34fb', // ESC/POS Generic
];

class BluetoothPrinterService {
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;
  private paperWidth: '58mm' | '80mm' = '58mm';
  private onStatusChangeListeners: ((status: PrinterDevice | null) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const savedWidth = localStorage.getItem('vtgst_bt_paper_width');
      if (savedWidth === '80mm' || savedWidth === '58mm') {
        this.paperWidth = savedWidth;
      }
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public getStatus(): PrinterDevice | null {
    if (!this.device) return null;
    return {
      id: this.device.id,
      name: this.device.name || 'Bluetooth Thermal Printer',
      connected: !!(this.server && this.server.connected && this.characteristic),
      paperWidth: this.paperWidth,
    };
  }

  public setPaperWidth(width: '58mm' | '80mm') {
    this.paperWidth = width;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vtgst_bt_paper_width', width);
    }
    this.notifyListeners();
  }

  public getPaperWidth(): '58mm' | '80mm' {
    return this.paperWidth;
  }

  public subscribe(callback: (status: PrinterDevice | null) => void) {
    this.onStatusChangeListeners.push(callback);
    callback(this.getStatus());
    return () => {
      this.onStatusChangeListeners = this.onStatusChangeListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners() {
    const status = this.getStatus();
    this.onStatusChangeListeners.forEach((cb) => cb(status));
  }

  public async connect(): Promise<PrinterDevice> {
    if (!this.isSupported()) {
      throw new Error(
        'Web Bluetooth is not supported in this browser. Please use Google Chrome, Edge, or Opera on Android/Desktop.'
      );
    }

    try {
      console.log('Requesting Bluetooth Device...');
      // Request device with all common thermal printer GATT services
      const navBt = (navigator as any).bluetooth;
      this.device = await navBt.requestDevice({
        filters: [{ services: PRINTER_SERVICES }],
        optionalServices: PRINTER_SERVICES,
        acceptAllDevices: false,
      }).catch(async () => {
        // Fallback: accept all devices if filter matched nothing
        return await navBt.requestDevice({
          acceptAllDevices: true,
          optionalServices: PRINTER_SERVICES,
        });
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        console.warn('Bluetooth Printer disconnected.');
        this.characteristic = null;
        this.server = null;
        this.notifyListeners();
      });

      console.log('Connecting to GATT Server on:', this.device.name);
      this.server = await this.device.gatt.connect();

      // Find available write characteristic
      const services = await this.server.getPrimaryServices();
      let writeChar = null;

      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writeChar = char;
              break;
            }
          }
        } catch {
          // continue checking next service
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        throw new Error('Could not find a writable ESC/POS characteristic on this Bluetooth device.');
      }

      this.characteristic = writeChar;
      this.notifyListeners();

      return this.getStatus()!;
    } catch (err: any) {
      console.error('Bluetooth connection failed:', err);
      this.disconnect();
      throw err;
    }
  }

  public disconnect() {
    try {
      if (this.device && this.device.gatt && this.device.gatt.connected) {
        this.device.gatt.disconnect();
      }
    } catch (e) {
      console.error('Error disconnecting BT printer:', e);
    }
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.notifyListeners();
  }

  // Raw ESC/POS Byte Buffer Builder
  private buildEscPosCommands(receipt: ReceiptData): Uint8Array {
    const is80mm = this.paperWidth === '80mm';
    const maxCols = is80mm ? 48 : 32;

    const ESC = 0x1b;
    const GS = 0x1d;
    const LF = 0x0a;

    const buffer: number[] = [];

    const append = (...bytes: number[]) => buffer.push(...bytes);
    const appendText = (text: string) => {
      // Clean non-ascii / currency symbols to standard readable representation
      const safe = text
        .replace(/₹/g, 'Rs.')
        .replace(/[^\x00-\x7F]/g, '');
      for (let i = 0; i < safe.length; i++) {
        buffer.push(safe.charCodeAt(i));
      }
    };

    const appendLine = (text: string = '') => {
      appendText(text);
      append(LF);
    };

    const alignCenter = () => append(ESC, 0x61, 0x01);
    const alignLeft = () => append(ESC, 0x61, 0x00);
    const alignRight = () => append(ESC, 0x61, 0x02);

    const boldOn = () => append(ESC, 0x45, 0x01);
    const boldOff = () => append(ESC, 0x45, 0x00);

    const doubleHeightOn = () => append(ESC, 0x21, 0x10);
    const doubleWidthOn = () => append(ESC, 0x21, 0x20);
    const normalFont = () => append(ESC, 0x21, 0x00);

    const horizontalLine = (char = '-') => {
      alignLeft();
      appendLine(char.repeat(maxCols));
    };

    const twoColumn = (left: string, right: string) => {
      const spacesNeeded = maxCols - (left.length + right.length);
      if (spacesNeeded <= 0) {
        appendLine(left + ' ' + right);
      } else {
        appendLine(left + ' '.repeat(spacesNeeded) + right);
      }
    };

    // 1. Initialize Printer
    append(ESC, 0x40);

    // 2. Store Header
    alignCenter();
    boldOn();
    doubleHeightOn();
    appendLine(receipt.companyName || 'VTGST RETAIL');
    normalFont();
    boldOff();

    if (receipt.legalName && receipt.legalName !== receipt.companyName) {
      appendLine(receipt.legalName);
    }
    if (receipt.address) {
      appendLine(receipt.address);
    }
    if (receipt.city) {
      appendLine(receipt.city);
    }
    if (receipt.phone) {
      appendLine(`Ph: ${receipt.phone}`);
    }
    if (receipt.gstin) {
      boldOn();
      appendLine(`GSTIN: ${receipt.gstin}`);
      boldOff();
    }
    if (receipt.fssaiNo) {
      appendLine(`FSSAI: ${receipt.fssaiNo}`);
    }

    horizontalLine('=');

    // 3. Document Details
    alignLeft();
    twoColumn(`Bill No: ${receipt.documentNumber}`, receipt.date);
    if (receipt.time) {
      twoColumn(`Type: ${receipt.documentType || 'TAX INVOICE'}`, receipt.time);
    }
    if (receipt.cashierName) {
      appendLine(`Cashier: ${receipt.cashierName}`);
    }

    if (receipt.customerName && receipt.customerName !== 'Cash Sale' && receipt.customerName !== 'Walk-in Customer') {
      horizontalLine('-');
      appendLine(`Customer: ${receipt.customerName}`);
      if (receipt.customerPhone) {
        appendLine(`Phone: ${receipt.customerPhone}`);
      }
      if (receipt.customerGstin) {
        appendLine(`GSTIN: ${receipt.customerGstin}`);
      }
    }

    horizontalLine('-');

    // 4. Items Header & Table
    boldOn();
    if (is80mm) {
      // 48 columns: Item (22), Qty (6), Rate (10), Amount (10)
      appendLine('ITEM                   QTY    RATE     AMOUNT');
    } else {
      // 32 columns: Item (16), Qty (4), Rate (5), Amt (7)
      appendLine('ITEM            QTY   RATE   AMT');
    }
    boldOff();
    horizontalLine('-');

    receipt.items.forEach((item) => {
      const name = item.name;
      const qtyStr = `${item.quantity}${item.unit ? item.unit.slice(0, 2) : ''}`;
      const rateStr = item.rate.toFixed(1);
      const amtStr = item.amount.toFixed(2);

      if (is80mm) {
        const itemCol = name.padEnd(22).slice(0, 22);
        const qtyCol = qtyStr.padStart(6);
        const rateCol = rateStr.padStart(8);
        const amtCol = amtStr.padStart(10);
        appendLine(`${itemCol} ${qtyCol} ${rateCol} ${amtCol}`);
      } else {
        const itemCol = name.padEnd(15).slice(0, 15);
        const qtyCol = qtyStr.padStart(4);
        const rateCol = rateStr.padStart(6);
        const amtCol = amtStr.padStart(7);
        appendLine(`${itemCol} ${qtyCol} ${rateCol} ${amtCol}`);
      }
    });

    horizontalLine('-');

    // 5. Totals & Tax Summary
    alignLeft();
    twoColumn('Sub-Total (Taxable):', `Rs. ${receipt.subTotal.toFixed(2)}`);

    if (receipt.totalTax > 0) {
      twoColumn('GST Tax:', `Rs. ${receipt.totalTax.toFixed(2)}`);
    }

    if (receipt.discountAmount && receipt.discountAmount > 0) {
      twoColumn('Discount Applied:', `-Rs. ${receipt.discountAmount.toFixed(2)}`);
    }

    horizontalLine('=');

    // Grand Total (Bold & Larger)
    boldOn();
    doubleHeightOn();
    alignLeft();
    twoColumn('GRAND TOTAL:', `Rs. ${receipt.grandTotal.toFixed(2)}`);
    normalFont();
    boldOff();

    horizontalLine('=');

    // 6. Payment Information
    if (receipt.paymentMode) {
      twoColumn('Payment Mode:', receipt.paymentMode);
    }
    twoColumn('Items Count:', `${receipt.items.length}`);

    horizontalLine('-');

    // 7. Footer & Greeting
    alignCenter();
    appendLine(receipt.footerMessage || 'Thank you for your business!');
    appendLine('Powered by VTGST Cloud');
    appendLine('www.vivergst.com');

    // Feed lines & Cut Paper Command
    appendLine();
    appendLine();
    appendLine();
    append(GS, 0x56, 0x41, 0x10); // Partial cut command

    return new Uint8Array(buffer);
  }

  public async printReceipt(receipt: ReceiptData): Promise<boolean> {
    if (!this.characteristic) {
      throw new Error('Bluetooth printer is not connected. Please connect your printer first.');
    }

    const data = this.buildEscPosCommands(receipt);
    return this.sendRawBytes(data);
  }

  public async printTestPage(): Promise<boolean> {
    const testData: ReceiptData = {
      companyName: 'VTGST BLUETOOTH TEST',
      legalName: 'Viver Technologies POS Engine',
      gstin: '03AAAAA0000A1Z5',
      address: 'Cloud Terminal Handheld POS',
      city: 'Thermal ESC/POS Standard',
      phone: '+91 98765 43210',
      documentNumber: 'TEST-0001',
      date: new Date().toLocaleDateString('en-IN'),
      time: new Date().toLocaleTimeString('en-IN'),
      items: [
        { name: 'Standard Thermal Paper', quantity: 1, rate: 50.0, amount: 50.0 },
        { name: 'POS Bluetooth Protocol', quantity: 1, rate: 100.0, amount: 100.0 },
      ],
      subTotal: 150.0,
      totalTax: 27.0,
      grandTotal: 177.0,
      paymentMode: 'BLUETOOTH TEST',
      footerMessage: '*** TEST PRINT SUCCESSFUL ***',
    };

    return this.printReceipt(testData);
  }

  private async sendRawBytes(bytes: Uint8Array): Promise<boolean> {
    if (!this.characteristic) {
      throw new Error('Printer disconnected.');
    }

    // Low-energy Bluetooth MTU slice (512 bytes per packet)
    const CHUNK_SIZE = 256;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      if (this.characteristic.writeValueWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      // Small 20ms pause between chunks to prevent printer buffer overrun
      await new Promise((r) => setTimeout(r, 20));
    }

    return true;
  }
}

// Singleton Instance
export const bluetoothPrinter = new BluetoothPrinterService();
