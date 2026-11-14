"use client";

import type { ChatAttachment } from "@/lib/stream-protocol";

export const MAX_PDF_BYTES = 3 * 1024 * 1024;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Downscales a photo to ≤1600 px JPEG so it uploads fast on slow connections. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<ChatAttachment> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
  return { kind: "image", name: file.name || "image.jpg", mediaType: "image/jpeg", data: await blobToBase64(blob) };
}

export async function fileToAttachment(file: File): Promise<ChatAttachment> {
  if (file.type.startsWith("image/")) return compressImage(file);
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error("فایل PDF برای چت باید کمتر از ۳ میگابایت باشد. کتاب‌های بزرگ را در «کتابخانه» اضافه کنید.");
    }
    return { kind: "pdf", name: file.name, mediaType: "application/pdf", data: await blobToBase64(file) };
  }
  throw new Error("فقط عکس یا فایل PDF قابل ضمیمه است.");
}

export function attachmentSrc(a: ChatAttachment): string {
  return `data:${a.mediaType};base64,${a.data}`;
}
