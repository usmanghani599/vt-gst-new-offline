'use strict';
// Emulates Electron's utilityProcess `process.parentPort` on top of Node IPC,
// so desktop-server/server-entry.js can be exercised without Electron.
const listeners = [];
process.parentPort = {
  postMessage: (m) => process.send && process.send(m),
  on: (ev, cb) => ev === 'message' && listeners.push(cb),
  once: (ev, cb) => ev === 'message' && listeners.push(cb),
};
process.on('message', (data) => listeners.forEach((cb) => cb({ data })));
require(process.env.VTGST_ENTRY);
