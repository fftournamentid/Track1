import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Invoice } from '@/types';
import { buildInvoiceHTML, generatePDFWithTemplate } from './invoiceTemplates';

export interface PDFResult {
  uri: string;
}

export async function generatePDF(invoice: Invoice, templateId = 'classic'): Promise<PDFResult> {
  return generatePDFWithTemplate(invoice, templateId);
}

export async function printInvoice(invoice: Invoice, templateId = 'classic'): Promise<void> {
  const html = await buildInvoiceHTML(invoice, templateId);
  await Print.printAsync({ html });
}

export async function savePDFToDevice(invoice: Invoice, templateId = 'classic'): Promise<string> {
  const result = await generatePDFWithTemplate(invoice, templateId);
  const safe = invoice.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `Invoice_${safe}.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.copyAsync({ from: result.uri, to: dest });
  return filename;
}

export async function openPDF(uri: string): Promise<void> {
  if (Platform.OS === 'android') {
    const IntentLauncher = await import('expo-intent-launcher');
    const contentUri = await FileSystem.getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: 'application/pdf',
    });
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Opening PDFs is not supported on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}

export async function openInvoicePDF(invoice: Invoice, templateId?: string): Promise<void> {
  const tplId = templateId || invoice.templateId || 'classic';
  const result = await generatePDFWithTemplate(invoice, tplId);
  await openPDF(result.uri);
}
