/**
 * Typed access to the Electron preload bridge (electron/preload.ts).
 * Returns null when running outside the desktop app.
 */

export type PrintKind = 'document' | 'receipt';

export interface PrintSettings {
  silent: boolean;
  documentPrinter: string;
  receiptPrinter: string;
  receiptWidthMm: 58 | 80;
  copies: number;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export interface LicenseInfo {
  state: string;
  message: string;
  licenseKeyMasked: string | null;
  customer: string | null;
  email: string | null;
  expiresAt: number | null;
  nextCheckBy: number | null;
  lastCheckAt: number | null;
  features: string[];
  allowSync: boolean;
  allowBackup: boolean;
  deviceName: string;
}

export interface BackupInfo {
  googleEmail: string | null;
  licensedEmail: string | null;
  hasPassword: boolean;
  auto: { enabled: boolean; hours: number; keep: number; localFolder: string | null };
  lastBackupAt: string | null;
  lastBackupError: string | null;
  googleConfigured: boolean;
}

export interface BackupFile {
  id: string;
  name: string;
  size: number;
  createdTime: string;
}

export interface SyncStatusInfo {
  linked: boolean;
  linkedCompanyId: string | null;
  seriesCode: string | null;
  pending: number;
  running: boolean;
  lastSyncAt: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastReconcileAt: string | null;
  lastError: string | null;
  failed: { model: string; id: string; message: string }[];
  online?: boolean;
}

type R<T> = Promise<T>;

export interface VtgstDesktopBridge {
  isDesktop: true;
  app: { info(): R<{ version: string; platform: string; dataDir: string; online: boolean }> };
  print: {
    print(opts: { kind: PrintKind; silent?: boolean }): R<{ ok: boolean; error?: string }>;
    printers(): R<PrinterInfo[]>;
    getSettings(): R<PrintSettings>;
    saveSettings(s: PrintSettings): R<PrintSettings>;
    test(kind: PrintKind): R<{ ok: boolean; error?: string }>;
  };
  license: {
    info(): R<LicenseInfo>;
    checkNow(): R<LicenseInfo>;
    deactivate(): R<{ ok: boolean; error?: string }>;
    openActivation(): R<void>;
    change(): R<{ ok: boolean; error?: string }>;
  };
  sync: {
    status(): R<SyncStatusInfo>;
    run(deep?: boolean): R<SyncStatusInfo>;
    companies(email: string, password: string): R<{ accountName: string; companies: { id: string; name: string; gstin: string | null }[] }>;
    link(opts: { email: string; password: string; mode: 'upload' | 'download'; companyId: string }): R<SyncStatusInfo>;
    unlink(): R<SyncStatusInfo>;
  };
  backup: {
    info(): R<BackupInfo>;
    setPassword(password: string, current?: string): R<BackupInfo>;
    connectGoogle(): R<BackupInfo>;
    disconnectGoogle(): R<BackupInfo>;
    saveAuto(auto: BackupInfo['auto']): R<BackupInfo>;
    chooseLocalFolder(): R<BackupInfo>;
    backupNow(target: 'google' | 'local' | 'file'): R<{ ok: boolean; name?: string; error?: string }>;
    listGoogle(): R<BackupFile[]>;
    restoreGoogle(fileId: string, password: string): R<{ ok: boolean; error?: string }>;
    restoreFile(password: string): R<{ ok: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    vtgstDesktop?: VtgstDesktopBridge;
  }
}

export function desktop(): VtgstDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return window.vtgstDesktop ?? null;
}
