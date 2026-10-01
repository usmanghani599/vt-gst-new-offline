'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, Truck, UserCheck, X, Award } from 'lucide-react';
import { TaxCalculationService } from '@/lib/services/tax-service';
import { formatCurrency } from '@/lib/utils';
import { numberToWordsINR } from '@/lib/amount-in-words';
import Decimal from 'decimal.js';

interface InvoiceFormProps {
  company: any;
  parties: any[];
  items: any[];
  salesmen: any[];
  states: any[];
  bankAccounts: any[];
  documentType?: string;
  defaultPartyId?: string;
  initialValues?: any;
}

export function InvoiceForm({
  company,
  parties,
  items,
  salesmen,
  states,
  bankAccounts,
  documentType = 'SALE',
  defaultPartyId = '',
}: InvoiceFormProps) {
  const router = useRouter();

  const [partiesList, setPartiesList] = useState<any[]>(parties);
  const [partyId, setPartyId] = useState(defaultPartyId || (parties[0]?.id || ''));
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [taxMode, setTaxMode] = useState(company.defaultTaxMode || 'TAX_EXCLUSIVE');
  const [placeOfSupplyStateId, setPlaceOfSupplyStateId] = useState(company.stateId || '');
  const [salesmanId, setSalesmanId] = useState('');
  const [reverseCharge, setReverseCharge] = useState(false);
  const [notes, setNotes] = useState('');
  const [freightCharges, setFreightCharges] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || '');

  // Quick Customer Creation
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [customerModalError, setCustomerModalError] = useState('');
  const [customerCreating, setCustomerCreating] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    mobile: '',
    email: '',
    gstin: '',
    billingAddress: '',
  });

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) {
      setCustomerModalError('Customer Name is required');
      return;
    }
    if (!newCustomerForm.mobile.trim() || newCustomerForm.mobile.trim().length < 7) {
      setCustomerModalError('A valid Mobile Number is required for customer billing and loyalty rewards.');
      return;
    }

    setCustomerCreating(true);
    setCustomerModalError('');

    try {
      const res = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomerForm.name.trim(),
          mobile: newCustomerForm.mobile.trim(),
          email: newCustomerForm.email.trim() || undefined,
          gstin: newCustomerForm.gstin.trim() || undefined,
          billingAddress: newCustomerForm.billingAddress.trim() || undefined,
          partyType: 'CUSTOMER',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create customer');

      setPartiesList((prev) => [data.party, ...prev]);
      setPartyId(data.party.id);
      setAddCustomerModalOpen(false);
      setNewCustomerForm({
        name: '',
        mobile: '',
        email: '',
        gstin: '',
        billingAddress: '',
      });
    } catch (err: any) {
      setCustomerModalError(err.message);
    } finally {
      setCustomerCreating(false);
    }
  }

  // Transport Accordion
  const [showTransport, setShowTransport] = useState(false);
  const [transport, setTransport] = useState({
    transporterName: '',
    vehicleNumber: '',
    lrNumber: '',
    ewayBillNumber: '',
  });

  // Line items state
  const [lineItems, setLineItems] = useState<any[]>([
    {
      itemId: items[0]?.id || '',
      itemName: items[0]?.name || '',
      hsnSac: items[0]?.hsnSac || '',
      unitName: items[0]?.unit?.code || 'PCS',
      quantity: '1',
      unitRate: String(items[0]?.salesPrice || '0'),
      discountRate: '0',
      taxPercentage: String(items[0]?.taxRate?.rate || '18'),
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-sync party state when party selection changes
  const selectedParty = partiesList.find((p) => p.id === partyId);

  // Derive Place of Supply State Code
  const posState = states.find((s) => s.id === (placeOfSupplyStateId || selectedParty?.stateId || company.stateId));
  const supplierState = states.find((s) => s.id === company.stateId);

  // Live Reactive Tax Calculation
  const calcResult = useMemo(() => {
    try {
      const calcItems = lineItems.map((li) => ({
        itemId: li.itemId,
        itemName: li.itemName,
        hsnSac: li.hsnSac,
        quantity: li.quantity || 0,
        unitRate: li.unitRate || 0,
        discountRate: li.discountRate || 0,
        taxPercentage: li.taxPercentage || 0,
      }));

      return TaxCalculationService.calculate({
        documentType: documentType as any,
        taxMode: taxMode as any,
        supplierStateCodeGst: supplierState?.stateCodeGst || '27',
        placeOfSupplyStateCodeGst: posState?.stateCodeGst || '27',
        isReverseCharge: reverseCharge,
        freightCharges: freightCharges || 0,
        items: calcItems,
      });
    } catch {
      return null;
    }
  }, [lineItems, taxMode, supplierState, posState, reverseCharge, freightCharges, documentType]);

  function handleItemChange(index: number, itemId: string) {
    const it = items.find((i) => i.id === itemId);
    if (!it) return;

    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      itemId: it.id,
      itemName: it.name,
      hsnSac: it.hsnSac || '',
      unitName: it.unit?.code || 'PCS',
      unitRate: String(documentType === 'PURCHASE' ? it.purchasePrice : it.salesPrice),
      taxPercentage: String(it.taxRate?.rate || '18'),
    };
    setLineItems(updated);
  }

  function handleLineFieldChange(index: number, field: string, value: string) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  }

  function addLineItem() {
    const firstItem = items[0];
    setLineItems([
      ...lineItems,
      {
        itemId: firstItem?.id || '',
        itemName: firstItem?.name || '',
        hsnSac: firstItem?.hsnSac || '',
        unitName: firstItem?.unit?.code || 'PCS',
        quantity: '1',
        unitRate: String(documentType === 'PURCHASE' ? firstItem?.purchasePrice || '0' : firstItem?.salesPrice || '0'),
        discountRate: '0',
        taxPercentage: String(firstItem?.taxRate?.rate || '18'),
      },
    ]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, idx) => idx !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        documentType,
        documentDate,
        dueDate: dueDate || null,
        partyId,
        billingPartyName: selectedParty?.name,
        billingAddress: selectedParty?.billingAddress,
        billingGstin: selectedParty?.gstin,
        billingStateId: selectedParty?.stateId,
        placeOfSupplyStateId: posState?.id || selectedParty?.stateId || company.stateId,
        reverseCharge,
        taxMode,
        freightCharges,
        salesmanId: salesmanId || null,
        notes,
        paidAmount: paidAmount || 0,
        paymentMode,
        bankAccountId: bankAccountId || null,
        transport: showTransport ? transport : undefined,
        items: lineItems.map((li) => ({
          itemId: li.itemId || undefined,
          itemName: li.itemName,
          hsnSac: li.hsnSac,
          quantity: li.quantity,
          unitName: li.unitName,
          unitRate: li.unitRate,
          discountRate: li.discountRate,
          taxPercentage: li.taxPercentage,
        })),
      };

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create document');
      }

      router.push(`/sales/invoices/${data.document.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Card 1: Document & Party Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Party Selection */}
          <div className="md:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Party / Customer *
              </label>
              <button
                type="button"
                onClick={() => {
                  setCustomerModalError('');
                  setAddCustomerModalOpen(true);
                }}
                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add Customer
              </button>
            </div>
            <select
              required
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {partiesList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.gstin ? `(${p.gstin})` : ''}
                </option>
              ))}
            </select>
            {selectedParty && (
              <div className="text-[11px] text-slate-500 mt-1">
                GSTIN: <span className="font-mono">{selectedParty.gstin || 'Unregistered'}</span> | State: {selectedParty.state?.name || 'Local'}
              </div>
            )}
          </div>

          {/* Date & Due Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Invoice Date *
            </label>
            <input
              type="date"
              required
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Tax Mode & Place of Supply */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Tax Mode
            </label>
            <select
              value={taxMode}
              onChange={(e) => setTaxMode(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="TAX_EXCLUSIVE">Tax Exclusive (Rates add GST)</option>
              <option value="TAX_INCLUSIVE">Tax Inclusive (Rates include GST)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Place of Supply
            </label>
            <select
              value={placeOfSupplyStateId}
              onChange={(e) => setPlaceOfSupplyStateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {states.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.stateCodeGst || st.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Assigned Salesman
            </label>
            <select
              value={salesmanId}
              onChange={(e) => setSalesmanId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">None / Direct Sale</option>
              {salesmen.map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {sm.name} ({sm.employeeCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Card 2: Items Table */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Line Items & Products</h3>
          <button
            type="button"
            onClick={addLineItem}
            className="inline-flex items-center gap-1.5 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold px-3 py-1.5 rounded-lg border border-sky-200 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Add Item Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2 w-8 text-center">#</th>
                <th className="p-2 min-w-[200px]">Item Description</th>
                <th className="p-2 w-24 text-center">HSN/SAC</th>
                <th className="p-2 w-20 text-right">Qty</th>
                <th className="p-2 w-24 text-right">Rate (₹)</th>
                <th className="p-2 w-16 text-right">Disc %</th>
                <th className="p-2 w-20 text-right">GST %</th>
                <th className="p-2 w-28 text-right">Amount (₹)</th>
                <th className="p-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineItems.map((li, idx) => {
                const calculatedItem = calcResult?.items[idx];
                return (
                  <tr key={idx}>
                    <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-2">
                      <select
                        value={li.itemId}
                        onChange={(e) => handleItemChange(idx, e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-sky-500 font-medium"
                      >
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} (SKU: {it.sku || '-'})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={li.hsnSac}
                        onChange={(e) => handleLineFieldChange(idx, 'hsnSac', e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded text-xs text-center font-mono"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={li.quantity}
                        onChange={(e) => handleLineFieldChange(idx, 'quantity', e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded text-xs text-right font-semibold"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="any"
                        value={li.unitRate}
                        onChange={(e) => handleLineFieldChange(idx, 'unitRate', e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded text-xs text-right font-semibold"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={li.discountRate}
                        onChange={(e) => handleLineFieldChange(idx, 'discountRate', e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={li.taxPercentage}
                        onChange={(e) => handleLineFieldChange(idx, 'taxPercentage', e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded text-xs text-right font-medium"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>
                    <td className="p-2 text-right font-bold text-slate-900">
                      {calculatedItem ? formatCurrency(calculatedItem.totalAmount, '') : '0.00'}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        disabled={lineItems.length <= 1}
                        className="text-slate-400 hover:text-red-600 disabled:opacity-30 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card 3: Transport & E-Way Bill Accordion */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTransport(!showTransport)}
          className="w-full p-4 flex items-center justify-between text-left font-bold text-xs text-slate-800 bg-slate-50 hover:bg-slate-100 transition"
        >
          <span className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-sky-600" /> Transport & E-Way Bill Details (Optional)
          </span>
          {showTransport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showTransport && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Transporter Name</label>
              <input
                type="text"
                value={transport.transporterName}
                onChange={(e) => setTransport({ ...transport, transporterName: e.target.value })}
                placeholder="e.g. VRL Logistics"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vehicle Number</label>
              <input
                type="text"
                value={transport.vehicleNumber}
                onChange={(e) => setTransport({ ...transport, vehicleNumber: e.target.value })}
                placeholder="MH-04-AB-1234"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs uppercase"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">LR / GR Number</label>
              <input
                type="text"
                value={transport.lrNumber}
                onChange={(e) => setTransport({ ...transport, lrNumber: e.target.value })}
                placeholder="LR-987654"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">E-Way Bill Number</label>
              <input
                type="text"
                value={transport.ewayBillNumber}
                onChange={(e) => setTransport({ ...transport, ewayBillNumber: e.target.value })}
                placeholder="12-digit E-Way Bill"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Card 4: Calculations & Totals Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notes & Payment on Invoice */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Customer Notes / Terms
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Goods once sold cannot be returned. Subject to Mumbai Jurisdiction."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-800 mb-2">Record Immediate Payment (Optional)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Amount Paid (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-medium"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Totals Breakdown Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Sub-Total (Taxable):</span>
            <span className="font-semibold text-slate-800">
              {formatCurrency(calcResult?.taxableTotal || 0)}
            </span>
          </div>

          {/* GST Breakdown */}
          {calcResult?.taxSummary.map((t, i) => (
            <div key={i} className="flex justify-between text-slate-600 font-mono text-[11px]">
              <span>{t.taxTypeCode} ({t.taxRatePercentage.toString()}%):</span>
              <span>{formatCurrency(t.taxAmount)}</span>
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-600">Freight & Packaging:</span>
            <input
              type="number"
              step="any"
              value={freightCharges}
              onChange={(e) => setFreightCharges(e.target.value)}
              className="w-24 p-1 border border-slate-300 rounded text-right font-semibold text-xs"
            />
          </div>

          {Number(calcResult?.roundOff || 0) !== 0 && (
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>Round Off:</span>
              <span>{formatCurrency(calcResult?.roundOff || 0)}</span>
            </div>
          )}

          <div className="flex justify-between border-t border-b border-slate-200 py-2 mt-2">
            <span className="text-sm font-bold text-slate-900">Grand Total:</span>
            <span className="text-lg font-black text-slate-900">
              {formatCurrency(calcResult?.grandTotal || 0)}
            </span>
          </div>

          <div className="text-[11px] text-slate-500 italic pt-1">
            <strong>Words:</strong> {numberToWordsINR(calcResult?.grandTotal || 0)}
          </div>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      {addCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Add New Customer</h3>
                  <p className="text-[11px] text-slate-500">
                    Register customer for invoice and loyalty rewards
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddCustomerModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {customerModalError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {customerModalError}
              </div>
            )}

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer / Party Name *</label>
                <input
                  type="text"
                  required
                  value={newCustomerForm.name}
                  onChange={(e) =>
                    setNewCustomerForm({ ...newCustomerForm, name: e.target.value })
                  }
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mobile Number * <span className="text-[10px] text-sky-600 font-normal">(Mandatory for Loyalty & QR)</span>
                </label>
                <input
                  type="tel"
                  required
                  value={newCustomerForm.mobile}
                  onChange={(e) =>
                    setNewCustomerForm({ ...newCustomerForm, mobile: e.target.value })
                  }
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, email: e.target.value })
                    }
                    placeholder="customer@email.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={newCustomerForm.gstin}
                    onChange={(e) =>
                      setNewCustomerForm({ ...newCustomerForm, gstin: e.target.value.toUpperCase() })
                    }
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Billing Address / City</label>
                <input
                  type="text"
                  value={newCustomerForm.billingAddress}
                  onChange={(e) =>
                    setNewCustomerForm({ ...newCustomerForm, billingAddress: e.target.value })
                  }
                  placeholder="City, locality, state..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-[11px]"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center gap-2 text-[11px] text-amber-800">
                <Award className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Loyalty account will automatically be created to track purchase reward points.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddCustomerModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={customerCreating}
                  onClick={handleCreateCustomer}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {customerCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  <span>Save & Select Customer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
