import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Invoice } from '@/types';
import { buildInvoiceHTML, generatePDFWithTemplate } from './invoiceTemplates';
import { uploadPDFToSupabase } from './supabaseStorage';

export interface PDFResult {
  uri: string;
}

export interface SavedPDF {
  uri: string;
  filename: string;
  /** Public Supabase URL if upload succeeded, undefined otherwise. */
  publicUrl?: string;
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]/g, '_');
}

async function fileExistsAndValid(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && (info.size ?? 0) > 1024;
  } catch {
    return false;
  }
}

/**
 * Generates a PDF for the invoice, saves it locally, and uploads to Supabase.
 *
 * Cache key = invoiceNumber + templateId so switching templates always regenerates.
 * Pass forceRegenerate=true to bypass cache (e.g. invoice data changed).
 * Pass userId to enable Supabase upload; omit/undefined for guest/preview scenarios.
 *
 * Returns { uri, filename, publicUrl? }
 * publicUrl is the Supabase public URL; undefined if upload was skipped or failed.
 */
export async function generateAndSaveInvoicePDF(
  invoice: Invoice,
  templateId = 'classic',
  forceRegenerate = false,
  userId?: string
): Promise<SavedPDF> {
  const filename = `Invoice_${safeName(invoice.invoiceNumber)}_${safeName(templateId)}.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;

  // Return cached local file if valid and not forcing
  if (!forceRegenerate && await fileExistsAndValid(dest)) {
    // Await upload so we can return the real public URL (fast path — file read + fetch).
    // If upload fails, fall back to local URI.
    let publicUrl: string | undefined;
    if (userId) {
      try {
        const uploaded = await uploadPDFToSupabase(dest, filename, userId);
        if (uploaded) publicUrl = uploaded;
      } catch {
        // Non-fatal — caller receives local URI
      }
    }
    return { uri: dest, filename, publicUrl };
  }

  // Generate fresh PDF
  const result = await generatePDFWithTemplate(invoice, templateId);
  await FileSystem.copyAsync({ from: result.uri, to: dest });

  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists || (info.size ?? 0) < 1024) {
    throw new Error('PDF generation failed — file too small or missing.');
  }

  // Upload to Supabase (non-blocking on cache hits, awaited on fresh generation)
  let publicUrl: string | undefined;
  if (userId) {
    try {
      const uploaded = await uploadPDFToSupabase(dest, filename, userId);
      if (uploaded) publicUrl = uploaded;
    } catch (err) {
      console.warn('[PDF] Supabase upload failed, falling back to local:', err);
    }
  }

  return { uri: dest, filename, publicUrl };
}

/** Legacy compat */
export async function generatePDF(invoice: Invoice, templateId = 'classic'): Promise<PDFResult> {
  return generatePDFWithTemplate(invoice, templateId);
}

/**
 * Open a PDF for viewing.
 * Handles both local file:// URIs and remote https:// URLs.
 * For remote URLs, downloads to cache first then opens.
 */
export async function openPDF(uri: string): Promise<void> {
  let localUri = uri;

  // Remote URL → download to cache first
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const filename = decodeURIComponent(uri.split('/').pop() ?? 'invoice.pdf');
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    const exists = await fileExistsAndValid(dest);
    if (!exists) {
      const dl = await FileSystem.downloadAsync(uri, dest);
      localUri = dl.uri;
    } else {
      localUri = dest;
    }
  }

  if (Platform.OS === 'android') {
    try {
      const IntentLauncher = await import('expo-intent-launcher');
      const contentUri = await FileSystem.getContentUriAsync(localUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/pdf',
      });
      return;
    } catch {
      // fall through to sharing
    }
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Opening PDFs is not supported on this device.');
  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}

/** Share a PDF URI via the system share sheet. Handles remote URLs by downloading first. */
export async function sharePDF(uri: string, title = 'Share Invoice PDF'): Promise<void> {
  let localUri = uri;

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const filename = decodeURIComponent(uri.split('/').pop() ?? 'invoice.pdf');
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    const exists = await fileExistsAndValid(dest);
    if (!exists) {
      const dl = await FileSystem.downloadAsync(uri, dest);
      localUri = dl.uri;
    } else {
      localUri = dest;
    }
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Save PDF to device storage.
 * Android: StorageAccessFramework → Downloads folder, falls back to shareAsync.
 * iOS: share sheet → "Save to Files".
 * Handles remote URLs by downloading first.
 */
export async function savePDFToDownloads(uri: string, filename: string): Promise<void> {
  let localUri = uri;

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    const exists = await fileExistsAndValid(dest);
    if (!exists) {
      const dl = await FileSystem.downloadAsync(uri, dest);
      localUri = dl.uri;
    } else {
      localUri = dest;
    }
  }

  if (Platform.OS === 'android') {
    try {
      const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (perms.granted) {
        const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
          perms.directoryUri,
          filename,
          'application/pdf'
        );
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.writeAsStringAsync(destUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return;
      }
    } catch {
      // fall through
    }
    await Sharing.shareAsync(localUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save Invoice PDF',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Saving is not available on this device.');
  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Save Invoice PDF',
    UTI: 'com.adobe.pdf',
  });
}

/** Web-only: download as HTML file. */
export async function downloadForWeb(invoice: Invoice, templateId = 'classic'): Promise<void> {
  const html = await buildInvoiceHTML(invoice, templateId);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice_${safeName(invoice.invoiceNumber)}_invoice.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
