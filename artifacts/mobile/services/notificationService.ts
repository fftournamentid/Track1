/**
 * Notification Service — future-ready interface for push notifications.
 * Integrate with Expo Notifications + Firebase Cloud Messaging when ready.
 */

export interface LocalNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  trigger?: { seconds: number } | { date: Date };
}

export interface NotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
}

export async function requestPermissions(): Promise<NotificationPermissionStatus> {
  // TODO: import * as Notifications from 'expo-notifications'
  // const { status, canAskAgain } = await Notifications.requestPermissionsAsync()
  return { granted: false, canAskAgain: true };
}

export async function scheduleLocalNotification(notification: LocalNotification): Promise<string> {
  // TODO: Use Notifications.scheduleNotificationAsync
  void notification;
  throw new Error('Notification service not connected. Configure expo-notifications first.');
}

export async function cancelNotification(id: string): Promise<void> {
  void id;
}

export async function cancelAllNotifications(): Promise<void> {}

export async function registerPushToken(): Promise<string | null> {
  // TODO: Use Notifications.getExpoPushTokenAsync
  return null;
}

// Reminder helpers (future features)
export async function scheduleInvoiceReminder(invoiceId: string, dueDate: Date): Promise<void> {
  void invoiceId;
  void dueDate;
}

export async function schedulePaymentReminder(clientName: string, amount: number): Promise<void> {
  void clientName;
  void amount;
}

export async function scheduleSubscriptionReminder(): Promise<void> {}
