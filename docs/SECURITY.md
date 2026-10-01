# Security & anti-piracy design

No software that runs on a customer's computer can be made 100% uncrackable — a determined attacker controls the machine. The goal is that **using VTGST without a valid, paid license requires real reverse-engineering effort, cannot be scaled by sharing files or keys, and is detected/revocable from the server.** Data protection uses standard, strong cryptography.

## Layers

| Threat | Protection |
|---|---|
| Sharing a license key | Seat limit per license (server). Activation also needs the registered email. Admin sees every computer and can free/block it. Activation is rate limited. |
| Copying the installation / data folder to another PC | Vault is AES-256-GCM encrypted with a key derived from the machine fingerprint **and** wrapped by the OS keystore (DPAPI / Keychain). The database key is derived from the vault + fingerprint. A copy cannot be opened elsewhere. |
| Forging or editing a license | Token is signed with Ed25519 by the server; only the public key is in the app. Any change breaks the signature. |
| Moving a token between PCs | Token contains the fingerprint hash and the hash of the device's own Ed25519 public key. |
| Staying offline forever after cancellation | Token carries a hard "check online before" deadline (`offlineGraceDays`, default 15). After it the app locks until it verifies online. Revocation/suspension is persisted locally, so restarting offline does not clear it. |
| Turning the clock back | High-water mark of the clock is kept in the vault; going back > 10 minutes locks the app (TAMPERED) until an online check confirms server time. Signed requests fail if the clock is off by > 10 minutes. |
| Replaying / impersonating a device | Every request after activation is signed with the device private key (timestamp + nonce + body hash); nonces are cached server-side. |
| Patching the app | `app.asar` integrity validation + `onlyLoadAppFromAsar` fuses; the bundled server (outside asar) is verified file-by-file against a manifest whose hash is compiled into the asar. `runAsNode`, `NODE_OPTIONS` and `--inspect` are disabled by fuses; DevTools are disabled in production. License is verified independently in the main process **and** in the server middleware. Code-sign the installer. |
| Other local programs reading the API | Server binds to 127.0.0.1 on a random port and rejects any request without the per-launch secret injected by Electron; main-only APIs need a second secret. |
| Reading the database file | SQLCipher (AES-256) — the file on disk is indistinguishable from random data. Stored attachments are AES-256-GCM encrypted individually. |
| Reading a backup file (people or AI tools) | AES-256-GCM; key = scrypt(password, memory-hard) combined with a 256-bit per-license secret only released by the server to an activated computer of that license. Without both, decryption is computationally infeasible; any modified byte is detected. |

## Data residency

* **Offline only (default):** no business data ever leaves the computer. License checks send only license key, email, an anonymous fingerprint hash, app version and tamper events.
* **Linked to online:** only the linked company is uploaded/synced. Other companies on the same computer stay offline only.

## Recovery

* Owner forgot the password → *Forgot password* on the login screen → enter license key + licensed email → new password (works offline).
* New computer / OS reinstall / hardware change → activate (deactivate the old one first, or ask admin to free the seat) → *Restore* from Google Drive or a backup file with the backup password. **Keep automatic backups on** — data cannot be recovered without a backup if the machine is lost.
