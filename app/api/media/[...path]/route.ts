import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { MEDIA_DIR } from "@/lib/db";
import { MIME_BY_EXT } from "@/lib/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/media/[...path]">) {
  const parts = (await ctx.params).path;
  const file = path.resolve(MEDIA_DIR, ...parts);
  if (!file.startsWith(MEDIA_DIR + path.sep) || !fs.existsSync(file)) {
    return new Response("Not found", { status: 404 });
  }
  const stat = fs.statSync(file);
  const ext = path.extname(file).slice(1).toLowerCase();
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": MIME_BY_EXT[ext] || "application/octet-stream",
      "Content-Length": String(stat.size),
      // File names are random and immutable.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
