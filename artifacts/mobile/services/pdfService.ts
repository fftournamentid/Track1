import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Invoice } from '@/types';
import { buildInvoiceHTML, generatePDFWithTemplate } from './invoiceTemplates';

function logInvoice(label: string, invoice: Invoice, templateId: string): void {
  console.log(`[pdfService] ${label}`, JSON.stringify({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date,
    status: invoice.status,
    clientName: invoice.clientName,
    clientPhone: invoice.clientPhone,
    fromLocation: invoice.fromLocation,
    toLocation: invoice.toLocation,
    truckNumber: invoice.truckNumber,
    driverName: invoice.driverName,
    advanceAmount: invoice.advanceAmount,
    totalExpenses: invoice.totalExpenses,
    balance: invoice.balance,
    settlementStatus: invoice.settlementStatus,
    currency: invoice.currency,
    expenseCount: invoice.expenses?.length ?? 0,
    expenses: invoice.expenses,
    templateId,
  }, null, 2));
}

export interface PDFResult {
  uri: string;
}

async function copyToStableLocation(uri: string, filename: string): Promise<string> {
  const dest = `${FileSystem.documentDirectory}${filename}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

function safeName(invoiceNumber: string): string {
  return invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
}

export async function generatePDF(invoice: Invoice, templateId = 'classic'): Promise<PDFResult> {
  return generatePDFWithTemplate(invoice, templateId);
}

export async function printInvoice(invoice: Invoice, templateId = 'classic'): Promise<void> {
  logInvoice('printInvoice', invoice, templateId);
  const html = await buildInvoiceHTML(invoice, templateId);
  console.log('[pdfService] printInvoice HTML length:', html.length, 'chars');

  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 400);
    }
    return;
  }

  await Print.printAsync({ html });
}

export async function savePDFToDevice(invoice: Invoice, templateId = 'classic'): Promise<string> {
  logInvoice('savePDFToDevice', invoice, templateId);

  const filename = `Invoice_${safeName(invoice.invoiceNumber)}.pdf`;

  if (Platform.OS === 'web') {
    const html = await buildInvoiceHTML(invoice, templateId);
    console.log('[pdfService] Web download — HTML length:', html.length, 'chars');
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.pdf', '_invoice.html');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return filename;
  }

  const result = await generatePDFWithTemplate(invoice, templateId);
  const dest = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.copyAsync({ from: result.uri, to: dest });
  console.log('[pdfService] PDF saved to:', dest);
  return filename;
}

export async function sharePDF(uri: string, title = 'Share Invoice PDF'): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not supported on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
}

export async function openPDF(uri: string): Promise<void> {
  if (Platform.OS === 'android') {
    const stableUri = await copyToStableLocation(uri, 'invoice_preview.pdf');
    try {
      const IntentLauncher = await import('expo-intent-launcher');
      const contentUri = await FileSystem.getContentUriAsync(stableUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/pdf',
      });
      return;
    } catch {
      await sharePDF(stableUri, 'Open Invoice PDF');
      return;
    }
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
  logInvoice('openInvoicePDF', invoice, tplId);

  if (Platform.OS === 'web') {
    const html = await buildInvoiceHTML(invoice, tplId);
    console.log('[pdfService] Web preview — HTML length:', html.length, 'chars');
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return;
  }

  const result = await generatePDFWithTemplate(invoice, tplId);
  const stableUri = await copyToStableLocation(
    result.uri,
    `Invoice_${safeName(invoice.invoiceNumber)}.pdf`
  );
  await openPDF(stableUri);
}

export async function shareInvoicePDF(
  invoice: Invoice,
  templateId?: string,
  title = 'Share Invoice PDF'
): Promise<void> {
  const tplId = templateId || invoice.templateId || 'classic';
  const result = await generatePDFWithTemplate(invoice, tplId);
  const stableUri = await copyToStableLocation(
    result.uri,
    `Invoice_${safeName(invoice.invoiceNumber)}.pdf`
  );
  await sharePDF(stableUri, title);
}
