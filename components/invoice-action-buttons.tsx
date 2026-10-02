'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Printer, Share2, Bluetooth, Loader2, Eye, Trash2 } from 'lucide-react';
import { bluetoothPrinter, ReceiptData } from '@/lib/bluetooth-printer';
import { BluetoothPrinterModal } from './bluetooth-printer-modal';

interface InvoiceActionButtonsProps {
  invoice: any;
  company: any;
}

export function InvoiceActionButtons({ invoice, company }: InvoiceActionButtonsProps) {
  const router = useRouter();
  const [btModalOpen, setBtModalOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleBluetoothPrint(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!bluetoothPrinter.getStatus()?.connected) {
      setBtModalOpen(true);
      return;
    }

    setPrinting(true);
    try {
      const receiptData: ReceiptData = {
        companyName: company?.name || 'VTGST STORE',
        legalName: company?.legalName || undefined,
        gstin: company?.gstin || undefined,
        address: company?.address || undefined,
        city: company?.city || undefined,
        phone: company?.phone || company?.mobile || undefined,
        documentNumber: invoice.documentNumber,
        documentType: invoice.documentType,
        date: new Date(invoice.documentDate).toLocaleDateString('en-IN'),
        customerName: invoice.billingPartyName || invoice.party?.name || 'Walk-in Customer',
        customerPhone: invoice.billingPartyPhone || invoice.party?.mobile || undefined,
        customerGstin: invoice.billingGstin || invoice.party?.gstin || undefined,
        items: (invoice.items || []).map((it: any) => ({
          name: it.itemName || it.name,
          quantity: Number(it.quantity),
          rate: Number(it.unitRate || it.rate),
          amount: Number(it.lineTotal || (it.quantity * it.unitRate)),
          unit: it.unitName,
        })),
        subTotal: Number(invoice.subTotal),
        totalTax: Number(invoice.taxTotal),
        grandTotal: Number(invoice.grandTotal),
        paymentMode: invoice.paymentMode || 'CASH',
        footerMessage: 'Thank you for your business!',
      };

      await bluetoothPrinter.printReceipt(receiptData);
    } catch (err: any) {
      alert(`Bluetooth Print Error: ${err.message}`);
    } finally {
      setPrinting(false);
    }
  }

  function handleShareWhatsApp(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const text = `Invoice #${invoice.documentNumber} from ${company?.name || 'VTGST Store'}%0ATotal: Rs. ${invoice.grandTotal}%0ADate: ${new Date(invoice.documentDate).toLocaleDateString('en-IN')}%0AView Invoice: ${window.location.origin}/sales/invoices/${invoice.id}`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  async function handleDeleteInvoice(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Are you sure you want to delete Invoice #${invoice.documentNumber}? This will reverse all stock movements and ledger entries associated with it.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${invoice.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete invoice');

      router.refresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 justify-end">
        {/* Bluetooth Thermal Print Button */}
        <button
          type="button"
          onClick={handleBluetoothPrint}
          disabled={printing}
          title="Print on Bluetooth Thermal Printer (58mm/80mm)"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer"
        >
          {printing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Bluetooth className="h-3 w-3 text-indigo-600" />
          )}
          <span>BT Print</span>
        </button>

        {/* WhatsApp Share Button */}
        <button
          type="button"
          onClick={handleShareWhatsApp}
          title="Share Receipt on WhatsApp"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-1 rounded-lg transition active:scale-95 cursor-pointer"
        >
          <Share2 className="h-3 w-3 text-emerald-600" />
        </button>

        {/* View / Print Full Invoice Link */}
        <Link
          href={`/sales/invoices/${invoice.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-sky-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition"
        >
          <Eye className="h-3 w-3" />
          <span>View</span>
        </Link>

        {/* Delete Invoice Button */}
        <button
          type="button"
          onClick={handleDeleteInvoice}
          disabled={deleting}
          title="Delete Invoice and reverse ledger/stock"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-lg transition cursor-pointer disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>

      <BluetoothPrinterModal isOpen={btModalOpen} onClose={() => setBtModalOpen(false)} />
    </>
  );
}
