import "server-only";
import { DuplicateError } from "./repo";

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response> | Response) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof DuplicateError) {
        return Response.json({ error: "Already saved", existingId: e.existingId }, { status: 409 });
      }
      const msg = (e as Error).message || "Server error";
      console.error("[api]", e);
      return Response.json({ error: msg }, { status: 400 });
    }
  };
}

export function parseTags(v: FormDataEntryValue | string[] | string | null | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  const s = String(v);
  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) return j.map(String);
  } catch {}
  return s.split(",").map((t) => t.trim()).filter(Boolean);
}

export function parseId(v: FormDataEntryValue | string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "" || v === "none") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
