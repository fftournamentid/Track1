import * as Print from 'expo-print';
import type { Invoice } from '@/types';

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-IN').format(amount);
}

function generateHTML(invoice: Invoice): string {
  const biz = invoice.businessSnapshot;
  const itemRows = invoice.lineItems
    .map(
      (item) => `
    <tr>
      <td class="desc">${item.description}</td>
      <td class="center">${item.quantity}</td>
      <td class="center">${invoice.currency} ${fmt(item.rate)}</td>
      <td class="right bold">${invoice.currency} ${fmt(item.amount)}</td>
    </tr>`
    )
    .join('');

  const watermark =
    invoice.status === 'draft'
      ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);
          font-size:90px;font-weight:900;color:rgba(26,60,110,0.06);letter-spacing:12px;pointer-events:none;">DRAFT</div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,sans-serif;color:#1a1a2e;background:#fff;}
.page{width:794px;min-height:1123px;padding:48px;position:relative;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;}
.company-name{font-size:26px;font-weight:800;color:#1A3C6E;}
.company-details{font-size:12px;color:#555;line-height:1.9;margin-top:8px;}
.invoice-badge{text-align:right;}
.invoice-title{font-size:40px;font-weight:900;color:#F57C00;letter-spacing:-2px;}
.inv-num{font-size:13px;color:#777;margin-top:4px;}
.inv-date{font-size:12px;color:#555;margin-top:8px;line-height:1.8;}
.divider{height:3px;background:linear-gradient(90deg,#1A3C6E,#F57C00);border-radius:2px;margin-bottom:32px;}
.bill-row{display:flex;gap:40px;margin-bottom:28px;}
.bill-col{flex:1;}
.label{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#F57C00;font-weight:700;margin-bottom:8px;}
.bill-name{font-size:15px;font-weight:700;color:#1A3C6E;}
.bill-details{font-size:12px;color:#555;line-height:1.9;margin-top:4px;}
.trip-box{background:#f6f8fd;border-left:4px solid #1A3C6E;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;display:flex;gap:32px;}
.trip-item-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;}
.trip-item-value{font-size:13px;font-weight:700;color:#1A3C6E;margin-top:4px;}
table{width:100%;border-collapse:collapse;margin-bottom:24px;}
.table-head{background:#1A3C6E;color:#fff;}
.table-head th{padding:11px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;text-align:left;}
.table-head th.right{text-align:right;}
.table-head th.center{text-align:center;}
tbody tr{border-bottom:1px solid #f0f0f0;}
tbody tr:nth-child(even){background:#fafbff;}
td{padding:11px 14px;font-size:13px;color:#333;}
td.center{text-align:center;}
td.right{text-align:right;}
td.bold{font-weight:600;}
td.desc{color:#1a1a2e;font-weight:500;}
.totals{display:flex;justify-content:flex-end;margin-bottom:28px;}
.totals-box{width:260px;}
.total-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #eee;font-size:13px;color:#555;}
.grand-row{background:#1A3C6E;color:#fff;padding:11px 14px;border-radius:8px;display:flex;justify-content:space-between;font-size:15px;font-weight:700;margin-top:8px;}
.pay-section{margin-bottom:24px;}
.pay-grid{display:flex;flex-wrap:wrap;gap:24px;margin-top:10px;}
.pay-item label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;}
.pay-item .val{font-size:13px;font-weight:600;color:#1A3C6E;margin-top:4px;}
.notes-box{background:#fffbf0;border-left:3px solid #F57C00;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;font-size:12px;color:#555;line-height:1.9;}
.footer{border-top:2px solid #f0f0f0;padding-top:24px;display:flex;justify-content:space-between;align-items:flex-end;}
.footer-notes{font-size:12px;color:#777;max-width:360px;line-height:1.9;}
.sig-block{text-align:center;}
.sig-line{width:160px;height:1px;background:#444;margin:48px auto 8px;}
.sig-label{font-size:11px;color:#777;text-transform:uppercase;letter-spacing:1px;}
.sig-name{font-size:12px;font-weight:600;color:#333;margin-top:4px;}
.page-num{position:absolute;bottom:24px;right:48px;font-size:11px;color:#bbb;}
.status-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-top:8px;}
.status-paid{background:#dcfce7;color:#15803d;}
.status-pending{background:#fef9c3;color:#854d0e;}
.status-draft{background:#f1f5f9;color:#475569;}
</style>
</head>
<body>
<div class="page">
  ${watermark}
  <div class="header">
    <div>
      <div class="company-name">${biz.companyName || 'Company Name'}</div>
      <div class="company-details">
        ${biz.address ? biz.address + '<br>' : ''}
        ${biz.mobile ? 'Tel: ' + biz.mobile : ''}
        ${biz.gstNumber ? '<br>GST: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div class="invoice-badge">
      <div class="invoice-title">INVOICE</div>
      <div class="inv-num"># ${invoice.invoiceNumber}</div>
      <div class="inv-date">
        Date: ${invoice.date}<br>
        ${invoice.dueDate ? 'Due: ' + invoice.dueDate : ''}
      </div>
      <div class="status-badge ${
        invoice.status === 'paid'
          ? 'status-paid'
          : invoice.status === 'pending'
          ? 'status-pending'
          : 'status-draft'
      }">${invoice.status}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="bill-row">
    <div class="bill-col">
      <div class="label">Bill From</div>
      <div class="bill-name">${biz.ownerName || biz.companyName}</div>
      <div class="bill-details">
        ${biz.address || ''}
        ${biz.mobile ? '<br>' + biz.mobile : ''}
        ${biz.gstNumber ? '<br>GST: ' + biz.gstNumber : ''}
      </div>
    </div>
    <div class="bill-col">
      <div class="label">Bill To</div>
      <div class="bill-name">${invoice.clientName}</div>
      <div class="bill-details">
        ${invoice.clientPhone || ''}
        ${invoice.clientAddress ? '<br>' + invoice.clientAddress : ''}
        ${invoice.clientGST ? '<br>GST: ' + invoice.clientGST : ''}
      </div>
    </div>
  </div>

  <div class="trip-box">
    <div class="trip-item">
      <div class="trip-item-label">From</div>
      <div class="trip-item-value">${invoice.fromLocation}</div>
    </div>
    <div class="trip-item">
      <div class="trip-item-label">To</div>
      <div class="trip-item-value">${invoice.toLocation}</div>
    </div>
    <div class="trip-item">
      <div class="trip-item-label">Truck No.</div>
      <div class="trip-item-value">${invoice.truckNumber}</div>
    </div>
    <div class="trip-item">
      <div class="trip-item-label">Driver</div>
      <div class="trip-item-value">${invoice.driverName}</div>
    </div>
  </div>

  <table>
    <thead class="table-head">
      <tr>
        <th>Description</th>
        <th class="center">Qty</th>
        <th class="center">Rate (${invoice.currency})</th>
        <th class="right">Amount (${invoice.currency})</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="total-row"><span>Subtotal</span><span>${invoice.currency} ${fmt(invoice.subtotal)}</span></div>
      ${
        invoice.gstRate > 0
          ? `<div class="total-row"><span>GST (${invoice.gstRate}%)</span><span>${invoice.currency} ${fmt(invoice.gstAmount)}</span></div>`
          : ''
      }
      <div class="grand-row"><span>Grand Total</span><span>${invoice.currency} ${fmt(invoice.grandTotal)}</span></div>
    </div>
  </div>

  ${
    biz.upiId || biz.bankName
      ? `<div class="pay-section">
      <div class="label">Payment Details</div>
      <div class="pay-grid">
        ${biz.upiId ? `<div class="pay-item"><label>UPI ID</label><div class="val">${biz.upiId}</div></div>` : ''}
        ${biz.bankName ? `<div class="pay-item"><label>Bank</label><div class="val">${biz.bankName}</div></div>` : ''}
        ${biz.accountNumber ? `<div class="pay-item"><label>Account No.</label><div class="val">${biz.accountNumber}</div></div>` : ''}
        ${biz.ifscCode ? `<div class="pay-item"><label>IFSC</label><div class="val">${biz.ifscCode}</div></div>` : ''}
      </div>
    </div>`
      : ''
  }

  ${
    invoice.notes
      ? `<div class="notes-box"><strong style="color:#F57C00;">Notes:</strong> ${invoice.notes}</div>`
      : ''
  }
  ${
    invoice.paymentTerms
      ? `<div style="margin-bottom:20px;font-size:12px;color:#777;"><strong>Payment Terms:</strong> ${invoice.paymentTerms}</div>`
      : ''
  }

  <div class="footer">
    <div class="footer-notes">${biz.footerNotes || 'Thank you for your business.'}</div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Authorized Signature</div>
      <div class="sig-name">${biz.ownerName}</div>
    </div>
  </div>

  <div class="page-num">Page 1 of 1</div>
</div>
</body>
</html>`;
}

export interface PDFResult {
  uri: string;
}

export async function generatePDF(invoice: Invoice): Promise<PDFResult> {
  const html = generateHTML(invoice);
  const result = await Print.printToFileAsync({
    html,
    base64: false,
  });
  return { uri: result.uri };
}

export async function printInvoice(invoice: Invoice): Promise<void> {
  const html = generateHTML(invoice);
  await Print.printAsync({ html });
}
