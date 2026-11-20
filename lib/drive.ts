const FOLDER_NAME = "Hishab Backups";

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

/**
 * শেষ `keep`টি ব্যাকআপ রেখে তার চেয়ে পুরোনোগুলো Drive থেকে মুছে দেয়।
 * নতুনগুলো createdTime অনুযায়ী প্রথমে থাকে, তাই শুধু বাকিদের ডিলিট করি।
 */
export async function pruneBackups(token: string, keep = 5): Promise<number> {
  const folderId = await ensureFolder(token);
  const q = encodeURIComponent(
    folderId
      ? `'${folderId}' in parents and trashed=false`
      : `name contains 'hishab-backup' and trashed=false`,
  );
  const res = await driveFetch(
    `/drive/v3/files?q=${q}&orderBy=createdTime desc,name desc&pageSize=1000&fields=files(id,name,createdTime)&spaces=drive`,
    token,
  );
  const body = (await res.json()) as { files?: DriveFile[] };
  const files = (body.files || []).filter((f) => f.name.endsWith(".json"));
  const old = files.slice(keep);
  let deleted = 0;
  for (const file of old) {
    try {
      await deleteBackup(token, file.id);
      deleted += 1;
    } catch (err) {
      console.warn("old backup delete failed", err);
    }
  }
  return deleted;
}
