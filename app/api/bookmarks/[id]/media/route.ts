import { addMedia, getBookmark, removeMedia } from "@/lib/repo";
import { handle } from "@/lib/http";
import { saveUpload } from "@/lib/storage";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/bookmarks/[id]/media">) => {
  const id = Number((await ctx.params).id);
  if (!getBookmark(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const fd = await req.formData();
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const saved: { kind: "image" | "video"; path: string }[] = [];
  for (const f of files) saved.push({ kind: f.type.startsWith("video/") ? "video" : "image", path: await saveUpload(id, f) });
  addMedia(id, saved);
  return Response.json(getBookmark(id));
});

export const DELETE = handle(async (req: Request, ctx: RouteContext<"/api/bookmarks/[id]/media">) => {
  const id = Number((await ctx.params).id);
  removeMedia(id, Number(new URL(req.url).searchParams.get("mediaId")));
  return Response.json(getBookmark(id));
});
