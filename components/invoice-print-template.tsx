'use client';

import React, { useState } from 'react';
import { formatCurrency, formatQuantity, formatDate } from '@/lib/utils';
import { numberToWordsINR } from '@/lib/amount-in-words';
import { Printer, ArrowLeft, Bluetooth, Share2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { bluetoothPrinter, ReceiptData } from '@/lib/bluetooth-printer';
import { BluetoothPrinterModal } from './bluetooth-printer-modal';

interface InvoicePrintProps {
  document: any;
  company: any;
  bankAccount?: any;
  copyLabel?: string;
  backHref?: string;
}

export function InvoicePrintTemplate({
  document,
  company,
  bankAccount,
  copyLabel = 'Original for Recipient',
  backHref = '/sales/invoices',
}: InvoicePrintProps) {
  const [btModalOpen, setBtModalOpen] = useState(false);
  const [btPrinting, setBtPrinting] = useState(false);

  const isBOS = document.documentType === 'BILL_OF_SUPPLY';
  const isEstimate = document.documentType === 'ESTIMATE';
  const hasZeroTax = Number(document.taxTotal || 0) === 0;
  const isTaxableInvoice = !isBOS && !isEstimate && !hasZeroTax;

  const docHeading = isBOS
    ? 'BILL OF SUPPLY'
    : isEstimate
    ? 'ESTIMATE'
    : isTaxableInvoice
    ? 'TAX INVOICE'
    : document.documentType === 'POS'
    ? 'RETAIL INVOICE'
    : 'INVOICE / BILL';

  async function handleBluetoothPrint() {
    if (!bluetoothPrinter.getStatus()?.connected) {
      setBtModalOpen(true);
      return;
    }

    setBtPrinting(true);
    try {
      const receiptData: ReceiptData = {
        companyName: company?.name || 'VTGST STORE',
        legalName: company?.legalName || undefined,
        gstin: company?.gstin || undefined,
        address: company?.address || undefined,
        city: company?.city || undefined,
        phone: company?.phone || company?.mobile || undefined,
        email: company?.email || undefined,
        documentNumber: document.documentNumber,
        documentType: docHeading,
        date: new Date(document.documentDate).toLocaleDateString('en-IN'),
        customerName: document.billingPartyName || document.party?.name || 'Walk-in Customer',
        customerPhone: document.billingPartyPhone || document.party?.mobile || undefined,
        customerGstin: document.billingGstin || document.party?.gstin || undefined,
        items: (document.items || []).map((it: any) => ({
          name: it.itemName || it.name,
          quantity: Number(it.quantity),
          rate: Number(it.unitRate || it.rate),
          amount: Number(it.lineTotal || (it.quantity * it.unitRate)),
          unit: it.unitName,
        })),
        subTotal: Number(document.subTotal),
        totalTax: Number(document.taxTotal),
        grandTotal: Number(document.grandTotal),
        paymentMode: document.paymentMode || 'CASH',
        footerMessage: 'Thank you for your business!',
      };

      await bluetoothPrinter.printReceipt(receiptData);
    } catch (err: any) {
      alert(`Bluetooth Print Error: ${err.message}`);
    } finally {
      setBtPrinting(false);
    }
  }

  function handleShareWhatsApp() {
    const text = `Invoice #${document.documentNumber} from ${company?.name || 'VTGST Store'}%0ATotal: Rs. ${document.grandTotal}%0ADate: ${new Date(document.documentDate).toLocaleDateString('en-IN')}%0AView Invoice: ${window.location.href}`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 flex flex-col items-center">
      {/* Top Action Bar (hidden in print) */}
      <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </Link>
        <div className="flex items-center gap-2">
          {/* Bluetooth Thermal Print Button */}
          <button
            type="button"
            onClick={handleBluetoothPrint}
            disabled={btPrinting}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
          >
            {btPrinting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bluetooth className="h-4 w-4" />
            )}
            <span>Thermal BT Print</span>
          </button>

          {/* WhatsApp Share */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          {/* Standard A4 Print */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print A4</span>
          </button>
        </div>
      </div>

      <BluetoothPrinterModal isOpen={btModalOpen} onClose={() => setBtModalOpen(false)} />

      {/* A4 Document Printable Sheet */}
      <div className="w-full max-w-4xl bg-white p-8 border border-slate-300 shadow-md print-container font-sans text-xs text-slate-800">
        {/* Header Ribbon */}
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {copyLabel}
            </span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{docHeading}</h1>
          </div>
          <div className="text-right">
            {company.gstin ? (
              <span className="text-[11px] font-mono text-slate-500">
                GSTIN: <strong>{company.gstin}</strong>
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Regular Bill</span>
            )}
          </div>
        </div>

        {/* Supplier & Document Summary */}
        <div className="grid grid-cols-2 gap-4 border p-3 rounded mb-4 bg-slate-50/50">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{company.legalName || company.name}</h2>
            <p className="text-slate-600 mt-1">{company.address || 'Company Address'}</p>
            <p className="text-slate-600">{company.city} - {company.pincode}, {company.state?.name || 'State'}</p>
            <p className="text-slate-600">Phone: {company.phone || company.mobile} | Email: {company.email}</p>
            {company.pan && <p className="text-slate-600">PAN: <strong>{company.pan}</strong></p>}
          </div>

          <div className="border-l pl-4 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Document No:</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{document.documentNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Date:</span>
              <span className="font-semibold text-slate-800">{formatDate(document.documentDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Place of Supply:</span>
              <span className="font-semibold text-slate-800">{document.billingState?.name || company.state?.name || 'Maharashtra'}</span>
            </div>
            {isTaxableInvoice && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Reverse Charge:</span>
                <span className="font-semibold text-slate-800">{document.reverseCharge ? 'Yes' : 'No'}</span>
              </div>
            )}
            {document.transport?.ewayBillNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">E-Way Bill:</span>
                <span className="font-mono font-semibold text-slate-800">{document.transport.ewayBillNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Billed To & Shipped To */}
        <div className="grid grid-cols-2 gap-4 border p-3 rounded mb-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Details of Receiver | Billed To</div>
            <div className="text-sm font-bold text-slate-900">{document.billingPartyName || document.party?.name || 'Walk-in Customer'}</div>
            <div className="text-slate-600 mt-0.5">{document.billingAddress || document.party?.billingAddress || '-'}</div>
            <div className="text-slate-600">State: {document.billingState?.name || 'Maharashtra'}</div>
            {document.billingGstin || document.party?.gstin ? (
              <div className="text-slate-600 mt-1">GSTIN: <strong>{document.billingGstin || document.party?.gstin}</strong></div>
            ) : null}
          </div>

          <div className="border-l pl-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Details of Consignee | Shipped To</div>
            <div className="text-sm font-bold text-slate-900">{document.billingPartyName || document.party?.name || 'Walk-in Customer'}</div>
            <div className="text-slate-600 mt-0.5">{document.shippingAddress || document.billingAddress || '-'}</div>
            <div className="text-slate-600">State: {document.shippingState?.name || document.billingState?.name || 'Maharashtra'}</div>
          </div>
        </div>

        {/* Item Table */}
        <table className="w-full border-collapse border mb-4 text-[11px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b">
              <th className="border p-1.5 text-center w-8">#</th>
              <th className="border p-1.5 text-left">Item Description</th>
              <th className="border p-1.5 text-center w-20">HSN/SAC</th>
              <th className="border p-1.5 text-right w-14">Qty</th>
              <th className="border p-1.5 text-right w-16">Rate</th>
              <th className="border p-1.5 text-right w-16">Disc</th>
              {isTaxableInvoice && (
                <>
                  <th className="border p-1.5 text-right w-20">Taxable</th>
                  <th className="border p-1.5 text-right w-16">Tax %</th>
                  <th className="border p-1.5 text-right w-20">Tax Amt</th>
                </>
              )}
              <th className="border p-1.5 text-right w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {document.items.map((item: any, idx: number) => (
              <tr key={item.id || idx} className="border-b">
                <td className="border p-1.5 text-center">{idx + 1}</td>
                <td className="border p-1.5 font-medium text-slate-900">{item.itemName}</td>
                <td className="border p-1.5 text-center font-mono">{item.hsnSac || '-'}</td>
                <td className="border p-1.5 text-right">{formatQuantity(item.quantity)} {item.unitName}</td>
                <td className="border p-1.5 text-right">{formatCurrency(item.unitRate, '')}</td>
                <td className="border p-1.5 text-right">{Number(item.discountRate || 0) > 0 ? `${item.discountRate}%` : '-'}</td>
                {isTaxableInvoice && (
                  <>
                    <td className="border p-1.5 text-right font-medium">{formatCurrency(item.taxableAmount, '')}</td>
                    <td className="border p-1.5 text-right">{item.taxPercentage}%</td>
                    <td className="border p-1.5 text-right">{formatCurrency(item.taxAmount, '')}</td>
                  </>
                )}
                <td className="border p-1.5 text-right font-bold">{formatCurrency(item.totalAmount, '')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tax Summary Table (Rendered only for Tax Invoices with active taxes) */}
        {isTaxableInvoice && document.taxes && document.taxes.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">GST Tax Breakdown</div>
            <table className="w-full border-collapse border text-[10px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b">
                  <th className="border p-1 text-left">Tax Component</th>
                  <th className="border p-1 text-right">Tax Rate %</th>
                  <th className="border p-1 text-right">Taxable Value</th>
                  <th className="border p-1 text-right">Tax Amount</th>
                </tr>
              </thead>
              <tbody>
                {document.taxes.map((tax: any, tIdx: number) => (
                  <tr key={tIdx} className="border-b">
                    <td className="border p-1 font-medium">{tax.taxTypeCode}</td>
                    <td className="border p-1 text-right">{tax.taxRatePercentage}%</td>
                    <td className="border p-1 text-right">{formatCurrency(tax.taxableAmount, '₹')}</td>
                    <td className="border p-1 text-right font-bold">{formatCurrency(tax.taxAmount, '₹')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Calculation Summary, Words & Bank Details */}
        <div className="grid grid-cols-2 gap-4 border p-3 rounded mb-4">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount in Words</div>
              <div className="text-xs font-semibold text-slate-900 mt-0.5">
                {numberToWordsINR(document.grandTotal)}
              </div>
            </div>

            {bankAccount && (
              <div className="border-t pt-2 text-[11px] text-slate-600">
                <div className="font-bold text-slate-800 mb-0.5">Bank Payment Details:</div>
                <div>Bank: <strong>{bankAccount.bankName}</strong></div>
                <div>A/C No: <strong>{bankAccount.accountNumber}</strong></div>
                <div>IFSC: <strong>{bankAccount.ifsc}</strong> | Branch: {bankAccount.branch}</div>
                {bankAccount.upiId && <div>UPI ID: <strong>{bankAccount.upiId}</strong></div>}
              </div>
            )}
          </div>

          <div className="border-l pl-4 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">{isTaxableInvoice ? 'Taxable Sub-Total:' : 'Sub-Total:'}</span>
              <span className="font-semibold text-slate-800">{formatCurrency(document.subTotal)}</span>
            </div>
            {isTaxableInvoice && (
              <div className="flex justify-between">
                <span className="text-slate-500">Total GST Tax:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(document.taxTotal)}</span>
              </div>
            )}
            {Number(document.freightCharges || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Freight Charges:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(document.freightCharges)}</span>
              </div>
            )}
            {Number(document.roundOff || 0) !== 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Round Off:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(document.roundOff)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-b py-1.5 mt-2">
              <span className="font-bold text-slate-900 text-sm">Grand Total:</span>
              <span className="font-black text-slate-900 text-base">{formatCurrency(document.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Terms & Signatures */}
        <div className="grid grid-cols-2 gap-4 border p-3 rounded">
          <div className="text-[10px] text-slate-500">
            <div className="font-bold text-slate-700 mb-1">Terms & Conditions:</div>
            <p>1. Goods once sold will not be taken back or exchanged.</p>
            <p>2. Subject to Mumbai Jurisdiction only.</p>
            <p>3. Payment due as per agreed terms.</p>
          </div>

          <div className="text-right flex flex-col justify-between h-24">
            <span className="text-[11px] font-bold text-slate-700">For {company.legalName || company.name}</span>
            <span className="text-[11px] font-medium text-slate-400">Authorized Signatory</span>
          </div>
        </div>
      </div>
    </div>
  );
}
