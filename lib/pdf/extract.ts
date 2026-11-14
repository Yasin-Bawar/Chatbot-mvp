"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

/** Loads a PDF in the browser with pdf.js (worker served from /public). */
export async function loadPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
}

/** Text layer of one page, with line breaks preserved. */
export async function getPageText(pdf: PDFDocumentProxy, pageNumber: number): Promise<string> {
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

/** Renders a page to a JPEG (base64, no prefix) about `targetWidth` pixels wide. */
export async function renderPageJpeg(pdf: PDFDocumentProxy, pageNumber: number, targetWidth = 1400): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  try {
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, targetWidth / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.8),
    );
    canvas.width = 0;
    canvas.height = 0;
    const buffer = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buffer.length; i += 0x8000) {
      binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  } finally {
    page.cleanup();
  }
}
