'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Camera,
  Mic,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  ExternalLink,
  Copy,
  Check,
  SplitSquareVertical,
  ChevronRight,
  Filter,
  User,
  Share2,
  FileText,
  TrendingUp,
} from 'lucide-react';

export function TenantOrdersClient({ companyId }: { companyId: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    all: 0,
    placed: 0,
    pending: 0,
    inProcess: 0,
    completed: 0,
    cancelled: 0,
  });
  const [activeStatus, setActiveStatus] = useState<string>('');
  const [activeType, setActiveType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    let url = `/api/orders?`;
    if (activeStatus) url += `status=${activeStatus}&`;
    if (activeType) url += `orderType=${activeType}&`;
    if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders || []);
        if (data.metrics) setMetrics(data.metrics);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [activeStatus, activeType, searchQuery]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchOrders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyPortalLink = () => {
    if (!companyId) return;
    const url = `${window.location.origin}/portal/${companyId}/login`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const statusBadges: any = {
    PLACED: { label: 'Placed', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    PENDING: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    IN_PROCESS: { label: 'In Process', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    COMPLETED: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Client Orders Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage incoming catalog orders and convert handwritten slips / voice notes
          </p>
        </div>

        {/* Shareable Portal Link Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={copyPortalLink}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs transition-all shadow-sm cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" /> Copied Portal Link!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-indigo-600" /> Copy Client Portal Link
              </>
            )}
          </button>
        </div>
      </div>

      {/* METRIC STAT CARDS WITH NUMBERS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Placed */}
        <button
          onClick={() => setActiveStatus(activeStatus === 'PLACED' ? '' : 'PLACED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatus === 'PLACED'
              ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20'
              : 'bg-white border-slate-200 hover:border-blue-400 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-80">
            <span>Placed (New)</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black mt-2">{metrics.placed}</div>
        </button>

        {/* Pending */}
        <button
          onClick={() => setActiveStatus(activeStatus === 'PENDING' ? '' : 'PENDING')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatus === 'PENDING'
              ? 'bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-600/20'
              : 'bg-white border-slate-200 hover:border-amber-400 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-80">
            <span>Pending Review</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black mt-2">{metrics.pending}</div>
        </button>

        {/* In Process */}
        <button
          onClick={() => setActiveStatus(activeStatus === 'IN_PROCESS' ? '' : 'IN_PROCESS')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatus === 'IN_PROCESS'
              ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-600/20'
              : 'bg-white border-slate-200 hover:border-purple-400 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-80">
            <span>In Process</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black mt-2">{metrics.inProcess}</div>
        </button>

        {/* Completed */}
        <button
          onClick={() => setActiveStatus(activeStatus === 'COMPLETED' ? '' : 'COMPLETED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatus === 'COMPLETED'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20'
              : 'bg-white border-slate-200 hover:border-emerald-400 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-80">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black mt-2">{metrics.completed}</div>
        </button>

        {/* Cancelled */}
        <button
          onClick={() => setActiveStatus(activeStatus === 'CANCELLED' ? '' : 'CANCELLED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeStatus === 'CANCELLED'
              ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-600/20'
              : 'bg-white border-slate-200 hover:border-rose-400 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-80">
            <span>Cancelled</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black mt-2">{metrics.cancelled}</div>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Order #, Client Name, Mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Order Type Filter */}
          <select
            value={activeType}
            onChange={(e) => setActiveType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Types (Organized & Unorganized)</option>
            <option value="ORGANIZED">Organized (Catalog Items)</option>
            <option value="UNORGANIZED">Unorganized (Photo/Audio Slip)</option>
          </select>

          {/* Reset Filters */}
          {(activeStatus || activeType || searchQuery) && (
            <button
              onClick={() => {
                setActiveStatus('');
                setActiveType('');
                setSearchQuery('');
              }}
              className="text-xs text-rose-600 hover:underline px-2 font-semibold cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-slate-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">No client orders found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Share the client portal link with your parties to start receiving orders.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Order # & Date</th>
                  <th className="py-3 px-4">Party / Client</th>
                  <th className="py-3 px-4">Type & Content</th>
                  <th className="py-3 px-4 text-right">Order Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {orders.map((order) => {
                  const badge = statusBadges[order.status] || statusBadges.PLACED;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-indigo-700 block text-sm">
                          {order.orderNumber}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{order.party?.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {order.party?.mobile || order.clientUser?.mobile || '-'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                              order.orderType === 'UNORGANIZED'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {order.orderType === 'UNORGANIZED' ? (
                              <>
                                <Camera className="w-3 h-3 text-purple-600" />
                                {order.attachments?.length || 0} Slip/Audio Files
                              </>
                            ) : (
                              <>
                                <Package className="w-3 h-3 text-slate-600" />
                                {order.items?.length || 0} Catalog Items
                              </>
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-slate-900 text-sm block">
                          {order.grandTotal > 0
                            ? `₹${Number(order.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : 'Pending Pricing'}
                        </span>
                        {order.document && (
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            Inv: {order.document.documentNumber}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none ${badge.color}`}
                        >
                          <option value="PLACED">Placed</option>
                          <option value="PENDING">Pending</option>
                          <option value="IN_PROCESS">In Process</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/sales/orders/${order.id}/process`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
                            title="Open Split-Screen Order Processor"
                          >
                            <SplitSquareVertical className="w-3.5 h-3.5" />
                            {order.orderType === 'UNORGANIZED' ? 'Split-Screen Process' : 'Review & Invoice'}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
