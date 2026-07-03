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
  console.log('[PDF] generateAndSaveInvoicePDF —', {
    invoiceNumber: invoice.invoiceNumber,
    templateId,
    forceRegenerate,
    userId: userId ?? '(none — upload will be skipped)',
    platform: Platform.OS,
  });

  // Web: expo-print not supported → return HTML blob URI
  if (Platform.OS === 'web') {
    console.log('[PDF] Web platform — generating HTML blob URI (real PDF not supported on web)');
    const filename = `Invoice_${safeName(invoice.invoiceNumber)}_${safeName(templateId)}.html`;
    const result = await generatePDFWithTemplate(invoice, templateId);
    console.log('[PDF] Web blob URI ready:', result.uri);
    return { uri: result.uri, filename };
  }

  const filename = `Invoice_${safeName(invoice.invoiceNumber)}_${safeName(templateId)}.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  console.log('[PDF] Target path:', dest);

  // Return cached local file if valid and not forcing
  if (!forceRegenerate) {
    const cached = await fileExistsAndValid(dest);
    if (cached) {
      console.log('[PDF] ✓ Valid cached file found at:', dest);
      let publicUrl: string | undefined;
      if (userId) {
        console.log('[PDF] Uploading cached file to Supabase for userId:', userId);
        try {
          const uploaded = await uploadPDFToSupabase(dest, filename, userId);
          if (uploaded) {
            publicUrl = uploaded;
            console.log('[PDF] ✓ Supabase upload (cache path) succeeded:', publicUrl);
          } else {
            console.warn('[PDF] Supabase upload (cache path) returned null — env vars may be missing');
          }
        } catch (uploadErr) {
          console.warn('[PDF] Supabase upload (cache path) threw:', uploadErr);
        }
      }
      return { uri: dest, filename, publicUrl };
    }
    console.log('[PDF] No valid cache — generating fresh PDF...');
  } else {
    console.log('[PDF] forceRegenerate=true — bypassing cache...');
  }

  // Generate fresh PDF
  console.log('[PDF] Calling generatePDFWithTemplate...');
  const result = await generatePDFWithTemplate(invoice, templateId);
  console.log('[PDF] printToFileAsync returned URI:', result.uri);

  console.log('[PDF] Copying to stable path:', dest);
  await FileSystem.copyAsync({ from: result.uri, to: dest });

  const info = await FileSystem.getInfoAsync(dest);
  const size = info.exists ? ((info as { exists: true; size?: number }).size ?? 0) : 0;
  console.log('[PDF] File at dest — exists:', info.exists, '| size:', size, 'bytes');

  if (!info.exists || size < 1024) {
    throw new Error(`PDF generation failed — file is ${size} bytes (minimum 1 KB). Path: ${dest}`);
  }

  // Upload to Supabase
  let publicUrl: string | undefined;
  if (userId) {
    console.log('[PDF] Uploading to Supabase, userId:', userId, '| filename:', filename);
    try {
      const uploaded = await uploadPDFToSupabase(dest, filename, userId);
      if (uploaded) {
        publicUrl = uploaded;
        console.log('[PDF] ✓ Supabase upload succeeded:', publicUrl);
      } else {
        console.warn('[PDF] Supabase upload returned null — EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY may not be set');
      }
    } catch (uploadErr) {
      console.warn('[PDF] Supabase upload threw (non-fatal, using local URI):', uploadErr);
    }
  } else {
    console.log('[PDF] No userId — skipping Supabase upload');
  }

  console.log('[PDF] ✓ generateAndSaveInvoicePDF complete. uri:', dest, '| publicUrl:', publicUrl);
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
  console.log('[PDF][open] openPDF called, uri:', uri);
  let localUri = uri;

  // Remote URL → download to cache first
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const filename = decodeURIComponent(uri.split('/').pop() ?? 'invoice.pdf');
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    const exists = await fileExistsAndValid(dest);
    if (!exists) {
      console.log('[PDF][open] Downloading remote URL to cache:', dest);
      const dl = await FileSystem.downloadAsync(uri, dest);
      localUri = dl.uri;
      console.log('[PDF][open] Downloaded to:', localUri);
    } else {
      localUri = dest;
      console.log('[PDF][open] Using cached file:', localUri);
    }
  }

  if (Platform.OS === 'android') {
    try {
      const IntentLauncher = await import('expo-intent-launcher');
      const contentUri = await FileSystem.getContentUriAsync(localUri);
      console.log('[PDF][open] Android — launching intent for:', contentUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/pdf',
      });
      return;
    } catch (intentErr) {
      console.warn('[PDF][open] IntentLauncher failed, falling back to shareAsync:', intentErr);
    }
  }

  const canShare = await Sharing.isAvailableAsync();
  console.log('[PDF][open] Sharing available:', canShare);
  if (!canShare) throw new Error('Opening PDFs is not supported on this device.');
  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}

/** Share a PDF URI via the system share sheet. Handles remote URLs by downloading first. */
export async function sharePDF(uri: string, title = 'Share Invoice PDF'): Promise<void> {
  console.log('[PDF][share] sharePDF called — uri:', uri, '| platform:', Platform.OS);

  // Web: Sharing API not available — open the URI in a new tab as fallback
  if (Platform.OS === 'web') {
    console.log('[PDF][share] Web platform — opening URI in new tab');
    if (typeof window !== 'undefined') {
      window.open(uri, '_blank');
    }
    return;
  }

  let localUri = uri;

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const filename = decodeURIComponent(uri.split('/').pop() ?? 'invoice.pdf');
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    const exists = await fileExistsAndValid(dest);
    if (!exists) {
      console.log('[PDF][share] Downloading remote URL to cache:', dest);
      const dl = await FileSystem.downloadAsync(uri, dest);
      localUri = dl.uri;
    } else {
      localUri = dest;
    }
    console.log('[PDF][share] Local URI ready:', localUri);
  }

  const canShare = await Sharing.isAvailableAsync();
  console.log('[PDF][share] Sharing available:', canShare);
  if (!canShare) throw new Error('Sharing is not available on this device.');

  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
  console.log('[PDF][share] ✓ Share dialog opened.');
}

/**
 * Save PDF to device storage.
 * Android: StorageAccessFramework → Downloads folder, falls back to shareAsync.
 * iOS: share sheet → "Save to Files".
 * Web: triggers browser download of the HTML content.
 * Handles remote URLs by downloading first.
 */
export async function savePDFToDownloads(uri: string, filename: string): Promise<void> {
  console.log('[PDF][download] savePDFToDownloads called — uri:', uri, '| filename:', filename, '| platform:', Platform.OS);

  // Web: trigger browser download
  if (Platform.OS === 'web') {
    console.log('[PDF][download] Web platform — triggering browser download via anchor');
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = uri;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return;
  }

  let localUri = uri;

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    const exists = await fileExistsAndValid(dest);
    if (!exists) {
      console.log('[PDF][download] Downloading remote URL to cache:', dest);
      const dl = await FileSystem.downloadAsync(uri, dest);
      localUri = dl.uri;
    } else {
      localUri = dest;
    }
    console.log('[PDF][download] Local URI ready:', localUri);
  }

  if (Platform.OS === 'android') {
    try {
      console.log('[PDF][download] Android — requesting SAF directory permissions...');
      const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (perms.granted) {
        console.log('[PDF][download] SAF permissions granted, directoryUri:', perms.directoryUri);
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
        console.log('[PDF][download] ✓ Written to SAF uri:', destUri);
        return;
      } else {
        console.log('[PDF][download] SAF permission denied — falling back to shareAsync');
      }
    } catch (safErr) {
      console.warn('[PDF][download] SAF failed, falling back to shareAsync:', safErr);
    }
    await Sharing.shareAsync(localUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save Invoice PDF',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  console.log('[PDF][download] Sharing available:', canShare);
  if (!canShare) throw new Error('Saving is not available on this device.');
  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Save Invoice PDF',
    UTI: 'com.adobe.pdf',
  });
  console.log('[PDF][download] ✓ Share dialog opened for save.');
}

/** Web-only: download as HTML file (browser print → Save as PDF). */
export async function downloadForWeb(invoice: Invoice, templateId = 'classic'): Promise<void> {
  console.log('[PDF][web] downloadForWeb called — invoiceNumber:', invoice.invoiceNumber, '| templateId:', templateId);
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
  console.log('[PDF][web] ✓ HTML download triggered. File:', a.download);
}
