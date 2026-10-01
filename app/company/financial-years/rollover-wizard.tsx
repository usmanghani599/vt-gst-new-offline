'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface RolloverWizardProps {
  currentFy: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  };
}

export function RolloverWizard({ currentFy }: RolloverWizardProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Derive next FY Name e.g. "2026-27" -> "2027-28"
  const parts = currentFy.name.split('-');
  const startYear = parseInt(parts[0], 10);
  const nextStart = isNaN(startYear) ? 2027 : startYear + 1;
  const nextEnd = (nextStart + 1).toString().slice(-2);
  const defaultNextName = `${nextStart}-${nextEnd}`;

  const [nextFyName, setNextFyName] = useState(defaultNextName);
  const [nextFyStartDate, setNextFyStartDate] = useState(`${nextStart}-04-01`);
  const [nextFyEndDate, setNextFyEndDate] = useState(`${nextStart + 1}-03-31`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);

  async function handleRollover(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/financial-years/rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nextFyName,
          nextFyStartDate,
          nextFyEndDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rollover failed');

      setSuccess(data.rollover);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleFinish() {
    setIsOpen(false);
    setSuccess(null);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-2"
      >
        <ArrowRightLeft className="h-4 w-4" /> Create New Financial Year (Rollover)
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                1-Click Financial Year Rollover Wizard
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {error}
              </div>
            )}

            {!success ? (
              <form onSubmit={handleRollover} className="space-y-4">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div className="space-y-1">
                    <strong>Important Accounting Lock:</strong>
                    <p>
                      Closing <strong>FY {currentFy.name}</strong> will freeze its historical records to read-only.
                      Closing party balances & closing inventory will automatically become opening balances in{' '}
                      <strong>FY {nextFyName}</strong>.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    New Financial Year Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={nextFyName}
                    onChange={(e) => setNextFyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={nextFyStartDate}
                      onChange={(e) => setNextFyStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={nextFyEndDate}
                      onChange={(e) => setNextFyEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg text-xs transition disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                    <span>{loading ? 'Performing Rollover...' : `Close FY ${currentFy.name} & Open ${nextFyName}`}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-4 space-y-4">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">Rollover Completed Successfully!</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Previous year <strong>FY {success.previousFy}</strong> is now safely locked.
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl text-xs text-left space-y-1 font-medium text-slate-700">
                  <div>• Carried forward {success.carriedForwardPartiesCount} Party closing balances as opening balances.</div>
                  <div>• Inherited {success.carriedForwardItemsCount} Item stock quantities and valuations.</div>
                  <div>• Initialized active accounting period to <strong>FY {success.newFy.name}</strong>.</div>
                </div>

                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-lg text-xs transition"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
