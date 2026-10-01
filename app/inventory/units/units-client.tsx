'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Scale,
  Plus,
  Edit2,
  Trash2,
  Search,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building,
} from 'lucide-react';
import Link from 'next/link';

interface Unit {
  id: string;
  code: string;
  name: string;
  uqcCode: string | null;
  isSystem: boolean;
  isActive: boolean;
  companyId: string | null;
  _count?: {
    items: number;
  };
}

interface UnitsClientProps {
  initialUnits: Unit[];
}

const COMMON_GST_UQCS = [
  { code: 'BAG', name: 'BAGS' },
  { code: 'BAL', name: 'BALE' },
  { code: 'BDL', name: 'BUNDLES' },
  { code: 'BKL', name: 'BUCKLES' },
  { code: 'BOU', name: 'BILLIONS OF UNITS' },
  { code: 'BOX', name: 'BOX' },
  { code: 'BTL', name: 'BOTTLES' },
  { code: 'BUN', name: 'BUNCHES' },
  { code: 'CAN', name: 'CANS' },
  { code: 'CBM', name: 'CUBIC METERS' },
  { code: 'CCM', name: 'CUBIC CENTIMETERS' },
  { code: 'CMS', name: 'CENTIMETERS' },
  { code: 'CTN', name: 'CARTONS' },
  { code: 'DOZ', name: 'DOZENS' },
  { code: 'DRM', name: 'DRUMS' },
  { code: 'GGK', name: 'GREAT GROSS' },
  { code: 'GMS', name: 'GRAMS' },
  { code: 'GRS', name: 'GROSS' },
  { code: 'GYD', name: 'GROSS YARDS' },
  { code: 'KGS', name: 'KILOGRAMS' },
  { code: 'KLR', name: 'KILOLITRES' },
  { code: 'KME', name: 'KILOMETRES' },
  { code: 'LTR', name: 'LITRES' },
  { code: 'MLT', name: 'MILLILITRES' },
  { code: 'MTR', name: 'METRES' },
  { code: 'MTS', name: 'METRIC TON' },
  { code: 'NOS', name: 'NUMBERS' },
  { code: 'PAC', name: 'PACKS' },
  { code: 'PCS', name: 'PIECES' },
  { code: 'PRS', name: 'PAIRS' },
  { code: 'QTL', name: 'QUINTAL' },
  { code: 'ROL', name: 'ROLLS' },
  { code: 'SET', name: 'SETS' },
  { code: 'SQF', name: 'SQUARE FEET' },
  { code: 'SQM', name: 'SQUARE METRES' },
  { code: 'SQY', name: 'SQUARE YARDS' },
  { code: 'TBS', name: 'TABLETS' },
  { code: 'TGM', name: 'TEN GRAMS' },
  { code: 'THD', name: 'THOUSANDS' },
  { code: 'TON', name: 'TONNES' },
  { code: 'TUB', name: 'TUBES' },
  { code: 'UGS', name: 'US GALLONS' },
  { code: 'UNT', name: 'UNITS' },
  { code: 'YDS', name: 'YARDS' },
  { code: 'OTH', name: 'OTHERS' },
];

export function UnitsClient({ initialUnits }: UnitsClientProps) {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    uqcCode: 'PCS',
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filtered = units.filter((u) =>
    u.code.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.uqcCode && u.uqcCode.toLowerCase().includes(search.toLowerCase()))
  );

  function openCreateModal() {
    setEditingUnit(null);
    setFormData({ code: '', name: '', uqcCode: 'PCS' });
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  }

  function openEditModal(unit: Unit) {
    setEditingUnit(unit);
    setFormData({
      code: unit.code,
      name: unit.name,
      uqcCode: unit.uqcCode || unit.code,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  }

  function handleUqcSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = COMMON_GST_UQCS.find((u) => u.code === e.target.value);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        uqcCode: selected.code,
        name: prev.name || selected.name,
        code: prev.code || selected.code,
      }));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const url = '/api/inventory/units';
      const method = editingUnit ? 'PUT' : 'POST';
      const payload = editingUnit
        ? { id: editingUnit.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save unit');
      }

      if (editingUnit) {
        setUnits((prev) =>
          prev.map((u) =>
            u.id === editingUnit.id ? { ...u, ...data.unit } : u
          )
        );
        setSuccessMsg('Unit updated successfully!');
      } else {
        setUnits((prev) => [...prev, { ...data.unit, _count: { items: 0 } }]);
        setSuccessMsg('Unit created successfully!');
      }

      setTimeout(() => {
        setIsModalOpen(false);
        router.refresh();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/inventory/units?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete unit');
      }

      setUnits((prev) => prev.filter((u) => u.id !== id));
      setDeleteConfirmId(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Scale className="h-6 w-6 text-sky-600" /> Units of Measurement (UOM)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
              {units.length} Units
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure Standard GST Unique Quantity Codes (UQC) and custom measurement units for products and billing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/inventory/items"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            ← Item Catalog
          </Link>
          <Link
            href="/inventory/categories"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            Categories
          </Link>
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Custom Unit
          </button>
        </div>
      </div>

      {errorMsg && !isModalOpen && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search units by symbol (e.g. PCS, KGS), name, or GST UQC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs outline-none bg-transparent"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Units Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">Unit Symbol</th>
              <th className="p-3.5">Full Name</th>
              <th className="p-3.5">GST UQC Code</th>
              <th className="p-3.5 text-center">Type</th>
              <th className="p-3.5 text-center">Items Using</th>
              <th className="p-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  <Scale className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-slate-600">No Units Found</p>
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5 font-mono font-bold text-slate-900 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold">
                      {u.code}
                    </span>
                  </td>
                  <td className="p-3.5 font-semibold text-slate-800">{u.name}</td>
                  <td className="p-3.5 font-mono text-sky-700 font-bold">
                    {u.uqcCode || u.code}
                  </td>
                  <td className="p-3.5 text-center">
                    {u.isSystem ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <ShieldCheck className="h-3 w-3" /> System Standard
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Building className="h-3 w-3" /> Company Custom
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-center font-semibold text-slate-700">
                    {u._count?.items || 0} Products
                  </td>
                  <td className="p-3.5 text-center">
                    {u.isSystem ? (
                      <span className="text-[11px] text-slate-400 italic">Standard</span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          title="Edit Unit"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {deleteConfirmId === u.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(u.id)}
                              disabled={loading}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold transition"
                            >
                              {loading ? '...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(u.id)}
                            title="Delete Unit"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Scale className="h-5 w-5 text-sky-600" />
                {editingUnit ? 'Edit Custom Unit' : 'Create Custom Unit'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {!editingUnit && (
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    GST UQC Standard Preset (Quick Select)
                  </label>
                  <select
                    onChange={handleUqcSelect}
                    value={formData.uqcCode}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-sky-500 bg-slate-50"
                  >
                    {COMMON_GST_UQCS.map((uqc) => (
                      <option key={uqc.code} value={uqc.code}>
                        {uqc.code} - {uqc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Unit Symbol / Code *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingUnit)}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. PCS, KGS, BOX, NOS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-sky-500 uppercase disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Unit Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. PIECES, KILOGRAMS, PACKETS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  GST Unique Quantity Code (UQC)
                </label>
                <input
                  type="text"
                  value={formData.uqcCode}
                  onChange={(e) => setFormData({ ...formData, uqcCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. PCS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-sky-500 uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{editingUnit ? 'Update Unit' : 'Create Unit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
