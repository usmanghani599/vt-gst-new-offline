# Backup & restore

*Settings → Google Backup*

1. **Set a backup password** (min 8 characters). It is never stored in plain form and cannot be recovered.
2. **Connect Google** – the browser opens Google sign-in. Only the email the license was issued to is accepted; any other account is refused and its token revoked. Scope is `drive.appdata` (a hidden per-app folder), so VTGST cannot see the user's other Drive files and the backups are not visible in normal Drive browsing.
3. **Automatic backup** – on by default every 24 h once a password is set; keeps the last 30 (configurable), to Google Drive and/or a chosen local folder (e.g. external disk).
4. **Back up now** – to Google Drive or *Save to file…*.

## File format (`.vtgbak`)

```
"VTGSTBK1" | header length | header JSON (version, salt, iv, key-check, app version, device)
AES-256-GCM( gzip( SQLite image ) ) | GCM tag
```

* File key = HKDF(master key, random 256-bit salt per file); the header is authenticated.
* Master key = HKDF( scrypt(password, N=2^17) ‖ license backup secret ).
* The license backup secret (256-bit) is generated per license on the server and only released to an activated computer of that license.

So a backup cannot be opened with only the file, only the password, or only the license: it needs an activated computer **and** the password. Changing the password affects new backups only; older backups still need the password they were made with.

## Restore

*Settings → Google Backup → Restore* (or *First run → Restore backup* on a new computer). Restore replaces all data on this computer; the previous database is kept as `vtgst.db.before-restore-<time>.bak` (still encrypted). The image is decrypted in memory and written straight into a new encrypted database — plain data never touches the disk.
