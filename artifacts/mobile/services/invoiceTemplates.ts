/**
 * FleetInvoice — Invoice Template System v3
 *
 * 6 structurally unique renderers — every template has a different:
 *   • header position & layout
 *   • billing section design
 *   • table structure
 *   • footer design
 *   • QR code placement
 *   • signature placement
 *   • border/frame treatment
 *   • geometric decorations
 *
 *  A. classic-geometric  — navy/orange, double border, SVG corners, logo-left invoice-right
 *  B. corporate-modern   — royal blue top/bottom bar, split 2-panel header, 3-col footer
 *  C. gst-compliance     — green, TAX INVOICE banner, 9-col GST table, green footer strip
 *  D. transport-pro      — dark navy full-width header, orange route bar, left orange border
 *  E. premium-dark       — charcoal, gold double border, centered layout, centered QR
 *  F. warm-amber         — amber wave header, hero bill-to card, amber table band
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
    | 'classic-geometric'
    | 'corporate-modern'
    | 'gst-compliance'
    | 'transport-pro'
    | 'premium-dark'
    | 'warm-amber';
  previewColors: [string, string, string];
  font: string;
  // Colors
  primary: string;
  accent: string;
  headerBg: string;
  headerText: string;
  bodyBg: string;
  bodyText: string;
  tableHeadBg: string;
  tableHeadText: string;
  grandRowBg: string;
  grandRowText: string;
  rowAlt: string;
  borderColor: string;
  metaText: string;
  labelColor: string;
  amountColor: string;
  notesBg: string;
  notesAccent: string;
  // Legacy compat (used by shared helpers)
  companyNameColor: string;
  invoiceTitleColor: string;
  dividerCss: string;
  dividerHeight: number;
  billNameColor: string;
  tripBg: string;
  tripBorder: string;
  tripValColor: string;
  payValColor: string;
  itemAmtColor: string;
  metaTextColor: string;
  totalRowColor: string;
  accentColor?: string;
}

// ─── Template library ─────────────────────────────────────────────────────────

export const INVOICE_TEMPLATES: TemplateStyle[] = [
  // ── A. Classic Geometric ──────────────────────────────────────────────────
  {
    id: 'classic',
    name: 'Classic Geometric',
    description: 'Navy & orange — double border, SVG corner diamonds, chevron divider',
    isPremium: false,
    layout: 'classic-geometric',
    previewColors: ['#0D2B5E', '#FFFFFF', '#D64E00'],
    font: 'Arial, Helvetica, sans-serif',
    primary: '#0D2B5E', accent: '#D64E00',
    headerBg: '#0D2B5E', headerText: '#FFFFFF',
    bodyBg: '#FFFFFF', bodyText: '#1A1A2E',
    tableHeadBg: '#0D2B5E', tableHeadText: '#FFFFFF',
    grandRowBg: '#0D2B5E', grandRowText: '#FFFFFF',
    rowAlt: '#F0F4FC', borderColor: '#CBD5E1',
    metaText: '#4A5770', labelColor: '#D64E00',
    amountColor: '#D64E00', notesBg: '#FFF8F5',
    notesAccent: '#D64E00',
    // legacy
    companyNameColor: '#0D2B5E', invoiceTitleColor: '#D64E00',
    dividerCss: 'linear-gradient(90deg,#0D2B5E,#D64E00)',
    dividerHeight: 5, billNameColor: '#0D2B5E',
    tripBg: '#EDF2FB', tripBorder: '#0D2B5E', tripValColor: '#0D2B5E',
    payValColor: '#0D2B5E', itemAmtColor: '#D64E00',
    metaTextColor: '#4A5770', totalRowColor: '#374151',
    accentColor: '#D64E00',
  },
  // ── B. Corporate Modern ───────────────────────────────────────────────────
  {
    id: 'modern',
    name: 'Corporate Modern',
    description: 'Royal blue — split 2-panel header, card billing, 3-col footer with QR center',
    isPremium: false,
    layout: 'corporate-modern',
    previewColors: ['#1E40AF', '#FFFFFF', '#3B82F6'],
    font: '"Helvetica Neue", Arial, sans-serif',
    primary: '#1E40AF', accent: '#3B82F6',
    headerBg: '#1E40AF', headerText: '#FFFFFF',
    bodyBg: '#F8FAFC', bodyText: '#0F172A',
    tableHeadBg: '#1E40AF', tableHeadText: '#FFFFFF',
    grandRowBg: '#1E40AF', grandRowText: '#FFFFFF',
    rowAlt: '#F1F5F9', borderColor: '#E2E8F0',
    metaText: '#64748B', labelColor: '#1E40AF',
    amountColor: '#1E40AF', notesBg: '#EFF6FF',
    notesAccent: '#1E40AF',
    // legacy
    companyNameColor: '#1E40AF', invoiceTitleColor: '#3B82F6',
    dividerCss: 'linear-gradient(90deg,#1E40AF,#3B82F6)', dividerHeight: 3,
    billNameColor: '#1E40AF', tripBg: '#F0F9FF', tripBorder: '#1E40AF',
    tripValColor: '#1E40AF', payValColor: '#1E40AF',
    itemAmtColor: '#1E40AF', metaTextColor: '#64748B',
    totalRowColor: '#374151', accentColor: '#3B82F6',
  },
  // ── C. Green GST Compliance ───────────────────────────────────────────────
  {
    id: 'gst',
    name: 'Green GST',
    description: 'Dark green — TAX INVOICE banner, 9-col GST table, full green footer strip',
    isPremium: false,
    layout: 'gst-compliance',
    previewColors: ['#14532D', '#FFFFFF', '#16A34A'],
    font: 'Arial, Helvetica, sans-serif',
    primary: '#14532D', accent: '#16A34A',
    headerBg: '#14532D', headerText: '#FFFFFF',
    bodyBg: '#FFFFFF', bodyText: '#1A1A1A',
    tableHeadBg: '#14532D', tableHeadText: '#FFFFFF',
    grandRowBg: '#14532D', grandRowText: '#FFFFFF',
    rowAlt: '#F0FDF4', borderColor: '#BBF7D0',
    metaText: '#4B5563', labelColor: '#14532D',
    amountColor: '#14532D', notesBg: '#F0FDF4',
    notesAccent: '#16A34A',
    // legacy
    companyNameColor: '#14532D', invoiceTitleColor: '#16A34A',
    dividerCss: 'linear-gradient(90deg,#14532D,#16A34A)', dividerHeight: 5,
    billNameColor: '#14532D', tripBg: '#F0FDF4', tripBorder: '#16A34A',
    tripValColor: '#14532D', payValColor: '#14532D',
    itemAmtColor: '#14532D', metaTextColor: '#4B5563',
    totalRowColor: '#374151', accentColor: '#16A34A',
  },
  // ── D. Indian Transport Pro ───────────────────────────────────────────────
  {
    id: 'transport',
    name: 'Indian Transport Pro',
    description: 'Dark navy — full-width header, orange route bar, left accent border',
    isPremium: false,
    layout: 'transport-pro',
    previewColors: ['#0A1628', '#E05C00', '#1E4B8C'],
    font: 'Arial, Helvetica, sans-serif',
    primary: '#0A1628', accent: '#E05C00',
    headerBg: '#0A1628', headerText: '#FFFFFF',
    bodyBg: '#FFFFFF', bodyText: '#1A1A2E',
    tableHeadBg: '#1E4B8C', tableHeadText: '#FFFFFF',
    grandRowBg: '#0A1628', grandRowText: '#FFFFFF',
    rowAlt: '#F0F4FC', borderColor: '#D1D5DB',
    metaText: '#4B5563', labelColor: '#E05C00',
    amountColor: '#0A1628', notesBg: '#FFF7ED',
    notesAccent: '#E05C00',
    // legacy
    companyNameColor: '#0A1628', invoiceTitleColor: '#E05C00',
    dividerCss: 'linear-gradient(90deg,#0A1628,#1E4B8C)', dividerHeight: 4,
    billNameColor: '#0A1628', tripBg: '#FFF7ED', tripBorder: '#E05C00',
    tripValColor: '#0A1628', payValColor: '#0A1628',
    itemAmtColor: '#0A1628', metaTextColor: '#4B5563',
    totalRowColor: '#374151', accentColor: '#E05C00',
  },
  // ── E. Premium Dark ───────────────────────────────────────────────────────
  {
    id: 'dark',
    name: 'Premium Dark',
    description: 'Charcoal & gold — gold double border, SVG corners, centered layout',
    isPremium: false,
    layout: 'premium-dark',
    previewColors: ['#1C1C2E', '#F59E0B', '#D97706'],
    font: 'Georgia, "Times New Roman", serif',
    primary: '#1C1C2E', accent: '#F59E0B',
    headerBg: '#1C1C2E', headerText: '#F59E0B',
    bodyBg: '#1C1C2E', bodyText: '#E2E8F0',
    tableHeadBg: '#2D2D44', tableHeadText: '#F59E0B',
    grandRowBg: '#F59E0B', grandRowText: '#1C1C2E',
    rowAlt: '#242438', borderColor: '#3D3D5C',
    metaText: '#9CA3AF', labelColor: '#F59E0B',
    amountColor: '#F59E0B', notesBg: '#242438',
    notesAccent: '#F59E0B',
    // legacy
    companyNameColor: '#FFFFFF', invoiceTitleColor: '#F59E0B',
    dividerCss: 'linear-gradient(90deg,#F59E0B,#D97706)', dividerHeight: 2,
    billNameColor: '#FFFFFF', tripBg: '#242438', tripBorder: '#F59E0B',
    tripValColor: '#E2E8F0', payValColor: '#F59E0B',
    itemAmtColor: '#F59E0B', metaTextColor: '#9CA3AF',
    totalRowColor: '#D1D5DB', accentColor: '#F59E0B',
  },
  // ── F. Warm Amber ─────────────────────────────────────────────────────────
  {
    id: 'orange',
    name: 'Warm Amber',
    description: 'Amber & orange — wave header, hero bill-to card, amber table band',
    isPremium: false,
    layout: 'warm-amber',
    previewColors: ['#EA580C', '#FFF7ED', '#F97316'],
    font: '"Helvetica Neue", Arial, sans-serif',
    primary: '#EA580C', accent: '#F97316',
    headerBg: '#EA580C', headerText: '#FFFFFF',
    bodyBg: '#FFFFFF', bodyText: '#1C0A00',
    tableHeadBg: '#EA580C', tableHeadText: '#FFFFFF',
    grandRowBg: '#EA580C', grandRowText: '#FFFFFF',
    rowAlt: '#FFF7ED', borderColor: '#FED7AA',
    metaText: '#6B4423', labelColor: '#EA580C',
    amountColor: '#C2410C', notesBg: '#FFF7ED',
    notesAccent: '#EA580C',
    // legacy
    companyNameColor: '#EA580C', invoiceTitleColor: '#F97316',
    dividerCss: 'linear-gradient(90deg,#EA580C,#F97316)', dividerHeight: 4,
    billNameColor: '#1C0A00', tripBg: '#FFF7ED', tripBorder: '#EA580C',
    tripValColor: '#1C0A00', payValColor: '#EA580C',
    itemAmtColor: '#C2410C', metaTextColor: '#6B4423',
    totalRowColor: '#374151', accentColor: '#EA580C',
  },
  // ── Variant: Emerald GST ──────────────────────────────────────────────────
  {
    id: 'emerald',
    name: 'Emerald GST',
    description: 'Emerald green — TAX INVOICE compliance, formal supplier format',
    isPremium: false,
    layout: 'gst-compliance',
    previewColors: ['#065F46', '#ECFDF5', '#10B981'],
    font: 'Arial, Helvetica, sans-serif',
    primary: '#065F46', accent: '#10B981',
    headerBg: '#065F46', headerText: '#FFFFFF',
    bodyBg: '#FFFFFF', bodyText: '#1A1A1A',
    tableHeadBg: '#065F46', tableHeadText: '#ECFDF5',
    grandRowBg: '#065F46', grandRowText: '#ECFDF5',
    rowAlt: '#ECFDF5', borderColor: '#A7F3D0',
    metaText: '#374151', labelColor: '#065F46',
    amountColor: '#065F46', notesBg: '#ECFDF5',
    notesAccent: '#10B981',
    companyNameColor: '#065F46', invoiceTitleColor: '#10B981',
    dividerCss: 'linear-gradient(90deg,#065F46,#10B981)', dividerHeight: 5,
    billNameColor: '#065F46', tripBg: '#ECFDF5', tripBorder: '#10B981',
    tripValColor: '#065F46', payValColor: '#065F46',
    itemAmtColor: '#065F46', metaTextColor: '#374151',
    totalRowColor: '#374151', accentColor: '#10B981',
  },
  // ── Variant: Minimal ─────────────────────────────────────────────────────
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Slate gray — clean corporate modern, reduced visual weight',
    isPremium: false,
    layout: 'corporate-modern',
    previewColors: ['#334155', '#F8FAFC', '#64748B'],
    font: '"Helvetica Neue", Arial, sans-serif',
    primary: '#334155', accent: '#64748B',
    headerBg: '#334155', headerText: '#FFFFFF',
    bodyBg: '#F8FAFC', bodyText: '#1E293B',
    tableHeadBg: '#334155', tableHeadText: '#FFFFFF',
    grandRowBg: '#334155', grandRowText: '#FFFFFF',
    rowAlt: '#F1F5F9', borderColor: '#E2E8F0',
    metaText: '#64748B', labelColor: '#334155',
    amountColor: '#334155', notesBg: '#F1F5F9',
    notesAccent: '#64748B',
    companyNameColor: '#334155', invoiceTitleColor: '#64748B',
    dividerCss: 'linear-gradient(90deg,#334155,#64748B)', dividerHeight: 3,
    billNameColor: '#334155', tripBg: '#F1F5F9', tripBorder: '#334155',
    tripValColor: '#334155', payValColor: '#334155',
    itemAmtColor: '#334155', metaTextColor: '#64748B',
    totalRowColor: '#374151', accentColor: '#64748B',
  },
  // ── Variant: Blue Classic ─────────────────────────────────────────────────
  {
    id: 'blue',
    name: 'Blue Classic',
    description: 'Deep blue & steel — classic geometric layout in blue palette',
    isPremium: false,
    layout: 'classic-geometric',
    previewColors: ['#1E3A8A', '#FFFFFF', '#2563EB'],
    font: 'Arial, Helvetica, sans-serif',
    primary: '#1E3A8A', accent: '#2563EB',
    headerBg: '#1E3A8A', headerText: '#FFFFFF',
    bodyBg: '#FFFFFF', bodyText: '#1E293B',
    tableHeadBg: '#1E3A8A', tableHeadText: '#FFFFFF',
    grandRowBg: '#1E3A8A', grandRowText: '#FFFFFF',
    rowAlt: '#EFF6FF', borderColor: '#BFDBFE',
    metaText: '#4B6490', labelColor: '#2563EB',
    amountColor: '#1E3A8A', notesBg: '#EFF6FF',
    notesAccent: '#2563EB',
    companyNameColor: '#1E3A8A', invoiceTitleColor: '#2563EB',
    dividerCss: 'linear-gradient(90deg,#1E3A8A,#2563EB)', dividerHeight: 5,
    billNameColor: '#1E3A8A', tripBg: '#EFF6FF', tripBorder: '#1E3A8A',
    tripValColor: '#1E3A8A', payValColor: '#1E3A8A',
    itemAmtColor: '#1E3A8A', metaTextColor: '#4B6490',
    totalRowColor: '#374151', accentColor: '#2563EB',
  },
  // ── Variant: Executive Premium ────────────────────────────────────────────
  {
    id: 'executive',
    name: 'Executive',
    description: 'Deep charcoal & platinum — premium dark with silver accents',
    isPremium: false,
    layout: 'premium-dark',
    previewColors: ['#111827', '#D1D5DB', '#9CA3AF'],
    font: 'Georgia, "Times New Roman", serif',
    primary: '#111827', accent: '#D1D5DB',
    headerBg: '#111827', headerText: '#D1D5DB',
    bodyBg: '#111827', bodyText: '#D1D5DB',
    tableHeadBg: '#1F2937', tableHeadText: '#D1D5DB',
    grandRowBg: '#D1D5DB', grandRowText: '#111827',
    rowAlt: '#1F2937', borderColor: '#374151',
    metaText: '#9CA3AF', labelColor: '#D1D5DB',
    amountColor: '#D1D5DB', notesBg: '#1F2937',
    notesAccent: '#D1D5DB',
    companyNameColor: '#FFFFFF', invoiceTitleColor: '#D1D5DB',
    dividerCss: 'linear-gradient(90deg,#D1D5DB,#9CA3AF)', dividerHeight: 1,
    billNameColor: '#FFFFFF', tripBg: '#1F2937', tripBorder: '#D1D5DB',
    tripValColor: '#D1D5DB', payValColor: '#D1D5DB',
    itemAmtColor: '#D1D5DB', metaTextColor: '#9CA3AF',
    totalRowColor: '#D1D5DB', accentColor: '#D1D5DB',
  },
  // ── Variant: Receipt ──────────────────────────────────────────────────────
  {
    id: 'receipt',
    name: 'Receipt Style',
    description: 'Teal — classic geometric in teal palette, compact spacing',
    isPremium: false,
    layout: 'classic-geometric',
    previewColors: ['#0F766E', '#FFFFFF', '#14B8A6'],
    font: 'Arial, Helvetica, sans-serif',
    primary: '#0F766E', accent: '#14B8A6',
    headerBg: '#0F766E', headerText: '#FFFFFF',
    bodyBg: '#FFFFFF', bodyText: '#134E4A',
    tableHeadBg: '#0F766E', tableHeadText: '#CCFBF1',
    grandRowBg: '#0F766E', grandRowText: '#CCFBF1',
    rowAlt: '#F0FDFA', borderColor: '#99F6E4',
    metaText: '#4B7A74', labelColor: '#0F766E',
    amountColor: '#0F766E', notesBg: '#F0FDFA',
    notesAccent: '#0F766E',
    companyNameColor: '#0F766E', invoiceTitleColor: '#14B8A6',
    dividerCss: 'linear-gradient(90deg,#0F766E,#14B8A6)', dividerHeight: 5,
    billNameColor: '#0F766E', tripBg: '#F0FDFA', tripBorder: '#0F766E',
    tripValColor: '#0F766E', payValColor: '#0F766E',
    itemAmtColor: '#0F766E', metaTextColor: '#4B7A74',
    totalRowColor: '#374151', accentColor: '#14B8A6',
  },
  // ── Variant: Logistics ────────────────────────────────────────────────────
  {
    id: 'logistics',
    name: 'Logistics',
    description: 'Earth tones — transport pro layout in warm earth palette',
    isPremium: false,
    layout: 'transport-pro',
    previewColors: ['#422006', '#F59E0B', '#78350F'],
    font: 'Arial, Helvetica, sans-serif',
    primary: '#422006', accent: '#F59E0B',
    headerBg: '#1C0A00', headerText: '#FFFFFF',
    bodyBg: '#FFFFFF', bodyText: '#1C0A00',
    tableHeadBg: '#78350F', tableHeadText: '#FEF3C7',
    grandRowBg: '#422006', grandRowText: '#FEF3C7',
    rowAlt: '#FFFBEB', borderColor: '#FDE68A',
    metaText: '#6B4423', labelColor: '#D97706',
    amountColor: '#92400E', notesBg: '#FEF3C7',
    notesAccent: '#D97706',
    companyNameColor: '#422006', invoiceTitleColor: '#F59E0B',
    dividerCss: 'linear-gradient(90deg,#422006,#78350F)', dividerHeight: 4,
    billNameColor: '#422006', tripBg: '#FFFBEB', tripBorder: '#F59E0B',
    tripValColor: '#422006', payValColor: '#D97706',
    itemAmtColor: '#92400E', metaTextColor: '#6B4423',
    totalRowColor: '#374151', accentColor: '#F59E0B',
  },
];

// ─── Shared helpers ────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status: string, bg = '', fg = ''): string {
  const preset: Record<string, [string, string]> = {
    paid: ['#DCFCE7', '#15803D'],
    pending: ['#FEF9C3', '#854D0E'],
    overdue: ['#FEE2E2', '#DC2626'],
    draft: ['#F1F5F9', '#475569'],
  };
  const [b, f] = preset[status] ?? ['#F1F5F9', '#475569'];
  return `<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;background:${bg || b};color:${fg || f};">${status.toUpperCase()}</span>`;
}

function pageBorder(color: string, width = '1.5px', inset = 12): string {
  return `<div style="position:absolute;top:${inset}px;left:${inset}px;right:${inset}px;bottom:${inset}px;border:${width} solid ${color};pointer-events:none;z-index:0;"></div>`;
}

function doublePageBorder(outer: string, inner: string): string {
  return `
    <div style="position:absolute;top:8px;left:8px;right:8px;bottom:8px;border:2px solid ${outer};pointer-events:none;z-index:0;"></div>
    <div style="position:absolute;top:14px;left:14px;right:14px;bottom:14px;border:1px solid ${inner};pointer-events:none;z-index:0;"></div>`;
}

/** 4 SVG diamond corner ornaments */
function geoCorners(primary: string, accent: string): string {
  const diamond = (x: number, y: number, r = 0) =>
    `<svg style="position:absolute;top:${y}px;left:${x}px;width:64px;height:64px;z-index:2;transform:rotate(${r}deg);" viewBox="0 0 64 64" fill="none">
      <polygon points="20,4 36,20 20,36 4,20" fill="${primary}" opacity="0.9"/>
      <polygon points="30,4 46,20 30,36 14,20" fill="${accent}" opacity="0.5"/>
      <polygon points="4,26 18,40 4,54 -10,40" fill="${accent}" opacity="0.4"/>
    </svg>`;
  return `
    ${diamond(8, 8)}
    <svg style="position:absolute;top:8px;right:8px;width:64px;height:64px;z-index:2;" viewBox="0 0 64 64" fill="none">
      <polygon points="44,4 60,20 44,36 28,20" fill="${primary}" opacity="0.9"/>
      <polygon points="34,4 18,20 34,36 50,20" fill="${accent}" opacity="0.5"/>
      <polygon points="60,26 46,40 60,54 74,40" fill="${accent}" opacity="0.4"/>
    </svg>
    <svg style="position:absolute;bottom:8px;left:8px;width:64px;height:64px;z-index:2;" viewBox="0 0 64 64" fill="none">
      <polygon points="20,60 36,44 20,28 4,44" fill="${primary}" opacity="0.9"/>
      <polygon points="30,60 46,44 30,28 14,44" fill="${accent}" opacity="0.5"/>
      <polygon points="4,38 18,24 4,10 -10,24" fill="${accent}" opacity="0.4"/>
    </svg>
    <svg style="position:absolute;bottom:8px;right:8px;width:64px;height:64px;z-index:2;" viewBox="0 0 64 64" fill="none">
      <polygon points="44,60 28,44 44,28 60,44" fill="${primary}" opacity="0.9"/>
      <polygon points="34,60 50,44 34,28 18,44" fill="${accent}" opacity="0.5"/>
      <polygon points="60,38 46,24 60,10 74,24" fill="${accent}" opacity="0.4"/>
    </svg>`;
}

/** Gold corner diamonds for Premium Dark */
function goldCorners(gold: string): string {
  const sz = 48;
  const d = `<polygon points="${sz/2},4 ${sz-4},${sz/2} ${sz/2},${sz-4} 4,${sz/2}" fill="${gold}" opacity="0.85"/>`;
  const d2 = `<polygon points="${sz/2},10 ${sz-10},${sz/2} ${sz/2},${sz-10} 10,${sz/2}" fill="${gold}" opacity="0.25"/>`;
  const mk = (style: string) => `<svg style="position:absolute;${style}width:${sz}px;height:${sz}px;z-index:2;" viewBox="0 0 ${sz} ${sz}" fill="none">${d}${d2}</svg>`;
  return mk('top:10px;left:10px;') + mk('top:10px;right:10px;') + mk('bottom:10px;left:10px;') + mk('bottom:10px;right:10px;');
}

/** Chevron divider bar */
function chevronDivider(bg: string, height = 10): string {
  return `<div style="background:${bg};height:${height}px;margin-bottom:20px;position:relative;overflow:hidden;">
    <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent,transparent 18px,rgba(255,255,255,0.12) 18px,rgba(255,255,255,0.12) 20px);"></div>
  </div>`;
}

/** Build QR URL for UPI payment */
function qrUrl(upiId: string, amount: number, currency: string, size = 120): string {
  const upiData = `upi://pay?pa=${encodeURIComponent(upiId)}&am=${amount > 0 ? amount : ''}&cu=${currency}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(upiData)}&bgcolor=ffffff&color=000000&qzone=1`;
}

/** Items table — S.No | Description (left) | Amount (right) */
function itemsTable(invoice: Invoice, t: TemplateStyle, bg = '#FFFFFF'): string {
  if (!invoice.expenses?.length) return '';
  const rows = invoice.expenses.map((item, i) => `
    <tr style="border-bottom:1px solid ${t.borderColor};background:${i % 2 === 1 ? t.rowAlt : bg};">
      <td style="padding:10px 12px;font-size:11px;color:${t.metaText};width:34px;text-align:center;">${i + 1}</td>
      <td style="padding:10px 14px;font-size:13px;color:${t.bodyText};text-align:left;">${item.name}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:800;color:${t.amountColor};text-align:right;white-space:nowrap;">${invoice.currency}&nbsp;${fmt(item.amount)}</td>
    </tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead>
      <tr style="background:${t.tableHeadBg};">
        <th style="padding:10px 12px;font-size:10px;color:${t.tableHeadText};text-align:center;width:34px;text-transform:uppercase;letter-spacing:0.5px;">#</th>
        <th style="padding:10px 14px;font-size:10px;color:${t.tableHeadText};text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Service Description</th>
        <th style="padding:10px 14px;font-size:10px;color:${t.tableHeadText};text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Amount (${invoice.currency})</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** GST items table — 9 columns */
function gstItemsTable(invoice: Invoice, t: TemplateStyle): string {
  if (!invoice.expenses?.length) return '';
  const rows = invoice.expenses.map((item, i) => {
    const cgst = item.amount * 0.09;
    const sgst = item.amount * 0.09;
    const total = item.amount + cgst + sgst;
    return `<tr style="border-bottom:1px solid ${t.borderColor};background:${i % 2 === 1 ? t.rowAlt : '#fff'};">
      <td style="padding:8px 8px;font-size:11px;color:${t.metaText};text-align:center;">${i + 1}</td>
      <td style="padding:8px 10px;font-size:12px;color:${t.bodyText};text-align:left;">${item.name}</td>
      <td style="padding:8px 8px;font-size:11px;color:${t.metaText};text-align:center;">9965</td>
      <td style="padding:8px 10px;font-size:12px;font-weight:600;text-align:right;">${fmt(item.amount)}</td>
      <td style="padding:8px 8px;font-size:11px;text-align:center;">9%</td>
      <td style="padding:8px 8px;font-size:11px;text-align:right;">${fmt(cgst)}</td>
      <td style="padding:8px 8px;font-size:11px;text-align:center;">9%</td>
      <td style="padding:8px 8px;font-size:11px;text-align:right;">${fmt(sgst)}</td>
      <td style="padding:8px 10px;font-size:12px;font-weight:800;color:${t.amountColor};text-align:right;">${fmt(total)}</td>
    </tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px;">
    <thead>
      <tr style="background:${t.tableHeadBg};">
        <th style="padding:8px 8px;color:${t.tableHeadText};text-align:center;width:26px;">#</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:left;">Description of Services</th>
        <th style="padding:8px 8px;color:${t.tableHeadText};text-align:center;">HSN/SAC</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:right;">Taxable Value</th>
        <th style="padding:8px 8px;color:${t.tableHeadText};text-align:center;">CGST%</th>
        <th style="padding:8px 8px;color:${t.tableHeadText};text-align:right;">CGST Amt</th>
        <th style="padding:8px 8px;color:${t.tableHeadText};text-align:center;">SGST%</th>
        <th style="padding:8px 8px;color:${t.tableHeadText};text-align:right;">SGST Amt</th>
        <th style="padding:8px 10px;color:${t.tableHeadText};text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** Totals box (right-aligned by default) */
function totalsBox(invoice: Invoice, t: TemplateStyle, width = '280px', darkMode = false): string {
  const bg = darkMode ? t.tripBg : '#fff';
  const border = darkMode ? t.borderColor : t.borderColor;
  return `<div style="width:${width};margin-left:auto;border:1.5px solid ${border};border-radius:10px;overflow:hidden;">
    <div style="padding:9px 14px;border-bottom:1px solid ${border};display:flex;justify-content:space-between;font-size:12px;color:${t.metaText};background:${bg};">
      <span>Advance Received</span><span style="font-weight:700;">${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
    </div>
    <div style="padding:9px 14px;border-bottom:1px solid ${border};display:flex;justify-content:space-between;font-size:12px;color:${t.metaText};background:${bg};">
      <span>Total Expenses</span><span style="font-weight:700;">${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
    </div>
    <div style="padding:13px 14px;display:flex;justify-content:space-between;font-size:15px;font-weight:900;background:${t.grandRowBg};color:${t.grandRowText};">
      <span>BALANCE DUE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
    </div>
  </div>`;
}

/** Digital Khata payment banner — for Classic Geometric + others */
function paymentBanner(invoice: Invoice, t: TemplateStyle): string {
  const biz = invoice.businessSnapshot;
  if (!biz.upiId && !biz.bankName) return '';
  const qr = biz.upiId ? `<img src="${qrUrl(biz.upiId, Math.abs(invoice.balance), invoice.currency, 100)}" style="width:100px;height:100px;border-radius:6px;border:2px solid rgba(255,255,255,0.3);display:block;" />` : '';
  return `<div style="background:${t.primary};border-radius:10px;padding:18px 20px;margin-bottom:18px;display:flex;gap:20px;align-items:flex-start;">
    <div style="flex:1;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.55);font-weight:700;margin-bottom:10px;">💳 Payment Details</div>
      ${biz.upiId ? `<div style="font-size:12.5px;color:#fff;margin-bottom:5px;"><span style="color:rgba(255,255,255,0.6);">UPI ID: </span><strong style="color:${t.accent};">${biz.upiId}</strong></div>` : ''}
      ${biz.bankName ? `<div style="font-size:12px;color:rgba(255,255,255,0.85);margin-bottom:3px;">${biz.bankName}</div>` : ''}
      ${biz.accountNumber ? `<div style="font-size:11.5px;color:rgba(255,255,255,0.65);">A/C: ${biz.accountNumber}${biz.ifscCode ? ' · IFSC: ' + biz.ifscCode : ''}</div>` : ''}
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.15);font-size:14px;font-weight:800;color:${t.accent};">Balance: ${invoice.currency} ${fmt(Math.abs(invoice.balance))}</div>
    </div>
    ${qr ? `<div style="text-align:center;flex-shrink:0;">
      ${qr}
      <div style="font-size:9px;color:rgba(255,255,255,0.5);margin-top:5px;text-transform:uppercase;letter-spacing:0.8px;">Scan & Pay</div>
    </div>` : ''}
  </div>`;
}

/** Notes block */
function notesBlock(invoice: Invoice, t: TemplateStyle): string {
  if (!invoice.notes && !invoice.paymentTerms) return '';
  return `<div style="background:${t.notesBg};border-left:3px solid ${t.notesAccent};border-radius:0 8px 8px 0;padding:11px 14px;margin-bottom:14px;font-size:11.5px;color:${t.metaText};line-height:1.8;">
    ${invoice.notes ? `<strong style="color:${t.notesAccent};">Notes:</strong> ${invoice.notes}` : ''}
    ${invoice.notes && invoice.paymentTerms ? '<br>' : ''}
    ${invoice.paymentTerms ? `<strong style="color:${t.notesAccent};">Terms:</strong> ${invoice.paymentTerms}` : ''}
  </div>`;
}

/** Draft watermark */
function draftMark(): string {
  return `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:96px;font-weight:900;color:rgba(0,0,0,0.04);letter-spacing:12px;pointer-events:none;white-space:nowrap;z-index:0;">DRAFT</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── UNIFIED A5 RENDERER ───────────────────────────────────────────────────────
//
//  All templates share the same A5 portrait layout.
//  Template colors (primary, accent, tableHeadBg, etc.) still apply.
//
//  Layout order:
//    Header band (company LEFT │ INVOICE # RIGHT)
//    Bill From / Bill To (2-col, side by side)
//    Trip Details strip (From → To │ Vehicle │ Driver)
//    Expense Table (# │ Service/Expense Name │ Amount)
//    Balance Summary (right-aligned, attached below table)
//    Notes (if set)
//    Payment Terms (if set)
//    QR Payment Section (only if UPI ID is set)
//    Footer: thank-you LEFT │ Authorized Signature BOTTOM-RIGHT
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * A5 Portrait Invoice Renderer
 *
 * Single layout used by ALL templates. Template colors (primary, accent, etc.)
 * are applied throughout. Page size: A5 portrait (559 × 794 px).
 *
 * Layout order:
 *   Header band → Bill From/To → Trip Strip → Expense Table
 *   → Balance Summary (attached) → Notes → Payment Terms
 *   → QR Section (optional) → Footer + Signature
 */
function renderA5Invoice(
  invoice: Invoice,
  t: TemplateStyle,
  logo: string | null,
  sig: string | null,
): string {
  const biz = invoice.businessSnapshot;
  const cur = invoice.currency || 'INR';
  const isDark = t.layout === 'premium-dark';
  const headerBg = isDark ? t.headerBg : t.primary;
  const bodyBg   = isDark ? t.bodyBg   : '#ffffff';

  // ── Logo ──────────────────────────────────────────────────────────────────
  const logoHtml = logo
    ? `<img src="${logo}" style="height:40px;max-width:110px;object-fit:contain;display:block;margin-bottom:4px;border-radius:3px;" />`
    : '';

  // ── Signature ─────────────────────────────────────────────────────────────
  const sigHtml = sig
    ? `<img src="${sig}" style="height:28px;max-width:85px;object-fit:contain;display:block;margin:0 0 3px auto;" />`
    : `<div style="height:24px;"></div>`;

  // ── Expense rows ──────────────────────────────────────────────────────────
  const expenseRows = (invoice.expenses ?? []).length === 0
    ? `<tr style="background:${bodyBg};"><td colspan="3" style="padding:9px 12px;font-size:10px;color:${t.metaText};font-style:italic;text-align:center;">No expenses recorded.</td></tr>`
    : (invoice.expenses ?? []).map((item, i) => `
    <tr style="background:${i % 2 === 1 ? t.rowAlt : bodyBg};border-bottom:1px solid ${t.borderColor};">
      <td style="padding:7px 10px;font-size:10px;color:${t.metaText};text-align:center;width:26px;">${i + 1}</td>
      <td style="padding:7px 10px;font-size:11.5px;color:${t.bodyText};">${item.name}</td>
      <td style="padding:7px 10px;font-size:11.5px;font-weight:800;color:${t.amountColor};text-align:right;white-space:nowrap;">${cur}&nbsp;${fmt(item.amount)}</td>
    </tr>`).join('');

  // ── QR payment section (only when UPI ID exists) ──────────────────────────
  const qrSection = biz.upiId ? (() => {
    const upiLink = `upi://pay?pa=${encodeURIComponent(biz.upiId)}&pn=${encodeURIComponent((biz.ownerName || biz.companyName || 'Business').replace(/[&=?]/g, ''))}&am=${Math.abs(invoice.balance).toFixed(2)}&cu=${cur}`;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=88x88&bgcolor=ffffff&color=000000&qzone=1&data=${encodeURIComponent(upiLink)}`;
    return `
    <div style="border:1px solid ${t.borderColor};border-radius:8px;padding:10px 13px;margin-bottom:10px;display:flex;align-items:center;gap:13px;background:${isDark ? t.rowAlt : '#fafafa'};">
      <div style="flex-shrink:0;text-align:center;">
        <img src="${qrSrc}" style="width:84px;height:84px;border-radius:4px;display:block;background:#fff;" />
        <div style="font-size:7.5px;color:${t.labelColor};text-transform:uppercase;letter-spacing:0.8px;font-weight:700;margin-top:4px;">Scan &amp; Pay</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:7.5px;text-transform:uppercase;letter-spacing:1px;color:${t.labelColor};font-weight:800;margin-bottom:5px;">📱 UPI Payment</div>
        <div style="font-size:11px;color:${t.bodyText};margin-bottom:3px;"><strong>UPI ID:</strong> <span style="color:${t.amountColor};font-weight:700;">${biz.upiId}</span></div>
        ${biz.ownerName || biz.companyName ? `<div style="font-size:9.5px;color:${t.metaText};margin-bottom:2px;"><strong>Name:</strong> ${biz.ownerName || biz.companyName}</div>` : ''}
        ${biz.bankName ? `<div style="font-size:9.5px;color:${t.metaText};margin-bottom:2px;"><strong>Bank:</strong> ${biz.bankName}</div>` : ''}
        ${biz.accountNumber ? `<div style="font-size:9px;color:${t.metaText};"><strong>A/C:</strong> ${biz.accountNumber}${biz.ifscCode ? `&nbsp;&nbsp;<strong>IFSC:</strong> ${biz.ifscCode}` : ''}</div>` : ''}
      </div>
    </div>`;
  })() : '';

  // ── Draft watermark ────────────────────────────────────────────────────────
  const draftOverlay = invoice.status === 'draft'
    ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:60px;font-weight:900;color:rgba(${isDark ? '255,255,255' : '0,0,0'},0.04);letter-spacing:8px;pointer-events:none;white-space:nowrap;z-index:0;">DRAFT</div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=559,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{width:559px;font-family:${t.font};background:#d0d0d0;font-size:11px;line-height:1.4;}
  .page{width:559px;min-height:794px;position:relative;background:${bodyBg};margin:0 auto;}
  table{border-collapse:collapse;width:100%;}
  @page{size:A5 portrait;margin:0;}
  @media print{html,body{background:${isDark ? '#0a0a0a' : '#fff'};}.page{margin:0;}}
</style></head><body>
<div class="page">
  ${draftOverlay}

  <!-- ══ HEADER BAND ══ -->
  <div style="background:${headerBg};padding:13px 17px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div style="flex:1;padding-right:12px;">
      ${logoHtml}
      <div style="font-size:14px;font-weight:900;color:#fff;letter-spacing:-0.2px;line-height:1.2;">${biz.companyName || biz.ownerName || 'Company'}</div>
      <div style="font-size:8.5px;color:rgba(255,255,255,0.68);line-height:1.7;margin-top:2px;">
        ${[biz.address, biz.mobile ? `Tel: ${biz.mobile}` : '', biz.gstNumber ? `GSTIN: ${biz.gstNumber}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:22px;font-weight:900;color:rgba(255,255,255,0.9);letter-spacing:-1.5px;line-height:1;">INVOICE</div>
      <div style="font-size:12px;font-weight:800;color:${t.accent};margin-top:2px;">#${invoice.invoiceNumber}</div>
      <div style="font-size:8px;color:rgba(255,255,255,0.65);margin-top:4px;line-height:1.7;">
        Date:&nbsp;<strong style="color:#fff;">${invoice.date}</strong>${invoice.dueDate ? `<br>Due:&nbsp;<strong style="color:#fff;">${invoice.dueDate}</strong>` : ''}
      </div>
      <div style="margin-top:5px;">${statusBadge(invoice.status, 'rgba(255,255,255,0.18)', '#fff')}</div>
    </div>
  </div>

  <!-- ══ BODY ══ -->
  <div style="padding:12px 16px 14px;">

    <!-- ══ BILL FROM / BILL TO ══ -->
    <div style="display:flex;margin-bottom:10px;border:1px solid ${t.borderColor};border-radius:6px;overflow:hidden;">
      <div style="flex:1;padding:9px 12px;background:${isDark ? t.rowAlt : '#fff'};">
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:1.2px;color:${t.labelColor};font-weight:800;margin-bottom:3px;">Bill From</div>
        <div style="font-size:12px;font-weight:800;color:${isDark ? '#fff' : t.primary};">${biz.ownerName || biz.companyName || '—'}</div>
        <div style="font-size:9px;color:${t.metaText};line-height:1.6;margin-top:1px;">
          ${[biz.mobile, biz.gstNumber ? `GSTIN: ${biz.gstNumber}` : ''].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div style="width:1px;background:${t.borderColor};"></div>
      <div style="flex:1;padding:9px 12px;background:${t.rowAlt};">
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:1.2px;color:${isDark ? t.accent : t.labelColor};font-weight:800;margin-bottom:3px;">Bill To</div>
        <div style="font-size:12px;font-weight:800;color:${isDark ? '#fff' : t.primary};">${invoice.clientName}</div>
        <div style="font-size:9px;color:${t.metaText};line-height:1.6;margin-top:1px;">
          ${[invoice.clientPhone, invoice.clientAddress, invoice.clientGST ? `GSTIN: ${invoice.clientGST}` : ''].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>

    <!-- ══ TRIP DETAILS STRIP ══ -->
    <div style="background:${isDark ? t.rowAlt : t.tripBg};border-left:4px solid ${t.primary};border-radius:0 5px 5px 0;padding:7px 12px;margin-bottom:11px;display:flex;flex-wrap:wrap;gap:5px 14px;align-items:center;">
      <div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:0.7px;color:${t.metaText};font-weight:700;">From</div>
        <div style="font-size:11px;font-weight:900;color:${isDark ? t.accent : t.primary};">${invoice.fromLocation || '—'}</div>
      </div>
      <div style="font-size:14px;color:${t.accent};font-weight:900;margin:0 2px;">→</div>
      <div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:0.7px;color:${t.metaText};font-weight:700;">To</div>
        <div style="font-size:11px;font-weight:900;color:${isDark ? t.accent : t.primary};">${invoice.toLocation || '—'}</div>
      </div>
      <div style="width:1px;height:24px;background:${t.borderColor};margin:0 3px;"></div>
      <div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:0.7px;color:${t.metaText};font-weight:700;">Vehicle</div>
        <div style="font-size:10px;font-weight:700;color:${isDark ? '#E2E8F0' : t.bodyText};">${invoice.truckNumber || '—'}</div>
      </div>
      <div style="width:1px;height:24px;background:${t.borderColor};margin:0 3px;"></div>
      <div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:0.7px;color:${t.metaText};font-weight:700;">Driver</div>
        <div style="font-size:10px;font-weight:700;color:${isDark ? '#E2E8F0' : t.bodyText};">${invoice.driverName || '—'}</div>
      </div>
    </div>

    <!-- ══ EXPENSE TABLE: Service/Expense LEFT, Amount RIGHT, full-width ══ -->
    <table style="border:1px solid ${t.borderColor};border-radius:4px;overflow:hidden;margin-bottom:0;">
      <thead>
        <tr style="background:${t.tableHeadBg};">
          <th style="padding:8px 10px;font-size:8px;color:${t.tableHeadText};text-align:center;width:26px;text-transform:uppercase;letter-spacing:0.5px;">#</th>
          <th style="padding:8px 10px;font-size:8px;color:${t.tableHeadText};text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Service / Expense Name</th>
          <th style="padding:8px 10px;font-size:8px;color:${t.tableHeadText};text-align:right;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">Amount (${cur})</th>
        </tr>
      </thead>
      <tbody>${expenseRows}</tbody>
    </table>

    <!-- ══ BALANCE SUMMARY — attached immediately below table, no gap ══ -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:11px;">
      <div style="min-width:205px;border:1px solid ${t.borderColor};border-top:none;border-radius:0 0 6px 6px;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;padding:5px 11px;font-size:10px;color:${t.metaText};border-bottom:1px solid ${t.borderColor};background:${isDark ? t.rowAlt : '#fff'};">
          <span>Advance Received</span><span style="font-weight:700;">${cur} ${fmt(invoice.advanceAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 11px;font-size:10px;color:${t.metaText};border-bottom:1px solid ${t.borderColor};background:${isDark ? t.rowAlt : '#fff'};">
          <span>Total Expenses</span><span style="font-weight:700;">${cur} ${fmt(invoice.totalExpenses)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:9px 11px;font-size:13px;font-weight:900;background:${t.grandRowBg};color:${t.grandRowText};">
          <span>BALANCE DUE</span><span>${cur} ${fmt(Math.abs(invoice.balance))}</span>
        </div>
      </div>
    </div>

    <!-- ══ SETTLEMENT NOTE ══ -->
    <div style="font-size:8.5px;font-weight:700;color:${isDark ? t.accent : t.labelColor};text-align:right;margin-bottom:9px;">
      ${invoice.settlementStatus === 'receive' ? 'Driver to receive money.' : invoice.settlementStatus === 'return' ? 'Driver to return money.' : 'Fully settled.'}
    </div>

    <!-- ══ NOTES ══ -->
    ${invoice.notes ? `<div style="background:${isDark ? t.rowAlt : t.notesBg};border-left:3px solid ${t.notesAccent};border-radius:0 4px 4px 0;padding:7px 11px;margin-bottom:8px;font-size:10px;color:${t.metaText};line-height:1.6;"><strong style="color:${t.notesAccent};">Notes:</strong> ${invoice.notes}</div>` : ''}

    <!-- ══ PAYMENT TERMS ══ -->
    ${invoice.paymentTerms ? `<div style="font-size:9px;color:${t.metaText};line-height:1.6;margin-bottom:9px;"><strong style="color:${isDark ? '#E2E8F0' : t.bodyText};">Payment Terms:</strong> ${invoice.paymentTerms}</div>` : ''}

    <!-- ══ QR PAYMENT SECTION (only when UPI ID is provided) ══ -->
    ${qrSection}

    <!-- ══ FOOTER: thank-you note LEFT | Authorized Signature BOTTOM-RIGHT ══ -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid ${isDark ? t.accent + '44' : t.borderColor};padding-top:9px;margin-top:3px;">
      <div style="flex:1;padding-right:12px;">
        <div style="font-size:9px;color:${t.metaText};line-height:1.6;">${biz.footerNotes || 'Thank you for your business.'}</div>
        <div style="font-size:7px;color:${t.metaText};opacity:0.45;margin-top:5px;">Page 1 of 1 &nbsp;·&nbsp; Generated with FleetInvoice</div>
      </div>
      <div style="text-align:right;flex-shrink:0;min-width:105px;">
        ${sigHtml}
        <div style="width:95px;height:1px;background:${t.metaText};opacity:0.28;margin:0 0 3px auto;"></div>
        <div style="font-size:7px;text-transform:uppercase;letter-spacing:1px;color:${t.metaText};">Authorized Signature</div>
        <div style="font-size:9px;font-weight:700;color:${isDark ? '#9CA3AF' : t.primary};margin-top:1px;">${biz.ownerName || biz.companyName || ''}</div>
      </div>
    </div>

  </div><!-- /body -->
</div></body></html>`;
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────

export async function generateInvoiceHTML(
  invoice: Invoice,
  templateId: string,
  logoBase64: string | null = null,
  signatureBase64: string | null = null,
): Promise<string> {
  const t = INVOICE_TEMPLATES.find(t => t.id === templateId) ?? INVOICE_TEMPLATES[0];
  const logo = logoBase64 ? `data:image/jpeg;base64,${logoBase64}` : null;
  const sig  = signatureBase64 ? `data:image/jpeg;base64,${signatureBase64}` : null;
  // All templates now render the same A5 portrait layout (colors vary per template).
  return renderA5Invoice(invoice, t, logo, sig);
}

// ─── Additional exports required by pdfService and preview ────────────────────

/**
 * Get a TemplateStyle by ID.
 * Falls back to the first template if not found.
 */
export function getTemplateById(id: string): TemplateStyle {
  return INVOICE_TEMPLATES.find((t) => t.id === id) ?? INVOICE_TEMPLATES[0];
}

/**
 * Build the invoice HTML string — convenience alias for generateInvoiceHTML.
 * Used by pdfService.downloadForWeb and web-platform PDF generation.
 */
export async function buildInvoiceHTML(
  invoice: Invoice,
  templateId: string,
): Promise<string> {
  return generateInvoiceHTML(invoice, templateId);
}

/**
 * Generate a PDF file from an invoice using expo-print.
 * On web (expo-print not available) returns an HTML blob URI instead.
 *
 * Verifies the output is at least 1 KB and retries once on failure.
 */
/** A5 page size in PostScript points (72pt/inch). 148mm × 210mm. */
const A5_WIDTH_PT = 420;
const A5_HEIGHT_PT = 595;

/**
 * Reads the first few bytes of a local file and checks for the `%PDF-` magic
 * header that all valid PDF binaries start with. Guards against HTML content
 * or truncated/corrupted output being mistaken for a real PDF.
 */
export async function hasValidPdfHeader(uri: string): Promise<boolean> {
  try {
    const base64Head = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 16,
      position: 0,
    });
    if (!base64Head) return false;
    const binary = atob(base64Head);
    return binary.startsWith('%PDF-');
  } catch (err) {
    console.warn('[PDF][header] Failed to read header bytes:', err);
    return false;
  }
}

export async function generatePDFWithTemplate(
  invoice: Invoice,
  templateId: string,
): Promise<{ uri: string }> {
  // Web: expo-print not supported — return an HTML blob URI
  if (Platform.OS === 'web') {
    const html = await generateInvoiceHTML(invoice, templateId);
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([html], { type: 'text/html' });
      return { uri: URL.createObjectURL(blob) };
    }
    // Fallback data URI
    const encoded = encodeURIComponent(html);
    return { uri: `data:text/html;charset=utf-8,${encoded}` };
  }

  const html = await generateInvoiceHTML(invoice, templateId);

  async function tryPrint(): Promise<{ uri: string }> {
    // Explicit width/height (A5, in points) — printToFileAsync ignores the
    // HTML's `@page` CSS on some Android WebView builds and silently falls
    // back to US Letter, which corrupts the intended A5 layout/proportions.
    const result = await Print.printToFileAsync({
      html,
      base64: false,
      width: A5_WIDTH_PT,
      height: A5_HEIGHT_PT,
    });
    const info = await FileSystem.getInfoAsync(result.uri);
    const size = info.exists ? ((info as { exists: true; size?: number }).size ?? 0) : 0;
    if (size < 1024) {
      throw new Error(`PDF too small: ${size} bytes`);
    }
    const validHeader = await hasValidPdfHeader(result.uri);
    if (!validHeader) {
      throw new Error('Generated file is missing the %PDF- header — not a real PDF binary.');
    }
    return { uri: result.uri };
  }

  try {
    return await tryPrint();
  } catch (firstErr) {
    console.warn('[PDF][generate] First attempt failed, retrying once:', firstErr);
    // Retry once
    return await tryPrint();
  }
}

// Legacy export used by pdfService
export { generateInvoiceHTML as default };
