import * as Print from 'expo-print';
import type { Invoice } from '@/types';

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

function statusBadge(status: string) {
  const map: Record<string, string> = {
    paid: 'background:#dcfce7;color:#15803d;',
    pending: 'background:#fef9c3;color:#854d0e;',
    draft: 'background:#f1f5f9;color:#475569;',
    archived: 'background:#f3f4f6;color:#6b7280;',
  };
  return map[status] ?? map.draft;
}

async function buildHTML(invoice: Invoice): Promise<string> {
  const biz = invoice.businessSnapshot;

  const [logoDataUrl, sigDataUrl] = await Promise.all([
    biz.logoUri ? imageToDataUrl(biz.logoUri) : Promise.resolve(null),
    biz.signatureUri ? imageToDataUrl(biz.signatureUri) : Promise.resolve(null),
  ]);

  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="logo" style="height:72px;max-width:160px;object-fit:contain;border-radius:6px;" />`
    : '';

  const sigHtml = sigDataUrl
    ? `<img src="${sigDataUrl}" alt="signature" style="height:56px;max-width:160px;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : `<div style="height:48px;"></div>`;

  const watermark =
    invoice.status === 'draft'
      ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);
          font-size:100px;font-weight:900;color:rgba(26,60,110,0.05);letter-spacing:12px;pointer-events:none;z-index:0;">DRAFT</div>`
      : '';

  const itemRows = invoice.lineItems
    .map(
      (item, i) => `
    <tr style="${i % 2 === 1 ? 'background:#fafbff;' : ''}">
      <td class="td-desc">${item.description}</td>
      <td class="td-center">${item.quantity}</td>
      <td class="td-center">${invoice.currency} ${fmt(item.rate)}</td>
      <td class="td-right td-bold">${invoice.currency} ${fmt(item.amount)}</td>
    </tr>`
    )
    .join('');

  const paymentSection =
    biz.upiId || biz.bankName
      ? `<div class="pay-section">
          <div class="section-label">Payment Details</div>
          <div class="pay-grid">
            ${biz.upiId ? `<div class="pay-item"><div class="pay-lbl">UPI ID</div><div class="pay-val">${biz.upiId}</div></div>` : ''}
            ${biz.bankName ? `<div class="pay-item"><div class="pay-lbl">Bank</div><div class="pay-val">${biz.bankName}</div></div>` : ''}
            ${biz.accountNumber ? `<div class="pay-item"><div class="pay-lbl">Account No.</div><div class="pay-val">${biz.accountNumber}</div></div>` : ''}
            ${biz.ifscCode ? `<div class="pay-item"><div class="pay-lbl">IFSC</div><div class="pay-val">${biz.ifscCode}</div></div>` : ''}
          </div>
        </div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; background: #fff; font-size: 13px; }

  .page { width: 794px; min-height: 1123px; padding: 48px 52px; position: relative; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .company-block { flex: 1; }
  .company-logo { margin-bottom: 10px; }
  .company-name { font-size: 22px; font-weight: 800; color: #1A3C6E; letter-spacing: -0.5px; }
  .company-meta { font-size: 11.5px; color: #555; line-height: 1.85; margin-top: 6px; }
  .invoice-block { text-align: right; }
  .invoice-title { font-size: 42px; font-weight: 900; color: #F57C00; letter-spacing: -3px; line-height: 1; }
  .invoice-number { font-size: 14px; font-weight: 700; color: #1A3C6E; margin-top: 6px; }
  .invoice-dates { font-size: 11.5px; color: #555; margin-top: 8px; line-height: 1.9; }
  .status-badge {
    display: inline-block; padding: 4px 12px; border-radius: 20px;
    font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px;
  }

  /* Divider */
  .divider { height: 3px; background: linear-gradient(90deg, #1A3C6E 0%, #F57C00 100%); border-radius: 2px; margin-bottom: 28px; }

  /* Bill Row */
  .bill-row { display: flex; gap: 0; margin-bottom: 24px; }
  .bill-col { flex: 1; padding-right: 24px; }
  .bill-col:last-child { padding-right: 0; padding-left: 24px; border-left: 1px solid #eee; }
  .section-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.5px; color: #F57C00; font-weight: 800; margin-bottom: 8px; }
  .bill-name { font-size: 14px; font-weight: 700; color: #1A3C6E; }
  .bill-detail { font-size: 11.5px; color: #555; line-height: 1.85; margin-top: 4px; }

  /* Trip Box */
  .trip-box {
    background: #f4f7fd; border-left: 4px solid #1A3C6E;
    border-radius: 0 8px 8px 0; padding: 14px 20px;
    margin-bottom: 24px; display: flex; gap: 0; flex-wrap: wrap;
  }
  .trip-item { flex: 1; min-width: 120px; padding-right: 16px; }
  .trip-item:last-child { padding-right: 0; }
  .trip-lbl { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 4px; }
  .trip-val { font-size: 13px; font-weight: 700; color: #1A3C6E; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead { background: #1A3C6E; }
  thead th { padding: 11px 14px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.8px; color: #fff; text-align: left; }
  thead th.th-center { text-align: center; }
  thead th.th-right { text-align: right; }
  tbody tr { border-bottom: 1px solid #f0f2f5; }
  .td-desc { padding: 11px 14px; font-size: 13px; color: #1a1a2e; font-weight: 500; }
  .td-center { padding: 11px 14px; font-size: 13px; color: #444; text-align: center; }
  .td-right { padding: 11px 14px; font-size: 13px; color: #444; text-align: right; }
  .td-bold { font-weight: 700; color: #1A3C6E; }

  /* Totals */
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals-box { width: 280px; }
  .total-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #eee; color: #555; }
  .grand-row {
    background: #1A3C6E; color: #fff; padding: 12px 16px;
    border-radius: 8px; display: flex; justify-content: space-between;
    font-size: 15px; font-weight: 800; margin-top: 10px;
  }

  /* Payment */
  .pay-section { margin-bottom: 22px; }
  .pay-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 10px; }
  .pay-item {}
  .pay-lbl { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1px; color: #999; }
  .pay-val { font-size: 13px; font-weight: 600; color: #1A3C6E; margin-top: 3px; }

  /* Notes */
  .notes-box {
    background: #fffbf0; border-left: 3px solid #F57C00; border-radius: 0 6px 6px 0;
    padding: 11px 16px; margin-bottom: 20px; font-size: 12px; color: #555; line-height: 1.9;
  }
  .terms-box { margin-bottom: 20px; font-size: 11.5px; color: #777; line-height: 1.8; }

  /* Footer */
  .footer { border-top: 2px solid #eee; padding-top: 22px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-notes { font-size: 11.5px; color: #777; max-width: 340px; line-height: 1.9; }
  .sig-block { text-align: center; min-width: 180px; }
  .sig-line { width: 160px; height: 1px; background: #444; margin: 0 auto 8px; }
  .sig-lbl { font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: 1px; }
  .sig-name { font-size: 12px; font-weight: 600; color: #333; margin-top: 4px; }

  /* Page num */
  .page-num { position: fixed; bottom: 24px; right: 52px; font-size: 11px; color: #bbb; }

  @media print {
    .page { padding: 40px; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<div class="page">
  ${watermark}

  <!-- HEADER -->
  <div class="header">
    <div class="company-block">
      ${logoHtml ? `<div class="company-logo">${logoHtml}</div>` : ''}
      <div class="company-name">${biz.companyName || biz.ownerName || 'Company Name'}</div>
      <div class="company-meta">
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? 'Mobile: ' + biz.mobile : ''}
        ${biz.gstNumber ? '<br>GST: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div class="invoice-block">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-number"># ${invoice.invoiceNumber}</div>
      <div class="invoice-dates">
        Date: <strong>${invoice.date}</strong><br>
        ${invoice.dueDate ? 'Due: <strong>' + invoice.dueDate + '</strong>' : ''}
      </div>
      <div class="status-badge" style="${statusBadge(invoice.status)}">${invoice.status.toUpperCase()}</div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- BILL FROM / TO -->
  <div class="bill-row">
    <div class="bill-col">
      <div class="section-label">Bill From</div>
      <div class="bill-name">${biz.ownerName || biz.companyName || '—'}</div>
      <div class="bill-detail">
        ${biz.companyName && biz.ownerName ? biz.companyName + '<br>' : ''}
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? biz.mobile : ''}
        ${biz.gstNumber ? '<br>GST: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div class="bill-col">
      <div class="section-label">Bill To</div>
      <div class="bill-name">${invoice.clientName}</div>
      <div class="bill-detail">
        ${invoice.clientPhone ? invoice.clientPhone + '<br>' : ''}
        ${invoice.clientAddress ? invoice.clientAddress + '<br>' : ''}
        ${invoice.clientGST ? 'GST: ' + invoice.clientGST : ''}
      </div>
    </div>
  </div>

  <!-- TRIP DETAILS -->
  <div class="trip-box">
    <div class="trip-item">
      <div class="trip-lbl">From</div>
      <div class="trip-val">${invoice.fromLocation}</div>
    </div>
    <div class="trip-item">
      <div class="trip-lbl">To</div>
      <div class="trip-val">${invoice.toLocation}</div>
    </div>
    <div class="trip-item">
      <div class="trip-lbl">Truck No.</div>
      <div class="trip-val">${invoice.truckNumber || '—'}</div>
    </div>
    <div class="trip-item">
      <div class="trip-lbl">Driver</div>
      <div class="trip-val">${invoice.driverName || '—'}</div>
    </div>
    <div class="trip-item">
      <div class="trip-lbl">Date</div>
      <div class="trip-val">${invoice.date}</div>
    </div>
  </div>

  <!-- LINE ITEMS TABLE -->
  <table>
    <thead>
      <tr>
        <th style="width:44%">Description</th>
        <th class="th-center" style="width:12%">Qty</th>
        <th class="th-center" style="width:22%">Rate (${invoice.currency})</th>
        <th class="th-right" style="width:22%">Amount (${invoice.currency})</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- TOTALS -->
  <div class="totals-wrap">
    <div class="totals-box">
      <div class="total-row"><span>Subtotal</span><span>${invoice.currency} ${fmt(invoice.subtotal)}</span></div>
      ${invoice.gstRate > 0 ? `<div class="total-row"><span>GST (${invoice.gstRate}%)</span><span>${invoice.currency} ${fmt(invoice.gstAmount)}</span></div>` : ''}
      <div class="grand-row"><span>GRAND TOTAL</span><span>${invoice.currency} ${fmt(invoice.grandTotal)}</span></div>
    </div>
  </div>

  <!-- PAYMENT DETAILS -->
  ${paymentSection}

  <!-- NOTES -->
  ${invoice.notes ? `<div class="notes-box"><strong style="color:#F57C00;">Notes: </strong>${invoice.notes}</div>` : ''}
  ${invoice.paymentTerms ? `<div class="terms-box"><strong>Payment Terms:</strong> ${invoice.paymentTerms}</div>` : ''}

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-notes">${biz.footerNotes || 'Thank you for your business.'}</div>
    <div class="sig-block">
      ${sigHtml}
      <div class="sig-line"></div>
      <div class="sig-lbl">Authorized Signature</div>
      <div class="sig-name">${biz.ownerName || biz.companyName || ''}</div>
    </div>
  </div>

  <div class="page-num">Page 1</div>
</div>
</body>
</html>`;
}

export interface PDFResult {
  uri: string;
}

export async function generatePDF(invoice: Invoice): Promise<PDFResult> {
  const html = await buildHTML(invoice);
  const result = await Print.printToFileAsync({ html, base64: false });
  return { uri: result.uri };
}

export async function printInvoice(invoice: Invoice): Promise<void> {
  const html = await buildHTML(invoice);
  await Print.printAsync({ html });
}
