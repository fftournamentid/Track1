import {
  collection,
  doc,
  addDoc,
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
  console.log('[Firestore][create] ✓ Auth verified — uid:', currentUser.uid);

  // ── Strip undefined values ───────────────────────────────────────────────────
  // Firestore throws on undefined values unless ignoreUndefinedProperties is set.
  // Strip them out here so optional fields (dueDate, clientPhone, etc.) are omitted.
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) sanitized[k] = v;
  }

  console.log('[Firestore][create] Creating invoice doc for uid:', uid, '| invoiceNumber:', data.invoiceNumber);

  const payload = {
    ...sanitized,
    userId: currentUser.uid,   // anchor doc to the authenticated token uid
    downloadCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    const ref = await addDoc(invoicesRef(uid), payload);
    console.log('[Firestore][create] ✓ Created doc with id:', ref.id);
    const now = new Date().toISOString();
    return { ...data, id: ref.id, downloadCount: 0, createdAt: now, updatedAt: now };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'permission-denied') {
      console.error(
        '[Firestore][create] ✗ PERMISSION_DENIED — Firestore rules rejected the write.',
        'uid:', uid,
        '| invoiceNumber:', data.invoiceNumber,
        '| err:', err,
      );
    } else {
      console.error('[Firestore][create] ✗ addDoc failed — code:', code, '| err:', err);
    }
    throw err;
  }
}

export async function updateInvoiceDoc(
  uid: string,
  invoiceId: string,
  updates: Partial<Invoice>
): Promise<void> {
  console.log('[Firestore][update] Updating invoice', invoiceId, 'for uid:', uid);
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
  } catch (err) {
    console.error('[Firestore][update] ✗ updateDoc failed:', err);
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
