import crypto from 'crypto';
import http from 'http';
import { net, shell } from 'electron';
import { BUILD_CONFIG } from '../build-config';
import { updateVault, vault } from '../security/vault';

/**
 * Google Drive backup target.
 * - OAuth 2.0 for installed apps: loopback redirect + PKCE, opened in the
 *   user's own browser (passwords never pass through this app).
 * - Scope drive.appdata only: files live in the hidden per-app folder, which
 *   the user cannot browse or edit in Drive, and this app cannot see any of
 *   the user's other files.
 * - Only the license owner's email can be connected.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.appdata'];

export function googleConfigured() {
  return Boolean(BUILD_CONFIG.googleClientId);
}

let access: { token: string; exp: number } | null = null;

function b64url(buf: Buffer) {
  return buf.toString('base64url');
}

async function tokenRequest(params: Record<string, string>) {
  const res = await net.fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: BUILD_CONFIG.googleClientId, client_secret: BUILD_CONFIG.googleClientSecret, ...params }).toString(),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.error || 'Google sign-in failed');
  return json;
}

async function revoke(token: string) {
  try {
    await net.fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' });
  } catch {
    /* best effort */
  }
}

/** Interactive connect. `licensedEmail` is the only account allowed. */
export async function connectGoogle(licensedEmail: string): Promise<string> {
  if (!googleConfigured()) throw new Error('Google backup is not configured in this build.');
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  const { code, redirectUri } = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end();
        return;
      }
      const ok = url.searchParams.get('state') === state && url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<html><body style="font-family:system-ui;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh">` +
          `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;text-align:center">` +
          `<h2 style="color:${ok ? '#0284c7' : '#e11d48'}">${ok ? 'Google account connected' : 'Sign-in cancelled'}</h2>` +
          `<p>You can close this tab and return to VTGST Desktop.</p></div></body></html>`
      );
      clearTimeout(timer);
      server.close();
      if (ok) resolve({ code: url.searchParams.get('code')!, redirectUri });
      else reject(new Error(url.searchParams.get('error') || 'Google sign-in was cancelled'));
    });
    let redirectUri = '';
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Google sign-in timed out'));
    }, 5 * 60 * 1000);
    server.listen(0, '127.0.0.1', () => {
      redirectUri = `http://127.0.0.1:${(server.address() as any).port}/oauth2callback`;
      const params = new URLSearchParams({
        client_id: BUILD_CONFIG.googleClientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent select_account',
        login_hint: licensedEmail,
        state,
      });
      shell.openExternal(`${AUTH_URL}?${params}`);
    });
  });

  const tok = await tokenRequest({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri });
  const idPayload = JSON.parse(Buffer.from(String(tok.id_token || '').split('.')[1] || '', 'base64url').toString('utf8') || '{}');
  const email = String(idPayload.email || '').toLowerCase();
  if (!email || idPayload.email_verified === false) {
    await revoke(tok.access_token);
    throw new Error('Could not read a verified email from Google.');
  }
  if (email !== licensedEmail.trim().toLowerCase()) {
    await revoke(tok.refresh_token || tok.access_token);
    throw new Error(`Please connect the licensed Google account (${licensedEmail}). ${email} is not allowed.`);
  }
  if (!tok.refresh_token) throw new Error('Google did not grant offline access. Please try again.');

  updateVault({ google: { email, refreshToken: tok.refresh_token } });
  access = { token: tok.access_token, exp: Date.now() + (Number(tok.expires_in) - 60) * 1000 };
  return email;
}

export async function disconnectGoogle() {
  const g = vault().google;
  if (g) await revoke(g.refreshToken);
  access = null;
  updateVault({ google: undefined });
}

async function accessToken(): Promise<string> {
  if (access && access.exp > Date.now()) return access.token;
  const g = vault().google;
  if (!g) throw new Error('Google account is not connected.');
  const tok = await tokenRequest({ grant_type: 'refresh_token', refresh_token: g.refreshToken });
  access = { token: tok.access_token, exp: Date.now() + (Number(tok.expires_in) - 60) * 1000 };
  return access.token;
}

async function api(url: string, init: RequestInit = {}) {
  const res = await net.fetch(url, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, ...(init.headers || {}) } });
  if (!res.ok) {
    const j: any = await res.json().catch(() => ({}));
    throw new Error(j.error?.message || `Google Drive error ${res.status}`);
  }
  return res;
}

export async function uploadBackup(name: string, data: Buffer): Promise<string> {
  const init = await api(`${UPLOAD}/files?uploadType=resumable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': String(data.length) },
    body: JSON.stringify({ name, parents: ['appDataFolder'], appProperties: { vtgst: 'backup-v1' } }),
  });
  const location = init.headers.get('location');
  if (!location) throw new Error('Google Drive did not accept the upload');
  const put = await api(location, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(data) });
  const file: any = await put.json();
  return file.id;
}

export async function listBackups(): Promise<{ id: string; name: string; size: number; createdTime: string }[]> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,size,createdTime,appProperties)',
    orderBy: 'createdTime desc',
    pageSize: '200',
  });
  const res = await api(`${DRIVE}/files?${params}`);
  const json: any = await res.json();
  return (json.files || [])
    .filter((f: any) => f.appProperties?.vtgst === 'backup-v1')
    .map((f: any) => ({ id: f.id, name: f.name, size: Number(f.size || 0), createdTime: f.createdTime }));
}

export async function downloadBackup(id: string): Promise<Buffer> {
  const res = await api(`${DRIVE}/files/${encodeURIComponent(id)}?alt=media`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteBackup(id: string) {
  await api(`${DRIVE}/files/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
