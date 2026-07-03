import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Invoice } from '@/types';
import { buildInvoiceHTML, generatePDFWithTemplate } from './invoiceTemplates';

export interface PDFResult {
  uri: string;
}

export interface SavedPDF {
  uri: string;
  filename: string;
}

function safeName(invoiceNumber: string): string {
  return invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
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
 * Generates the PDF (or returns cached version if already on device),
 * saves to documentDirectory, and returns the stable URI + filename.
 *
 * Cache key includes templateId so switching templates always regenerates.
 * Pass forceRegenerate=true to bypass cache (e.g. invoice data changed).
 *
 * Flow: expo-print → temp URI → copy to documentDirectory → return stable URI.
 */
export async function generateAndSaveInvoicePDF(
  invoice: Invoice,
  templateId = 'classic',
  forceRegenerate = false
): Promise<SavedPDF> {
  const filename = `Invoice_${safeName(invoice.invoiceNumber)}_${safeName(templateId)}.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;

  // Return cached file if it already exists, is valid, and caller didn't force regenerate
  if (!forceRegenerate && await fileExistsAndValid(dest)) {
    return { uri: dest, filename };
  }

  // Generate fresh PDF
  const result = await generatePDFWithTemplate(invoice, templateId);
  await FileSystem.copyAsync({ from: result.uri, to: dest });

  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists || (info.size ?? 0) < 1024) {
    throw new Error('PDF generation failed — file too small or missing.');
  }

  return { uri: dest, filename };
}

/** Legacy compat: used by TemplatePicker internally */
export async function generatePDF(invoice: Invoice, templateId = 'classic'): Promise<PDFResult> {
  return generatePDFWithTemplate(invoice, templateId);
}

/** Open a PDF URI with the system viewer (no browser print dialog). */
export async function openPDF(uri: string): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      const IntentLauncher = await import('expo-intent-launcher');
      const contentUri = await FileSystem.getContentUriAsync(uri);
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
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}

/** Share a PDF URI via the system share sheet. */
export async function sharePDF(uri: string, title = 'Share Invoice PDF'): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Save PDF to device storage.
 * Android: uses StorageAccessFramework to write to Downloads folder, falls back to shareAsync.
 * iOS: opens share sheet which lets the user save to Files.
 */
export async function savePDFToDownloads(uri: string, filename: string): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (perms.granted) {
        const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
          perms.directoryUri,
          filename,
          'application/pdf'
        );
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.writeAsStringAsync(destUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return;
      }
    } catch {
      // fall through to shareAsync
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save Invoice PDF',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  // iOS — share sheet with "Save to Files" option
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Saving is not available on this device.');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Save Invoice PDF',
    UTI: 'com.adobe.pdf',
  });
}

/** Web-only: download as HTML file (no PDF generation available on web). */
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
