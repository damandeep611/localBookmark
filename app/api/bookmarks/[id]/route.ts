import { deleteBookmark, getBookmark, updateBookmark } from "@/lib/repo";
import { handle, parseId } from "@/lib/http";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/bookmarks/[id]">) => {
  const b = getBookmark(Number((await ctx.params).id));
  return b ? Response.json(b) : Response.json({ error: "Not found" }, { status: 404 });
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/bookmarks/[id]">) => {
  const id = Number((await ctx.params).id);
  const body = await req.json();
  updateBookmark(id, {
    title: body.title,
    description: body.description,
    content: body.content,
    notes: body.notes,
    author: body.author,
    collectionId: "collectionId" in body ? parseId(body.collectionId) : undefined,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
  });
  return Response.json(getBookmark(id));
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/bookmarks/[id]">) => {
  deleteBookmark(Number((await ctx.params).id));
  return Response.json({ ok: true });
});
