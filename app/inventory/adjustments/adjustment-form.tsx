'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export function AdjustmentForm({ items }: { items: any[] }) {
  const router = useRouter();
  const [itemId, setItemId] = useState(items[0]?.id || '');
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedItem = items.find((i) => i.id === itemId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          adjustmentType,
          quantity,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust stock');

      router.push(`/inventory/stock-ledger?itemId=${itemId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          Select Product *
        </label>
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-sky-500"
        >
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name} (SKU: {it.sku || '-'})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          Adjustment Direction *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAdjustmentType('IN')}
            className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${
              adjustmentType === 'IN'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            <span>Increase Stock (Inward)</span>
          </button>

          <button
            type="button"
            onClick={() => setAdjustmentType('OUT')}
            className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${
              adjustmentType === 'OUT'
                ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/20'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ArrowDownLeft className="h-4 w-4 text-rose-600" />
            <span>Reduce Stock (Outward / Damage)</span>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          Adjustment Quantity ({selectedItem?.unit?.code || 'Units'}) *
        </label>
        <input
          type="number"
          min="0.0001"
          step="any"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          Reason / Narration *
        </label>
        <textarea
          rows={2}
          required
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Physical stock audit reconciliation, water damage, scrap"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-5 rounded-lg text-xs transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{loading ? 'Recording...' : 'Record Adjustment'}</span>
        </button>
      </div>
    </form>
  );
}
