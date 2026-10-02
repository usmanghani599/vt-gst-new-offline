'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatQuantity, formatDate } from '@/lib/utils';
import {
  UserCheck,
  Award,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  Search,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Gift,
  History,
  Phone,
  Mail,
  Percent,
  Coins,
  ShieldAlert,
} from 'lucide-react';

interface PointTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  points: number;
  amount: number;
  notes: string | null;
  createdAt: string;
}

interface Salesman {
  id: string;
  name: string;
  employeeCode: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  commissionRate: number;
  pointsPerAmount: number;
  isActive: boolean;
  totalSales: number;
  totalInvoices: number;
  currentPoints: number;
  transactions: PointTransaction[];
}

interface SalesmenClientProps {
  initialSalesmen: Salesman[];
  canManageSalesmen?: boolean;
}

export function SalesmenClient({ initialSalesmen, canManageSalesmen = true }: SalesmenClientProps) {
  const router = useRouter();
  const [salesmen, setSalesmen] = useState<Salesman[]>(initialSalesmen);
  const [search, setSearch] = useState('');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSalesman, setEditingSalesman] = useState<Salesman | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    employeeCode: '',
    mobile: '',
    email: '',
    address: '',
    commissionRate: '5.0',
    pointsPerAmount: '1.0',
  });

  // Points Modal State
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  const [selectedSalesman, setSelectedSalesman] = useState<Salesman | null>(null);
  const [pointsActionType, setPointsActionType] = useState<'CREDIT' | 'DEBIT'>('DEBIT');
  const [pointsAmount, setPointsAmount] = useState('100');
  const [pointsNotes, setPointsNotes] = useState('');

  // History Modal State
  const [historySalesman, setHistorySalesman] = useState<Salesman | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filtered = salesmen.filter((sm) =>
    sm.name.toLowerCase().includes(search.toLowerCase()) ||
    (sm.employeeCode && sm.employeeCode.toLowerCase().includes(search.toLowerCase())) ||
    (sm.mobile && sm.mobile.includes(search)) ||
    (sm.email && sm.email.toLowerCase().includes(search.toLowerCase()))
  );

  // Overall totals
  const totalSalesOverall = salesmen.reduce((acc, sm) => acc + sm.totalSales, 0);
  const totalPointsOverall = salesmen.reduce((acc, sm) => acc + sm.currentPoints, 0);

  function openCreateModal() {
    setEditingSalesman(null);
    setFormData({
      name: '',
      employeeCode: `SM-00${salesmen.length + 1}`,
      mobile: '',
      email: '',
      address: '',
      commissionRate: '5.0',
      pointsPerAmount: '1.0',
    });
    setErrorMsg('');
    setSuccessMsg('');
    setIsFormOpen(true);
  }

  function openEditModal(sm: Salesman) {
    setEditingSalesman(sm);
    setFormData({
      name: sm.name,
      employeeCode: sm.employeeCode || '',
      mobile: sm.mobile || '',
      email: sm.email || '',
      address: sm.address || '',
      commissionRate: String(sm.commissionRate),
      pointsPerAmount: String(sm.pointsPerAmount),
    });
    setErrorMsg('');
    setSuccessMsg('');
    setIsFormOpen(true);
  }

  function openPointsModal(sm: Salesman, type: 'CREDIT' | 'DEBIT') {
    setSelectedSalesman(sm);
    setPointsActionType(type);
    setPointsAmount(type === 'DEBIT' ? String(Math.min(100, sm.currentPoints)) : '100');
    setPointsNotes(type === 'DEBIT' ? 'Incentive payout / voucher redemption' : 'Quarterly performance bonus');
    setErrorMsg('');
    setSuccessMsg('');
    setIsPointsModalOpen(true);
  }

  async function handleSaveSalesman(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const url = '/api/salesmen';
      const method = editingSalesman ? 'PUT' : 'POST';
      const payload = editingSalesman
        ? { id: editingSalesman.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save salesman');

      if (editingSalesman) {
        setSalesmen((prev) =>
          prev.map((sm) =>
            sm.id === editingSalesman.id
              ? {
                  ...sm,
                  name: data.salesman.name,
                  employeeCode: data.salesman.employeeCode,
                  mobile: data.salesman.mobile,
                  email: data.salesman.email,
                  address: data.salesman.address,
                  commissionRate: Number(data.salesman.commissionRate),
                  pointsPerAmount: Number(data.salesman.pointsPerAmount),
                }
              : sm
          )
        );
        setSuccessMsg('Salesman updated successfully!');
      } else {
        setSalesmen((prev) => [
          ...prev,
          {
            id: data.salesman.id,
            name: data.salesman.name,
            employeeCode: data.salesman.employeeCode,
            mobile: data.salesman.mobile,
            email: data.salesman.email,
            address: data.salesman.address,
            commissionRate: Number(data.salesman.commissionRate),
            pointsPerAmount: Number(data.salesman.pointsPerAmount),
            isActive: true,
            totalSales: 0,
            totalInvoices: 0,
            currentPoints: 0,
            transactions: [],
          },
        ]);
        setSuccessMsg('Salesman created successfully!');
      }

      setTimeout(() => {
        setIsFormOpen(false);
        router.refresh();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProcessPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSalesman) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/salesmen/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesmanId: selectedSalesman.id,
          type: pointsActionType,
          points: pointsAmount,
          notes: pointsNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process points');

      const pts = Number(pointsAmount);
      const delta = pointsActionType === 'CREDIT' ? pts : -pts;

      setSalesmen((prev) =>
        prev.map((sm) => {
          if (sm.id === selectedSalesman.id) {
            return {
              ...sm,
              currentPoints: sm.currentPoints + delta,
              transactions: [
                {
                  id: data.transaction.id,
                  type: pointsActionType,
                  points: pts,
                  amount: 0,
                  notes: pointsNotes,
                  createdAt: new Date().toISOString(),
                },
                ...sm.transactions,
              ],
            };
          }
          return sm;
        })
      );

      setSuccessMsg(
        pointsActionType === 'DEBIT'
          ? `Successfully redeemed ${pts} points!`
          : `Successfully awarded ${pts} bonus points!`
      );

      setTimeout(() => {
        setIsPointsModalOpen(false);
        router.refresh();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSalesman(id: string) {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/salesmen?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete salesman');

      setSalesmen((prev) => prev.filter((sm) => sm.id !== id));
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-sky-600" /> Salesmen & Incentive Points
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
              {salesmen.length} Sales Representatives
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage sales team commissions, performance tracking, POS cashier attribution, and reward point balances
          </p>
        </div>

        {canManageSalesmen && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add Salesperson
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Sales Team</span>
            <UserCheck className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{salesmen.length} Representatives</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Assigned to POS & Billing</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Team Sales Turnover</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{formatCurrency(totalSalesOverall)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total attributed revenue</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Available Reward Points</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{formatQuantity(totalPointsOverall)} Pts</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total active points ledger</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Default Reward Rate</span>
            <Coins className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-700">1.0% Points</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Accrued automatically per sale</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by salesperson name, employee code, phone, or email..."
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

      {/* Salesmen Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="h-16 w-16 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto">
            <UserCheck className="h-8 w-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">No Sales Representatives Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              {search
                ? 'No staff members match your search criteria.'
                : 'Add your store sales representatives and cashiers to track performance, attribute POS sales, and award incentive reward points.'}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={openCreateModal}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add First Salesperson
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((sm) => (
            <div
              key={sm.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-sky-300 transition flex flex-col justify-between"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-slate-900">{sm.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {sm.employeeCode || 'SM-00'}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Active
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
                    <UserCheck className="h-5 w-5" />
                  </div>
                </div>

                {/* Contact details */}
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  {sm.mobile && (
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{sm.mobile}</span>
                    </div>
                  )}
                  {sm.email && (
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate">{sm.email}</span>
                    </div>
                  )}
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 mt-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Sales Generated
                    </div>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      {formatCurrency(sm.totalSales)}
                    </div>
                    <div className="text-[10px] text-slate-500">{sm.totalInvoices} Invoices Attributed</div>
                  </div>

                  <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100">
                    <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Award className="h-3.5 w-3.5 text-amber-500" /> Incentive Points
                    </div>
                    <div className="text-base font-black text-amber-800 mt-0.5">
                      {formatQuantity(sm.currentPoints)}
                    </div>
                    <div className="text-[10px] text-amber-600">{sm.pointsPerAmount}% Points Per Sale</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
                  <span>Commission Rate: <strong>{sm.commissionRate}%</strong></span>
                  <span>Point History: <strong>{sm.transactions.length} Logs</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              {canManageSalesmen ? (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openPointsModal(sm, 'DEBIT')}
                      disabled={sm.currentPoints <= 0}
                      className="w-full py-1.5 px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs disabled:opacity-40 disabled:hover:bg-amber-500"
                    >
                      <Gift className="h-3.5 w-3.5" /> Redeem Points
                    </button>

                    <button
                      type="button"
                      onClick={() => openPointsModal(sm, 'CREDIT')}
                      className="w-full py-1.5 px-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Bonus Points
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setHistorySalesman(sm)}
                      className="text-xs font-semibold text-slate-600 hover:text-sky-600 flex items-center gap-1 transition"
                    >
                      <History className="h-3.5 w-3.5" /> Points History ({sm.transactions.length})
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(sm)}
                        className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 transition"
                        title="Edit Salesperson"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      {deleteConfirmId === sm.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteSalesman(sm.id)}
                            disabled={loading}
                            className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(sm.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition"
                          title="Delete Salesperson"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setHistorySalesman(sm)}
                    className="w-full py-2 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <History className="h-4 w-4" /> View My Points History ({sm.transactions.length} entries)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Salesman Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-sky-600" />
                {editingSalesman ? `Edit Salesperson: ${editingSalesman.name}` : 'Add Sales Representative'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
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

            <form onSubmit={handleSaveSalesman} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Employee Code
                  </label>
                  <input
                    type="text"
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                    placeholder="e.g. SM-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="e.g. 9820098200"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="rahul@company.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Incentive Points Rate (% per Sale)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.pointsPerAmount}
                    onChange={(e) => setFormData({ ...formData, pointsPerAmount: e.target.value })}
                    placeholder="1.0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="text-[10px] text-slate-400">1% = 100 points on ₹10,000 sale</span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Commission Rate (% on Sales)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.commissionRate}
                    onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                    placeholder="5.0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="text-[10px] text-slate-400">Target commission percentage</span>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Territory / Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. Retail Counter 1, South Mumbai Territory"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg shadow-sm transition inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{editingSalesman ? 'Update Salesperson' : 'Create Salesperson'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Points Redeem / Award Modal */}
      {isPointsModalOpen && selectedSalesman && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                {pointsActionType === 'DEBIT' ? 'Redeem Incentive Points' : 'Award Bonus Points'}
              </h3>
              <button
                type="button"
                onClick={() => setIsPointsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border text-xs space-y-1">
              <div className="font-bold text-slate-900">{selectedSalesman.name}</div>
              <div className="text-slate-500">
                Available Points: <strong className="text-amber-700 font-black">{formatQuantity(selectedSalesman.currentPoints)} Pts</strong>
              </div>
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

            <form onSubmit={handleProcessPoints} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {pointsActionType === 'DEBIT' ? 'Points to Redeem *' : 'Bonus Points to Credit *'}
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max={pointsActionType === 'DEBIT' ? selectedSalesman.currentPoints : undefined}
                  required
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-lg font-black text-amber-600 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason / Narration (Optional)
                </label>
                <input
                  type="text"
                  value={pointsNotes}
                  onChange={(e) => setPointsNotes(e.target.value)}
                  placeholder="e.g. Voucher redemption, Cash incentive payout"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsPointsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-5 py-2 font-bold rounded-lg shadow-sm text-white transition inline-flex items-center gap-2 ${
                    pointsActionType === 'DEBIT'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{pointsActionType === 'DEBIT' ? 'Confirm Redemption' : 'Credit Bonus'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Points History Ledger Modal */}
      {historySalesman && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="h-5 w-5 text-sky-600" />
                  Points Ledger for {historySalesman.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Code: {historySalesman.employeeCode || '-'} • Balance: <strong>{formatQuantity(historySalesman.currentPoints)} Points</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistorySalesman(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5 text-right">Points</th>
                    <th className="p-2.5">Narration / Event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historySalesman.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        No points accrued or redeemed yet for this salesperson.
                      </td>
                    </tr>
                  ) : (
                    historySalesman.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-[11px] text-slate-600">
                          {formatDate(tx.createdAt)}
                        </td>
                        <td className="p-2.5">
                          {tx.type === 'CREDIT' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              + EARNED (CR)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              - REDEEMED (DR)
                            </span>
                          )}
                        </td>
                        <td
                          className={`p-2.5 text-right font-black ${
                            tx.type === 'CREDIT' ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {tx.type === 'CREDIT' ? `+${tx.points}` : `-${tx.points}`}
                        </td>
                        <td className="p-2.5 text-slate-700">{tx.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setHistorySalesman(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
