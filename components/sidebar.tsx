'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Package,
  Users,
  CreditCard,
  UserCheck,
  Award,
  BarChart3,
  Receipt,
  Settings,
  ShieldCheck,
  ArrowRightLeft,
  Store,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  History,
  Building2,
  Database,
  FolderTree,
  Scale,
  Banknote,
  Activity,
  X,
  PackagePlus,
  Boxes,
  ShoppingBag,
  BookOpen,
  HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  features?: string[];
  userRole?: string;
  isSuperAdmin?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function Sidebar({
  features = [],
  userRole,
  isSuperAdmin = false,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vtgst_sidebar_collapsed');
      if (saved !== null) {
        setCollapsed(saved === 'true');
      }
    } catch {
      // Ignore localStorage errors
    }
    setIsLoaded(true);
  }, []);

  // Close mobile sidebar on route changes
  useEffect(() => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  }, [pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('vtgst_sidebar_collapsed', String(next));
    } catch {
      // Ignore
    }
  };

  const isEnabled = (featureCode?: string) => {
    if (!featureCode) return true;
    if (isSuperAdmin) return true;
    return features.includes(featureCode);
  };

  // SuperAdmin specific menu
  const superAdminNavGroups: NavGroup[] = [
    {
      title: 'Master Control',
      items: [
        { href: '/admin', label: 'Platform Dashboard', icon: LayoutDashboard },
        { href: '/admin/performance', label: 'Speed & Latency Monitor', icon: Activity },
      ],
    },
    {
      title: 'Tenants & Accounts',
      items: [
        { href: '/admin/tenants', label: 'SaaS Tenants & Companies', icon: Building2 },
      ],
    },
    {
      title: 'Users & Access',
      items: [
        { href: '/admin/users', label: 'Platform Users', icon: Users },
      ],
    },
    {
      title: 'Plans & Subscriptions',
      items: [
        { href: '/admin/plans', label: 'Pricing Plans', icon: CreditCard },
        { href: '/admin/subscriptions', label: 'Subscriptions & Billing', icon: Banknote },
      ],
    },
    {
      title: 'Tax Masters',
      items: [
        { href: '/admin/tax-rates', label: 'GST Tax Rates & Masters', icon: Receipt },
      ],
    },
  ];

  // Cash Counter (POS_OPERATOR) specific menu
  const posOperatorNavGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      title: 'POS Billing Counter',
      items: [
        { href: '/sales/pos', label: 'Create POS Bill', icon: Store, feature: 'POS' },
        { href: '/sales/pos/receipts', label: 'List of POS Bills', icon: Receipt, feature: 'POS' },
      ],
    },
    {
      title: 'Purchases & Stock In',
      items: [
        { href: '/purchases', label: 'Purchase Bills', icon: ShoppingCart, feature: 'PURCHASES' },
        { href: '/inventory/items', label: 'Product Catalog (Add Items)', icon: Package, feature: 'INVENTORY' },
        { href: '/inventory/stock-in', label: 'Quick Stock In', icon: PackagePlus, feature: 'INVENTORY' },
      ],
    },
    {
      title: 'Parties',
      items: [
        { href: '/parties/customers', label: 'Customers', icon: Users },
      ],
    },
    {
      title: 'Reports (Read Only)',
      items: [
        { href: '/reports/cash-counter', label: 'Cash Drawer Handover', icon: Store, feature: 'CASH_COUNTER_MANAGEMENT' },
        { href: '/reports/sales', label: 'My Sales Summary', icon: BarChart3, feature: 'REPORTS' },
      ],
    },
  ];

  // Salesman specific menu
  const salesmanNavGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      title: 'Sales & Orders',
      items: [
        { href: '/sales/orders', label: 'Client Orders', icon: ShoppingBag },
        { href: '/sales/invoices', label: 'My Invoices', icon: FileText, feature: 'INVOICING' },
      ],
    },
    {
      title: 'Parties',
      items: [
        { href: '/parties/customers', label: 'My Customers', icon: Users },
      ],
    },
    {
      title: 'My Performance & Points',
      items: [
        { href: '/salesmen', label: 'Sales & Points Ledger', icon: Award, feature: 'SALESMEN' },
        { href: '/loyalty', label: 'Customer Loyalty Points', icon: UserCheck, feature: 'LOYALTY' },
      ],
    },
    {
      title: 'Reports',
      items: [
        { href: '/reports/sales', label: 'My Sales Report', icon: BarChart3, feature: 'REPORTS' },
      ],
    },
  ];

  // Accountant specific menu
  const accountantNavGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      title: 'Sales & POS Engine',
      items: [
        { href: '/sales/orders', label: 'Client Orders', icon: ShoppingBag },
        { href: '/sales/pos', label: 'Retail POS Counter', icon: Store, feature: 'POS' },
        { href: '/sales/pos/receipts', label: 'POS Sales Register', icon: Receipt, feature: 'POS' },
        { href: '/sales/invoices', label: 'Tax Invoices', icon: FileText, feature: 'INVOICING' },
        { href: '/sales/estimates', label: 'Estimates / Quotes', icon: FileSpreadsheet, feature: 'ESTIMATES' },
        { href: '/sales/credit-notes', label: 'Credit Notes', icon: ArrowRightLeft, feature: 'CREDIT_NOTES' },
        { href: '/sales/export-invoices', label: 'Export (SEZ / LUT)', icon: FileText, feature: 'EXPORT_INVOICING' },
      ],
    },
    {
      title: 'Purchases & Expenses',
      items: [
        { href: '/purchases', label: 'Purchase Bills', icon: ShoppingCart, feature: 'PURCHASES' },
        { href: '/purchases/debit-notes', label: 'Debit Notes', icon: ArrowRightLeft, feature: 'DEBIT_NOTES' },
      ],
    },
    {
      title: 'Parties & Ledgers',
      items: [
        { href: '/parties/customers', label: 'Customers', icon: Users },
        { href: '/parties/suppliers', label: 'Suppliers / Vendors', icon: Users },
        { href: '/parties/payments', label: 'Payment Receipts (IN/OUT)', icon: CreditCard },
        { href: '/parties/ledger', label: 'Party Account Ledger', icon: BookOpen },
      ],
    },
    {
      title: 'Reports & Tax Filing',
      items: [
        { href: '/reports/stock', label: 'Stock Summary & Valuation', icon: Boxes, feature: 'REPORTS' },
        { href: '/reports/sales', label: 'Sales Summary', icon: BarChart3, feature: 'REPORTS' },
        { href: '/reports/purchases', label: 'Purchase Summary', icon: BarChart3, feature: 'REPORTS' },
        { href: '/reports/gst', label: 'GSTR-1 & 3B Registers', icon: Receipt, feature: 'GST_FILING' },
        { href: '/reports/day-book', label: 'Daily Cash / Day Book', icon: FileSpreadsheet, feature: 'DAY_BOOK' },
        { href: '/reports/cash-counter', label: 'Cash Drawer Handover', icon: Store, feature: 'CASH_COUNTER_MANAGEMENT' },
      ],
    },
  ];

  // Standard Company menu (Owner, Admin, Manager)
  const tenantNavGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      title: 'Sales & POS Engine',
      items: [
        { href: '/sales/orders', label: 'Client Orders', icon: ShoppingBag },
        { href: '/sales/pos', label: 'Retail POS Counter', icon: Store, feature: 'POS' },
        { href: '/sales/pos/receipts', label: 'POS Sales Register', icon: Receipt, feature: 'POS' },
        { href: '/sales/invoices', label: 'Tax Invoices', icon: FileText, feature: 'INVOICING' },
        { href: '/sales/estimates', label: 'Estimates / Quotes', icon: FileSpreadsheet, feature: 'ESTIMATES' },
        { href: '/sales/credit-notes', label: 'Credit Notes', icon: ArrowRightLeft, feature: 'CREDIT_NOTES' },
        { href: '/sales/export-invoices', label: 'Export (SEZ / LUT)', icon: FileText, feature: 'EXPORT_INVOICING' },
      ],
    },
    {
      title: 'Purchases & Expenses',
      items: [
        { href: '/purchases', label: 'Purchase Bills', icon: ShoppingCart, feature: 'PURCHASES' },
        { href: '/purchases/debit-notes', label: 'Debit Notes', icon: ArrowRightLeft, feature: 'DEBIT_NOTES' },
      ],
    },
    {
      title: 'Inventory & Barcode',
      items: [
        { href: '/inventory/items', label: 'Product Catalog', icon: Package, feature: 'INVENTORY' },
        { href: '/inventory/stock-in', label: 'Quick Stock In (Barcode)', icon: PackagePlus, feature: 'INVENTORY' },
        { href: '/inventory/stock-ledger', label: 'Stock Audit Ledger', icon: History, feature: 'INVENTORY' },
        { href: '/inventory/adjustments', label: 'Stock Adjustments', icon: ArrowRightLeft, feature: 'STOCK_ADJUSTMENTS' },
        { href: '/inventory/categories', label: 'Categories', icon: FolderTree, feature: 'INVENTORY' },
        { href: '/inventory/units', label: 'Units of Measure', icon: Scale, feature: 'INVENTORY' },
      ],
    },
    {
      title: 'Parties & Ledgers',
      items: [
        { href: '/parties/customers', label: 'Customers', icon: Users },
        { href: '/parties/suppliers', label: 'Suppliers / Vendors', icon: Users },
        { href: '/parties/payments', label: 'Payment Receipts (IN/OUT)', icon: CreditCard },
        { href: '/parties/ledger', label: 'Party Account Ledger', icon: BookOpen },
      ],
    },
    {
      title: 'Staff & Loyalty',
      items: [
        { href: '/company/users', label: 'User Management', icon: Users },
        { href: '/salesmen', label: 'Salesmen & Points', icon: Award, feature: 'SALESMEN' },
        { href: '/loyalty', label: 'Customer Loyalty', icon: UserCheck, feature: 'LOYALTY' },
      ],
    },
    {
      title: 'Reports & Tax Filing',
      items: [
        { href: '/reports/stock', label: 'Stock Summary & Valuation', icon: Boxes, feature: 'REPORTS' },
        { href: '/reports/sales', label: 'Sales Summary', icon: BarChart3, feature: 'REPORTS' },
        { href: '/reports/purchases', label: 'Purchase Summary', icon: BarChart3, feature: 'REPORTS' },
        { href: '/reports/gst', label: 'GSTR-1 & 3B Registers', icon: Receipt, feature: 'GST_FILING' },
        { href: '/reports/day-book', label: 'Daily Cash / Day Book', icon: FileSpreadsheet, feature: 'DAY_BOOK' },
        { href: '/reports/cash-counter', label: 'Cash Drawer Handover', icon: Store, feature: 'CASH_COUNTER_MANAGEMENT' },
      ],
    },
    {
      title: 'Settings & Admin',
      items: [
        { href: '/company/media', label: 'Media Files', icon: HardDrive },
        { href: '/company/users', label: 'Team & User Access', icon: Users },
        { href: '/company/financial-years', label: 'Financial Years', icon: History },
        { href: '/company/settings', label: 'Company Settings', icon: Settings },
        { href: '/desktop/settings', label: 'License, Sync, Backup & Print', icon: CreditCard },
      ],
    },
  ];

  let navGroups = tenantNavGroups;
  if (isSuperAdmin) {
    navGroups = superAdminNavGroups;
  } else if (userRole === 'POS_OPERATOR') {
    navGroups = posOperatorNavGroups;
  } else if (userRole === 'SALESMAN') {
    navGroups = salesmanNavGroups;
  } else if (userRole === 'ACCOUNTANT') {
    navGroups = accountantNavGroups;
  }

  const sidebarContent = (isMobileView: boolean) => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950 shrink-0">
        <Link
          href={isSuperAdmin ? '/admin' : '/dashboard'}
          onClick={() => isMobileView && onCloseMobile && onCloseMobile()}
          className="flex items-center gap-2.5 overflow-hidden"
        >
          <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center font-black text-white shadow-md shadow-blue-500/20">
            VT
          </div>
          {(!collapsed || isMobileView) && (
            <div className="transition-opacity duration-200">
              <span className="font-black text-lg tracking-tight text-white block leading-none">VTGST</span>
              <span className="text-[9px] block font-semibold text-sky-400 mt-0.5 tracking-wider uppercase">
                Viver Technologies
              </span>
            </div>
          )}
        </Link>

        {isMobileView ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className={cn(
              'p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition',
              collapsed && 'mx-auto mt-0.5'
            )}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-5 scrollbar-thin">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => isEnabled(item.feature));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title}>
              {!collapsed || isMobileView ? (
                <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </div>
              ) : (
                <div className="h-px bg-slate-800 my-2 mx-2" />
              )}
              <nav className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/dashboard' || item.href === '/admin'
                      ? pathname === item.href
                      : pathname === item.href || (item.href !== '/sales/pos' && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => isMobileView && onCloseMobile && onCloseMobile()}
                      title={collapsed && !isMobileView ? item.label : undefined}
                      className={cn(
                        'flex items-center rounded-xl text-sm font-medium transition-all group',
                        collapsed && !isMobileView ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-bold'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-transform group-hover:scale-110',
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                        )}
                      />
                      {(!collapsed || isMobileView) && (
                        <span className="truncate text-xs font-semibold">{item.label}</span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* Bottom status badge */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/70 shrink-0">
        {!collapsed || isMobileView ? (
          <div className="px-3 py-2 rounded-lg bg-slate-800/60 text-xs text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              System Online
            </span>
            <span className="text-[10px] font-mono">v2.6-GST</span>
          </div>
        ) : (
          <div className="flex justify-center" title="System Online v2.6-GST">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col shrink-0 border-r border-slate-800 no-print transition-all duration-300 relative',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* 2. Mobile Slide-Out Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            onClick={onCloseMobile}
          />

          {/* Drawer Sheet */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-300">
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
