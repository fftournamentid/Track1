/**
 * Pure utilities for invoice statistics and settlement calculations.
 */

import type { Invoice, SettlementStatus } from '@/types';
import { isSameMonth, formatCurrency } from './formatters';

export function computeSettlementStatus(balance: number): SettlementStatus {
  if (balance < 0) return 'receive';
  if (balance > 0) return 'return';
  return 'settled';
}

/**
 * Returns the amount the driver has to receive (when balance < 0).
 */
export function amountToReceive(invoice: { balance: number }): number {
  return invoice.balance < 0 ? Math.abs(invoice.balance) : 0;
}

/**
 * Returns the amount the driver has to return (when balance > 0).
 */
export function amountToReturn(invoice: { balance: number }): number {
  return invoice.balance > 0 ? invoice.balance : 0;
}

/**
 * Returns the card amount label based on settlement rule:
 * - "To receive ₹X" (balance < 0)
 * - "To return ₹X" (balance > 0)
 * - "Settled ₹0" (balance === 0)
 */
export function formatCardBalance(invoice: { balance: number; currency?: string }): string {
  if (invoice.balance < 0) {
    return `To receive ${formatCurrency(Math.abs(invoice.balance), invoice.currency)}`;
  }
  if (invoice.balance > 0) {
    return `To return ${formatCurrency(invoice.balance, invoice.currency)}`;
  }
  return `Settled ${formatCurrency(0, invoice.currency)}`;
}

export interface InvoiceSummary {
  total: number;
  totalRevenue: number;
  thisMonth: number;
  pending: number;
  stillDue: number;
  settledThisMonth: number;
}

/**
 * Summarizes invoice statistics:
 * - "Still due" = outstanding amounts on non-paid, non-archived invoices.
 * - "Settled this month" = settled amounts on paid invoices created this month.
 * - "Total" = count of active (non-archived) invoices.
 * - "Total Revenue" = settled amounts on all paid non-archived invoices.
 */
export function summarize(
  invoices: Invoice[],
  now: string | Date = new Date().toISOString()
): InvoiceSummary {
  const nowIso = typeof now === 'string' ? now : now.toISOString();

  // Active (non-archived) invoices
  const active = invoices.filter((i) => !i.isArchived);

  // Paid non-archived invoices
  const paid = active.filter((i) => i.status === 'paid');

  // Non-paid, non-archived invoices (pending, draft, etc.)
  const nonPaid = active.filter((i) => i.status !== 'paid');

  // Paid in current month
  const thisMonthPaid = paid.filter((i) => isSameMonth(i.createdAt, nowIso));

  // "Still due" = outstanding amounts on non-paid, non-archived invoices
  const stillDue = nonPaid.reduce((sum, inv) => sum + Math.abs(inv.balance || 0), 0);

  // "Settled this month" = settled amounts on paid invoices created this month
  const settledThisMonth = thisMonthPaid.reduce((sum, inv) => sum + Math.abs(inv.balance || 0), 0);

  // Total Revenue = all paid non-archived invoices
  const totalRevenue = paid.reduce((sum, inv) => sum + Math.abs(inv.balance || 0), 0);

  return {
    total: active.length,
    totalRevenue,
    thisMonth: settledThisMonth,
    pending: stillDue,
    stillDue,
    settledThisMonth,
  };
}
