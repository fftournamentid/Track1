/**
 * Supabase Storage service — uses fetch + REST API directly.
 * No @supabase/supabase-js SDK needed, avoids Metro FallbackWatcher crashes
 * caused by the SDK's build-time temp directories.
 *
 * Buckets: pdfs | logos | signatures
 */
import * as FileSystem from 'expo-file-system/legacy';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

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
 * Upload a local file (any type) to a Supabase Storage bucket via REST.
 * Uses expo-file-system to read the file as base64, then uploads with fetch.
 * Returns the public URL on success, null on failure.
 */
async function uploadFile(
  localUri: string,
  bucket: string,
  path: string,
  contentType: string
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Missing env vars — skipping upload');
    return null;
  }
  try {
    // Read file as base64 then convert to Uint8Array (works on all Expo platforms)
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Decode base64 → Uint8Array
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

    const url = storageUrl(bucket, path);
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders({
        'Content-Type': contentType,
        'x-upsert': 'true',
      }),
      body: bytes,
    });

    if (!response.ok) {
      // Try PUT for upsert if POST fails (bucket policy differences)
      const putResponse = await fetch(url, {
        method: 'PUT',
        headers: authHeaders({
          'Content-Type': contentType,
          'x-upsert': 'true',
        }),
        body: bytes,
      });
      if (!putResponse.ok) {
        const text = await putResponse.text();
        throw new Error(`Upload failed: ${putResponse.status} ${text}`);
      }
    }

    const pub = publicUrl(bucket, path);
    console.log('[Supabase] Uploaded:', pub);
    return pub;
  } catch (err) {
    console.error(`[Supabase] Upload to ${bucket}/${path} failed:`, err);
    return null;
  }
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
 * Download a remote Supabase PDF URL to a local cache file and return the path.
 * Used when pdfUrl is a public Supabase URL and we need a local file to open/share.
 */
export async function downloadRemotePDF(
  url: string,
  filename: string
): Promise<string> {
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  try {
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists && (info.size ?? 0) > 1024) return dest;
  } catch {}

  const result = await FileSystem.downloadAsync(url, dest);
  if (!result.uri) throw new Error('Remote PDF download failed — no URI returned');
  return result.uri;
}
