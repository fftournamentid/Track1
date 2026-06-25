/**
 * Analytics Service — future-ready interface for tracking and reporting.
 * Integrate with Firebase Analytics, Mixpanel, or a custom backend when ready.
 */

export type AnalyticsEvent =
  | 'invoice_created'
  | 'invoice_deleted'
  | 'invoice_duplicated'
  | 'invoice_archived'
  | 'invoice_restored'
  | 'pdf_generated'
  | 'pdf_shared'
  | 'pdf_whatsapp'
  | 'profile_updated'
  | 'app_opened'
  | 'search_performed'
  | 'sort_changed'
  | 'filter_changed';

export interface AnalyticsProperties {
  invoiceId?: string;
  invoiceStatus?: string;
  currency?: string;
  gstRate?: number;
  itemCount?: number;
  totalAmount?: number;
  searchQuery?: string;
  sortField?: string;
  filterStatus?: string;
}

let _enabled = true;

export function setAnalyticsEnabled(enabled: boolean): void {
  _enabled = enabled;
}

export function trackEvent(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  if (!_enabled) return;
  // TODO: Replace with real analytics provider
  // e.g. Firebase.logEvent(event, properties)
  // e.g. Mixpanel.track(event, properties)
  if (__DEV__) {
    console.log('[Analytics]', event, properties);
  }
}

export function setUserId(userId: string): void {
  if (!_enabled) return;
  // TODO: Set user identity in analytics provider
  void userId;
}

export function setUserProperties(properties: Record<string, string | number | boolean>): void {
  if (!_enabled) return;
  // TODO: Set user properties in analytics provider
  void properties;
}

export function logScreenView(screenName: string): void {
  if (!_enabled) return;
  // TODO: Log screen view in analytics provider
  void screenName;
}
