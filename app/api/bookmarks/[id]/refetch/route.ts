import { getBookmark, setStatus } from "@/lib/repo";
import { handle } from "@/lib/http";
import { kickWorker } from "@/lib/worker";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/bookmarks/[id]/refetch">) => {
  const id = Number((await ctx.params).id);
  const b = getBookmark(id);
  if (!b) return Response.json({ error: "Not found" }, { status: 404 });
  setStatus(id, "pending", "", !!b.url);
  kickWorker();
  return Response.json({ ok: true });
});
