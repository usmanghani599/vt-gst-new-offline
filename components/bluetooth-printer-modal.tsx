'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings2,
  Sparkles,
  X,
  FileCheck,
} from 'lucide-react';
import { bluetoothPrinter, PrinterDevice } from '@/lib/bluetooth-printer';

interface BluetoothPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BluetoothPrinterModal({ isOpen, onClose }: BluetoothPrinterModalProps) {
  const [device, setDevice] = useState<PrinterDevice | null>(null);
  const [loading, setLoading] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isSupported = bluetoothPrinter.isSupported();

  useEffect(() => {
    const unsubscribe = bluetoothPrinter.subscribe((status) => {
      setDevice(status);
      if (status) {
        setPaperWidth(status.paperWidth);
      }
    });
    return () => unsubscribe();
  }, []);

  async function handleConnect() {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const connectedDevice = await bluetoothPrinter.connect();
      setSuccess(`Connected to ${connectedDevice.name} successfully!`);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setError(err.message || 'Failed to connect to Bluetooth printer.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDisconnect() {
    bluetoothPrinter.disconnect();
    setSuccess('Printer disconnected.');
  }

  function handlePaperWidthChange(width: '58mm' | '80mm') {
    setPaperWidth(width);
    bluetoothPrinter.setPaperWidth(width);
  }

  async function handleTestPrint() {
    setError(null);
    setSuccess(null);
    setTestPrinting(true);

    try {
      await bluetoothPrinter.printTestPage();
      setSuccess('Test page sent to printer!');
    } catch (err: any) {
      setError(err.message || 'Failed to print test page.');
    } finally {
      setTestPrinting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
            <Printer className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              Bluetooth Thermal Printer
            </h2>
            <p className="text-xs text-slate-500">
              ESC/POS 58mm & 80mm wireless receipt printing
            </p>
          </div>
        </div>

        {/* Browser Support Warning */}
        {!isSupported && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              Web Bluetooth Not Supported in this Browser
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Please open VTGST in <strong>Google Chrome for Android</strong> or <strong>Edge/Chrome on Desktop</strong> to connect directly to Bluetooth thermal printers.
            </p>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Connection Status Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Connection Status</span>
            {device?.connected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                Disconnected
              </span>
            )}
          </div>

          {device?.connected ? (
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-black text-slate-900">{device.name}</p>
                <p className="text-[11px] text-slate-500">Wireless ESC/POS Ready</p>
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={loading || !isSupported}
              onClick={handleConnect}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Scanning & Pairing...</span>
                </>
              ) : (
                <>
                  <Bluetooth className="h-4 w-4" />
                  <span>Pair & Connect Printer</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Paper Width Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Thermal Paper Roll Width
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handlePaperWidthChange('58mm')}
              className={`p-3 rounded-2xl border text-left transition ${
                paperWidth === '58mm'
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="font-black text-xs">58 mm (2 Inch)</div>
              <div className="text-[10px] text-slate-500 mt-0.5">32 Columns (Compact POS)</div>
            </button>

            <button
              type="button"
              onClick={() => handlePaperWidthChange('80mm')}
              className={`p-3 rounded-2xl border text-left transition ${
                paperWidth === '80mm'
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="font-black text-xs">80 mm (3 Inch)</div>
              <div className="text-[10px] text-slate-500 mt-0.5">48 Columns (Full Thermal)</div>
            </button>
          </div>
        </div>

        {/* Test Print Action */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={!device?.connected || testPrinting}
            onClick={handleTestPrint}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            {testPrinting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Printing Test Slip...</span>
              </>
            ) : (
              <>
                <FileCheck className="h-4 w-4" />
                <span>Print Test Receipt</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Floating / Top Header Status Indicator Badge
export function BluetoothPrinterBadge() {
  const [device, setDevice] = useState<PrinterDevice | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = bluetoothPrinter.subscribe((status) => {
      setDevice(status);
    });
    return () => unsubscribe();
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
          device?.connected
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
        }`}
        title="Bluetooth Thermal Receipt Printer"
      >
        {device?.connected ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <Printer className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline font-mono">{device.name.slice(0, 12)}</span>
            <span className="text-[10px] bg-emerald-200/80 px-1.5 py-0.2 rounded text-emerald-900 font-black">
              {device.paperWidth}
            </span>
          </>
        ) : (
          <>
            <Bluetooth className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">BT Printer</span>
          </>
        )}
      </button>

      <BluetoothPrinterModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
