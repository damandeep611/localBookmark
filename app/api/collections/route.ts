import { createCollection, listCollections } from "@/lib/repo";
import { handle } from "@/lib/http";

export const GET = handle(async (req: Request) => {
  void req.url; // request-time data: never prerender
  return Response.json(listCollections());
});

export const POST = handle(async (req: Request) => {
  const body = await req.json();
  const id = createCollection({ name: String(body.name || ""), emoji: body.emoji, color: body.color });
  return Response.json({ id }, { status: 201 });
});
