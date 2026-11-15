import { PDFDocument } from "pdf-lib";
import { getDocumentProxy } from "unpdf";

type PdfProxy = Awaited<ReturnType<typeof getDocumentProxy>>;

/** Opens a PDF with pdf.js (serverless build) for text extraction. */
export async function openPdf(data: Uint8Array): Promise<PdfProxy> {
  // pdf.js may take ownership of the buffer, so give it a copy.
  return getDocumentProxy(new Uint8Array(data));
}

/** Text layer of one page, with line breaks preserved. */
export async function pageText(pdf: PdfProxy, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  try {
    const content = await page.getTextContent();
    let out = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      out += item.str;
      if (item.hasEOL) out += "\n";
    }
    return out;
  } finally {
    page.cleanup();
  }
}

/** Loads the PDF once with pdf-lib, for cutting small page ranges to send to Claude. */
export async function openForSlicing(data: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
}

/** A new PDF that contains only the given pages (1-based), as base64. */
export async function slicePages(source: PDFDocument, pages: number[]): Promise<string> {
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    source,
    pages.map((p) => p - 1),
  );
  for (const page of copied) out.addPage(page);
  const bytes = await out.save();
  return Buffer.from(bytes).toString("base64");
}
