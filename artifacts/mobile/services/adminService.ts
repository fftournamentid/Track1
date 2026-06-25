/**
 * Admin Service — future-ready interfaces for the Admin Panel backend.
 * All methods are stubbed to throw "not implemented" until a real API is wired.
 * Replace each stub with the corresponding API call (REST or Firebase) when ready.
 */

import type {
  AdminUser,
  PremiumPlan,
  InvoiceTemplate,
  AppBanner,
  PushNotificationPayload,
  UserFeedback,
  AnalyticsSnapshot,
} from '@/types';

const NOT_IMPLEMENTED = 'Admin API not connected. Wire adminService to your backend.';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getAnalytics(): Promise<AnalyticsSnapshot> {
  throw new Error(NOT_IMPLEMENTED);
}

// ─── User Management ─────────────────────────────────────────────────────────

export async function getUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  isPremium?: boolean;
  status?: 'active' | 'suspended';
}): Promise<{ users: AdminUser[]; total: number }> {
  void params;
  throw new Error(NOT_IMPLEMENTED);
}

export async function getUserById(userId: string): Promise<AdminUser> {
  void userId;
  throw new Error(NOT_IMPLEMENTED);
}

export async function suspendUser(userId: string): Promise<void> {
  void userId;
  throw new Error(NOT_IMPLEMENTED);
}

export async function unsuspendUser(userId: string): Promise<void> {
  void userId;
  throw new Error(NOT_IMPLEMENTED);
}

export async function deleteUser(userId: string): Promise<void> {
  void userId;
  throw new Error(NOT_IMPLEMENTED);
}

export async function grantPremium(userId: string, planId: string): Promise<void> {
  void userId;
  void planId;
  throw new Error(NOT_IMPLEMENTED);
}

export async function revokePremium(userId: string): Promise<void> {
  void userId;
  throw new Error(NOT_IMPLEMENTED);
}

// ─── Premium Plan Management ──────────────────────────────────────────────────

export async function getPlans(): Promise<PremiumPlan[]> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function createPlan(plan: Omit<PremiumPlan, 'id'>): Promise<PremiumPlan> {
  void plan;
  throw new Error(NOT_IMPLEMENTED);
}

export async function updatePlan(id: string, updates: Partial<PremiumPlan>): Promise<PremiumPlan> {
  void id;
  void updates;
  throw new Error(NOT_IMPLEMENTED);
}

export async function deletePlan(id: string): Promise<void> {
  void id;
  throw new Error(NOT_IMPLEMENTED);
}

// ─── Invoice Template Management ─────────────────────────────────────────────

export async function getTemplates(): Promise<InvoiceTemplate[]> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function createTemplate(
  template: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<InvoiceTemplate> {
  void template;
  throw new Error(NOT_IMPLEMENTED);
}

export async function updateTemplate(
  id: string,
  updates: Partial<InvoiceTemplate>
): Promise<InvoiceTemplate> {
  void id;
  void updates;
  throw new Error(NOT_IMPLEMENTED);
}

export async function deleteTemplate(id: string): Promise<void> {
  void id;
  throw new Error(NOT_IMPLEMENTED);
}

export async function publishTemplate(id: string): Promise<void> {
  void id;
  throw new Error(NOT_IMPLEMENTED);
}

export async function unpublishTemplate(id: string): Promise<void> {
  void id;
  throw new Error(NOT_IMPLEMENTED);
}

// ─── Banner Management ────────────────────────────────────────────────────────

export async function getBanners(): Promise<AppBanner[]> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function createBanner(banner: Omit<AppBanner, 'id' | 'createdAt'>): Promise<AppBanner> {
  void banner;
  throw new Error(NOT_IMPLEMENTED);
}

export async function updateBanner(id: string, updates: Partial<AppBanner>): Promise<AppBanner> {
  void id;
  void updates;
  throw new Error(NOT_IMPLEMENTED);
}

export async function deleteBanner(id: string): Promise<void> {
  void id;
  throw new Error(NOT_IMPLEMENTED);
}

// ─── Push Notifications ───────────────────────────────────────────────────────

export async function sendNotification(payload: Omit<PushNotificationPayload, 'id' | 'sentAt'>): Promise<void> {
  void payload;
  throw new Error(NOT_IMPLEMENTED);
}

export async function getNotificationHistory(): Promise<PushNotificationPayload[]> {
  throw new Error(NOT_IMPLEMENTED);
}

// ─── Feedback & Support ───────────────────────────────────────────────────────

export async function getFeedback(params?: {
  type?: UserFeedback['type'];
  status?: UserFeedback['status'];
}): Promise<UserFeedback[]> {
  void params;
  throw new Error(NOT_IMPLEMENTED);
}

export async function replyToFeedback(id: string, reply: string): Promise<void> {
  void id;
  void reply;
  throw new Error(NOT_IMPLEMENTED);
}

export async function resolveFeedback(id: string): Promise<void> {
  void id;
  throw new Error(NOT_IMPLEMENTED);
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
  throw new Error(NOT_IMPLEMENTED);
}

export async function updateRemoteSettings(settings: Record<string, unknown>): Promise<void> {
  void settings;
  throw new Error(NOT_IMPLEMENTED);
}
