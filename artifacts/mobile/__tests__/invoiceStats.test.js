'use strict';

const assert = require('assert');

function amountToReceive(invoice) {
  return invoice.balance < 0 ? Math.abs(invoice.balance) : 0;
}

function amountToReturn(invoice) {
  return invoice.balance > 0 ? invoice.balance : 0;
}

function isSameMonth(isoA, isoB) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function summarize(invoices, now = new Date().toISOString()) {
  const active = invoices.filter((i) => !i.isArchived);
  const paid = active.filter((i) => i.status === 'paid');
  const nonPaid = active.filter((i) => i.status !== 'paid');
  const thisMonthPaid = paid.filter((i) => isSameMonth(i.createdAt, now));

  const stillDue = nonPaid.reduce((sum, inv) => sum + Math.abs(inv.balance || 0), 0);
  const settledThisMonth = thisMonthPaid.reduce((sum, inv) => sum + Math.abs(inv.balance || 0), 0);
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

console.log('Running InvoiceStats Tests...');

// 1. Positive balance (advance > expenses: driver returns money)
{
  const inv = { balance: 2500 };
  assert.strictEqual(amountToReturn(inv), 2500, 'Positive balance means driver has to return money');
  assert.strictEqual(amountToReceive(inv), 0, 'Positive balance means 0 to receive');
}

// 2. Negative balance (advance < expenses: driver receives money)
{
  const inv = { balance: -1800 };
  assert.strictEqual(amountToReceive(inv), 1800, 'Negative balance means driver has to receive money');
  assert.strictEqual(amountToReturn(inv), 0, 'Negative balance means 0 to return');
}

// 3. Zero balance (advance == expenses: fully settled)
{
  const inv = { balance: 0 };
  assert.strictEqual(amountToReceive(inv), 0);
  assert.strictEqual(amountToReturn(inv), 0);
}

// 4. Summarize: Still due, Settled this month, Archived excluded, Paid excluded
{
  const now = '2026-05-15T12:00:00.000Z';
  const pastMonth = '2026-04-10T12:00:00.000Z';

  const testInvoices = [
    // Non-paid, active (should be in stillDue)
    { id: '1', balance: -2000, status: 'pending', isArchived: false, createdAt: now },
    { id: '2', balance: 1500, status: 'draft', isArchived: false, createdAt: now },

    // Paid, active, this month (should be in settledThisMonth & totalRevenue, NOT in stillDue)
    { id: '3', balance: 3000, status: 'paid', isArchived: false, createdAt: now },

    // Paid, active, past month (should be in totalRevenue only, NOT settledThisMonth, NOT in stillDue)
    { id: '4', balance: 5000, status: 'paid', isArchived: false, createdAt: pastMonth },

    // Archived non-paid (MUST be excluded from stillDue and total)
    { id: '5', balance: -9999, status: 'pending', isArchived: true, createdAt: now },

    // Archived paid (MUST be excluded from revenue and total)
    { id: '6', balance: 8888, status: 'paid', isArchived: true, createdAt: now },
  ];

  const summary = summarize(testInvoices, now);

  // Active count: ids 1, 2, 3, 4 = 4
  assert.strictEqual(summary.total, 4, 'Total must count only non-archived invoices');

  // Still due: non-paid active: id 1 (|-2000|) + id 2 (|1500|) = 3500.
  // Paid (id 3, id 4) MUST be excluded. Archived (id 5) MUST be excluded.
  assert.strictEqual(summary.stillDue, 3500, 'Still due must sum non-paid non-archived balances');
  assert.strictEqual(summary.pending, 3500, 'pending matches stillDue');

  // Settled this month: paid active this month: id 3 (|3000|) = 3000.
  // Past month (id 4) excluded. Archived (id 6) excluded.
  assert.strictEqual(summary.settledThisMonth, 3000, 'Settled this month must count paid active in same month');
  assert.strictEqual(summary.thisMonth, 3000);

  // Total revenue: paid active: id 3 (3000) + id 4 (5000) = 8000.
  assert.strictEqual(summary.totalRevenue, 8000, 'Total revenue sums all paid active');
}

console.log('✓ All InvoiceStats tests PASSED!');
