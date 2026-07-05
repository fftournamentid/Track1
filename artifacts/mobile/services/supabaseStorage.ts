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
    console.warn(`[Supabase] Skipping upload of ${bucket}/${path} — env vars not configured`);
    return null;
  }

  console.log(`[Supabase] Uploading ${bucket}/${path} from:`, localUri);

  try {
    // Read file as base64 then convert to Uint8Array (works on all Expo platforms)
    console.log('[Supabase] Reading file as base64...');
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[Supabase] base64 length:', base64.length, 'chars');

    // Decode base64 → Uint8Array
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    console.log('[Supabase] Decoded to Uint8Array,', bytes.length, 'bytes');

    const url = storageUrl(bucket, path);
    console.log('[Supabase] POST', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders({
        'Content-Type': contentType,
        'x-upsert': 'true',
      }),
      body: bytes,
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
      body: bytes,
    });

    console.log('[Supabase] PUT response status:', putResponse.status);

    if (!putResponse.ok) {
      const putText = await putResponse.text();
      throw new Error(`Upload failed. POST ${response.status}: ${postText} | PUT ${putResponse.status}: ${putText}`);
    }

    const pub = publicUrl(bucket, path);
    console.log('[Supabase] ✓ PUT upload succeeded. Public URL:', pub);
    return pub;
  } catch (err) {
    console.error(`[Supabase] ✗ Upload to ${bucket}/${path} failed:`, err);
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
