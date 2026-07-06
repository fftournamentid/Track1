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
// ─── RENDERER A: Classic Geometric ────────────────────────────────────────────
//
//  Structure:
//  • Double border (primary outer, accent inner)
//  • SVG diamond corner ornaments
//  • Header: logo+company LEFT │ "INVOICE" huge RIGHT
//  • Chevron divider bar
//  • Bill From │ Bill To: 2-col with vertical divider line
//  • Route banner: full-width highlighted pill
//  • Items table
//  • Totals: RIGHT-aligned floating box
//  • Payment banner: dark, QR on RIGHT
//  • Footer: sig BOTTOM-LEFT │ notes/terms BOTTOM-RIGHT
// ═══════════════════════════════════════════════════════════════════════════════

function renderClassicGeometric(invoice: Invoice, t: TemplateStyle, logo: string | null, sig: string | null): string {
  const biz = invoice.businessSnapshot;
  const logoHtml = logo
    ? `<img src="${logo}" style="height:64px;max-width:150px;object-fit:contain;display:block;margin-bottom:10px;border-radius:6px;" />`
    : `<div style="width:52px;height:52px;border-radius:8px;background:${t.primary};display:flex;align-items:center;justify-content:center;margin-bottom:10px;">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="3" y="7" width="22" height="16" rx="2" stroke="white" stroke-width="2"/><path d="M3 12h22" stroke="white" stroke-width="1.5"/></svg>
       </div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=794,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{width:794px;font-family:${t.font};background:#e0e0e0;font-size:13px;}
  .page{width:794px;min-height:1123px;padding:54px 50px 44px;position:relative;background:${t.bodyBg};margin:0 auto;}
  @page{size:A4;margin:0;}
  @media print{html,body{background:#fff;}.page{margin:0;}}
</style></head><body>
<div class="page">
  ${doublePageBorder(t.primary, t.accent + '60')}
  ${geoCorners(t.primary, t.accent)}
  ${invoice.status === 'draft' ? draftMark() : ''}

  <!-- ══ HEADER ══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding:0 8px;">
    <!-- Left: logo + company -->
    <div style="flex:1;padding-right:24px;">
      ${logoHtml}
      <div style="font-size:23px;font-weight:900;color:${t.primary};letter-spacing:-0.5px;line-height:1.2;">${biz.companyName || biz.ownerName || 'Company Name'}</div>
      <div style="font-size:11px;color:${t.metaText};line-height:2;margin-top:5px;">
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? 'Tel: ' + biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: <strong>' + biz.gstNumber + '</strong>' : ''}
      </div>
    </div>
    <!-- Right: invoice title -->
    <div style="text-align:right;flex-shrink:0;min-width:200px;">
      <div style="font-size:50px;font-weight:900;color:${t.accent};letter-spacing:-4px;line-height:1;">INVOICE</div>
      <div style="font-size:15px;font-weight:800;color:${t.primary};margin-top:4px;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:${t.metaText};margin-top:8px;line-height:2.2;">
        <strong>Date:</strong> ${invoice.date}<br>
        ${invoice.dueDate ? '<strong>Due:</strong> ' + invoice.dueDate : ''}
      </div>
      <div style="margin-top:8px;">${statusBadge(invoice.status)}</div>
    </div>
  </div>

  <!-- ══ CHEVRON DIVIDER ══ -->
  ${chevronDivider(t.primary, 9)}

  <!-- ══ BILL FROM / BILL TO ══ -->
  <div style="display:flex;margin-bottom:18px;padding:0 8px;">
    <div style="flex:1;padding-right:20px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.labelColor};font-weight:800;margin-bottom:7px;">Bill From</div>
      <div style="font-size:14px;font-weight:800;color:${t.primary};">${biz.ownerName || biz.companyName || '—'}</div>
      <div style="font-size:11px;color:${t.metaText};line-height:2;margin-top:3px;">
        ${biz.companyName && biz.ownerName ? biz.companyName + '<br>' : ''}
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? biz.mobile : ''}
      </div>
    </div>
    <div style="width:1.5px;background:${t.borderColor};margin:0 4px;self-align:stretch;"></div>
    <div style="flex:1;padding-left:20px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.accent};font-weight:800;margin-bottom:7px;">Bill To</div>
      <div style="font-size:14px;font-weight:800;color:${t.primary};">${invoice.clientName}</div>
      <div style="font-size:11px;color:${t.metaText};line-height:2;margin-top:3px;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
      </div>
    </div>
  </div>

  <!-- ══ ROUTE BANNER ══ -->
  <div style="background:${t.tripBg};border:1px solid ${t.borderColor};border-left:5px solid ${t.primary};border-radius:0 10px 10px 0;padding:13px 18px;margin-bottom:20px;padding:0 8px;margin:0 8px 20px;">
    <div style="background:${t.tripBg};border:1px solid ${t.borderColor};border-left:5px solid ${t.primary};border-radius:0 10px 10px 0;padding:13px 18px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;">
      <div style="flex:1.3;min-width:110px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaText};font-weight:700;margin-bottom:3px;">🚚 From</div>
        <div style="font-size:14px;font-weight:900;color:${t.primary};">${invoice.fromLocation || '—'}</div>
      </div>
      <div style="font-size:24px;color:${t.accent};font-weight:900;flex-shrink:0;">→</div>
      <div style="flex:1.3;min-width:110px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaText};font-weight:700;margin-bottom:3px;">📍 To</div>
        <div style="font-size:14px;font-weight:900;color:${t.primary};">${invoice.toLocation || '—'}</div>
      </div>
      <div style="width:1px;height:36px;background:${t.borderColor};"></div>
      <div style="flex:1;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaText};font-weight:700;margin-bottom:3px;">🚛 Truck</div>
        <div style="font-size:13px;font-weight:800;color:${t.primary};">${invoice.truckNumber || '—'}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaText};font-weight:700;margin-bottom:3px;">👤 Driver</div>
        <div style="font-size:13px;font-weight:800;color:${t.primary};">${invoice.driverName || '—'}</div>
      </div>
    </div>
  </div>

  <!-- ══ ITEMS TABLE ══ -->
  <div style="padding:0 8px;">
    ${itemsTable(invoice, t)}

    <!-- ══ TOTALS (right-aligned) ══ -->
    <div style="margin-bottom:20px;">
      ${totalsBox(invoice, t, '300px')}
    </div>

    <!-- ══ PAYMENT BANNER (dark, QR right) ══ -->
    ${paymentBanner(invoice, t)}

    <!-- ══ NOTES ══ -->
    ${notesBlock(invoice, t)}

    <!-- ══ FOOTER: sig left, note right ══ -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid ${t.primary};padding-top:14px;margin-top:4px;">
      <div>
        ${sig ? `<img src="${sig}" style="height:40px;max-width:130px;object-fit:contain;display:block;margin-bottom:5px;" />` : '<div style="height:36px;"></div>'}
        <div style="width:140px;height:1px;background:${t.metaText};opacity:0.4;margin-bottom:5px;"></div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaText};">Authorized Signature</div>
        <div style="font-size:12px;font-weight:700;color:${t.primary};margin-top:2px;">${biz.ownerName || biz.companyName || ''}</div>
      </div>
      <div style="text-align:right;max-width:240px;">
        <div style="font-size:11.5px;color:${t.metaText};line-height:1.8;">${biz.footerNotes || 'Thank you for your business.'}</div>
        <div style="font-size:10px;color:${t.metaText};opacity:0.5;margin-top:8px;">Page 1 of 1</div>
      </div>
    </div>
  </div>
</div></body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER B: Corporate Modern ─────────────────────────────────────────────
//
//  Structure:
//  • Top 8px royal blue bar + bottom 4px blue bar (NO outer box border)
//  • Header: 2-panel split — LEFT white card (logo+company), RIGHT blue bg (INVOICE)
//  • Billing: 2 equal rounded cards, left-border on "Bill To"
//  • Route: 5-col labeled info strip (minimal, no background)
//  • Table: no vertical borders, thin horizontal dividers, clean
//  • Totals: inline right-side (no box)
//  • Footer: 3-col — notes LEFT │ QR CENTER │ signature RIGHT
//  • Signature: BOTTOM RIGHT
// ═══════════════════════════════════════════════════════════════════════════════

function renderCorporateModern(invoice: Invoice, t: TemplateStyle, logo: string | null, sig: string | null): string {
  const biz = invoice.businessSnapshot;
  const logoHtml = logo
    ? `<img src="${logo}" style="height:52px;max-width:120px;object-fit:contain;display:block;margin-bottom:8px;" />`
    : '';

  const qr = biz.upiId
    ? `<img src="${qrUrl(biz.upiId, Math.abs(invoice.balance), invoice.currency, 90)}" style="width:90px;height:90px;border-radius:6px;border:1.5px solid ${t.borderColor};display:block;margin:0 auto 6px;" />`
    : '';

  const rows = invoice.expenses?.map((item, i) => `
    <tr>
      <td style="padding:11px 14px;font-size:11px;color:${t.metaText};width:34px;text-align:center;border-bottom:1px solid ${t.borderColor};">${i + 1}</td>
      <td style="padding:11px 14px;font-size:13px;color:${t.bodyText};border-bottom:1px solid ${t.borderColor};">${item.name}</td>
      <td style="padding:11px 14px;font-size:13px;font-weight:800;color:${t.amountColor};text-align:right;white-space:nowrap;border-bottom:1px solid ${t.borderColor};">${invoice.currency}&nbsp;${fmt(item.amount)}</td>
    </tr>`).join('') ?? '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=794,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{width:794px;font-family:${t.font};background:#e0e0e0;font-size:13px;}
  .page{width:794px;min-height:1123px;position:relative;background:${t.bodyBg};margin:0 auto;}
  .body{padding:28px 44px 40px;}
  @page{size:A4;margin:0;}
  @media print{html,body{background:#fff;}.page{margin:0;}}
</style></head><body>
<div class="page">
  ${invoice.status === 'draft' ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:96px;font-weight:900;color:rgba(0,0,0,0.03);letter-spacing:12px;pointer-events:none;white-space:nowrap;z-index:0;">DRAFT</div>` : ''}

  <!-- ══ TOP BAR ══ -->
  <div style="height:8px;background:linear-gradient(90deg,${t.primary},${t.accent});"></div>

  <!-- ══ HEADER: 2-panel split ══ -->
  <div style="display:flex;gap:0;margin:0;">
    <!-- Left panel: white card -->
    <div style="flex:1;padding:24px 28px;border-right:1px solid ${t.borderColor};">
      ${logoHtml}
      <div style="font-size:22px;font-weight:900;color:${t.primary};letter-spacing:-0.4px;margin-bottom:6px;">${biz.companyName || biz.ownerName || 'Company'}</div>
      <div style="font-size:11px;color:${t.metaText};line-height:2;">
        ${biz.address ? biz.address + '<br>' : ''}${biz.mobile ? 'Tel: ' + biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: <strong style="color:${t.primary};">' + biz.gstNumber + '</strong>' : ''}
      </div>
    </div>
    <!-- Right panel: blue bg -->
    <div style="width:230px;flex-shrink:0;background:${t.primary};padding:24px 24px;text-align:right;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:36px;font-weight:900;color:#fff;letter-spacing:-2px;line-height:1;margin-bottom:8px;">INVOICE</div>
      <div style="font-size:16px;font-weight:800;color:rgba(255,255,255,0.9);margin-bottom:10px;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.7);line-height:2.2;">
        Date: <strong style="color:#fff;">${invoice.date}</strong><br>
        ${invoice.dueDate ? 'Due: <strong style="color:#fff;">' + invoice.dueDate + '</strong>' : ''}
      </div>
      <div style="margin-top:10px;">${statusBadge(invoice.status, 'rgba(255,255,255,0.2)', '#fff')}</div>
    </div>
  </div>

  <div class="body">
    <!-- ══ BILL FROM / BILL TO ══ -->
    <div style="display:flex;gap:14px;margin-bottom:18px;">
      <div style="flex:1;border:1.5px solid ${t.borderColor};border-radius:10px;padding:14px 16px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.metaText};font-weight:700;margin-bottom:7px;border-bottom:1px solid ${t.borderColor};padding-bottom:5px;">Bill From</div>
        <div style="font-size:14px;font-weight:800;color:${t.primary};margin-bottom:4px;">${biz.ownerName || biz.companyName || '—'}</div>
        <div style="font-size:11px;color:${t.metaText};line-height:2;">
          ${biz.mobile ? biz.mobile + '<br>' : ''}${biz.gstNumber ? 'GSTIN: ' + biz.gstNumber : ''}
        </div>
      </div>
      <div style="flex:1;border:1.5px solid ${t.accent};border-left:5px solid ${t.primary};border-radius:10px;padding:14px 16px;background:${t.rowAlt};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.primary};font-weight:700;margin-bottom:7px;border-bottom:1px solid ${t.borderColor};padding-bottom:5px;">Bill To</div>
        <div style="font-size:14px;font-weight:800;color:${t.primary};margin-bottom:4px;">${invoice.clientName}</div>
        <div style="font-size:11px;color:${t.metaText};line-height:2;">
          ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
          ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
          ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
        </div>
      </div>
    </div>

    <!-- ══ ROUTE INFO STRIP (minimal, 5-col, no background) ══ -->
    <div style="display:flex;gap:0;margin-bottom:20px;padding:10px 0;border-top:1px solid ${t.borderColor};border-bottom:1px solid ${t.borderColor};">
      ${[
        { icon: '🚚', label: 'From', val: invoice.fromLocation || '—' },
        { icon: '📍', label: 'To', val: invoice.toLocation || '—' },
        { icon: '🚛', label: 'Truck No.', val: invoice.truckNumber || '—' },
        { icon: '👤', label: 'Driver', val: invoice.driverName || '—' },
        { icon: '📅', label: 'Date', val: invoice.date },
      ].map((f, i) => `<div style="flex:1;${i > 0 ? 'border-left:1px solid ' + t.borderColor + ';' : ''}padding:0 14px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:${t.metaText};font-weight:600;margin-bottom:4px;">${f.icon} ${f.label}</div>
        <div style="font-size:12.5px;font-weight:800;color:${t.primary};">${f.val}</div>
      </div>`).join('')}
    </div>

    <!-- ══ ITEMS TABLE (no vertical borders) ══ -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:${t.primary};">
          <th style="padding:10px 14px;font-size:10px;color:${t.tableHeadText};text-align:center;width:34px;text-transform:uppercase;letter-spacing:0.5px;">#</th>
          <th style="padding:10px 14px;font-size:10px;color:${t.tableHeadText};text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Service Description</th>
          <th style="padding:10px 14px;font-size:10px;color:${t.tableHeadText};text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Amount (${invoice.currency})</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- ══ TOTALS (inline right, no border box) ══ -->
    <div style="margin-bottom:24px;display:flex;justify-content:flex-end;">
      <div style="width:290px;">
        <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:${t.metaText};border-bottom:1px dashed ${t.borderColor};">
          <span>Advance Received</span><span style="font-weight:700;">${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:${t.metaText};border-bottom:1px dashed ${t.borderColor};">
          <span>Total Expenses</span><span style="font-weight:700;">${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:13px 16px;font-size:15px;font-weight:900;background:${t.primary};color:#fff;border-radius:8px;margin-top:8px;">
          <span>BALANCE DUE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
        </div>
      </div>
    </div>

    ${notesBlock(invoice, t)}

    <!-- ══ FOOTER: 3-col (notes | QR center | signature right) ══ -->
    <div style="display:flex;gap:14px;align-items:flex-end;border-top:2px solid ${t.primary};padding-top:16px;">
      <!-- Notes left -->
      <div style="flex:1;font-size:11px;color:${t.metaText};line-height:1.8;">
        ${biz.footerNotes || 'Thank you for your business.'}
        ${biz.upiId ? `<div style="margin-top:6px;font-size:11px;"><strong style="color:${t.primary};">UPI:</strong> ${biz.upiId}</div>` : ''}
        ${biz.bankName ? `<div style="font-size:11px;color:${t.metaText};">Bank: ${biz.bankName}${biz.ifscCode ? ' · IFSC: ' + biz.ifscCode : ''}</div>` : ''}
      </div>
      <!-- QR center -->
      ${qr ? `<div style="flex-shrink:0;text-align:center;">
        ${qr}
        <div style="font-size:9px;color:${t.metaText};text-transform:uppercase;letter-spacing:0.8px;">Scan &amp; Pay</div>
      </div>` : '<div style="flex-shrink:0;width:90px;"></div>'}
      <!-- Signature right -->
      <div style="flex-shrink:0;text-align:right;min-width:150px;">
        ${sig ? `<img src="${sig}" style="height:38px;max-width:120px;object-fit:contain;display:block;margin:0 0 5px auto;" />` : '<div style="height:34px;"></div>'}
        <div style="width:130px;height:1px;background:${t.metaText};opacity:0.35;margin:0 0 5px auto;"></div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaText};">Authorized Signature</div>
        <div style="font-size:12px;font-weight:700;color:${t.primary};margin-top:2px;">${biz.ownerName || biz.companyName || ''}</div>
      </div>
    </div>
    <div style="text-align:right;font-size:10px;color:${t.metaText};opacity:0.45;margin-top:8px;">Page 1 of 1</div>
  </div>

  <!-- ══ BOTTOM BAR ══ -->
  <div style="height:4px;background:linear-gradient(90deg,${t.primary},${t.accent});"></div>
</div></body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER C: GST Compliance ───────────────────────────────────────────────
//
//  Structure:
//  • Double green border frame
//  • "TAX INVOICE" green banner centered at top
//  • Header: 2-cell table (company LEFT │ invoice details RIGHT)
//  • Supplier / Recipient: formal bordered 2-cell table
//  • Transport row: labeled inline
//  • 9-column GST items table (HSN, CGST, SGST, Total)
//  • Tax summary: LEFT box (CGST/SGST) │ RIGHT box (totals)
//  • Declaration text
//  • Footer: FULL-WIDTH green strip — QR LEFT │ "Thank You" CENTER │ sig RIGHT
// ═══════════════════════════════════════════════════════════════════════════════

function renderGSTCompliance(invoice: Invoice, t: TemplateStyle, logo: string | null, sig: string | null): string {
  const biz = invoice.businessSnapshot;
  const logoHtml = logo
    ? `<img src="${logo}" style="height:52px;max-width:110px;object-fit:contain;display:block;margin-bottom:6px;" />`
    : '';

  const taxable = invoice.totalExpenses;
  const cgst = taxable * 0.09;
  const sgst = taxable * 0.09;
  const totalGst = cgst + sgst;

  const qr = biz.upiId
    ? `<img src="${qrUrl(biz.upiId, Math.abs(invoice.balance), invoice.currency, 80)}" style="width:80px;height:80px;border-radius:4px;border:2px solid rgba(255,255,255,0.5);display:block;" />`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=794,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{width:794px;font-family:${t.font};background:#e0e0e0;font-size:12px;}
  .page{width:794px;min-height:1123px;padding:40px 40px 0;position:relative;background:#fff;margin:0 auto;}
  @page{size:A4;margin:0;}
  @media print{html,body{background:#fff;}.page{margin:0;}}
</style></head><body>
<div class="page">
  ${doublePageBorder(t.primary, t.accent + '50')}
  ${invoice.status === 'draft' ? draftMark() : ''}

  <!-- ══ TAX INVOICE BANNER ══ -->
  <div style="background:${t.primary};color:#fff;text-align:center;padding:11px 20px;letter-spacing:4px;font-size:14px;font-weight:900;text-transform:uppercase;border-radius:6px 6px 0 0;margin-bottom:0;">TAX INVOICE — GST COMPLIANT</div>

  <!-- ══ COMPANY / INVOICE DETAILS (2-cell table) ══ -->
  <div style="border:1.5px solid ${t.accent};border-top:none;border-radius:0 0 6px 6px;margin-bottom:14px;overflow:hidden;">
    <div style="display:flex;">
      <div style="flex:1;padding:16px 18px;border-right:1.5px solid ${t.accent};">
        ${logoHtml}
        <div style="font-size:19px;font-weight:900;color:${t.primary};margin-bottom:4px;">${biz.companyName || biz.ownerName || 'Company'}</div>
        <div style="font-size:11px;color:${t.metaText};line-height:1.9;">
          ${biz.address ? biz.address + '<br>' : ''}
          ${biz.mobile ? 'Tel: ' + biz.mobile + '<br>' : ''}
          ${biz.gstNumber ? '<strong style="color:' + t.primary + ';">GSTIN: ' + biz.gstNumber + '</strong>' : '<span style="color:#DC2626;font-weight:700;">⚠ GSTIN not set</span>'}
        </div>
      </div>
      <div style="width:220px;flex-shrink:0;padding:16px 18px;background:${t.rowAlt};">
        <table style="width:100%;font-size:11.5px;border-collapse:collapse;">
          <tr><td style="color:${t.metaText};padding:3px 0;">Invoice No:</td><td style="font-weight:900;color:${t.primary};text-align:right;">${invoice.invoiceNumber}</td></tr>
          <tr><td style="color:${t.metaText};padding:3px 0;">Date:</td><td style="font-weight:700;text-align:right;">${invoice.date}</td></tr>
          ${invoice.dueDate ? `<tr><td style="color:${t.metaText};padding:3px 0;">Due Date:</td><td style="font-weight:700;text-align:right;">${invoice.dueDate}</td></tr>` : ''}
          <tr><td style="color:${t.metaText};padding:3px 0;">Place of Supply:</td><td style="font-weight:700;text-align:right;">India</td></tr>
          <tr><td style="color:${t.metaText};padding:3px 0;">Reverse Charge:</td><td style="font-weight:700;text-align:right;">No</td></tr>
        </table>
        <div style="margin-top:10px;">${statusBadge(invoice.status)}</div>
      </div>
    </div>
  </div>

  <!-- ══ SUPPLIER / RECIPIENT ══ -->
  <div style="border:1.5px solid ${t.borderColor};border-radius:8px;overflow:hidden;margin-bottom:12px;">
    <div style="display:flex;">
      <div style="flex:1;padding:12px 16px;border-right:1.5px solid ${t.borderColor};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.accent};font-weight:800;margin-bottom:7px;border-bottom:1px solid ${t.borderColor};padding-bottom:4px;">Supplier (Bill From)</div>
        <div style="font-size:13px;font-weight:800;color:${t.primary};margin-bottom:3px;">${biz.ownerName || biz.companyName || '—'}</div>
        <div style="font-size:11px;color:${t.metaText};line-height:1.9;">
          ${biz.address ? biz.address + '<br>' : ''}${biz.mobile ? biz.mobile + '<br>' : ''}
          ${biz.gstNumber ? 'GSTIN: <strong>' + biz.gstNumber + '</strong>' : ''}
        </div>
      </div>
      <div style="flex:1;padding:12px 16px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.accent};font-weight:800;margin-bottom:7px;border-bottom:1px solid ${t.borderColor};padding-bottom:4px;">Recipient (Bill To)</div>
        <div style="font-size:13px;font-weight:800;color:${t.primary};margin-bottom:3px;">${invoice.clientName}</div>
        <div style="font-size:11px;color:${t.metaText};line-height:1.9;">
          ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
          ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
          ${invoice.clientGST ? 'GSTIN: <strong>' + invoice.clientGST + '</strong>' : 'GSTIN: Not Provided'}
        </div>
      </div>
    </div>
  </div>

  <!-- ══ TRANSPORT DETAILS ══ -->
  <div style="background:${t.rowAlt};border:1px solid ${t.borderColor};border-radius:6px;padding:9px 16px;margin-bottom:14px;font-size:11px;display:flex;flex-wrap:wrap;gap:6px 20px;">
    <span><strong style="color:${t.metaText};">From:</strong> <strong>${invoice.fromLocation || '—'}</strong></span>
    <span style="color:${t.accent};">→</span>
    <span><strong style="color:${t.metaText};">To:</strong> <strong>${invoice.toLocation || '—'}</strong></span>
    ${invoice.truckNumber ? `<span>· <strong style="color:${t.metaText};">Vehicle:</strong> <strong>${invoice.truckNumber}</strong></span>` : ''}
    ${invoice.driverName ? `<span>· <strong style="color:${t.metaText};">Driver:</strong> <strong>${invoice.driverName}</strong></span>` : ''}
  </div>

  <!-- ══ GST ITEMS TABLE ══ -->
  ${gstItemsTable(invoice, t)}

  <!-- ══ TAX SUMMARY + TOTALS ══ -->
  <div style="display:flex;gap:16px;margin-bottom:14px;align-items:flex-start;">
    <div style="flex:1;border:1.5px solid ${t.borderColor};border-radius:8px;overflow:hidden;">
      <div style="background:${t.rowAlt};padding:8px 12px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${t.primary};border-bottom:1px solid ${t.borderColor};">Tax Summary</div>
      <table style="width:100%;font-size:11.5px;border-collapse:collapse;">
        <tr style="border-bottom:1px solid ${t.borderColor};"><td style="padding:7px 12px;color:${t.metaText};">Taxable Amount</td><td style="padding:7px 12px;font-weight:700;text-align:right;">${invoice.currency} ${fmt(taxable)}</td></tr>
        <tr style="border-bottom:1px solid ${t.borderColor};"><td style="padding:7px 12px;color:${t.metaText};">CGST @ 9%</td><td style="padding:7px 12px;font-weight:700;text-align:right;">${invoice.currency} ${fmt(cgst)}</td></tr>
        <tr style="border-bottom:1px solid ${t.borderColor};"><td style="padding:7px 12px;color:${t.metaText};">SGST @ 9%</td><td style="padding:7px 12px;font-weight:700;text-align:right;">${invoice.currency} ${fmt(sgst)}</td></tr>
        <tr style="background:${t.rowAlt};"><td style="padding:8px 12px;font-weight:800;color:${t.primary};">Total GST (18%)</td><td style="padding:8px 12px;font-weight:900;text-align:right;color:${t.accent};">${invoice.currency} ${fmt(totalGst)}</td></tr>
      </table>
    </div>
    <div style="width:240px;flex-shrink:0;">
      ${totalsBox(invoice, t, '100%')}
    </div>
  </div>

  <!-- ══ DECLARATION ══ -->
  <div style="font-size:10px;color:${t.metaText};margin-bottom:14px;padding:9px 12px;background:${t.rowAlt};border-radius:6px;line-height:1.7;border-left:3px solid ${t.accent};">
    <strong>Declaration:</strong> We declare that this invoice shows the actual price of the services described and all particulars are true and correct to the best of our knowledge.
  </div>

  ${notesBlock(invoice, t)}

  <!-- ══ FULL-WIDTH GREEN FOOTER STRIP ══ -->
  <div style="background:${t.primary};padding:18px 24px;display:flex;align-items:center;gap:16px;margin:0 -40px;margin-top:8px;">
    <!-- QR left -->
    <div style="flex-shrink:0;text-align:center;">
      ${qr}
      ${biz.upiId ? `<div style="font-size:8.5px;color:rgba(255,255,255,0.6);margin-top:4px;text-transform:uppercase;letter-spacing:0.8px;">Scan &amp; Pay</div>` : ''}
    </div>
    <!-- Center: payment info + thank you -->
    <div style="flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:900;color:#fff;letter-spacing:1px;margin-bottom:4px;">THANK YOU FOR YOUR BUSINESS</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.7);line-height:1.9;">
        ${biz.upiId ? 'UPI: <strong style="color:rgba(255,255,255,0.9);">' + biz.upiId + '</strong> · ' : ''}
        ${biz.bankName ? biz.bankName : ''}
        ${biz.ifscCode ? ' · IFSC: ' + biz.ifscCode : ''}
      </div>
      <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:8px;">${biz.footerNotes || ''} — Page 1 of 1</div>
    </div>
    <!-- Signature right -->
    <div style="flex-shrink:0;text-align:center;min-width:130px;">
      ${sig ? `<img src="${sig}" style="height:36px;max-width:110px;object-fit:contain;display:block;margin:0 auto 5px;opacity:0.9;" />` : '<div style="height:30px;"></div>'}
      <div style="width:110px;height:1px;background:rgba(255,255,255,0.35);margin:0 auto 4px;"></div>
      <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.5);">Authorized Signature</div>
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.85);margin-top:2px;">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>
</div></body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER D: Indian Transport Pro ─────────────────────────────────────────
//
//  Structure:
//  • Left-side 6px orange accent border running full page height
//  • Header: full-width dark navy (edge-to-edge) — logo+company LEFT │ "FREIGHT INVOICE" RIGHT
//  • Route bar: FULL-WIDTH orange bar — "FROM → TO" prominently centered
//  • Driver row: 3 equal info boxes (TRUCK | DRIVER | DATE)
//  • Billing: single "BILL TO" box with navy 4px left-border
//  • Table: steel-blue header, clean rows
//  • Totals + Payment/QR: SIDE BY SIDE at bottom (payment+bank LEFT │ QR+balance RIGHT)
//  • Signature: CENTERED in dark footer strip
// ═══════════════════════════════════════════════════════════════════════════════

function renderTransportPro(invoice: Invoice, t: TemplateStyle, logo: string | null, sig: string | null): string {
  const biz = invoice.businessSnapshot;
  const logoHtml = logo
    ? `<img src="${logo}" style="height:52px;max-width:120px;object-fit:contain;display:block;margin-bottom:6px;filter:brightness(1.1);" />`
    : '';

  const qr = biz.upiId
    ? `<img src="${qrUrl(biz.upiId, Math.abs(invoice.balance), invoice.currency, 100)}" style="width:100px;height:100px;border-radius:6px;border:2px solid ${t.accent};display:block;margin:0 auto 6px;" />`
    : '';

  const rows = invoice.expenses?.map((item, i) => `
    <tr style="border-bottom:1px solid ${t.borderColor};background:${i % 2 === 1 ? t.rowAlt : '#fff'};">
      <td style="padding:10px 12px;font-size:11px;color:${t.metaText};width:34px;text-align:center;">${i + 1}</td>
      <td style="padding:10px 14px;font-size:13px;color:${t.bodyText};">${item.name}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:800;color:${t.amountColor};text-align:right;white-space:nowrap;">${invoice.currency}&nbsp;${fmt(item.amount)}</td>
    </tr>`).join('') ?? '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=794,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{width:794px;font-family:${t.font};background:#e0e0e0;font-size:13px;}
  .page{width:794px;min-height:1123px;position:relative;background:#fff;margin:0 auto;}
  .body{padding:20px 36px 0 42px;}
  @page{size:A4;margin:0;}
  @media print{html,body{background:#fff;}.page{margin:0;}}
</style></head><body>
<div class="page">
  <!-- ══ LEFT ORANGE ACCENT BAR ══ -->
  <div style="position:absolute;top:0;left:0;width:6px;height:100%;background:${t.accent};z-index:2;"></div>

  ${invoice.status === 'draft' ? draftMark() : ''}

  <!-- ══ FULL-WIDTH DARK NAVY HEADER ══ -->
  <div style="background:${t.headerBg};padding:22px 36px 22px 42px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      ${logoHtml}
      <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;margin-bottom:4px;">${biz.companyName || biz.ownerName || 'Company'}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.6);line-height:1.9;">
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? 'Tel: ' + biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.45);margin-bottom:4px;">Freight Invoice</div>
      <div style="font-size:38px;font-weight:900;color:${t.accent};letter-spacing:-2px;line-height:1;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.65);margin-top:6px;line-height:2;">
        Date: <strong style="color:#fff;">${invoice.date}</strong>
        ${invoice.dueDate ? '<br>Due: <strong style="color:#fff;">' + invoice.dueDate + '</strong>' : ''}
      </div>
      <div style="margin-top:8px;">${statusBadge(invoice.status, t.accent + '33', t.accent)}</div>
    </div>
  </div>

  <!-- ══ FULL-WIDTH ORANGE ROUTE BAR ══ -->
  <div style="background:${t.accent};padding:13px 42px;display:flex;align-items:center;justify-content:center;gap:16px;">
    <div style="text-align:right;flex:1;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.65);margin-bottom:2px;">Pickup</div>
      <div style="font-size:18px;font-weight:900;color:#fff;text-transform:uppercase;">${invoice.fromLocation || 'Origin'}</div>
    </div>
    <div style="flex-shrink:0;display:flex;gap:3px;align-items:center;">
      <div style="width:30px;height:2px;background:rgba(255,255,255,0.6);"></div>
      <div style="font-size:20px;color:#fff;font-weight:900;">→</div>
      <div style="width:30px;height:2px;background:rgba(255,255,255,0.6);"></div>
    </div>
    <div style="text-align:left;flex:1;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.65);margin-bottom:2px;">Delivery</div>
      <div style="font-size:18px;font-weight:900;color:#fff;text-transform:uppercase;">${invoice.toLocation || 'Destination'}</div>
    </div>
  </div>

  <div class="body">
    <!-- ══ DRIVER / VEHICLE ROW (3 boxes) ══ -->
    <div style="display:flex;gap:12px;margin:18px 0;">
      ${[
        { icon: '🚛', label: 'Vehicle No.', val: invoice.truckNumber || 'Not Specified' },
        { icon: '👤', label: 'Driver Name', val: invoice.driverName || 'Not Specified' },
        { icon: '📅', label: 'Invoice Date', val: invoice.date },
      ].map(f => `<div style="flex:1;background:#f8fafc;border:1.5px solid ${t.borderColor};border-top:3px solid ${t.tableHeadBg};border-radius:8px;padding:12px 14px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaText};font-weight:700;margin-bottom:5px;">${f.icon} ${f.label}</div>
        <div style="font-size:14px;font-weight:900;color:${t.primary};">${f.val}</div>
      </div>`).join('')}
    </div>

    <!-- ══ BILL TO (single box with left border) ══ -->
    <div style="background:${t.rowAlt};border:1.5px solid ${t.borderColor};border-left:5px solid ${t.tableHeadBg};border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.tableHeadBg};font-weight:800;margin-bottom:7px;">📋 Bill To</div>
      <div style="font-size:16px;font-weight:900;color:${t.primary};margin-bottom:4px;">${invoice.clientName}</div>
      <div style="font-size:11.5px;color:${t.metaText};line-height:1.9;">
        ${invoice.clientPhone ? invoice.clientPhone + ' · ' : ''}
        ${invoice.clientAddress ? invoice.clientAddress : ''}
        ${invoice.clientGST ? '<br>GSTIN: ' + invoice.clientGST : ''}
      </div>
    </div>

    <!-- ══ ITEMS TABLE ══ -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
      <thead>
        <tr style="background:${t.tableHeadBg};">
          <th style="padding:10px 12px;font-size:10px;color:${t.tableHeadText};text-align:center;width:34px;text-transform:uppercase;">#</th>
          <th style="padding:10px 14px;font-size:10px;color:${t.tableHeadText};text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Service / Description</th>
          <th style="padding:10px 14px;font-size:10px;color:${t.tableHeadText};text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Amount (${invoice.currency})</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${notesBlock(invoice, t)}

    <!-- ══ PAYMENT + TOTALS: side by side ══ -->
    <div style="display:flex;gap:16px;margin-bottom:0;align-items:flex-start;">
      <!-- Payment details left -->
      <div style="flex:1;border:1.5px solid ${t.borderColor};border-radius:10px;padding:16px 18px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.accent};font-weight:800;margin-bottom:10px;border-bottom:1px solid ${t.borderColor};padding-bottom:6px;">💳 Payment Details</div>
        ${biz.upiId ? `<div style="font-size:12.5px;margin-bottom:5px;color:${t.bodyText};"><strong style="color:${t.metaText};">UPI:</strong> <strong style="color:${t.accent};">${biz.upiId}</strong></div>` : ''}
        ${biz.bankName ? `<div style="font-size:12px;color:${t.bodyText};margin-bottom:3px;"><strong style="color:${t.metaText};">Bank:</strong> ${biz.bankName}</div>` : ''}
        ${biz.accountNumber ? `<div style="font-size:11.5px;color:${t.metaText};">A/C: ${biz.accountNumber}</div>` : ''}
        ${biz.ifscCode ? `<div style="font-size:11.5px;color:${t.metaText};">IFSC: ${biz.ifscCode}</div>` : ''}
      </div>
      <!-- QR + totals right -->
      <div style="width:220px;flex-shrink:0;">
        ${qr ? `<div style="text-align:center;margin-bottom:10px;">
          ${qr}
          <div style="font-size:9px;color:${t.metaText};text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;">Scan &amp; Pay</div>
        </div>` : ''}
        <div style="background:${t.primary};border-radius:8px;padding:12px 14px;text-align:center;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.6);margin-bottom:4px;">Balance Due</div>
          <div style="font-size:22px;font-weight:900;color:${t.accent};">${invoice.currency} ${fmt(Math.abs(invoice.balance))}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:4px;">Advance: ${invoice.currency} ${fmt(invoice.advanceAmount)}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ DARK FOOTER STRIP ══ -->
  <div style="background:${t.primary};padding:14px 42px;display:flex;justify-content:space-between;align-items:center;margin-top:20px;">
    <div style="font-size:11px;color:rgba(255,255,255,0.55);max-width:300px;line-height:1.7;">${biz.footerNotes || 'Thank you for your business.'}</div>
    <div style="text-align:center;flex-shrink:0;">
      ${sig ? `<img src="${sig}" style="height:30px;max-width:100px;object-fit:contain;display:block;margin:0 auto 4px;opacity:0.85;" />` : '<div style="height:26px;"></div>'}
      <div style="width:100px;height:1px;background:rgba(255,255,255,0.3);margin:0 auto 4px;"></div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);">Authorized Signature</div>
    </div>
    <div style="font-size:10px;color:rgba(255,255,255,0.35);">Page 1 of 1</div>
  </div>
</div></body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER E: Premium Dark ─────────────────────────────────────────────────
//
//  Structure:
//  • Dark charcoal background throughout
//  • Gold double border frame
//  • Gold SVG diamond corner ornaments
//  • Header: CENTERED company name + logo (centered alignment, NOT left)
//  • Meta: centered pill row (invoice # | date | due | status)
//  • Gold horizontal divider with center diamond "◆"
//  • Billing: 2 dark cards side-by-side with gold top-border (2px)
//  • Route: minimal dark bar with gold bullet separators
//  • Table: dark bg, gold column header band, gold amounts
//  • Totals: full-width dark gradient box
//  • QR: CENTERED on page, gold frame
//  • Signature: CENTERED below QR
// ═══════════════════════════════════════════════════════════════════════════════

function renderPremiumDark(invoice: Invoice, t: TemplateStyle, logo: string | null, sig: string | null): string {
  const biz = invoice.businessSnapshot;
  const gold = t.accent;
  const goldDim = '#D97706';

  const logoHtml = logo
    ? `<img src="${logo}" style="height:64px;max-width:140px;object-fit:contain;display:block;margin:0 auto 10px;border-radius:6px;" />`
    : '';

  const qr = biz.upiId
    ? `<img src="${qrUrl(biz.upiId, Math.abs(invoice.balance), invoice.currency, 110)}" style="width:110px;height:110px;border-radius:8px;border:3px solid ${gold};display:block;margin:0 auto;" />`
    : '';

  const rows = invoice.expenses?.map((item, i) => `
    <tr style="border-bottom:1px solid ${t.borderColor};">
      <td style="padding:11px 14px;font-size:12px;color:#6B7280;width:36px;">${i + 1}</td>
      <td style="padding:11px 14px;font-size:13px;color:#E2E8F0;font-weight:500;">${item.name}</td>
      <td style="padding:11px 14px;font-size:13px;font-weight:800;color:${gold};text-align:right;white-space:nowrap;">${invoice.currency}&nbsp;${fmt(item.amount)}</td>
    </tr>`).join('') ?? '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=794,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{width:794px;font-family:${t.font};background:#0a0a0a;font-size:13px;}
  .page{width:794px;min-height:1123px;padding:48px 52px;position:relative;background:${t.bodyBg};margin:0 auto;}
  @page{size:A4;margin:0;}
  @media print{html,body{background:#000;}.page{margin:0;}}
</style></head><body>
<div class="page">
  <!-- Gold double border -->
  <div style="position:absolute;top:8px;left:8px;right:8px;bottom:8px;border:2px solid ${goldDim};pointer-events:none;z-index:1;"></div>
  <div style="position:absolute;top:14px;left:14px;right:14px;bottom:14px;border:0.5px solid ${gold}33;pointer-events:none;z-index:1;"></div>
  ${goldCorners(gold)}
  ${invoice.status === 'draft' ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:96px;font-weight:900;color:rgba(255,255,255,0.03);letter-spacing:12px;pointer-events:none;white-space:nowrap;z-index:0;">DRAFT</div>` : ''}

  <!-- ══ CENTERED COMPANY HEADER ══ -->
  <div style="text-align:center;margin-bottom:20px;padding:0 40px;">
    ${logoHtml}
    <div style="font-size:28px;font-weight:900;color:#FFFFFF;letter-spacing:0.5px;line-height:1.2;margin-bottom:5px;">${biz.companyName || biz.ownerName || 'Company Name'}</div>
    <div style="font-size:11px;color:#6B7280;line-height:1.9;">
      ${biz.address ? biz.address + ' · ' : ''}${biz.mobile ? biz.mobile : ''}
      ${biz.gstNumber ? '<br>GSTIN: <span style="color:#9CA3AF;">' + biz.gstNumber + '</span>' : ''}
    </div>
  </div>

  <!-- ══ CENTERED META ROW ══ -->
  <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
    <span style="display:inline-flex;align-items:center;gap:6px;background:#2D2D44;border:1px solid ${gold}33;border-radius:20px;padding:5px 14px;font-size:12px;color:#fff;">
      <span style="color:${gold};font-size:9px;text-transform:uppercase;letter-spacing:1px;">Invoice</span>
      <strong>${invoice.invoiceNumber}</strong>
    </span>
    <span style="display:inline-flex;align-items:center;gap:6px;background:#2D2D44;border:1px solid ${gold}33;border-radius:20px;padding:5px 14px;font-size:12px;color:#9CA3AF;">
      Date: <span style="color:#E2E8F0;">${invoice.date}</span>
    </span>
    ${invoice.dueDate ? `<span style="display:inline-flex;align-items:center;gap:6px;background:#2D2D44;border:1px solid ${gold}33;border-radius:20px;padding:5px 14px;font-size:12px;color:#9CA3AF;">Due: <span style="color:#E2E8F0;">${invoice.dueDate}</span></span>` : ''}
    ${statusBadge(invoice.status, gold + '22', gold)}
  </div>

  <!-- ══ GOLD DIVIDER WITH DIAMOND ══ -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
    <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,${goldDim});"></div>
    <div style="color:${gold};font-size:16px;flex-shrink:0;">◆</div>
    <div style="flex:1;height:1px;background:linear-gradient(90deg,${goldDim},transparent);"></div>
  </div>

  <!-- ══ BILL FROM / TO: dark cards, gold top-border ══ -->
  <div style="display:flex;gap:14px;margin-bottom:18px;">
    <div style="flex:1;background:#242438;border:1px solid ${t.borderColor};border-top:2px solid ${gold};border-radius:8px;padding:14px 16px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${goldDim};font-weight:800;margin-bottom:7px;">Bill From</div>
      <div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:4px;">${biz.ownerName || biz.companyName || '—'}</div>
      <div style="font-size:11px;color:#6B7280;line-height:2;">
        ${biz.address ? biz.address + '<br>' : ''}${biz.mobile ? biz.mobile : ''}
      </div>
    </div>
    <div style="flex:1;background:#242438;border:1px solid ${t.borderColor};border-top:2px solid ${gold};border-radius:8px;padding:14px 16px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${gold};font-weight:800;margin-bottom:7px;">Bill To</div>
      <div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:4px;">${invoice.clientName}</div>
      <div style="font-size:11px;color:#6B7280;line-height:2;">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GSTIN: ' + invoice.clientGST : ''}
      </div>
    </div>
  </div>

  <!-- ══ ROUTE: minimal dark bar ══ -->
  <div style="background:#242438;border-radius:8px;padding:10px 16px;margin-bottom:18px;display:flex;flex-wrap:wrap;gap:8px 20px;font-size:12px;align-items:center;">
    <span style="color:#6B7280;">◆</span>
    <span style="color:${gold};font-weight:700;">${invoice.fromLocation || '—'}</span>
    <span style="color:#6B7280;">→</span>
    <span style="color:${gold};font-weight:700;">${invoice.toLocation || '—'}</span>
    ${invoice.truckNumber ? `<span style="color:#6B7280;">◆</span><span style="color:#9CA3AF;">Truck: <span style="color:#E2E8F0;">${invoice.truckNumber}</span></span>` : ''}
    ${invoice.driverName ? `<span style="color:#6B7280;">◆</span><span style="color:#9CA3AF;">Driver: <span style="color:#E2E8F0;">${invoice.driverName}</span></span>` : ''}
  </div>

  <!-- ══ ITEMS TABLE: dark theme, gold header ══ -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead>
      <tr style="background:${t.tableHeadBg};">
        <th style="padding:11px 14px;font-size:10px;color:${gold};text-align:center;width:34px;text-transform:uppercase;letter-spacing:0.5px;">#</th>
        <th style="padding:11px 14px;font-size:10px;color:${gold};text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Service Description</th>
        <th style="padding:11px 14px;font-size:10px;color:${gold};text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Amount (${invoice.currency})</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- ══ TOTALS: full-width dark gradient box ══ -->
  <div style="background:linear-gradient(90deg,#2D2D44,#1C1C2E);border:1px solid ${gold}44;border-radius:10px;padding:0;overflow:hidden;margin-bottom:22px;">
    <div style="display:flex;justify-content:space-between;padding:9px 18px;border-bottom:1px solid #374151;font-size:12px;color:#6B7280;">
      <span>Advance Received</span><span style="color:#9CA3AF;font-weight:700;">${invoice.currency} ${fmt(invoice.advanceAmount)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:9px 18px;border-bottom:1px solid #374151;font-size:12px;color:#6B7280;">
      <span>Total Expenses</span><span style="color:#9CA3AF;font-weight:700;">${invoice.currency} ${fmt(invoice.totalExpenses)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:14px 18px;font-size:18px;font-weight:900;color:#fff;">
      <span>BALANCE DUE</span><span style="color:${gold};text-shadow:0 0 20px ${gold}66;">${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
    </div>
  </div>

  ${invoice.notes || invoice.paymentTerms ? `<div style="background:#242438;border-left:3px solid ${gold};border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:18px;font-size:11.5px;color:#9CA3AF;line-height:1.8;">
    ${invoice.notes ? `<strong style="color:${gold};">Notes:</strong> ${invoice.notes}` : ''}
    ${invoice.paymentTerms ? `${invoice.notes ? '<br>' : ''}<strong style="color:${gold};">Terms:</strong> ${invoice.paymentTerms}` : ''}
  </div>` : ''}

  <!-- ══ QR: CENTERED with gold frame ══ -->
  ${qr ? `<div style="text-align:center;margin-bottom:18px;">
    <div style="display:inline-block;padding:14px;background:#242438;border:1.5px solid ${gold}66;border-radius:12px;">
      ${qr}
      <div style="font-size:10px;color:${gold};margin-top:8px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Scan &amp; Pay</div>
      ${biz.upiId ? `<div style="font-size:11px;color:#9CA3AF;margin-top:3px;">${biz.upiId}</div>` : ''}
    </div>
    ${biz.bankName ? `<div style="font-size:11px;color:#6B7280;margin-top:8px;">${biz.bankName}${biz.ifscCode ? ' · IFSC: ' + biz.ifscCode : ''}${biz.accountNumber ? ' · A/C: ' + biz.accountNumber : ''}</div>` : ''}
  </div>` : ''}

  <!-- ══ SIGNATURE: CENTERED ══ -->
  <div style="text-align:center;margin-bottom:12px;">
    ${sig ? `<img src="${sig}" style="height:42px;max-width:140px;object-fit:contain;display:block;margin:0 auto 6px;opacity:0.9;" />` : '<div style="height:36px;"></div>'}
    <div style="width:150px;height:1px;background:${gold}44;margin:0 auto 5px;"></div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#6B7280;">Authorized Signature</div>
    <div style="font-size:12px;font-weight:700;color:#9CA3AF;margin-top:3px;">${biz.ownerName || biz.companyName || ''}</div>
  </div>

  <!-- ══ FOOTER: gold divider + centered text ══ -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,${goldDim}66);"></div>
    <div style="color:${gold}66;font-size:12px;">◆</div>
    <div style="flex:1;height:1px;background:linear-gradient(90deg,${goldDim}66,transparent);"></div>
  </div>
  <div style="text-align:center;font-size:10.5px;color:#374151;line-height:1.7;">${biz.footerNotes || 'Thank you for your business.'}</div>
  <div style="text-align:center;font-size:9px;color:#374151;margin-top:5px;opacity:0.5;">Page 1 of 1</div>
</div></body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDERER F: Warm Amber ────────────────────────────────────────────────────
//
//  Structure:
//  • Full-width amber gradient wave header (logo LEFT | INVOICE RIGHT)
//  • SVG wave transition from amber to white
//  • Hero "BILL TO" card — full-width, prominent, below header
//  • Bill From: small labeled inline row
//  • Route: amber-tinted pill bar
//  • Table: thick amber header band, clean white rows
//  • Totals + Payment: amber-bordered split container (bank LEFT | QR RIGHT)
//  • Signature: BOTTOM RIGHT with amber underline
//  • Notes: BOTTOM LEFT
//  • Footer: thin amber horizontal line
// ═══════════════════════════════════════════════════════════════════════════════

function renderWarmAmber(invoice: Invoice, t: TemplateStyle, logo: string | null, sig: string | null): string {
  const biz = invoice.businessSnapshot;
  const logoHtml = logo
    ? `<img src="${logo}" style="height:56px;max-width:130px;object-fit:contain;display:block;margin-bottom:8px;opacity:0.95;" />`
    : '';

  const qr = biz.upiId
    ? `<img src="${qrUrl(biz.upiId, Math.abs(invoice.balance), invoice.currency, 100)}" style="width:100px;height:100px;border-radius:6px;border:2px solid ${t.accent};display:block;margin:0 auto 5px;" />`
    : '';

  const rows = invoice.expenses?.map((item, i) => `
    <tr style="border-bottom:1px solid ${t.borderColor};background:${i % 2 === 1 ? t.rowAlt : '#fff'};">
      <td style="padding:10px 12px;font-size:11px;color:${t.metaText};width:34px;text-align:center;">${i + 1}</td>
      <td style="padding:10px 14px;font-size:13px;color:${t.bodyText};">${item.name}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:800;color:${t.amountColor};text-align:right;white-space:nowrap;">${invoice.currency}&nbsp;${fmt(item.amount)}</td>
    </tr>`).join('') ?? '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=794,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{width:794px;font-family:${t.font};background:#e0e0e0;font-size:13px;}
  .page{width:794px;min-height:1123px;position:relative;background:#fff;margin:0 auto;}
  .body{padding:0 44px 36px;}
  @page{size:A4;margin:0;}
  @media print{html,body{background:#fff;}.page{margin:0;}}
</style></head><body>
<div class="page">
  ${invoice.status === 'draft' ? draftMark() : ''}

  <!-- ══ AMBER GRADIENT HEADER ══ -->
  <div style="background:linear-gradient(135deg,${t.primary},${t.accent});padding:28px 44px 36px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      ${logoHtml}
      <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.4px;line-height:1.2;margin-bottom:5px;">${biz.companyName || biz.ownerName || 'Company'}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.78);line-height:1.9;">
        ${biz.address ? biz.address + '<br>' : ''}${biz.mobile ? biz.mobile : ''}
        ${biz.gstNumber ? '<br>GSTIN: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:44px;font-weight:900;color:rgba(255,255,255,0.92);letter-spacing:-3px;line-height:1;margin-bottom:6px;">INVOICE</div>
      <div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:8px;"># ${invoice.invoiceNumber}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.75);line-height:2.1;">
        Date: <strong style="color:#fff;">${invoice.date}</strong><br>
        ${invoice.dueDate ? 'Due: <strong style="color:#fff;">' + invoice.dueDate + '</strong>' : ''}
      </div>
      <div style="margin-top:8px;">${statusBadge(invoice.status, 'rgba(255,255,255,0.22)', '#fff')}</div>
    </div>
  </div>

  <!-- SVG wave transition -->
  <svg viewBox="0 0 794 36" xmlns="http://www.w3.org/2000/svg" style="display:block;margin-top:-1px;width:794px;">
    <path d="M0,36 L0,14 Q200,36 397,18 Q594,0 794,22 L794,36 Z" fill="${t.accent}"/>
    <path d="M0,36 L0,20 Q180,38 397,24 Q614,10 794,28 L794,36 Z" fill="${t.primary}" opacity="0.4"/>
  </svg>

  <div class="body">
    <!-- ══ HERO BILL TO CARD ══ -->
    <div style="background:${t.rowAlt};border:2px solid ${t.borderColor};border-top:4px solid ${t.accent};border-radius:10px;padding:16px 20px;margin-bottom:16px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.accent};font-weight:800;margin-bottom:8px;">📋 Bill To</div>
      <div style="font-size:20px;font-weight:900;color:${t.bodyText};margin-bottom:5px;">${invoice.clientName}</div>
      <div style="font-size:11.5px;color:${t.metaText};line-height:1.9;">
        ${invoice.clientPhone ? invoice.clientPhone + ' · ' : ''}
        ${invoice.clientAddress ? invoice.clientAddress : ''}
        ${invoice.clientGST ? '<br>GSTIN: ' + invoice.clientGST : ''}
      </div>
    </div>

    <!-- ══ BILL FROM (inline, small) ══ -->
    <div style="display:flex;gap:16px;align-items:center;padding:8px 12px;background:#fff;border:1px solid ${t.borderColor};border-radius:8px;margin-bottom:16px;font-size:11.5px;color:${t.metaText};">
      <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.accent};font-weight:700;flex-shrink:0;">Bill From:</span>
      <strong style="color:${t.bodyText};">${biz.ownerName || biz.companyName || '—'}</strong>
      ${biz.mobile ? `<span>· ${biz.mobile}</span>` : ''}
      ${biz.gstNumber ? `<span>· GSTIN: ${biz.gstNumber}</span>` : ''}
    </div>

    <!-- ══ ROUTE PILL ══ -->
    <div style="background:${t.rowAlt};border:1.5px solid ${t.borderColor};border-left:5px solid ${t.accent};border-radius:0 8px 8px 0;padding:11px 16px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;font-size:12px;">
      <span>🚚 <strong style="color:${t.bodyText};">${invoice.fromLocation || '—'}</strong></span>
      <span style="color:${t.accent};font-size:16px;font-weight:900;">→</span>
      <span>📍 <strong style="color:${t.bodyText};">${invoice.toLocation || '—'}</strong></span>
      ${invoice.truckNumber ? `<span style="color:${t.metaText};">· 🚛 ${invoice.truckNumber}</span>` : ''}
      ${invoice.driverName ? `<span style="color:${t.metaText};">· 👤 ${invoice.driverName}</span>` : ''}
    </div>

    <!-- ══ ITEMS TABLE: amber header band ══ -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
      <thead>
        <tr style="background:${t.primary};">
          <th style="padding:11px 12px;font-size:10px;color:#fff;text-align:center;width:34px;text-transform:uppercase;letter-spacing:0.5px;">#</th>
          <th style="padding:11px 14px;font-size:10px;color:#fff;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Service Description</th>
          <th style="padding:11px 14px;font-size:10px;color:#fff;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Amount (${invoice.currency})</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${notesBlock(invoice, t)}

    <!-- ══ PAYMENT + TOTALS CONTAINER ══ -->
    <div style="border:2px solid ${t.borderColor};border-top:3px solid ${t.accent};border-radius:10px;overflow:hidden;margin-bottom:22px;">
      <div style="background:${t.rowAlt};padding:10px 16px;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${t.accent};font-weight:800;border-bottom:1px solid ${t.borderColor};">💳 Payment &amp; Summary</div>
      <div style="display:flex;gap:0;">
        <!-- Bank details left -->
        <div style="flex:1;padding:16px 18px;border-right:1px solid ${t.borderColor};">
          ${biz.upiId ? `<div style="font-size:12.5px;margin-bottom:6px;"><span style="color:${t.metaText};">UPI:</span> <strong style="color:${t.accent};">${biz.upiId}</strong></div>` : ''}
          ${biz.bankName ? `<div style="font-size:12px;color:${t.bodyText};margin-bottom:3px;"><span style="color:${t.metaText};">Bank:</span> ${biz.bankName}</div>` : ''}
          ${biz.accountNumber ? `<div style="font-size:11.5px;color:${t.metaText};">A/C: ${biz.accountNumber}</div>` : ''}
          ${biz.ifscCode ? `<div style="font-size:11.5px;color:${t.metaText};">IFSC: ${biz.ifscCode}</div>` : ''}
          <div style="margin-top:14px;padding-top:12px;border-top:1px dashed ${t.borderColor};">
            <div style="font-size:11px;color:${t.metaText};margin-bottom:3px;">Advance: <strong>${invoice.currency} ${fmt(invoice.advanceAmount)}</strong></div>
            <div style="font-size:11px;color:${t.metaText};">Total: <strong>${invoice.currency} ${fmt(invoice.totalExpenses)}</strong></div>
            <div style="margin-top:10px;padding:10px 14px;background:${t.primary};border-radius:8px;color:#fff;display:flex;justify-content:space-between;font-size:14px;font-weight:900;">
              <span>BALANCE</span><span>${invoice.currency} ${fmt(Math.abs(invoice.balance))}</span>
            </div>
          </div>
        </div>
        <!-- QR right -->
        <div style="width:160px;flex-shrink:0;padding:16px 16px;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;background:${t.rowAlt};">
          ${qr}
          <div style="font-size:9px;color:${t.metaText};text-transform:uppercase;letter-spacing:0.8px;margin-top:5px;">Scan &amp; Pay</div>
        </div>
      </div>
    </div>

    <!-- ══ FOOTER: notes left | sig right ══ -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-top:14px;border-top:2px solid ${t.accent};">
      <div style="flex:1;font-size:11.5px;color:${t.metaText};line-height:1.8;padding-right:20px;">
        ${biz.footerNotes || 'Thank you for your business.'}
      </div>
      <div style="flex-shrink:0;text-align:right;min-width:160px;">
        ${sig ? `<img src="${sig}" style="height:38px;max-width:130px;object-fit:contain;display:block;margin:0 0 5px auto;" />` : '<div style="height:34px;"></div>'}
        <div style="width:140px;height:1.5px;background:${t.accent};margin:0 0 5px auto;"></div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${t.metaText};">Authorized Signature</div>
        <div style="font-size:12px;font-weight:700;color:${t.primary};margin-top:2px;">${biz.ownerName || biz.companyName || ''}</div>
      </div>
    </div>
    <div style="text-align:right;font-size:10px;color:${t.metaText};opacity:0.45;margin-top:8px;">Page 1 of 1</div>
  </div>
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
  const sig = signatureBase64 ? `data:image/jpeg;base64,${signatureBase64}` : null;

  switch (t.layout) {
    case 'corporate-modern': return renderCorporateModern(invoice, t, logo, sig);
    case 'gst-compliance':   return renderGSTCompliance(invoice, t, logo, sig);
    case 'transport-pro':    return renderTransportPro(invoice, t, logo, sig);
    case 'premium-dark':     return renderPremiumDark(invoice, t, logo, sig);
    case 'warm-amber':       return renderWarmAmber(invoice, t, logo, sig);
    case 'classic-geometric':
    default:                 return renderClassicGeometric(invoice, t, logo, sig);
  }
}

// Legacy export used by pdfService
export { generateInvoiceHTML as default };
