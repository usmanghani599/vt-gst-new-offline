import type { Metadata } from 'next';
import './globals.css';
import { DesktopBridge } from '@/components/desktop/desktop-bridge';

export const metadata: Metadata = {
  title: 'VTGST - Modern Multi-Tenant GST, Invoicing & ERP Platform',
  description: 'Production SaaS GST Invoicing, Inventory, Party Ledger, POS, and Accounting Platform by Viver Technologies',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased font-sans">
        <DesktopBridge />
        {children}
      </body>
    </html>
  );
}
