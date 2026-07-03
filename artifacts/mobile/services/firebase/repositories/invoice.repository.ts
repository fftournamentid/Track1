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
import { db } from '../config';
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
  const q = query(invoicesRef(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const invoices = snap.docs.map((d) => toInvoice(d.id, d.data() as RawInvoice));
      callback(invoices);
    },
    (err) => onError?.(err)
  );
}

export async function createInvoiceDoc(
  uid: string,
  data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>
): Promise<Invoice> {
  const payload = {
    ...data,
    downloadCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(invoicesRef(uid), payload);
  const now = new Date().toISOString();
  return { ...data, id: ref.id, downloadCount: 0, createdAt: now, updatedAt: now };
}

export async function updateInvoiceDoc(
  uid: string,
  invoiceId: string,
  updates: Partial<Invoice>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = updates;

  // Replace undefined values with deleteField() so Firestore removes those fields.
  // Passing undefined to Firestore throws if ignoreUndefinedProperties is not set.
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    sanitized[k] = v === undefined ? deleteField() : v;
  }

  await updateDoc(doc(db, 'users', uid, 'invoices', invoiceId), {
    ...sanitized,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvoiceDoc(
  uid: string,
  invoiceId: string
): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'invoices', invoiceId));
}
