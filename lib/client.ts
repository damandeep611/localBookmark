"use client";
import type { Bookmark, Collection, ListResponse, Tag } from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & { status?: number; existingId?: number };
    err.status = res.status;
    err.existingId = data.existingId;
    throw err;
  }
  return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type CollectionsResponse = { collections: Collection[]; total: number; uncategorized: number; sources: Record<string, number> };

export const api = {
  list: (params: Record<string, string | number | undefined | null>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    return req<ListResponse>(`/api/bookmarks?${sp}`);
  },
  get: (id: number) => req<Bookmark>(`/api/bookmarks/${id}`),
  create: (fd: FormData) => req<{ id: number }>("/api/bookmarks", { method: "POST", body: fd }),
  update: (id: number, patch: Partial<Pick<Bookmark, "title" | "content" | "notes" | "description" | "collectionId" | "tags">>) =>
    req<Bookmark>(`/api/bookmarks/${id}`, json("PATCH", patch)),
  remove: (id: number) => req(`/api/bookmarks/${id}`, { method: "DELETE" }),
  refetch: (id: number) => req(`/api/bookmarks/${id}/refetch`, { method: "POST" }),
  addMedia: (id: number, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return req<Bookmark>(`/api/bookmarks/${id}/media`, { method: "POST", body: fd });
  },
  removeMedia: (id: number, mediaId: number) => req<Bookmark>(`/api/bookmarks/${id}/media?mediaId=${mediaId}`, { method: "DELETE" }),

  collections: () => req<CollectionsResponse>("/api/collections"),
  createCollection: (body: { name: string; emoji?: string; color?: string }) => req<{ id: number }>("/api/collections", json("POST", body)),
  updateCollection: (id: number, body: Partial<Pick<Collection, "name" | "emoji" | "color" | "position">>) =>
    req(`/api/collections/${id}`, json("PATCH", body)),
  deleteCollection: (id: number) => req(`/api/collections/${id}`, { method: "DELETE" }),

  tags: (collection?: string) => req<Tag[]>(`/api/tags${collection ? `?collection=${collection}` : ""}`),
  renameTag: (id: number, name: string) => req(`/api/tags/${id}`, json("PATCH", { name })),
  deleteTag: (id: number) => req(`/api/tags/${id}`, { method: "DELETE" }),

  import: (fd: FormData) => req<{ found: number; created: number; skipped: number }>("/api/import", { method: "POST", body: fd }),
};

export function timeAgo(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const LAST_COLLECTION = "bm:lastCollection";
export function getLastCollection(): number | null {
  try {
    const v = localStorage.getItem(LAST_COLLECTION);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
export function setLastCollection(id: number | null) {
  try {
    if (id) localStorage.setItem(LAST_COLLECTION, String(id));
    else localStorage.removeItem(LAST_COLLECTION);
  } catch {}
}
