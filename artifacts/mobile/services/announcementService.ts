import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import type { Announcement } from '@/types';

const COL = 'announcements';

export function subscribeToAllAnnouncements(cb: (list: Announcement[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, COL), orderBy('priority'), orderBy('createdAt', 'desc')),
    (snap) =>
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement))),
    () => cb([])
  );
}

export function subscribeToActiveAnnouncements(cb: (list: Announcement[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, COL), where('active', '==', true), orderBy('priority'), orderBy('createdAt', 'desc')),
    (snap) =>
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement))),
    () => cb([])
  );
}

export async function createAnnouncement(
  data: { title: string; message: string; priority: number; active: boolean }
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAnnouncement(
  id: string,
  data: Partial<{ title: string; message: string; priority: number; active: boolean }>
): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function toggleAnnouncement(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, COL, id), { active, updatedAt: serverTimestamp() });
}
