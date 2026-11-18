import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { MEDIA_DIR } from "./db";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
};

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]));
MIME_BY_EXT.jpeg = "image/jpeg";

const MAX_BYTES = 40 * 1024 * 1024;

/** Store bytes under media/<bookmarkId>/ and return the path relative to MEDIA_DIR. */
export function saveBytes(bookmarkId: number, bytes: Uint8Array, mime: string, nameHint = ""): string {
  let ext = EXT_BY_MIME[mime.split(";")[0].trim().toLowerCase()];
  if (!ext) {
    const m = nameHint.match(/\.([a-z0-9]{2,5})(?:$|\?)/i);
    ext = m && MIME_BY_EXT[m[1].toLowerCase()] ? m[1].toLowerCase() : "jpg";
  }
  const dir = path.join(/*turbopackIgnore: true*/ MEDIA_DIR, String(bookmarkId));
  fs.mkdirSync(dir, { recursive: true });
  const file = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(/*turbopackIgnore: true*/ dir, file), bytes);
  return `${bookmarkId}/${file}`;
}

export async function saveUpload(bookmarkId: number, file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 40MB`);
  return saveBytes(bookmarkId, new Uint8Array(await file.arrayBuffer()), file.type, file.name);
}

export async function download(bookmarkId: number, url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "image/*,video/*;q=0.8,*/*;q=0.5" },
    signal: AbortSignal.timeout(30_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_BYTES) throw new Error("Media too large");
  const buf = new Uint8Array(await res.arrayBuffer());
  return saveBytes(bookmarkId, buf, res.headers.get("content-type") || "", new URL(url).pathname);
}

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
