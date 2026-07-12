/**
 * pdfService.ts — Local-first PDF pipeline with credit-gated cloud sync
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3 architecture:
 *   1. Generate PDF via expo-print / html2canvas+jsPDF
 *   2. Copy immediately to documentDirectory (permanent, survives app kill)
 *   3. Record in SQLite pdf_history (local list shows instantly)
 *   4. Attempt Supabase upload ONLY if premium OR credits available
 *      — on success: consume 1 credit
 *      — on no credits: set cloudUploadBlocked=true (caller shows dialog)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Invoice } from '@/types';
import {
  buildInvoiceHTML,
  generatePDFWithTemplate,
  hasValidPdfHeader,
} from './invoiceTemplates';
import { uploadPDFToSupabase, SupabaseUploadError } from './supabaseStorage';
import { auth } from './firebase/config';
import { addPdfHistoryEntry } from './sqliteService';
import { checkAndConsumeCredit } from './syncCreditsService';

export interface PDFResult {
  uri: string;
}

export interface SavedPDF {
  uri: string;
  filename: string;
  /** Supabase Storage public download URL — present only when upload succeeded. */
  publicUrl?: string;
  /**
   * True when the user has no cloud upload credits left and is not premium.
   * Callers should surface the PremiumSyncDialog in this case.
   */
  cloudUploadBlocked?: boolean;
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]/g, '_');
}

/**
 * Validates that a local file is a real, complete PDF:
 * exists, > 1 KB, and starts with the `%PDF-` magic header.
 * Skips the header check for non-PDF files (e.g. `.html` — web-only).
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
 * Record a PDF generation event to the local SQLite history.
 * Fire-and-forget — never blocks the PDF pipeline.
 */
function recordLocalPdfHistory(
  invoice: Invoice,
  filename: string,
  fileUri: string,
  templateId: string,
  userId: string,
): void {
  addPdfHistoryEntry({
    userUid: userId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    templateId,
    fileUri,
    fileName: filename,
    sharedVia: '',
  }).catch((err) =>
    console.warn('[PDF] Non-fatal: pdf_history SQLite insert failed:', err),
  );
}

/**
 * Attempt to upload a local PDF to Supabase Storage, guarded by the
 * credit/premium system.
 *
 * Returns:
 *   { publicUrl }          — upload succeeded; 1 credit consumed (free users)
 *   { blocked: true }      — no credits and not premium; caller shows dialog
 *   { publicUrl: undefined } — upload failed for a technical reason (non-fatal)
 */
async function attemptCloudUpload(
  localUri: string,
  filename: string,
  userId: string,
): Promise<{ publicUrl?: string; blocked?: boolean }> {
  // Atomic credit check-and-consume in a single SQLite transaction.
  // Prevents concurrent PDF operations from both passing the gate.
  const { allowed } = await checkAndConsumeCredit(userId);
  if (!allowed) {
    console.log('[PDF] Cloud upload blocked — no credits for user', userId);
    return { blocked: true };
  }

  // Verify Firebase Auth token is still valid
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) {
    console.warn(
      '[Supabase] Skipping upload — auth.currentUser uid',
      currentUser?.uid ?? '(none)',
      'does not match requested userId:',
      userId,
    );
    return {};
  }

  try {
    const uploaded = await uploadPDFToSupabase(localUri, filename, userId);
    if (uploaded) {
      console.log('[PDF] ✓ Cloud upload succeeded:', uploaded);
      return { publicUrl: uploaded };
    }
    console.warn('[Supabase] Upload returned null — env vars may be missing');
    return {};
  } catch (uploadErr: unknown) {
    if (
      uploadErr instanceof SupabaseUploadError &&
      (uploadErr.status === 401 || uploadErr.status === 403)
    ) {
      console.error(
        `[Supabase] ✗ Permission denied (HTTP ${uploadErr.status}) — check bucket RLS. Body: ${uploadErr.body}`,
      );
    } else {
      console.warn('[Supabase] Upload threw (non-fatal):', uploadErr);
    }
    return {};
  }
}

/**
 * Retry a cloud upload for a PDF that was previously blocked (no credits).
 * Call this from `PremiumSyncDialog.onCreditGranted` after the user
 * watches a rewarded ad or upgrades to premium.
 *
 * Does NOT regenerate the PDF — uses the already-saved local file.
 */
export async function uploadSavedPDFToCloud(
  localUri: string,
  filename: string,
  userId: string,
): Promise<{ publicUrl?: string; blocked?: boolean }> {
  return attemptCloudUpload(localUri, filename, userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a PDF, save it permanently to documentDirectory, record it in
 * the local SQLite history, then attempt a credit-gated cloud upload.
 *
 * @param invoice          The invoice to render.
 * @param templateId       Template key (default: 'classic').
 * @param forceRegenerate  Bypass the local cache and regenerate the PDF.
 * @param userId           Firebase UID — enables cloud upload gate check.
 */
export async function generateAndSaveInvoicePDF(
  invoice: Invoice,
  templateId = 'classic',
  forceRegenerate = false,
  userId?: string,
): Promise<SavedPDF> {
  console.log('[PDF] generateAndSaveInvoicePDF —', {
    invoiceNumber: invoice.invoiceNumber,
    templateId,
    forceRegenerate,
    userId: userId ?? '(none — cloud upload skipped)',
    platform: Platform.OS,
  });

  // ── Web path ──────────────────────────────────────────────────────────────
  // html2canvas + jsPDF produces a real PDF binary blob URL — no filesystem.
  if (Platform.OS === 'web') {
    console.log('[PDF] Web — generating real PDF blob URI');
    const filename = `Invoice_${safeName(invoice.invoiceNumber)}_${safeName(templateId)}.pdf`;
    const result = await generatePDFWithTemplate(invoice, templateId);
    return { uri: result.uri, filename };
  }

  // ── Mobile path ───────────────────────────────────────────────────────────
  const filename = `Invoice_${safeName(invoice.invoiceNumber)}_${safeName(templateId)}.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  console.log('[PDF] Target path:', dest);

  // ── Cached file path ──────────────────────────────────────────────────────
  if (!forceRegenerate) {
    const cached = await fileExistsAndValid(dest);
    if (cached) {
      console.log('[PDF] ✓ Valid cached file found at:', dest);

      // Record to local SQLite history (idempotent — upsert by id not needed here,
      // duplicate entries are harmless and natural for re-downloads)
      if (userId) {
        recordLocalPdfHistory(invoice, filename, dest, templateId, userId);
      }

      if (!userId) {
        return { uri: dest, filename };
      }

      const { publicUrl, blocked } = await attemptCloudUpload(dest, filename, userId);
      return { uri: dest, filename, publicUrl, cloudUploadBlocked: blocked };
    }
    console.log('[PDF] No valid cache — generating fresh PDF...');
  } else {
    console.log('[PDF] forceRegenerate=true — bypassing cache...');
  }

  // ── Generate fresh PDF ────────────────────────────────────────────────────
  console.log('[PDF] Calling generatePDFWithTemplate...');
  const result = await generatePDFWithTemplate(invoice, templateId);

  // If generatePDFWithTemplate somehow returned a blob URL on native, return early.
  if ((Platform.OS as string) === 'web' || result.uri.startsWith('blob:')) {
    return { uri: result.uri, filename, publicUrl: undefined };
  }

  console.log('[PDF] printToFileAsync returned URI:', result.uri);
  console.log('[PDF] Copying to stable documentDirectory path:', dest);
  await FileSystem.copyAsync({ from: result.uri, to: dest });

  const info = await FileSystem.getInfoAsync(dest);
  const size = info.exists
    ? ((info as { exists: true; size?: number }).size ?? 0)
    : 0;
  console.log('[PDF] File at dest — exists:', info.exists, '| size:', size, 'bytes');

  if (!info.exists || size < 1024) {
    throw new Error('PDF generation failed. Please try again.');
  }

  const validHeader = await hasValidPdfHeader(dest);
  if (!validHeader) {
    throw new Error('PDF generation failed. Please try again.');
  }

  // ── Record in local SQLite pdf_history (immediate — before cloud attempt) ─
  if (userId) {
    recordLocalPdfHistory(invoice, filename, dest, templateId, userId);
  }

  // ── Credit-gated cloud upload ─────────────────────────────────────────────
  if (!userId) {
    console.log('[PDF] No userId — skipping cloud upload');
    return { uri: dest, filename };
  }

  const { publicUrl, blocked } = await attemptCloudUpload(dest, filename, userId);
  console.log('[PDF] ✓ complete. uri:', dest, '| publicUrl:', publicUrl, '| blocked:', blocked);
  return { uri: dest, filename, publicUrl, cloudUploadBlocked: blocked };
}

/**
 * Returns the local documentDirectory URI for a previously-generated PDF if
 * the file exists and is valid, otherwise null.
 * Use this to open / share the already-saved file without touching the full
 * generation pipeline.
 */
export async function getCachedLocalPDFUri(
  invoiceNumber: string,
  templateId = 'classic',
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const filename = `Invoice_${safeName(invoiceNumber)}_${safeName(templateId)}.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  const valid = await fileExistsAndValid(dest);
  return valid ? dest : null;
}

/**
 * Resolve the local URI for a PDF, downloading from cloud if the local file
 * is missing.  Always saves to the canonical documentDirectory path so that
 * getCachedLocalPDFUri() finds it on every subsequent call (no re-download).
 *
 * Returns the local file:// URI, or null only when the PDF truly does not
 * exist anywhere (not locally, not in the cloud).
 */
export async function resolveLocalPDF(
  invoiceNumber: string,
  templateId: string,
  cloudUrl?: string | null,
): Promise<string | null> {
  // On web there is no local filesystem — return the cloud URL as-is.
  if (Platform.OS === 'web') return cloudUrl ?? null;

  const filename = `Invoice_${safeName(invoiceNumber)}_${safeName(templateId)}.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;

  // 1. Local cache hit — instant, no network.
  if (await fileExistsAndValid(dest)) return dest;

  // 2. Download from cloud URL and save to the canonical local path.
  if (cloudUrl) {
    try {
      const dl = await FileSystem.downloadAsync(cloudUrl, dest);
      if (await fileExistsAndValid(dl.uri)) return dl.uri;
    } catch (downloadErr) {
      console.warn('[PDF][resolve] Cloud download failed:', downloadErr);
    }
  }

  return null;
}

/** Legacy compat — returns a raw PDFResult (uri only). */
export async function generatePDF(
  invoice: Invoice,
  templateId = 'classic',
): Promise<PDFResult> {
  return generatePDFWithTemplate(invoice, templateId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Open / Share / Download — unchanged from original
// ─────────────────────────────────────────────────────────────────────────────

function isValidWebUrl(uri: string): boolean {
  return (
    typeof uri === 'string' &&
    uri.length > 0 &&
    (uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('blob:'))
  );
}

export async function openPDF(uri: string): Promise<void> {
  console.log('[PDF][open] openPDF called, uri:', uri);

  // ── Web ───────────────────────────────────────────────────────────────────
  // file:// and content:// URIs are Android-only.
  // On web, only https://, http://, or blob: URLs are valid for window.open().
  // navigator.share() throws "Invalid URL" for anything else — do NOT use it.
  if (Platform.OS === 'web') {
    console.log('[PDF][open] web path — isValidWebUrl:', isValidWebUrl(uri), '| uri:', uri);
    if (!isValidWebUrl(uri)) {
      throw new Error(
        `Cannot open PDF in browser: "${uri}" is not a valid web URL. ` +
        `file:// and content:// URIs only work on Android. ` +
        `Upload the PDF to cloud so it has an https:// URL, then try again.`,
      );
    }
    if (typeof window !== 'undefined') window.open(uri, '_blank');
    return;
  }
  // ── Native (Android / iOS) ────────────────────────────────────────────────

  let localUri = uri;

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const filename = decodeURIComponent(
      uri.split('/').pop() ?? 'invoice.pdf',
    ).split('?')[0];
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
    // 1. Try ACTION_VIEW with a content URI so any installed PDF viewer can open it.
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
      // No PDF viewer installed, or getContentUriAsync failed on this device.
      // Fall through to the share sheet — do NOT surface an error to the user.
    }
    // 2. Fallback: open the Android share sheet with the raw file:// URI.
    //    expo-sharing handles the FileProvider conversion internally (same as savePDFToDownloads).
    await Sharing.shareAsync(localUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Opening PDFs is not supported on this device.');
  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}

export async function sharePDF(uri: string, title = 'Share Invoice PDF'): Promise<void> {
  console.log('[PDF][share] sharePDF — uri:', uri, '| platform:', Platform.OS);

  // ── Web ───────────────────────────────────────────────────────────────────
  // Fetch the PDF bytes from the URI (handles blob:, https:, etc.) and share
  // as a File object so the browser share sheet receives the actual PDF — not
  // a blob URL string.  Never pass blob: / file: / content: as plain text.
  if (Platform.OS === 'web') {
    const filename = 'Invoice.pdf';

    // Step 1: Resolve URI → in-memory File
    let pdfFile: File | null = null;
    try {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      pdfFile = new File([blob], filename, { type: 'application/pdf' });
    } catch (fetchErr) {
      console.warn('[PDF][share] web: could not fetch PDF blob:', fetchErr);
    }

    // Step 2: Try navigator.share({ files }) — shares the actual PDF bytes
    if (
      pdfFile &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [pdfFile] })
    ) {
      try {
        await navigator.share({ title, files: [pdfFile] });
        return;
      } catch (shareErr) {
        // User dismissed the share sheet — treat as success (no error toast)
        if ((shareErr as DOMException)?.name === 'AbortError') return;
        console.warn('[PDF][share] web: navigator.share failed:', shareErr);
      }
    }

    // Step 3: Fallback — download the PDF directly
    const objectUrl = pdfFile ? URL.createObjectURL(pdfFile) : uri;
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    if (pdfFile) URL.revokeObjectURL(objectUrl);
    return;
  }

  // ── Native (Android / iOS) ────────────────────────────────────────────────

  let localUri = uri;

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const filename = decodeURIComponent(
      uri.split('/').pop() ?? 'invoice.pdf',
    ).split('?')[0];
    const dest = `${FileSystem.documentDirectory}${filename}`;
    const exists = await fileExistsAndValid(dest);
    if (!exists) {
      const dl = await FileSystem.downloadAsync(uri, dest);
      localUri = dl.uri;
    } else {
      localUri = dest;
    }
  }

  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) throw new Error('Unable to share PDF. Please try again.');
  const fileSize = (info as { exists: true; size?: number }).size ?? 0;
  if (fileSize < 1024) throw new Error('Unable to share PDF. Please try again.');
  const validHeader = await hasValidPdfHeader(localUri);
  if (!validHeader) throw new Error('Unable to share PDF. Please try again.');

  // Use Sharing.shareAsync with the local file URI — expo-sharing opens the
  // native share sheet (Nearby Share, Gmail, Drive, Bluetooth, WhatsApp…)
  // with the PDF attached.  Works on both Android and iOS.
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Share PDF directly to WhatsApp.
 *   Android: ACTION_SEND direct to com.whatsapp with content URI attachment;
 *            falls back to the native share sheet via Sharing.shareAsync.
 *   Web:     navigator.share({ files }) so the browser share sheet (including
 *            WhatsApp Web) receives the actual PDF file — never a blob: URL.
 *            Falls back to downloading the PDF if file-share is unsupported.
 *   iOS:     Sharing.shareAsync (native share sheet).
 *
 * Never sends blob:, file://, or content:// URIs as plain text.
 */
export async function shareToWhatsApp(uri: string): Promise<void> {
  console.log('[PDF][whatsapp] shareToWhatsApp — uri:', uri, '| platform:', Platform.OS);

  // ── Web ───────────────────────────────────────────────────────────────────
  // Fetch the PDF bytes so we can share the actual file, not a blob: URL string.
  if (Platform.OS === 'web') {
    const filename = 'Invoice.pdf';

    // Step 1: Resolve URI → in-memory File
    let pdfFile: File | null = null;
    try {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      pdfFile = new File([blob], filename, { type: 'application/pdf' });
    } catch (fetchErr) {
      console.warn('[PDF][whatsapp] web: could not fetch PDF blob:', fetchErr);
    }

    // Step 2: Try navigator.share({ files }) — WhatsApp Web can receive the attachment
    if (
      pdfFile &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [pdfFile] })
    ) {
      try {
        await navigator.share({ title: 'Invoice PDF', files: [pdfFile] });
        return;
      } catch (shareErr) {
        if ((shareErr as DOMException)?.name === 'AbortError') return;
        console.warn('[PDF][whatsapp] web: navigator.share failed:', shareErr);
      }
    }

    // Step 3: Fallback — download the PDF (never send blob URL as text)
    const objectUrl = pdfFile ? URL.createObjectURL(pdfFile) : uri;
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    if (pdfFile) URL.revokeObjectURL(objectUrl);
    return;
  }

  // ── Native (Android / iOS) ────────────────────────────────────────────────

  let localUri = uri;

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const filename = decodeURIComponent(
      uri.split('/').pop() ?? 'invoice.pdf',
    ).split('?')[0];
    const dest = `${FileSystem.documentDirectory}${filename}`;
    const exists = await fileExistsAndValid(dest);
    if (!exists) {
      const dl = await FileSystem.downloadAsync(uri, dest);
      localUri = dl.uri;
    } else {
      localUri = dest;
    }
  }

  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) throw new Error('Unable to share PDF. Please try again.');

  if (Platform.OS === 'android') {
    // 1. Try direct WhatsApp intent: ACTION_SEND + packageName so WhatsApp
    //    receives the PDF as a file attachment (not a link).
    //    Requires a content:// URI — getContentUriAsync handles the conversion.
    try {
      const contentUri = await FileSystem.getContentUriAsync(localUri);
      const IntentLauncher = await import('expo-intent-launcher');
      await (IntentLauncher as any).startActivityAsync('android.intent.action.SEND', {
        type: 'application/pdf',
        extra: {
          'android.intent.extra.STREAM': contentUri,
          'android.intent.extra.SUBJECT': 'Invoice PDF',
        },
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        packageName: 'com.whatsapp',
      });
      return;
    } catch {
      // WhatsApp not installed or intent failed — fall through to share sheet.
    }
    // 2. Fallback: full native share sheet via Sharing.shareAsync.
    //    The user can pick WhatsApp (or any other app) from the chooser.
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(localUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Invoice via WhatsApp',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  // iOS / other — native share sheet
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Invoice via WhatsApp',
    UTI: 'com.adobe.pdf',
  });
}

export async function savePDFToDownloads(uri: string, filename: string): Promise<void> {
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
          'application/pdf',
        );
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.writeAsStringAsync(destUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
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

export async function downloadForWeb(invoice: Invoice, templateId = 'classic'): Promise<void> {
  const html = await buildInvoiceHTML(invoice, templateId);
  const { renderHtmlToPdfBlob, blobHasValidPdfHeader } = await import('./webPdfGenerator');
  const blob = await renderHtmlToPdfBlob(html);
  const validHeader = await blobHasValidPdfHeader(blob);
  if (!validHeader) throw new Error('Unable to generate PDF.');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice_${safeName(invoice.invoiceNumber)}_${safeName(templateId)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function sharePDFWeb(
  invoice: Invoice,
  templateId = 'classic',
): Promise<'shared' | 'downloaded'> {
  const html = await buildInvoiceHTML(invoice, templateId);
  const { renderHtmlToPdfBlob, blobHasValidPdfHeader } = await import('./webPdfGenerator');
  const blob = await renderHtmlToPdfBlob(html);
  const validHeader = await blobHasValidPdfHeader(blob);
  if (!validHeader) throw new Error('Unable to generate PDF.');
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
      console.warn('[PDF][share][web] navigator.share failed, falling back to download:', shareErr);
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
