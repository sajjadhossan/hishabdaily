const SCOPES = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Hishab Backups";

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (cfg: Record<string, unknown>) => {
            requestAccessToken: (opts?: Record<string, unknown>) => void;
          };
        };
      };
    };
  }
}

let gisPromise: Promise<void> | null = null;

export function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ব্রাউজারে চালান।"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-gis]");
      const done = () => resolve();
      const fail = () => reject(new Error("Google স্ক্রিপ্ট লোড করা যায়নি।"));
      if (existing) {
        existing.addEventListener("load", done);
        existing.addEventListener("error", fail);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.gis = "1";
      script.onload = done;
      script.onerror = fail;
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

let cached: { value: string; expires: number } | null = null;

function requestToken(clientId: string, prompt: "" | "consent" | "select_account"): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) return reject(new Error("Google OAuth লোড হয়নি।"));
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "Google অনুমতি পাওয়া যায়নি।"));
          return;
        }
        cached = {
          value: resp.access_token,
          expires: Date.now() + ((resp.expires_in || 3600) - 90) * 1000,
        };
        resolve(resp.access_token);
      },
      error_callback: (err: { type?: string; message?: string }) => {
        reject(new Error(err?.message || err?.type || "Google অনুমতি বাতিল হয়েছে।"));
      },
    });
    client.requestAccessToken({ prompt });
  });
}

export async function getDriveToken(clientId: string): Promise<string> {
  if (cached && cached.expires > Date.now()) return cached.value;
  await loadGis();
  try {
    return await requestToken(clientId, "");
  } catch {
    return await requestToken(clientId, "consent");
  }
}

export function hasDriveToken(): boolean {
  return !!cached && cached.expires > Date.now();
}

/** অ্যাপ খোলার সময় নীরবে টোকেন নেওয়ার চেষ্টা (ব্যবহারকারীর অনুমতি না থাকলে null) */
export async function getDriveTokenSilent(clientId: string): Promise<string | null> {
  if (cached && cached.expires > Date.now()) return cached.value;
  try {
    await loadGis();
    return await requestToken(clientId, "");
  } catch {
    return null;
  }
}

async function driveFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    let message = `Google Drive ${res.status}`;
    try {
      const body = await res.json();
      message = body?.error?.message || message;
    } catch {
      /* ignore */
    }
    if (res.status === 401) throw new Error("Google অনুমতিের মেয়াদ শেষ। আবার ব্যাকআপ চাপুন।");
    throw new Error(message);
  }
  return res;
}

let folderCache: string | null = null;

/** তৈরি হওয়া “Hishab Backups” ফোল্ডারের Drive লিংক (একবার তৈরি হলে) */
export function driveFolderUrl(): string | null {
  return folderCache ? `https://drive.google.com/drive/folders/${folderCache}` : null;
}

/** Drive-এর এররকে ব্যবহারকারীর বোঝার মতো বাংলায় অনুবাদ */
export function driveErrorText(err: unknown): string {
  const msg = (err as Error)?.message || "Drive-এ সংযোগ করা যায়নি";
  if (/has not been used in project|is disabled|SERVICE_DISABLED/i.test(msg))
    return "Google Drive API চালু নেই। Cloud Console → APIs & Services → Library → “Google Drive API” → Enable করুন, তারপর ২-৩ মিনিট অপেক্ষা করুন।";
  if (/insufficient|insufficientPermissions|ACCESS_TOKEN_SCOPE/i.test(msg))
    return "Drive-এর অনুমতি নেই। লগআউট করে আবার Google দিয়ে সাইন ইন করুন (নতুন অনুমতি নিতে হবে)।";
  if (/quota/i.test(msg)) return "Google Drive-এর স্টোরেজ ভরে গেছে বা কোটা সমস্যা।";
  if (/invalid_grant|Invalid Credentials/i.test(msg))
    return "Google টোকেনের মেয়াদ শেষ। আবার চেষ্টা করুন।";
  return msg;
}

export async function ensureFolder(token: string): Promise<string | null> {
  if (folderCache) return folderCache;
  try {
    const q = encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const res = await driveFetch(
      `/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive&pageSize=1`,
      token,
    );
    const body = (await res.json()) as { files?: { id: string }[] };
    if (body.files?.length) {
      folderCache = body.files[0].id;
      return folderCache;
    }
    const created = await driveFetch(`/drive/v3/files?fields=id`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    const data = (await created.json()) as { id: string };
    folderCache = data.id;
    return folderCache;
  } catch (err) {
    console.warn("folder setup failed", err);
    return null;
  }
}

export interface DriveFile {
  id: string;
  name: string;
  createdTime?: string;
  size?: string;
}

export async function uploadBackup(
  token: string,
  filename: string,
  content: string,
): Promise<DriveFile> {
  const folderId = await ensureFolder(token);
  const metadata: Record<string, unknown> = { name: filename, mimeType: "application/json" };
  if (folderId) metadata.parents = [folderId];

  const boundary = `hishab_${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${content}\r\n--${boundary}--`;

  const res = await driveFetch(
    `/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,size`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return (await res.json()) as DriveFile;
}

export async function listBackups(token: string): Promise<DriveFile[]> {
  const folderId = await ensureFolder(token);
  const q = encodeURIComponent(
    folderId
      ? `'${folderId}' in parents and trashed=false`
      : `name contains 'hishab-backup' and trashed=false`,
  );
  const res = await driveFetch(
    `/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,createdTime,size)&spaces=drive`,
    token,
  );
  const body = (await res.json()) as { files?: DriveFile[] };
  return (body.files || []).filter((f) => f.name.endsWith(".json"));
}

export async function downloadBackup(token: string, fileId: string): Promise<string> {
  const res = await driveFetch(`/drive/v3/files/${fileId}?alt=media`, token);
  return res.text();
}

export async function deleteBackup(token: string, fileId: string): Promise<void> {
  await driveFetch(`/drive/v3/files/${fileId}`, token, { method: "DELETE" });
}
