import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
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
