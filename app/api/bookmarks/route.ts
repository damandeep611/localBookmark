import { addMedia, createBookmark, listBookmarks, type ListQuery } from "@/lib/repo";
import { handle, parseId, parseTags } from "@/lib/http";
import { detect, isUrl, SOURCE_LABELS, type Source } from "@/lib/sources";
import { saveUpload } from "@/lib/storage";
import { kickWorker } from "@/lib/worker";
import { deleteBookmark } from "@/lib/repo";

export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  kickWorker(); // resume any pending jobs after a restart
  const data = listBookmarks({
    collection: sp.get("collection"),
    tag: sp.get("tag"),
    source: sp.get("source"),
    type: sp.get("type"),
    q: sp.get("q"),
    sort: (sp.get("sort") as ListQuery["sort"]) || "newest",
    offset: Number(sp.get("offset") || 0),
    limit: Number(sp.get("limit") || 60),
  });
  return Response.json(data);
});

/**
 * Create a bookmark. Accepts multipart/form-data (with optional `files`) or JSON.
 * - Only `url`            → link/tweet/youtube bookmark, metadata fetched in background.
 * - `content` and/or files → manual note / image bookmark (url optional, used as reference).
 */
export const POST = handle(async (req: Request) => {
  const ctype = req.headers.get("content-type") || "";
  let f: Record<string, unknown> = {};
  let files: File[] = [];
  if (ctype.includes("multipart/form-data")) {
    const fd = await req.formData();
    for (const [k, v] of fd.entries()) {
      if (k === "files" && v instanceof File) {
        if (v.size > 0) files.push(v);
      } else f[k] = v;
    }
  } else {
    f = await req.json();
  }

  const url = String(f.url || "").trim();
  if (url && !isUrl(url)) throw new Error("That doesn't look like a valid http(s) URL");
  const title = String(f.title || "").trim();
  const content = String(f.content || "").trim();
  const notes = String(f.notes || "").trim();
  const sourceOverride = String(f.source || "") as Source;
  files = files.filter((x) => x.type.startsWith("image/") || x.type.startsWith("video/"));

  if (!url && !content && !files.length && !title) throw new Error("Add a link, some text, or an image");

  const detected = url ? detect(url) : null;
  const manual = !!content || files.length > 0 || !url;
  const type = manual ? (files.length && !content ? "image" : "note") : detected!.type;
  const source: Source = sourceOverride && sourceOverride in SOURCE_LABELS ? sourceOverride : (detected?.source ?? "manual");

  const id = createBookmark({
    type,
    source,
    url: detected?.url ?? null,
    title,
    content,
    notes,
    collectionId: parseId(f.collectionId as string),
    tags: parseTags(f.tags as string),
    needsFetch: !!url,
  });
  if (files.length) {
    const paths: string[] = [];
    try {
      for (const file of files) paths.push(await saveUpload(id, file));
    } catch (e) {
      deleteBookmark(id);
      throw e;
    }
    addMedia(id, paths.map((p, i) => ({ kind: files[i].type.startsWith("video/") ? "video" : "image", path: p })));
  }
  kickWorker();
  return Response.json({ id }, { status: 201 });
});
