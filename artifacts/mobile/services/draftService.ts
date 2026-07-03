/**
 * Draft / auto-save service using AsyncStorage.
 *
 * DRAFT_KEY — persists form field values from the create/edit screen.
 *             Restored automatically when the user reopens the app mid-entry.
 *             Cleared only on explicit Save or "New Invoice".
 *
 * PREVIEW_KEY — transient invoice object written just before navigating to
 *               the preview screen.  Read once on preview screen mount.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExpenseItem } from '@/types';

export const DRAFT_KEY = 'invoice_form_draft_v1';
export const PREVIEW_KEY = 'invoice_preview_data_v1';

export interface FormDraft {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  clientGST: string;
  fromLocation: string;
  toLocation: string;
  truckNumber: string;
  driverName: string;
  advanceAmount: string;
  expenses: ExpenseItem[];
  paymentTerms: string;
  notes: string;
  selectedTemplateId: string;
  /** Present only when editing an existing invoice. */
  editId?: string;
  savedAt: string;
}

export async function saveDraft(data: Omit<FormDraft, 'savedAt'>): Promise<void> {
  try {
    const payload: FormDraft = { ...data, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[Draft] save failed:', err);
  }
}

export async function loadDraft(): Promise<FormDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FormDraft;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch (err) {
    console.warn('[Draft] clear failed:', err);
  }
}

/** Stores a full Invoice-shaped object for the preview screen to consume. */
export async function savePreviewData(data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(PREVIEW_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[Preview] save failed:', err);
  }
}

export async function loadPreviewData<T = unknown>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREVIEW_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function clearPreviewData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREVIEW_KEY);
  } catch {}
}
