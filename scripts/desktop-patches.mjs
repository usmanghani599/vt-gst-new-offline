/**
 * Small, surgical desktop changes applied on top of upstream (online) files by
 * scripts/sync-upstream.mjs. Each patch is idempotent via `marker`.
 */
export const PATCHES = [
  // ---- Root layout: desktop bridge (silent print, sync indicator) ----
  {
    name: 'layout-import-bridge',
    file: 'app/layout.tsx',
    marker: "components/desktop/desktop-bridge'",
    find: "import './globals.css';",
    replace: "import './globals.css';\nimport { DesktopBridge } from '@/components/desktop/desktop-bridge';",
  },
  {
    name: 'layout-render-bridge',
    file: 'app/layout.tsx',
    marker: '<DesktopBridge />',
    find: '        {children}\n      </body>',
    replace: '        <DesktopBridge />\n        {children}\n      </body>',
  },

  // ---- Per-device document numbering once linked to online sync ----
  {
    name: 'document-service-import',
    file: 'lib/services/document-service.ts',
    marker: "lib/desktop-local/runtime'",
    find: 'export class DocumentService {',
    replace: "import { deviceNumberTag, getDeviceSeriesCode } from '@/lib/desktop-local/runtime';\n\nexport class DocumentService {",
  },
  {
    name: 'document-service-series-prefix',
    file: 'lib/services/document-service.ts',
    marker: 'const deviceSeries = getDeviceSeriesCode();',
    find: "    const defaultPrefix = `${prefixMap[documentType] || 'DOC'}/${fy.name}`;",
    replace:
      "    // Desktop: once synced with online, each computer numbers in its own series (e.g. DK7Q-INV/2026-27/00001)\n" +
      '    const deviceSeries = getDeviceSeriesCode();\n' +
      "    const basePrefix = `${prefixMap[documentType] || 'DOC'}/${fy.name}`;\n" +
      '    const defaultPrefix = deviceSeries ? `${deviceSeries}-${basePrefix}` : basePrefix;',
  },
  {
    name: 'document-service-series-lookup',
    file: 'lib/services/document-service.ts',
    marker: '...(deviceSeries ? { prefix: defaultPrefix } : {}),',
    find: '          financialYearId,\n          documentType,\n        },\n      });\n\n      if (!series) {',
    replace:
      '          financialYearId,\n          documentType,\n          ...(deviceSeries ? { prefix: defaultPrefix } : {}),\n        },\n      });\n\n      if (!series) {',
  },
  {
    name: 'document-service-receipt-number',
    file: 'lib/services/document-service.ts',
    marker: 'RCP/${fy.name}/${deviceNumberTag()}',
    find: 'const paymentNumber = `RCP/${fy.name}/${String(',
    replace: 'const paymentNumber = `RCP/${fy.name}/${deviceNumberTag()}${String(',
  },
  {
    name: 'payments-import',
    file: 'app/api/payments/route.ts',
    marker: "lib/desktop-local/runtime'",
    find: "import Decimal from 'decimal.js';",
    replace: "import Decimal from 'decimal.js';\nimport { deviceNumberTag } from '@/lib/desktop-local/runtime';",
  },
  {
    name: 'payments-number',
    file: 'app/api/payments/route.ts',
    marker: '${fy.name}/${deviceNumberTag()}${randNum}',
    find: 'const paymentNumber = `${prefix}/${fy.name}/${randNum}`;',
    replace: 'const paymentNumber = `${prefix}/${fy.name}/${deviceNumberTag()}${randNum}`;',
  },

  // ---- Session cookie over loopback http (the desktop never serves https) ----
  {
    name: 'login-cookie-secure',
    file: 'app/api/auth/login/route.ts',
    marker: 'secure: false, // desktop: loopback http',
    find: "secure: process.env.NODE_ENV === 'production',",
    replace: 'secure: false, // desktop: loopback http',
  },

  // ---- Navigation: billing/S3 pages become desktop settings ----
  {
    name: 'sidebar-billing',
    file: 'components/sidebar.tsx',
    marker: "title: 'Desktop App'",
    find: "        { href: '/subscription', label: 'Plan & Billing', icon: CreditCard },\n",
    replace: '',
  },
  {
    // Own "Desktop App" section right below Dashboard, for every role
    // (non-owners only see the Printing tab on that page).
    name: 'sidebar-desktop-settings',
    file: 'components/sidebar.tsx',
    marker: "title: 'Desktop App'",
    all: true,
    find: "      items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],\n    },\n",
    replace:
      "      items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],\n    },\n" +
      "    {\n      title: 'Desktop App',\n      items: [{ href: '/desktop/settings', label: 'Desktop Settings', icon: ShieldCheck }],\n    },\n",
  },
  {
    name: 'sidebar-media-label',
    file: 'components/sidebar.tsx',
    marker: "label: 'Media Files'",
    find: "label: 'Amazon S3 Media'",
    replace: "label: 'Media Files'",
  },
  {
    name: 'navbar-upgrade',
    file: 'components/navbar.tsx',
    marker: "router.push('/desktop/settings')",
    find: "router.push('/subscription')",
    replace: "router.push('/desktop/settings')",
  },
];
