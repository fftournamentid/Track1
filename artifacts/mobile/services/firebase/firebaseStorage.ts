/**
 * Firebase Storage service for PDF and image uploads.
 * Uses firebase/storage from the Firebase JS SDK (v9+ modular API).
 *
 * Paths:
 *   pdfs/{userId}/{filename}      — generated invoice PDFs
 *   logos/{userId}/logo.{ext}     — company logos
 *   signatures/{userId}/sig.{ext} — signature images
 *   logos/{userId}/profile.{ext}  — profile photos
 */
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';
import app from './config';

let _storage: ReturnType<typeof getStorage> | null = null;

function getStorageInstance() {
  if (!_storage) {
    _storage = getStorage(app);
  }
  return _storage;
}

/**
 * Decode a base64 string to Uint8Array using a pure-JS implementation.
 * This avoids relying on the global `atob` which is not guaranteed in all
 * React Native / Hermes versions and some server-side environments.
 */
function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/[\r\n]/g, '').replace(/=+$/, '');
  const bytes: number[] = [];
  let i = 0;
  while (i < clean.length) {
    const a = chars.indexOf(clean[i++]) ?? 0;
    const b = chars.indexOf(clean[i++]) ?? 0;
    const c = i <= clean.length ? chars.indexOf(clean[i++]) : -1;
    const d = i <= clean.length ? chars.indexOf(clean[i++]) : -1;
    const bitmap = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    bytes.push((bitmap >> 16) & 0xff);
    if (c >= 0) bytes.push((bitmap >> 8) & 0xff);
    if (d >= 0) bytes.push(bitmap & 0xff);
  }
  return new Uint8Array(bytes);
}

/**
 * Convert a local file URI to a Uint8Array using expo-file-system.
 * Uses a pure-JS base64 decoder for cross-platform reliability
 * (works in Hermes, JSC, and web without relying on global `atob`).
 */
async function readFileAsBytes(localUri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToBytes(base64);
}

/**
 * Upload a local PDF to Firebase Storage and return the download URL.
 * Path: pdfs/{userId}/{filename}
 * Returns public download URL on success, null on failure.
 */
export async function uploadPDFToFirebaseStorage(
  localUri: string,
  filename: string,
  userId: string,
): Promise<string | null> {
  console.log('[FirebaseStorage][PDF] Uploading:', filename, 'for user:', userId);
  try {
    const bytes = await readFileAsBytes(localUri);
    const storage = getStorageInstance();
    const storageRef = ref(storage, `pdfs/${userId}/${filename}`);
    const snapshot = await uploadBytes(storageRef, bytes, {
      contentType: 'application/pdf',
      customMetadata: { userId, filename },
    });
    const url = await getDownloadURL(snapshot.ref);
    console.log('[FirebaseStorage][PDF] ✓ Uploaded. URL:', url);
    return url;
  } catch (err) {
    console.error('[FirebaseStorage][PDF] ✗ Upload failed:', err);
    return null;
  }
}

/**
 * Upload a logo image to Firebase Storage.
 * Path: logos/{userId}/logo.{ext}
 */
export async function uploadLogoToFirebaseStorage(
  localUri: string,
  userId: string,
  mimeType = 'image/jpeg',
): Promise<string | null> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  console.log('[FirebaseStorage][Logo] Uploading for user:', userId);
  try {
    const bytes = await readFileAsBytes(localUri);
    const storage = getStorageInstance();
    const storageRef = ref(storage, `logos/${userId}/logo.${ext}`);
    const snapshot = await uploadBytes(storageRef, bytes, { contentType: mimeType });
    const url = await getDownloadURL(snapshot.ref);
    console.log('[FirebaseStorage][Logo] ✓ Uploaded. URL:', url);
    return url;
  } catch (err) {
    console.error('[FirebaseStorage][Logo] ✗ Upload failed:', err);
    return null;
  }
}

/**
 * Upload a signature image to Firebase Storage.
 * Path: signatures/{userId}/sig.{ext}
 */
export async function uploadSignatureToFirebaseStorage(
  localUri: string,
  userId: string,
  mimeType = 'image/jpeg',
): Promise<string | null> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  console.log('[FirebaseStorage][Sig] Uploading for user:', userId);
  try {
    const bytes = await readFileAsBytes(localUri);
    const storage = getStorageInstance();
    const storageRef = ref(storage, `signatures/${userId}/sig.${ext}`);
    const snapshot = await uploadBytes(storageRef, bytes, { contentType: mimeType });
    const url = await getDownloadURL(snapshot.ref);
    console.log('[FirebaseStorage][Sig] ✓ Uploaded. URL:', url);
    return url;
  } catch (err) {
    console.error('[FirebaseStorage][Sig] ✗ Upload failed:', err);
    return null;
  }
}

// ─── Cloud PDF Listing ────────────────────────────────────────────────────────

export interface CloudStoredPDF {
  /** Original filename, e.g. "Invoice_INV001_classic.pdf" */
  name: string;
  /** Full storage path, e.g. "pdfs/{uid}/Invoice_INV001_classic.pdf" */
  fullPath: string;
  /** Firebase Storage download URL */
  url: string;
}

/**
 * List all PDFs stored in Firebase Storage for a given user.
 * Path: pdfs/{userId}/
 * Returns an empty array on error (e.g. no internet, permission denied).
 */
export async function listUserPDFsFromFirebaseStorage(
  userId: string,
): Promise<CloudStoredPDF[]> {
  console.log('[FirebaseStorage][List] Listing PDFs for user:', userId);
  try {
    const storage = getStorageInstance();
    const folderRef = ref(storage, `pdfs/${userId}`);
    const listResult = await listAll(folderRef);
    if (listResult.items.length === 0) return [];

    const results = await Promise.allSettled(
      listResult.items.map(async (item) => {
        const url = await getDownloadURL(item);
        return { name: item.name, fullPath: item.fullPath, url } as CloudStoredPDF;
      }),
    );
    const pdfs = results
      .filter((r): r is PromiseFulfilledResult<CloudStoredPDF> => r.status === 'fulfilled')
      .map((r) => r.value);
    console.log('[FirebaseStorage][List] Found', pdfs.length, 'PDF(s)');
    return pdfs;
  } catch (err) {
    console.error('[FirebaseStorage][List] Failed — returning empty:', err);
    return [];
  }
}

/**
 * Upload a profile photo to Firebase Storage.
 * Path: logos/{userId}/profile.{ext}
 */
export async function uploadProfilePhotoToFirebaseStorage(
  localUri: string,
  userId: string,
  mimeType = 'image/jpeg',
): Promise<string | null> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  console.log('[FirebaseStorage][Profile] Uploading for user:', userId);
  try {
    const bytes = await readFileAsBytes(localUri);
    const storage = getStorageInstance();
    const storageRef = ref(storage, `logos/${userId}/profile.${ext}`);
    const snapshot = await uploadBytes(storageRef, bytes, { contentType: mimeType });
    const url = await getDownloadURL(snapshot.ref);
    console.log('[FirebaseStorage][Profile] ✓ Uploaded. URL:', url);
    return url;
  } catch (err) {
    console.error('[FirebaseStorage][Profile] ✗ Upload failed:', err);
    return null;
  }
}
