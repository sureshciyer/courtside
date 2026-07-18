// =============================================================
//  GOOGLE DRIVE CLOUD SYNC
//
//  Persists the Courtside backup envelope as a single JSON file in
//  the user's Drive **appDataFolder** — a hidden, app-private space
//  inside their own Google account. Any browser/device signed into
//  the same Google account can pull it.
//
//  Why appDataFolder (scope: drive.appdata)?
//    · Non-sensitive scope — no Google app-verification review needed
//    · The app can only see its own file, never the user's real Drive
//    · The file doesn't clutter the visible Drive UI
//
//  Sync algorithm (see syncWithDrive):
//    1. PULL  — download the remote backup (if any)
//    2. MERGE — run it through the existing non-destructive
//               mergeBackup (dedupe by match id, local wins)
//    3. PUSH  — upload the merged snapshot back to Drive
//  So sync is always safe to run from any device in any order;
//  the worst case for concurrent edits is "both sides kept".
//
//  Auth: Google Identity Services (GIS) token model. The Client ID
//  lives in Settings (user-pasted) so no rebuild is needed. Access
//  tokens last ~1h and are held in memory only.
// =============================================================

import { parseBackup } from "./backup.js";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const FILE_NAME = "courtside-backup.json";

// ---------- GIS script loading ----------

let gisPromise = null;
const loadGis = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisPromise = null; reject(new Error("Could not load Google sign-in script. Check your connection.")); };
    document.head.appendChild(s);
  });
  return gisPromise;
};

// ---------- token management (in-memory only) ----------

let cached = { token: null, expiresAt: 0, clientId: null };

export const hasValidToken = (clientId) =>
  !!cached.token && cached.clientId === clientId && Date.now() < cached.expiresAt - 60_000;

export const forgetToken = () => { cached = { token: null, expiresAt: 0, clientId: null }; };

// Request an access token. Must be called from a user gesture the first
// time (Google shows its account-picker popup). Subsequent calls within
// the token's lifetime reuse the cached token.
export const getAccessToken = async (clientId) => {
  if (!clientId?.trim()) throw new Error("No Google Client ID set. Add it in Settings → Cloud sync.");
  if (hasValidToken(clientId)) return cached.token;
  await loadGis();

  return new Promise((resolve, reject) => {
    let settled = false;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: SCOPE,
      callback: (resp) => {
        if (settled) return;
        settled = true;
        if (resp?.access_token) {
          cached = {
            token: resp.access_token,
            expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
            clientId: clientId.trim(),
          };
          resolve(resp.access_token);
        } else {
          reject(new Error(resp?.error_description || resp?.error || "Google sign-in failed."));
        }
      },
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        const msg = err?.type === "popup_closed"
          ? "Sign-in popup was closed before finishing."
          : err?.type === "popup_failed_to_open"
          ? "Popup blocked — allow popups for this site and try again."
          : err?.message || "Google sign-in failed.";
        reject(new Error(msg));
      },
    });
    client.requestAccessToken();
  });
};

// ---------- Drive REST helpers ----------

const driveFetch = async (token, url, options = {}) => {
  const resp = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (!resp.ok) {
    let detail = "";
    try { detail = (await resp.json())?.error?.message || ""; } catch { /* ignore */ }
    if (resp.status === 401) forgetToken();
    throw new Error(`Drive API ${resp.status}${detail ? `: ${detail}` : ""}`);
  }
  return resp;
};

// Find our backup file in appDataFolder. Returns { id, modifiedTime } | null.
export const findBackupFile = async (token) => {
  const url =
    "https://www.googleapis.com/drive/v3/files" +
    `?spaces=appDataFolder&q=${encodeURIComponent(`name='${FILE_NAME}' and trashed=false`)}` +
    "&fields=files(id,name,modifiedTime,size)&pageSize=10";
  const resp = await driveFetch(token, url);
  const { files } = await resp.json();
  return files?.[0] || null;
};

export const downloadBackupFile = async (token, fileId) => {
  const resp = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  );
  return resp.text();
};

// Create (fileId=null) or update the backup file via multipart upload.
export const uploadBackupFile = async (token, fileId, jsonText) => {
  const boundary = "courtside_" + Math.random().toString(36).slice(2);
  const metadata = fileId
    ? { name: FILE_NAME }
    : { name: FILE_NAME, parents: ["appDataFolder"] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    jsonText +
    `\r\n--${boundary}--`;
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,modifiedTime`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime";
  const resp = await driveFetch(token, url, {
    method: fileId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return resp.json();
};

// ---------- orchestrator ----------

// Full pull→merge→push cycle. Pure orchestration — state access goes
// through the callbacks so this file stays store-agnostic and testable.
//
//   clientId       — Google OAuth Client ID (from Settings)
//   getSnapshot()  — returns { current, buildJson } where:
//                      current   = state slice for mergeBackup
//                      buildJson = () => JSON string of the FULL backup
//                                  (called AFTER merge is applied so the
//                                  push includes remote-only matches)
//   applyRemote(remoteData) — parse-validated remote backup → merge into
//                             the store; returns merge stats
//
// Returns { pulled, pushed, stats } for the UI toast.
export const syncWithDrive = async ({ clientId, applyRemote, buildJson }) => {
  const token = await getAccessToken(clientId);

  // 1. PULL
  const existing = await findBackupFile(token);
  let stats = null;
  let pulled = false;
  if (existing) {
    const text = await downloadBackupFile(token, existing.id);
    const { data, error } = parseBackup(text);
    if (error) {
      // Remote file is corrupt — don't merge it, but DO overwrite it with
      // a healthy local snapshot rather than failing the whole sync.
      console.warn("Cloud backup unreadable, will overwrite:", error);
    } else {
      stats = applyRemote(data);
      pulled = true;
    }
  }

  // 2. PUSH the (now merged) local state
  const json = buildJson();
  await uploadBackupFile(token, existing?.id || null, json);

  return { pulled, pushed: true, stats };
};
