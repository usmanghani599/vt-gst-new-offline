'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Barcode,
  Camera,
  Search,
  Plus,
  Minus,
  Trash2,
  PackagePlus,
  CheckCircle2,
  Loader2,
  ArrowRight,
  History,
  FileSpreadsheet,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { MobileBarcodeScanner } from '@/components/mobile-barcode-scanner';

interface CatalogItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  categoryName: string;
  unitName: string;
  purchasePrice: number;
  salesPrice: number;
  currentStock: number;
}

interface StockInEntry {
  item: CatalogItem;
  quantity: number;
  unitRate: number;
  notes?: string;
}

export function StockInClient({
  items,
  companyName,
}: {
  items: CatalogItem[];
  companyName: string;
}) {
  const router = useRouter();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockEntries, setStockEntries] = useState<StockInEntry[]>([]);
  const [generalNotes, setGeneralNotes] = useState('Barcode Scan Inward / Restock');
  const [loading, setLoading] = useState(false);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [lastScannedItemName, setLastScannedItemName] = useState<string | null>(null);

  // Autofocus on barcode input on mount and after scans
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Filter items for manual search dropdown
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return items
      .filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.sku && it.sku.toLowerCase().includes(q)) ||
          (it.barcode && it.barcode.includes(q))
      )
      .slice(0, 8);
  }, [items, searchQuery]);

  function addItemToBatch(item: CatalogItem, qtyToAdd: number = 1) {
    setStockEntries((prev) => {
      const idx = prev.findIndex((e) => e.item.id === item.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx].quantity += qtyToAdd;
        return updated;
      } else {
        return [
          {
            item,
            quantity: qtyToAdd,
            unitRate: item.purchasePrice || 0,
            notes: '',
          },
          ...prev,
        ];
      }
    });

    setLastScannedItemName(item.name);
    setTimeout(() => setLastScannedItemName(null), 3000);
  }

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const trimmed = barcodeInput.trim();
    const matched = items.find(
      (it) =>
        it.barcode === trimmed ||
        it.sku?.toLowerCase() === trimmed.toLowerCase() ||
        it.id === trimmed
    );

    if (matched) {
      addItemToBatch(matched, 1);
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
    } else {
      alert(`No product found with Barcode / SKU: "${trimmed}". You can select from catalog search.`);
    }
  }

  function handleCameraScan(scannedCode: string) {
    const matched = items.find(
      (it) =>
        it.barcode === scannedCode ||
        it.sku?.toLowerCase() === scannedCode.toLowerCase()
    );

    if (matched) {
      addItemToBatch(matched, 1);
    } else {
      alert(`Product with barcode "${scannedCode}" not found.`);
    }
  }

  function updateQuantity(itemId: string, newQty: number) {
    if (newQty <= 0) {
      removeEntry(itemId);
      return;
    }
    setStockEntries((prev) =>
      prev.map((e) => (e.item.id === itemId ? { ...e, quantity: newQty } : e))
    );
  }

  function updateRate(itemId: string, newRate: number) {
    setStockEntries((prev) =>
      prev.map((e) => (e.item.id === itemId ? { ...e, unitRate: newRate } : e))
    );
  }

  function removeEntry(itemId: string) {
    setStockEntries((prev) => prev.filter((e) => e.item.id !== itemId));
  }

  const totals = useMemo(() => {
    const totalItems = stockEntries.length;
    const totalQty = stockEntries.reduce((sum, e) => sum + e.quantity, 0);
    const totalValue = stockEntries.reduce((sum, e) => sum + e.quantity * e.unitRate, 0);
    return { totalItems, totalQty, totalValue };
  }, [stockEntries]);

  async function handleConfirmStockIn() {
    if (stockEntries.length === 0) return;
    setLoading(true);

    try {
      const payload = {
        generalNotes,
        items: stockEntries.map((e) => ({
          itemId: e.item.id,
          quantity: e.quantity,
          unitRate: e.unitRate,
          notes: e.notes || undefined,
        })),
      };

      const res = await fetch('/api/stock-adjustments/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Stock inward failed');

      setSuccessMsg(`Successfully added stock for ${stockEntries.length} items (${totals.totalQty} total units)!`);
      setStockEntries([]);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <PackagePlus className="h-7 w-7 text-emerald-600" /> Quick Stock-In (Barcode Scanner)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              {companyName}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Fastest inward stock entry: scan product barcodes repeatedly or pick items from catalog to increase inventory
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/inventory/stock-ledger')}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <History className="h-4 w-4 text-slate-500" />
            <span>Stock Ledger</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/reports/stock')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4 text-slate-300" />
            <span>Stock Summary Report</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-900 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Barcode & Search Controls Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Main Barcode Scanner Input */}
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
            <Barcode className="h-5 w-5 absolute left-3.5 top-3 text-emerald-600" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan Barcode with Gun Scanner / Type SKU and press Enter..."
              className="w-full pl-11 pr-4 py-2.5 bg-emerald-50/40 border-2 border-emerald-400 focus:border-emerald-600 rounded-2xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder:text-slate-400"
            />
          </form>

          {/* Camera Scanner Button */}
          <button
            type="button"
            onClick={() => setCameraScannerOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-sm cursor-pointer shrink-0"
          >
            <Camera className="h-4 w-4" />
            <span>Camera Scanner</span>
          </button>

          {/* Manual Search Input */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name from catalog..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 focus:border-sky-500 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />

            {/* Dropdown for search results */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {searchResults.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      addItemToBatch(it, 1);
                      setSearchQuery('');
                    }}
                    className="w-full p-3 text-left hover:bg-emerald-50 flex items-center justify-between transition cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">{it.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        SKU: {it.sku || '-'} | Barcode: {it.barcode || '-'} | Category: {it.categoryName}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-700">
                        {formatCurrency(it.purchasePrice)}
                      </span>
                      <div className="text-[10px] text-slate-500">
                        Stock: <strong>{it.currentStock} {it.unitName}</strong>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Audio/Visual feedback banner upon barcode scan */}
        {lastScannedItemName && (
          <div className="p-2 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <span>Scanned: {lastScannedItemName} (+1 Qty added to batch)</span>
          </div>
        )}
      </div>

      {/* Main Stock-In Table and Action Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Scanned Items Table (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <span>Items to Inward</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {stockEntries.length} Items
              </span>
            </h3>
            {stockEntries.length > 0 && (
              <button
                type="button"
                onClick={() => setStockEntries([])}
                className="text-xs font-bold text-rose-600 hover:text-rose-700"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="flex-1 overflow-x-auto min-h-[240px]">
            {stockEntries.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400">
                <Barcode className="h-10 w-10 mb-2 opacity-30 text-slate-400" />
                <p className="text-xs font-bold text-slate-600">No items scanned yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Point your barcode gun scanner or search items above to start adding stock.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3 text-center">Current Stock</th>
                    <th className="p-3 text-center">Inward Qty</th>
                    <th className="p-3 text-right">Unit Cost (₹)</th>
                    <th className="p-3 text-right">Total (₹)</th>
                    <th className="p-3 text-center">New Stock</th>
                    <th className="p-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockEntries.map((e) => {
                    const lineTotal = e.quantity * e.unitRate;
                    const newStock = e.item.currentStock + e.quantity;

                    return (
                      <tr key={e.item.id} className="hover:bg-slate-50/60 transition">
                        {/* Product */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{e.item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            SKU: {e.item.sku || '-'} | {e.item.barcode || 'No barcode'}
                          </div>
                        </td>

                        {/* Current Stock */}
                        <td className="p-3 text-center font-bold text-slate-600">
                          {formatQuantity(e.item.currentStock)} {e.item.unitName}
                        </td>

                        {/* Inward Qty Controls */}
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => updateQuantity(e.item.id, e.quantity - 1)}
                              className="p-1 text-slate-600 hover:bg-white rounded transition cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={e.quantity}
                              onChange={(ev) =>
                                updateQuantity(e.item.id, parseFloat(ev.target.value) || 1)
                              }
                              className="w-14 text-center font-black text-xs bg-white border border-slate-300 rounded py-0.5"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(e.item.id, e.quantity + 1)}
                              className="p-1 text-slate-600 hover:bg-white rounded transition cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        {/* Unit Rate */}
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={e.unitRate}
                            onChange={(ev) =>
                              updateRate(e.item.id, parseFloat(ev.target.value) || 0)
                            }
                            className="w-20 text-right font-bold text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1"
                          />
                        </td>

                        {/* Total Line Value */}
                        <td className="p-3 text-right font-black text-emerald-700 text-xs">
                          {formatCurrency(lineTotal)}
                        </td>

                        {/* New Stock Preview */}
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-black border border-emerald-200">
                            <TrendingUp className="h-3 w-3 text-emerald-600" />
                            {formatQuantity(newStock)}
                          </span>
                        </td>

                        {/* Remove */}
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeEntry(e.item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Summary & Inward Confirmation Card (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4 h-fit">
          <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">
            Inward Batch Summary
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Total Unique Items:</span>
              <span className="font-bold text-slate-900">{totals.totalItems}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Total Quantity Being Added:</span>
              <span className="font-bold text-slate-900">{formatQuantity(totals.totalQty)} Units</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-t border-b border-slate-200">
              <span className="text-sm font-bold text-slate-900">Total Stock Value:</span>
              <span className="text-xl font-black text-emerald-700">
                {formatCurrency(totals.totalValue)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Inward Narration / Reference
            </label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="e.g. Supplier delivery, replenishment batch..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            disabled={loading || stockEntries.length === 0}
            onClick={handleConfirmStockIn}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20 disabled:opacity-40 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating Inventory...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm Stock In & Update Inventory</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Camera Barcode Scanner Modal */}
      <MobileBarcodeScanner
        isOpen={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onScan={handleCameraScan}
      />
    </div>
  );
}
