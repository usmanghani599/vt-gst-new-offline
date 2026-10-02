import { contextBridge, ipcRenderer } from 'electron';

/**
 * The only API exposed to web content (window.vtgstDesktop). Every call is a
 * named IPC request; the main process validates the sender origin.
 */
const call = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('vtgstDesktop', {
  isDesktop: true,
  app: { info: () => call('app:info') },
  activation: {
    activate: (licenseKey: string, email: string) => call('activation:activate', licenseKey, email),
    info: () => call('license:info'),
    quit: () => call('app:quit'),
  },
  print: {
    print: (opts: { kind: 'document' | 'receipt'; silent?: boolean }) => call('print:current', opts),
    printers: () => call('print:printers'),
    getSettings: () => call('print:get'),
    saveSettings: (s: unknown) => call('print:save', s),
    test: (kind: 'document' | 'receipt') => call('print:test', kind),
  },
  license: {
    info: () => call('license:info'),
    checkNow: () => call('license:check'),
    deactivate: () => call('license:deactivate'),
    openActivation: () => call('license:open-activation'),
  },
  sync: {
    status: () => call('sync:status'),
    run: (deep?: boolean) => call('sync:run', Boolean(deep)),
    companies: (email: string, password: string) => call('sync:companies', email, password),
    link: (opts: unknown) => call('sync:link', opts),
    unlink: () => call('sync:unlink'),
  },
  backup: {
    info: () => call('backup:info'),
    setPassword: (password: string, current?: string) => call('backup:set-password', password, current),
    connectGoogle: () => call('backup:google-connect'),
    disconnectGoogle: () => call('backup:google-disconnect'),
    saveAuto: (auto: unknown) => call('backup:save-auto', auto),
    chooseLocalFolder: () => call('backup:choose-folder'),
    backupNow: (target: string) => call('backup:now', target),
    listGoogle: () => call('backup:list-google'),
    restoreGoogle: (fileId: string, password: string) => call('backup:restore-google', fileId, password),
    restoreFile: (password: string) => call('backup:restore-file', password),
  },
});
