import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Linking, Platform } from 'react-native';
import type { Invoice } from '@/types';
import { generatePDF } from './pdfService';

export interface ShareOptions {
  invoice: Invoice;
  onProgress?: (step: string) => void;
}

export async function downloadPDF(invoice: Invoice, onProgress?: (step: string) => void): Promise<string> {
  onProgress?.('Generating PDF...');
  const { uri } = await generatePDF(invoice);
  const dest = FileSystem.documentDirectory + `Invoice_${invoice.invoiceNumber}.pdf`;
  onProgress?.('Saving file...');
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function sharePDF(invoice: Invoice, onProgress?: (step: string) => void): Promise<void> {
  const filePath = await downloadPDF(invoice, onProgress);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device');
  onProgress?.('Opening share dialog...');
  await Sharing.shareAsync(filePath, {
    mimeType: 'application/pdf',
    dialogTitle: `Invoice ${invoice.invoiceNumber}`,
    UTI: 'com.adobe.pdf',
  });
}

export async function shareViaWhatsApp(invoice: Invoice, onProgress?: (step: string) => void): Promise<void> {
  const message = encodeURIComponent(
    `Invoice #${invoice.invoiceNumber}\nClient: ${invoice.clientName}\nBalance: ${invoice.currency} ${Math.abs(invoice.balance)}\nDate: ${invoice.date}\n\nShared via Truck Invoice Manager`
  );

  if (Platform.OS !== 'web') {
    const filePath = await downloadPDF(invoice, onProgress);
    const waAvailable = await Linking.canOpenURL('whatsapp://send');
    if (waAvailable) {
      // Share file first, then let user send via WhatsApp
      const shareable = await Sharing.isAvailableAsync();
      if (shareable) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share via WhatsApp',
        });
        return;
      }
    }
  }

  // Fallback: open WhatsApp with text
  const url = `https://wa.me/?text=${message}`;
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  } else {
    throw new Error('WhatsApp is not installed');
  }
}
