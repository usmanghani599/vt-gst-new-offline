'use client';

import React, { useState } from 'react';
import { AuthContext } from '@/lib/auth';
import { Sidebar } from './sidebar';
import { Navbar } from './navbar';
import { MobileBottomNav } from './mobile-bottom-nav';

interface AppShellLayoutProps {
  authContext: AuthContext;
  children: React.ReactNode;
}

export function AppShellLayout({ authContext, children }: AppShellLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Persistent Sidebar */}
      <Sidebar
        features={authContext.account?.features || []}
        userRole={authContext.company?.role}
        isSuperAdmin={authContext.user.isSuperAdmin}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          authContext={authContext}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>
        <MobileBottomNav onOpenMenu={() => setMobileMenuOpen(true)} />
      </div>
    </div>
  );
}
