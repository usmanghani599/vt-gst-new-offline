'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Save, Loader2, Upload, Camera, Trash2, Image, FileText } from 'lucide-react';

interface PaymentModalProps {
  parties: any[];
  bankAccounts: any[];
  defaultPartyId?: string;
  defaultType?: 'IN_RECEIPT' | 'OUT_PAYMENT';
  buttonLabel?: string;
  buttonClassName?: string;
}

export function PaymentModal({
  parties,
  bankAccounts,
  defaultPartyId,
  defaultType = 'IN_RECEIPT',
  buttonLabel = 'Record Payment / Receipt',
  buttonClassName,
}: PaymentModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'IN_RECEIPT' | 'OUT_PAYMENT'>(defaultType);
  const [partyId, setPartyId] = useState(defaultPartyId || parties[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || '');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachmentFile(file);
      setAttachmentPreview(URL.createObjectURL(file));
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let uploadedUrl: string | null = null;

      // If photo attachment is selected, upload to Cloudflare R2
      if (attachmentFile) {
        const fd = new FormData();
        fd.append('file', attachmentFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: fd,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Failed to upload payment proof');
        }
        uploadedUrl = uploadData.fileUrl;
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType,
          partyId,
          amount,
          paymentDate,
          paymentMode,
          bankAccountId: paymentMode !== 'CASH' ? bankAccountId || null : null,
          referenceNumber: paymentMode === 'CHEQUE' ? chequeNumber : referenceNumber,
          chequeNumber: paymentMode === 'CHEQUE' ? chequeNumber : null,
          notes,
          attachmentUrl: uploadedUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');

      setIsOpen(false);
      setAmount('');
      setNotes('');
      setReferenceNumber('');
      setChequeNumber('');
      setAttachmentFile(null);
      setAttachmentPreview(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (defaultPartyId) setPartyId(defaultPartyId);
          setPaymentType(defaultType);
          setIsOpen(true);
        }}
        className={
          buttonClassName ||
          'bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition inline-flex items-center gap-2 cursor-pointer'
        }
      >
        <Plus className="h-4 w-4" /> {buttonLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Record Party Transaction (IN / OUT)</h3>
                <p className="text-xs text-slate-500">Record payments received or disbursed with double-entry ledger</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Type Switcher: IN vs OUT */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentType('IN_RECEIPT')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    paymentType === 'IN_RECEIPT'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  Money IN (Receipt from Customer)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('OUT_PAYMENT')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    paymentType === 'OUT_PAYMENT'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                  Money OUT (Payment to Party)
                </button>
              </div>

              {/* Party Select */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Select Party *
                </label>
                <select
                  required
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.gstin ? `(${p.gstin})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-extrabold text-sm text-slate-900 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Transaction Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-slate-50 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Payment Mode & Bank */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-slate-50 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (IMPS/NEFT/RTGS)</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CASH">Cash Drawer</option>
                    <option value="CHEQUE">Cheque / Demand Draft</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="OTHER">Other Mode</option>
                  </select>
                </div>

                {paymentMode !== 'CASH' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Bank Account
                    </label>
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-slate-50 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">General Bank</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - {b.accountNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Reference / Cheque No */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  {paymentMode === 'CHEQUE' ? 'Cheque Number' : 'Transaction Ref / UTR / UPI ID (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={paymentMode === 'CHEQUE' ? 'e.g. 000124' : 'e.g. UPI-9988776655 or NEFT123'}
                  value={paymentMode === 'CHEQUE' ? chequeNumber : referenceNumber}
                  onChange={(e) =>
                    paymentMode === 'CHEQUE'
                      ? setChequeNumber(e.target.value)
                      : setReferenceNumber(e.target.value)
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-slate-50 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Photo Attachment (UPI Screenshot / Cheque / Bank Receipt) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Payment Proof / Screenshot / Slip Photo (Optional)
                </label>
                {!attachmentPreview ? (
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 text-center bg-slate-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="payment-proof-upload"
                    />
                    <label
                      htmlFor="payment-proof-upload"
                      className="cursor-pointer flex items-center justify-center gap-2 text-indigo-600 font-semibold"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Upload UPI screenshot or Cheque photo</span>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <img
                        src={attachmentPreview}
                        alt="proof"
                        className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                      />
                      <span className="text-slate-700 font-medium truncate max-w-[200px]">
                        {attachmentFile?.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Narration / Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Narration / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Advance for Order #ORD-2026-001 or cleared bill #INV-004"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-slate-50 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Recording Payment...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Payment & Post to Ledger
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
