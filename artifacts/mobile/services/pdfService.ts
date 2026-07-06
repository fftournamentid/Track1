import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Invoice } from '@/types';
import { buildInvoiceHTML, generatePDFWithTemplate, hasValidPdfHeader } from './invoiceTemplates';
import { uploadPDFToFirebaseStorage } from './firebase/firebaseStorage';

export interface PDFResult {
  uri: string;
}

export interface SavedPDF {
  uri: string;
  filename: string;
  /** Firebase Storage download URL if upload succeeded, undefined otherwise. */
  publicUrl?: string;
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]/g, '_');
}

/**
 * Validates a cached/local file is a real, complete PDF: exists, > 1 KB, and
 * starts with the `%PDF-` magic header. Skips the header check for non-PDF
 * (e.g. `.html`) files, which are only ever produced on web.
 */
async function fileExistsAndValid(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || (info.size ?? 0) <= 1024) return false;
    if (uri.toLowerCase().endsWith('.pdf')) {
      return await hasValidPdfHeader(uri);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a PDF for the invoice, saves it locally, and uploads to Firebase Storage.
 *
 * Cache key = invoiceNumber + templateId so switching templates always regenerates.
 * Pass forceRegenerate=true to bypass cache (e.g. invoice data changed).
 * Pass userId to enable Firebase Storage upload; omit/undefined for guest/preview scenarios.
 *
 * Returns { uri, filename, publicUrl? }
 * publicUrl is the Firebase Storage download URL; undefined if upload was skipped or failed.
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

  // Web: generatePDFWithTemplate now renders a REAL PDF binary (html2canvas + jsPDF),
  // not HTML — the filename correctly ends in .pdf.
  if (Platform.OS === 'web') {
    console.log('[PDF] Web platform — generating real PDF blob URI');
    const filename = `Invoice_${safeName(invoice.invoiceNumber)}_${safeName(templateId)}.pdf`;
    const result = await generatePDFWithTemplate(invoice, templateId);
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
        console.log('[PDF] Uploading cached file to Firebase Storage for userId:', userId);
        try {
          const uploaded = await uploadPDFToFirebaseStorage(dest, filename, userId);
          if (uploaded) {
            publicUrl = uploaded;
            console.log('[PDF] ✓ Firebase Storage upload (cache path) succeeded:', publicUrl);
          } else {
            console.warn('[PDF] Firebase Storage upload returned null');
          }
        } catch (uploadErr) {
          console.warn('[PDF] Firebase Storage upload threw (non-fatal):', uploadErr);
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

  // On web, generatePDFWithTemplate returns a blob URL which cannot be
  // copied via FileSystem. Return it directly — no local cache on web.
  if ((Platform.OS as string) === 'web' || result.uri.startsWith('blob:')) {
    return { uri: result.uri, filename, publicUrl: undefined };
  }

  console.log('[PDF] printToFileAsync returned URI:', result.uri);
  console.log('[PDF] Copying to stable path:', dest);
  await FileSystem.copyAsync({ from: result.uri, to: dest });

  const info = await FileSystem.getInfoAsync(dest);
  const size = info.exists ? ((info as { exists: true; size?: number }).size ?? 0) : 0;
  console.log('[PDF] File at dest — exists:', info.exists, '| size:', size, 'bytes');

  if (!info.exists || size < 1024) {
    throw new Error('PDF generation failed. Please try again.');
  }

  const validHeader = await hasValidPdfHeader(dest);
  if (!validHeader) {
    throw new Error('PDF generation failed. Please try again.');
  }

  // Upload to Firebase Storage
  let publicUrl: string | undefined;
  if (userId) {
    console.log('[PDF] Uploading to Firebase Storage, userId:', userId, '| filename:', filename);
    try {
      const uploaded = await uploadPDFToFirebaseStorage(dest, filename, userId);
      if (uploaded) {
        publicUrl = uploaded;
        console.log('[PDF] ✓ Firebase Storage upload succeeded:', publicUrl);
      } else {
        console.warn('[PDF] Firebase Storage upload returned null — check Firebase project config');
      }
    } catch (uploadErr) {
      console.warn('[PDF] Firebase Storage upload threw (non-fatal, using local URI):', uploadErr);
    }
  } else {
    console.log('[PDF] No userId — skipping Firebase Storage upload');
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
    const filename = decodeURIComponent(uri.split('/').pop() ?? 'invoice.pdf').split('?')[0];
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

/**
 * Share a PDF file via the native system share sheet.
 *
 * Android fix: expo-sharing passes `file://` URIs through its own FileProvider
 * whose path config may NOT cover documentDirectory, causing a silent
 * IllegalArgumentException (WhatsApp/Telegram/Gmail receive nothing).
 * Fix: call FileSystem.getContentUriAsync() to obtain a proper content://
 * URI backed by Expo's FileProvider (which IS configured for documentDirectory),
 * then pass that URI to shareAsync. The content:// URI includes
 * FLAG_GRANT_READ_URI_PERMISSION so all receiving apps can read the file.
 *
 * iOS: expo-sharing works fine with file:// URIs.
 * Web: opens the URI in a new tab (or falls back to download).
 */
export async function sharePDF(uri: string, title = 'Share Invoice PDF'): Promise<void> {
  console.log('[PDF][share] sharePDF called — uri:', uri, '| platform:', Platform.OS);

  // ── Web ──────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.open(uri, '_blank');
    }
    return;
  }

  // ── Ensure we have a LOCAL file ──────────────────────────────────────────
  // Remote URLs are downloaded to documentDirectory (not cacheDirectory) so
  // that getContentUriAsync works on Android.
  let localUri = uri;

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const filename = decodeURIComponent(uri.split('/').pop() ?? 'invoice.pdf').split('?')[0];
    const dest = `${FileSystem.documentDirectory}${filename}`;
    const exists = await fileExistsAndValid(dest);
    if (!exists) {
      console.log('[PDF][share] Downloading remote URL to documentDirectory:', dest);
      const dl = await FileSystem.downloadAsync(uri, dest);
      localUri = dl.uri;
    } else {
      localUri = dest;
    }
    console.log('[PDF][share] Local URI ready:', localUri);
  }

  // ── Verify file exists and is a valid, complete PDF binary ─────────────────
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) {
    throw new Error('Unable to share PDF. Please try again.');
  }
  const fileSize = (info as { exists: true; size?: number }).size ?? 0;
  if (fileSize < 1024) {
    throw new Error('Unable to share PDF. Please try again.');
  }
  const validHeader = await hasValidPdfHeader(localUri);
  if (!validHeader) {
    throw new Error('Unable to share PDF. Please try again.');
  }
  console.log('[PDF][share] File verified — size:', fileSize, 'bytes, valid %PDF- header, uri:', localUri);

  // ── Android: content:// URI for reliable app-to-app sharing ─────────────
  // WhatsApp, Telegram, Gmail, Drive, Nearby Share all require a
  // content:// URI; a raw file:// URI is blocked by StrictMode on Android 7+.
  if (Platform.OS === 'android') {
    let shareUri = localUri;
    try {
      shareUri = await FileSystem.getContentUriAsync(localUri);
      console.log('[PDF][share] Android: obtained content URI:', shareUri);
    } catch (contentUriErr) {
      console.warn('[PDF][share] getContentUriAsync failed — will try file:// directly:', contentUriErr);
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error('Unable to share PDF. Please try again.');

    try {
      await Sharing.shareAsync(shareUri, {
        mimeType: 'application/pdf',
        dialogTitle: title,
        UTI: 'com.adobe.pdf',
      });
      console.log('[PDF][share] ✓ Android share sheet opened successfully.');
      return;
    } catch (shareErr) {
      console.warn('[PDF][share] shareAsync with content URI failed, retrying with file URI:', shareErr);
      // Last resort: original file:// URI
      await Sharing.shareAsync(localUri, {
        mimeType: 'application/pdf',
        dialogTitle: title,
        UTI: 'com.adobe.pdf',
      });
      console.log('[PDF][share] ✓ Android fallback share sheet opened.');
      return;
    }
  }

  // ── iOS / other ──────────────────────────────────────────────────────────
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Unable to share PDF. Please try again.');

  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
  console.log('[PDF][share] ✓ Share sheet opened successfully.');
}

/**
 * Save PDF to device storage.
 * Android: StorageAccessFramework → Downloads folder, falls back to shareAsync.
 * iOS: share sheet → "Save to Files".
 * Web: triggers browser download of the HTML content.
 */
export async function savePDFToDownloads(uri: string, filename: string): Promise<void> {
  console.log('[PDF][download] savePDFToDownloads called — uri:', uri, '| filename:', filename, '| platform:', Platform.OS);

  // Web: trigger browser download
  if (Platform.OS === 'web') {
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
        console.log('[PDF][download] ✓ Written to SAF uri:', destUri);
        return;
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
  if (!canShare) throw new Error('Saving is not available on this device.');
  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Save Invoice PDF',
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Web-only: generates a REAL PDF binary (via html2canvas + jsPDF, see
 * webPdfGenerator.ts) and triggers a browser download of the `.pdf` file.
 * Previously this downloaded raw HTML — that is no longer the case.
 */
export async function downloadForWeb(invoice: Invoice, templateId = 'classic'): Promise<void> {
  const html = await buildInvoiceHTML(invoice, templateId);
  const { renderHtmlToPdfBlob, blobHasValidPdfHeader } = await import('./webPdfGenerator');
  const blob = await renderHtmlToPdfBlob(html);
  const validHeader = await blobHasValidPdfHeader(blob);
  if (!validHeader) {
    throw new Error('Unable to generate PDF.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice_${safeName(invoice.invoiceNumber)}_${safeName(templateId)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Web-only: shares a REAL PDF file via the Web Share API (`navigator.share`
 * with a File), when the browser supports sharing files. Falls back to
 * triggering a `.pdf` download when Web Share (or file sharing) isn't
 * available — never falls back to HTML.
 */
export async function sharePDFWeb(invoice: Invoice, templateId = 'classic'): Promise<'shared' | 'downloaded'> {
  const html = await buildInvoiceHTML(invoice, templateId);
  const { renderHtmlToPdfBlob, blobHasValidPdfHeader } = await import('./webPdfGenerator');
  const blob = await renderHtmlToPdfBlob(html);
  const validHeader = await blobHasValidPdfHeader(blob);
  if (!validHeader) {
    throw new Error('Unable to generate PDF.');
  }
  const filename = `Invoice_${safeName(invoice.invoiceNumber)}_${safeName(templateId)}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ title: `Invoice #${invoice.invoiceNumber}`, files: [file] });
      return 'shared';
    } catch (shareErr) {
      console.warn('[PDF][share][web] navigator.share failed/cancelled, falling back to download:', shareErr);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return 'downloaded';
}
