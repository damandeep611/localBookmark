import { createBookmark, DuplicateError } from "@/lib/repo";
import { handle, parseId, parseTags } from "@/lib/http";
import { parseImport, type ImportKind } from "@/lib/importers";
import { kickWorker } from "@/lib/worker";

export const POST = handle(async (req: Request) => {
  const fd = await req.formData();
  const kind = String(fd.get("kind") || "urls") as ImportKind;
  const file = fd.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(fd.get("text") || "");
  if (!text.trim()) throw new Error("Nothing to import — choose a file or paste text");

  const items = parseImport(kind, text);
  if (!items.length) throw new Error("No bookmarks found in that input. Check the import type.");

  const collectionId = parseId(fd.get("collectionId"));
  const tags = parseTags(fd.get("tags"));
  const base = Date.now();
  let created = 0;
  let skipped = 0;
  // Exports list newest first; keep that order in "Date added".
  items.forEach((it, i) => {
    try {
      createBookmark({ ...it, collectionId, tags: [...(it.tags || []), ...tags], createdAt: base - i });
      created++;
    } catch (e) {
      if (e instanceof DuplicateError) skipped++;
      else throw e;
    }
  });
  kickWorker();
  return Response.json({ found: items.length, created, skipped });
});
