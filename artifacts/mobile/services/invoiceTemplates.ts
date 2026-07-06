/**
 * FleetInvoice — Invoice Template System
 *
 * 8 completely different layout renderers:
 *   1. classic-geometric  — Indian transport with SVG geometric corner ornaments
 *   2. top-banner         — Full-width gradient header (modern / transport / emerald)
 *   3. corporate          — Formal two-box header with accent bars
 *   4. compact            — Centered receipt / narrow mobile layout
 *   5. sidebar            — Dark split-column sidebar layout
 *   6. gst-v2             — GST-compliant tax invoice with CGST/SGST breakdown
 *   7. premium-dark       — Dark luxury with gold accents
 *   8. standard           — Clean classic header-left layout (minimal / navy)
 */

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { Invoice } from '@/types';

// ─── Template descriptor ──────────────────────────────────────────────────────

export interface TemplateStyle {
  id: string;
  name: string;
  description: string;
  isPremium: boolean;
  layout?:
    | 'standard'
    | 'compact'
    | 'sidebar'
    | 'top-banner'
    | 'corporate'
    | 'classic-geometric'
    | 'gst-v2'
    | 'premium-dark';
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
  accentColor?: string;
}

// ─── Template library ─────────────────────────────────────────────────────────

export const INVOICE_TEMPLATES: TemplateStyle[] = [
  // ─── 1. Classic Geometric ─────────────────────────────────────────────────
  {
    id: 'classic',
    name: 'Classic Geometric',
    description: 'Deep navy & burnt orange — Indian transport with geometric corner ornaments',
    isPremium: false,
    layout: 'classic-geometric',
    previewColors: ['#0D2B5E', '#FFFFFF', '#D64E00'],
    font: 'Arial, Helvetica, sans-serif',
    bodyBg: '#ffffff',
    bodyText: '#0A1628',
    companyNameColor: '#0D2B5E',
    invoiceTitleColor: '#D64E00',
    accentColor: '#D64E00',
    dividerCss: 'linear-gradient(90deg,#0D2B5E 0%,#D64E00 100%)',
    dividerHeight: 5,
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
  // ─── 2. Modern (Top-Banner) ───────────────────────────────────────────────
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
  // ─── 3. Corporate (Corporate two-box) ────────────────────────────────────
  {
    id: 'blue',
    name: 'Corporate',
    description: 'Royal blue — formal corporate two-box header with accent bars',
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
  // ─── 4. Transport Pro (Top-Banner) ───────────────────────────────────────
  {
    id: 'transport',
    name: 'Transport Pro',
    description: 'Amber & brown — bold trucking invoice with route banner',
    isPremium: false,
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
  // ─── 5. Premium Dark ─────────────────────────────────────────────────────
  {
    id: 'dark',
    name: 'Premium Dark',
    description: 'Luxury dark charcoal — gold accents, glass-effect highlights',
    isPremium: true,
    layout: 'premium-dark',
    previewColors: ['#0C0A09', '#1C1917', '#D97706'],
    font: '"Helvetica Neue", Arial, sans-serif',
    bodyBg: '#111827',
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
    borderColor: '#374151',
    notesBg: '#1C1917',
    notesAccent: '#D97706',
    payValColor: '#FAFAF9',
    itemAmtColor: '#FBBF24',
    metaTextColor: '#9CA3AF',
    totalRowColor: '#D6D3D1',
  },
  // ─── 6. GST Invoice ──────────────────────────────────────────────────────
  {
    id: 'gst',
    name: 'GST Invoice',
    description: 'Forest green — GST-compliant tax invoice with CGST/SGST breakdown',
    isPremium: false,
    layout: 'gst-v2',
    previewColors: ['#14532D', '#F0FDF4', '#16A34A'],
    font: 'Arial, Helvetica, sans-serif',
    bodyBg: '#ffffff',
    bodyText: '#052E16',
    companyNameColor: '#14532D',
    invoiceTitleColor: '#16A34A',
    accentColor: '#15803D',
    dividerCss: 'linear-gradient(90deg,#14532D 0%,#22C55E 100%)',
    dividerHeight: 4,
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
  // ─── 7. Orange (Top-Banner) ───────────────────────────────────────────────
  {
    id: 'orange',
    name: 'Warm Amber',
    description: 'Warm amber — bold full-width banner with serif warmth',
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
  // ─── 8. Minimal ───────────────────────────────────────────────────────────
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Pure black & white — hairlines only, ultra-clean typography',
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
  // ─── 9. Executive (Corporate) ─────────────────────────────────────────────
  {
    id: 'executive',
    name: 'Executive',
    description: 'Deep charcoal & violet — formal corporate two-box layout',
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
  // ─── 10. Emerald (Top-Banner) ─────────────────────────────────────────────
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Forest green — bold gradient banner, premium look',
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
  // ─── 11. Receipt (Compact) ────────────────────────────────────────────────
  {
    id: 'receipt',
    name: 'Receipt',
    description: 'Monospace — compact centered receipt/mobile layout',
    isPremium: false,
    layout: 'compact',
    previewColors: ['#111827', '#FFFFFF', '#374151'],
    font: '"Courier New", Courier, monospace',
    bodyBg: '#FFFFFF',
    bodyText: '#111827',
    companyNameColor: '#111827',
    invoiceTitleColor: '#111827',
    accentColor: '#374151',
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
  // ─── 12. Logistics Pro (Sidebar) ──────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Shared utilities ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

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
    } catch { return null; }
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
      } catch { resolve(null); }
    });
  } catch { return null; }
}

/** Outer page border with inset */
function pageBorder(color: string, width = '1.5px', inset = 12): string {
  return `<div style="position:absolute;top:${inset}px;left:${inset}px;right:${inset}px;bottom:${inset}px;border:${width} solid ${color};pointer-events:none;z-index:1;"></div>`;
}

/** Double-line page border used by classic geometric */
function doublePageBorder(outer: string, inner: string): string {
  return `
  <div style="position:absolute;top:10px;left:10px;right:10px;bottom:10px;border:2.5px solid ${outer};pointer-events:none;z-index:1;"></div>
  <div style="position:absolute;top:16px;left:16px;right:16px;bottom:16px;border:1px solid ${inner};pointer-events:none;z-index:1;"></div>`;
}

/**
 * SVG geometric corner ornaments — 4 corners.
 * Inspired by classic Indian transport invoice designs.
 */
function geoCorners(primary: string, accent: string): string {
  // Top-left
  const tl = `<svg style="position:absolute;top:10px;left:10px;width:80px;height:80px;z-index:2;" viewBox="0 0 80 80" fill="none">
    <polyline points="80,3 3,3 3,80" stroke="${primary}" stroke-width="2.5"/>
    <polyline points="80,9 9,9 9,80" stroke="${accent}" stroke-width="1"/>
    <polygon points="20,6 28,14 20,22 12,14" fill="${primary}"/>
    <polygon points="34,6 42,14 34,22 26,14" fill="${primary}" opacity="0.4"/>
    <polygon points="6,28 14,36 6,44 -2,36" fill="${accent}"/>
    <polygon points="6,46 14,54 6,62 -2,54" fill="${primary}" opacity="0.4"/>
  </svg>`;
  // Top-right
  const tr = `<svg style="position:absolute;top:10px;right:10px;width:80px;height:80px;z-index:2;" viewBox="0 0 80 80" fill="none">
    <polyline points="0,3 77,3 77,80" stroke="${primary}" stroke-width="2.5"/>
    <polyline points="0,9 71,9 71,80" stroke="${accent}" stroke-width="1"/>
    <polygon points="60,6 68,14 60,22 52,14" fill="${primary}"/>
    <polygon points="46,6 54,14 46,22 38,14" fill="${primary}" opacity="0.4"/>
    <polygon points="74,28 82,36 74,44 66,36" fill="${accent}"/>
    <polygon points="74,46 82,54 74,62 66,54" fill="${primary}" opacity="0.4"/>
  </svg>`;
  // Bottom-left
  const bl = `<svg style="position:absolute;bottom:10px;left:10px;width:80px;height:80px;z-index:2;" viewBox="0 0 80 80" fill="none">
    <polyline points="80,77 3,77 3,0" stroke="${primary}" stroke-width="2.5"/>
    <polyline points="80,71 9,71 9,0" stroke="${accent}" stroke-width="1"/>
    <polygon points="20,74 28,66 20,58 12,66" fill="${primary}"/>
    <polygon points="34,74 42,66 34,58 26,66" fill="${primary}" opacity="0.4"/>
    <polygon points="6,52 14,44 6,36 -2,44" fill="${accent}"/>
    <polygon points="6,34 14,26 6,18 -2,26" fill="${primary}" opacity="0.4"/>
  </svg>`;
  // Bottom-right
  const br = `<svg style="position:absolute;bottom:10px;right:10px;width:80px;height:80px;z-index:2;" viewBox="0 0 80 80" fill="none">
    <polyline points="0,77 77,77 77,0" stroke="${primary}" stroke-width="2.5"/>
    <polyline points="0,71 71,71 71,0" stroke="${accent}" stroke-width="1"/>
    <polygon points="60,74 68,66 60,58 52,66" fill="${primary}"/>
    <polygon points="46,74 54,66 46,58 38,66" fill="${primary}" opacity="0.4"/>
    <polygon points="74,52 82,44 74,36 66,44" fill="${accent}"/>
    <polygon points="74,34 82,26 74,18 66,26" fill="${primary}" opacity="0.4"/>
  </svg>`;
  return tl + tr + bl + br;
}

/**
 * Chevron divider — uses inline SVG pattern for a row of arrow shapes.
 */
function chevronDivider(bg: string, chevronColor = 'rgba(255,255,255,0.28)', height = 8): string {
  return `<div style="height:${height}px;background:${bg};position:relative;overflow:hidden;margin:18px 0;">
    <svg style="position:absolute;top:0;left:0;width:100%;height:100%;" preserveAspectRatio="none" viewBox="0 0 800 ${height}">
      <defs>
        <pattern id="chv" x="0" y="0" width="22" height="${height}" patternUnits="userSpaceOnUse">
          <polyline points="0,${height} 11,0 22,${height}" fill="none" stroke="${chevronColor}" stroke-width="1.5"/>
        </pattern>
      </defs>
      <rect width="800" height="${height}" fill="url(#chv)"/>
    </svg>
  </div>`;
}

/**
 * Digital Khata payment banner — used across all templates.
 * QR code on the RIGHT; payment details on the LEFT (as requested).
 */
function buildDigitalKhata(invoice: Invoice, t: TemplateStyle): string {
  const biz = invoice.businessSnapshot;
  if (!biz.upiId && !biz.bankName) return '';

  const balance = Math.abs(invoice.balance);
  const safeName = encodeURIComponent((biz.ownerName || biz.companyName || 'Business').replace(/[&=?]/g, ''));
  const safeUpi = encodeURIComponent(biz.upiId ?? '');
  const currencyCode = invoice.currency === 'INR' || !invoice.currency ? 'INR' : invoice.currency;
  const qrUrl = biz.upiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=110x110&bgcolor=ffffff&color=000000&qzone=1&data=${encodeURIComponent(`upi://pay?pa=${safeUpi}&pn=${safeName}&am=${balance.toFixed(2)}&cu=${currencyCode}`)}`
    : null;

  const payDetails = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;flex:1;">
      ${biz.upiId ? `<div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,0.55);margin-bottom:3px;">UPI ID</div>
        <div style="font-size:12.5px;font-weight:700;color:#fff;word-break:break-all;">${biz.upiId}</div>
        <div style="font-size:9px;color:#F59E0B;margin-top:3px;font-style:italic;">PhonePe · GPay · BHIM · Paytm</div>
      </div>` : ''}
      ${biz.bankName ? `<div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,0.55);margin-bottom:3px;">Bank Name</div>
        <div style="font-size:12.5px;font-weight:700;color:#fff;">${biz.bankName}</div>
      </div>` : ''}
      ${biz.accountNumber ? `<div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,0.55);margin-bottom:3px;">Account No.</div>
        <div style="font-size:12.5px;font-weight:700;color:#fff;letter-spacing:0.5px;">${biz.accountNumber}</div>
      </div>` : ''}
      ${biz.ifscCode ? `<div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,0.55);margin-bottom:3px;">IFSC Code</div>
        <div style="font-size:12.5px;font-weight:700;color:#fff;letter-spacing:1px;">${biz.ifscCode}</div>
      </div>` : ''}
    </div>`;

  return `
  <div style="background:linear-gradient(135deg,#0D2B5E 0%,#1E40AF 60%,#1E3A8A 100%);border-radius:14px;padding:18px 22px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.08);">
    <!-- Khata Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.15);">
      <div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.5);margin-bottom:3px;">💳 DIGITAL KHATA</div>
        <div style="font-size:17px;font-weight:900;color:#fff;letter-spacing:-0.3px;">Payment Details</div>
      </div>
      <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:8px 14px;text-align:right;">
        <div style="font-size:9px;color:rgba(255,255,255,0.55);">Amount Due</div>
        <div style="font-size:16px;font-weight:900;color:#F59E0B;">${invoice.currency} ${fmt(balance)}</div>
      </div>
    </div>
    <!-- Payment info + QR -->
    <div style="display:flex;gap:18px;align-items:center;">
      ${payDetails}
      ${qrUrl ? `<div style="flex-shrink:0;text-align:center;">
        <div style="background:#fff;padding:7px;border-radius:10px;display:inline-block;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <img src="${qrUrl}" alt="UPI QR" width="96" height="96" style="display:block;" />
        </div>
        <div style="font-size:9px;color:rgba(255,255,255,0.5);margin-top:5px;font-weight:600;">SCAN TO PAY</div>
      </div>` : ''}
    </div>
    ${biz.upiId ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.1);font-size:9.5px;color:rgba(255,255,255,0.45);">Pay via UPI: Works with all UPI apps on Android &amp; iOS. Instant payment confirmation.</div>` : ''}
  </div>`;
}

/**
 * 3-column items table: S.No | Service Description | Amount
 * Service name starts from extreme left; amount on extreme right.
 */
function buildItemsTable(invoice: Invoice, t: TemplateStyle, bodyBg?: string): string {
  const bg = bodyBg ?? t.bodyBg;
  const rows = invoice.expenses.map((item, i) => `
    <tr style="border-bottom:1px solid ${t.borderColor};background:${i % 2 === 1 ? t.rowAlt : bg};">
      <td style="padding:10px 14px;font-size:12px;color:${t.metaTextColor};font-weight:600;width:42px;">${i + 1}</td>
      <td style="padding:10px 14px;font-size:13px;color:${t.bodyText};font-weight:500;text-align:left;">${item.name}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:800;color:${t.itemAmtColor};text-align:right;white-space:nowrap;">${invoice.currency}&nbsp;${fmt(item.amount)}</td>
    </tr>`).join('');

  return `
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:${t.tableHeadBg};">
        <th style="padding:11px 14px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${t.tableHeadText};text-align:left;width:42px;">#</th>
        <th style="padding:11px 14px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${t.tableHeadText};text-align:left;">Service Description</th>
        <th style="padding:11px 14px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${t.tableHeadText};text-align:right;">Amount (${invoice.currency})</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/**
 * Settlement totals box.
 */
function buildTotalsBox(invoice: Invoice, t: TemplateStyle, width = '300px'): string {
  const settlementLabel =
    invoice.settlementStatus === 'receive'
      ? 'Driver has to <strong>receive</strong> money.'
      : invoice.settlementStatus === 'return'
        ? 'Driver has to <strong>return</strong> money.'
        : 'Fully settled — no balance due.';

  return `
  <div style="width:${width};margin-left:auto;">
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};font-size:12.5px;">
      <span>Advance Received</span><span style="font-weight:600;">${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${t.borderColor};color:${t.totalRowColor};font-size:12.5px;">
      <span>Total Expenses</span><span style="font-weight:600;">${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
    </div>
    <div style="background:${t.grandRowBg};color:${t.grandRowText};padding:14px 16px;border-radius:10px;display:flex;justify-content:space-between;font-size:16px;font-weight:900;margin-top:10px;letter-spacing:-0.3px;">
      <span>BALANCE DUE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
    </div>
    <div style="text-align:center;font-size:11.5px;font-weight:700;color:${t.labelColor};margin-top:10px;">${settlementLabel}</div>
  </div>`;
}

/** DRAFT watermark */
function draftWatermark(): string {
  return `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:96px;font-weight:900;color:rgba(128,128,128,0.06);letter-spacing:12px;pointer-events:none;z-index:0;white-space:nowrap;">DRAFT</div>`;
}

/** Notes + payment terms block */
function notesBlock(invoice: Invoice, t: TemplateStyle): string {
  let out = '';
  if (invoice.notes) {
    out += `<div style="background:${t.notesBg};border-left:3.5px solid ${t.notesAccent};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:18px;font-size:12px;color:${t.metaTextColor};line-height:1.9;"><strong style="color:${t.notesAccent};">Notes: </strong>${invoice.notes}</div>`;
  }
  if (invoice.paymentTerms) {
    out += `<div style="margin-bottom:16px;font-size:11.5px;color:${t.metaTextColor};line-height:1.8;"><strong>Payment Terms:</strong> ${invoice.paymentTerms}</div>`;
  }
  return out;
}

/** Signature + footer row */
function footerSignature(biz: Invoice['businessSnapshot'], t: TemplateStyle, sig: string | null): string {
  const sigHtml = sig
    ? `<img src="${sig}" alt="sig" style="height:48px;max-width:150px;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : '<div style="height:40px;"></div>';

  return `
  <div style="border-top:1.5px solid ${t.borderColor};padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="flex:1;font-size:11px;color:${t.metaTextColor};line-height:1.9;max-width:340px;">
      ${biz.footerNotes || 'Thank you for your business.'}
    </div>
    <div style="text-align:center;min-width:180px;">
      ${sigHtml}
      <div style="width:160px;height:1px;background:${t.metaTextColor};margin:0 auto 7px;opacity:0.5;"></div>
      <div style="font-size:9.5px;color:${t.metaTextColor};text-transform:uppercase;letter-spacing:1px;">Authorized Signature</div>
      <div style="font-size:12px;font-weight:700;color:${t.billNameColor};margin-top:4px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>`;
}

/** Trip details row */
function tripRow(invoice: Invoice, t: TemplateStyle, bgOverride?: string): string {
  const bg = bgOverride ?? t.tripBg;
  const fields = [
    { label: 'From', val: invoice.fromLocation },
    { label: 'To', val: invoice.toLocation },
    { label: 'Truck No.', val: invoice.truckNumber || '—' },
    { label: 'Driver', val: invoice.driverName || '—' },
    { label: 'Date', val: invoice.date },
  ];
  return `
  <div style="background:${bg};border-left:4px solid ${t.tripBorder};border-radius:0 10px 10px 0;padding:14px 20px;margin-bottom:22px;display:flex;flex-wrap:wrap;gap:0;">
    ${fields.map(f => `
    <div style="flex:1;min-width:110px;padding-right:12px;margin-bottom:6px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:4px;font-weight:700;">${f.label}</div>
      <div style="font-size:13px;font-weight:800;color:${t.tripValColor};">${f.val}</div>
    </div>`).join('')}
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER 1: Classic Geometric (Indian Transport) ─────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderClassicGeometric(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;
  const accent = t.accentColor ?? t.invoiceTitleColor;

  const logoHtml = logo
    ? `<img src="${logo}" alt="logo" style="height:72px;max-width:160px;object-fit:contain;border-radius:6px;display:block;margin-bottom:10px;" />`
    : `<div style="width:60px;height:60px;border-radius:8px;background:${t.companyNameColor};display:flex;align-items:center;justify-content:center;margin-bottom:10px;">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="8" width="24" height="18" rx="2" stroke="white" stroke-width="2"/><path d="M4 13h24" stroke="white" stroke-width="1.5"/></svg>
      </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:#e5e5e5; font-size:13px; }
  .page { width:794px; min-height:1123px; padding:56px 54px 50px; position:relative; background:${t.bodyBg}; margin:0 auto; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; } }
</style>
</head>
<body>
<div class="page">
  ${doublePageBorder(t.companyNameColor, accent + '55')}
  ${geoCorners(t.companyNameColor, accent)}
  ${invoice.status === 'draft' ? draftWatermark() : ''}

  <!-- ═══ HEADER ═══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
    <!-- Left: Logo + company -->
    <div style="flex:1;padding-right:20px;">
      ${logoHtml}
      <div style="font-size:24px;font-weight:900;color:${t.companyNameColor};letter-spacing:-0.5px;line-height:1.2;">${biz.companyName || biz.ownerName || 'Company Name'}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:2;margin-top:6px;">
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? 'Tel: ' + biz.mobile + (biz.gstNumber ? '' : '') : ''}
        ${biz.gstNumber ? '<br>GSTIN: <strong>' + biz.gstNumber + '</strong>' : ''}
      </div>
    </div>
    <!-- Right: Invoice title + meta -->
    <div style="text-align:right;flex-shrink:0;min-width:200px;">
      <div style="font-size:44px;font-weight:900;color:${accent};letter-spacing:-3px;line-height:1;">INVOICE</div>
      <div style="font-size:15px;font-weight:800;color:${t.companyNameColor};margin-top:6px;letter-spacing:0.5px;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:${t.metaTextColor};margin-top:8px;line-height:2.1;">
        Date: <strong>${invoice.date}</strong><br>
        ${invoice.dueDate ? 'Due: <strong>' + invoice.dueDate + '</strong>' : ''}
      </div>
      <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;margin-top:8px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <!-- ═══ CHEVRON DIVIDER ═══ -->
  ${chevronDivider(t.companyNameColor)}

  <!-- ═══ BILL FROM / TO ═══ -->
  <div style="display:flex;gap:0;margin-bottom:20px;">
    <div style="flex:1;padding-right:20px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${accent};font-weight:800;margin-bottom:8px;">Bill From</div>
      <div style="font-size:14px;font-weight:800;color:${t.billNameColor};">${biz.ownerName || biz.companyName || '—'}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:2;margin-top:4px;">
        ${biz.companyName && biz.ownerName ? biz.companyName + '<br>' : ''}
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="flex:1;padding-left:20px;border-left:2px solid ${t.borderColor};">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${accent};font-weight:800;margin-bottom:8px;">Bill To</div>
      <div style="font-size:14px;font-weight:800;color:${t.billNameColor};">${invoice.clientName}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:2;margin-top:4px;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
      </div>
    </div>
  </div>

  <!-- ═══ ROUTE BANNER ═══ -->
  <div style="background:${t.tripBg};border:1px solid ${t.borderColor};border-left:5px solid ${t.companyNameColor};border-radius:0 10px 10px 0;padding:14px 20px;margin-bottom:22px;display:flex;flex-wrap:wrap;gap:0;align-items:center;">
    <div style="flex:1.2;min-width:130px;padding-right:12px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:3px;font-weight:700;">🚚 From</div>
      <div style="font-size:14px;font-weight:900;color:${t.tripValColor};">${invoice.fromLocation}</div>
    </div>
    <div style="flex-shrink:0;font-size:22px;color:${accent};padding:0 8px;font-weight:900;">→</div>
    <div style="flex:1.2;min-width:130px;padding:0 12px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:3px;font-weight:700;">📍 To</div>
      <div style="font-size:14px;font-weight:900;color:${t.tripValColor};">${invoice.toLocation}</div>
    </div>
    <div style="width:1px;height:36px;background:${t.borderColor};margin:0 12px;"></div>
    <div style="flex:1;min-width:90px;padding-right:12px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:3px;font-weight:700;">🚛 Truck No.</div>
      <div style="font-size:13px;font-weight:800;color:${t.tripValColor};">${invoice.truckNumber || '—'}</div>
    </div>
    <div style="flex:1;min-width:90px;padding-right:12px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};margin-bottom:3px;font-weight:700;">👤 Driver</div>
      <div style="font-size:13px;font-weight:800;color:${t.tripValColor};">${invoice.driverName || '—'}</div>
    </div>
  </div>

  <!-- ═══ ITEMS TABLE ═══ -->
  ${buildItemsTable(invoice, t)}

  <!-- ═══ TOTALS ═══ -->
  <div style="margin-bottom:22px;">
    ${buildTotalsBox(invoice, t, '310px')}
  </div>

  <!-- ═══ DIGITAL KHATA PAYMENT ═══ -->
  ${buildDigitalKhata(invoice, t)}

  <!-- ═══ NOTES / TERMS ═══ -->
  ${notesBlock(invoice, t)}

  <!-- ═══ FOOTER ═══ -->
  ${footerSignature(biz, t, sig)}

  <div style="position:absolute;bottom:24px;right:54px;font-size:10px;color:${t.metaTextColor};opacity:0.45;">Page 1 of 1</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER 2: Top-Banner Layout ────────────────────────────────────────────
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
    ? `<img src="${logo}" alt="logo" style="height:56px;max-width:130px;object-fit:contain;border-radius:6px;display:block;margin-bottom:10px;opacity:0.95;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:#e5e5e5; font-size:13px; }
  .page { width:794px; min-height:1123px; position:relative; background:${t.bodyBg}; margin:0 auto; overflow:hidden; }
  .content { padding:28px 46px 44px; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; } }
</style>
</head>
<body>
<div class="page">
  ${pageBorder(accent + '35', '1.5px', 10)}
  ${invoice.status === 'draft' ? draftWatermark() : ''}

  <!-- FULL-WIDTH BANNER HEADER -->
  <div style="background:${t.dividerCss};padding:30px 46px 28px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      ${logoHtml}
      <div style="font-size:26px;font-weight:900;color:${t.companyNameColor};letter-spacing:-0.5px;line-height:1.2;">${biz.companyName || biz.ownerName || 'Company'}</div>
      <div style="font-size:11px;color:${t.invoiceTitleColor};line-height:2;margin-top:6px;opacity:0.88;">
        ${biz.address ? biz.address : ''}${biz.address && biz.mobile ? ' · ' : ''}${biz.mobile || ''}${biz.gstNumber ? ' · GSTIN: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:44px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-3px;line-height:1;opacity:0.88;">INVOICE</div>
      <div style="font-size:15px;font-weight:800;color:${t.companyNameColor};margin-top:8px;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:${t.invoiceTitleColor};margin-top:6px;opacity:0.85;line-height:2;">
        Date: ${invoice.date}${invoice.dueDate ? ' · Due: ' + invoice.dueDate : ''}
      </div>
      <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;margin-top:8px;background:rgba(255,255,255,0.18);color:${t.companyNameColor};border:1px solid rgba(255,255,255,0.3);">${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <div class="content">
    <!-- BILL FROM / TO boxes -->
    <div style="display:flex;gap:14px;margin-bottom:18px;">
      <div style="flex:1;background:${t.tripBg};border-radius:10px;padding:14px 16px;border:1px solid ${t.borderColor};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill From</div>
        <div style="font-size:14px;font-weight:800;color:${t.billNameColor};">${biz.ownerName || biz.companyName || '—'}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:2;margin-top:4px;">
          ${biz.companyName && biz.ownerName ? biz.companyName + '<br>' : ''}
          ${biz.mobile ? biz.mobile + '<br>' : ''}
          ${biz.gstNumber ? 'GSTIN: ' + biz.gstNumber : ''}
        </div>
      </div>
      <div style="flex:1;background:${t.tripBg};border-radius:10px;padding:14px 16px;border:1.5px solid ${t.tripBorder};border-left:4px solid ${t.tripBorder};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill To</div>
        <div style="font-size:14px;font-weight:800;color:${t.billNameColor};">${invoice.clientName}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:2;margin-top:4px;">
          ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
          ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
          ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
        </div>
      </div>
    </div>

    <!-- TRIP INFO -->
    ${tripRow(invoice, t)}

    <!-- ITEMS TABLE -->
    ${buildItemsTable(invoice, t)}

    <!-- TOTALS + SUMMARY -->
    <div style="margin-bottom:20px;">
      ${buildTotalsBox(invoice, t, '300px')}
    </div>

    <!-- DIGITAL KHATA -->
    ${buildDigitalKhata(invoice, t)}

    <!-- NOTES -->
    ${notesBlock(invoice, t)}

    <!-- FOOTER -->
    ${footerSignature(biz, t, sig)}
  </div>

  <div style="position:absolute;bottom:22px;right:46px;font-size:10px;color:${t.metaTextColor};opacity:0.45;">Page 1 of 1</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER 3: Corporate Two-Box Layout ─────────────────────────────────────
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
    ? `<img src="${logo}" alt="logo" style="height:58px;max-width:130px;object-fit:contain;border-radius:4px;display:block;margin-bottom:10px;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:#e5e5e5; font-size:13px; }
  .page { width:794px; min-height:1123px; padding:0; position:relative; background:${t.bodyBg}; margin:0 auto; }
  .top-bar { height:8px; background:${t.dividerCss}; }
  .content { padding:36px 50px 44px; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; } }
</style>
</head>
<body>
<div class="page">
  ${pageBorder(accent + '25', '1px', 10)}
  ${invoice.status === 'draft' ? draftWatermark() : ''}

  <!-- TOP ACCENT BAR -->
  <div class="top-bar"></div>

  <div class="content">
    <!-- TWO-BOX HEADER -->
    <div style="display:flex;gap:20px;margin-bottom:22px;">
      <!-- Company box -->
      <div style="flex:1;border:1.5px solid ${t.borderColor};border-radius:12px;padding:18px 20px;border-top:5px solid ${accent};">
        ${logoHtml}
        <div style="font-size:22px;font-weight:900;color:${t.companyNameColor};letter-spacing:-0.5px;margin-bottom:8px;">${biz.companyName || biz.ownerName || 'Company'}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:2;">
          ${biz.address ? biz.address + '<br>' : ''}
          ${biz.mobile ? 'Tel: ' + biz.mobile + '<br>' : ''}
          ${biz.gstNumber ? 'GSTIN: ' + biz.gstNumber : ''}
        </div>
      </div>
      <!-- Invoice box -->
      <div style="width:220px;flex-shrink:0;border:1.5px solid ${t.borderColor};border-radius:12px;padding:18px 20px;text-align:right;background:${t.tripBg};border-top:5px solid ${accent};">
        <div style="font-size:30px;font-weight:900;color:${accent};letter-spacing:-2px;line-height:1;margin-bottom:8px;">INVOICE</div>
        <div style="font-size:15px;font-weight:800;color:${t.companyNameColor};margin-bottom:12px;"># ${invoice.invoiceNumber}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:2.2;">
          <span>Date:</span> <strong>${invoice.date}</strong><br>
          ${invoice.dueDate ? '<span>Due:</span> <strong>' + invoice.dueDate + '</strong>' : ''}
        </div>
        <div style="display:inline-block;padding:5px 12px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-top:10px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
      </div>
    </div>

    <!-- DIVIDER -->
    <div style="height:2px;background:${t.dividerCss};border-radius:2px;margin-bottom:22px;"></div>

    <!-- BILL FROM / TO -->
    <div style="display:flex;gap:16px;margin-bottom:18px;">
      <div style="flex:1;background:${t.tripBg};border-radius:8px;padding:14px 16px;border:1px solid ${t.borderColor};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;border-bottom:1px solid ${t.borderColor};padding-bottom:5px;">Bill From</div>
        <div style="font-size:14px;font-weight:800;color:${t.billNameColor};margin-bottom:4px;">${biz.ownerName || biz.companyName || '—'}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:2;">
          ${biz.mobile ? biz.mobile + '<br>' : ''}
          ${biz.gstNumber ? 'GSTIN: ' + biz.gstNumber : ''}
        </div>
      </div>
      <div style="flex:1;background:${t.tripBg};border-radius:8px;padding:14px 16px;border:1px solid ${t.borderColor};border-left:4px solid ${accent};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;border-bottom:1px solid ${t.borderColor};padding-bottom:5px;">Bill To</div>
        <div style="font-size:14px;font-weight:800;color:${t.billNameColor};margin-bottom:4px;">${invoice.clientName}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:2;">
          ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
          ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
          ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
        </div>
      </div>
    </div>

    <!-- TRIP GRID -->
    <div style="background:${t.tripBg};border-radius:8px;padding:14px 18px;margin-bottom:20px;border:1px solid ${t.borderColor};display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
      ${[
        { label: 'From', val: invoice.fromLocation },
        { label: 'To', val: invoice.toLocation },
        { label: 'Truck No.', val: invoice.truckNumber || '—' },
        { label: 'Driver', val: invoice.driverName || '—' },
        { label: 'Date', val: invoice.date },
      ].map(f => `<div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};font-weight:700;margin-bottom:4px;">${f.label}</div>
        <div style="font-size:12.5px;font-weight:800;color:${t.tripValColor};">${f.val}</div>
      </div>`).join('')}
    </div>

    <!-- ITEMS TABLE -->
    ${buildItemsTable(invoice, t)}

    <!-- TOTALS + PAYMENT side by side -->
    <div style="display:flex;gap:20px;margin-bottom:20px;align-items:flex-start;">
      <div style="flex:1;">
        ${buildDigitalKhata(invoice, t)}
      </div>
      <div style="width:280px;flex-shrink:0;">
        ${buildTotalsBox(invoice, t, '100%')}
      </div>
    </div>

    <!-- NOTES -->
    ${notesBlock(invoice, t)}

    <!-- FOOTER -->
    ${footerSignature(biz, t, sig)}
  </div>

  <!-- BOTTOM BAR -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:${t.dividerCss};"></div>
  <div style="position:absolute;bottom:14px;right:50px;font-size:10px;color:${t.metaTextColor};opacity:0.45;">Page 1 of 1</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER 4: Compact / Receipt Layout ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderCompactHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;

  const rows = invoice.expenses.map((item, i) => `
    <tr style="border-bottom:1px dashed ${t.borderColor};background:${i % 2 === 1 ? t.rowAlt : t.bodyBg};">
      <td style="padding:7px 10px;font-size:11px;color:${t.metaTextColor};">${i + 1}</td>
      <td style="padding:7px 10px;font-size:12px;color:${t.bodyText};">${item.name}</td>
      <td style="padding:7px 10px;font-size:12px;font-weight:800;color:${t.itemAmtColor};text-align:right;">${invoice.currency} ${fmt(item.amount)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:${t.bodyBg}; font-size:13px; }
  .page { width:794px; min-height:1123px; padding:56px 116px; position:relative; background:${t.bodyBg}; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; } }
</style>
</head>
<body>
<div class="page">
  ${pageBorder(t.borderColor, '1.5px', 12)}
  ${invoice.status === 'draft' ? draftWatermark() : ''}

  <!-- Centered header -->
  <div style="text-align:center;margin-bottom:16px;">
    ${logo ? `<img src="${logo}" alt="logo" style="height:52px;object-fit:contain;display:block;margin:0 auto 10px;" />` : ''}
    <div style="font-size:22px;font-weight:900;color:${t.companyNameColor};letter-spacing:-0.5px;">${biz.companyName || biz.ownerName || 'Company'}</div>
    <div style="font-size:11px;color:${t.metaTextColor};margin-top:4px;line-height:1.9;">
      ${biz.address ? biz.address + ' · ' : ''}${biz.mobile ?? ''}${biz.gstNumber ? ' · GSTIN: ' + biz.gstNumber : ''}
    </div>
  </div>

  <div style="border-top:2px solid ${t.bodyText};margin-bottom:14px;"></div>

  <!-- Invoice title centered -->
  <div style="text-align:center;margin-bottom:14px;">
    <div style="font-size:30px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-1.5px;">INVOICE</div>
    <div style="font-size:13px;font-weight:700;color:${t.companyNameColor};margin-top:4px;">No. ${invoice.invoiceNumber}</div>
    <div style="font-size:11px;color:${t.metaTextColor};margin-top:4px;">
      Date: ${invoice.date}${invoice.dueDate ? ' · Due: ' + invoice.dueDate : ''}
    </div>
    <div style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-top:6px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
  </div>

  <div style="border-top:1px dashed ${t.borderColor};margin-bottom:12px;"></div>

  <!-- Bill to -->
  <div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:4px;">BILL TO</div>
    <div style="font-size:16px;font-weight:800;color:${t.billNameColor};">${invoice.clientName}</div>
    <div style="font-size:11px;color:${t.metaTextColor};margin-top:3px;line-height:1.8;">
      ${invoice.clientPhone ?? ''}${invoice.clientAddress ? ' · ' + invoice.clientAddress : ''}
    </div>
  </div>

  <div style="border-top:1px dashed ${t.borderColor};margin-bottom:10px;"></div>

  <!-- Trip compact -->
  <div style="font-size:11.5px;color:${t.metaTextColor};text-align:center;margin-bottom:10px;line-height:2;">
    <strong style="color:${t.tripValColor};">${invoice.fromLocation}</strong>
    <span style="margin:0 6px;color:${t.labelColor};">→</span>
    <strong style="color:${t.tripValColor};">${invoice.toLocation}</strong>
    ${invoice.truckNumber ? ' · Truck: <strong>' + invoice.truckNumber + '</strong>' : ''}
    ${invoice.driverName ? ' · Driver: <strong>' + invoice.driverName + '</strong>' : ''}
  </div>

  <div style="border-top:1px dashed ${t.borderColor};margin-bottom:12px;"></div>

  <!-- Items -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
    <thead>
      <tr style="background:${t.tableHeadBg};">
        <th style="padding:8px 10px;font-size:10px;text-transform:uppercase;color:${t.tableHeadText};text-align:left;width:32px;">#</th>
        <th style="padding:8px 10px;font-size:10px;text-transform:uppercase;color:${t.tableHeadText};text-align:left;">Item</th>
        <th style="padding:8px 10px;font-size:10px;text-transform:uppercase;color:${t.tableHeadText};text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="border-top:1px dashed ${t.borderColor};margin-bottom:12px;"></div>

  <!-- Totals compact -->
  <div style="width:220px;margin:0 auto 16px;">
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11.5px;color:${t.totalRowColor};border-bottom:1px solid ${t.borderColor};">
      <span>Advance</span><span>${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11.5px;color:${t.totalRowColor};border-bottom:1px solid ${t.borderColor};">
      <span>Total Expenses</span><span>${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:10px 14px;border-radius:8px;background:${t.grandRowBg};color:${t.grandRowText};font-size:15px;font-weight:900;">
      <span>BALANCE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
    </div>
  </div>

  <!-- Payment (compact) -->
  ${biz.upiId ? `<div style="text-align:center;font-size:11px;color:${t.metaTextColor};margin-bottom:10px;">UPI: <strong style="color:${t.payValColor};">${biz.upiId}</strong></div>` : ''}
  ${biz.bankName ? `<div style="text-align:center;font-size:11px;color:${t.metaTextColor};margin-bottom:6px;">Bank: <strong>${biz.bankName}</strong>${biz.accountNumber ? ' · A/C: ' + biz.accountNumber : ''}${biz.ifscCode ? ' · IFSC: ' + biz.ifscCode : ''}</div>` : ''}

  ${invoice.notes ? `<div style="background:${t.notesBg};border:1px dashed ${t.notesAccent};border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:11px;color:${t.metaTextColor};text-align:center;line-height:1.8;"><strong style="color:${t.notesAccent};">Note:</strong> ${invoice.notes}</div>` : ''}

  <div style="border-top:2px solid ${t.bodyText};padding-top:14px;text-align:center;">
    <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;">${biz.footerNotes || 'Thank you for your business.'}</div>
    <div style="margin-top:14px;">
      ${sig ? `<img src="${sig}" alt="sig" style="height:40px;object-fit:contain;display:block;margin:0 auto 6px;" />` : '<div style="height:34px;"></div>'}
      <div style="width:140px;height:1px;background:${t.metaTextColor};margin:0 auto 6px;opacity:0.5;"></div>
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:${t.metaTextColor};">Authorized Signature</div>
      <div style="font-size:11.5px;font-weight:700;color:${t.billNameColor};margin-top:3px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>

  <div style="position:absolute;bottom:20px;right:60px;font-size:10px;color:${t.metaTextColor};opacity:0.45;">Page 1</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER 5: Sidebar Layout ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderSidebarHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;

  const rows = invoice.expenses.map((item, i) => `
    <tr style="border-bottom:1px solid ${t.borderColor};background:${i % 2 === 1 ? t.rowAlt : '#fff'};">
      <td style="padding:9px 12px;font-size:11.5px;color:${t.metaTextColor};width:32px;">${i + 1}</td>
      <td style="padding:9px 12px;font-size:12.5px;color:${t.bodyText};text-align:left;">${item.name}</td>
      <td style="padding:9px 12px;font-size:12.5px;font-weight:700;color:${t.itemAmtColor};text-align:right;white-space:nowrap;">${invoice.currency} ${fmt(item.amount)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; background:#e5e5e5; font-family:${t.font}; font-size:13px; }
  .layout { display:flex; width:794px; min-height:1123px; position:relative; }
  .sidebar { width:234px; min-height:1123px; background:${t.tableHeadBg}; padding:38px 22px; display:flex; flex-direction:column; }
  .main { flex:1; background:#ffffff; padding:38px 30px; position:relative; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } }
</style>
</head>
<body>
<div class="layout">
  <!-- ── LEFT SIDEBAR ── -->
  <div class="sidebar">
    ${logo ? `<img src="${logo}" alt="logo" style="height:50px;max-width:182px;object-fit:contain;border-radius:6px;margin-bottom:14px;padding:4px;background:rgba(255,255,255,0.1);display:block;" />` : ''}
    <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:5px;line-height:1.3;">${biz.companyName || biz.ownerName || 'Company'}</div>
    <div style="font-size:10px;color:rgba(255,255,255,0.62);line-height:1.9;margin-bottom:16px;">
      ${biz.address ? biz.address + '<br>' : ''}
      ${biz.mobile ? biz.mobile + '<br>' : ''}
      ${biz.gstNumber ? 'GSTIN: ' + biz.gstNumber : ''}
    </div>

    <div style="height:1px;background:rgba(255,255,255,0.15);margin-bottom:16px;"></div>

    <!-- Route box -->
    <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:13px 14px;margin-bottom:14px;">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.45);margin-bottom:8px;">ROUTE</div>
      <div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:4px;">${invoice.fromLocation}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:4px;text-align:center;">↓ ↓ ↓</div>
      <div style="font-size:13px;font-weight:800;color:#fff;">${invoice.toLocation}</div>
    </div>

    ${invoice.truckNumber ? `<div style="margin-bottom:9px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.45);margin-bottom:3px;">TRUCK</div><div style="font-size:12px;font-weight:700;color:#fff;">${invoice.truckNumber}</div></div>` : ''}
    ${invoice.driverName ? `<div style="margin-bottom:9px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.45);margin-bottom:3px;">DRIVER</div><div style="font-size:12px;font-weight:700;color:#fff;">${invoice.driverName}</div></div>` : ''}
    <div style="margin-bottom:14px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.45);margin-bottom:3px;">DATE</div><div style="font-size:12px;font-weight:700;color:#fff;">${invoice.date}</div></div>

    <div style="height:1px;background:rgba(255,255,255,0.15);margin-bottom:14px;"></div>

    ${(biz.upiId || biz.bankName) ? `<div style="margin-bottom:16px;">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.45);margin-bottom:8px;">PAYMENT</div>
      ${biz.upiId ? `<div style="font-size:10.5px;color:rgba(255,255,255,0.82);margin-bottom:3px;">UPI: ${biz.upiId}</div>` : ''}
      ${biz.bankName ? `<div style="font-size:10.5px;color:rgba(255,255,255,0.82);margin-bottom:2px;">${biz.bankName}</div>` : ''}
      ${biz.accountNumber ? `<div style="font-size:10px;color:rgba(255,255,255,0.58);">A/C: ${biz.accountNumber}</div>` : ''}
      ${biz.ifscCode ? `<div style="font-size:10px;color:rgba(255,255,255,0.58);">IFSC: ${biz.ifscCode}</div>` : ''}
    </div>` : ''}

    <!-- Signature at sidebar bottom -->
    <div style="margin-top:auto;">
      ${sig ? `<img src="${sig}" alt="sig" style="height:38px;max-width:140px;object-fit:contain;display:block;margin-bottom:5px;opacity:0.88;" />` : '<div style="height:34px;"></div>'}
      <div style="width:118px;height:1px;background:rgba(255,255,255,0.32);margin-bottom:5px;"></div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.42);">Authorized Signature</div>
      <div style="font-size:10.5px;font-weight:700;color:rgba(255,255,255,0.72);margin-top:3px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>

  <!-- ── MAIN CONTENT ── -->
  <div class="main">
    ${invoice.status === 'draft' ? draftWatermark() : ''}
    <!-- Invoice header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
      <div>
        <div style="font-size:40px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-3px;line-height:1;">INVOICE</div>
        <div style="font-size:15px;font-weight:800;color:${t.companyNameColor};margin-top:6px;"># ${invoice.invoiceNumber}</div>
      </div>
      <div style="text-align:right;">
        <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
        <div style="font-size:11px;color:${t.metaTextColor};margin-top:8px;line-height:2.1;">
          Date: <strong>${invoice.date}</strong>${invoice.dueDate ? '<br>Due: <strong>' + invoice.dueDate + '</strong>' : ''}
        </div>
      </div>
    </div>

    <div style="height:3px;background:${t.dividerCss};border-radius:2px;margin-bottom:18px;"></div>

    <!-- Bill To -->
    <div style="margin-bottom:18px;background:${t.tripBg};border-radius:8px;padding:12px 14px;border-left:4px solid ${t.tripBorder};">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:7px;">Bill To</div>
      <div style="font-size:15px;font-weight:800;color:${t.billNameColor};margin-bottom:3px;">${invoice.clientName}</div>
      <div style="font-size:11.5px;color:${t.metaTextColor};line-height:1.9;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
      </div>
    </div>

    <!-- Items table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:${t.tableHeadBg};">
          <th style="padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${t.tableHeadText};text-align:left;width:32px;">#</th>
          <th style="padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${t.tableHeadText};text-align:left;">Description</th>
          <th style="padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${t.tableHeadText};text-align:right;">Amount (${invoice.currency})</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- Totals -->
    <div style="margin-bottom:14px;">
      ${buildTotalsBox(invoice, t, '240px')}
    </div>

    ${invoice.notes ? `<div style="background:${t.notesBg};border-left:3px solid ${t.notesAccent};border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:12px;font-size:11.5px;color:${t.metaTextColor};line-height:1.8;"><strong style="color:${t.notesAccent};">Notes:</strong> ${invoice.notes}</div>` : ''}
    ${invoice.paymentTerms ? `<div style="margin-bottom:12px;font-size:11px;color:${t.metaTextColor};"><strong>Terms:</strong> ${invoice.paymentTerms}</div>` : ''}

    <div style="position:absolute;bottom:36px;left:30px;right:30px;border-top:1px solid ${t.borderColor};padding-top:12px;font-size:11px;color:${t.metaTextColor};line-height:1.8;">${biz.footerNotes || 'Thank you for your business.'}</div>
    <div style="position:absolute;bottom:18px;right:30px;font-size:10px;color:${t.metaTextColor};opacity:0.45;">Page 1 of 1</div>
  </div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER 6: GST Compliance Layout (TAX INVOICE) ──────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderGSTHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;
  const accent = t.accentColor ?? t.tableHeadBg;

  const logoHtml = logo
    ? `<img src="${logo}" alt="logo" style="height:60px;max-width:130px;object-fit:contain;display:block;margin-bottom:8px;" />`
    : '';

  // GST calculation: assume totalExpenses as taxable value
  const taxableAmount = invoice.totalExpenses;
  const gstRate = 18; // default
  const halfGst = gstRate / 2;
  const cgst = (taxableAmount * halfGst) / 100;
  const sgst = (taxableAmount * halfGst) / 100;
  const totalWithGst = taxableAmount + cgst + sgst;

  const rows = invoice.expenses.map((item, i) => {
    const rate18 = item.amount * 0.18;
    return `<tr style="border-bottom:1px solid ${t.borderColor};background:${i % 2 === 1 ? t.rowAlt : t.bodyBg};">
      <td style="padding:9px 12px;font-size:12px;color:${t.metaTextColor};text-align:center;width:36px;">${i + 1}</td>
      <td style="padding:9px 12px;font-size:12.5px;color:${t.bodyText};text-align:left;">${item.name}</td>
      <td style="padding:9px 12px;font-size:12px;color:${t.metaTextColor};text-align:center;">996</td>
      <td style="padding:9px 12px;font-size:12.5px;font-weight:600;color:${t.bodyText};text-align:right;">${invoice.currency} ${fmt(item.amount)}</td>
      <td style="padding:9px 12px;font-size:12px;color:${t.metaTextColor};text-align:center;">9%</td>
      <td style="padding:9px 12px;font-size:12px;color:${t.bodyText};text-align:right;">${invoice.currency} ${fmt(item.amount * 0.09)}</td>
      <td style="padding:9px 12px;font-size:12px;color:${t.metaTextColor};text-align:center;">9%</td>
      <td style="padding:9px 12px;font-size:12px;color:${t.bodyText};text-align:right;">${invoice.currency} ${fmt(item.amount * 0.09)}</td>
      <td style="padding:9px 12px;font-size:12.5px;font-weight:800;color:${t.itemAmtColor};text-align:right;">${invoice.currency} ${fmt(item.amount + rate18)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:#e5e5e5; font-size:12px; }
  .page { width:794px; min-height:1123px; padding:44px 44px 44px; position:relative; background:${t.bodyBg}; margin:0 auto; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; } }
</style>
</head>
<body>
<div class="page">
  ${doublePageBorder(accent, t.borderColor)}
  ${invoice.status === 'draft' ? draftWatermark() : ''}

  <!-- TAX INVOICE TITLE BAR -->
  <div style="background:${t.tableHeadBg};color:${t.tableHeadText};text-align:center;padding:10px;margin-bottom:0;letter-spacing:3px;font-size:14px;font-weight:900;text-transform:uppercase;border-radius:4px 4px 0 0;">TAX INVOICE</div>
  <div style="border:1.5px solid ${accent};border-top:none;border-radius:0 0 8px 8px;padding:18px;margin-bottom:18px;">

    <!-- COMPANY HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div style="flex:1;">
        ${logoHtml}
        <div style="font-size:20px;font-weight:900;color:${t.companyNameColor};letter-spacing:-0.5px;margin-bottom:4px;">${biz.companyName || biz.ownerName || 'Company'}</div>
        <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;">
          ${biz.address ? biz.address + '<br>' : ''}
          ${biz.mobile ? 'Tel: ' + biz.mobile + '<br>' : ''}
          ${biz.gstNumber ? '<strong>GSTIN: ' + biz.gstNumber + '</strong>' : '<span style="color:#DC2626;">⚠ GSTIN not entered</span>'}
        </div>
      </div>
      <div style="text-align:right;min-width:200px;">
        <table style="font-size:11px;border-collapse:collapse;width:100%;margin-bottom:8px;">
          <tr>
            <td style="color:${t.metaTextColor};padding:3px 0;text-align:left;">Invoice No:</td>
            <td style="font-weight:800;color:${t.companyNameColor};padding:3px 0;text-align:right;">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="color:${t.metaTextColor};padding:3px 0;text-align:left;">Date:</td>
            <td style="font-weight:700;padding:3px 0;text-align:right;">${invoice.date}</td>
          </tr>
          ${invoice.dueDate ? `<tr><td style="color:${t.metaTextColor};padding:3px 0;text-align:left;">Due Date:</td><td style="font-weight:700;padding:3px 0;text-align:right;">${invoice.dueDate}</td></tr>` : ''}
          <tr>
            <td style="color:${t.metaTextColor};padding:3px 0;text-align:left;">Place of Supply:</td>
            <td style="font-weight:700;padding:3px 0;text-align:right;">India</td>
          </tr>
          <tr>
            <td style="color:${t.metaTextColor};padding:3px 0;text-align:left;">Reverse Charge:</td>
            <td style="font-weight:700;padding:3px 0;text-align:right;">No</td>
          </tr>
        </table>
        <div style="display:inline-block;padding:5px 12px;border-radius:20px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
      </div>
    </div>
  </div>

  <!-- BILL FROM / TO WITH GSTIN -->
  <div style="display:flex;gap:0;margin-bottom:16px;border:1.5px solid ${t.borderColor};border-radius:8px;overflow:hidden;">
    <div style="flex:1;padding:14px 16px;border-right:1.5px solid ${t.borderColor};">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;border-bottom:1px solid ${t.borderColor};padding-bottom:5px;">Supplier (Bill From)</div>
      <div style="font-size:13px;font-weight:800;color:${t.billNameColor};margin-bottom:4px;">${biz.ownerName || biz.companyName || '—'}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;">
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? biz.mobile + '<br>' : ''}
        ${biz.gstNumber ? 'GSTIN: <strong>' + biz.gstNumber + '</strong>' : ''}
      </div>
    </div>
    <div style="flex:1;padding:14px 16px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;border-bottom:1px solid ${t.borderColor};padding-bottom:5px;">Recipient (Bill To)</div>
      <div style="font-size:13px;font-weight:800;color:${t.billNameColor};margin-bottom:4px;">${invoice.clientName}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:1.9;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GSTIN: <strong>' + invoice.clientGST + '</strong>' : 'GSTIN: Not Provided'}
      </div>
    </div>
  </div>

  <!-- TRANSPORT DETAILS -->
  <div style="background:${t.tripBg};border:1px solid ${t.borderColor};border-radius:8px;padding:10px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:8px 20px;font-size:11px;">
    <div><span style="color:${t.metaTextColor};font-weight:600;">From:</span> <strong>${invoice.fromLocation}</strong></div>
    <div><span style="color:${t.metaTextColor};font-weight:600;">To:</span> <strong>${invoice.toLocation}</strong></div>
    ${invoice.truckNumber ? `<div><span style="color:${t.metaTextColor};font-weight:600;">Vehicle No:</span> <strong>${invoice.truckNumber}</strong></div>` : ''}
    ${invoice.driverName ? `<div><span style="color:${t.metaTextColor};font-weight:600;">Driver:</span> <strong>${invoice.driverName}</strong></div>` : ''}
  </div>

  <!-- GST ITEMS TABLE (with HSN, CGST, SGST) -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px;">
    <thead>
      <tr style="background:${t.tableHeadBg};">
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:center;width:28px;">#</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:left;">Description of Services</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:center;">HSN/SAC</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:right;">Taxable Value</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:center;">CGST%</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:right;">CGST Amt</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:center;">SGST%</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:right;">SGST Amt</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- TAX SUMMARY TABLE -->
  <div style="display:flex;gap:20px;margin-bottom:16px;align-items:flex-start;">
    <!-- Tax breakdown box -->
    <div style="flex:1;border:1px solid ${t.borderColor};border-radius:8px;overflow:hidden;">
      <div style="background:${t.tripBg};padding:8px 12px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${t.labelColor};">Tax Summary</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;">
        <tr style="border-bottom:1px solid ${t.borderColor};">
          <td style="padding:6px 12px;color:${t.metaTextColor};">Taxable Amount</td>
          <td style="padding:6px 12px;font-weight:700;text-align:right;">${invoice.currency} ${fmt(taxableAmount)}</td>
        </tr>
        <tr style="border-bottom:1px solid ${t.borderColor};">
          <td style="padding:6px 12px;color:${t.metaTextColor};">CGST @ ${halfGst}%</td>
          <td style="padding:6px 12px;font-weight:700;text-align:right;">${invoice.currency} ${fmt(cgst)}</td>
        </tr>
        <tr style="border-bottom:1px solid ${t.borderColor};">
          <td style="padding:6px 12px;color:${t.metaTextColor};">SGST @ ${halfGst}%</td>
          <td style="padding:6px 12px;font-weight:700;text-align:right;">${invoice.currency} ${fmt(sgst)}</td>
        </tr>
        <tr style="background:${t.tripBg};">
          <td style="padding:8px 12px;font-weight:800;color:${t.companyNameColor};">Total GST (${gstRate}%)</td>
          <td style="padding:8px 12px;font-weight:900;text-align:right;color:${t.labelColor};">${invoice.currency} ${fmt(cgst + sgst)}</td>
        </tr>
      </table>
    </div>

    <!-- Totals box -->
    <div style="width:260px;flex-shrink:0;">
      <div style="border:1.5px solid ${t.borderColor};border-radius:8px;overflow:hidden;">
        <div style="padding:8px 14px;border-bottom:1px solid ${t.borderColor};display:flex;justify-content:space-between;font-size:12px;color:${t.totalRowColor};">
          <span>Advance Received</span><span>${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
        </div>
        <div style="padding:8px 14px;border-bottom:1px solid ${t.borderColor};display:flex;justify-content:space-between;font-size:12px;color:${t.totalRowColor};">
          <span>Total Expenses</span><span>${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
        </div>
        <div style="padding:13px 14px;display:flex;justify-content:space-between;font-size:15px;font-weight:900;background:${t.grandRowBg};color:${t.grandRowText};">
          <span>BALANCE DUE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- DIGITAL KHATA PAYMENT -->
  ${buildDigitalKhata(invoice, t)}

  <!-- NOTES -->
  ${notesBlock(invoice, t)}

  <!-- DECLARATION -->
  <div style="font-size:10px;color:${t.metaTextColor};margin-bottom:16px;padding:10px;background:${t.tripBg};border-radius:6px;line-height:1.7;">
    <strong>Declaration:</strong> We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.
  </div>

  <!-- FOOTER -->
  ${footerSignature(biz, t, sig)}

  <div style="position:absolute;bottom:24px;right:44px;font-size:10px;color:${t.metaTextColor};opacity:0.45;">Page 1 of 1</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER 7: Premium Dark Layout ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderPremiumDarkHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;
  const gold = '#F59E0B';
  const goldDim = '#D97706';

  const logoHtml = logo
    ? `<img src="${logo}" alt="logo" style="height:64px;max-width:150px;object-fit:contain;border-radius:6px;display:block;margin-bottom:10px;filter:brightness(1.1);" />`
    : '';

  const rows = invoice.expenses.map((item, i) => `
    <tr style="border-bottom:1px solid #2D3748;">
      <td style="padding:10px 14px;font-size:12px;color:#6B7280;width:36px;">${i + 1}</td>
      <td style="padding:10px 14px;font-size:13px;color:#E2E8F0;font-weight:500;">${item.name}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:800;color:${gold};text-align:right;white-space:nowrap;">${invoice.currency}&nbsp;${fmt(item.amount)}</td>
    </tr>`).join('');

  const sigHtml = sig
    ? `<img src="${sig}" alt="sig" style="height:48px;max-width:150px;object-fit:contain;display:block;margin:0 auto 6px;opacity:0.9;" />`
    : '<div style="height:40px;"></div>';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:#E2E8F0; background:#0a0a0a; font-size:13px; }
  .page { width:794px; min-height:1123px; padding:50px 54px; position:relative; background:${t.bodyBg}; margin:0 auto; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#000; } .page { margin:0; } }
</style>
</head>
<body>
<div class="page">
  <!-- Gold double border -->
  <div style="position:absolute;top:10px;left:10px;right:10px;bottom:10px;border:1.5px solid ${goldDim};pointer-events:none;z-index:1;"></div>
  <div style="position:absolute;top:16px;left:16px;right:16px;bottom:16px;border:0.5px solid rgba(245,158,11,0.25);pointer-events:none;z-index:1;"></div>

  ${invoice.status === 'draft' ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:96px;font-weight:900;color:rgba(255,255,255,0.04);letter-spacing:12px;pointer-events:none;white-space:nowrap;">DRAFT</div>` : ''}

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
    <div style="flex:1;padding-right:20px;">
      ${logoHtml}
      <div style="font-size:26px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;line-height:1.2;">${biz.companyName || biz.ownerName || 'Company'}</div>
      <div style="font-size:11px;color:#6B7280;line-height:2;margin-top:6px;">
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: <span style="color:#9CA3AF;">' + biz.gstNumber + '</span>' : ''}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:46px;font-weight:900;color:${gold};letter-spacing:-3px;line-height:1;text-shadow:0 0 30px rgba(245,158,11,0.3);">INVOICE</div>
      <div style="font-size:15px;font-weight:800;color:#fff;margin-top:8px;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:#6B7280;margin-top:8px;line-height:2.1;">
        Date: <span style="color:#9CA3AF;font-weight:600;">${invoice.date}</span><br>
        ${invoice.dueDate ? 'Due: <span style="color:#9CA3AF;font-weight:600;">' + invoice.dueDate + '</span>' : ''}
      </div>
      <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;margin-top:8px;background:${gold + '22'};color:${gold};border:1px solid ${gold + '44'};">${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <!-- GOLD DIVIDER -->
  <div style="height:2px;background:linear-gradient(90deg,transparent,${gold},transparent);margin-bottom:24px;"></div>

  <!-- BILL FROM / TO -->
  <div style="display:flex;gap:0;margin-bottom:22px;">
    <div style="flex:1;padding-right:20px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${goldDim};font-weight:800;margin-bottom:8px;">Bill From</div>
      <div style="font-size:14px;font-weight:800;color:#fff;">${biz.ownerName || biz.companyName || '—'}</div>
      <div style="font-size:11px;color:#6B7280;line-height:2;margin-top:4px;">
        ${biz.companyName && biz.ownerName ? biz.companyName + '<br>' : ''}
        ${biz.mobile ? biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="flex:1;padding-left:20px;border-left:1px solid #2D3748;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${goldDim};font-weight:800;margin-bottom:8px;">Bill To</div>
      <div style="font-size:14px;font-weight:800;color:#fff;">${invoice.clientName}</div>
      <div style="font-size:11px;color:#6B7280;line-height:2;margin-top:4px;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
      </div>
    </div>
  </div>

  <!-- ROUTE STRIP -->
  <div style="background:#1C1917;border:1px solid #2D3748;border-left:4px solid ${gold};border-radius:0 10px 10px 0;padding:14px 20px;margin-bottom:22px;display:flex;flex-wrap:wrap;gap:0;align-items:center;">
    <div style="flex:1.2;min-width:120px;padding-right:12px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#4B5563;margin-bottom:3px;">From</div>
      <div style="font-size:14px;font-weight:900;color:#fff;">${invoice.fromLocation}</div>
    </div>
    <div style="font-size:22px;color:${gold};padding:0 10px;">→</div>
    <div style="flex:1.2;min-width:120px;padding:0 12px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#4B5563;margin-bottom:3px;">To</div>
      <div style="font-size:14px;font-weight:900;color:#fff;">${invoice.toLocation}</div>
    </div>
    <div style="width:1px;height:34px;background:#2D3748;margin:0 12px;"></div>
    <div style="flex:1;padding-right:12px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#4B5563;margin-bottom:3px;">Truck No.</div>
      <div style="font-size:13px;font-weight:800;color:#D1D5DB;">${invoice.truckNumber || '—'}</div>
    </div>
    <div style="flex:1;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#4B5563;margin-bottom:3px;">Driver</div>
      <div style="font-size:13px;font-weight:800;color:#D1D5DB;">${invoice.driverName || '—'}</div>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:#1C1917;border-bottom:2px solid ${gold + '44'};">
        <th style="padding:11px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${gold};text-align:left;width:36px;">#</th>
        <th style="padding:11px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${gold};text-align:left;">Service Description</th>
        <th style="padding:11px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${gold};text-align:right;">Amount (${invoice.currency})</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- TOTALS -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:22px;">
    <div style="width:300px;">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2D3748;color:#6B7280;font-size:12.5px;">
        <span>Advance Received</span><span style="color:#9CA3AF;font-weight:600;">${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2D3748;color:#6B7280;font-size:12.5px;">
        <span>Total Expenses</span><span style="color:#9CA3AF;font-weight:600;">${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
      </div>
      <div style="background:linear-gradient(135deg,${gold},${goldDim});color:#0C0A09;padding:14px 16px;border-radius:10px;display:flex;justify-content:space-between;font-size:16px;font-weight:900;margin-top:10px;">
        <span>BALANCE DUE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
      </div>
      <div style="text-align:center;font-size:11.5px;font-weight:700;color:${goldDim};margin-top:10px;">
        ${invoice.settlementStatus === 'receive' ? 'Driver to <strong>receive</strong> money.' : invoice.settlementStatus === 'return' ? 'Driver to <strong>return</strong> money.' : 'Fully settled.'}
      </div>
    </div>
  </div>

  <!-- PAYMENT (dark themed) -->
  ${(biz.upiId || biz.bankName) ? (() => {
    const balance = Math.abs(invoice.balance);
    const safeName = encodeURIComponent((biz.ownerName || biz.companyName || 'Business').replace(/[&=?]/g, ''));
    const safeUpi = encodeURIComponent(biz.upiId ?? '');
    const qrUrl = biz.upiId
      ? `https://api.qrserver.com/v1/create-qr-code/?size=110x110&bgcolor=1c1917&color=f59e0b&qzone=1&data=${encodeURIComponent(`upi://pay?pa=${safeUpi}&pn=${safeName}&am=${balance.toFixed(2)}&cu=INR`)}`
      : null;
    return `<div style="background:#1C1917;border:1px solid #2D3748;border-radius:14px;padding:18px 22px;margin-bottom:20px;display:flex;gap:18px;align-items:center;">
      <div style="flex:1;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#4B5563;margin-bottom:4px;">💳 DIGITAL KHATA — PAYMENT</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin-top:10px;">
          ${biz.upiId ? `<div><div style="font-size:9px;color:#4B5563;margin-bottom:2px;">UPI ID</div><div style="font-size:12.5px;font-weight:700;color:#fff;">${biz.upiId}</div><div style="font-size:8.5px;color:${gold};margin-top:2px;font-style:italic;">PhonePe · GPay · BHIM</div></div>` : ''}
          ${biz.bankName ? `<div><div style="font-size:9px;color:#4B5563;margin-bottom:2px;">Bank</div><div style="font-size:12.5px;font-weight:700;color:#fff;">${biz.bankName}</div></div>` : ''}
          ${biz.accountNumber ? `<div><div style="font-size:9px;color:#4B5563;margin-bottom:2px;">Account No.</div><div style="font-size:12.5px;font-weight:700;color:#fff;">${biz.accountNumber}</div></div>` : ''}
          ${biz.ifscCode ? `<div><div style="font-size:9px;color:#4B5563;margin-bottom:2px;">IFSC Code</div><div style="font-size:12.5px;font-weight:700;color:#fff;">${biz.ifscCode}</div></div>` : ''}
        </div>
      </div>
      ${qrUrl ? `<div style="flex-shrink:0;text-align:center;">
        <div style="background:#1c1917;border:1px solid ${gold + '44'};padding:7px;border-radius:10px;display:inline-block;">
          <img src="${qrUrl}" alt="QR" width="88" height="88" style="display:block;" />
        </div>
        <div style="font-size:9px;color:#4B5563;margin-top:5px;">SCAN TO PAY</div>
      </div>` : ''}
    </div>`;
  })() : ''}

  <!-- NOTES dark -->
  ${invoice.notes ? `<div style="background:#1C1917;border-left:3px solid ${gold};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:18px;font-size:12px;color:#9CA3AF;line-height:1.9;"><strong style="color:${gold};">Notes: </strong>${invoice.notes}</div>` : ''}
  ${invoice.paymentTerms ? `<div style="margin-bottom:16px;font-size:11.5px;color:#6B7280;line-height:1.8;"><strong style="color:#9CA3AF;">Payment Terms:</strong> ${invoice.paymentTerms}</div>` : ''}

  <!-- FOOTER dark -->
  <div style="border-top:1px solid #2D3748;padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="font-size:11px;color:#4B5563;max-width:340px;line-height:1.9;">${biz.footerNotes || 'Thank you for your business.'}</div>
    <div style="text-align:center;min-width:180px;">
      ${sigHtml}
      <div style="width:160px;height:1px;background:${gold + '44'};margin:0 auto 7px;"></div>
      <div style="font-size:9.5px;color:#4B5563;text-transform:uppercase;letter-spacing:1px;">Authorized Signature</div>
      <div style="font-size:12px;font-weight:700;color:#9CA3AF;margin-top:4px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>

  <div style="position:absolute;bottom:24px;right:54px;font-size:10px;color:#374151;">Page 1 of 1</div>
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER 8: Standard Layout (clean classic) ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderStandardHTML(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;

  const logoHtml = logo
    ? `<img src="${logo}" alt="logo" style="height:68px;max-width:150px;object-fit:contain;border-radius:4px;display:block;margin-bottom:10px;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=794, initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { width:794px; font-family:${t.font}; color:${t.bodyText}; background:#e5e5e5; font-size:13px; }
  .page { width:794px; min-height:1123px; padding:52px 54px; position:relative; background:${t.bodyBg}; margin:0 auto; }
  @page { size:A4; margin:0; }
  @media print { html,body { background:#fff; } .page { margin:0; } }
</style>
</head>
<body>
<div class="page">
  ${pageBorder(t.borderColor, '1.5px', 10)}
  ${invoice.status === 'draft' ? draftWatermark() : ''}

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
    <div style="flex:1;">
      ${logoHtml}
      <div style="font-size:22px;font-weight:900;color:${t.companyNameColor};letter-spacing:-0.5px;line-height:1.2;">${biz.companyName || biz.ownerName || 'Company Name'}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:2;margin-top:6px;">
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:40px;font-weight:900;color:${t.invoiceTitleColor};letter-spacing:-3px;line-height:1;">INVOICE</div>
      <div style="font-size:14px;font-weight:800;color:${t.companyNameColor};margin-top:6px;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:${t.metaTextColor};margin-top:8px;line-height:2.1;">
        Date: <strong>${invoice.date}</strong><br>
        ${invoice.dueDate ? 'Due: <strong>' + invoice.dueDate + '</strong>' : ''}
      </div>
      <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;margin-top:8px;${statusBadgeCss(invoice.status)}">${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <!-- DIVIDER -->
  <div style="height:${t.dividerHeight}px;background:${t.dividerCss};border-radius:2px;margin-bottom:24px;"></div>

  <!-- BILL FROM / TO -->
  <div style="display:flex;gap:0;margin-bottom:22px;">
    <div style="flex:1;padding-right:24px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill From</div>
      <div style="font-size:14px;font-weight:800;color:${t.billNameColor};">${biz.ownerName || biz.companyName || '—'}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:2;margin-top:4px;">
        ${biz.mobile ? biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="flex:1;padding-left:24px;border-left:2px solid ${t.borderColor};">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:8px;">Bill To</div>
      <div style="font-size:14px;font-weight:800;color:${t.billNameColor};">${invoice.clientName}</div>
      <div style="font-size:11px;color:${t.metaTextColor};line-height:2;margin-top:4px;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
      </div>
    </div>
  </div>

  <!-- TRIP -->
  ${tripRow(invoice, t)}

  <!-- ITEMS TABLE -->
  ${buildItemsTable(invoice, t)}

  <!-- TOTALS -->
  <div style="margin-bottom:22px;">
    ${buildTotalsBox(invoice, t, '300px')}
  </div>

  <!-- DIGITAL KHATA PAYMENT -->
  ${buildDigitalKhata(invoice, t)}

  <!-- NOTES -->
  ${notesBlock(invoice, t)}

  <!-- FOOTER -->
  ${footerSignature(biz, t, sig)}

  <div style="position:absolute;bottom:24px;right:54px;font-size:10px;color:${t.metaTextColor};opacity:0.45;">Page 1 of 1</div>
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
    case 'classic-geometric': return renderClassicGeometric(invoice, t, logo, sig);
    case 'top-banner':        return renderTopBannerHTML(invoice, t, logo, sig);
    case 'corporate':         return renderCorporateHTML(invoice, t, logo, sig);
    case 'compact':           return renderCompactHTML(invoice, t, logo, sig);
    case 'sidebar':           return renderSidebarHTML(invoice, t, logo, sig);
    case 'gst-v2':            return renderGSTHTML(invoice, t, logo, sig);
    case 'premium-dark':      return renderPremiumDarkHTML(invoice, t, logo, sig);
    default:                  return renderStandardHTML(invoice, t, logo, sig);
  }
}

export interface PDFResult {
  uri: string;
}

export async function generatePDFWithTemplate(invoice: Invoice, templateId: string): Promise<PDFResult> {
  console.log('[PDF] generatePDFWithTemplate — invoice:', invoice.invoiceNumber, '| template:', templateId);

  const html = await buildInvoiceHTML(invoice, templateId);
  console.log('[PDF] HTML length:', html.length, 'chars');

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
      throw new Error(`PDF file is ${size} bytes — too small.`);
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
