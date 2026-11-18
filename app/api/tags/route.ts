import { createTag, listTags } from "@/lib/repo";
import { handle } from "@/lib/http";

export const GET = handle(async (req: Request) => {
  return Response.json(listTags(new URL(req.url).searchParams.get("collection")));
});

export const POST = handle(async (req: Request) => {
  const body = await req.json();
  return Response.json(createTag(String(body.name || "")), { status: 201 });
});
