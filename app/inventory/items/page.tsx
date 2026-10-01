import React from 'react';
import { getAuthContext, hasFeature } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { StockService } from '@/lib/services/stock-service';
import prisma from '@/lib/db';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Package, AlertTriangle, ArrowRight, Layers, Sliders, FolderTree, Scale } from 'lucide-react';
import { ItemActions } from './item-actions';

export default async function ItemsCatalogPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const canInventory = hasFeature(authContext, 'INVENTORY');
  const canItems = hasFeature(authContext, 'ITEMS');
  const userRole = authContext.company.role;
  const canManage = userRole !== 'POS_OPERATOR' && userRole !== 'SALESMAN' && userRole !== 'READ_ONLY';

  const companyId = authContext.company.id;

  // If Stock / Inventory tracking is enabled, get full stock movements & valuation
  let stockSummary: any[] = [];
  let basicItems: any[] = [];

  if (canInventory) {
    stockSummary = await StockService.getStockSummary(companyId);
  } else {
    basicItems = await prisma.item.findMany({
      where: { companyId },
      include: {
        unit: true,
        category: true,
        taxRate: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {canInventory ? 'Inventory & Item Catalog' : 'Item & Product Catalog'}
              </h1>
              {!canInventory && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Item Master Only
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {canInventory
                ? 'Manage product catalog, HSN/SAC, opening stock, valuation, and reorder alerts'
                : 'Manage product pricing, SKU, Barcode, HSN/SAC, and tax rates'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canInventory && (
              <>
                <Link
                  href="/inventory/categories"
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
                >
                  <FolderTree className="h-4 w-4 text-sky-600" /> Categories
                </Link>
                <Link
                  href="/inventory/units"
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
                >
                  <Scale className="h-4 w-4 text-indigo-600" /> Units
                </Link>
              </>
            )}
            <Link
              href="/inventory/items/new"
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Item
            </Link>
          </div>
        </div>

        {/* Mobile View: Item Cards */}
        <div className="md:hidden space-y-3">
          {canInventory ? (
            stockSummary.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-slate-600 text-xs">No Items in Catalog</p>
              </div>
            ) : (
              stockSummary.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{item.name}</h3>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        SKU: {item.sku || '-'} | Cat: {item.category || '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-slate-900">
                        {formatCurrency(item.salesPrice)}
                      </div>
                      <div className="text-[10px] text-slate-400">Sell Price</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">Stock:</span>
                      <span className={`font-black ${item.isLowStock ? 'text-rose-600 flex items-center gap-1' : 'text-slate-900'}`}>
                        {item.isLowStock && <AlertTriangle className="h-3 w-3 text-rose-500" />}
                        {formatQuantity(item.currentStock)} {item.unit}
                      </span>
                    </div>

                    <Link
                      href={`/inventory/stock-ledger?itemId=${item.id}`}
                      className="inline-flex items-center gap-1 text-sky-600 font-bold bg-sky-50 px-2.5 py-1 rounded-lg text-xs hover:bg-sky-100 transition"
                    >
                      Audit Ledger <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))
            )
          ) : (
            basicItems.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-slate-600 text-xs">No Items in Catalog</p>
              </div>
            ) : (
              basicItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{item.name}</h3>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        SKU: {item.sku || '-'} | HSN: {item.hsnSac || '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-slate-900">
                        {formatCurrency(Number(item.salesPrice))}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-700">
                        {item.taxRate ? `${item.taxRate.rate}% GST` : '0%'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {canInventory ? (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Product Name</th>
                    <th className="p-3.5">SKU / Barcode</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 text-right">Purchase Price</th>
                    <th className="p-3.5 text-right">Selling Price</th>
                    <th className="p-3.5 text-right">Current Stock</th>
                    <th className="p-3.5 text-right">Stock Valuation</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockSummary.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold text-slate-600">No Items in Catalog</p>
                      </td>
                    </tr>
                  ) : (
                    stockSummary.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-bold text-slate-900">{item.name}</td>
                        <td className="p-3.5 font-mono text-slate-500">
                          <div>{item.sku || '-'}</div>
                          {item.barcode && <div className="text-[10px] text-slate-400">{item.barcode}</div>}
                        </td>
                        <td className="p-3.5 text-slate-600">{item.category}</td>
                        <td className="p-3.5 text-right">{formatCurrency(item.purchasePrice)}</td>
                        <td className="p-3.5 text-right font-semibold text-slate-900">{formatCurrency(item.salesPrice)}</td>
                        <td className="p-3.5 text-right font-black text-sm">
                          <span className={item.isLowStock ? 'text-rose-600 flex items-center justify-end gap-1' : 'text-slate-900'}>
                            {item.isLowStock && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
                            {formatQuantity(item.currentStock)} {item.unit}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-semibold text-slate-700">
                          {formatCurrency(item.stockValue)}
                        </td>
                        <td className="p-3.5 text-center">
                          {item.isLowStock ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center flex items-center justify-center gap-1.5">
                          <Link
                            href={`/inventory/stock-ledger?itemId=${item.id}`}
                            className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-semibold bg-sky-50 px-2 py-1 rounded text-xs transition"
                          >
                            Ledger
                          </Link>
                          <ItemActions itemId={item.id} itemName={item.name} canManage={canManage} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Product / Service Name</th>
                    <th className="p-3.5">SKU / Barcode</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">HSN / SAC</th>
                    <th className="p-3.5">GST Rate</th>
                    <th className="p-3.5">Unit</th>
                    <th className="p-3.5 text-right">Purchase Rate</th>
                    <th className="p-3.5 text-right">Selling Price</th>
                    <th className="p-3.5 text-center">Item Type</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {basicItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold text-slate-600">No Items in Catalog</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Click &quot;Add Item&quot; to create your first product or service.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    basicItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-bold text-slate-900">{item.name}</td>
                        <td className="p-3.5 font-mono text-slate-500">
                          <div>{item.sku || '-'}</div>
                          {item.barcode && <div className="text-[10px] text-slate-400">{item.barcode}</div>}
                        </td>
                        <td className="p-3.5 text-slate-600">{item.category?.name || '-'}</td>
                        <td className="p-3.5 font-mono text-slate-600">{item.hsnSac || '-'}</td>
                        <td className="p-3.5 font-semibold text-slate-800">
                          {item.taxRate ? `${item.taxRate.rate}% GST` : '-'}
                        </td>
                        <td className="p-3.5 text-slate-600 font-mono">{item.unit?.code || 'PCS'}</td>
                        <td className="p-3.5 text-right">{formatCurrency(Number(item.purchasePrice))}</td>
                        <td className="p-3.5 text-right font-bold text-slate-900">
                          {formatCurrency(Number(item.salesPrice))}
                        </td>
                        <td className="p-3.5 text-center">
                          {item.isService ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                              Service
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              Goods
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <ItemActions itemId={item.id} itemName={item.name} canManage={canManage} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
