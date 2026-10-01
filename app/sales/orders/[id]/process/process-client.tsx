'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  FileText,
  CheckCircle,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Mic,
  Camera,
  Volume2,
  Loader2,
  Save,
  SplitSquareVertical,
} from 'lucide-react';

export function OrderSplitScreenProcessClient({ orderId }: { orderId: string }) {
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Left Side: Order builder items
  const [items, setItems] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');

  // Right Side: Media Viewer
  const [selectedAttachmentIdx, setSelectedAttachmentIdx] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/orders/${orderId}`).then((r) => r.json()),
      fetch('/api/portal/items').then((r) => r.json()),
    ])
      .then(([orderData, itemsData]) => {
        if (orderData.order) {
          setOrder(orderData.order);
          setOrderNotes(orderData.order.notes || '');

          // Populate existing items or initialize empty
          if (orderData.order.items && orderData.order.items.length > 0) {
            setItems(
              orderData.order.items.map((it: any) => ({
                id: it.id,
                itemId: it.itemId,
                itemName: it.itemName,
                quantity: Number(it.quantity) || 1,
                unitName: it.unitName || 'Units',
                unitRate: Number(it.unitRate) || 0,
                taxRate: Number(it.taxRate) || 0,
                notes: it.notes || '',
                attachmentUrl: it.attachmentUrl || null,
              }))
            );
          }
        }
        if (itemsData.items) {
          setCatalogItems(itemsData.items);
        }
      })
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  // Catalog item selection
  const handleAddItemFromCatalog = (catalogItem: any) => {
    const rate = Number(catalogItem.salesPrice || catalogItem.mrp || 0);
    const taxRate = Number(catalogItem.taxRate?.rate || 0);

    setItems((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        itemId: catalogItem.id,
        itemName: catalogItem.name,
        quantity: 1,
        unitName: catalogItem.unit?.name || 'Units',
        unitRate: rate,
        taxRate: taxRate,
      },
    ]);
    setSearchQuery('');
    setShowCatalogDropdown(false);
  };

  // Add custom manual item
  const handleAddCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        itemId: null,
        itemName: '',
        quantity: 1,
        unitName: 'Units',
        unitRate: 0,
        taxRate: 18,
      },
    ]);
  };

  const updateItemField = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const calculatedItems = items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.unitRate) || 0;
    const taxRate = Number(it.taxRate) || 0;
    const taxable = qty * rate;
    const taxAmount = (taxable * taxRate) / 100;
    const totalAmount = taxable + taxAmount;
    return { ...it, taxable, taxAmount, totalAmount };
  });

  const subTotal = calculatedItems.reduce((acc, it) => acc + it.taxable, 0);
  const taxTotal = calculatedItems.reduce((acc, it) => acc + it.taxAmount, 0);
  const grandTotal = subTotal + taxTotal;

  // Process & Save
  const handleSaveAndProcess = async (createInvoice: boolean = false) => {
    if (items.length === 0) {
      alert('Please add at least one item before saving.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: calculatedItems,
          notes: orderNotes,
          createInvoice,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process order');

      setSuccessMsg(data.message || 'Order updated successfully!');
      if (createInvoice && data.document?.id) {
        setTimeout(() => router.push(`/sales/invoices`), 1500);
      } else {
        setTimeout(() => router.push('/sales/orders'), 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 font-bold">Order not found</p>
        <Link href="/sales/orders" className="text-indigo-600 underline text-sm mt-2 block">
          Back to Orders
        </Link>
      </div>
    );
  }

  const attachments = order.attachments || [];
  const currentAttachment = attachments[selectedAttachmentIdx];

  const filteredCatalog = catalogItems.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 max-w-[100rem] mx-auto pb-10">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/sales/orders"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">
                Split-Screen Order Processor: {order.orderNumber}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700">
                {order.orderType === 'UNORGANIZED' ? 'Photo/Audio Slip' : 'Catalog Order'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Party: <strong className="text-slate-800">{order.party?.name}</strong> • Mobile: {order.party?.mobile || '-'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSaveAndProcess(false)}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Save as In Process
          </button>
          <button
            onClick={() => handleSaveAndProcess(true)}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> Convert & Generate Invoice
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" /> {errorMsg}
        </div>
      )}

      {/* SPLIT SCREEN WORKSPACE: 50% LEFT (ORDER BUILDER) + 50% RIGHT (MEDIA VIEWER) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ================= LEFT SIDE: ORDER BUILDER ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Left Pane: Order Items Builder
            </h2>
            <button
              onClick={handleAddCustomItem}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Custom Line
            </button>
          </div>

          {/* Search catalog to add item */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search catalog items to add (type name / SKU)..."
                value={searchQuery}
                onFocus={() => setShowCatalogDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowCatalogDropdown(true);
                }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Dropdown search results */}
            {showCatalogDropdown && searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {filteredCatalog.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 text-center">No catalog items found</div>
                ) : (
                  filteredCatalog.map((ci) => (
                    <button
                      key={ci.id}
                      onClick={() => handleAddItemFromCatalog(ci)}
                      className="w-full p-2.5 text-left text-xs hover:bg-indigo-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">{ci.name}</span>
                        <span className="text-[10px] text-slate-500">
                          SKU: {ci.sku || 'N/A'} • Unit: {ci.unit?.code || 'PCS'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-indigo-600 block">
                          ₹{Number(ci.salesPrice || ci.mrp || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {Number(ci.taxRate?.rate || 0)}% GST
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            {items.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500">No items added yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Inspect the photo/voice note on the right and add items here.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                    <th className="py-2.5 px-2">Item Description</th>
                    <th className="py-2.5 px-2 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-2 w-24 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-2 w-16 text-center">GST %</th>
                    <th className="py-2.5 px-2 w-24 text-right">Total (₹)</th>
                    <th className="py-2.5 px-1 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculatedItems.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={item.itemName}
                          placeholder="Item name"
                          onChange={(e) => updateItemField(idx, 'itemName', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                        />
                        {(item.attachmentUrl || item.notes) && (
                          <div className="flex items-center gap-2 mt-1.5 bg-indigo-50 border border-indigo-100 rounded-md p-1">
                            {item.attachmentUrl && (
                              <a
                                href={item.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-1.5 py-0.5 rounded border border-indigo-200 shadow-2xs"
                              >
                                <Camera className="w-3 h-3" /> Client Attached Photo
                              </a>
                            )}
                            {item.notes && (
                              <span className="text-[10px] text-indigo-900 font-medium truncate">
                                Note: {item.notes}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitRate}
                          onChange={(e) => updateItemField(idx, 'unitRate', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-right"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={item.taxRate}
                          onChange={(e) => updateItemField(idx, 'taxRate', e.target.value)}
                          className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-center"
                        />
                      </td>
                      <td className="py-2 px-2 text-right font-extrabold text-slate-900">
                        {item.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-2 px-1 text-center">
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Notes & Calculations */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Order Notes / Clarifications
              </label>
              <textarea
                rows={2}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Taxable Amount):</span>
                <span className="font-bold">₹{subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total GST Amount:</span>
                <span className="font-bold">₹{taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="text-indigo-700 font-black">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT SIDE: MEDIA VIEWER (R2) ================= */}
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <SplitSquareVertical className="w-4 h-4" />
              Right Pane: Media Viewer (Photos / Audio Slip)
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {attachments.length} Attachment(s)
            </span>
          </div>

          {/* Attachment Selector Tabs */}
          {attachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {attachments.map((att: any, idx: number) => (
                <button
                  key={att.id || idx}
                  onClick={() => {
                    setSelectedAttachmentIdx(idx);
                    setZoomLevel(1);
                    setRotation(0);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    selectedAttachmentIdx === idx
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {att.fileType === 'AUDIO_RECORDING' ? (
                    <Mic className="w-3.5 h-3.5 text-purple-300" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-indigo-300" />
                  )}
                  {att.fileType === 'AUDIO_RECORDING' ? `Voice Note ${idx + 1}` : `Photo ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Media Display Window */}
          {attachments.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-xl text-slate-500">
              <Camera className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs">No photos or recordings attached to this order</p>
            </div>
          ) : currentAttachment?.fileType === 'AUDIO_RECORDING' ? (
            /* Audio Player with Speed Controls */
            <div className="h-96 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-6">
              <div className="h-20 w-20 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <Volume2 className="w-10 h-10" />
              </div>

              <div className="text-center">
                <h3 className="text-base font-bold text-white">Client Voice Note</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Listen to spoken order items and transcribe into the left pane
                </p>
              </div>

              <audio
                ref={audioRef}
                controls
                src={currentAttachment.fileUrl}
                className="w-full max-w-md"
                onPlay={() => setAudioPlaying(true)}
                onPause={() => setAudioPlaying(false)}
              />

              {/* Speed Controls */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <span>Speed:</span>
                {[0.75, 1, 1.25, 1.5].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => {
                      setPlaybackSpeed(spd);
                      if (audioRef.current) audioRef.current.playbackRate = spd;
                    }}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      playbackSpeed === spd
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Image Viewer with Zoom, Pan, Rotate Controls */
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                    title="Rotate 90deg"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setZoomLevel(1);
                      setRotation(0);
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">
                  Zoom: {Math.round(zoomLevel * 100)}%
                </span>
              </div>

              {/* Zoomable Image Container */}
              <div className="h-[520px] bg-slate-950 rounded-2xl border border-slate-800 overflow-auto flex items-center justify-center p-4 select-none cursor-grab active:cursor-grabbing">
                <img
                  src={currentAttachment?.fileUrl}
                  alt={currentAttachment?.fileName || 'Order slip'}
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: 'transform 0.15s ease-out',
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                  }}
                  className="rounded-lg shadow-2xl"
                />
              </div>
            </div>
          )}

          {/* Client Remarks if present */}
          {order.notes && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
              <span className="font-bold text-purple-400 block mb-1">Customer Note:</span>
              {order.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
