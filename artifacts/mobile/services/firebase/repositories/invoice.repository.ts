import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
  type Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../config';
import type { Invoice } from '@/types';

type RawInvoice = Omit<Invoice, 'createdAt' | 'updatedAt'> & {
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

function toInvoice(id: string, raw: RawInvoice): Invoice {
  return {
    ...raw,
    id,
    createdAt: raw.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
    updatedAt: raw.updatedAt?.toDate().toISOString() ?? new Date().toISOString(),
  };
}

function invoicesRef(uid: string) {
  return collection(db, 'users', uid, 'invoices');
}

export function subscribeToInvoices(
  uid: string,
  callback: (invoices: Invoice[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  console.log('[Firestore][subscribe] Subscribing to invoices for uid:', uid);
  const q = query(invoicesRef(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      console.log('[Firestore][subscribe] Snapshot received —', snap.docs.length, 'docs');
      const invoices = snap.docs.map((d) => toInvoice(d.id, d.data() as RawInvoice));
      callback(invoices);
    },
    (err) => {
      console.error('[Firestore][subscribe] ✗ Snapshot error:', err.code, err.message);
      onError?.(err);
    }
  );
}

export async function createInvoiceDoc(
  uid: string,
  data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>
): Promise<Invoice> {

  // ── Auth guard: verify Firebase Auth state before touching Firestore ────────
  // Firestore security rules reject writes from unauthenticated callers with a
  // PERMISSION_DENIED error. Checking auth.currentUser here gives a clear,
  // actionable error message before the round-trip ever leaves the device.
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const msg = '[Firestore][create] ✗ User is not authenticated — cannot write invoice document. Please sign in and retry.';
    console.error(msg);
    throw new Error(msg);
  }
  if (currentUser.uid !== uid) {
    const msg = `[Firestore][create] ✗ UID mismatch — auth token uid="${currentUser.uid}" does not match requested uid="${uid}". Aborting write.`;
    console.error(msg);
    throw new Error(msg);
  }
  // ── Force token refresh ─────────────────────────────────────────────────────
  // auth.currentUser is a cached JS object — the underlying ID token can expire
  // (Firebase tokens last 1 hour). Firestore receives the wire token, so a
  // stale token causes PERMISSION_DENIED even when currentUser looks valid.
  // Calling getIdToken(false) returns the cached token if still fresh, or
  // silently fetches a new one if it has expired — no round-trip when unnecessary.
  try {
    await currentUser.getIdToken(/* forceRefresh */ false);
    console.log('[Firestore][create] ✓ Auth token confirmed fresh — uid:', currentUser.uid);
  } catch (tokenErr) {
    const msg = `[Firestore][create] ✗ Failed to refresh auth token — user may need to sign in again. Error: ${tokenErr}`;
    console.error(msg);
    throw new Error(msg);
  }

  // ── Strip undefined values ───────────────────────────────────────────────────
  // Firestore throws on undefined values unless ignoreUndefinedProperties is set.
  // Strip them out here so optional fields (dueDate, clientPhone, etc.) are omitted.
  // Also recursively strip from nested objects (e.g. businessSnapshot fields).
  function stripUndefined(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(stripUndefined);
    if (obj !== null && typeof obj === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (v !== undefined) out[k] = stripUndefined(v);
      }
      return out;
    }
    return obj;
  }

  const sanitized = stripUndefined(data) as Record<string, unknown>;

  console.log('[Firestore][create] Creating invoice doc — uid:', uid, '| invoiceNumber:', data.invoiceNumber);

  const payload = {
    ...sanitized,
    userId: currentUser.uid,   // explicitly anchor to the authenticated token uid
    downloadCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // ── Full diagnostic trace ────────────────────────────────────────────────────
  // Logs the exact document path, authenticated UID, and complete serialized
  // payload so any Firestore rules rejection can be diagnosed from Metro logs.
  const tracePath = `users/${uid}/invoices`;
  console.log(
    '[Firestore][create] TRACE\n' +
    '  path    : ' + tracePath + '\n' +
    '  auth uid: ' + currentUser.uid + '\n' +
    '  payload : ' + JSON.stringify(
      payload,
      (_key, val) => (val === undefined ? '(undefined)' : val),
    ),
  );

  try {
    const ref = await addDoc(invoicesRef(uid), payload);
    console.log('[Firestore][create] ✓ addDoc succeeded — doc id:', ref.id, '| path:', tracePath + '/' + ref.id);
    const now = new Date().toISOString();
    return { ...data, id: ref.id, downloadCount: 0, createdAt: now, updatedAt: now };
  } catch (err: unknown) {
    const firestoreErr = err as { code?: string; message?: string };
    const code = firestoreErr?.code ?? '(no code)';
    const message = firestoreErr?.message ?? String(err);
    // Serialize all own properties so nothing is hidden by JSON.stringify's
    // default behaviour of omitting non-enumerable Error fields.
    const fullErr = JSON.stringify(err, Object.getOwnPropertyNames(err as object));
    if (code === 'permission-denied') {
      console.error(
        '[Firestore][create] ✗ PERMISSION_DENIED\n' +
        '  path             : ' + tracePath + '\n' +
        '  auth uid at write: ' + currentUser.uid + '\n' +
        '  LIKELY CAUSE     : Firestore security rules not deployed to Firebase.\n' +
        '                     Run: firebase deploy --only firestore:rules\n' +
        '  full error       : ' + fullErr,
      );
    } else {
      console.error(
        '[Firestore][create] ✗ addDoc failed\n' +
        '  code : ' + code + '\n' +
        '  msg  : ' + message + '\n' +
        '  full : ' + fullErr,
      );
    }
    throw err;
  }
}

/**
 * Create or update an invoice doc at a CALLER-CHOSEN id (uses `setDoc`, not
 * `addDoc`). This lets the local-first write path use the same id on-device
 * and in Firestore from the very first save — no id-swap after sync, so the
 * app never has to rewrite in-memory state or break an in-flight navigation
 * route just because the background cloud sync completed.
 */
export async function setInvoiceDoc(
  uid: string,
  id: string,
  data: Partial<Invoice>,
  isNew: boolean,
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('[Firestore][set] ✗ User is not authenticated — cannot write invoice document.');
  }
  if (currentUser.uid !== uid) {
    throw new Error(`[Firestore][set] ✗ UID mismatch — token uid="${currentUser.uid}" !== requested uid="${uid}".`);
  }
  await currentUser.getIdToken(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt: _ca, updatedAt: _ua, downloadCount: _dc, pendingSync: _ps, ...rest } = data;

  function stripUndefined(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(stripUndefined);
    if (obj !== null && typeof obj === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (v !== undefined) out[k] = stripUndefined(v);
      }
      return out;
    }
    return obj;
  }

  const payload: Record<string, unknown> = {
    ...(stripUndefined(rest) as Record<string, unknown>),
    userId: currentUser.uid,
    updatedAt: serverTimestamp(),
  };
  if (isNew) {
    payload.createdAt = serverTimestamp();
    payload.downloadCount = data.downloadCount ?? 0;
  }

  try {
    await setDoc(doc(db, 'users', uid, 'invoices', id), payload, { merge: true });
    console.log('[Firestore][set] ✓ setDoc succeeded — id:', id, '| isNew:', isNew);
  } catch (err: unknown) {
    const firestoreErr = err as { code?: string; message?: string };
    console.error('[Firestore][set] ✗ setDoc failed — code:', firestoreErr?.code, '| message:', firestoreErr?.message);
    throw err;
  }
}

export async function updateInvoiceDoc(
  uid: string,
  invoiceId: string,
  updates: Partial<Invoice>
): Promise<void> {
  // ── Auth guard ───────────────────────────────────────────────────────────────
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const msg = '[Firestore][update] ✗ User is not authenticated — cannot update invoice document.';
    console.error(msg);
    throw new Error(msg);
  }
  if (currentUser.uid !== uid) {
    const msg = `[Firestore][update] ✗ UID mismatch — token uid="${currentUser.uid}" !== requested uid="${uid}". Aborting update.`;
    console.error(msg);
    throw new Error(msg);
  }

  // Ensure token is fresh before the write
  try {
    await currentUser.getIdToken(false);
  } catch (tokenErr) {
    const msg = `[Firestore][update] ✗ Failed to refresh auth token: ${tokenErr}`;
    console.error(msg);
    throw new Error(msg);
  }

  console.log('[Firestore][update] ✓ Auth verified — updating invoice', invoiceId, 'for uid:', uid);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = updates;

  // Replace undefined values with deleteField() so Firestore removes those fields.
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    sanitized[k] = v === undefined ? deleteField() : v;
  }

  try {
    await updateDoc(doc(db, 'users', uid, 'invoices', invoiceId), {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });
    console.log('[Firestore][update] ✓ Updated invoice', invoiceId);
  } catch (err: unknown) {
    const firestoreErr = err as { code?: string; message?: string };
    const code = firestoreErr?.code ?? '(no code)';
    const message = firestoreErr?.message ?? String(err);
    if (code === 'permission-denied') {
      console.error(
        '[Firestore][update] ✗ PERMISSION_DENIED — Firestore security rules rejected the update.\n' +
        '  Path: users/' + uid + '/invoices/' + invoiceId + '\n' +
        '  auth.currentUser.uid at write time: ' + currentUser.uid + '\n' +
        '  Full error: ' + message,
      );
    } else {
      console.error('[Firestore][update] ✗ updateDoc failed — code:', code, '| message:', message);
    }
    throw err;
  }
}

export async function deleteInvoiceDoc(
  uid: string,
  invoiceId: string
): Promise<void> {
  console.log('[Firestore][delete] Deleting invoice', invoiceId, 'for uid:', uid);
  try {
    await deleteDoc(doc(db, 'users', uid, 'invoices', invoiceId));
    console.log('[Firestore][delete] ✓ Deleted invoice', invoiceId);
  } catch (err) {
    console.error('[Firestore][delete] ✗ deleteDoc failed:', err);
    throw err;
  }
}
