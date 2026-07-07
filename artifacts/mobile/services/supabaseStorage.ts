/**
 * Supabase Storage service — uses fetch + REST API directly.
 * No @supabase/supabase-js SDK needed, avoids Metro FallbackWatcher crashes
 * caused by the SDK's build-time temp directories.
 *
 * Buckets: pdfs | logos | signatures
 *
 * Required env vars (set in .replit [userenv.shared]):
 *   EXPO_PUBLIC_SUPABASE_URL      — e.g. https://xyzabc.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY — your project's anon/public key
 */
import * as FileSystem from 'expo-file-system/legacy';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Log config status once on module load so it's visible in Metro logs
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] ⚠ Missing env vars — PDF upload to Supabase will be SKIPPED.\n' +
    '  Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .replit [userenv.shared].\n' +
    '  Current values: SUPABASE_URL="' + SUPABASE_URL + '" | ANON_KEY="' + (SUPABASE_ANON_KEY ? '(set)' : '(missing)') + '"'
  );
} else {
  console.log('[Supabase] ✓ Config loaded. URL:', SUPABASE_URL);
}

function storageUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
}

function publicUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    ...extra,
  };
}

/**
 * Thrown by uploadFile when the Supabase Storage REST API returns an HTTP
 * error. Callers can check `.status` to differentiate permission failures
 * (401 / 403) from other server-side errors without relying on Firebase-style
 * error codes.
 */
export class SupabaseUploadError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message: string,
  ) {
    super(message);
    this.name = 'SupabaseUploadError';
  }
}

/**
 * Upload a local file (any type) to a Supabase Storage bucket via REST.
 * Fetches the local URI as a Blob stream; falls back to base64 on Android
 * if the Blob is empty. Returns the public URL on success.
 *
 * Throws SupabaseUploadError on HTTP 4xx/5xx so callers can detect
 * permission failures (401/403) vs. other errors.
 * Returns null only when env vars are missing (i.e. upload is intentionally skipped).
 */
async function uploadFile(
  localUri: string,
  bucket: string,
  path: string,
  contentType: string
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(`[Supabase] Skipping upload of ${bucket}/${path} — env vars not configured`);
    return null;
  }

  console.log(`[Supabase] Uploading ${bucket}/${path} from:`, localUri);

  // Fetch the local file URI as a Blob stream — works with file:// URIs on Expo.
  // Falls back to base64 read if fetch returns an empty/zero-byte blob (Android edge case).
  console.log('[Supabase] Fetching local file as Blob — uri:', localUri);
  const fileResponse = await fetch(localUri);
  let blob = await fileResponse.blob();
  console.log('[Supabase] Blob size:', blob.size, 'bytes | type:', blob.type || '(none)');

  if (blob.size === 0) {
    console.warn('[Supabase] Blob is empty — falling back to base64 read...');
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: contentType });
    console.log('[Supabase] Fallback blob size:', blob.size, 'bytes');
  }

  const url = storageUrl(bucket, path);
  console.log('[Supabase] POST', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': contentType,
      'x-upsert': 'true',
    }),
    body: blob,
  });

  console.log('[Supabase] POST response status:', response.status);

  if (response.ok) {
    const pub = publicUrl(bucket, path);
    console.log('[Supabase] ✓ POST upload succeeded. Public URL:', pub);
    return pub;
  }

  // Try PUT for upsert if POST fails (bucket policy differences)
  const postText = await response.text();
  console.warn(`[Supabase] POST failed (${response.status}): ${postText} — retrying with PUT...`);

  const putResponse = await fetch(url, {
    method: 'PUT',
    headers: authHeaders({
      'Content-Type': contentType,
      'x-upsert': 'true',
    }),
    body: blob,
  });

  console.log('[Supabase] PUT response status:', putResponse.status);

  if (!putResponse.ok) {
    const putText = await putResponse.text();
    const finalStatus = putResponse.status;
    const msg = `Upload failed. POST ${response.status}: ${postText} | PUT ${finalStatus}: ${putText}`;
    console.error(`[Supabase] ✗ ${msg}`);
    throw new SupabaseUploadError(finalStatus, putText, msg);
  }

  const pub = publicUrl(bucket, path);
  console.log('[Supabase] ✓ PUT upload succeeded. Public URL:', pub);
  return pub;
}

/**
 * Upload a local PDF to the "pdfs" bucket.
 * Path: {userId}/{filename}
 * Returns public URL or null on failure.
 */
export async function uploadPDFToSupabase(
  localUri: string,
  filename: string,
  userId: string
): Promise<string | null> {
  console.log('[Supabase][PDF] uploadPDFToSupabase — userId:', userId, '| filename:', filename);
  return uploadFile(localUri, 'pdfs', `${userId}/${filename}`, 'application/pdf');
}

/**
 * Upload a logo image to the "logos" bucket.
 * Returns public URL or null on failure.
 */
export async function uploadLogoToSupabase(
  localUri: string,
  userId: string,
  mimeType = 'image/jpeg'
): Promise<string | null> {
  const ext = localUri.split('.').pop() ?? 'jpg';
  return uploadFile(localUri, 'logos', `${userId}/logo.${ext}`, mimeType);
}

/**
 * Upload a signature image to the "signatures" bucket.
 * Returns public URL or null on failure.
 */
export async function uploadSignatureToSupabase(
  localUri: string,
  userId: string,
  mimeType = 'image/jpeg'
): Promise<string | null> {
  const ext = localUri.split('.').pop() ?? 'jpg';
  return uploadFile(localUri, 'signatures', `${userId}/signature.${ext}`, mimeType);
}

/**
 * Upload a profile photo to the "logos" bucket.
 * Returns public URL or null on failure.
 */
export async function uploadProfilePhotoToSupabase(
  localUri: string,
  userId: string,
  mimeType = 'image/jpeg'
): Promise<string | null> {
  const ext = localUri.split('.').pop() ?? 'jpg';
  return uploadFile(localUri, 'logos', `${userId}/profile-photo.${ext}`, mimeType);
}

// ─── Cloud PDF Listing ────────────────────────────────────────────────────────

export interface CloudStoredPDF {
  /** Original filename, e.g. "Invoice_INV001_classic.pdf" */
  name: string;
  /** Full storage path, e.g. "pdfs/{uid}/Invoice_INV001_classic.pdf" */
  fullPath: string;
  /** Supabase public download URL */
  url: string;
}

/**
 * List all PDFs stored in Supabase Storage for a given user.
 * Path: pdfs/{userId}/
 * Uses the Supabase Storage REST list API (POST /storage/v1/object/list/pdfs).
 * Returns an empty array on error (e.g. no internet, missing config).
 */
export async function listUserPDFsFromSupabase(
  userId: string,
): Promise<CloudStoredPDF[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase][List] Missing env vars — skipping PDF listing');
    return [];
  }
  console.log('[Supabase][List] Listing PDFs for user:', userId);
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/pdfs`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        prefix: `${userId}/`,
        limit: 200,
        offset: 0,
        sortBy: { column: 'name', order: 'desc' },
      }),
    });
    if (!res.ok) {
      console.warn('[Supabase][List] List request failed:', res.status);
      return [];
    }
    const items = (await res.json()) as { name: string }[];
    const pdfs: CloudStoredPDF[] = items
      .filter((item) => item.name && item.name.toLowerCase().endsWith('.pdf'))
      .map((item) => ({
        name: item.name,
        fullPath: `pdfs/${userId}/${item.name}`,
        url: publicUrl('pdfs', `${userId}/${item.name}`),
      }));
    console.log('[Supabase][List] Found', pdfs.length, 'PDF(s)');
    return pdfs;
  } catch (err) {
    console.error('[Supabase][List] Failed — returning empty:', err);
    return [];
  }
}

/**
 * Download a remote Supabase PDF URL to a local cache file and return the path.
 * Used when pdfUrl is a public Supabase URL and we need a local file to open/share.
 */
export async function downloadRemotePDF(
  url: string,
  filename: string
): Promise<string> {
  console.log('[Supabase] downloadRemotePDF — url:', url, '| filename:', filename);
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  try {
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists && (info.size ?? 0) > 1024) {
      console.log('[Supabase] ✓ Using cached file:', dest);
      return dest;
    }
  } catch {}

  const result = await FileSystem.downloadAsync(url, dest);
  if (!result.uri) throw new Error('Remote PDF download failed — no URI returned');
  console.log('[Supabase] ✓ Downloaded to:', result.uri);
  return result.uri;
}
