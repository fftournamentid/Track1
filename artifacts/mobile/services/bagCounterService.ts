import {
  collection, doc, addDoc, writeBatch, getDoc, setDoc,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import type { BagScan, BagScanSide } from '@/types';

const SESSIONS_COL = 'bagSessions';
const SCANS_COL = 'bagScans';
const HISTORY_COL = 'bagHistory';
const USAGE_COL = 'aiUsage';
const SETTINGS_COL = 'aiSettings';

/** Resolves the API base URL for the api-server artifact (path-routed at /api on the same domain). */
function apiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  // Web preview inside the same Replit iframe — relative path works because
  // the dev proxy serves both the app and /api from the same origin.
  return '/api';
}

export type AnalyzeErrorKind = 'network' | 'ai_failed' | 'unknown';

export class AnalyzeError extends Error {
  kind: AnalyzeErrorKind;
  constructor(kind: AnalyzeErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface AnalyzeResult {
  totalBags: number;
  confidence: number;
  side: BagScanSide;
  scanTimeMs: number;
}

/**
 * Sends a compressed, base64-encoded image to the api-server's Gemini proxy.
 * The image itself is never persisted anywhere — only the returned count and
 * confidence are ever saved (see saveBagScan / saveBagSession below).
 */
export async function analyzeBagImage(
  base64: string,
  mimeType: string,
  side: BagScanSide,
  bagType?: string
): Promise<AnalyzeResult> {
  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    response = await fetch(`${apiBaseUrl()}/bag-counter/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mimeType, side, bagType }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    throw new AnalyzeError('network', 'Could not reach the AI service. Check your connection and try again.');
  }

  if (!response.ok) {
    let message = 'AI failed to analyze the image.';
    try {
      const body = await response.json();
      if (typeof body?.message === 'string') message = body.message;
    } catch {
      // ignore body parse failure — use default message
    }
    const kind: AnalyzeErrorKind = response.status === 503 ? 'network' : 'ai_failed';
    throw new AnalyzeError(kind, message);
  }

  const data = await response.json();
  return {
    totalBags: Number(data.totalBags) || 0,
    confidence: Number(data.confidence) || 0,
    side,
    scanTimeMs: Number(data.scanTimeMs) || 0,
  };
}

/** Increments today's AI usage counter for the user — used for basic quota/analytics visibility. */
export async function recordAiUsage(userId: string): Promise<void> {
  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  const ref = doc(db, USAGE_COL, `${userId}_${monthKey}`);
  try {
    await setDoc(
      ref,
      {
        userId,
        month: monthKey,
        scanCount: increment(1),
        lastUsedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // Usage tracking must never block the actual scan flow.
    console.warn('[bagCounterService] recordAiUsage failed:', err);
  }
}

export interface SessionInput {
  userId: string;
  productName?: string;
  truckNumber?: string;
  customerName?: string;
  notes?: string;
  scans: Array<{ side: BagScanSide; aiCount: number; confidence: number; scanTimeMs: number }>;
  manualAdjustment: number;
}

export interface SavedSession {
  sessionId: string;
  totalBags: number;
  finalTotal: number;
  totalImages: number;
  averageConfidence: number;
}

/** Persists the finished session + its per-scan results. No image data is ever included. */
export async function saveBagSession(input: SessionInput): Promise<SavedSession> {
  const totalBags = input.scans.reduce((sum, s) => sum + s.aiCount, 0);
  const totalImages = input.scans.length;
  const averageConfidence = totalImages > 0
    ? Math.round(input.scans.reduce((sum, s) => sum + s.confidence, 0) / totalImages)
    : 0;
  const finalTotal = Math.max(0, totalBags + input.manualAdjustment);

  const sessionRef = doc(collection(db, SESSIONS_COL));
  const batch = writeBatch(db);

  batch.set(sessionRef, {
    userId: input.userId,
    productName: input.productName || '',
    truckNumber: input.truckNumber || '',
    customerName: input.customerName || '',
    notes: input.notes || '',
    totalBags,
    manualAdjustment: input.manualAdjustment,
    finalTotal,
    totalImages,
    averageConfidence,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  input.scans.forEach((scan) => {
    const scanRef = doc(collection(db, SCANS_COL));
    batch.set(scanRef, {
      sessionId: sessionRef.id,
      userId: input.userId,
      side: scan.side,
      aiCount: scan.aiCount,
      confidence: scan.confidence,
      scanTimeMs: scan.scanTimeMs,
      createdAt: serverTimestamp(),
    } satisfies Omit<BagScan, 'id' | 'createdAt'> & { createdAt: unknown });
  });

  const historyRef = doc(collection(db, HISTORY_COL));
  batch.set(historyRef, {
    userId: input.userId,
    sessionId: sessionRef.id,
    productName: input.productName || '',
    truckNumber: input.truckNumber || '',
    finalTotal,
    totalImages,
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  return { sessionId: sessionRef.id, totalBags, finalTotal, totalImages, averageConfidence };
}

export interface AiSettingsData {
  lastProductName?: string;
  lastTruckNumber?: string;
  lastCustomerName?: string;
}

export async function getAiSettings(userId: string): Promise<AiSettingsData | null> {
  try {
    const snap = await getDoc(doc(db, SETTINGS_COL, userId));
    if (!snap.exists()) return null;
    return snap.data() as AiSettingsData;
  } catch (err) {
    console.warn('[bagCounterService] getAiSettings failed:', err);
    return null;
  }
}

export async function saveAiSettings(userId: string, data: AiSettingsData): Promise<void> {
  try {
    await setDoc(doc(db, SETTINGS_COL, userId), { userId, ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn('[bagCounterService] saveAiSettings failed:', err);
  }
}
