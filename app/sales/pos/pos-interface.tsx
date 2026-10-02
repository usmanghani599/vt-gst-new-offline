'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Barcode,
  Camera,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  Bluetooth,
  FileText,
  Loader2,
  CheckCircle2,
  UserCheck,
  Award,
  Share2,
  ShoppingBag,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Decimal from 'decimal.js';
import { bluetoothPrinter, PrinterDevice, ReceiptData } from '@/lib/bluetooth-printer';
import { MobileBarcodeScanner } from '@/components/mobile-barcode-scanner';
import { BluetoothPrinterModal } from '@/components/bluetooth-printer-modal';

interface PosInterfaceProps {
  company: any;
  items: any[];
  parties: any[];
  categories: any[];
  bankAccounts: any[];
  salesmen?: any[];
  loggedSalesmanId?: string;
}

export function PosInterface({
  company,
  items,
  parties: initialParties,
  categories,
  bankAccounts,
  salesmen = [],
  loggedSalesmanId,
}: PosInterfaceProps) {
  const router = useRouter();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const enableTaxes = company?.posEnableTax ?? true;
  const [partiesList, setPartiesList] = useState<any[]>(initialParties);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>(
    loggedSalesmanId || (salesmen.length > 0 ? salesmen[0].id : '')
  );
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [loading, setLoading] = useState(false);
  const [successDoc, setSuccessDoc] = useState<any>(null);

  // Customer Modal States
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [customerModalError, setCustomerModalError] = useState('');
  const [customerCreating, setCustomerCreating] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    mobile: '',
    email: '',
    gstin: '',
    billingAddress: '',
  });

  // Bluetooth & Scanner States
  const [printerStatus, setPrinterStatus] = useState<PrinterDevice | null>(null);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [btPrinting, setBtPrinting] = useState(false);

  // Subscribe to Bluetooth printer connection status
  useEffect(() => {
    const unsubscribe = bluetoothPrinter.subscribe((status) => {
      setPrinterStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // Focus barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Filter products by category and search term
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchCat = selectedCategory === 'ALL' || it.categoryId === selectedCategory;
      const matchSearch =
        !searchQuery ||
        it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (it.sku && it.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (it.barcode && it.barcode.includes(searchQuery));
      return matchCat && matchSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  function addToCart(item: any) {
    const existingIndex = cart.findIndex((c) => c.id === item.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          id: item.id,
          name: item.name,
          sku: item.sku,
          hsnSac: item.hsnSac || '',
          unitName: item.unit?.code || 'PCS',
          rate: Number(item.salesPrice),
          quantity: 1,
          taxRate: Number(item.taxRate?.rate || 18),
        },
      ]);
    }
  }

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matched = items.find(
      (it) => it.barcode === barcodeInput.trim() || it.sku?.toLowerCase() === barcodeInput.trim().toLowerCase()
    );

    if (matched) {
      addToCart(matched);
      setBarcodeInput('');
    } else {
      alert(`No product found with barcode/SKU: ${barcodeInput}`);
    }
  }

  function handleCameraScan(scannedCode: string) {
    const matched = items.find(
      (it) => it.barcode === scannedCode || it.sku?.toLowerCase() === scannedCode.toLowerCase()
    );

    if (matched) {
      addToCart(matched);
    } else {
      alert(`Product with barcode "${scannedCode}" not found.`);
    }
  }

  function updateQty(id: string, delta: number) {
    const updated = cart
      .map((c) => {
        if (c.id === id) {
          const newQty = Math.max(1, c.quantity + delta);
          return { ...c, quantity: newQty };
        }
        return c;
      })
      .filter(Boolean);
    setCart(updated);
  }

  function removeFromCart(id: string) {
    setCart(cart.filter((c) => c.id !== id));
  }

  // Live Totals
  const totals = useMemo(() => {
    let subTotal = new Decimal(0);
    let totalTax = new Decimal(0);

    for (const c of cart) {
      const lineNet = new Decimal(c.quantity).times(new Decimal(c.rate));
      if (enableTaxes) {
        const taxRate = new Decimal(c.taxRate || 0);
        // In POS, default is inclusive
        const divisor = new Decimal(1).plus(taxRate.dividedBy(100));
        const taxable = lineNet.dividedBy(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const tax = lineNet.minus(taxable);

        subTotal = subTotal.plus(taxable);
        totalTax = totalTax.plus(tax);
      } else {
        // Non-tax invoice: taxable = full price, tax = 0
        subTotal = subTotal.plus(lineNet);
      }
    }

    const discRate = new Decimal(discountPercent || 0);
    const gross = subTotal.plus(totalTax);
    const discAmount = gross.times(discRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const grandTotal = gross.minus(discAmount).round();
    const roundOff = grandTotal.minus(gross.minus(discAmount));

    return {
      subTotal: subTotal.toNumber(),
      totalTax: totalTax.toNumber(),
      discAmount: discAmount.toNumber(),
      roundOff: roundOff.toNumber(),
      grandTotal: grandTotal.toNumber(),
    };
  }, [cart, discountPercent, enableTaxes]);

  // Helper to build ESC/POS receipt data
  function buildReceiptPayload(doc: any, cartSnapshot: any[]): ReceiptData {
    const selectedParty = partiesList.find((p) => p.id === selectedPartyId);
    const cashier = salesmen.find((s) => s.id === selectedSalesmanId);

    return {
      companyName: company?.name || 'VTGST RETAIL STORE',
      legalName: company?.legalName || undefined,
      gstin: company?.gstin || undefined,
      address: company?.address || undefined,
      city: company?.city || undefined,
      phone: company?.phone || company?.mobile || undefined,
      email: company?.email || undefined,
      fssaiNo: company?.fssaiNo || undefined,
      documentNumber: doc.documentNumber || 'INV-001',
      documentType: doc.documentType || 'RETAIL POS RECEIPT',
      date: new Date().toLocaleDateString('en-IN'),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      customerName: selectedParty?.name || 'Walk-in Customer',
      customerPhone: selectedParty?.mobile || selectedParty?.phone || undefined,
      customerGstin: selectedParty?.gstin || undefined,
      items: cartSnapshot.map((c) => ({
        name: c.name,
        quantity: c.quantity,
        rate: c.rate,
        amount: c.quantity * c.rate,
        unit: c.unitName,
      })),
      subTotal: totals.subTotal,
      totalTax: totals.totalTax,
      discountAmount: totals.discAmount,
      grandTotal: totals.grandTotal,
      paymentMode: paymentMode,
      cashierName: cashier?.name || undefined,
      footerMessage: selectedParty && (selectedParty.mobile || selectedParty.phone)
        ? `Points earned: ${(totals.grandTotal * 0.01).toFixed(0)} pts | Thank you for shopping with us!`
        : 'Thank you for shopping with us!',
    };
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) {
      setCustomerModalError('Customer Name is required');
      return;
    }
    if (!newCustomerForm.mobile.trim() || newCustomerForm.mobile.trim().length < 7) {
      setCustomerModalError('A valid Mobile Number is required for customer billing and loyalty rewards.');
      return;
    }

    setCustomerCreating(true);
    setCustomerModalError('');

    try {
      const res = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomerForm.name.trim(),
          mobile: newCustomerForm.mobile.trim(),
          email: newCustomerForm.email.trim() || undefined,
          gstin: newCustomerForm.gstin.trim() || undefined,
          billingAddress: newCustomerForm.billingAddress.trim() || undefined,
          partyType: 'CUSTOMER',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create customer');

      setPartiesList((prev) => [data.party, ...prev]);
      setSelectedPartyId(data.party.id);
      setAddCustomerModalOpen(false);
      setNewCustomerForm({
        name: '',
        mobile: '',
        email: '',
        gstin: '',
        billingAddress: '',
      });
    } catch (err: any) {
      setCustomerModalError(err.message);
    } finally {
      setCustomerCreating(false);
    }
  }

  async function handlePrintBluetooth(doc: any, cartSnapshot: any[]) {
    if (!bluetoothPrinter.getStatus()?.connected) {
      setPrinterModalOpen(true);
      return;
    }

    setBtPrinting(true);
    try {
      const receiptData = buildReceiptPayload(doc, cartSnapshot);
      await bluetoothPrinter.printReceipt(receiptData);
    } catch (err: any) {
      alert(`Bluetooth print error: ${err.message}`);
    } finally {
      setBtPrinting(false);
    }
  }

  async function handleCheckout(asEstimate: boolean = false) {
    if (cart.length === 0) return;

    // Rule: Mandatory customer name & mobile number for UPI / QR Billing
    if (!asEstimate && paymentMode === 'UPI') {
      const selectedParty = partiesList.find((p) => p.id === selectedPartyId);
      const partyMobile = selectedParty?.mobile || selectedParty?.phone;
      if (!selectedPartyId || !partyMobile || partyMobile.trim().length < 7) {
        setCustomerModalError('Customer Name and Mobile Number are mandatory for UPI / QR Billing. Please add or select the customer before proceeding.');
        setAddCustomerModalOpen(true);
        return;
      }
    }

    setLoading(true);
    const cartSnapshot = [...cart];

    try {
      const payload = {
        documentType: asEstimate ? 'ESTIMATE' : 'POS',
        documentDate: new Date(),
        partyId: selectedPartyId || undefined,
        billingPartyName: selectedPartyId ? undefined : 'Walk-in Retail Customer',
        taxMode: enableTaxes ? 'TAX_INCLUSIVE' : 'TAX_EXCLUSIVE',
        salesmanId: selectedSalesmanId || null,
        paidAmount: asEstimate ? 0 : totals.grandTotal,
        paymentMode: asEstimate ? undefined : paymentMode,
        bankAccountId: bankAccounts[0]?.id || null,
        notes: enableTaxes ? undefined : 'Non-GST Regular Invoice',
        items: cart.map((c) => ({
          itemId: c.id,
          itemName: c.name,
          hsnSac: c.hsnSac,
          quantity: c.quantity,
          unitName: c.unitName,
          unitRate: c.rate,
          taxPercentage: enableTaxes ? c.taxRate : 0,
        })),
      };

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      setSuccessDoc(data.document);
      setCart([]);
      setMobileCartOpen(false);

      // Auto-print if Bluetooth printer is already paired and connected
      if (!asEstimate && bluetoothPrinter.getStatus()?.connected) {
        try {
          const receiptData = buildReceiptPayload(data.document, cartSnapshot);
          await bluetoothPrinter.printReceipt(receiptData);
        } catch (printErr: any) {
          console.warn('Auto-print over Bluetooth failed:', printErr);
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleShareWhatsApp() {
    if (!successDoc) return;
    const text = `Invoice #${successDoc.documentNumber} from ${company?.name || 'VTGST Store'}%0ATotal: Rs. ${successDoc.grandTotal}%0ADate: ${new Date().toLocaleDateString('en-IN')}%0AView Invoice: ${window.location.origin}/sales/invoices/${successDoc.id}`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-140px)]">
        {/* Left: Product Catalog & Search (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 overflow-hidden">
          {/* Barcode, Search & Camera Scanner Controls */}
          <div className="flex items-center gap-2 mb-3">
            <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
              <Barcode className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan / Type Barcode..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold bg-slate-50/50"
              />
            </form>

            {/* Camera Barcode Scanner Button */}
            <button
              type="button"
              onClick={() => setCameraScannerOpen(true)}
              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition flex items-center justify-center shrink-0"
              title="Scan with Camera"
            >
              <Camera className="h-4 w-4" />
            </button>

            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, SKU..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Category Horizontal Scroll Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 shrink-0 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Items ({items.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 p-6">
                <Search className="h-8 w-8 mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600">No items match your search</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try a different name, SKU, or category</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 content-start auto-rows-max gap-3">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addToCart(item)}
                    className="h-28 p-3 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 border border-slate-200/80 rounded-2xl text-left transition flex flex-col justify-between group shadow-2xs active:scale-[0.98] cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-sky-700 line-clamp-2 leading-tight">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku || '-'}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 group-hover:text-sky-600">
                        {formatCurrency(item.salesPrice)}
                      </span>
                      <span className="h-6 w-6 rounded-lg bg-sky-100 group-hover:bg-sky-600 group-hover:text-white text-sky-700 flex items-center justify-center text-xs font-black transition">
                        +
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart, Customer & Checkout Sidebar (5 Cols - Desktop) */}
        <div
          className={`lg:col-span-5 flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 overflow-hidden ${
            mobileCartOpen
              ? 'fixed inset-x-0 bottom-0 top-16 z-40 p-5 rounded-t-3xl border-t shadow-2xl flex flex-col'
              : 'hidden lg:flex'
          }`}
        >
          {/* Mobile Drawer Header with Close */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 lg:hidden">
            <div className="flex items-center gap-2 font-black text-slate-900 text-base">
              <ShoppingBag className="h-5 w-5 text-sky-600" /> Current Bill ({cart.length} items)
            </div>
            <button
              onClick={() => setMobileCartOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Customer & Cashier Selector */}
          <div className="space-y-2 mb-3 shrink-0 pt-2 lg:pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Customer
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerModalError('');
                      setAddCustomerModalOpen(true);
                    }}
                    className="text-[10px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add Customer
                  </button>
                </div>
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Walk-in Customer (Cash)</option>
                  {partiesList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.mobile ? `(${p.mobile})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {salesmen.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Salesman / Cashier
                  </label>
                  <select
                    value={selectedSalesmanId}
                    onChange={(e) => setSelectedSalesmanId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {salesmen.map((sm) => (
                      <option key={sm.id} value={sm.id}>
                        {sm.name} {sm.employeeCode ? `[${sm.employeeCode}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Loyalty Points / Mandatory UPI Warning Banner */}
            {(() => {
              const selectedParty = partiesList.find((p) => p.id === selectedPartyId);
              if (selectedParty && !selectedParty.isWalkIn) {
                const earnedPts = (totals.grandTotal * 0.01).toFixed(0);
                return (
                  <div className="p-2 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <Award className="h-4 w-4 text-amber-600" />
                      <span>Customer Loyalty:</span>
                    </div>
                    <span className="font-extrabold text-amber-800 text-[11px]">
                      +{earnedPts} Points will be credited
                    </span>
                  </div>
                );
              } else if (paymentMode === 'UPI') {
                return (
                  <div className="p-2 bg-rose-50 rounded-xl border border-rose-200/80 flex items-center justify-between text-xs text-rose-800 font-bold">
                    <span>Mobile No. required for UPI / QR</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerModalError('Customer Name and Mobile Number are required for UPI billing.');
                        setAddCustomerModalOpen(true);
                      }}
                      className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
                    >
                      + Add Details
                    </button>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1 min-h-[160px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6">
                <ShoppingBag className="h-10 w-10 mb-2 opacity-30 text-slate-400" />
                <p className="text-xs font-bold text-slate-600">Cart is Empty</p>
                <p className="text-[11px] text-slate-400">Select items from catalog or scan barcode</p>
              </div>
            ) : (
              cart.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex-1 pr-2">
                    <div className="font-bold text-slate-900 leading-tight">{c.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {formatCurrency(c.rate)} / {c.unitName}
                    </div>
                  </div>

                  {/* Qty +/- buttons */}
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => updateQty(c.id, -1)}
                      className="p-1 text-slate-600 hover:bg-white rounded transition"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-bold text-xs px-1.5 min-w-[20px] text-center">
                      {c.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(c.id, 1)}
                      className="p-1 text-slate-600 hover:bg-white rounded transition"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="w-16 text-right font-black text-slate-900">
                    {formatCurrency(c.quantity * c.rate)}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(c.id)}
                    className="ml-2 text-slate-400 hover:text-red-600 p-1 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Quick Payment Settlement & Checkout */}
          <div className="pt-3 border-t border-slate-200 space-y-3 shrink-0">
            {/* Totals */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Sub-Total {enableTaxes ? '(Taxable)' : ''}:</span>
                <span className="font-semibold">{formatCurrency(totals.subTotal)}</span>
              </div>
              {enableTaxes && (
                <div className="flex justify-between text-slate-500">
                  <span>GST Total:</span>
                  <span className="font-semibold">{formatCurrency(totals.totalTax)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-t border-b border-slate-200">
                <span className="text-sm font-bold text-slate-900">Total Payable:</span>
                <span className="text-xl font-black text-slate-900">
                  {formatCurrency(totals.grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'UPI', label: 'UPI / QR', icon: QrCode },
                { id: 'CARD', label: 'Card', icon: CreditCard },
              ].map((pm) => {
                const Icon = pm.icon;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMode(pm.id)}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      paymentMode === pm.id
                        ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {pm.label}
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={loading || cart.length === 0}
                onClick={() => handleCheckout(true)}
                className="px-3 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-40"
              >
                <FileText className="h-4 w-4" /> Save Estimate
              </button>

              <button
                type="button"
                disabled={loading || cart.length === 0}
                onClick={() => handleCheckout(false)}
                className="px-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-emerald-600/20 disabled:opacity-40 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : printerStatus?.connected ? (
                  <Printer className="h-4 w-4" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                <span>
                  {loading
                    ? 'Processing...'
                    : printerStatus?.connected
                    ? 'Charge & BT Print'
                    : 'Charge & Print'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Cart Bar for Handheld Mobile */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 p-3 bg-slate-900/90 backdrop-blur-md z-30 shadow-2xl flex items-center justify-between text-white border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
            {cart.reduce((acc, c) => acc + c.quantity, 0)}
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Payable</div>
            <div className="text-base font-black leading-tight">
              {formatCurrency(totals.grandTotal)}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="bg-sky-500 hover:bg-sky-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
        >
          <span>View Cart / Pay</span>
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      {/* Camera Barcode Scanner Modal */}
      <MobileBarcodeScanner
        isOpen={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onScan={handleCameraScan}
      />

      {/* Bluetooth Printer Pairing Modal */}
      <BluetoothPrinterModal
        isOpen={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
      />

      {/* Success Modal / Instant Print & WhatsApp */}
      {successDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100">
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Sale Finalized!</h3>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Bill No: {successDoc.documentNumber}
              </p>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {formatCurrency(successDoc.grandTotal)}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {/* Direct Bluetooth Thermal Print Button */}
              <button
                type="button"
                disabled={btPrinting}
                onClick={() => handlePrintBluetooth(successDoc, cart)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
              >
                {btPrinting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Printing on Thermal...</span>
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    <span>Print on Bluetooth Thermal</span>
                  </>
                )}
              </button>

              {/* Share on WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
              >
                <Share2 className="h-4 w-4" />
                <span>Share Receipt on WhatsApp</span>
              </button>

              {/* Standard Web Print */}
              <button
                type="button"
                onClick={() => router.push(`/sales/invoices/${successDoc.id}`)}
                className="w-full border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition"
              >
                View Full A4 / Tax Invoice
              </button>

              {/* Next Bill */}
              <button
                type="button"
                onClick={() => setSuccessDoc(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition"
              >
                Next Customer (New Bill)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Quick Customer Modal */}
      {addCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Add Customer</h3>
                  <p className="text-[11px] text-slate-500">
                    Register customer for loyalty reward points & QR billing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddCustomerModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {customerModalError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {customerModalError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustomerForm.name}
                  onChange={(e) =>
                    setNewCustomerForm({ ...newCustomerForm, name: e.target.value })
                  }
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mobile Number * <span className="text-[10px] text-sky-600 font-normal">(Mandatory for UPI/QR & Points)</span>
                </label>
                <input
                  type="tel"
                  required
                  value={newCustomerForm.mobile}
                  onChange={(e) =>
                    setNewCustomerForm({ ...newCustomerForm, mobile: e.target.value })
                  }
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, email: e.target.value })
                    }
                    placeholder="customer@email.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={newCustomerForm.gstin}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, gstin: e.target.value.toUpperCase() })
                    }
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Address / City (Optional)</label>
                <input
                  type="text"
                  value={newCustomerForm.billingAddress}
                  onChange={(e) =>
                    setNewCustomerForm({ ...newCustomerForm, billingAddress: e.target.value })
                  }
                  placeholder="City, locality..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-[11px]"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center gap-2 text-[11px] text-amber-800">
                <Award className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Loyalty account will automatically be created to track purchase reward points.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddCustomerModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={customerCreating}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {customerCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  <span>Save & Select Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
