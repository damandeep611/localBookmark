import { deleteTag, renameTag } from "@/lib/repo";
import { handle } from "@/lib/http";

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/tags/[id]">) => {
  const body = await req.json();
  renameTag(Number((await ctx.params).id), String(body.name || ""));
  return Response.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/tags/[id]">) => {
  deleteTag(Number((await ctx.params).id));
  return Response.json({ ok: true });
});
