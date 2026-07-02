import * as Print from 'expo-print';
import type { Invoice } from '@/types';

export interface TemplateStyle {
  id: string;
  name: string;
  description: string;
  isPremium: boolean;
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
  try {
    if (!uri) return null;
    if (uri.startsWith('data:')) return uri;
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
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
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:${t.font}; color:${t.bodyText}; background:${t.bodyBg}; font-size:13px; }
  .page { width:794px; min-height:1123px; padding:48px 52px; position:relative; background:${t.bodyBg}; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  thead tr { background:${t.tableHeadBg}; }
  thead th { padding:11px 14px; font-size:10.5px; text-transform:uppercase; letter-spacing:0.8px; color:${t.tableHeadText}; text-align:left; }
  tbody tr { border-bottom:1px solid ${t.borderColor}; }
  @media print { .page { padding:40px; } @page { size:A4; margin:0; } }
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

  <div style="position:fixed;bottom:24px;right:52px;font-size:11px;color:${t.metaTextColor};">Page 1</div>
</div>
</body>
</html>`;
}

export async function buildInvoiceHTML(invoice: Invoice, templateId: string): Promise<string> {
  const t = getTemplateById(templateId);
  const biz = invoice.businessSnapshot;
  const [logo, sig] = await Promise.all([
    biz.logoUri ? imageToDataUrl(biz.logoUri) : Promise.resolve(null),
    biz.signatureUri ? imageToDataUrl(biz.signatureUri) : Promise.resolve(null),
  ]);
  return renderHTML(invoice, t, logo, sig);
}

export interface PDFResult {
  uri: string;
}

export async function generatePDFWithTemplate(invoice: Invoice, templateId: string): Promise<PDFResult> {
  const html = await buildInvoiceHTML(invoice, templateId);
  const result = await Print.printToFileAsync({ html, base64: false });
  return { uri: result.uri };
}
