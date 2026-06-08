/**
 * National-ID card image storage via Vercel Blob.
 *
 * Blob URLs are public-but-unguessable, so we NEVER expose the URL to the
 * browser: it is stored server-side (clients.id_card_url) and streamed back to
 * ops only through an authenticated, audited endpoint.
 */

import { put } from "@vercel/blob";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function blobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function uploadIdCard(file: File, clientHint: string): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("ID card must be a JPG, PNG, WebP or PDF.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("ID card image is too large (max 6 MB).");
  }
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const { url } = await put(`id-cards/${clientHint}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return url;
}
