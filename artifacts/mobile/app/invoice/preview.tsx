/**
 * Invoice Preview Screen
 *
 * Renders an A4 paper simulation that is pixel-for-pixel identical to the
 * generated PDF (same sections, same template colors, same typography hierarchy).
 *
 * Layout:
 *   - Gray "PDF viewer" background
 *   - White paper card with drop-shadow
 *   - Header: Logo/Company left | INVOICE title/number right
 *   - Colored divider
 *   - Bill From / Bill To columns
 *   - Trip accent box
 *   - Expenses table
 *   - Settlement summary
 *   - Payment details
 *   - Notes & terms
 *   - Footer: thank-you note | signature area
 *
 * Save / PDF / Share logic is unchanged from previous version.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Alert, Platform, useWindowDimensions, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import Toast from '@/components/Toast';
import { loadPreviewData, clearPreviewData, clearDraft } from '@/services/draftService';
import {
  generateAndSaveInvoicePDF,
  sharePDF,
  savePDFToDownloads,
  downloadForWeb,
} from '@/services/pdfService';
import { getTemplateById, type TemplateStyle } from '@/services/invoiceTemplates';
import type { Invoice } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function localInvoicesKey(uid: string): string {
  return `@TruckInvoice:local_invoices_fallback:${uid}`;
}

interface PreviewPayload {
  invoice: Invoice;
  editId?: string;
}

async function saveLocalFallback(invoice: Invoice, uid: string, editId?: string): Promise<string> {
  const key = localInvoicesKey(uid);
  console.log('[Save][LocalFallback] Saving invoice to AsyncStorage, key:', key);
  try {
    const raw = await AsyncStorage.getItem(key);
    const existing: Invoice[] = raw ? JSON.parse(raw) : [];
    const now = new Date().toISOString();
    let savedId: string;
    let updated: Invoice[];

    if (editId) {
      savedId = editId;
      updated = existing.map((inv) =>
        inv.id === editId ? { ...inv, ...invoice, id: editId, updatedAt: now } : inv
      );
      if (!updated.find((i) => i.id === editId)) {
        updated.push({ ...invoice, id: editId, updatedAt: now });
      }
    } else {
      savedId = invoice.id || `local_${Date.now()}`;
      updated = [{ ...invoice, id: savedId, createdAt: now, updatedAt: now }, ...existing];
    }

    await AsyncStorage.setItem(key, JSON.stringify(updated));
    console.log('[Save][LocalFallback] ✓ Saved', updated.length, 'invoices locally. savedId:', savedId);
    return savedId;
  } catch (err) {
    console.error('[Save][LocalFallback] AsyncStorage write failed:', err);
    throw err;
  }
}

function fmtAmt(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Paper sub-components (each mirrors the corresponding PDF HTML section)
// ─────────────────────────────────────────────────────────────────────────────

function PaperLabel({ text, color }: { text: string; color: string }) {
  return (
    <Text style={[ps.sectionLabel, { color }]}>{text.toUpperCase()}</Text>
  );
}

function PaperDivider({ t }: { t: TemplateStyle }) {
  const color = t.dividerCss.startsWith('linear-gradient') ? t.tableHeadBg : t.dividerCss;
  return <View style={[ps.divider, { backgroundColor: color, height: t.dividerHeight }]} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    paid:     { bg: '#dcfce7', fg: '#15803d' },
    pending:  { bg: '#fef9c3', fg: '#854d0e' },
    draft:    { bg: '#f1f5f9', fg: '#475569' },
    archived: { bg: '#f3f4f6', fg: '#6b7280' },
  };
  const c = map[status] ?? map.draft;
  return (
    <View style={[ps.badge, { backgroundColor: c.bg }]}>
      <Text style={[ps.badgeText, { color: c.fg }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function TableRow({ name, amount, isAlt, t }: { name: string; amount: string; isAlt: boolean; t: TemplateStyle }) {
  return (
    <View style={[ps.tableRow, { backgroundColor: isAlt ? t.rowAlt : t.bodyBg, borderBottomColor: t.borderColor }]}>
      <Text style={[ps.tableCell, { color: t.bodyText, flex: 2 }]}>{name}</Text>
      <Text style={[ps.tableCell, ps.tableCellRight, { color: t.itemAmtColor }]}>{amount}</Text>
    </View>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={ps.summaryRow}>
      <Text style={[ps.summaryLabel, { color }]}>{label}</Text>
      <Text style={[ps.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main paper renderer — layout varies per template, mirrors the PDF HTML
// ─────────────────────────────────────────────────────────────────────────────

function PaperDocument({ invoice, currency, templateId }: {
  invoice: Invoice;
  currency: string;
  templateId: string;
}) {
  const t = getTemplateById(templateId);
  const biz = invoice.businessSnapshot;
  const { width: screenWidth } = useWindowDimensions();
  // 16px margin each side; min 280, max 520 for A4-like proportions
  const paperWidth = Math.min(Math.max(screenWidth - 32, 280), 520);
  const summaryBoxWidth = Math.min(Math.round(paperWidth * 0.52), 300);
  const layout = t.layout ?? 'classic-geometric';
  const isDark = layout === 'premium-dark';

  // Build UPI QR code URL
  const upiQrUrl = biz.upiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&bgcolor=ffffff&color=000000&qzone=1&data=${encodeURIComponent(
        `upi://pay?pa=${encodeURIComponent(biz.upiId)}&pn=${encodeURIComponent((biz.ownerName || biz.companyName || 'Business').replace(/[&=?]/g, ''))}&am=${Math.abs(invoice.balance).toFixed(2)}&cu=${invoice.currency || 'INR'}`
      )}`
    : null;

  const settlementLabel =
    invoice.settlementStatus === 'receive' ? 'Driver has to receive money.' :
    invoice.settlementStatus === 'return'  ? 'Driver has to return money.'  :
    'Fully settled — no balance due.';

  const hasPaymentDetails = !!(biz.upiId || biz.bankName);

  // ── Paper outer border / decoration based on layout ──
  const outerBorderStyle = (): object => {
    switch (layout) {
      case 'classic-geometric':
        return { borderWidth: 2, borderColor: t.primary };
      case 'gst-compliance':
        return { borderWidth: 2, borderColor: t.primary };
      case 'premium-dark':
        return { borderWidth: 2, borderColor: t.accent };
      default:
        return { borderWidth: 0 };
    }
  };

  return (
    <View style={[ps.paper, { width: paperWidth, backgroundColor: t.bodyBg }, outerBorderStyle()]}>

      {/* ── LEFT ACCENT BAR — transport-pro ── */}
      {layout === 'transport-pro' && (
        <View style={[ps.leftBar, { backgroundColor: t.accent }]} />
      )}

      {/* ── DRAFT WATERMARK ── */}
      {invoice.status === 'draft' && (
        <View style={ps.watermarkContainer} pointerEvents="none">
          <Text style={[ps.watermark, isDark && { color: 'rgba(255,255,255,0.04)' }]}>DRAFT</Text>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════
          LAYOUT-SPECIFIC HEADER
      ═══════════════════════════════════════════════════════════ */}

      {/* ── GST COMPLIANCE: "TAX INVOICE" banner ── */}
      {layout === 'gst-compliance' && (
        <View style={[ps.gstBanner, { backgroundColor: t.primary }]}>
          <Text style={ps.gstBannerText}>TAX INVOICE — GST COMPLIANT</Text>
        </View>
      )}

      {/* ── CORPORATE MODERN / WARM AMBER: top color bar ── */}
      {(layout === 'corporate-modern' || layout === 'warm-amber') && (
        <View style={[ps.topBar, { backgroundColor: t.primary }]} />
      )}

      {/* ── TRANSPORT PRO: full-width dark header ── */}
      {layout === 'transport-pro' ? (
        <View style={[ps.darkHeader, { backgroundColor: t.headerBg }]}>
          {biz.logoUri && (
            <Image source={{ uri: biz.logoUri }} style={ps.logoSmall} resizeMode="contain" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={ps.darkHeaderCompany} numberOfLines={1}>
              {biz.companyName || biz.ownerName || 'Company'}
            </Text>
            <Text style={ps.darkHeaderMeta} numberOfLines={1}>
              {biz.address || biz.mobile || ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[ps.darkHeaderInvLabel, { color: t.accent }]}>FREIGHT INVOICE</Text>
            <Text style={[ps.darkHeaderInvNum, { color: t.accent }]}>#{invoice.invoiceNumber}</Text>
          </View>
        </View>
      ) : layout === 'warm-amber' ? (
        /* ── WARM AMBER: gradient header ── */
        <View style={[ps.amberHeader, { backgroundColor: t.primary }]}>
          {biz.logoUri && (
            <Image source={{ uri: biz.logoUri }} style={ps.logoSmall} resizeMode="contain" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={ps.amberHeaderCompany} numberOfLines={1}>
              {biz.companyName || biz.ownerName || 'Company'}
            </Text>
            <Text style={ps.amberHeaderMeta} numberOfLines={1}>
              {biz.mobile || biz.address || ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={ps.amberHeaderInvoice}>INVOICE</Text>
            <Text style={ps.amberHeaderNum}>#{invoice.invoiceNumber}</Text>
            <Text style={ps.amberHeaderDate}>{invoice.date}</Text>
          </View>
        </View>
      ) : (
        /* ── DEFAULT HEADER (classic, corporate, gst, premium-dark) ── */
        <View style={[ps.headerRow, layout === 'corporate-modern' && ps.headerRowPadded]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            {biz.logoUri && (
              <Image source={{ uri: biz.logoUri }} style={ps.logo} resizeMode="contain" />
            )}
            <Text style={[ps.companyName, { color: isDark ? '#FFFFFF' : t.companyNameColor }]}>
              {biz.companyName || biz.ownerName || 'Company Name'}
            </Text>
            <Text style={[ps.companyMeta, { color: isDark ? '#9CA3AF' : t.metaTextColor }]}>
              {[biz.address, biz.mobile ? `Tel: ${biz.mobile}` : '', biz.gstNumber ? `GST: ${biz.gstNumber}` : '']
                .filter(Boolean).join('\n')}
            </Text>
          </View>
          {/* Right panel — colored for corporate-modern */}
          <View style={[
            { alignItems: 'flex-end' },
            layout === 'corporate-modern' && { backgroundColor: t.primary, padding: 10, borderRadius: 8, minWidth: 130 },
          ]}>
            <Text style={[
              ps.invoiceTitle,
              { color: layout === 'corporate-modern' ? '#fff' : t.invoiceTitleColor },
            ]}>INVOICE</Text>
            <Text style={[
              ps.invoiceNumber,
              { color: layout === 'corporate-modern' ? 'rgba(255,255,255,0.85)' : t.companyNameColor },
            ]}>
              #{invoice.invoiceNumber}
            </Text>
            <Text style={[
              ps.invoiceMeta,
              { color: layout === 'corporate-modern' ? 'rgba(255,255,255,0.7)' : t.metaTextColor },
            ]}>
              Date: {invoice.date}
              {invoice.dueDate ? `\nDue: ${invoice.dueDate}` : ''}
            </Text>
            <StatusBadge status={invoice.status} />
          </View>
        </View>
      )}

      {/* ── TRANSPORT PRO: orange route bar ── */}
      {layout === 'transport-pro' && (
        <View style={[ps.routeBar, { backgroundColor: t.accent }]}>
          <Text style={ps.routeCity} numberOfLines={1}>{invoice.fromLocation || 'Origin'}</Text>
          <Text style={ps.routeArrow}>→</Text>
          <Text style={ps.routeCity} numberOfLines={1}>{invoice.toLocation || 'Destination'}</Text>
        </View>
      )}

      {/* Inner content padding */}
      <View style={ps.innerPad}>

        {/* ── DIVIDER (not for dark/transport/warm-amber) ── */}
        {layout !== 'transport-pro' && layout !== 'warm-amber' && (
          <PaperDivider t={t} />
        )}

        {/* ── WARM AMBER: hero "Bill To" card ── */}
        {layout === 'warm-amber' ? (
          <>
            <View style={[ps.heroBillTo, { backgroundColor: t.rowAlt, borderTopColor: t.accent, borderColor: t.borderColor }]}>
              <PaperLabel text="Bill To" color={t.accent} />
              <Text style={[ps.billName, { color: t.bodyText, fontSize: 15, marginTop: 4 }]}>
                {invoice.clientName}
              </Text>
              <Text style={[ps.billMeta, { color: t.metaTextColor }]}>
                {[invoice.clientPhone, invoice.clientAddress, invoice.clientGST ? `GST: ${invoice.clientGST}` : ''].filter(Boolean).join('\n')}
              </Text>
            </View>
            <View style={[ps.billFromInline, { borderColor: t.borderColor }]}>
              <Text style={[ps.billFromLabel, { color: t.accent }]}>Bill From: </Text>
              <Text style={[ps.billFromValue, { color: t.bodyText }]}>
                {biz.ownerName || biz.companyName || '—'}
                {biz.mobile ? `  ·  ${biz.mobile}` : ''}
              </Text>
            </View>
          </>
        ) : (
          /* ── BILL FROM / BILL TO (all other layouts) ── */
          <View style={[ps.billRow, { borderColor: t.borderColor }]}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <PaperLabel text="Bill From" color={t.labelColor} />
              <Text style={[ps.billName, { color: isDark ? '#fff' : t.billNameColor }]}>
                {biz.ownerName || biz.companyName || '—'}
              </Text>
              <Text style={[ps.billMeta, { color: isDark ? '#9CA3AF' : t.metaTextColor }]}>
                {[
                  biz.companyName && biz.ownerName ? biz.companyName : '',
                  biz.address, biz.mobile,
                  biz.gstNumber ? `GST: ${biz.gstNumber}` : '',
                ].filter(Boolean).join('\n')}
              </Text>
            </View>
            <View style={[ps.billToSide, { borderLeftColor: t.borderColor, paddingLeft: 16 }]}>
              <PaperLabel text="Bill To" color={isDark ? t.accent : t.labelColor} />
              <Text style={[ps.billName, { color: isDark ? '#fff' : t.billNameColor }]}>{invoice.clientName}</Text>
              <Text style={[ps.billMeta, { color: isDark ? '#9CA3AF' : t.metaTextColor }]}>
                {[invoice.clientPhone, invoice.clientAddress, invoice.clientGST ? `GST: ${invoice.clientGST}` : ''].filter(Boolean).join('\n')}
              </Text>
            </View>
          </View>
        )}

        {/* ── TRIP BOX ── */}
        {layout !== 'transport-pro' && (
          <View style={[ps.tripBox, { backgroundColor: t.tripBg, borderLeftColor: t.tripBorder }]}>
            {[
              { label: 'From',      value: invoice.fromLocation },
              { label: 'To',        value: invoice.toLocation },
              { label: 'Truck No.', value: invoice.truckNumber || '—' },
              { label: 'Driver',    value: invoice.driverName || '—' },
              { label: 'Date',      value: invoice.date },
            ].map(({ label, value }) => (
              <View key={label} style={ps.tripItem}>
                <Text style={[ps.tripLabel, { color: isDark ? '#6B7280' : t.metaTextColor }]}>{label.toUpperCase()}</Text>
                <Text style={[ps.tripValue, { color: isDark ? t.accent : t.tripValColor }]}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── TRANSPORT PRO: driver/vehicle boxes ── */}
        {layout === 'transport-pro' && (
          <View style={ps.driverRow}>
            {[
              { label: '🚛 Vehicle', value: invoice.truckNumber || '—' },
              { label: '👤 Driver',  value: invoice.driverName || '—' },
              { label: '📅 Date',    value: invoice.date },
            ].map(({ label, value }) => (
              <View key={label} style={[ps.driverBox, { borderColor: t.borderColor, borderTopColor: t.tableHeadBg }]}>
                <Text style={[ps.tripLabel, { color: t.metaTextColor }]}>{label.toUpperCase()}</Text>
                <Text style={[ps.tripValue, { color: t.primary, fontSize: 11 }]}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── TRANSPORT PRO: single Bill To box ── */}
        {layout === 'transport-pro' && (
          <View style={[ps.transportBillTo, { backgroundColor: t.rowAlt, borderColor: t.borderColor, borderLeftColor: t.tableHeadBg }]}>
            <PaperLabel text="📋 Bill To" color={t.tableHeadBg} />
            <Text style={[ps.billName, { color: t.primary, fontSize: 14, marginTop: 4 }]}>{invoice.clientName}</Text>
            <Text style={[ps.billMeta, { color: t.metaTextColor }]}>
              {[invoice.clientPhone, invoice.clientAddress, invoice.clientGST ? `GST: ${invoice.clientGST}` : ''].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
        )}

        {/* ── EXPENSES TABLE ── */}
        <View style={[ps.tableContainer, { borderColor: t.borderColor }]}>
          <View style={[ps.tableHead, { backgroundColor: t.tableHeadBg }]}>
            <Text style={[ps.tableHeadCell, { color: t.tableHeadText, flex: 2 }]}>
              {layout === 'gst-compliance' ? 'DESCRIPTION' : 'EXPENSE NAME'}
            </Text>
            <Text style={[ps.tableHeadCell, ps.tableHeadRight, { color: t.tableHeadText }]}>
              AMOUNT ({currency})
            </Text>
          </View>
          {invoice.expenses.length === 0 ? (
            <View style={[ps.tableRow, { backgroundColor: t.bodyBg, borderBottomColor: t.borderColor }]}>
              <Text style={[ps.tableCell, { color: t.metaTextColor, fontStyle: 'italic' }]}>
                No expenses recorded
              </Text>
            </View>
          ) : (
            invoice.expenses.map((item, i) => (
              <TableRow
                key={item.id}
                name={item.name}
                amount={`${currency} ${fmtAmt(item.amount)}`}
                isAlt={i % 2 === 1}
                t={t}
              />
            ))
          )}
        </View>

        {/* ── SETTLEMENT SUMMARY ── */}
        <View style={ps.summaryContainer}>
          <View style={[ps.summaryBox, { borderColor: t.borderColor, width: summaryBoxWidth }]}>
            <SummaryRow
              label="Advance Received"
              value={`${currency} ${fmtAmt(invoice.advanceAmount)}`}
              color={isDark ? '#9CA3AF' : t.totalRowColor}
            />
            <View style={[ps.summaryRowDivider, { borderBottomColor: t.borderColor }]} />
            <SummaryRow
              label="Total Expenses"
              value={`${currency} ${fmtAmt(invoice.totalExpenses)}`}
              color={isDark ? '#9CA3AF' : t.totalRowColor}
            />
            <View style={[ps.summaryRowDivider, { borderBottomColor: t.borderColor }]} />
            <SummaryRow
              label="Remaining Balance"
              value={`${currency} ${fmtAmt(invoice.balance)}`}
              color={isDark ? '#9CA3AF' : t.totalRowColor}
            />
            {invoice.balance < 0 && (
              <>
                <View style={[ps.summaryRowDivider, { borderBottomColor: t.borderColor }]} />
                <SummaryRow
                  label="Loss Amount"
                  value={`${currency} ${fmtAmt(Math.abs(invoice.balance))}`}
                  color={isDark ? '#9CA3AF' : t.totalRowColor}
                />
              </>
            )}
            <View style={[ps.grandBalance, { backgroundColor: t.grandRowBg }]}>
              <Text style={[ps.grandLabel, { color: t.grandRowText }]}>BALANCE</Text>
              <Text style={[ps.grandValue, { color: t.grandRowText }]}>
                {currency} {fmtAmt(Math.abs(invoice.balance))}
              </Text>
            </View>
            <Text style={[ps.settlementNote, { color: isDark ? t.accent : t.labelColor }]}>
              {settlementLabel}
            </Text>
          </View>
        </View>

        {/* ── PAYMENT DETAILS + QR CODE ── */}
        {hasPaymentDetails && (
          <View style={[ps.paymentBanner, { backgroundColor: t.primary }]}>
            <View style={{ flex: 1 }}>
              <Text style={ps.paymentBannerTitle}>💳 PAYMENT DETAILS</Text>
              {biz.upiId ? (
                <View style={ps.paymentRow}>
                  <Text style={ps.paymentLabel}>UPI ID:</Text>
                  <Text style={[ps.paymentValue, { color: t.accent }]}>{biz.upiId}</Text>
                </View>
              ) : null}
              {biz.bankName ? (
                <View style={ps.paymentRow}>
                  <Text style={ps.paymentLabel}>Bank:</Text>
                  <Text style={ps.paymentValue}>{biz.bankName}</Text>
                </View>
              ) : null}
              {biz.accountNumber ? (
                <View style={ps.paymentRow}>
                  <Text style={ps.paymentLabel}>A/C:</Text>
                  <Text style={ps.paymentValue}>{biz.accountNumber}</Text>
                </View>
              ) : null}
              {biz.ifscCode ? (
                <View style={ps.paymentRow}>
                  <Text style={ps.paymentLabel}>IFSC:</Text>
                  <Text style={ps.paymentValue}>{biz.ifscCode}</Text>
                </View>
              ) : null}
              <View style={[ps.paymentBalanceRow, { borderTopColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={[ps.paymentBalanceLabel, { color: t.accent }]}>Balance:</Text>
                <Text style={[ps.paymentBalanceAmt, { color: t.accent }]}>
                  {currency} {fmtAmt(Math.abs(invoice.balance))}
                </Text>
              </View>
            </View>
            {upiQrUrl ? (
              <View style={ps.qrContainer}>
                <Image
                  source={{ uri: upiQrUrl }}
                  style={ps.qrImage}
                  resizeMode="contain"
                />
                <Text style={ps.qrLabel}>Scan &amp; Pay</Text>
                <Text style={ps.qrApps}>PhonePe · GPay · BHIM</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── NOTES & TERMS ── */}
        {invoice.notes ? (
          <View style={[ps.notesBox, { backgroundColor: isDark ? '#242438' : t.notesBg, borderLeftColor: t.notesAccent }]}>
            <Text style={[ps.notesText, { color: isDark ? '#9CA3AF' : t.metaTextColor }]}>
              <Text style={{ color: t.notesAccent, fontWeight: '700' }}>Notes: </Text>
              {invoice.notes}
            </Text>
          </View>
        ) : null}

        {invoice.paymentTerms ? (
          <Text style={[ps.termsText, { color: isDark ? '#9CA3AF' : t.metaTextColor }]}>
            <Text style={{ fontWeight: '700', color: isDark ? '#E2E8F0' : t.bodyText }}>Payment Terms: </Text>
            {invoice.paymentTerms}
          </Text>
        ) : null}

        {/* ── FOOTER ── */}
        <View style={[ps.footer, { borderTopColor: isDark ? t.accent : t.borderColor }]}>
          <View style={{ flex: 1, paddingRight: 20 }}>
            <Text style={[ps.footerNote, { color: isDark ? '#6B7280' : t.metaTextColor }]}>
              {biz.footerNotes || 'Thank you for your business.'}
            </Text>
          </View>
          <View style={ps.signatureArea}>
            {biz.signatureUri ? (
              <Image source={{ uri: biz.signatureUri }} style={ps.signatureImage} resizeMode="contain" />
            ) : (
              <View style={ps.signaturePlaceholder} />
            )}
            <View style={[ps.signatureLine, { backgroundColor: isDark ? t.accent : t.metaTextColor }]} />
            <Text style={[ps.signatureLabel, { color: isDark ? '#6B7280' : t.metaTextColor }]}>
              AUTHORIZED SIGNATURE
            </Text>
            <Text style={[ps.signatureName, { color: isDark ? '#9CA3AF' : t.billNameColor }]}>
              {biz.ownerName || biz.companyName || ''}
            </Text>
          </View>
        </View>

        <View style={ps.pageNumRow}>
          <Text style={[ps.pageNum, { color: isDark ? '#374151' : t.metaTextColor }]}>Page 1 of 1</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function InvoicePreviewScreen() {
  const router = useRouter();
  const { invoiceId: fallbackInvoiceId, templateId: fallbackTemplateId } = useLocalSearchParams<{ invoiceId?: string; templateId?: string }>();
  const insets = useSafeAreaInsets();
  const { createInvoice, updateInvoice, addLocalInvoice, getInvoiceById } = useInvoices();
  const { settings } = useSettings();
  const { user } = useAuth();

  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [sharingPDF, setSharingPDF] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 4000);
  }

  useEffect(() => {
    console.log('[Preview] Mounting — loading preview data from AsyncStorage...');
    loadPreviewData<PreviewPayload>().then((data) => {
      if (data) {
        console.log('[Preview] ✓ Loaded preview payload. invoiceNumber:', data.invoice?.invoiceNumber, '| editId:', data.editId);
        setPayload(data);
      } else {
        // Fallback: if navigated with invoiceId param, load invoice from context
        if (fallbackInvoiceId) {
          console.log('[Preview] No AsyncStorage data — trying context fallback for invoiceId:', fallbackInvoiceId);
          const inv = getInvoiceById(fallbackInvoiceId);
          if (inv) {
            console.log('[Preview] ✓ Loaded from context:', inv.invoiceNumber);
            setPayload({ invoice: inv, editId: inv.id });
          } else {
            console.warn('[Preview] Context fallback also failed for invoiceId:', fallbackInvoiceId);
          }
        } else {
          console.warn('[Preview] No preview data found in AsyncStorage.');
        }
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invoice = payload?.invoice;
  const editId = payload?.editId;

  const handleSave = useCallback(async () => {
    if (!invoice) {
      Alert.alert('Error', 'No invoice data found. Please go back and try again.');
      return;
    }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt: _ca, updatedAt: _ua, downloadCount: _dc, ...data } = invoice;

      console.log('[Save] handleSave called — invoice:', invoice?.invoiceNumber, '| editId:', editId);

      const uid = user?.uid;
      console.log('[Save] Current user uid:', uid ?? 'NOT AUTHENTICATED');

      let savedId: string | null = null;

      try {
        if (editId) {
          console.log('[Save] Updating existing invoice in Firestore, id:', editId);
          await updateInvoice(editId, data);
          savedId = editId;
          console.log('[Save] ✓ Firestore update succeeded for id:', savedId);
        } else {
          console.log('[Save] Creating new invoice in Firestore...');
          const saved = await createInvoice({ ...data, status: data.status || 'pending' });
          savedId = saved.id;
          console.log('[Save] ✓ Firestore create succeeded. New id:', savedId);
        }
      } catch (firestoreErr) {
        console.error('[Save] ✗ Firestore write FAILED:', firestoreErr);
        if (!uid) {
          showToast('Save failed: not signed in', 'error');
          setSaving(false);
          return;
        }
        try {
          savedId = await saveLocalFallback(invoice, uid, editId);
          console.log('[Save] ✓ AsyncStorage fallback succeeded. id:', savedId);
          // Immediately surface the invoice in the Invoices tab list
          const localInvoice: Invoice = { ...invoice, id: savedId };
          await addLocalInvoice(localInvoice);
          showToast('Saved locally (offline — will sync when online)', 'success');
        } catch (localErr) {
          console.error('[Save] ✗ AsyncStorage fallback also FAILED:', localErr);
          const msg = localErr instanceof Error ? localErr.message : String(localErr);
          showToast(`Save failed: ${msg}`, 'error');
          setSaving(false);
          return;
        }
      }

      await clearDraft();
      await clearPreviewData();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('✓ Invoice saved', undefined, [
        { text: 'Go to History', onPress: () => router.replace('/(tabs)/invoices' as never) },
        { text: 'View Invoice', onPress: () => router.replace({ pathname: '/invoice/[id]', params: { id: savedId } }) },
      ]);
    } catch (err) {
      console.error('[Preview] Save error:', err);
      Alert.alert('Save Failed', String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }, [invoice, editId, createInvoice, updateInvoice, addLocalInvoice, router, user?.uid]);

  const handleDownloadPDF = useCallback(async () => {
    if (!invoice) return;
    console.log('[PDF][Download] handleDownloadPDF called — platform:', Platform.OS);
    setDownloadingPDF(true);
    try {
      if (Platform.OS === 'web') {
        await downloadForWeb(invoice, invoice.templateId ?? 'classic');
        showToast('Invoice downloaded as HTML. Open in browser and print to save as PDF.');
        return;
      }
      const templateId = invoice.templateId ?? 'classic';
      const { uri, filename, publicUrl } = await generateAndSaveInvoicePDF(invoice, templateId, false, user?.uid);
      console.log('[PDF][Download] ✓ PDF ready. uri:', uri, '| filename:', filename, '| publicUrl:', publicUrl);
      await savePDFToDownloads(uri, filename);
      showToast('PDF saved to Downloads.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {

      console.error('[Preview] Download PDF error:', err);
      Alert.alert(
        'PDF Failed',
        String(err instanceof Error ? err.message : err),
        [{ text: 'OK' }]
      );

      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF][Download] ✗ Error:', err);
      showToast(`Download failed: ${msg}`, 'error');

    } finally {
      setDownloadingPDF(false);
    }
  }, [invoice, user?.uid]);

  const handleSharePDF = useCallback(async () => {
    if (!invoice) return;
    console.log('[PDF][Share] handleSharePDF called — platform:', Platform.OS);
    setSharingPDF(true);
    try {
      if (Platform.OS === 'web') {
        await downloadForWeb(invoice, invoice.templateId ?? 'classic');
        showToast('Invoice downloaded. Share the file manually.');
        return;
      }
      const templateId = invoice.templateId ?? 'classic';
      const { uri, filename, publicUrl } = await generateAndSaveInvoicePDF(invoice, templateId, false, user?.uid);
      const shareUri = publicUrl ?? uri;
      await sharePDF(shareUri, `Invoice — ${filename}`);
      console.log('[PDF][Share] ✓ Share dialog opened.');
    } catch (err) {

      console.error('[Preview] Share PDF error:', err);
      Alert.alert(
        'Share Failed',
        String(err instanceof Error ? err.message : err),
        [{ text: 'OK' }]
      );

      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF][Share] ✗ Error:', err);
      showToast(`Share failed: ${msg}`, 'error');

    } finally {
      setSharingPDF(false);
    }
  }, [invoice, user?.uid]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const isAnyLoading = saving || downloadingPDF || sharingPDF;

  // ── Loading ──
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#e8e8e8' }]}>
        <ActivityIndicator color="#1A3C6E" size="large" />
      </View>
    );
  }

  // ── No data ──
  if (!invoice) {
    return (
      <View style={[styles.center, { backgroundColor: '#e8e8e8' }]}>
        <Feather name="alert-circle" size={48} color="#888" />
        <Text style={styles.emptyText}>Preview data not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnAlt}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const currency = invoice.currency ?? settings.defaultCurrency;
  const templateId = invoice.templateId ?? 'classic';

  return (
    <View style={styles.root}>

      {/* ── App header bar ── */}
      <View style={[styles.headerBar, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#1a1a1a" />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            #{invoice.invoiceNumber}
          </Text>
          <Text style={styles.headerSub}>PDF Preview</Text>
        </View>
        <View style={styles.pdfBadge}>
          <Feather name="file-text" size={12} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.pdfBadgeText}>PDF</Text>
        </View>
      </View>

      {/* ── Gray PDF-viewer background ── */}
      <ScrollView
        style={styles.viewer}
        contentContainerStyle={[
          styles.viewerContent,
          { paddingBottom: insets.bottom + 140 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PaperDocument invoice={invoice} currency={currency} templateId={templateId} />
      </ScrollView>

      {/* ── Fixed bottom action bar ── */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom + 8 },
        ]}
      >
        <Pressable
          onPress={handleSave}
          disabled={isAnyLoading}
          accessibilityRole="button"
          accessibilityLabel={editId ? 'Update invoice' : 'Save invoice'}
          accessibilityState={{ disabled: isAnyLoading, busy: saving }}
          style={({ pressed }) => [
            styles.actionBtn, styles.saveBtn,
            { opacity: pressed || saving ? 0.8 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>{editId ? 'Update' : 'Save'}</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleDownloadPDF}
          disabled={isAnyLoading}
          accessibilityRole="button"
          accessibilityLabel="Download PDF"
          accessibilityState={{ disabled: isAnyLoading, busy: downloadingPDF }}
          style={({ pressed }) => [
            styles.actionBtn, styles.outlineBtn,
            { opacity: pressed || downloadingPDF ? 0.8 : 1 },
          ]}
        >
          {downloadingPDF ? (
            <ActivityIndicator color="#1A3C6E" size="small" />
          ) : (
            <>
              <Feather name="download" size={16} color="#1A3C6E" />
              <Text style={styles.outlineBtnText}>
                {Platform.OS === 'web' ? 'Download' : 'Download PDF'}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleSharePDF}
          disabled={isAnyLoading}
          accessibilityRole="button"
          accessibilityLabel="Share PDF"
          accessibilityState={{ disabled: isAnyLoading, busy: sharingPDF }}
          style={({ pressed }) => [
            styles.actionBtn, styles.shareBtn,
            { opacity: pressed || sharingPDF ? 0.8 : 1 },
          ]}
        >
          {sharingPDF ? (
            <ActivityIndicator color="#444" size="small" />
          ) : (
            <>
              <Feather name="share-2" size={16} color="#444" />
              <Text style={styles.shareBtnText}>Share PDF</Text>
            </>
          )}
        </Pressable>
      </View>

      <Toast visible={toastVisible} message={toastMsg} type={toastType} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — screen chrome
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#d0d0d0' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 16, color: '#555' },
  backBtnAlt: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1A3C6E' },

  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
    // iOS shadow
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  headerSub: { fontSize: 11, color: '#888', marginTop: 1 },
  pdfBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E53935', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
  },
  pdfBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  viewer: { flex: 1, backgroundColor: '#d0d0d0' },
  viewerContent: { alignItems: 'center', paddingVertical: 20 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e0e0e0',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 12,
  },
  saveBtn: { backgroundColor: '#1A3C6E' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  outlineBtn: { backgroundColor: '#EEF2FF', borderWidth: 1.5, borderColor: '#1A3C6E' },
  outlineBtnText: { color: '#1A3C6E', fontWeight: '700', fontSize: 13 },
  shareBtn: { backgroundColor: '#F5F5F5', borderWidth: 1.5, borderColor: '#ddd' },
  shareBtnText: { color: '#444', fontWeight: '700', fontSize: 13 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles — paper document internals
// ─────────────────────────────────────────────────────────────────────────────

const ps = StyleSheet.create({
  // ── Paper shell (no padding — headers go edge-to-edge)
  paper: {
    borderRadius: 3,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
  },

  // ── Inner content area (padded) ──
  innerPad: { padding: 18 },

  // ── Left accent bar (transport-pro) ──
  leftBar: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: 6, zIndex: 5,
  },

  // ── Draft watermark ──
  watermarkContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-45deg' }], zIndex: 0,
  },
  watermark: {
    fontSize: 68, fontWeight: '900', color: 'rgba(128,128,128,0.06)', letterSpacing: 12,
  },

  // ── GST Banner ──
  gstBanner: { paddingVertical: 11, paddingHorizontal: 18 },
  gstBannerText: {
    color: '#fff', fontWeight: '900', fontSize: 12,
    letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center',
  },

  // ── Top color bar (corporate-modern / warm-amber) ──
  topBar: { height: 7 },

  // ── Transport Pro: dark full-width header ──
  darkHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 18, paddingLeft: 24, paddingRight: 18,
  },
  logoSmall: { width: 72, height: 36, marginBottom: 0 },
  darkHeaderCompany: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  darkHeaderMeta: { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  darkHeaderInvLabel: { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  darkHeaderInvNum: { fontSize: 22, fontWeight: '900', letterSpacing: -1 },

  // ── Warm Amber gradient header ──
  amberHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 20, paddingHorizontal: 18, gap: 12,
  },
  amberHeaderCompany: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  amberHeaderMeta: { fontSize: 10, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  amberHeaderInvoice: { fontSize: 26, fontWeight: '900', color: 'rgba(255,255,255,0.92)', letterSpacing: -2 },
  amberHeaderNum: { fontSize: 13, fontWeight: '800', color: '#fff', marginTop: 2 },
  amberHeaderDate: { fontSize: 10, color: 'rgba(255,255,255,0.72)', marginTop: 2 },

  // ── Transport Pro: orange route bar ──
  routeBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, paddingHorizontal: 18, gap: 10,
  },
  routeCity: { flex: 1, fontSize: 15, fontWeight: '900', color: '#fff', textTransform: 'uppercase', textAlign: 'center' },
  routeArrow: { fontSize: 20, fontWeight: '900', color: 'rgba(255,255,255,0.8)', flexShrink: 0 },

  // ── Default header row ──
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerRowPadded: { marginBottom: 0 },
  logo: { width: 90, height: 44, marginBottom: 7 },
  companyName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  companyMeta: { fontSize: 10, lineHeight: 17, marginTop: 4 },
  invoiceTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -2, lineHeight: 32 },
  invoiceNumber: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  invoiceMeta: { fontSize: 10, lineHeight: 18, marginTop: 5, textAlign: 'right' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, marginTop: 5, alignSelf: 'flex-end' },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  // ── Divider ──
  divider: { borderRadius: 2, marginBottom: 18 },

  // ── Warm Amber: hero Bill To ──
  heroBillTo: {
    borderWidth: 1.5, borderTopWidth: 4, borderRadius: 8,
    padding: 14, marginBottom: 10,
  },
  billFromInline: {
    flexDirection: 'row', alignItems: 'center',
    padding: 9, borderWidth: 1, borderRadius: 6, marginBottom: 14,
    gap: 6,
  },
  billFromLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  billFromValue: { fontSize: 11, fontWeight: '600', flex: 1 },

  // ── Transport Pro: driver boxes row ──
  driverRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 14 },
  driverBox: {
    flex: 1, borderWidth: 1.5, borderTopWidth: 3, borderRadius: 8,
    padding: 10, backgroundColor: '#f8fafc',
  },

  // ── Transport Pro: Bill To box ──
  transportBillTo: {
    borderWidth: 1.5, borderLeftWidth: 5, borderRadius: 0, borderTopRightRadius: 8,
    borderBottomRightRadius: 8, padding: 13, marginBottom: 16, backgroundColor: '#f8fafc',
  },

  // ── Bill From/To (default) ──
  billRow: { flexDirection: 'row', marginBottom: 16 },
  billToSide: { flex: 1, borderLeftWidth: 1 },
  billName: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  billMeta: { fontSize: 10, lineHeight: 17, marginTop: 3 },

  // ── Section label ──
  sectionLabel: { fontSize: 8.5, fontWeight: '800', letterSpacing: 1.5, marginBottom: 5 },

  // ── Trip box ──
  tripBox: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderLeftWidth: 4, borderRadius: 4,
    padding: 11, marginBottom: 16,
  },
  tripItem: { minWidth: '33.3%', paddingRight: 8, marginBottom: 7 },
  tripLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  tripValue: { fontSize: 11, fontWeight: '700' },

  // ── Table ──
  tableContainer: { borderWidth: 1, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  tableHead: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 12 },
  tableHeadCell: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 },
  tableHeadRight: { textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1 },
  tableCell: { fontSize: 11.5, fontWeight: '500' },
  tableCellRight: { textAlign: 'right', fontWeight: '700', flex: 1 },

  // ── Settlement summary ──
  summaryContainer: { alignItems: 'flex-end', marginBottom: 16 },
  summaryBox: { width: '60%', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, paddingHorizontal: 12,
  },
  summaryRowDivider: { borderBottomWidth: 1, marginHorizontal: 12 },
  summaryLabel: { fontSize: 10.5 },
  summaryValue: { fontSize: 10.5, fontWeight: '600' },
  grandBalance: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 12, marginTop: 4, borderRadius: 6,
  },
  grandLabel: { fontSize: 12, fontWeight: '800' },
  grandValue: { fontSize: 12, fontWeight: '800' },
  settlementNote: { fontSize: 9.5, fontWeight: '700', textAlign: 'center', paddingVertical: 7 },

  // ── Payment Banner + QR ──
  paymentBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 10, padding: 14, marginBottom: 14, gap: 12,
  },
  paymentBannerTitle: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)', marginBottom: 10,
  },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  paymentLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', minWidth: 40 },
  paymentValue: { fontSize: 11, fontWeight: '700', color: '#fff', flex: 1 },
  paymentBalanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1,
  },
  paymentBalanceLabel: { fontSize: 11, fontWeight: '800' },
  paymentBalanceAmt: { fontSize: 15, fontWeight: '900' },

  // ── QR Code ──
  qrContainer: { alignItems: 'center', flexShrink: 0 },
  qrImage: {
    width: 90, height: 90,
    backgroundColor: '#fff', borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  qrLabel: { fontSize: 8.5, color: 'rgba(255,255,255,0.7)', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.8 },
  qrApps: { fontSize: 7.5, color: 'rgba(255,255,255,0.45)', marginTop: 3, textAlign: 'center' },

  // ── Notes ──
  notesBox: { borderLeftWidth: 3, borderRadius: 4, padding: 10, marginBottom: 12 },
  notesText: { fontSize: 11, lineHeight: 18 },
  termsText: { fontSize: 10, lineHeight: 17, marginBottom: 12 },

  // ── Footer ──
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderTopWidth: 2, paddingTop: 14, marginTop: 8,
  },
  footerNote: { fontSize: 10, lineHeight: 17 },
  signatureArea: { alignItems: 'center', minWidth: 130 },
  signatureImage: { width: 110, height: 40, marginBottom: 4 },
  signaturePlaceholder: { height: 40 },
  signatureLine: { width: 120, height: 1, marginBottom: 5 },
  signatureLabel: { fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.8 },
  signatureName: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  // ── Page number ──
  pageNumRow: { alignItems: 'flex-end', marginTop: 10 },
  pageNum: { fontSize: 10 },
});
