import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import type { Invoice } from '@/types';
import { generatePDFWithTemplate } from './invoiceTemplates';

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]/g, '_');
}

async function buildStablePDF(invoice: Invoice, templateId?: string): Promise<string> {
  const tplId = templateId || invoice.templateId || 'classic';
  const { uri } = await generatePDFWithTemplate(invoice, tplId);
  const filename = `Invoice_${safeName(invoice.invoiceNumber)}.pdf`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function downloadPDF(invoice: Invoice, onProgress?: (step: string) => void): Promise<string> {
  onProgress?.('Generating PDF...');
  const stableUri = await buildStablePDF(invoice);
  onProgress?.('Saved.');
  return stableUri;
}

export async function sharePDF(invoice: Invoice, onProgress?: (step: string) => void): Promise<void> {
  onProgress?.('Generating PDF...');
  const stableUri = await buildStablePDF(invoice);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device');
  onProgress?.('Opening share dialog...');
  await Sharing.shareAsync(stableUri, {
    mimeType: 'application/pdf',
    dialogTitle: `Invoice ${invoice.invoiceNumber}`,
    UTI: 'com.adobe.pdf',
  });
}

export async function shareViaWhatsApp(invoice: Invoice, onProgress?: (step: string) => void): Promise<void> {
  onProgress?.('Generating PDF...');
  const stableUri = await buildStablePDF(invoice);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device');
  onProgress?.('Opening share dialog...');
  await Sharing.shareAsync(stableUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share via WhatsApp',
    UTI: 'com.adobe.pdf',
  });
}
