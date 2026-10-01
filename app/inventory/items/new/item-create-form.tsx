'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, Plus, X, FolderTree, Scale } from 'lucide-react';

interface ItemFormProps {
  categories: any[];
  units: any[];
  taxRates: any[];
}

export function ItemCreateForm({
  categories: initialCategories,
  units: initialUnits,
  taxRates,
}: ItemFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [units, setUnits] = useState(initialUnits);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    hsnSac: '',
    categoryId: initialCategories[0]?.id || '',
    unitId: initialUnits[0]?.id || '',
    purchasePrice: '0',
    salesPrice: '0',
    mrp: '0',
    taxRateId: taxRates.find((t) => Number(t.rate) === 18)?.id || taxRates[0]?.id || '',
    openingStock: '0',
    minStockLevel: '5',
    reorderLevel: '10',
    isService: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Quick Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catLoading, setCatLoading] = useState(false);

  // Quick Unit Modal State
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [unitLoading, setUnitLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  }

  async function handleQuickAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatLoading(true);

    try {
      const res = await fetch('/api/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category');

      setCategories((prev) => [...prev, data.category]);
      setFormData((prev) => ({ ...prev, categoryId: data.category.id }));
      setNewCatName('');
      setIsCatModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCatLoading(false);
    }
  }

  async function handleQuickAddUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!newUnitCode.trim() || !newUnitName.trim()) return;
    setUnitLoading(true);

    try {
      const res = await fetch('/api/inventory/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newUnitCode.trim().toUpperCase(),
          name: newUnitName.trim(),
          uqcCode: newUnitCode.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create unit');

      setUnits((prev) => [...prev, data.unit]);
      setFormData((prev) => ({ ...prev, unitId: data.unit.id }));
      setNewUnitCode('');
      setNewUnitName('');
      setIsUnitModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUnitLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save item');
      }

      router.push('/inventory/items');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Item / Product Name *
            </label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Dell Latitude 5440 i7 Laptop"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              SKU Code
            </label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              placeholder="HW-DELL-5440"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Barcode / EAN
            </label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
              placeholder="8901234567890"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              HSN / SAC Code
            </label>
            <input
              type="text"
              name="hsnSac"
              value={formData.hsnSac}
              onChange={handleChange}
              placeholder="84713010"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>

          {/* Category with Quick Add */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Category
              </label>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(true)}
                className="text-[11px] text-sky-600 hover:text-sky-800 font-bold inline-flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> New Category
              </button>
            </div>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
            >
              <option value="">-- Uncategorized --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unit with Quick Add */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Unit of Measurement *
              </label>
              <button
                type="button"
                onClick={() => setIsUnitModalOpen(true)}
                className="text-[11px] text-sky-600 hover:text-sky-800 font-bold inline-flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> New Unit
              </button>
            </div>
            <select
              name="unitId"
              value={formData.unitId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Applicable GST Rate *
            </label>
            <select
              name="taxRateId"
              value={formData.taxRateId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
            >
              {taxRates.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name} ({tr.rate}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200">
          <div className="text-xs font-bold text-slate-800 mb-2">Pricing & Opening Stock</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Purchase Price (₹)</label>
              <input
                type="number"
                step="any"
                name="purchasePrice"
                value={formData.purchasePrice}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Selling Price (₹)</label>
              <input
                type="number"
                step="any"
                name="salesPrice"
                value={formData.salesPrice}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-sky-700"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Opening Stock Quantity</label>
              <input
                type="number"
                step="any"
                name="openingStock"
                value={formData.openingStock}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
              />
            </div>
          </div>
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
            <span>{loading ? 'Saving...' : 'Save Product'}</span>
          </button>
        </div>
      </form>

      {/* Quick Add Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FolderTree className="h-4 w-4 text-sky-600" /> Quick Add Category
              </h4>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleQuickAddCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Hardware, Groceries"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={catLoading}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
                >
                  {catLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Unit Modal */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-sky-600" /> Quick Add Unit of Measure
              </h4>
              <button
                type="button"
                onClick={() => setIsUnitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleQuickAddUnit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unit Symbol / Code (e.g. PKT, BOX, LTR) *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PKT"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Unit Name *
                </label>
                <input
                  type="text"
                  required
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="e.g. PACKETS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsUnitModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unitLoading}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
                >
                  {unitLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
