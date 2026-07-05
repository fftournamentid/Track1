import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { Invoice } from '@/types';

export interface TemplateStyle {
  id: string;
  name: string;
  description: string;
  isPremium: boolean;
  /** 'standard' (default) | 'compact' (receipt) | 'sidebar' (split-column) */
  layout?: 'standard' | 'compact' | 'sidebar';
  previewColors: [string, string, string];
  font: string;
  bodyBg: string;
  bodyText: string;
  companyNameColor: string;
  invoiceTitleColor: string;
  dividerCss: string;
  dividerHeight: number;
  tableHeadBg: string;
  tableHeadText: string;
  grandRowBg: string;
  grandRowText: string;
  labelColor: string;
  billNameColor: string;
  tripBg: string;
  tripBorder: string;
  tripValColor: string;
  rowAlt: string;
  borderColor: string;
  notesBg: string;
  notesAccent: string;
  payValColor: string;
  itemAmtColor: string;
  metaTextColor: string;
  totalRowColor: string;
}

export const INVOICE_TEMPLATES: TemplateStyle[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Navy & orange, timeless',
    isPremium: false,
    previewColors: ['#1A3C6E', '#FFFFFF', '#F57C00'],
    font: 'Arial, Helvetica, sans-serif',
    bodyBg: '#ffffff',
    bodyText: '#1a1a2e',
    companyNameColor: '#1A3C6E',
    invoiceTitleColor: '#F57C00',
    dividerCss: 'linear-gradient(90deg, #1A3C6E 0%, #F57C00 100%)',
    dividerHeight: 3,
    tableHeadBg: '#1A3C6E',
    tableHeadText: '#ffffff',
    grandRowBg: '#1A3C6E',
    grandRowText: '#ffffff',
    labelColor: '#F57C00',
    billNameColor: '#1A3C6E',
    tripBg: '#f4f7fd',
    tripBorder: '#1A3C6E',
    tripValColor: '#1A3C6E',
    rowAlt: '#fafbff',
    borderColor: '#e8edf5',
    notesBg: '#fffbf0',
    notesAccent: '#F57C00',
    payValColor: '#1A3C6E',
    itemAmtColor: '#1A3C6E',
    metaTextColor: '#555555',
    totalRowColor: '#555555',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Slate & teal, contemporary',
    isPremium: false,
    previewColors: ['#334155', '#F8FAFC', '#14B8A6'],
    font: '"Helvetica Neue", Arial, sans-serif',
    bodyBg: '#f8fafc',
    bodyText: '#0F172A',
    companyNameColor: '#0F172A',
    invoiceTitleColor: '#14B8A6',
    dividerCss: 'linear-gradient(90deg, #334155 0%, #14B8A6 100%)',
    dividerHeight: 3,
    tableHeadBg: '#334155',
    tableHeadText: '#ffffff',
    grandRowBg: '#0F172A',
    grandRowText: '#ffffff',
    labelColor: '#14B8A6',
    billNameColor: '#0F172A',
    tripBg: '#f1f5f9',
    tripBorder: '#14B8A6',
    tripValColor: '#0F172A',
    rowAlt: '#f0fdfa',
    borderColor: '#e2e8f0',
    notesBg: '#f0fdfa',
    notesAccent: '#14B8A6',
    payValColor: '#0F172A',
    itemAmtColor: '#14B8A6',
    metaTextColor: '#64748B',
    totalRowColor: '#475569',
  },
  {
    id: 'blue',
    name: 'Blue',
    description: 'Royal blue, corporate look',
    isPremium: false,
    previewColors: ['#1E40AF', '#EFF6FF', '#60A5FA'],
    font: 'Arial, Helvetica, sans-serif',
    bodyBg: '#ffffff',
    bodyText: '#1e293b',
    companyNameColor: '#1E3A8A',
    invoiceTitleColor: '#3B82F6',
    dividerCss: 'linear-gradient(90deg, #1E3A8A 0%, #60A5FA 100%)',
    dividerHeight: 3,
    tableHeadBg: '#1E40AF',
    tableHeadText: '#ffffff',
    grandRowBg: '#1E40AF',
    grandRowText: '#ffffff',
    labelColor: '#2563EB',
    billNameColor: '#1E3A8A',
    tripBg: '#eff6ff',
    tripBorder: '#1E40AF',
    tripValColor: '#1E3A8A',
    rowAlt: '#f0f9ff',
    borderColor: '#dbeafe',
    notesBg: '#eff6ff',
    notesAccent: '#3B82F6',
    payValColor: '#1E3A8A',
    itemAmtColor: '#1E3A8A',
    metaTextColor: '#64748B',
    totalRowColor: '#475569',
  },
  {
    id: 'orange',
    name: 'Orange',
    description: 'Warm orange & cream design',
    isPremium: true,
    previewColors: ['#EA580C', '#FFF7ED', '#F97316'],
    font: 'Georgia, "Times New Roman", serif',
    bodyBg: '#fffbf0',
    bodyText: '#431407',
    companyNameColor: '#7C2D12',
    invoiceTitleColor: '#EA580C',
    dividerCss: 'linear-gradient(90deg, #C2410C 0%, #F97316 100%)',
    dividerHeight: 4,
    tableHeadBg: '#EA580C',
    tableHeadText: '#ffffff',
    grandRowBg: '#C2410C',
    grandRowText: '#ffffff',
    labelColor: '#EA580C',
    billNameColor: '#7C2D12',
    tripBg: '#fff7ed',
    tripBorder: '#F97316',
    tripValColor: '#7C2D12',
    rowAlt: '#fff3e0',
    borderColor: '#fed7aa',
    notesBg: '#fff3e0',
    notesAccent: '#EA580C',
    payValColor: '#7C2D12',
    itemAmtColor: '#C2410C',
    metaTextColor: '#9A3412',
    totalRowColor: '#9A3412',
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Bold dark theme, premium look',
    isPremium: true,
    previewColors: ['#1C1917', '#292524', '#D97706'],
    font: '"Helvetica Neue", Arial, sans-serif',
    bodyBg: '#1C1917',
    bodyText: '#E7E5E4',
    companyNameColor: '#F5F5F4',
    invoiceTitleColor: '#D97706',
    dividerCss: 'linear-gradient(90deg, #D97706 0%, #92400E 100%)',
    dividerHeight: 3,
    tableHeadBg: '#292524',
    tableHeadText: '#FBBF24',
    grandRowBg: '#D97706',
    grandRowText: '#1C1917',
    labelColor: '#D97706',
    billNameColor: '#F5F5F4',
    tripBg: '#292524',
    tripBorder: '#D97706',
    tripValColor: '#F5F5F4',
    rowAlt: '#292524',
    borderColor: '#44403C',
    notesBg: '#292524',
    notesAccent: '#D97706',
    payValColor: '#F5F5F4',
    itemAmtColor: '#D97706',
    metaTextColor: '#A8A29E',
    totalRowColor: '#A8A29E',
  },
  {
    id: 'gst',
    name: 'GST',
    description: 'Green, compliance-focused',
    isPremium: false,
    previewColors: ['#166534', '#F0FDF4', '#22C55E'],
    font: 'Arial, Helvetica, sans-serif',
    bodyBg: '#ffffff',
    bodyText: '#14532D',
    companyNameColor: '#14532D',
    invoiceTitleColor: '#16A34A',
    dividerCss: 'linear-gradient(90deg, #166534 0%, #22C55E 100%)',
    dividerHeight: 3,
    tableHeadBg: '#166534',
    tableHeadText: '#ffffff',
    grandRowBg: '#14532D',
    grandRowText: '#ffffff',
    labelColor: '#16A34A',
    billNameColor: '#14532D',
    tripBg: '#f0fdf4',
    tripBorder: '#16A34A',
    tripValColor: '#14532D',
    rowAlt: '#f7fef9',
    borderColor: '#bbf7d0',
    notesBg: '#f0fdf4',
    notesAccent: '#16A34A',
    payValColor: '#14532D',
    itemAmtColor: '#14532D',
    metaTextColor: '#4D7C5F',
    totalRowColor: '#4D7C5F',
  },
  {
    id: 'transport',
    name: 'Transport',
    description: 'Built for trucking businesses',
    isPremium: true,
    previewColors: ['#78350F', '#FFFDF8', '#D97706'],
    font: 'Arial, Helvetica, sans-serif',
    bodyBg: '#fffdf8',
    bodyText: '#451A03',
    companyNameColor: '#7C2D12',
    invoiceTitleColor: '#D97706',
    dividerCss: 'linear-gradient(90deg, #92400E 0%, #D97706 100%)',
    dividerHeight: 4,
    tableHeadBg: '#78350F',
    tableHeadText: '#FEF3C7',
    grandRowBg: '#D97706',
    grandRowText: '#451A03',
    labelColor: '#D97706',
    billNameColor: '#7C2D12',
    tripBg: '#fef3c7',
    tripBorder: '#D97706',
    tripValColor: '#7C2D12',
    rowAlt: '#fffbeb',
    borderColor: '#fde68a',
    notesBg: '#fffbeb',
    notesAccent: '#D97706',
    payValColor: '#7C2D12',
    itemAmtColor: '#92400E',
    metaTextColor: '#92400E',
    totalRowColor: '#92400E',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, elegant, understated',
    isPremium: false,
    previewColors: ['#FFFFFF', '#FAFAFA', '#374151'],
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    bodyBg: '#ffffff',
    bodyText: '#111827',
    companyNameColor: '#111827',
    invoiceTitleColor: '#374151',
    dividerCss: '#E5E7EB',
    dividerHeight: 1,
    tableHeadBg: '#111827',
    tableHeadText: '#ffffff',
    grandRowBg: '#111827',
    grandRowText: '#ffffff',
    labelColor: '#6B7280',
    billNameColor: '#111827',
    tripBg: '#F9FAFB',
    tripBorder: '#374151',
    tripValColor: '#111827',
    rowAlt: '#F9FAFB',
    borderColor: '#E5E7EB',
    notesBg: '#F9FAFB',
    notesAccent: '#6B7280',
    payValColor: '#111827',
    itemAmtColor: '#111827',
    metaTextColor: '#6B7280',
    totalRowColor: '#374151',
  },
  // ── New templates ──────────────────────────────────────────────────────────
  {
    id: 'executive',
    name: 'Executive',
    description: 'Deep charcoal & violet, serif elegance',
    isPremium: true,
    previewColors: ['#1C1B2E', '#FAFAFA', '#7C3AED'],
    font: 'Georgia, "Times New Roman", serif',
    bodyBg: '#FAFAFA',
    bodyText: '#1C1B2E',
    companyNameColor: '#1C1B2E',
    invoiceTitleColor: '#7C3AED',
    dividerCss: 'linear-gradient(90deg, #1C1B2E 0%, #7C3AED 100%)',
    dividerHeight: 3,
    tableHeadBg: '#1C1B2E',
    tableHeadText: '#F5F3FF',
    grandRowBg: '#7C3AED',
    grandRowText: '#FFFFFF',
    labelColor: '#7C3AED',
    billNameColor: '#1C1B2E',
    tripBg: '#F5F3FF',
    tripBorder: '#7C3AED',
    tripValColor: '#1C1B2E',
    rowAlt: '#F9F8FF',
    borderColor: '#E5E7EB',
    notesBg: '#F5F3FF',
    notesAccent: '#7C3AED',
    payValColor: '#1C1B2E',
    itemAmtColor: '#7C3AED',
    metaTextColor: '#6B7280',
    totalRowColor: '#374151',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Forest green, professional look',
    isPremium: true,
    previewColors: ['#064E3B', '#ECFDF5', '#10B981'],
    font: '"Helvetica Neue", Arial, sans-serif',
    bodyBg: '#FFFFFF',
    bodyText: '#064E3B',
    companyNameColor: '#064E3B',
    invoiceTitleColor: '#10B981',
    dividerCss: 'linear-gradient(90deg, #064E3B 0%, #10B981 100%)',
    dividerHeight: 3,
    tableHeadBg: '#064E3B',
    tableHeadText: '#ECFDF5',
    grandRowBg: '#059669',
    grandRowText: '#FFFFFF',
    labelColor: '#10B981',
    billNameColor: '#064E3B',
    tripBg: '#ECFDF5',
    tripBorder: '#10B981',
    tripValColor: '#064E3B',
    rowAlt: '#F0FDF4',
    borderColor: '#D1FAE5',
    notesBg: '#ECFDF5',
    notesAccent: '#10B981',
    payValColor: '#064E3B',
    itemAmtColor: '#059669',
    metaTextColor: '#6B7280',
    totalRowColor: '#374151',
  },
  {
    id: 'receipt',
    name: 'Receipt',
    description: 'Compact centered receipt layout',
    isPremium: false,
    layout: 'compact',
    previewColors: ['#111827', '#FFFFFF', '#374151'],
    font: '"Courier New", Courier, monospace',
    bodyBg: '#FFFFFF',
    bodyText: '#111827',
    companyNameColor: '#111827',
    invoiceTitleColor: '#111827',
    dividerCss: '#374151',
    dividerHeight: 2,
    tableHeadBg: '#111827',
    tableHeadText: '#FFFFFF',
    grandRowBg: '#111827',
    grandRowText: '#FFFFFF',
    labelColor: '#374151',
    billNameColor: '#111827',
    tripBg: '#F9FAFB',
    tripBorder: '#374151',
    tripValColor: '#111827',
    rowAlt: '#F9FAFB',
    borderColor: '#D1D5DB',
    notesBg: '#F9FAFB',
    notesAccent: '#374151',
    payValColor: '#111827',
    itemAmtColor: '#111827',
    metaTextColor: '#6B7280',
    totalRowColor: '#374151',
  },
  {
    id: 'logistics',
    name: 'Logistics Pro',
    description: 'Blue sidebar, split-column layout',
    isPremium: true,
    layout: 'sidebar',
    previewColors: ['#1E40AF', '#F8FAFC', '#60A5FA'],
    font: '"Helvetica Neue", Arial, sans-serif',
    bodyBg: '#F8FAFC',
    bodyText: '#1E293B',
    companyNameColor: '#1E3A8A',
    invoiceTitleColor: '#2563EB',
    dividerCss: 'linear-gradient(90deg, #1E40AF 0%, #60A5FA 100%)',
    dividerHeight: 3,
    tableHeadBg: '#1E40AF',
    tableHeadText: '#FFFFFF',
    grandRowBg: '#1E40AF',
    grandRowText: '#FFFFFF',
    labelColor: '#2563EB',
    billNameColor: '#1E3A8A',
    tripBg: '#EFF6FF',
    tripBorder: '#1E40AF',
    tripValColor: '#1E3A8A',
    rowAlt: '#F0F9FF',
    borderColor: '#DBEAFE',
    notesBg: '#EFF6FF',
    notesAccent: '#3B82F6',
    payValColor: '#1E3A8A',
    itemAmtColor: '#1E3A8A',
    metaTextColor: '#64748B',
    totalRowColor: '#475569',
  },
];

export function getTemplateById(id: string): TemplateStyle {
  return INVOICE_TEMPLATES.find((t) => t.id === id) ?? INVOICE_TEMPLATES[0];
}

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusBadgeCss(status: string): string {
  const map: Record<string, string> = {
    paid: 'background:#dcfce7;color:#15803d;',
    pending: 'background:#fef9c3;color:#854d0e;',
    draft: 'background:#f1f5f9;color:#475569;',
    archived: 'background:#f3f4f6;color:#6b7280;',
  };
  return map[status] ?? map.draft;
}

async function imageToDataUrl(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('data:')) return uri;

  // For local file:// URIs on native, use expo-file-system (FileReader/fetch are
  // unreliable for file:// on Hermes / older RN bridge).
  if (Platform.OS !== 'web' && (uri.startsWith('file://') || uri.startsWith('/'))) {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Infer mime type from extension
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mime};base64,${base64}`;
    } catch {
      return null;
    }
  }

  // For http/https URIs (remote images) or web platform, use fetch.
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise<string | null>((resolve) => {
      // FileReader works on web; on native newer RN also supports it.
      try {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

function renderHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;

  const logoHtml = logo
    ? `<img src="${logo}" alt="logo" style="height:72px;max-width:160px;object-fit:contain;border-radius:6px;" />`
    : '';

  const sigHtml = sig
    ? `<img src="${sig}" alt="sig" style="height:56px;max-width:160px;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : '<div style="height:48px;"></div>';

  const watermark =
    invoice.status === 'draft'
      ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:100px;font-weight:900;color:rgba(128,128,128,0.07);letter-spacing:12px;pointer-events:none;z-index:0;">DRAFT</div>`
      : '';

  const itemRows = invoice.expenses
    .map(
      (item, i) => `
    <tr style="${i % 2 === 1 ? `background:${t.rowAlt};` : `background:${t.bodyBg};`}">
      <td style="padding:11px 14px;font-size:13px;color:${t.bodyText};font-weight:500;">${item.name}</td>
      <td style="padding:11px 14px;font-size:13px;text-align:right;font-weight:700;color:${t.itemAmtColor};">${invoice.currency} ${fmt(item.amount)}</td>
    </tr>`,
    )
    .join('');

  const settlementLabel =
    invoice.settlementStatus === 'receive'
      ? 'Driver has to receive money.'
      : invoice.settlementStatus === 'return'
        ? 'Driver has to return money.'
        : 'Fully settled — no balance due.';

  const paymentSection =
    biz.upiId || biz.bankName
      ? `<div style="margin-bottom:22px;">
          <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:10px;">Payment Details</div>
          <div style="display:flex;flex-wrap:wrap;gap:20px;">
            ${biz.upiId ? `<div><div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">UPI ID</div><div style="font-size:13px;font-weight:600;color:${t.payValColor};margin-top:3px;">${biz.upiId}</div></div>` : ''}
            ${biz.bankName ? `<div><div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">Bank</div><div style="font-size:13px;font-weight:600;color:${t.payValColor};margin-top:3px;">${biz.bankName}</div></div>` : ''}
            ${biz.accountNumber ? `<div><div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">Account No.</div><div style="font-size:13px;font-weight:600;color:${t.payValColor};margin-top:3px;">${biz.accountNumber}</div></div>` : ''}
            ${biz.ifscCode ? `<div><div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">IFSC Code</div><div style="font-size:13px;font-weight:600;color:${t.payValColor};margin-top:3px;">${biz.ifscCode}</div></div>` : ''}
          </div>
        </div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:#f0f0f0; font-size:13px; }
  .page { width:794px; min-height:1123px; padding:48px 52px; position:relative; background:${t.bodyBg}; margin:0 auto; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  thead tr { background:${t.tableHeadBg}; }
  thead th { padding:11px 14px; font-size:10.5px; text-transform:uppercase; letter-spacing:0.8px; color:${t.tableHeadText}; text-align:left; }
  tbody tr { border-bottom:1px solid ${t.borderColor}; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; padding:40px; } }
</style>
</head>
<body>
<div class="page">
  ${watermark}

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
    <div style="flex:1;">
      ${logoHtml ? `<div style="margin-bottom:10px;">${logoHtml}</div>` : ''}
      <div style="font-size:22px;font-weight:800;color:${t.companyNameColor};letter-spacing:-0.5px;">${biz.companyName || biz.ownerName || 'Company Name'}</div>
      <div style="font-size:11.5px;color:${t.metaTextColor};line-height:1.85;margin-top:6px;">
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? 'Mobile: ' + biz.mobile : ''}
        ${biz.gstNumber ? '<br>GST: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:42px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-3px;line-height:1;">INVOICE</div>
      <div style="font-size:14px;font-weight:700;color:${t.companyNameColor};margin-top:6px;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11.5px;color:${t.metaTextColor};margin-top:8px;line-height:1.9;">
        Date: <strong>${invoice.date}</strong><br>
        ${invoice.dueDate ? 'Due: <strong>' + invoice.dueDate + '</strong>' : ''}
      </div>
      <div style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-top:8px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <!-- DIVIDER -->
  <div style="height:${t.dividerHeight}px;background:${t.dividerCss};border-radius:2px;margin-bottom:28px;"></div>

  <!-- BILL FROM / TO -->
  <div style="display:flex;gap:0;margin-bottom:24px;">
    <div style="flex:1;padding-right:24px;">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill From</div>
      <div style="font-size:14px;font-weight:700;color:${t.billNameColor};">${biz.ownerName || biz.companyName || '—'}</div>
      <div style="font-size:11.5px;color:${t.metaTextColor};line-height:1.85;margin-top:4px;">
        ${biz.companyName && biz.ownerName ? biz.companyName + '<br>' : ''}
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? biz.mobile : ''}
        ${biz.gstNumber ? '<br>GST: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="flex:1;padding-left:24px;border-left:1px solid ${t.borderColor};">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill To</div>
      <div style="font-size:14px;font-weight:700;color:${t.billNameColor};">${invoice.clientName}</div>
      <div style="font-size:11.5px;color:${t.metaTextColor};line-height:1.85;margin-top:4px;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GST: ' + invoice.clientGST : ''}
      </div>
    </div>
  </div>

  <!-- TRIP BOX -->
  <div style="background:${t.tripBg};border-left:4px solid ${t.tripBorder};border-radius:0 8px 8px 0;padding:14px 20px;margin-bottom:24px;display:flex;gap:0;flex-wrap:wrap;">
    <div style="flex:1;min-width:120px;padding-right:16px;">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;">From</div>
      <div style="font-size:13px;font-weight:700;color:${t.tripValColor};">${invoice.fromLocation}</div>
    </div>
    <div style="flex:1;min-width:120px;padding-right:16px;">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;">To</div>
      <div style="font-size:13px;font-weight:700;color:${t.tripValColor};">${invoice.toLocation}</div>
    </div>
    <div style="flex:1;min-width:120px;padding-right:16px;">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;">Truck No.</div>
      <div style="font-size:13px;font-weight:700;color:${t.tripValColor};">${invoice.truckNumber || '—'}</div>
    </div>
    <div style="flex:1;min-width:120px;padding-right:16px;">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;">Driver</div>
      <div style="font-size:13px;font-weight:700;color:${t.tripValColor};">${invoice.driverName || '—'}</div>
    </div>
    <div style="flex:1;min-width:120px;">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;">Date</div>
      <div style="font-size:13px;font-weight:700;color:${t.tripValColor};">${invoice.date}</div>
    </div>
  </div>

  <!-- EXPENSES TABLE -->
  <table>
    <thead>
      <tr>
        <th style="width:66%;text-align:left;">Expense Name</th>
        <th style="width:34%;text-align:right;">Amount (${invoice.currency})</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- SETTLEMENT SUMMARY -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
    <div style="width:300px;">
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};">
        <span>Advance Received</span><span>${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};">
        <span>Total Expenses</span><span>${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};">
        <span>Remaining Balance</span><span>${invoice.currency} ${fmt(invoice.balance)}</span>
      </div>
      ${invoice.balance > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};">
        <span>Extra Amount</span><span>${invoice.currency} ${fmt(invoice.balance)}</span>
      </div>` : ''}
      ${invoice.balance < 0 ? `
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};">
        <span>Loss Amount</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
      </div>` : ''}
      <div style="background:${t.grandRowBg};color:${t.grandRowText};padding:12px 16px;border-radius:8px;display:flex;justify-content:space-between;font-size:15px;font-weight:800;margin-top:10px;">
        <span>BALANCE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
      </div>
      <div style="text-align:center;font-size:12px;font-weight:700;color:${t.labelColor};margin-top:10px;">
        Settlement Status: ${settlementLabel}
      </div>
    </div>
  </div>

  <!-- PAYMENT DETAILS -->
  ${paymentSection}

  <!-- NOTES & TERMS -->
  ${invoice.notes ? `<div style="background:${t.notesBg};border-left:3px solid ${t.notesAccent};border-radius:0 6px 6px 0;padding:11px 16px;margin-bottom:20px;font-size:12px;color:${t.metaTextColor};line-height:1.9;"><strong style="color:${t.notesAccent};">Notes: </strong>${invoice.notes}</div>` : ''}
  ${invoice.paymentTerms ? `<div style="margin-bottom:20px;font-size:11.5px;color:${t.metaTextColor};line-height:1.8;"><strong>Payment Terms:</strong> ${invoice.paymentTerms}</div>` : ''}

  <!-- FOOTER -->
  <div style="border-top:2px solid ${t.borderColor};padding-top:22px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="font-size:11.5px;color:${t.metaTextColor};max-width:340px;line-height:1.9;">${biz.footerNotes || 'Thank you for your business.'}</div>
    <div style="text-align:center;min-width:180px;">
      ${sigHtml}
      <div style="width:160px;height:1px;background:${t.metaTextColor};margin:0 auto 8px;"></div>
      <div style="font-size:10px;color:${t.metaTextColor};text-transform:uppercase;letter-spacing:1px;">Authorized Signature</div>
      <div style="font-size:12px;font-weight:600;color:${t.billNameColor};margin-top:4px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>

  <div style="position:absolute;bottom:24px;right:52px;font-size:11px;color:${t.metaTextColor};opacity:0.6;">Page 1</div>
</div>
</body>
</html>`;
}

// ─── Compact / Receipt layout ─────────────────────────────────────────────────

function renderCompactHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;

  const itemRows = invoice.expenses
    .map(
      (item, i) => `
    <tr style="border-bottom:1px dashed ${t.borderColor};background:${i % 2 === 1 ? t.rowAlt : t.bodyBg};">
      <td style="padding:8px 12px;font-size:12px;color:${t.bodyText};">${item.name}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:700;color:${t.itemAmtColor};text-align:right;">${invoice.currency} ${fmt(item.amount)}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:${t.bodyBg}; font-size:13px; }
  .page { width:794px; min-height:1123px; padding:60px 120px; position:relative; background:${t.bodyBg}; }
  table { width:100%; border-collapse:collapse; margin-bottom:12px; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; padding:60px 120px; } }
</style>
</head>
<body>
<div class="page">

  <!-- Header: centered company -->
  <div style="text-align:center;margin-bottom:12px;">
    ${logo ? `<img src="${logo}" alt="logo" style="height:56px;object-fit:contain;display:block;margin:0 auto 10px;" />` : ''}
    <div style="font-size:20px;font-weight:900;color:${t.companyNameColor};">${biz.companyName || biz.ownerName || 'Company'}</div>
    <div style="font-size:11px;color:${t.metaTextColor};margin-top:4px;line-height:1.8;">
      ${biz.address ? biz.address + ' · ' : ''}${biz.mobile ?? ''}${biz.gstNumber ? ' · GST: ' + biz.gstNumber : ''}
    </div>
  </div>

  <div style="border-top:2px solid ${t.bodyText};margin-bottom:14px;"></div>

  <!-- Invoice title -->
  <div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:30px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-2px;">INVOICE</div>
    <div style="font-size:13px;font-weight:700;color:${t.companyNameColor};margin-top:4px;">No. ${invoice.invoiceNumber}</div>
    <div style="font-size:11px;color:${t.metaTextColor};margin-top:4px;">
      Date: ${invoice.date}${invoice.dueDate ? ' · Due: ' + invoice.dueDate : ''}
    </div>
    <div style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-top:6px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
  </div>

  <div style="border-top:1px dashed ${t.borderColor};margin-bottom:14px;"></div>

  <!-- Bill to -->
  <div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:4px;">BILL TO</div>
    <div style="font-size:16px;font-weight:800;color:${t.billNameColor};">${invoice.clientName}</div>
    <div style="font-size:11px;color:${t.metaTextColor};margin-top:3px;line-height:1.7;">
      ${invoice.clientPhone ? invoice.clientPhone : ''}${invoice.clientAddress ? ' · ' + invoice.clientAddress : ''}
    </div>
  </div>

  <div style="border-top:1px dashed ${t.borderColor};margin-bottom:12px;"></div>

  <!-- Trip details compact -->
  <div style="font-size:11px;color:${t.metaTextColor};text-align:center;line-height:2;margin-bottom:10px;">
    <strong style="color:${t.tripValColor};">${invoice.fromLocation}</strong> → <strong style="color:${t.tripValColor};">${invoice.toLocation}</strong>
    ${invoice.truckNumber ? ' · Truck: <strong>' + invoice.truckNumber + '</strong>' : ''}
    ${invoice.driverName ? ' · Driver: <strong>' + invoice.driverName + '</strong>' : ''}
  </div>

  <div style="border-top:1px dashed ${t.borderColor};margin-bottom:12px;"></div>

  <!-- Items -->
  <table>
    <thead>
      <tr style="background:${t.tableHeadBg};">
        <th style="padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${t.tableHeadText};text-align:left;">Item</th>
        <th style="padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${t.tableHeadText};text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="border-top:1px dashed ${t.borderColor};margin-bottom:12px;"></div>

  <!-- Totals -->
  <div style="width:240px;margin:0 auto 16px;">
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11.5px;color:${t.totalRowColor};border-bottom:1px solid ${t.borderColor};">
      <span>Advance Received</span><span>${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11.5px;color:${t.totalRowColor};border-bottom:1px solid ${t.borderColor};">
      <span>Total Expenses</span><span>${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:10px 14px;border-radius:8px;background:${t.grandRowBg};color:${t.grandRowText};font-size:14px;font-weight:900;">
      <span>BALANCE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
    </div>
  </div>

  ${invoice.notes ? `<div style="background:${t.notesBg};border:1px dashed ${t.notesAccent};border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:11px;color:${t.metaTextColor};text-align:center;line-height:1.7;"><strong style="color:${t.notesAccent};">Note:</strong> ${invoice.notes}</div>` : ''}

  <div style="border-top:2px solid ${t.bodyText};padding-top:14px;margin-top:14px;text-align:center;">
    <div style="font-size:11px;color:${t.metaTextColor};line-height:1.8;">${biz.footerNotes || 'Thank you for your business.'}</div>
    <div style="margin-top:14px;">
      ${sig ? `<img src="${sig}" alt="sig" style="height:44px;object-fit:contain;display:block;margin:0 auto 6px;" />` : '<div style="height:40px;"></div>'}
      <div style="width:140px;height:1px;background:${t.metaTextColor};margin:0 auto 6px;"></div>
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">Authorized Signature</div>
      <div style="font-size:11.5px;font-weight:700;color:${t.billNameColor};margin-top:3px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>

  <div style="position:absolute;bottom:24px;right:60px;font-size:10px;color:${t.metaTextColor};opacity:0.5;">Page 1</div>
</div>
</body>
</html>`;
}

// ─── Sidebar layout ───────────────────────────────────────────────────────────

function renderSidebarHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;

  const itemRows = invoice.expenses
    .map(
      (item, i) => `
    <tr style="border-bottom:1px solid ${t.borderColor};background:${i % 2 === 1 ? t.rowAlt : '#ffffff'};">
      <td style="padding:10px 14px;font-size:12.5px;color:${t.bodyText};">${item.name}</td>
      <td style="padding:10px 14px;font-size:12.5px;font-weight:700;color:${t.itemAmtColor};text-align:right;">${invoice.currency} ${fmt(item.amount)}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; background:#f0f0f0; font-family:${t.font}; font-size:13px; }
  .layout { display:flex; width:794px; min-height:1123px; }
  .sidebar { width:234px; min-height:1123px; background:${t.tableHeadBg}; padding:44px 22px; display:flex; flex-direction:column; position:relative; }
  .main { flex:1; background:#ffffff; padding:44px 32px; position:relative; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } }
</style>
</head>
<body>
<div class="layout">

  <!-- ── LEFT SIDEBAR ── -->
  <div class="sidebar">
    ${logo ? `<img src="${logo}" alt="logo" style="height:56px;max-width:180px;object-fit:contain;border-radius:6px;margin-bottom:14px;background:rgba(255,255,255,0.1);padding:4px;" />` : ''}
    <div style="font-size:15px;font-weight:800;color:#ffffff;margin-bottom:6px;line-height:1.35;">${biz.companyName || biz.ownerName || 'Company'}</div>
    <div style="font-size:10.5px;color:rgba(255,255,255,0.68);line-height:1.85;margin-bottom:18px;">
      ${biz.address ? biz.address + '<br>' : ''}
      ${biz.mobile ? 'Tel: ' + biz.mobile + '<br>' : ''}
      ${biz.gstNumber ? 'GST: ' + biz.gstNumber : ''}
    </div>

    <div style="height:1px;background:rgba(255,255,255,0.18);margin-bottom:18px;"></div>

    <!-- Route -->
    <div style="background:rgba(255,255,255,0.11);border-radius:10px;padding:13px 14px;margin-bottom:14px;">
      <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.55);margin-bottom:8px;">ROUTE</div>
      <div style="font-size:13px;font-weight:700;color:#ffffff;margin-bottom:4px;">${invoice.fromLocation}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.45);margin-bottom:4px;">↓</div>
      <div style="font-size:13px;font-weight:700;color:#ffffff;">${invoice.toLocation}</div>
    </div>

    ${invoice.truckNumber ? `<div style="margin-bottom:10px;"><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.5);margin-bottom:3px;">TRUCK</div><div style="font-size:12px;font-weight:700;color:#ffffff;">${invoice.truckNumber}</div></div>` : ''}
    ${invoice.driverName ? `<div style="margin-bottom:10px;"><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.5);margin-bottom:3px;">DRIVER</div><div style="font-size:12px;font-weight:700;color:#ffffff;">${invoice.driverName}</div></div>` : ''}
    <div style="margin-bottom:14px;"><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.5);margin-bottom:3px;">DATE</div><div style="font-size:12px;font-weight:700;color:#ffffff;">${invoice.date}</div></div>

    <div style="height:1px;background:rgba(255,255,255,0.18);margin-bottom:14px;"></div>

    ${(biz.upiId || biz.bankName) ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.5);margin-bottom:8px;">PAYMENT INFO</div>
      ${biz.upiId ? `<div style="font-size:11px;color:rgba(255,255,255,0.82);margin-bottom:3px;">UPI: ${biz.upiId}</div>` : ''}
      ${biz.bankName ? `<div style="font-size:11px;color:rgba(255,255,255,0.82);margin-bottom:2px;">${biz.bankName}</div>` : ''}
      ${biz.accountNumber ? `<div style="font-size:10px;color:rgba(255,255,255,0.6);">A/C: ${biz.accountNumber}</div>` : ''}
      ${biz.ifscCode ? `<div style="font-size:10px;color:rgba(255,255,255,0.6);">IFSC: ${biz.ifscCode}</div>` : ''}
    </div>` : ''}

    <!-- Signature at bottom of sidebar -->
    <div style="position:absolute;bottom:44px;left:22px;right:22px;">
      ${sig ? `<img src="${sig}" alt="sig" style="height:42px;max-width:140px;object-fit:contain;display:block;margin-bottom:6px;opacity:0.9;" />` : '<div style="height:38px;"></div>'}
      <div style="width:120px;height:1px;background:rgba(255,255,255,0.38);margin-bottom:5px;"></div>
      <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.45);">Authorized Signature</div>
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.75);margin-top:3px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>

  <!-- ── MAIN CONTENT ── -->
  <div class="main">
    <!-- Invoice header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;">
      <div>
        <div style="font-size:40px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-3px;line-height:1;">INVOICE</div>
        <div style="font-size:14px;font-weight:700;color:${t.companyNameColor};margin-top:6px;"># ${invoice.invoiceNumber}</div>
      </div>
      <div style="text-align:right;">
        <div style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
        <div style="font-size:11px;color:${t.metaTextColor};margin-top:8px;line-height:1.9;">
          Date: <strong>${invoice.date}</strong>${invoice.dueDate ? '<br>Due: <strong>' + invoice.dueDate + '</strong>' : ''}
        </div>
      </div>
    </div>

    <div style="height:3px;background:${t.dividerCss};border-radius:2px;margin-bottom:22px;"></div>

    <!-- Bill To -->
    <div style="margin-bottom:22px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill To</div>
      <div style="font-size:15px;font-weight:800;color:${t.billNameColor};margin-bottom:4px;">${invoice.clientName}</div>
      <div style="font-size:11.5px;color:${t.metaTextColor};line-height:1.8;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GST: ' + invoice.clientGST : ''}
      </div>
    </div>

    <!-- Expenses table -->
    <table>
      <thead>
        <tr style="background:${t.tableHeadBg};">
          <th style="padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${t.tableHeadText};text-align:left;width:64%;">Description</th>
          <th style="padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${t.tableHeadText};text-align:right;width:36%;">Amount (${invoice.currency})</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:18px;">
      <div style="width:260px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};font-size:12.5px;">
          <span>Advance Received</span><span>${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};font-size:12.5px;">
          <span>Total Expenses</span><span>${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:11px 14px;border-radius:8px;background:${t.grandRowBg};color:${t.grandRowText};font-size:14px;font-weight:800;margin-top:10px;">
          <span>BALANCE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
        </div>
        <div style="text-align:right;font-size:11.5px;font-weight:700;color:${t.labelColor};margin-top:8px;">
          ${invoice.balance >= 0 ? 'Driver to receive money' : 'Driver to return money'}
        </div>
      </div>
    </div>

    ${invoice.notes ? `<div style="background:${t.notesBg};border-left:3px solid ${t.notesAccent};border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:14px;font-size:11.5px;color:${t.metaTextColor};line-height:1.8;"><strong style="color:${t.notesAccent};">Notes:</strong> ${invoice.notes}</div>` : ''}
    ${invoice.paymentTerms ? `<div style="margin-bottom:14px;font-size:11px;color:${t.metaTextColor};line-height:1.7;"><strong>Payment Terms:</strong> ${invoice.paymentTerms}</div>` : ''}

    <!-- Footer note -->
    <div style="position:absolute;bottom:44px;left:32px;right:32px;">
      <div style="border-top:1px solid ${t.borderColor};padding-top:14px;font-size:11px;color:${t.metaTextColor};line-height:1.8;">${biz.footerNotes || 'Thank you for your business.'}</div>
    </div>
    <div style="position:absolute;bottom:24px;right:32px;font-size:10px;color:${t.metaTextColor};opacity:0.5;">Page 1</div>
  </div>

</div>
</body>
</html>`;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function buildInvoiceHTML(invoice: Invoice, templateId: string): Promise<string> {
  const t = getTemplateById(templateId);
  const biz = invoice.businessSnapshot;
  const [logo, sig] = await Promise.all([
    biz.logoUri ? imageToDataUrl(biz.logoUri) : Promise.resolve(null),
    biz.signatureUri ? imageToDataUrl(biz.signatureUri) : Promise.resolve(null),
  ]);
  if (t.layout === 'compact') return renderCompactHTML(invoice, t, logo, sig);
  if (t.layout === 'sidebar') return renderSidebarHTML(invoice, t, logo, sig);
  return renderHTML(invoice, t, logo, sig);
}

export interface PDFResult {
  uri: string;
}

export async function generatePDFWithTemplate(invoice: Invoice, templateId: string): Promise<PDFResult> {
  console.log('[PDF] generatePDFWithTemplate — invoice data:', JSON.stringify({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date,
    status: invoice.status,
    clientName: invoice.clientName,
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
    businessSnapshot: {
      companyName: invoice.businessSnapshot?.companyName,
      ownerName: invoice.businessSnapshot?.ownerName,
      gstNumber: invoice.businessSnapshot?.gstNumber,
      mobile: invoice.businessSnapshot?.mobile,
    },
    templateId,
  }, null, 2));

  const html = await buildInvoiceHTML(invoice, templateId);
  console.log('[PDF] HTML length:', html.length, 'chars — template:', templateId);

  if (html.length < 200) {
    throw new Error('Invoice HTML is empty — check template configuration.');
  }

  // Web: expo-print.printToFileAsync is not supported on web platform.
  // Return a blob URL pointing to the HTML so callers can open/download it.
  if (Platform.OS === 'web') {
    console.log('[PDF] Web platform — returning HTML blob URL (native PDF not supported on web)');
    const blob = new Blob([html], { type: 'text/html' });
    const uri = URL.createObjectURL(blob);
    console.log('[PDF] Web blob URI created, HTML size:', html.length, 'chars');
    return { uri };
  }

  const tryGenerate = async (): Promise<string> => {
    const result = await Print.printToFileAsync({ html, base64: false });
    console.log('[PDF] Generated URI:', result.uri);
    const info = await FileSystem.getInfoAsync(result.uri);
    const size = info.exists ? ((info as { exists: true; size: number }).size ?? 0) : 0;
    console.log('[PDF] File size:', size, 'bytes');
    if (!info.exists || size < 1024) {
      throw new Error(`PDF file is ${size} bytes — too small (minimum 1 KB). URI: ${result.uri}`);
    }
    return result.uri;
  };

  try {
    const uri = await tryGenerate();
    return { uri };
  } catch (firstErr) {
    console.warn('[PDF] First attempt failed, retrying...', firstErr);
    try {
      const uri = await tryGenerate();
      return { uri };
    } catch (secondErr) {
      throw secondErr;
    }
  }
}
