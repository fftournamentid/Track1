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
  // Use only the equality filter (no compound orderBy) to avoid requiring a
  // composite Firestore index that may not be deployed. Sort client-side.
  return onSnapshot(
    query(collection(db, COL), where('active', '==', true)),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Announcement))
        .sort((a, b) => {
          // Pinned first
          const aPinned = a.isPinned ? 1 : 0;
          const bPinned = b.isPinned ? 1 : 0;
          if (aPinned !== bPinned) return bPinned - aPinned;
          // Then by priority (lower number = higher priority; missing → treated as 999)
          const aPri = typeof a.priority === 'number' ? a.priority : 999;
          const bPri = typeof b.priority === 'number' ? b.priority : 999;
          if (aPri !== bPri) return aPri - bPri;
          // Finally by createdAt descending (handles Firestore Timestamp, ISO string, or missing)
          const toSec = (v: unknown): number => {
            if (!v) return 0;
            if (typeof v === 'object' && v !== null && 'seconds' in v) {
              return (v as { seconds: number }).seconds;
            }
            if (typeof v === 'string') return new Date(v).getTime() / 1000;
            if (typeof v === 'number') return v;
            return 0;
          };
          return toSec(b.createdAt) - toSec(a.createdAt);
        });
      cb(list);
    },
    (err) => {
      console.warn('[AnnouncementService] subscribeToActiveAnnouncements error:', err);
      cb([]);
    }
  );
}

export async function createAnnouncement(
  data: { title: string; message: string; priority: number; active: boolean; isPinned?: boolean; isPopup?: boolean }
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    isPinned: data.isPinned ?? false,
    isPopup: data.isPopup ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAnnouncement(
  id: string,
  data: Partial<{ title: string; message: string; priority: number; active: boolean; isPinned: boolean; isPopup: boolean }>
): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function toggleAnnouncement(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, COL, id), { active, updatedAt: serverTimestamp() });
}
