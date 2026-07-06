/**
 * Real PDF generation for the web platform.
 *
 * `expo-print` (used on iOS/Android) has no web implementation, which
 * previously caused the web platform to silently fall back to downloading
 * raw HTML with a `.pdf`/`.html` name — NOT a real PDF binary. This module
 * renders the invoice HTML off-screen, rasterizes it with html2canvas, and
 * embeds the result into a genuine PDF binary using jsPDF, so web behaves
 * the same as native: a real `%PDF-` file every time.
 */

/** A5 page size in CSS pixels — matches the HTML template's own layout width. */
const A5_WIDTH_PX = 559;
const A5_HEIGHT_PX = 794;

async function waitForImages(doc: Document, timeoutMs: number): Promise<void> {
  const imgs = Array.from(doc.images);
  if (imgs.length === 0) return;
  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
      )
    ),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Renders the given invoice HTML string into a real PDF Blob (application/pdf).
 * Throws on failure — callers should surface "Unable to generate PDF."
 */
export async function renderHtmlToPdfBlob(html: string): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('PDF rendering is only available in a browser environment.');
  }

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = `${A5_WIDTH_PX}px`;
  iframe.style.height = `${A5_HEIGHT_PX}px`;
  iframe.style.border = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) {
      throw new Error('Unable to prepare PDF render surface.');
    }
    doc.open();
    doc.write(html);
    doc.close();

    await waitForImages(doc, 5000);
    // Let layout/paint settle before rasterizing.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const target = (doc.querySelector('.page') as HTMLElement | null) ?? doc.body;
    if (!target) {
      throw new Error('Invoice content failed to render.');
    }

    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      width: A5_WIDTH_PX,
      windowWidth: A5_WIDTH_PX,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    const pdf = new jsPDF({ unit: 'pt', format: 'a5', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

    const blob = pdf.output('blob') as Blob;
    if (!blob || blob.size < 1024) {
      throw new Error('Generated PDF is empty or too small.');
    }
    return blob;
  } finally {
    document.body.removeChild(iframe);
  }
}

/** Reads the first bytes of a Blob and checks for the `%PDF-` magic header. */
export async function blobHasValidPdfHeader(blob: Blob): Promise<boolean> {
  try {
    const head = await blob.slice(0, 8).text();
    return head.startsWith('%PDF-');
  } catch {
    return false;
  }
}
