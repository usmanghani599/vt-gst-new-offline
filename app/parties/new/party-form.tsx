'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2 } from 'lucide-react';

interface PartyFormProps {
  partyGroups: any[];
  states: any[];
  defaultType?: string;
}

export function PartyForm({ partyGroups, states, defaultType = 'CUSTOMER' }: PartyFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    phone: '',
    mobile: '',
    email: '',
    gstin: '',
    pan: '',
    partyType: defaultType,
    gstRegType: 'REGULAR',
    stateId: states.find((s) => s.stateCodeGst === '27')?.id || states[0]?.id || '',
    city: 'Mumbai',
    pincode: '',
    billingAddress: '',
    shippingAddress: '',
    creditLimit: '100000',
    openingBalance: '0',
    openingBalanceType: defaultType === 'SUPPLIER' ? 'CREDIT' : 'DEBIT',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    let updated = { ...formData, [name]: value };

    // Auto-extract PAN from GSTIN if 15-character Indian GSTIN
    if (name === 'gstin' && value.length >= 12) {
      updated.pan = value.substring(2, 12).toUpperCase();
      // Auto-detect State by first 2 digits
      const statePrefix = value.substring(0, 2);
      const matchedState = states.find((s) => s.stateCodeGst === statePrefix);
      if (matchedState) {
        updated.stateId = matchedState.id;
      }
    }

    setFormData(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create party');

      const redirectPath = formData.partyType === 'SUPPLIER' ? '/parties/suppliers' : '/parties/customers';
      router.push(redirectPath);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Party / Business Name *
          </label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Apex Solutions Pvt Ltd"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Party Type *
          </label>
          <select
            name="partyType"
            value={formData.partyType}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
          >
            <option value="CUSTOMER">Customer (Debtor)</option>
            <option value="SUPPLIER">Supplier / Vendor (Creditor)</option>
            <option value="BOTH">Both (Customer & Supplier)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            GSTIN (Tax ID)
          </label>
          <input
            type="text"
            name="gstin"
            value={formData.gstin}
            onChange={handleChange}
            placeholder="27AAACA1234A1Z1"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            PAN / Tax Identifier
          </label>
          <input
            type="text"
            name="pan"
            value={formData.pan}
            onChange={handleChange}
            placeholder="AAACA1234A"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            GST Registration Type
          </label>
          <select
            name="gstRegType"
            value={formData.gstRegType}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
          >
            <option value="REGULAR">Regular Taxpayer</option>
            <option value="COMPOSITION">Composition Scheme</option>
            <option value="UNREGISTERED">Unregistered Business</option>
            <option value="CONSUMER">Consumer</option>
            <option value="OVERSEAS">Overseas / Export</option>
            <option value="SEZ">Special Economic Zone (SEZ)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            State / Jurisdiction *
          </label>
          <select
            name="stateId"
            value={formData.stateId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
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
            Mobile Number
          </label>
          <input
            type="tel"
            name="mobile"
            value={formData.mobile}
            onChange={handleChange}
            placeholder="98200XXXXX"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Email Address
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="accounts@apex.com"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Billing Address
          </label>
          <textarea
            rows={2}
            name="billingAddress"
            value={formData.billingAddress}
            onChange={handleChange}
            placeholder="Plot 45, Sector 5, Commercial Complex..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Credit Limit (₹)
          </label>
          <input
            type="number"
            name="creditLimit"
            value={formData.creditLimit}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Opening Balance (₹)
          </label>
          <input
            type="number"
            name="openingBalance"
            value={formData.openingBalance}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
          />
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
          <span>{loading ? 'Creating...' : 'Save Party Record'}</span>
        </button>
      </div>
    </form>
  );
}
