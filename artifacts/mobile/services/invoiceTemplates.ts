import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { Invoice } from '@/types';

export interface TemplateStyle {
  id: string;
  name: string;
  description: string;
  isPremium: boolean;
  /** Layout renderer to use for HTML generation */
  layout?: 'standard' | 'compact' | 'sidebar' | 'top-banner' | 'corporate';
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
  /** Accent color for banner/corporate headings — defaults to invoiceTitleColor */
  accentColor?: string;
}

export const INVOICE_TEMPLATES: TemplateStyle[] = [
  // ─── 1. Classic (Standard layout) ────────────────────────────────────────
  {
    id: 'classic',
    name: 'Classic',
    description: 'Deep navy & burnt orange — traditional header-left',
    isPremium: false,
    layout: 'standard',
    previewColors: ['#0D2B5E', '#FFFFFF', '#D64E00'],
    font: 'Arial, Helvetica, sans-serif',
    bodyBg: '#ffffff',
    bodyText: '#0A1628',
    companyNameColor: '#0D2B5E',
    invoiceTitleColor: '#D64E00',
    accentColor: '#D64E00',
    dividerCss: 'linear-gradient(90deg,#0D2B5E 0%,#D64E00 100%)',
    dividerHeight: 4,
    tableHeadBg: '#0D2B5E',
    tableHeadText: '#ffffff',
    grandRowBg: '#0D2B5E',
    grandRowText: '#ffffff',
    labelColor: '#D64E00',
    billNameColor: '#0D2B5E',
    tripBg: '#EDF2FB',
    tripBorder: '#0D2B5E',
    tripValColor: '#0D2B5E',
    rowAlt: '#F5F8FF',
    borderColor: '#CBD5E1',
    notesBg: '#FFF8F5',
    notesAccent: '#D64E00',
    payValColor: '#0D2B5E',
    itemAmtColor: '#D64E00',
    metaTextColor: '#4A5770',
    totalRowColor: '#374151',
  },
  // ─── 2. Modern (Top-Banner layout) ───────────────────────────────────────
  {
    id: 'modern',
    name: 'Modern',
    description: 'Slate & teal — full-width gradient banner header',
    isPremium: false,
    layout: 'top-banner',
    previewColors: ['#1E293B', '#0F172A', '#0D9488'],
    font: '"Helvetica Neue", Arial, sans-serif',
    bodyBg: '#F8FAFC',
    bodyText: '#0F172A',
    companyNameColor: '#FFFFFF',
    invoiceTitleColor: '#5EEAD4',
    accentColor: '#0D9488',
    dividerCss: 'linear-gradient(90deg,#1E293B 0%,#0D9488 100%)',
    dividerHeight: 3,
    tableHeadBg: '#1E293B',
    tableHeadText: '#5EEAD4',
    grandRowBg: '#0D9488',
    grandRowText: '#ffffff',
    labelColor: '#0D9488',
    billNameColor: '#0F172A',
    tripBg: '#F0FDFA',
    tripBorder: '#0D9488',
    tripValColor: '#0F172A',
    rowAlt: '#F1F5F9',
    borderColor: '#CBD5E1',
    notesBg: '#F0FDFA',
    notesAccent: '#0D9488',
    payValColor: '#0F172A',
    itemAmtColor: '#0D9488',
    metaTextColor: '#64748B',
    totalRowColor: '#475569',
  },
  // ─── 3. Blue (Corporate layout) ──────────────────────────────────────────
  {
    id: 'blue',
    name: 'Blue',
    description: 'Royal blue — formal corporate two-box header',
    isPremium: false,
    layout: 'corporate',
    previewColors: ['#1E3A8A', '#EFF6FF', '#3B82F6'],
    font: 'Arial, Helvetica, sans-serif',
    bodyBg: '#ffffff',
    bodyText: '#1e293b',
    companyNameColor: '#1E3A8A',
    invoiceTitleColor: '#3B82F6',
    accentColor: '#1E40AF',
    dividerCss: 'linear-gradient(90deg,#1E3A8A 0%,#60A5FA 100%)',
    dividerHeight: 3,
    tableHeadBg: '#1E40AF',
    tableHeadText: '#ffffff',
    grandRowBg: '#1E40AF',
    grandRowText: '#ffffff',
    labelColor: '#2563EB',
    billNameColor: '#1E3A8A',
    tripBg: '#EFF6FF',
    tripBorder: '#3B82F6',
    tripValColor: '#1E3A8A',
    rowAlt: '#F0F9FF',
    borderColor: '#BFDBFE',
    notesBg: '#EFF6FF',
    notesAccent: '#3B82F6',
    payValColor: '#1E3A8A',
    itemAmtColor: '#1E40AF',
    metaTextColor: '#64748B',
    totalRowColor: '#475569',
  },
  // ─── 4. Orange (Top-Banner layout) ───────────────────────────────────────
  {
    id: 'orange',
    name: 'Orange',
    description: 'Warm amber — bold full-width banner, serif warmth',
    isPremium: true,
    layout: 'top-banner',
    previewColors: ['#92400E', '#FFF7ED', '#EA580C'],
    font: 'Georgia, "Times New Roman", serif',
    bodyBg: '#FFFBF5',
    bodyText: '#431407',
    companyNameColor: '#FFFFFF',
    invoiceTitleColor: '#FEF3C7',
    accentColor: '#EA580C',
    dividerCss: 'linear-gradient(90deg,#92400E 0%,#EA580C 100%)',
    dividerHeight: 4,
    tableHeadBg: '#92400E',
    tableHeadText: '#FEF3C7',
    grandRowBg: '#C2410C',
    grandRowText: '#ffffff',
    labelColor: '#C2410C',
    billNameColor: '#7C2D12',
    tripBg: '#FFF7ED',
    tripBorder: '#F97316',
    tripValColor: '#7C2D12',
    rowAlt: '#FFF3E0',
    borderColor: '#FDE68A',
    notesBg: '#FFF3E0',
    notesAccent: '#EA580C',
    payValColor: '#7C2D12',
    itemAmtColor: '#C2410C',
    metaTextColor: '#9A3412',
    totalRowColor: '#9A3412',
  },
  // ─── 5. Dark (Standard layout — dark theme) ───────────────────────────────
  {
    id: 'dark',
    name: 'Dark',
    description: 'Premium dark charcoal — gold accents, dark mode',
    isPremium: true,
    layout: 'standard',
    previewColors: ['#0C0A09', '#1C1917', '#D97706'],
    font: '"Helvetica Neue", Arial, sans-serif',
    bodyBg: '#0C0A09',
    bodyText: '#E7E5E4',
    companyNameColor: '#FAFAF9',
    invoiceTitleColor: '#FBBF24',
    accentColor: '#D97706',
    dividerCss: 'linear-gradient(90deg,#D97706 0%,#F59E0B 50%,#92400E 100%)',
    dividerHeight: 3,
    tableHeadBg: '#1C1917',
    tableHeadText: '#FBBF24',
    grandRowBg: '#D97706',
    grandRowText: '#0C0A09',
    labelColor: '#FBBF24',
    billNameColor: '#FAFAF9',
    tripBg: '#1C1917',
    tripBorder: '#D97706',
    tripValColor: '#FAFAF9',
    rowAlt: '#1C1917',
    borderColor: '#292524',
    notesBg: '#1C1917',
    notesAccent: '#D97706',
    payValColor: '#FAFAF9',
    itemAmtColor: '#FBBF24',
    metaTextColor: '#A8A29E',
    totalRowColor: '#D6D3D1',
  },
  // ─── 6. GST (Standard layout) ─────────────────────────────────────────────
  {
    id: 'gst',
    name: 'GST',
    description: 'Forest green — compliance-focused, GST-ready',
    isPremium: false,
    layout: 'standard',
    previewColors: ['#14532D', '#F0FDF4', '#16A34A'],
    font: 'Arial, Helvetica, sans-serif',
    bodyBg: '#ffffff',
    bodyText: '#052E16',
    companyNameColor: '#14532D',
    invoiceTitleColor: '#16A34A',
    accentColor: '#15803D',
    dividerCss: 'linear-gradient(90deg,#14532D 0%,#22C55E 100%)',
    dividerHeight: 3,
    tableHeadBg: '#14532D',
    tableHeadText: '#DCFCE7',
    grandRowBg: '#15803D',
    grandRowText: '#ffffff',
    labelColor: '#15803D',
    billNameColor: '#14532D',
    tripBg: '#F0FDF4',
    tripBorder: '#22C55E',
    tripValColor: '#14532D',
    rowAlt: '#F7FEF9',
    borderColor: '#BBF7D0',
    notesBg: '#F0FDF4',
    notesAccent: '#15803D',
    payValColor: '#14532D',
    itemAmtColor: '#15803D',
    metaTextColor: '#4D7C5F',
    totalRowColor: '#374151',
  },
  // ─── 7. Transport (Top-Banner layout) ────────────────────────────────────
  {
    id: 'transport',
    name: 'Transport',
    description: 'Amber & brown — built for trucking businesses',
    isPremium: true,
    layout: 'top-banner',
    previewColors: ['#78350F', '#FFFDF8', '#D97706'],
    font: 'Arial, Helvetica, sans-serif',
    bodyBg: '#FFFDF8',
    bodyText: '#451A03',
    companyNameColor: '#FFFFFF',
    invoiceTitleColor: '#FEF3C7',
    accentColor: '#D97706',
    dividerCss: 'linear-gradient(90deg,#78350F 0%,#D97706 100%)',
    dividerHeight: 4,
    tableHeadBg: '#78350F',
    tableHeadText: '#FEF3C7',
    grandRowBg: '#B45309',
    grandRowText: '#FEF3C7',
    labelColor: '#B45309',
    billNameColor: '#7C2D12',
    tripBg: '#FEF3C7',
    tripBorder: '#D97706',
    tripValColor: '#78350F',
    rowAlt: '#FFFBEB',
    borderColor: '#FDE68A',
    notesBg: '#FFFBEB',
    notesAccent: '#B45309',
    payValColor: '#7C2D12',
    itemAmtColor: '#92400E',
    metaTextColor: '#78350F',
    totalRowColor: '#78350F',
  },
  // ─── 8. Minimal (Standard layout — ultra clean) ───────────────────────────
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Pure black & white — hairlines only, ultra-clean',
    isPremium: false,
    layout: 'standard',
    previewColors: ['#111827', '#FAFAFA', '#374151'],
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    bodyBg: '#ffffff',
    bodyText: '#111827',
    companyNameColor: '#111827',
    invoiceTitleColor: '#111827',
    accentColor: '#374151',
    dividerCss: '#111827',
    dividerHeight: 1,
    tableHeadBg: '#111827',
    tableHeadText: '#ffffff',
    grandRowBg: '#111827',
    grandRowText: '#ffffff',
    labelColor: '#374151',
    billNameColor: '#111827',
    tripBg: '#F9FAFB',
    tripBorder: '#374151',
    tripValColor: '#111827',
    rowAlt: '#F9FAFB',
    borderColor: '#E5E7EB',
    notesBg: '#F9FAFB',
    notesAccent: '#374151',
    payValColor: '#111827',
    itemAmtColor: '#111827',
    metaTextColor: '#6B7280',
    totalRowColor: '#374151',
  },
  // ─── 9. Executive (Corporate layout) ──────────────────────────────────────
  {
    id: 'executive',
    name: 'Executive',
    description: 'Deep charcoal & violet — formal corporate boxes',
    isPremium: true,
    layout: 'corporate',
    previewColors: ['#1C1B2E', '#FAFAFA', '#7C3AED'],
    font: 'Georgia, "Times New Roman", serif',
    bodyBg: '#FAFAFA',
    bodyText: '#1C1B2E',
    companyNameColor: '#1C1B2E',
    invoiceTitleColor: '#7C3AED',
    accentColor: '#6D28D9',
    dividerCss: 'linear-gradient(90deg,#1C1B2E 0%,#7C3AED 100%)',
    dividerHeight: 3,
    tableHeadBg: '#1C1B2E',
    tableHeadText: '#EDE9FE',
    grandRowBg: '#7C3AED',
    grandRowText: '#FFFFFF',
    labelColor: '#7C3AED',
    billNameColor: '#1C1B2E',
    tripBg: '#F5F3FF',
    tripBorder: '#7C3AED',
    tripValColor: '#1C1B2E',
    rowAlt: '#F9F8FF',
    borderColor: '#DDD6FE',
    notesBg: '#F5F3FF',
    notesAccent: '#7C3AED',
    payValColor: '#1C1B2E',
    itemAmtColor: '#7C3AED',
    metaTextColor: '#6B7280',
    totalRowColor: '#374151',
  },
  // ─── 10. Emerald (Top-Banner layout) ──────────────────────────────────────
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Forest green — bold banner, premium look',
    isPremium: true,
    layout: 'top-banner',
    previewColors: ['#064E3B', '#ECFDF5', '#059669'],
    font: '"Helvetica Neue", Arial, sans-serif',
    bodyBg: '#FFFFFF',
    bodyText: '#064E3B',
    companyNameColor: '#FFFFFF',
    invoiceTitleColor: '#A7F3D0',
    accentColor: '#059669',
    dividerCss: 'linear-gradient(90deg,#064E3B 0%,#10B981 100%)',
    dividerHeight: 3,
    tableHeadBg: '#064E3B',
    tableHeadText: '#ECFDF5',
    grandRowBg: '#059669',
    grandRowText: '#FFFFFF',
    labelColor: '#059669',
    billNameColor: '#064E3B',
    tripBg: '#ECFDF5',
    tripBorder: '#10B981',
    tripValColor: '#064E3B',
    rowAlt: '#F0FDF4',
    borderColor: '#A7F3D0',
    notesBg: '#ECFDF5',
    notesAccent: '#059669',
    payValColor: '#064E3B',
    itemAmtColor: '#059669',
    metaTextColor: '#6B7280',
    totalRowColor: '#374151',
  },
  // ─── 11. Receipt (Compact layout) ─────────────────────────────────────────
  {
    id: 'receipt',
    name: 'Receipt',
    description: 'Monospace — compact centered receipt layout',
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
  // ─── 12. Logistics Pro (Sidebar layout) ────────────────────────────────────
  {
    id: 'logistics',
    name: 'Logistics Pro',
    description: 'Blue sidebar — split-column route-focused layout',
    isPremium: true,
    layout: 'sidebar',
    previewColors: ['#1E40AF', '#F8FAFC', '#60A5FA'],
    font: '"Helvetica Neue", Arial, sans-serif',
    bodyBg: '#F8FAFC',
    bodyText: '#1E293B',
    companyNameColor: '#1E3A8A',
    invoiceTitleColor: '#3B82F6',
    accentColor: '#2563EB',
    dividerCss: 'linear-gradient(90deg,#1E40AF 0%,#60A5FA 100%)',
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
    borderColor: '#BFDBFE',
    notesBg: '#EFF6FF',
    notesAccent: '#3B82F6',
    payValColor: '#1E3A8A',
    itemAmtColor: '#2563EB',
    metaTextColor: '#64748B',
    totalRowColor: '#475569',
  },
];

export function getTemplateById(id: string): TemplateStyle {
  return INVOICE_TEMPLATES.find((t) => t.id === id) ?? INVOICE_TEMPLATES[0];
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusBadgeCss(status: string): string {
  const map: Record<string, string> = {
    paid: 'background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;',
    pending: 'background:#fef9c3;color:#854d0e;border:1px solid #fde68a;',
    draft: 'background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;',
    archived: 'background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;',
  };
  return map[status] ?? map.draft;
}

async function imageToDataUrl(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('data:')) return uri;
  if (Platform.OS !== 'web' && (uri.startsWith('file://') || uri.startsWith('/'))) {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mime};base64,${base64}`;
    } catch {
      return null;
    }
  }
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise<string | null>((resolve) => {
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

/** Professional inset page border */
function pageBorder(color: string): string {
  return `<div style="position:absolute;top:10px;left:10px;right:10px;bottom:10px;border:1.5px solid ${color};pointer-events:none;"></div>`;
}

/** UPI QR code section — shown when upiId is present */
function buildQrSection(
  upiId: string,
  payeeName: string,
  amount: number,
  currency: string,
  t: TemplateStyle
): string {
  if (!upiId) return '';
  const safeName = encodeURIComponent(payeeName.replace(/[&=?]/g, ''));
  const safeUpi = encodeURIComponent(upiId);
  const currencyCode = currency === 'INR' || !currency ? 'INR' : currency;
  const upiData = `upi://pay?pa=${safeUpi}&pn=${safeName}&am=${amount.toFixed(2)}&cu=${currencyCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&bgcolor=ffffff&color=000000&qzone=1&data=${encodeURIComponent(upiData)}`;

  return `
  <div style="display:flex;align-items:center;gap:16px;background:${t.tripBg};border:1.5px solid ${t.borderColor};border-radius:10px;padding:12px 18px;margin-top:14px;">
    <div style="flex-shrink:0;border:2px solid ${t.borderColor};border-radius:8px;overflow:hidden;background:#fff;">
      <img src="${qrUrl}" alt="Scan to Pay" width="88" height="88" style="display:block;" />
    </div>
    <div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:5px;">📱 Scan & Pay via UPI</div>
      <div style="font-size:13px;font-weight:700;color:${t.payValColor};margin-bottom:4px;">${upiId}</div>
      <div style="font-size:11.5px;color:${t.metaTextColor};">Amount: <strong style="color:${t.payValColor};">${currency} ${fmt(amount)}</strong></div>
      <div style="font-size:9.5px;color:${t.metaTextColor};margin-top:4px;opacity:0.75;">Works with PhonePe · GPay · BHIM · Paytm & all UPI apps</div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 1. Standard Layout (header-left, details-right) ─────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;

  const logoHtml = logo
    ? `<img src="${logo}" alt="logo" style="height:70px;max-width:150px;object-fit:contain;border-radius:6px;display:block;margin-bottom:10px;" />`
    : '';

  const sigHtml = sig
    ? `<img src="${sig}" alt="sig" style="height:52px;max-width:160px;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : '<div style="height:44px;"></div>';

  const watermark =
    invoice.status === 'draft'
      ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:96px;font-weight:900;color:rgba(128,128,128,0.06);letter-spacing:12px;pointer-events:none;z-index:0;white-space:nowrap;">DRAFT</div>`
      : '';

  const itemRows = invoice.expenses
    .map(
      (item, i) => `
    <tr style="${i % 2 === 1 ? `background:${t.rowAlt};` : `background:${t.bodyBg};`}">
      <td style="padding:10px 14px;font-size:13px;color:${t.bodyText};font-weight:500;">${item.name}</td>
      <td style="padding:10px 14px;font-size:13px;text-align:right;font-weight:700;color:${t.itemAmtColor};">${invoice.currency} ${fmt(item.amount)}</td>
    </tr>`,
    )
    .join('');

  const settlementLabel =
    invoice.settlementStatus === 'receive'
      ? 'Driver has to <strong>receive</strong> money.'
      : invoice.settlementStatus === 'return'
        ? 'Driver has to <strong>return</strong> money.'
        : 'Fully settled — no balance due.';

  const balance = Math.abs(invoice.balance);
  const qrHtml = biz.upiId
    ? buildQrSection(biz.upiId, biz.ownerName || biz.companyName || 'Business', balance, invoice.currency, t)
    : '';

  const paymentSection =
    biz.upiId || biz.bankName
      ? `<div style="margin-bottom:22px;">
          <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:10px;">Payment Details</div>
          <div style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:0;">
            ${biz.upiId ? `<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">UPI ID</div><div style="font-size:13px;font-weight:700;color:${t.payValColor};margin-top:3px;">${biz.upiId}</div></div>` : ''}
            ${biz.bankName ? `<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">Bank</div><div style="font-size:13px;font-weight:700;color:${t.payValColor};margin-top:3px;">${biz.bankName}</div></div>` : ''}
            ${biz.accountNumber ? `<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">Account No.</div><div style="font-size:13px;font-weight:700;color:${t.payValColor};margin-top:3px;">${biz.accountNumber}</div></div>` : ''}
            ${biz.ifscCode ? `<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">IFSC</div><div style="font-size:13px;font-weight:700;color:${t.payValColor};margin-top:3px;">${biz.ifscCode}</div></div>` : ''}
          </div>
          ${qrHtml}
        </div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:#e8e8e8; font-size:13px; }
  .page { width:794px; min-height:1123px; padding:50px 54px; position:relative; background:${t.bodyBg}; margin:0 auto; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  thead tr { background:${t.tableHeadBg}; }
  thead th { padding:11px 14px; font-size:10.5px; text-transform:uppercase; letter-spacing:0.8px; color:${t.tableHeadText}; text-align:left; }
  tbody tr { border-bottom:1px solid ${t.borderColor}; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; padding:50px 54px; } }
</style>
</head>
<body>
<div class="page">
  ${pageBorder(t.borderColor)}
  ${watermark}

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:26px;">
    <div style="flex:1;">
      ${logoHtml}
      <div style="font-size:22px;font-weight:900;color:${t.companyNameColor};letter-spacing:-0.5px;line-height:1.2;">${biz.companyName || biz.ownerName || 'Company Name'}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;margin-top:6px;">
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? 'Mob: ' + biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:40px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-3px;line-height:1;">INVOICE</div>
      <div style="font-size:14px;font-weight:800;color:${t.companyNameColor};margin-top:6px;letter-spacing:0.5px;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:${t.metaTextColor};margin-top:8px;line-height:2;">
        Date: <strong>${invoice.date}</strong><br>
        ${invoice.dueDate ? 'Due: <strong>' + invoice.dueDate + '</strong>' : ''}
      </div>
      <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;margin-top:8px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <!-- DIVIDER -->
  <div style="height:${t.dividerHeight}px;background:${t.dividerCss};border-radius:2px;margin-bottom:26px;"></div>

  <!-- BILL FROM / TO -->
  <div style="display:flex;gap:0;margin-bottom:22px;">
    <div style="flex:1;padding-right:24px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill From</div>
      <div style="font-size:14px;font-weight:800;color:${t.billNameColor};">${biz.ownerName || biz.companyName || '—'}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;margin-top:4px;">
        ${biz.companyName && biz.ownerName ? biz.companyName + '<br>' : ''}
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? 'Mob: ' + biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="flex:1;padding-left:24px;border-left:2px solid ${t.borderColor};">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill To</div>
      <div style="font-size:14px;font-weight:800;color:${t.billNameColor};">${invoice.clientName}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;margin-top:4px;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
      </div>
    </div>
  </div>

  <!-- TRIP BOX -->
  <div style="background:${t.tripBg};border-left:4px solid ${t.tripBorder};border-radius:0 8px 8px 0;padding:14px 20px;margin-bottom:22px;display:flex;flex-wrap:wrap;gap:0;">
    <div style="flex:1;min-width:100px;padding-right:12px;margin-bottom:6px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;font-weight:700;">From</div>
      <div style="font-size:13px;font-weight:800;color:${t.tripValColor};">${invoice.fromLocation}</div>
    </div>
    <div style="flex:1;min-width:100px;padding-right:12px;margin-bottom:6px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;font-weight:700;">To</div>
      <div style="font-size:13px;font-weight:800;color:${t.tripValColor};">${invoice.toLocation}</div>
    </div>
    <div style="flex:1;min-width:100px;padding-right:12px;margin-bottom:6px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;font-weight:700;">Truck No.</div>
      <div style="font-size:13px;font-weight:800;color:${t.tripValColor};">${invoice.truckNumber || '—'}</div>
    </div>
    <div style="flex:1;min-width:100px;padding-right:12px;margin-bottom:6px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;font-weight:700;">Driver</div>
      <div style="font-size:13px;font-weight:800;color:${t.tripValColor};">${invoice.driverName || '—'}</div>
    </div>
    <div style="flex:1;min-width:100px;margin-bottom:6px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;font-weight:700;">Date</div>
      <div style="font-size:13px;font-weight:800;color:${t.tripValColor};">${invoice.date}</div>
    </div>
  </div>

  <!-- EXPENSES TABLE -->
  <table>
    <thead>
      <tr>
        <th style="width:66%;text-align:left;border-radius:0;">Expense / Description</th>
        <th style="width:34%;text-align:right;">Amount (${invoice.currency})</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- SETTLEMENT SUMMARY -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:22px;">
    <div style="width:300px;">
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};font-size:12.5px;">
        <span>Advance Received</span><span>${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};font-size:12.5px;">
        <span>Total Expenses</span><span>${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
      </div>
      <div style="background:${t.grandRowBg};color:${t.grandRowText};padding:13px 16px;border-radius:10px;display:flex;justify-content:space-between;font-size:15px;font-weight:900;margin-top:10px;letter-spacing:-0.3px;">
        <span>BALANCE DUE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
      </div>
      <div style="text-align:center;font-size:11.5px;font-weight:700;color:${t.labelColor};margin-top:10px;">${settlementLabel}</div>
    </div>
  </div>

  <!-- PAYMENT DETAILS + QR -->
  ${paymentSection}

  <!-- NOTES -->
  ${invoice.notes ? `<div style="background:${t.notesBg};border-left:3.5px solid ${t.notesAccent};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:20px;font-size:12px;color:${t.metaTextColor};line-height:1.9;"><strong style="color:${t.notesAccent};">Notes: </strong>${invoice.notes}</div>` : ''}
  ${invoice.paymentTerms ? `<div style="margin-bottom:18px;font-size:11.5px;color:${t.metaTextColor};line-height:1.8;"><strong>Payment Terms:</strong> ${invoice.paymentTerms}</div>` : ''}

  <!-- FOOTER -->
  <div style="border-top:2px solid ${t.borderColor};padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto;">
    <div style="font-size:11px;color:${t.metaTextColor};max-width:340px;line-height:1.9;">${biz.footerNotes || 'Thank you for your business.'}</div>
    <div style="text-align:center;min-width:180px;">
      ${sigHtml}
      <div style="width:160px;height:1px;background:${t.metaTextColor};margin:0 auto 8px;"></div>
      <div style="font-size:9.5px;color:${t.metaTextColor};text-transform:uppercase;letter-spacing:1px;">Authorized Signature</div>
      <div style="font-size:12px;font-weight:700;color:${t.billNameColor};margin-top:4px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>

  <div style="position:absolute;bottom:22px;right:54px;font-size:10px;color:${t.metaTextColor};opacity:0.5;">Page 1 of 1</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 2. Top-Banner Layout (full-width gradient header) ────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderTopBannerHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;
  const accent = t.accentColor ?? t.invoiceTitleColor;

  const logoHtml = logo
    ? `<img src="${logo}" alt="logo" style="height:58px;max-width:130px;object-fit:contain;border-radius:6px;display:block;margin-bottom:12px;opacity:0.95;" />`
    : '';

  const sigHtml = sig
    ? `<img src="${sig}" alt="sig" style="height:48px;max-width:140px;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : '<div style="height:40px;"></div>';

  const watermark =
    invoice.status === 'draft'
      ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:96px;font-weight:900;color:rgba(128,128,128,0.06);letter-spacing:12px;pointer-events:none;">DRAFT</div>`
      : '';

  const itemRows = invoice.expenses
    .map(
      (item, i) => `
    <tr style="${i % 2 === 1 ? `background:${t.rowAlt};` : `background:${t.bodyBg};`}">
      <td style="padding:10px 14px;font-size:13px;color:${t.bodyText};font-weight:500;">${item.name}</td>
      <td style="padding:10px 14px;font-size:13px;text-align:right;font-weight:700;color:${t.itemAmtColor};">${invoice.currency} ${fmt(item.amount)}</td>
    </tr>`,
    )
    .join('');

  const balance = Math.abs(invoice.balance);
  const qrHtml = biz.upiId
    ? buildQrSection(biz.upiId, biz.ownerName || biz.companyName || 'Business', balance, invoice.currency, t)
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:#e8e8e8; font-size:13px; }
  .page { width:794px; min-height:1123px; position:relative; background:${t.bodyBg}; margin:0 auto; overflow:hidden; }
  .banner { background:${t.dividerCss};padding:32px 46px;display:flex;justify-content:space-between;align-items:center; }
  .content { padding:32px 46px; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  thead tr { background:${t.tableHeadBg}; }
  thead th { padding:11px 14px; font-size:10.5px; text-transform:uppercase; letter-spacing:0.8px; color:${t.tableHeadText}; text-align:left; }
  tbody tr { border-bottom:1px solid ${t.borderColor}; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; } }
</style>
</head>
<body>
<div class="page">
  ${pageBorder(accent + '40')}
  ${watermark}

  <!-- TOP BANNER -->
  <div class="banner">
    <div>
      ${logoHtml}
      <div style="font-size:24px;font-weight:900;color:${t.companyNameColor};letter-spacing:-0.5px;line-height:1.2;">${biz.companyName || biz.ownerName || 'Company'}</div>
      <div style="font-size:11px;color:${t.invoiceTitleColor};line-height:1.9;margin-top:6px;opacity:0.88;">
        ${biz.address ? biz.address + ' · ' : ''}${biz.mobile || ''}${biz.gstNumber ? ' · GSTIN: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:42px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-3px;line-height:1;opacity:0.85;">INVOICE</div>
      <div style="font-size:14px;font-weight:800;color:${t.companyNameColor};margin-top:8px;letter-spacing:0.5px;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:${t.invoiceTitleColor};margin-top:6px;line-height:2;opacity:0.85;">
        Date: ${invoice.date}${invoice.dueDate ? ' · Due: ' + invoice.dueDate : ''}
      </div>
      <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;margin-top:8px;background:rgba(255,255,255,0.15);color:${t.companyNameColor};border:1px solid rgba(255,255,255,0.3);">${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <div class="content">
    <!-- BILL FROM / TO -->
    <div style="display:flex;gap:16px;margin-bottom:20px;">
      <div style="flex:1;background:${t.tripBg};border-radius:10px;padding:14px 16px;border:1px solid ${t.borderColor};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill From</div>
        <div style="font-size:14px;font-weight:800;color:${t.billNameColor};">${biz.ownerName || biz.companyName || '—'}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;margin-top:4px;">
          ${biz.companyName && biz.ownerName ? biz.companyName + '<br>' : ''}
          ${biz.address ? biz.address + '<br>' : ''}
          ${biz.mobile ? 'Mob: ' + biz.mobile : ''}
          ${biz.gstNumber ? '<br>GSTIN: ' + biz.gstNumber : ''}
        </div>
      </div>
      <div style="flex:1;background:${t.tripBg};border-radius:10px;padding:14px 16px;border:1.5px solid ${t.tripBorder};border-left:4px solid ${t.tripBorder};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill To</div>
        <div style="font-size:14px;font-weight:800;color:${t.billNameColor};">${invoice.clientName}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;margin-top:4px;">
          ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
          ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
          ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
        </div>
      </div>
    </div>

    <!-- TRIP INFO ROW -->
    <div style="display:flex;gap:0;background:${t.tripBg};border-radius:10px;padding:14px 18px;margin-bottom:20px;border:1px solid ${t.borderColor};flex-wrap:wrap;">
      ${[
        { label: 'From', val: invoice.fromLocation },
        { label: 'To', val: invoice.toLocation },
        { label: 'Truck No.', val: invoice.truckNumber || '—' },
        { label: 'Driver', val: invoice.driverName || '—' },
        { label: 'Date', val: invoice.date },
      ].map(f => `
        <div style="flex:1;min-width:100px;padding-right:10px;margin-bottom:4px;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;font-weight:700;">${f.label}</div>
          <div style="font-size:13px;font-weight:800;color:${t.tripValColor};">${f.val}</div>
        </div>`).join('')}
    </div>

    <!-- EXPENSES TABLE -->
    <table>
      <thead>
        <tr>
          <th style="width:66%;text-align:left;">Expense / Description</th>
          <th style="width:34%;text-align:right;">Amount (${invoice.currency})</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- TOTALS + PAYMENT side by side -->
    <div style="display:flex;gap:20px;margin-bottom:20px;align-items:flex-start;">
      <!-- Payment / QR side -->
      <div style="flex:1;">
        ${biz.upiId || biz.bankName ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Payment Details</div>
          ${biz.bankName ? `<div style="font-size:12px;color:${t.payValColor};margin-bottom:3px;"><strong>${biz.bankName}</strong></div>` : ''}
          ${biz.accountNumber ? `<div style="font-size:11px;color:${t.metaTextColor};">A/C: ${biz.accountNumber}</div>` : ''}
          ${biz.ifscCode ? `<div style="font-size:11px;color:${t.metaTextColor};">IFSC: ${biz.ifscCode}</div>` : ''}
        </div>` : ''}
        ${qrHtml}
      </div>

      <!-- Totals -->
      <div style="width:260px;flex-shrink:0;">
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};font-size:12.5px;">
          <span>Advance Received</span><span>${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};font-size:12.5px;">
          <span>Total Expenses</span><span>${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
        </div>
        <div style="background:${t.grandRowBg};color:${t.grandRowText};padding:13px 16px;border-radius:10px;display:flex;justify-content:space-between;font-size:15px;font-weight:900;margin-top:10px;">
          <span>BALANCE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
        </div>
        <div style="text-align:center;font-size:11px;font-weight:700;color:${t.labelColor};margin-top:10px;">
          ${invoice.settlementStatus === 'receive' ? 'Driver to receive money' : invoice.settlementStatus === 'return' ? 'Driver to return money' : 'Fully settled'}
        </div>
      </div>
    </div>

    <!-- NOTES -->
    ${invoice.notes ? `<div style="background:${t.notesBg};border-left:3.5px solid ${t.notesAccent};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:18px;font-size:12px;color:${t.metaTextColor};line-height:1.9;"><strong style="color:${t.notesAccent};">Notes: </strong>${invoice.notes}</div>` : ''}
    ${invoice.paymentTerms ? `<div style="margin-bottom:16px;font-size:11.5px;color:${t.metaTextColor};line-height:1.8;"><strong>Payment Terms:</strong> ${invoice.paymentTerms}</div>` : ''}

    <!-- FOOTER -->
    <div style="border-top:2px solid ${t.borderColor};padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end;margin-top:16px;">
      <div style="font-size:11px;color:${t.metaTextColor};max-width:320px;line-height:1.9;">${biz.footerNotes || 'Thank you for your business.'}</div>
      <div style="text-align:center;min-width:170px;">
        ${sigHtml}
        <div style="width:150px;height:1px;background:${t.metaTextColor};margin:0 auto 8px;"></div>
        <div style="font-size:9.5px;color:${t.metaTextColor};text-transform:uppercase;letter-spacing:1px;">Authorized Signature</div>
        <div style="font-size:12px;font-weight:700;color:${t.billNameColor};margin-top:4px;">${biz.ownerName || biz.companyName || ''}</div>
      </div>
    </div>
  </div>

  <div style="position:absolute;bottom:22px;right:46px;font-size:10px;color:${t.metaTextColor};opacity:0.5;">Page 1 of 1</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 3. Corporate Layout (formal two-box header, accent bar footer) ───────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderCorporateHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;
  const accent = t.accentColor ?? t.tableHeadBg;

  const logoHtml = logo
    ? `<img src="${logo}" alt="logo" style="height:60px;max-width:130px;object-fit:contain;border-radius:4px;display:block;margin-bottom:10px;" />`
    : '';

  const sigHtml = sig
    ? `<img src="${sig}" alt="sig" style="height:50px;max-width:150px;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : '<div style="height:44px;"></div>';

  const watermark =
    invoice.status === 'draft'
      ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:96px;font-weight:900;color:rgba(128,128,128,0.06);letter-spacing:12px;pointer-events:none;">DRAFT</div>`
      : '';

  const itemRows = invoice.expenses
    .map(
      (item, i) => `
    <tr style="${i % 2 === 1 ? `background:${t.rowAlt};` : `background:#ffffff;`}">
      <td style="padding:10px 14px;font-size:13px;color:${t.bodyText};font-weight:500;">${item.name}</td>
      <td style="padding:10px 14px;font-size:13px;text-align:right;font-weight:700;color:${t.itemAmtColor};">${invoice.currency} ${fmt(item.amount)}</td>
    </tr>`,
    )
    .join('');

  const balance = Math.abs(invoice.balance);
  const qrHtml = biz.upiId
    ? buildQrSection(biz.upiId, biz.ownerName || biz.companyName || 'Business', balance, invoice.currency, t)
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:#e8e8e8; font-size:13px; }
  .page { width:794px; min-height:1123px; padding:0; position:relative; background:${t.bodyBg}; margin:0 auto; }
  .corp-top-bar { height:8px; background:${t.dividerCss}; }
  .corp-content { padding:40px 50px; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  thead tr { background:${t.tableHeadBg}; }
  thead th { padding:11px 14px; font-size:10.5px; text-transform:uppercase; letter-spacing:0.8px; color:${t.tableHeadText}; text-align:left; }
  tbody tr { border-bottom:1px solid ${t.borderColor}; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; } }
</style>
</head>
<body>
<div class="page">
  ${pageBorder(accent + '30')}
  ${watermark}

  <!-- TOP ACCENT BAR -->
  <div class="corp-top-bar"></div>

  <div class="corp-content">
    <!-- CORPORATE HEADER: Company box left | Invoice box right -->
    <div style="display:flex;gap:20px;margin-bottom:24px;">
      <!-- Company Box -->
      <div style="flex:1;border:1.5px solid ${t.borderColor};border-radius:10px;padding:18px 20px;border-top:4px solid ${accent};">
        ${logoHtml}
        <div style="font-size:20px;font-weight:900;color:${t.companyNameColor};letter-spacing:-0.5px;margin-bottom:8px;">${biz.companyName || biz.ownerName || 'Company'}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;">
          ${biz.address ? biz.address + '<br>' : ''}
          ${biz.mobile ? 'Mobile: ' + biz.mobile + '<br>' : ''}
          ${biz.gstNumber ? 'GSTIN: ' + biz.gstNumber : ''}
        </div>
      </div>
      <!-- Invoice Box -->
      <div style="width:220px;flex-shrink:0;border:1.5px solid ${t.borderColor};border-radius:10px;padding:18px 20px;text-align:right;background:${t.tripBg};border-top:4px solid ${accent};">
        <div style="font-size:28px;font-weight:900;color:${accent};letter-spacing:-2px;line-height:1;margin-bottom:8px;">INVOICE</div>
        <div style="font-size:14px;font-weight:800;color:${t.companyNameColor};margin-bottom:10px;"># ${invoice.invoiceNumber}</div>
        <table style="font-size:11px;margin-bottom:10px;width:100%;">
          <tr>
            <td style="color:${t.metaTextColor};text-align:left;padding:3px 0;">Date:</td>
            <td style="font-weight:700;color:${t.companyNameColor};text-align:right;">${invoice.date}</td>
          </tr>
          ${invoice.dueDate ? `<tr><td style="color:${t.metaTextColor};text-align:left;padding:3px 0;">Due Date:</td><td style="font-weight:700;color:${t.companyNameColor};text-align:right;">${invoice.dueDate}</td></tr>` : ''}
        </table>
        <div style="display:inline-block;padding:5px 12px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
      </div>
    </div>

    <!-- HORIZONTAL DIVIDER -->
    <div style="height:1.5px;background:${t.dividerCss};border-radius:2px;margin-bottom:22px;"></div>

    <!-- BILL FROM / TO -->
    <div style="display:flex;gap:16px;margin-bottom:20px;">
      <div style="flex:1;background:${t.tripBg};border-radius:8px;padding:14px 16px;border:1px solid ${t.borderColor};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;border-bottom:1px solid ${t.borderColor};padding-bottom:6px;">Bill From</div>
        <div style="font-size:14px;font-weight:800;color:${t.billNameColor};margin-bottom:4px;">${biz.ownerName || biz.companyName || '—'}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;">
          ${biz.companyName && biz.ownerName ? biz.companyName + '<br>' : ''}
          ${biz.mobile ? 'Mob: ' + biz.mobile + '<br>' : ''}
          ${biz.gstNumber ? 'GSTIN: ' + biz.gstNumber : ''}
        </div>
      </div>
      <div style="flex:1;background:${t.tripBg};border-radius:8px;padding:14px 16px;border:1px solid ${t.borderColor};border-left:4px solid ${accent};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;border-bottom:1px solid ${t.borderColor};padding-bottom:6px;">Bill To</div>
        <div style="font-size:14px;font-weight:800;color:${t.billNameColor};margin-bottom:4px;">${invoice.clientName}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;">
          ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
          ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
          ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
        </div>
      </div>
    </div>

    <!-- TRIP DETAILS (table style) -->
    <div style="background:${t.tripBg};border-radius:8px;padding:14px 18px;margin-bottom:20px;border:1px solid ${t.borderColor};display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
      ${[
        { label: 'From', val: invoice.fromLocation },
        { label: 'To', val: invoice.toLocation },
        { label: 'Truck No.', val: invoice.truckNumber || '—' },
        { label: 'Driver', val: invoice.driverName || '—' },
        { label: 'Date', val: invoice.date },
      ].map(f => `
        <div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};font-weight:700;margin-bottom:4px;">${f.label}</div>
          <div style="font-size:12.5px;font-weight:800;color:${t.tripValColor};">${f.val}</div>
        </div>`).join('')}
    </div>

    <!-- EXPENSES TABLE -->
    <table>
      <thead>
        <tr>
          <th style="width:66%;text-align:left;border-radius:0;">Expense / Description</th>
          <th style="width:34%;text-align:right;">Amount (${invoice.currency})</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- TOTALS + PAYMENT/QR side by side -->
    <div style="display:flex;gap:20px;margin-bottom:20px;align-items:flex-start;">
      <!-- Payment + QR -->
      <div style="flex:1;">
        ${biz.upiId || biz.bankName ? `
        <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:10px;">Payment Details</div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:0;">
          ${biz.upiId ? `<div><div style="font-size:9px;color:${t.metaTextColor};">UPI ID</div><div style="font-size:12.5px;font-weight:700;color:${t.payValColor};margin-top:2px;">${biz.upiId}</div></div>` : ''}
          ${biz.bankName ? `<div><div style="font-size:9px;color:${t.metaTextColor};">Bank</div><div style="font-size:12.5px;font-weight:700;color:${t.payValColor};margin-top:2px;">${biz.bankName}</div></div>` : ''}
          ${biz.accountNumber ? `<div><div style="font-size:9px;color:${t.metaTextColor};">A/C No.</div><div style="font-size:12.5px;font-weight:700;color:${t.payValColor};margin-top:2px;">${biz.accountNumber}</div></div>` : ''}
          ${biz.ifscCode ? `<div><div style="font-size:9px;color:${t.metaTextColor};">IFSC</div><div style="font-size:12.5px;font-weight:700;color:${t.payValColor};margin-top:2px;">${biz.ifscCode}</div></div>` : ''}
        </div>` : ''}
        ${qrHtml}
      </div>
      <!-- Totals box -->
      <div style="width:260px;flex-shrink:0;">
        <div style="border:1.5px solid ${t.borderColor};border-radius:10px;overflow:hidden;">
          <div style="padding:9px 14px;border-bottom:1px solid ${t.borderColor};display:flex;justify-content:space-between;font-size:12.5px;color:${t.totalRowColor};background:${t.bodyBg};">
            <span>Advance</span><span>${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
          </div>
          <div style="padding:9px 14px;border-bottom:1px solid ${t.borderColor};display:flex;justify-content:space-between;font-size:12.5px;color:${t.totalRowColor};background:${t.bodyBg};">
            <span>Total Expenses</span><span>${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
          </div>
          <div style="padding:13px 16px;display:flex;justify-content:space-between;font-size:15px;font-weight:900;background:${t.grandRowBg};color:${t.grandRowText};">
            <span>BALANCE DUE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
          </div>
        </div>
        <div style="text-align:center;font-size:11px;font-weight:700;color:${t.labelColor};margin-top:10px;">
          ${invoice.settlementStatus === 'receive' ? 'Driver to receive money' : invoice.settlementStatus === 'return' ? 'Driver to return money' : 'Fully settled — no balance'}
        </div>
      </div>
    </div>

    <!-- NOTES -->
    ${invoice.notes ? `<div style="background:${t.notesBg};border-left:3.5px solid ${t.notesAccent};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:18px;font-size:12px;color:${t.metaTextColor};line-height:1.9;"><strong style="color:${t.notesAccent};">Notes: </strong>${invoice.notes}</div>` : ''}
    ${invoice.paymentTerms ? `<div style="margin-bottom:16px;font-size:11.5px;color:${t.metaTextColor};line-height:1.8;"><strong>Payment Terms:</strong> ${invoice.paymentTerms}</div>` : ''}

    <!-- FOOTER + SIGNATURE -->
    <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1.5px solid ${t.borderColor};padding-top:18px;">
      <div style="font-size:11px;color:${t.metaTextColor};max-width:320px;line-height:1.9;">${biz.footerNotes || 'Thank you for your business.'}</div>
      <div style="text-align:center;min-width:170px;">
        ${sigHtml}
        <div style="width:150px;height:1px;background:${t.metaTextColor};margin:0 auto 8px;"></div>
        <div style="font-size:9.5px;color:${t.metaTextColor};text-transform:uppercase;letter-spacing:1px;">Authorized Signature</div>
        <div style="font-size:12px;font-weight:700;color:${t.billNameColor};margin-top:4px;">${biz.ownerName || biz.companyName || ''}</div>
      </div>
    </div>
  </div>

  <!-- BOTTOM ACCENT BAR -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:${t.dividerCss};"></div>
  <div style="position:absolute;bottom:14px;right:50px;font-size:10px;color:${t.metaTextColor};opacity:0.5;">Page 1 of 1</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 4. Compact / Receipt Layout ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

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
  ${pageBorder(t.borderColor)}

  <!-- Centered company header -->
  <div style="text-align:center;margin-bottom:12px;">
    ${logo ? `<img src="${logo}" alt="logo" style="height:52px;object-fit:contain;display:block;margin:0 auto 10px;" />` : ''}
    <div style="font-size:20px;font-weight:900;color:${t.companyNameColor};letter-spacing:-0.5px;">${biz.companyName || biz.ownerName || 'Company'}</div>
    <div style="font-size:11px;color:${t.metaTextColor};margin-top:4px;line-height:1.8;">
      ${biz.address ? biz.address + ' · ' : ''}${biz.mobile ?? ''}${biz.gstNumber ? ' · GSTIN: ' + biz.gstNumber : ''}
    </div>
  </div>

  <div style="border-top:2px solid ${t.bodyText};margin-bottom:14px;"></div>

  <!-- Invoice title -->
  <div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:28px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-1.5px;">INVOICE</div>
    <div style="font-size:13px;font-weight:700;color:${t.companyNameColor};margin-top:4px;">No. ${invoice.invoiceNumber}</div>
    <div style="font-size:11px;color:${t.metaTextColor};margin-top:4px;">
      Date: ${invoice.date}${invoice.dueDate ? ' · Due: ' + invoice.dueDate : ''}
    </div>
    <div style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-top:6px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
  </div>

  <div style="border-top:1px dashed ${t.borderColor};margin-bottom:12px;"></div>

  <!-- Bill to -->
  <div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:4px;">BILL TO</div>
    <div style="font-size:16px;font-weight:800;color:${t.billNameColor};">${invoice.clientName}</div>
    <div style="font-size:11px;color:${t.metaTextColor};margin-top:3px;line-height:1.7;">
      ${invoice.clientPhone ? invoice.clientPhone : ''}${invoice.clientAddress ? ' · ' + invoice.clientAddress : ''}
    </div>
  </div>

  <div style="border-top:1px dashed ${t.borderColor};margin-bottom:10px;"></div>

  <!-- Trip compact -->
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
  <div style="width:220px;margin:0 auto 16px;">
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11.5px;color:${t.totalRowColor};border-bottom:1px solid ${t.borderColor};">
      <span>Advance</span><span>${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11.5px;color:${t.totalRowColor};border-bottom:1px solid ${t.borderColor};">
      <span>Total Expenses</span><span>${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:10px 14px;border-radius:8px;background:${t.grandRowBg};color:${t.grandRowText};font-size:14px;font-weight:900;">
      <span>BALANCE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
    </div>
  </div>

  ${biz.upiId ? `<div style="text-align:center;font-size:11px;color:${t.metaTextColor};margin-bottom:10px;">UPI: <strong style="color:${t.payValColor};">${biz.upiId}</strong></div>` : ''}
  ${invoice.notes ? `<div style="background:${t.notesBg};border:1px dashed ${t.notesAccent};border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:11px;color:${t.metaTextColor};text-align:center;line-height:1.7;"><strong style="color:${t.notesAccent};">Note:</strong> ${invoice.notes}</div>` : ''}

  <div style="border-top:2px solid ${t.bodyText};padding-top:14px;margin-top:14px;text-align:center;">
    <div style="font-size:11px;color:${t.metaTextColor};line-height:1.8;">${biz.footerNotes || 'Thank you for your business.'}</div>
    <div style="margin-top:14px;">
      ${sig ? `<img src="${sig}" alt="sig" style="height:42px;object-fit:contain;display:block;margin:0 auto 6px;" />` : '<div style="height:36px;"></div>'}
      <div style="width:140px;height:1px;background:${t.metaTextColor};margin:0 auto 6px;"></div>
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">Authorized Signature</div>
      <div style="font-size:11.5px;font-weight:700;color:${t.billNameColor};margin-top:3px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>

  <div style="position:absolute;bottom:22px;right:60px;font-size:10px;color:${t.metaTextColor};opacity:0.5;">Page 1</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── 5. Sidebar Layout (split-column) ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

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

  const balance = Math.abs(invoice.balance);
  const qrHtml = biz.upiId
    ? buildQrSection(biz.upiId, biz.ownerName || biz.companyName || 'Business', balance, invoice.currency, t)
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; background:#e8e8e8; font-family:${t.font}; font-size:13px; }
  .layout { display:flex; width:794px; min-height:1123px; position:relative; }
  .sidebar { width:230px; min-height:1123px; background:${t.tableHeadBg}; padding:42px 22px; display:flex; flex-direction:column; position:relative; }
  .main { flex:1; background:#ffffff; padding:40px 32px; position:relative; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } }
</style>
</head>
<body>
<div class="layout">
  <!-- ── LEFT SIDEBAR ── -->
  <div class="sidebar">
    ${logo ? `<img src="${logo}" alt="logo" style="height:52px;max-width:178px;object-fit:contain;border-radius:6px;margin-bottom:14px;background:rgba(255,255,255,0.1);padding:4px;display:block;" />` : ''}
    <div style="font-size:14px;font-weight:900;color:#ffffff;margin-bottom:5px;line-height:1.3;">${biz.companyName || biz.ownerName || 'Company'}</div>
    <div style="font-size:10px;color:rgba(255,255,255,0.65);line-height:1.85;margin-bottom:18px;">
      ${biz.address ? biz.address + '<br>' : ''}
      ${biz.mobile ? 'Tel: ' + biz.mobile + '<br>' : ''}
      ${biz.gstNumber ? 'GSTIN: ' + biz.gstNumber : ''}
    </div>

    <div style="height:1px;background:rgba(255,255,255,0.18);margin-bottom:18px;"></div>

    <!-- Route -->
    <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:13px 14px;margin-bottom:14px;">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.5);margin-bottom:8px;">ROUTE</div>
      <div style="font-size:12.5px;font-weight:800;color:#ffffff;margin-bottom:4px;">${invoice.fromLocation}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:4px;text-align:center;">↓ ↓ ↓</div>
      <div style="font-size:12.5px;font-weight:800;color:#ffffff;">${invoice.toLocation}</div>
    </div>

    ${invoice.truckNumber ? `<div style="margin-bottom:10px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.5);margin-bottom:3px;">TRUCK</div><div style="font-size:12px;font-weight:700;color:#ffffff;">${invoice.truckNumber}</div></div>` : ''}
    ${invoice.driverName ? `<div style="margin-bottom:10px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.5);margin-bottom:3px;">DRIVER</div><div style="font-size:12px;font-weight:700;color:#ffffff;">${invoice.driverName}</div></div>` : ''}
    <div style="margin-bottom:14px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.5);margin-bottom:3px;">DATE</div><div style="font-size:12px;font-weight:700;color:#ffffff;">${invoice.date}</div></div>

    <div style="height:1px;background:rgba(255,255,255,0.18);margin-bottom:14px;"></div>

    ${(biz.upiId || biz.bankName) ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.5);margin-bottom:8px;">PAYMENT INFO</div>
      ${biz.upiId ? `<div style="font-size:10.5px;color:rgba(255,255,255,0.82);margin-bottom:3px;">UPI: ${biz.upiId}</div>` : ''}
      ${biz.bankName ? `<div style="font-size:10.5px;color:rgba(255,255,255,0.82);margin-bottom:2px;">${biz.bankName}</div>` : ''}
      ${biz.accountNumber ? `<div style="font-size:10px;color:rgba(255,255,255,0.6);">A/C: ${biz.accountNumber}</div>` : ''}
      ${biz.ifscCode ? `<div style="font-size:10px;color:rgba(255,255,255,0.6);">IFSC: ${biz.ifscCode}</div>` : ''}
    </div>` : ''}

    <!-- Signature at bottom of sidebar -->
    <div style="position:absolute;bottom:40px;left:22px;right:22px;">
      ${sig ? `<img src="${sig}" alt="sig" style="height:40px;max-width:138px;object-fit:contain;display:block;margin-bottom:5px;opacity:0.9;" />` : '<div style="height:36px;"></div>'}
      <div style="width:120px;height:1px;background:rgba(255,255,255,0.35);margin-bottom:5px;"></div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.45);">Authorized Signature</div>
      <div style="font-size:10.5px;font-weight:700;color:rgba(255,255,255,0.75);margin-top:3px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>

  <!-- ── MAIN CONTENT ── -->
  <div class="main">
    <!-- Invoice header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
      <div>
        <div style="font-size:38px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-3px;line-height:1;">INVOICE</div>
        <div style="font-size:14px;font-weight:800;color:${t.companyNameColor};margin-top:6px;"># ${invoice.invoiceNumber}</div>
      </div>
      <div style="text-align:right;">
        <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
        <div style="font-size:11px;color:${t.metaTextColor};margin-top:8px;line-height:2;">
          Date: <strong>${invoice.date}</strong>${invoice.dueDate ? '<br>Due: <strong>' + invoice.dueDate + '</strong>' : ''}
        </div>
      </div>
    </div>

    <div style="height:3px;background:${t.dividerCss};border-radius:2px;margin-bottom:20px;"></div>

    <!-- Bill To -->
    <div style="margin-bottom:20px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill To</div>
      <div style="font-size:15px;font-weight:800;color:${t.billNameColor};margin-bottom:4px;">${invoice.clientName}</div>
      <div style="font-size:11.5px;color:${t.metaTextColor};line-height:1.8;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
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
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <div style="width:250px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};font-size:12.5px;">
          <span>Advance Received</span><span>${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};font-size:12.5px;">
          <span>Total Expenses</span><span>${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:12px 14px;border-radius:10px;background:${t.grandRowBg};color:${t.grandRowText};font-size:14px;font-weight:900;margin-top:10px;">
          <span>BALANCE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
        </div>
        <div style="text-align:right;font-size:11px;font-weight:700;color:${t.labelColor};margin-top:8px;">
          ${invoice.balance >= 0 ? 'Driver to receive money' : 'Driver to return money'}
        </div>
      </div>
    </div>

    ${qrHtml ? `<div style="margin-bottom:16px;">${qrHtml}</div>` : ''}

    ${invoice.notes ? `<div style="background:${t.notesBg};border-left:3px solid ${t.notesAccent};border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:14px;font-size:11.5px;color:${t.metaTextColor};line-height:1.8;"><strong style="color:${t.notesAccent};">Notes:</strong> ${invoice.notes}</div>` : ''}
    ${invoice.paymentTerms ? `<div style="margin-bottom:14px;font-size:11px;color:${t.metaTextColor};line-height:1.7;"><strong>Payment Terms:</strong> ${invoice.paymentTerms}</div>` : ''}

    <!-- Footer note -->
    <div style="position:absolute;bottom:40px;left:32px;right:32px;">
      <div style="border-top:1px solid ${t.borderColor};padding-top:14px;font-size:11px;color:${t.metaTextColor};line-height:1.8;">${biz.footerNotes || 'Thank you for your business.'}</div>
    </div>
    <div style="position:absolute;bottom:20px;right:32px;font-size:10px;color:${t.metaTextColor};opacity:0.5;">Page 1 of 1</div>
  </div>

</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Dispatcher ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function buildInvoiceHTML(invoice: Invoice, templateId: string): Promise<string> {
  const t = getTemplateById(templateId);
  const biz = invoice.businessSnapshot;
  const [logo, sig] = await Promise.all([
    biz.logoUri ? imageToDataUrl(biz.logoUri) : Promise.resolve(null),
    biz.signatureUri ? imageToDataUrl(biz.signatureUri) : Promise.resolve(null),
  ]);

  switch (t.layout) {
    case 'top-banner': return renderTopBannerHTML(invoice, t, logo, sig);
    case 'corporate':  return renderCorporateHTML(invoice, t, logo, sig);
    case 'compact':    return renderCompactHTML(invoice, t, logo, sig);
    case 'sidebar':    return renderSidebarHTML(invoice, t, logo, sig);
    default:           return renderHTML(invoice, t, logo, sig);
  }
}

export interface PDFResult {
  uri: string;
}

export async function generatePDFWithTemplate(invoice: Invoice, templateId: string): Promise<PDFResult> {
  console.log('[PDF] generatePDFWithTemplate — invoice:', invoice.invoiceNumber, '| template:', templateId);

  const html = await buildInvoiceHTML(invoice, templateId);
  console.log('[PDF] HTML length:', html.length, 'chars — template:', templateId);

  if (html.length < 200) {
    throw new Error('Invoice HTML is empty — check template configuration.');
  }

  if (Platform.OS === 'web') {
    const blob = new Blob([html], { type: 'text/html' });
    const uri = URL.createObjectURL(blob);
    return { uri };
  }

  const tryGenerate = async (): Promise<string> => {
    const result = await Print.printToFileAsync({ html, base64: false });
    console.log('[PDF] Generated URI:', result.uri);
    const info = await FileSystem.getInfoAsync(result.uri);
    const size = info.exists ? ((info as { exists: true; size: number }).size ?? 0) : 0;
    console.log('[PDF] File size:', size, 'bytes');
    if (!info.exists || size < 1024) {
      throw new Error(`PDF file is ${size} bytes — too small (minimum 1 KB).`);
    }
    return result.uri;
  };

  try {
    const uri = await tryGenerate();
    return { uri };
  } catch (firstErr) {
    console.warn('[PDF] First attempt failed, retrying...', firstErr);
    const uri = await tryGenerate();
    return { uri };
  }
}
