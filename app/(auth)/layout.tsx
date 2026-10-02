import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-sky-500 selection:text-white relative overflow-hidden flex flex-col justify-center">
      {children}
    </div>
  );
}
