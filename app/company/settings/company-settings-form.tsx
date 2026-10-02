'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Landmark,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Phone,
  Mail,
  Globe,
  CreditCard,
} from 'lucide-react';

interface CompanySettingsFormProps {
  initialCompany: any;
  states: any[];
}

export function CompanySettingsForm({ initialCompany, states }: CompanySettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const defaultBank = initialCompany?.bankAccounts?.find((b: any) => b.isDefault) || initialCompany?.bankAccounts?.[0] || {};

  const [formData, setFormData] = useState({
    name: initialCompany?.name || '',
    legalName: initialCompany?.legalName || '',
    gstin: initialCompany?.gstin || '',
    pan: initialCompany?.pan || '',
    phone: initialCompany?.phone || '',
    mobile: initialCompany?.mobile || '',
    email: initialCompany?.email || '',
    website: initialCompany?.website || '',
    address: initialCompany?.address || '',
    city: initialCompany?.city || '',
    pincode: initialCompany?.pincode || '',
    stateId: initialCompany?.stateId || '',
    defaultTaxMode: initialCompany?.defaultTaxMode || 'TAX_EXCLUSIVE',
    posEnableTax: initialCompany?.posEnableTax ?? true,
    fssaiNo: initialCompany?.fssaiNo || '',
    drugLicenseNo: initialCompany?.drugLicenseNo || '',
    bankAccount: {
      id: defaultBank?.id || '',
      bankName: defaultBank?.bankName || '',
      accountNumber: defaultBank?.accountNumber || '',
      ifsc: defaultBank?.ifsc || '',
      branch: defaultBank?.branch || '',
      upiId: defaultBank?.upiId || '',
    },
  });

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleBankChange(field: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      bankAccount: {
        ...prev.bankAccount,
        [field]: value,
      },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/company/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update company settings');
      }

      setSuccessMsg('Company details updated successfully!');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Alert Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* 1. Legal Entity & GST Identification */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b pb-3">
          <Building2 className="h-4 w-4 text-sky-600" /> Business & Tax Identification
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Trade / Brand Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-semibold"
              placeholder="e.g. Viver Technologies"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Legal Registered Name
            </label>
            <input
              type="text"
              value={formData.legalName}
              onChange={(e) => handleChange('legalName', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder="e.g. Viver Technologies Private Limited"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              GSTIN (Goods and Services Tax ID)
            </label>
            <input
              type="text"
              maxLength={15}
              value={formData.gstin}
              onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono"
              placeholder="e.g. 27AABCV1234F1Z5"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              PAN (Income Tax Number)
            </label>
            <input
              type="text"
              maxLength={10}
              value={formData.pan}
              onChange={(e) => handleChange('pan', e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono"
              placeholder="e.g. AABCV1234F"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              State & Place of Supply <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.stateId}
              onChange={(e) => handleChange('stateId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-medium"
            >
              <option value="">Select Registered State</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Code: {s.stateCodeGst})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Default Invoice Pricing Mode
            </label>
            <select
              value={formData.defaultTaxMode}
              onChange={(e) => handleChange('defaultTaxMode', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-medium"
            >
              <option value="TAX_EXCLUSIVE">Tax Exclusive (Prices + Tax Added)</option>
              <option value="TAX_INCLUSIVE">Tax Inclusive (Prices include Tax)</option>
            </select>
          </div>

          <div className="md:col-span-2 pt-2 border-t border-slate-100">
            <label className="block text-slate-700 font-semibold mb-1">
              Retail POS Counter Tax Setting
            </label>
            <div className="flex items-center gap-6 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                <input
                  type="radio"
                  name="posEnableTax"
                  checked={formData.posEnableTax === true}
                  onChange={() => setFormData((prev) => ({ ...prev, posEnableTax: true }))}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Enable GST / Taxes on POS Bills (GST Registered)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                <input
                  type="radio"
                  name="posEnableTax"
                  checked={formData.posEnableTax === false}
                  onChange={() => setFormData((prev) => ({ ...prev, posEnableTax: false }))}
                  className="w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>Disable Taxes (Generate Normal / Non-GST Bills)</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Configure once here. The POS counter will automatically follow this setting without showing toggles during billing.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Registered Address & Contact */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b pb-3">
          <MapPin className="h-4 w-4 text-emerald-600" /> Address & Contact Details
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-3">
            <label className="block text-slate-700 font-semibold mb-1">
              Registered Address Line (Appears on Invoices)
            </label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Suite 402, IT Tech Park, Expressway"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Mumbai"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">PIN Code</label>
            <input
              type="text"
              maxLength={6}
              value={formData.pincode}
              onChange={(e) => handleChange('pincode', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
              placeholder="e.g. 400001"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Official Phone</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. 022-28472911"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Official Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="billing@vivertech.com"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Website URL</label>
            <input
              type="text"
              value={formData.website}
              onChange={(e) => handleChange('website', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="https://vivertech.com"
            />
          </div>
        </div>
      </div>

      {/* 3. Bank Account for Invoice Payment QR & Bank Transfer */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b pb-3">
          <Landmark className="h-4 w-4 text-indigo-600" /> Default Bank Account for Invoice Printing
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Bank Name</label>
            <input
              type="text"
              value={formData.bankAccount.bankName}
              onChange={(e) => handleBankChange('bankName', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold"
              placeholder="e.g. HDFC Bank Ltd"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Account Number</label>
            <input
              type="text"
              value={formData.bankAccount.accountNumber}
              onChange={(e) => handleBankChange('accountNumber', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="e.g. 50200012345678"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">IFSC Code</label>
            <input
              type="text"
              value={formData.bankAccount.ifsc}
              onChange={(e) => handleBankChange('ifsc', e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="e.g. HDFC0001234"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Branch / Location</label>
            <input
              type="text"
              value={formData.bankAccount.branch}
              onChange={(e) => handleBankChange('branch', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. BKC Complex Branch, Mumbai"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-slate-700 font-semibold mb-1">UPI ID (For Instant Invoice QR)</label>
            <input
              type="text"
              value={formData.bankAccount.upiId}
              onChange={(e) => handleBankChange('upiId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="e.g. vivertech@hdfcbank"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition inline-flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{loading ? 'Saving Changes...' : 'Save Settings'}</span>
        </button>
      </div>
    </form>
  );
}
