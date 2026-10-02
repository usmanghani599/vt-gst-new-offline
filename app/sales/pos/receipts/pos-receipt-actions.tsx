'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Printer, Bluetooth, Trash2, Loader2, Share2, Eye } from 'lucide-react';
import { bluetoothPrinter, ReceiptData } from '@/lib/bluetooth-printer';
import { BluetoothPrinterModal } from '@/components/bluetooth-printer-modal';

interface PosReceiptActionsProps {
  receipt: any;
  company: any;
}

export function PosReceiptActions({ receipt, company }: PosReceiptActionsProps) {
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
        documentNumber: receipt.documentNumber,
        documentType: receipt.documentType,
        date: new Date(receipt.documentDate).toLocaleDateString('en-IN'),
        customerName: receipt.billingPartyName || receipt.party?.name || 'Walk-in Retail Customer',
        customerPhone: receipt.party?.mobile || undefined,
        items: (receipt.items || []).map((it: any) => ({
          name: it.itemName || it.name,
          quantity: Number(it.quantity),
          rate: Number(it.unitRate || it.rate),
          amount: Number(it.lineTotal || (it.quantity * it.unitRate)),
          unit: it.unitName,
        })),
        subTotal: Number(receipt.subTotal),
        totalTax: Number(receipt.taxTotal),
        grandTotal: Number(receipt.grandTotal),
        paymentMode: receipt.paymentMode || 'CASH',
        footerMessage: 'Thank you! Visit again.',
      };

      await bluetoothPrinter.printReceipt(receiptData);
    } catch (err: any) {
      alert(`Bluetooth Print Error: ${err.message}`);
    } finally {
      setPrinting(false);
    }
  }

  async function handleDeletePosBill(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Are you sure you want to delete POS Bill #${receipt.documentNumber}? Stock quantities and ledger accounts will be automatically reversed.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${receipt.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete POS bill');

      router.refresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 justify-center">
        {/* Bluetooth Print */}
        <button
          type="button"
          onClick={handleBluetoothPrint}
          disabled={printing}
          title="Print Thermal POS Receipt"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition active:scale-95 cursor-pointer"
        >
          {printing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Bluetooth className="h-3 w-3 text-emerald-600" />
          )}
          <span>Print</span>
        </button>

        {/* View Details */}
        <Link
          href={`/sales/invoices/${receipt.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-sky-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition"
        >
          <Eye className="h-3 w-3" />
          <span>View</span>
        </Link>

        {/* Delete POS Bill */}
        <button
          type="button"
          onClick={handleDeletePosBill}
          disabled={deleting}
          title="Delete POS Receipt & Reverse Inventory"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-lg transition cursor-pointer disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>

      <BluetoothPrinterModal isOpen={btModalOpen} onClose={() => setBtModalOpen(false)} />
    </>
  );
}
