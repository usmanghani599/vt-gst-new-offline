# Online sync

## Modes

* **Offline only** – default. Triggers do not record anything, nothing is sent.
* **Join online (upload)** – *Settings → Online Sync*. Sign in with the license owner's online account; the selected company (same ids) is created in that online account and every row is uploaded.
* **Download from online** – on a fresh computer, *First run → From online* downloads an existing online company and keeps it synced.

Once linked, the desktop is **local-first**: every screen reads and writes the local encrypted database. Changes are queued and exchanged every ~2 minutes while online, immediately when the connection returns, or with *Sync now*.

## How it works

* **Aggregates.** Sync moves whole aggregates (e.g. an invoice with its items, taxes, transport, export info and references; a payment with its allocations). The list and order live in `lib/desktop-sync/registry.ts`, shared verbatim with the online app.
* **Desktop → online.** SQLite triggers (`migrations/desktop.sql`) record changed root ids in `_sync_outbox`. Push sends the current state of each root; deletes are sent as tombstones. Writes that came *from* the server use a separate connection where triggers are disabled, so nothing echoes back.
* **Online → desktop.** The online server is not modified. Pull uses `updatedAt`/`createdAt` cursors for large tables, full sets for small masters (financial years, units, categories, bank accounts, salesmen, party groups), and `desktop_sync_log` for changes pushed by *other* desktops. A bucketed hash **reconcile** (every 6 h, or *Full verify*) catches deletes and edits that cursors cannot see.
* **Same ids everywhere.** All keys are UUIDs; platform masters (states, GST rates, system units) are downloaded with server ids at activation.
* **Numbering.** After linking, each computer numbers in its own series, e.g. `DK7Q-INV/2026-27/00001`, so invoice/receipt numbers can never collide with online or other computers.
* **Conflicts.** A local change that has not been pushed yet is never overwritten by a pull. If the same record was edited online *after* the local edit, the online version wins and the local one is reported. Items that cannot be applied (e.g. a duplicate category name created on both sides) are listed under *Items that could not sync*.
* **Security.** Every request is signed by the device key; the server checks that every row and every foreign key belongs to the linked company.

## Server endpoints (vtgstnew)

`/api/desktop/sync/companies`, `link`, `unlink`, `push`, `pull`, `reconcile`, `fetch` — see `vtgstnew/docs/DESKTOP_LICENSING_AND_SYNC.md`.
