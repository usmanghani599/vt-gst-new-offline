'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Flashlight, FlashlightOff, AlertCircle, ScanBarcode, Loader2 } from 'lucide-react';

interface MobileBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function MobileBarcodeScanner({ isOpen, onClose, onScan }: MobileBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  async function startCamera() {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false);
        setError('Camera access is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        setHasTorch(true);
      }

      // Start BarcodeDetector loop if supported
      scanningRef.current = true;
      initBarcodeDetection(stream);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasCamera(false);
      setError('Camera access denied or unavailable. Please grant camera permission.');
    }
  }

  function stopCamera() {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function toggleTorch() {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  }

  function initBarcodeDetection(stream: MediaStream) {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
      });

      const scanLoop = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const detected = barcodes[0].rawValue;
              if (detected) {
                // Trigger successful scan
                onScan(detected);
                onClose();
                return;
              }
            }
          }
        } catch {
          // ignore scan frame exceptions
        }
        if (scanningRef.current) {
          requestAnimationFrame(scanLoop);
        }
      };

      requestAnimationFrame(scanLoop);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col justify-between p-4 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between text-white pt-2 px-2">
        <div className="flex items-center gap-2">
          <ScanBarcode className="h-5 w-5 text-sky-400" />
          <span className="font-bold text-sm">Scan Product Barcode</span>
        </div>
        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
              title="Flashlight"
            >
              {torchOn ? <Flashlight className="h-5 w-5 text-amber-400" /> : <FlashlightOff className="h-5 w-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Video Viewfinder */}
      <div className="relative flex-1 max-h-[60vh] my-auto rounded-3xl overflow-hidden bg-slate-950 flex items-center justify-center border-2 border-white/20 shadow-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* Laser Scanner Reticle Frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-48 border-2 border-sky-400/80 rounded-2xl relative shadow-lg">
            {/* Reticle Corner Marks */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-sky-400 -mt-1 -ml-1 rounded-tl"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-sky-400 -mt-1 -mr-1 rounded-tr"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-sky-400 -mb-1 -ml-1 rounded-bl"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-sky-400 -mb-1 -mr-1 rounded-br"></div>

            {/* Pulsing Red Laser Line */}
            <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-md shadow-rose-500/80 animate-pulse"></div>
          </div>
        </div>

        {error && (
          <div className="absolute bottom-4 left-4 right-4 bg-rose-900/90 text-white px-3 py-2 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Manual Input Fallback */}
      <div className="pb-4 px-2 space-y-2 max-w-sm mx-auto w-full">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Or type Barcode / SKU number"
            className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl transition"
          >
            Add
          </button>
        </form>
        <p className="text-[11px] text-center text-slate-400">
          Point camera at barcode or QR to scan automatically
        </p>
      </div>
    </div>
  );
}
