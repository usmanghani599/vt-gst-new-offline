'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Package,
  Search,
  Download,
  Printer,
  History,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  TrendingUp,
  Boxes,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/utils';

interface StockItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string;
  unit: string;
  openingStock: number;
  currentStock: number;
  purchasePrice: number;
  salesPrice: number;
  stockValue: number;
  minStockLevel: number;
  isLowStock: boolean;
}

interface StockReportClientProps {
  stockItems: StockItem[];
  categories: any[];
  companyName: string;
}

export function StockReportClient({
  stockItems,
  categories,
  companyName,
}: StockReportClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL'); // ALL, IN_STOCK, LOW_STOCK, OUT_OF_STOCK
  const [sortField, setSortField] = useState<'name' | 'stock' | 'value'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Filter items
  const filteredItems = useMemo(() => {
    return stockItems
      .filter((item) => {
        const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
        const matchesSearch =
          !searchQuery ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.barcode && item.barcode.includes(searchQuery));

        let matchesStatus = true;
        if (stockStatusFilter === 'LOW_STOCK') {
          matchesStatus = item.isLowStock && item.currentStock > 0;
        } else if (stockStatusFilter === 'OUT_OF_STOCK') {
          matchesStatus = item.currentStock <= 0;
        } else if (stockStatusFilter === 'IN_STOCK') {
          matchesStatus = item.currentStock > 0 && !item.isLowStock;
        }

        return matchesCat && matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'name') cmp = a.name.localeCompare(b.name);
        else if (sortField === 'stock') cmp = a.currentStock - b.currentStock;
        else if (sortField === 'value') cmp = a.stockValue - b.stockValue;
        return sortAsc ? cmp : -cmp;
      });
  }, [stockItems, selectedCategory, searchQuery, stockStatusFilter, sortField, sortAsc]);

  // Overall KPI Summary
  const stats = useMemo(() => {
    const totalItems = stockItems.length;
    const totalStockQty = stockItems.reduce((sum, it) => sum + it.currentStock, 0);
    const totalPurchaseValuation = stockItems.reduce((sum, it) => sum + it.currentStock * it.purchasePrice, 0);
    const totalRetailValuation = stockItems.reduce((sum, it) => sum + it.currentStock * it.salesPrice, 0);
    const lowStockCount = stockItems.filter((it) => it.isLowStock && it.currentStock > 0).length;
    const outOfStockCount = stockItems.filter((it) => it.currentStock <= 0).length;

    return {
      totalItems,
      totalStockQty,
      totalPurchaseValuation,
      totalRetailValuation,
      lowStockCount,
      outOfStockCount,
    };
  }, [stockItems]);

  function handleExportCSV() {
    const headers = ['Product Name', 'SKU', 'Barcode', 'Category', 'Unit', 'Opening Stock', 'Current Stock', 'Purchase Price (Rs)', 'Stock Valuation (Rs)', 'Sales Price (Rs)', 'Retail Valuation (Rs)', 'Status'];
    const rows = filteredItems.map((it) => [
      `"${it.name.replace(/"/g, '""')}"`,
      `"${it.sku || ''}"`,
      `"${it.barcode || ''}"`,
      `"${it.category}"`,
      `"${it.unit}"`,
      it.openingStock,
      it.currentStock,
      it.purchasePrice,
      (it.currentStock * it.purchasePrice).toFixed(2),
      it.salesPrice,
      (it.currentStock * it.salesPrice).toFixed(2),
      it.currentStock <= 0 ? 'Out of Stock' : it.isLowStock ? 'Low Stock' : 'In Stock',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Report_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="h-7 w-7 text-sky-600" /> Stock Summary & Valuation Report
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200">
              {companyName}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time inventory levels, stock audit valuation (cost & retail), reorder alerts, and ledger history
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV / Excel</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500">Catalog Items</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalItems}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active Products</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500">Total Stock Qty</span>
          <div className="text-2xl font-black text-sky-700 mt-1">{formatQuantity(stats.totalStockQty)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Physical Units</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700">Purchase Valuation</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">
            {formatCurrency(stats.totalPurchaseValuation)}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">At Cost Price</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/20 shadow-xs">
          <span className="text-[11px] font-bold text-indigo-700">Retail / Sale Value</span>
          <div className="text-2xl font-black text-indigo-900 mt-1">
            {formatCurrency(stats.totalRetailValuation)}
          </div>
          <div className="text-[10px] text-indigo-600 font-medium mt-0.5">At MRP / Sales Price</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700">Low Stock Alert</span>
          <div className="text-2xl font-black text-amber-900 mt-1">{stats.lowStockCount}</div>
          <div className="text-[10px] text-amber-600 font-medium mt-0.5">Below Min Level</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-xs">
          <span className="text-[11px] font-bold text-rose-700">Out of Stock</span>
          <div className="text-2xl font-black text-rose-900 mt-1">{stats.outOfStockCount}</div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">Zero Quantity</div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category & Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Pills */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'ALL', label: 'All Items' },
              { id: 'IN_STOCK', label: 'In Stock' },
              { id: 'LOW_STOCK', label: 'Low Stock' },
              { id: 'OUT_OF_STOCK', label: 'Out of Stock' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setStockStatusFilter(p.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  stockStatusFilter === p.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product name, SKU, barcode..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">
                <button
                  type="button"
                  onClick={() => {
                    if (sortField === 'name') setSortAsc(!sortAsc);
                    else {
                      setSortField('name');
                      setSortAsc(true);
                    }
                  }}
                  className="flex items-center gap-1 hover:text-sky-600"
                >
                  <span>Product / Barcode</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5 text-center">Unit</th>
              <th className="p-3.5 text-right">Opening</th>
              <th className="p-3.5 text-right">
                <button
                  type="button"
                  onClick={() => {
                    if (sortField === 'stock') setSortAsc(!sortAsc);
                    else {
                      setSortField('stock');
                      setSortAsc(false);
                    }
                  }}
                  className="flex items-center gap-1 justify-end w-full hover:text-sky-600"
                >
                  <span>Current Stock</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-3.5 text-center">Status</th>
              <th className="p-3.5 text-right">Purchase Price</th>
              <th className="p-3.5 text-right">
                <button
                  type="button"
                  onClick={() => {
                    if (sortField === 'value') setSortAsc(!sortAsc);
                    else {
                      setSortField('value');
                      setSortAsc(false);
                    }
                  }}
                  className="flex items-center gap-1 justify-end w-full hover:text-sky-600"
                >
                  <span>Stock Valuation (₹)</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-3.5 text-right">Retail MRP</th>
              <th className="p-3.5 text-right">Stock Ledger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="font-bold text-slate-600">No products match filters</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Modify search keyword or reset category / stock level filters.
                  </p>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const stockVal = item.currentStock * item.purchasePrice;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    {/* Name & SKU */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        SKU: {item.sku || '-'} | Barcode: {item.barcode || '-'}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="p-3.5 text-slate-600 font-medium">{item.category}</td>

                    {/* Unit */}
                    <td className="p-3.5 text-center text-slate-600 font-mono">{item.unit}</td>

                    {/* Opening Stock */}
                    <td className="p-3.5 text-right font-medium text-slate-500">
                      {formatQuantity(item.openingStock)}
                    </td>

                    {/* Current Available Stock */}
                    <td className="p-3.5 text-right">
                      <span className="text-sm font-black text-slate-900">
                        {formatQuantity(item.currentStock)}
                      </span>
                    </td>

                    {/* Stock Status Badge */}
                    <td className="p-3.5 text-center">
                      {item.currentStock <= 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                          <XCircle className="h-3 w-3 text-rose-600" /> Out of Stock
                        </span>
                      ) : item.isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                          <AlertTriangle className="h-3 w-3 text-amber-600" /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> In Stock
                        </span>
                      )}
                    </td>

                    {/* Purchase Price */}
                    <td className="p-3.5 text-right font-medium text-slate-700">
                      {formatCurrency(item.purchasePrice)}
                    </td>

                    {/* Total Stock Valuation */}
                    <td className="p-3.5 text-right font-black text-emerald-800 text-xs">
                      {formatCurrency(stockVal)}
                    </td>

                    {/* Selling Price */}
                    <td className="p-3.5 text-right font-medium text-slate-700">
                      {formatCurrency(item.salesPrice)}
                    </td>

                    {/* Action: Stock Ledger */}
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/inventory/stock-ledger?itemId=${item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[11px] font-bold transition"
                      >
                        <History className="h-3 w-3" />
                        <span>Audit Ledger</span>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
