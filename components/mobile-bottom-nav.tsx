'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Store,
  FileText,
  Users,
  Package,
  Printer,
  Menu,
} from 'lucide-react';
import { BluetoothPrinterModal } from './bluetooth-printer-modal';
import { bluetoothPrinter, PrinterDevice } from '@/lib/bluetooth-printer';

interface MobileBottomNavProps {
  onOpenMenu?: () => void;
}

export function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [device, setDevice] = useState<PrinterDevice | null>(null);

  useEffect(() => {
    const unsubscribe = bluetoothPrinter.subscribe((status) => {
      setDevice(status);
    });
    return () => unsubscribe();
  }, []);

  // Hide on auth pages
  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'
  ) {
    return null;
  }

  const navItems = [
    {
      label: 'POS',
      href: '/sales/pos',
      icon: Store,
      active: pathname.startsWith('/sales/pos'),
    },
    {
      label: 'Invoices',
      href: '/sales/invoices',
      icon: FileText,
      active: pathname.startsWith('/sales/invoices'),
    },
    {
      label: 'Parties',
      href: '/parties/customers',
      icon: Users,
      active: pathname.startsWith('/parties'),
    },
    {
      label: 'Products',
      href: '/inventory/items',
      icon: Package,
      active: pathname.startsWith('/inventory'),
    },
  ];

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 z-40 px-1 py-1 shadow-lg shadow-slate-900/10">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-1 px-2.5 rounded-2xl transition ${
                  item.active
                    ? 'text-emerald-600 font-black'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition ${
                    item.active ? 'bg-emerald-50 text-emerald-600 scale-105' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </Link>
            );
          })}

          {/* Bluetooth Thermal Printer Quick Action */}
          <button
            type="button"
            onClick={() => setPrinterModalOpen(true)}
            className="flex flex-col items-center py-1 px-2 rounded-2xl text-slate-500 hover:text-indigo-600 transition cursor-pointer"
          >
            <div
              className={`p-1 rounded-xl relative transition ${
                device?.connected
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              <Printer className="h-5 w-5" />
              {device?.connected && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse"></span>
              )}
            </div>
            <span className="text-[10px] tracking-tight font-medium">
              {device?.connected ? 'Printer' : 'BT Print'}
            </span>
          </button>

          {/* Menu Drawer Opener */}
          {onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              className="flex flex-col items-center py-1 px-2 rounded-2xl text-slate-500 hover:text-slate-900 transition cursor-pointer"
            >
              <div className="p-1 rounded-xl bg-slate-100 text-slate-700">
                <Menu className="h-5 w-5" />
              </div>
              <span className="text-[10px] tracking-tight font-medium">Menu</span>
            </button>
          )}
        </div>
      </nav>

      {/* Printer Modal */}
      <BluetoothPrinterModal
        isOpen={printerModalOpen}
        onClose={() => setPrinterModalOpen(false)}
      />
    </>
  );
}
