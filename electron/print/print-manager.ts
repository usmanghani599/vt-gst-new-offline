import { BrowserWindow, type WebContents, type WebContentsPrintOptions } from 'electron';
import { updateVault, vault } from '../security/vault';

/**
 * Printing for the desktop app. Every `window.print()` in the UI is routed
 * here (see components/desktop/desktop-bridge.tsx). With "silent print" on,
 * documents go straight to the chosen printer without a dialog.
 */

export type PrintKind = 'document' | 'receipt';

const DEFAULTS = { silent: false, documentPrinter: '', receiptPrinter: '', receiptWidthMm: 80 as 58 | 80, copies: 1 };

export function getPrintSettings() {
  return { ...DEFAULTS, ...(vault().print || {}) };
}

export function savePrintSettings(next: typeof DEFAULTS) {
  updateVault({
    print: {
      silent: Boolean(next.silent),
      documentPrinter: String(next.documentPrinter || ''),
      receiptPrinter: String(next.receiptPrinter || ''),
      receiptWidthMm: Number(next.receiptWidthMm) === 58 ? 58 : 80,
      copies: Math.min(5, Math.max(1, Number(next.copies) || 1)),
    },
  });
  return getPrintSettings();
}

export async function listPrinters(wc: WebContents) {
  const printers = await wc.getPrintersAsync();
  return printers.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: Boolean((p as any).isDefault) }));
}

function optionsFor(kind: PrintKind, forceDialog = false): WebContentsPrintOptions {
  const s = getPrintSettings();
  const device = kind === 'receipt' ? s.receiptPrinter : s.documentPrinter;
  const opts: WebContentsPrintOptions = {
    silent: s.silent && !forceDialog,
    printBackground: true,
    copies: s.copies,
  };
  if (device) opts.deviceName = device;
  if (kind === 'receipt') {
    opts.margins = { marginType: 'none' };
    opts.pageSize = { width: s.receiptWidthMm * 1000, height: 297000 };
  }
  return opts;
}

export function printContents(wc: WebContents, kind: PrintKind, forceDialog = false): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    wc.print(optionsFor(kind, forceDialog), (success, failureReason) => {
      if (success || failureReason === 'cancelled') resolve({ ok: true });
      else resolve({ ok: false, error: failureReason || 'Print failed' });
    });
  });
}

export async function testPrint(kind: PrintKind) {
  const s = getPrintSettings();
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
  const width = kind === 'receipt' ? `${s.receiptWidthMm}mm` : '190mm';
  const html = `<!doctype html><html><body style="font-family:Arial;width:${width};margin:0;padding:4mm">
    <h2 style="margin:0;color:#0284c7">VTGST Desktop</h2>
    <p style="margin:4px 0">Printer test (${kind === 'receipt' ? `receipt ${s.receiptWidthMm}mm` : 'A4 document'})</p>
    <p style="margin:4px 0">${new Date().toLocaleString('en-IN')}</p>
    <hr/><p style="margin:4px 0">If you can read this, printing works.</p></body></html>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const res = await printContents(win.webContents, kind);
  win.destroy();
  return res;
}
