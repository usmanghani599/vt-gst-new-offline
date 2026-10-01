'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Mic,
  FileText,
  Upload,
  Search,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  ZoomIn,
  X,
  Download,
  Filter,
  Layers,
} from 'lucide-react';

interface MediaItem {
  id: string;
  key: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mediaType: 'IMAGE' | 'AUDIO' | 'DOCUMENT';
  source?: string;
  referenceNumber?: string;
  partyName?: string;
  durationSec?: number;
  createdAt: string | Date;
}

interface MediaManagerProps {
  company: any;
}

export function MediaManagerClient({ company }: MediaManagerProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [s3Config, setS3Config] = useState<any>(null);

  // Connection Test State
  const [testingS3, setTestingS3] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs: number;
  } | null>(null);

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal / Preview State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/media?type=${encodeURIComponent(activeType)}&search=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (res.ok) {
        setMediaList(data.media || []);
        setS3Config(data.config);
      }
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [activeType, searchQuery]);

  const handleTestS3 = async () => {
    setTestingS3(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/media/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
        latencyMs: 0,
      });
    } finally {
      setTestingS3(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    setUploadProgress(`Uploading ${files.length} file(s) to Amazon S3...`);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${file.name} (${i + 1}/${files.length})...`);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'gallery');

        const res = await fetch('/api/media', {
          method: 'POST',
          body: fd,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `Failed to upload ${file.name}`);
        }
      }
      setUploadProgress(null);
      await fetchMedia();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (key: string) => {
    if (!confirm('Are you sure you want to permanently delete this file from Amazon S3?')) {
      return;
    }

    setDeletingKey(key);
    try {
      const res = await fetch('/api/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete file');
      }

      setMediaList((prev) => prev.filter((m) => m.key !== key));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingKey(null);
    }
  };

  const copyToClipboard = (url: string, key: string) => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-amber-500" />
            Amazon S3 Media & Storage Manager
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage order photos, voice notes, payment slips, and assets stored in Amazon S3
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestS3}
            disabled={testingS3}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition cursor-pointer disabled:opacity-50"
          >
            {testingS3 ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Test S3 Connection
          </button>

          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            id="s3-upload-input"
            accept="image/*,audio/*,.pdf"
          />
          <label
            htmlFor="s3-upload-input"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-sm transition cursor-pointer"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload to S3
          </label>
        </div>
      </div>

      {/* S3 Connection Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 shadow-md space-y-4 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">Amazon S3 Object Storage</h3>
                {s3Config?.isConfigured ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> ACTIVE & READY
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <AlertTriangle className="w-3 h-3" /> AWS CREDENTIALS PENDING (.env)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Bucket: <span className="font-mono text-amber-300 font-bold">{s3Config?.bucketName || 'vt-gst-orders'}</span>
                <span className="ml-3">
                  Region: <span className="font-mono text-amber-300 font-bold">{s3Config?.region || 'ap-south-1'}</span>
                </span>
                {s3Config?.customDomain && (
                  <span className="ml-3">
                    CDN: <span className="font-mono text-amber-300 font-bold">{s3Config.customDomain}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="bg-slate-800/80 border border-white/10 px-4 py-2.5 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Media Files</div>
              <div className="text-base font-black text-white">{mediaList.length}</div>
            </div>
          </div>
        </div>

        {/* Live Test Result Alert */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.latencyMs > 0 && (
              <span className="font-mono font-bold px-2 py-0.5 rounded bg-black/30 text-[11px]">
                {testResult.latencyMs} ms
              </span>
            )}
          </div>
        )}

        {uploadProgress && (
          <div className="p-3 bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs rounded-xl flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>{uploadProgress}</span>
          </div>
        )}
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          {[
            { id: 'ALL', label: 'All Files', icon: Filter },
            { id: 'IMAGE', label: 'Images & Photos', icon: ImageIcon },
            { id: 'AUDIO', label: 'Audio Notes', icon: Mic },
            { id: 'DOCUMENT', label: 'Documents (PDF)', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveType(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeType === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search files, orders, parties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Media Gallery Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-xs text-slate-500">Loading files from Amazon S3...</p>
        </div>
      ) : mediaList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">No media files found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Upload images, place client orders with slips, or attach payment receipts to populate your Amazon S3 storage bucket.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mediaList.map((item) => (
            <div
              key={item.key}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              {/* Media Preview Box */}
              <div className="relative bg-slate-900 aspect-video flex items-center justify-center overflow-hidden">
                {item.mediaType === 'IMAGE' ? (
                  <>
                    <img
                      src={item.fileUrl}
                      alt={item.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <button
                      onClick={() => setPreviewImage(item.fileUrl)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-bold cursor-pointer"
                    >
                      <ZoomIn className="w-4 h-4" /> Preview
                    </button>
                  </>
                ) : item.mediaType === 'AUDIO' ? (
                  <div className="flex flex-col items-center justify-center text-purple-400 p-4 w-full">
                    <Mic className="w-8 h-8 mb-2 animate-pulse" />
                    <audio controls src={item.fileUrl} className="w-full h-8 max-w-[200px]" />
                    {item.durationSec && (
                      <span className="text-[10px] text-slate-400 mt-1">{item.durationSec} seconds</span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-amber-400 p-4">
                    <FileText className="w-10 h-10 mb-1" />
                    <span className="text-[11px] font-bold text-slate-300">PDF Document</span>
                  </div>
                )}

                {/* Source Badge */}
                <div className="absolute top-2 left-2">
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs border border-white/10">
                    {item.source === 'CLIENT_ORDER'
                      ? 'Order Slip'
                      : item.source === 'PAYMENT_RECEIPT'
                      ? 'Payment Slip'
                      : 'Amazon S3'}
                  </span>
                </div>
              </div>

              {/* Media Details */}
              <div className="p-3.5 space-y-2 text-xs flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 truncate" title={item.fileName}>
                    {item.fileName}
                  </h4>
                  {item.referenceNumber && (
                    <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                      Ref: {item.referenceNumber} {item.partyName ? `(${item.partyName})` : ''}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                    <span>{formatFileSize(item.fileSize)}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                  <button
                    onClick={() => copyToClipboard(item.fileUrl, item.key)}
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                    title="Copy Public URL"
                  >
                    {copiedKey === item.key ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href={item.fileUrl}
                    download={item.fileName}
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                    title="Download file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => handleDeleteFile(item.key)}
                    disabled={deletingKey === item.key}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-50 ml-auto"
                    title="Delete from S3"
                  >
                    {deletingKey === item.key ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-950 rounded-3xl p-2 overflow-hidden shadow-2xl border border-white/10">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Zoomed preview"
              className="max-h-[85vh] w-auto mx-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
