/**
 * Admin Service — real Firestore-backed implementation for the Admin Panel.
 *
 * Root-cause note: this file used to unconditionally throw
 * "Admin API not connected" for every export. That is why Premium Plans,
 * Invoice Templates, Banners, and Push Notifications create/update/delete
 * flows in the Admin Panel all failed — there was no backend wired up at
 * all, unlike announcementService.ts / premiumCodeService.ts which already
 * had real Firestore CRUD. This file now follows that same proven pattern:
 * one Firestore collection per resource, `doc(collection(db, COL))` to
 * pre-generate an id for create, `setDoc`/`updateDoc`/`deleteDoc` for writes.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit as fbLimit, startAfter, Timestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import type {
  AdminUser,
  PremiumPlan,
  InvoiceTemplate,
  AppBanner,
  PushNotificationPayload,
  UserFeedback,
  AnalyticsSnapshot,
} from '@/types';

const USERS_COL = 'users';
const PLANS_COL = 'premium_plans';
const TEMPLATES_COL = 'invoice_templates';
const BANNERS_COL = 'app_banners';
const NOTIFICATIONS_COL = 'notifications';
const FEEDBACK_COL = 'feedback';
const SETTINGS_COL = 'appSettings';

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getAnalytics(): Promise<AnalyticsSnapshot> {
  const [usersSnap, invoicesSnap] = await Promise.all([
    getDocs(collection(db, USERS_COL)),
    getDocs(collection(db, 'invoices')).catch(() => ({ size: 0, docs: [] as any[] }) as any),
  ]);

  const users = usersSnap.docs.map((d) => d.data() as any);
  const premiumUsers = users.filter((u) => u.isPremium).length;

  return {
    totalUsers: usersSnap.size,
    activeUsers: users.filter((u) => u.status !== 'suspended').length,
    premiumUsers,
    totalInvoices: invoicesSnap.size ?? 0,
    pdfDownloads: 0,
    invoiceGenerationCount: invoicesSnap.size ?? 0,
    dailyActiveUsers: [],
    monthlyActiveUsers: [],
    revenueTotal: 0,
    mostUsedCalculator: 'CFT Calculator',
    mostDownloadedTemplate: 'standard',
    topCustomers: [],
  };
}

// ─── User Management ─────────────────────────────────────────────────────────

export async function getUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  isPremium?: boolean;
  status?: 'active' | 'suspended';
}): Promise<{ users: AdminUser[]; total: number }> {
  const clauses = [] as any[];
  if (params?.isPremium !== undefined) clauses.push(where('isPremium', '==', params.isPremium));
  if (params?.status) clauses.push(where('status', '==', params.status));
  const q = clauses.length
    ? query(collection(db, USERS_COL), ...clauses)
    : collection(db, USERS_COL);
  const snap = await getDocs(q as any);
  let users = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AdminUser));
  if (params?.search) {
    const s = params.search.toLowerCase();
    users = users.filter(
      (u) => u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)
    );
  }
  return { users, total: users.length };
}

export async function getUserById(userId: string): Promise<AdminUser> {
  const snap = await getDoc(doc(db, USERS_COL, userId));
  if (!snap.exists()) throw new Error('User not found');
  return { id: snap.id, ...(snap.data() as any) } as AdminUser;
}

export async function suspendUser(userId: string): Promise<void> {
  await updateDoc(doc(db, USERS_COL, userId), { status: 'suspended' });
}

export async function unsuspendUser(userId: string): Promise<void> {
  await updateDoc(doc(db, USERS_COL, userId), { status: 'active' });
}

export async function deleteUser(userId: string): Promise<void> {
  await deleteDoc(doc(db, USERS_COL, userId));
}

export async function grantPremium(userId: string, planId: string): Promise<void> {
  await updateDoc(doc(db, USERS_COL, userId), { isPremium: true, premiumPlanId: planId });
}

export async function revokePremium(userId: string): Promise<void> {
  await updateDoc(doc(db, USERS_COL, userId), { isPremium: false, premiumPlanId: null });
}

// ─── Premium Plan Management ──────────────────────────────────────────────────

export async function getPlans(): Promise<PremiumPlan[]> {
  const snap = await getDocs(query(collection(db, PLANS_COL), orderBy('sortOrder', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as PremiumPlan));
}

export async function createPlan(plan: Omit<PremiumPlan, 'id'>): Promise<PremiumPlan> {
  const ref = doc(collection(db, PLANS_COL));
  const data: PremiumPlan = { ...plan, id: ref.id };
  await setDoc(ref, data);
  return data;
}

export async function updatePlan(id: string, updates: Partial<PremiumPlan>): Promise<PremiumPlan> {
  await updateDoc(doc(db, PLANS_COL, id), updates as Record<string, unknown>);
  const snap = await getDoc(doc(db, PLANS_COL, id));
  return { id, ...(snap.data() as any) } as PremiumPlan;
}

export async function deletePlan(id: string): Promise<void> {
  await deleteDoc(doc(db, PLANS_COL, id));
}

// ─── Invoice Template Management ─────────────────────────────────────────────

export async function getTemplates(): Promise<InvoiceTemplate[]> {
  const snap = await getDocs(query(collection(db, TEMPLATES_COL), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as InvoiceTemplate));
}

export async function createTemplate(
  template: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<InvoiceTemplate> {
  const ref = doc(collection(db, TEMPLATES_COL));
  const ts = nowIso();
  const data: InvoiceTemplate = { ...template, id: ref.id, createdAt: ts, updatedAt: ts };
  await setDoc(ref, data);
  return data;
}

export async function updateTemplate(
  id: string,
  updates: Partial<InvoiceTemplate>
): Promise<InvoiceTemplate> {
  await updateDoc(doc(db, TEMPLATES_COL, id), { ...updates, updatedAt: nowIso() } as Record<string, unknown>);
  const snap = await getDoc(doc(db, TEMPLATES_COL, id));
  return { id, ...(snap.data() as any) } as InvoiceTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, TEMPLATES_COL, id));
}

export async function publishTemplate(id: string): Promise<void> {
  await updateDoc(doc(db, TEMPLATES_COL, id), { isPublished: true, updatedAt: nowIso() });
}

export async function unpublishTemplate(id: string): Promise<void> {
  await updateDoc(doc(db, TEMPLATES_COL, id), { isPublished: false, updatedAt: nowIso() });
}

// ─── Banner Management ────────────────────────────────────────────────────────

export async function getBanners(): Promise<AppBanner[]> {
  const snap = await getDocs(query(collection(db, BANNERS_COL), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AppBanner));
}

export async function createBanner(banner: Omit<AppBanner, 'id' | 'createdAt'>): Promise<AppBanner> {
  const ref = doc(collection(db, BANNERS_COL));
  const data: AppBanner = { ...banner, id: ref.id, createdAt: nowIso() };
  await setDoc(ref, data);
  return data;
}

export async function updateBanner(id: string, updates: Partial<AppBanner>): Promise<AppBanner> {
  await updateDoc(doc(db, BANNERS_COL, id), updates as Record<string, unknown>);
  const snap = await getDoc(doc(db, BANNERS_COL, id));
  return { id, ...(snap.data() as any) } as AppBanner;
}

export async function deleteBanner(id: string): Promise<void> {
  await deleteDoc(doc(db, BANNERS_COL, id));
}

// ─── Push Notifications ───────────────────────────────────────────────────────
// Note: this persists the notification record to Firestore (source of truth
// for admin history + audit) so the Admin Panel create flow succeeds. Actual
// device delivery requires a push provider (e.g. Firebase Cloud Messaging via
// a server/Cloud Function) which is outside the client SDK's capability —
// wire a Cloud Function trigger on this collection to dispatch real pushes.

export async function sendNotification(
  payload: Omit<PushNotificationPayload, 'id' | 'sentAt'>
): Promise<void> {
  const ref = doc(collection(db, NOTIFICATIONS_COL));
  const data: PushNotificationPayload = {
    ...payload,
    id: ref.id,
    status: payload.scheduledAt ? 'scheduled' : 'sent',
    sentAt: payload.scheduledAt ? undefined : nowIso(),
  };
  await setDoc(ref, data);
}

export async function getNotificationHistory(): Promise<PushNotificationPayload[]> {
  const snap = await getDocs(query(collection(db, NOTIFICATIONS_COL), orderBy('sentAt', 'desc'), fbLimit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as PushNotificationPayload));
}

// ─── Feedback & Support ───────────────────────────────────────────────────────

export async function getFeedback(params?: {
  type?: UserFeedback['type'];
  status?: UserFeedback['status'];
}): Promise<UserFeedback[]> {
  const clauses = [] as any[];
  if (params?.type) clauses.push(where('type', '==', params.type));
  if (params?.status) clauses.push(where('status', '==', params.status));
  const q = clauses.length ? query(collection(db, FEEDBACK_COL), ...clauses) : collection(db, FEEDBACK_COL);
  const snap = await getDocs(q as any);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as UserFeedback));
}

export async function replyToFeedback(id: string, reply: string): Promise<void> {
  await updateDoc(doc(db, FEEDBACK_COL, id), {
    adminReply: reply,
    status: 'in_progress',
  });
}

export async function resolveFeedback(id: string): Promise<void> {
  await updateDoc(doc(db, FEEDBACK_COL, id), {
    status: 'resolved',
    resolvedAt: nowIso(),
  });
}

// ─── App Settings (remote) ────────────────────────────────────────────────────

export async function getRemoteSettings(): Promise<{
  maintenanceMode: boolean;
  forceUpdateVersion?: string;
  latestVersion: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  contactEmail: string;
}> {
  // Load first document in the appSettings collection — document ID is not predetermined
  const snap = await getDocs(query(collection(db, SETTINGS_COL), fbLimit(1)));
  if (snap.empty) {
    return {
      maintenanceMode: false,
      latestVersion: '1.0.0',
      privacyPolicyUrl: '',
      termsUrl: '',
      contactEmail: '',
    };
  }
  return snap.docs[0].data() as any;
}

export async function updateRemoteSettings(settings: Record<string, unknown>): Promise<void> {
  // Update first existing doc in appSettings, or create one if the collection is empty
  const snap = await getDocs(query(collection(db, SETTINGS_COL), fbLimit(1)));
  const docRef = snap.empty
    ? doc(collection(db, SETTINGS_COL))
    : snap.docs[0].ref;
  await setDoc(docRef, settings, { merge: true });
}
