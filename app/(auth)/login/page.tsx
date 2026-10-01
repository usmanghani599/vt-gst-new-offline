'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LogIn,
  AlertCircle,
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  Receipt,
  Store,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Building2,
  Check,
  CreditCard,
  BarChart3,
  QrCode,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid email or password');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50/40 to-indigo-50/30">
      {/* Decorative Background SVG Waves & Mesh */}
      <svg
        className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-40 -z-10"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        fill="none"
      >
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="grad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
          </linearGradient>
          <pattern id="grid-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#94a3b8" fillOpacity="0.3" />
          </pattern>
        </defs>

        <rect width="1440" height="900" fill="url(#grid-dots)" />
        <path
          d="M0,192L48,208C96,224,192,256,288,240C384,224,480,160,576,149.3C672,139,768,181,864,213.3C960,245,1056,267,1152,245.3C1248,224,1344,160,1392,128L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
          fill="url(#grad1)"
        />
        <circle cx="1200" cy="180" r="280" fill="url(#grad2)" filter="blur(60px)" />
        <circle cx="200" cy="700" r="250" fill="url(#grad1)" filter="blur(50px)" />
      </svg>

      <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center z-10 my-auto">
        {/* LEFT COLUMN: HERO & SVG ILLUSTRATION (Visible on Desktop) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between space-y-6">
          <div className="space-y-6">
            {/* Brand Header */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-sky-600 via-sky-500 to-cyan-400 flex items-center justify-center font-black text-white text-2xl shadow-lg shadow-sky-500/25 ring-4 ring-white">
                VT
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-2xl text-slate-900 tracking-tight">VTGST</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                    v2.6
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase block">
                  Viver Technologies Cloud
                </span>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-2">
              <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                High-Speed Retail POS & <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-600 via-indigo-600 to-cyan-600">
                  GST Invoicing Platform
                </span>
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-lg">
                Complete billing engine with barcode retail POS, user-wise cash drawer handover, automatic GST tax filing, and double-entry accounting.
              </p>
            </div>

            {/* RICH CUSTOM SVG ILLUSTRATION INFOGRAPHIC */}
            <div className="relative bg-white/80 backdrop-blur-md rounded-2xl border border-sky-100 p-5 shadow-xl shadow-sky-100/50">
              <svg
                viewBox="0 0 500 240"
                className="w-full h-auto drop-shadow-sm"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Background Card Shelf */}
                <rect x="10" y="20" width="480" height="200" rx="16" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />

                {/* Left: POS Counter Terminal Mockup */}
                <g transform="translate(30, 40)">
                  <rect width="140" height="150" rx="12" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1.5" />
                  <rect x="10" y="10" width="120" height="70" rx="6" fill="#0f172a" />
                  {/* POS Screen Elements */}
                  <text x="18" y="30" fill="#38bdf8" fontSize="10" fontFamily="sans-serif" fontWeight="bold">VT RETAIL POS</text>
                  <text x="18" y="46" fill="#ffffff" fontSize="14" fontFamily="sans-serif" fontWeight="900">₹1,450.00</text>
                  <rect x="18" y="56" width="60" height="5" rx="2" fill="#22c55e" />
                  <rect x="18" y="65" width="40" height="4" rx="2" fill="#94a3b8" />
                  <circle cx="112" cy="45" r="10" fill="#0284c7" />
                  <path d="M108 45 L111 48 L117 42" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                  {/* POS Keypad */}
                  <rect x="15" y="90" width="22" height="14" rx="3" fill="#f1f5f9" />
                  <rect x="42" y="90" width="22" height="14" rx="3" fill="#f1f5f9" />
                  <rect x="69" y="90" width="22" height="14" rx="3" fill="#f1f5f9" />
                  <rect x="96" y="90" width="28" height="14" rx="3" fill="#0284c7" />
                  <text x="102" y="101" fill="#ffffff" fontSize="8" fontFamily="sans-serif" fontWeight="bold">PAY</text>

                  <rect x="15" y="110" width="22" height="14" rx="3" fill="#f1f5f9" />
                  <rect x="42" y="110" width="22" height="14" rx="3" fill="#f1f5f9" />
                  <rect x="69" y="110" width="22" height="14" rx="3" fill="#f1f5f9" />
                  <rect x="96" y="110" width="28" height="14" rx="3" fill="#e2e8f0" />

                  {/* Barcode scanner laser beam */}
                  <path d="M70 135 L70 145" stroke="#ef4444" strokeWidth="2" strokeDasharray="2 2" />
                </g>

                {/* Middle: Floating GST Tax Invoice */}
                <g transform="translate(190, 30)">
                  <rect width="135" height="170" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                  {/* Invoice Header */}
                  <rect x="12" y="12" width="24" height="6" rx="2" fill="#0284c7" />
                  <text x="42" y="18" fill="#1e293b" fontSize="8" fontFamily="sans-serif" fontWeight="bold">TAX INVOICE</text>
                  <line x1="12" y1="26" x2="123" y2="26" stroke="#f1f5f9" strokeWidth="1.5" />

                  {/* Invoice Items */}
                  <rect x="12" y="34" width="70" height="4" rx="2" fill="#64748b" />
                  <rect x="95" y="34" width="25" height="4" rx="2" fill="#0f172a" />

                  <rect x="12" y="44" width="60" height="4" rx="2" fill="#94a3b8" />
                  <rect x="95" y="44" width="20" height="4" rx="2" fill="#0f172a" />

                  <rect x="12" y="54" width="65" height="4" rx="2" fill="#94a3b8" />
                  <rect x="95" y="54" width="22" height="4" rx="2" fill="#0f172a" />

                  <line x1="12" y1="66" x2="123" y2="66" stroke="#f1f5f9" strokeWidth="1.5" />

                  {/* Tax Badges */}
                  <rect x="12" y="74" width="50" height="12" rx="3" fill="#eff6ff" />
                  <text x="16" y="83" fill="#1d4ed8" fontSize="7" fontFamily="sans-serif" fontWeight="bold">CGST 9%</text>
                  <text x="95" y="83" fill="#1d4ed8" fontSize="7" fontFamily="sans-serif" fontWeight="bold">₹110.70</text>

                  <rect x="12" y="90" width="50" height="12" rx="3" fill="#eff6ff" />
                  <text x="16" y="99" fill="#1d4ed8" fontSize="7" fontFamily="sans-serif" fontWeight="bold">SGST 9%</text>
                  <text x="95" y="99" fill="#1d4ed8" fontSize="7" fontFamily="sans-serif" fontWeight="bold">₹110.70</text>

                  {/* Total Banner */}
                  <rect x="12" y="110" width="111" height="24" rx="4" fill="#f8fafc" stroke="#e2e8f0" />
                  <text x="18" y="122" fill="#64748b" fontSize="7" fontFamily="sans-serif">GRAND TOTAL</text>
                  <text x="18" y="130" fill="#0f172a" fontSize="10" fontFamily="sans-serif" fontWeight="900">₹1,450.00</text>
                  <rect x="85" y="115" width="32" height="14" rx="3" fill="#dcfce7" />
                  <text x="90" y="125" fill="#15803d" fontSize="7" fontFamily="sans-serif" fontWeight="bold">PAID ✓</text>

                  {/* QR & Barcode */}
                  <rect x="12" y="142" width="20" height="20" fill="#f1f5f9" stroke="#cbd5e1" />
                  <rect x="15" y="145" width="6" height="6" fill="#0f172a" />
                  <rect x="23" y="145" width="6" height="6" fill="#0f172a" />
                  <rect x="15" y="153" width="6" height="6" fill="#0f172a" />
                  <line x1="42" y1="152" x2="115" y2="152" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 1" />
                </g>

                {/* Right: Real-time Analytics & Cash Drawer Metric Pill */}
                <g transform="translate(345, 45)">
                  {/* Cash Drawer Handover Pill */}
                  <rect width="130" height="65" rx="10" fill="#ffffff" stroke="#10b981" strokeWidth="1.5" />
                  <text x="12" y="20" fill="#047857" fontSize="8" fontFamily="sans-serif" fontWeight="bold">💵 CASH DRAWER IN HAND</text>
                  <text x="12" y="38" fill="#0f172a" fontSize="13" fontFamily="sans-serif" fontWeight="900">₹8,920.00</text>
                  <rect x="12" y="46" width="65" height="10" rx="3" fill="#d1fae5" />
                  <text x="16" y="54" fill="#065f46" fontSize="7" fontFamily="sans-serif" fontWeight="bold">SHIFT BALANCED ✓</text>

                  {/* Double-Entry Ledger Card */}
                  <rect y="78" width="130" height="68" rx="10" fill="#ffffff" stroke="#6366f1" strokeWidth="1.5" />
                  <text x="12" y="96" fill="#4338ca" fontSize="8" fontFamily="sans-serif" fontWeight="bold">📊 DAY BOOK LEDGER</text>
                  {/* Mini Bar Chart */}
                  <rect x="12" y="112" width="12" height="22" rx="2" fill="#c7d2fe" />
                  <rect x="30" y="105" width="12" height="29" rx="2" fill="#818cf8" />
                  <rect x="48" y="118" width="12" height="16" rx="2" fill="#c7d2fe" />
                  <rect x="66" y="100" width="12" height="34" rx="2" fill="#4f46e5" />
                  <text x="86" y="122" fill="#059669" fontSize="8" fontFamily="sans-serif" fontWeight="bold">+28.4%</text>
                  <text x="86" y="132" fill="#64748b" fontSize="7" fontFamily="sans-serif">Daily Sales</text>
                </g>
              </svg>
            </div>

            {/* Feature Bullets */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="bg-white/70 backdrop-blur-sm p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <Store className="h-4 w-4 text-sky-600 mb-1" />
                <div className="font-bold text-slate-800 text-xs">Retail POS</div>
                <div className="text-[10px] text-slate-500">Barcode & Thermal</div>
              </div>
              <div className="bg-white/70 backdrop-blur-sm p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <Receipt className="h-4 w-4 text-indigo-600 mb-1" />
                <div className="font-bold text-slate-800 text-xs">GST Invoicing</div>
                <div className="text-[10px] text-slate-500">E-Way & Tax Split</div>
              </div>
              <div className="bg-white/70 backdrop-blur-sm p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <ShieldCheck className="h-4 w-4 text-emerald-600 mb-1" />
                <div className="font-bold text-slate-800 text-xs">Cloud Platform</div>
                <div className="text-[10px] text-slate-500">256-Bit SSL Safe</div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Fast & Secure Cloud Infrastructure
            </span>
            <span className="font-mono text-[11px] text-slate-400">256-Bit SSL Protected</span>
          </div>
        </div>

        {/* RIGHT COLUMN: LOGIN CARD */}
        <div className="w-full lg:col-span-6 max-w-md mx-auto">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl shadow-slate-200/60 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
            {/* Top Color Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-500 via-indigo-500 to-cyan-500"></div>

            {/* Mobile Header */}
            <div className="lg:hidden flex items-center gap-2.5 mb-5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center font-black text-white text-lg shadow-md shadow-sky-500/20">
                VT
              </div>
              <div>
                <span className="font-black text-lg text-slate-900 block leading-none">VTGST</span>
                <span className="text-[10px] font-semibold text-sky-600 tracking-wider uppercase">
                  Viver Technologies
                </span>
              </div>
            </div>

            {/* Card Title */}
            <div className="mb-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign In</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your credentials to access your business workspace
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@business.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs font-medium"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold hover:underline transition"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-0.5"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span>Remember this device</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-sky-600/25 hover:shadow-sky-600/35 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in to workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Register Prompt */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
              Don&apos;t have a business account?{' '}
              <Link
                href="/register"
                className="font-bold text-sky-600 hover:text-sky-700 transition inline-flex items-center gap-1 ml-1"
              >
                <span>Start 10-Day Free Trial</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
