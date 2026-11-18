import { deleteCollection, updateCollection } from "@/lib/repo";
import { handle } from "@/lib/http";

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/collections/[id]">) => {
  const body = await req.json();
  updateCollection(Number((await ctx.params).id), body);
  return Response.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/collections/[id]">) => {
  deleteCollection(Number((await ctx.params).id));
  return Response.json({ ok: true });
});
