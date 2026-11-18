import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db, tx, now, MEDIA_DIR } from "./db";
import type { Bookmark, Collection, Media, Tag } from "./types";
import type { BookmarkType, Source } from "./sources";

type Row = Record<string, unknown>;

export class DuplicateError extends Error {
  constructor(public existingId: number) {
    super("Bookmark with this URL already exists");
  }
}

/* ---------------------------------- tags ---------------------------------- */

export function cleanTagName(name: string): string {
  return name.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase().slice(0, 60);
}

function ensureTag(name: string): number | null {
  const n = cleanTagName(name);
  if (!n) return null;
  const d = db();
  const existing = d.prepare("SELECT id FROM tags WHERE name = ?").get(n) as Row | undefined;
  if (existing) return Number(existing.id);
  const r = d.prepare("INSERT INTO tags (name, created_at) VALUES (?, ?)").run(n, now());
  return Number(r.lastInsertRowid);
}

function setBookmarkTags(bookmarkId: number, names: string[]) {
  const d = db();
  d.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(bookmarkId);
  const ins = d.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
  for (const name of names) {
    const id = ensureTag(name);
    if (id) ins.run(bookmarkId, id);
  }
}

export function listTags(collection?: string | null): Tag[] {
  const d = db();
  if (collection && collection !== "all") {
    const where = collection === "none" ? "b.collection_id IS NULL" : "b.collection_id = ?";
    const args = collection === "none" ? [] : [Number(collection)];
    return (
      d
        .prepare(
          `SELECT t.id, t.name, COUNT(*) AS count FROM tags t
           JOIN bookmark_tags bt ON bt.tag_id = t.id
           JOIN bookmarks b ON b.id = bt.bookmark_id
           WHERE ${where} GROUP BY t.id ORDER BY count DESC, t.name`,
        )
        .all(...args) as Row[]
    ).map(toTag);
  }
  return (
    d
      .prepare(
        `SELECT t.id, t.name, COUNT(bt.bookmark_id) AS count FROM tags t
         LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
         GROUP BY t.id ORDER BY count DESC, t.name`,
      )
      .all() as Row[]
  ).map(toTag);
}

const toTag = (r: Row): Tag => ({ id: Number(r.id), name: String(r.name), count: Number(r.count) });

export function createTag(name: string): Tag {
  const id = ensureTag(name);
  if (!id) throw new Error("Tag name is empty");
  return listTags().find((t) => t.id === id)!;
}

/** Rename a tag. Renaming onto an existing tag name merges the two. */
export function renameTag(id: number, name: string) {
  const n = cleanTagName(name);
  if (!n) throw new Error("Tag name is empty");
  const d = db();
  tx(() => {
    const other = d.prepare("SELECT id FROM tags WHERE name = ? AND id != ?").get(n, id) as Row | undefined;
    if (other) {
      d.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) SELECT bookmark_id, ? FROM bookmark_tags WHERE tag_id = ?").run(
        Number(other.id),
        id,
      );
      d.prepare("DELETE FROM tags WHERE id = ?").run(id);
    } else {
      d.prepare("UPDATE tags SET name = ? WHERE id = ?").run(n, id);
    }
  });
}

export function deleteTag(id: number) {
  db().prepare("DELETE FROM tags WHERE id = ?").run(id);
}

/* ------------------------------- collections ------------------------------ */

export function listCollections(): { collections: Collection[]; total: number; uncategorized: number; sources: Record<string, number> } {
  const d = db();
  const collections = (
    d
      .prepare(
        `SELECT c.*, COUNT(b.id) AS count FROM collections c
         LEFT JOIN bookmarks b ON b.collection_id = c.id
         GROUP BY c.id ORDER BY c.position, c.created_at`,
      )
      .all() as Row[]
  ).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    emoji: String(r.emoji),
    color: String(r.color),
    position: Number(r.position),
    count: Number(r.count),
  }));
  const total = Number((d.prepare("SELECT COUNT(*) AS c FROM bookmarks").get() as Row).c);
  const uncategorized = Number((d.prepare("SELECT COUNT(*) AS c FROM bookmarks WHERE collection_id IS NULL").get() as Row).c);
  const sources: Record<string, number> = {};
  for (const r of d.prepare("SELECT source, COUNT(*) AS c FROM bookmarks GROUP BY source").all() as Row[]) {
    sources[String(r.source)] = Number(r.c);
  }
  return { collections, total, uncategorized, sources };
}

export function createCollection(input: { name: string; emoji?: string; color?: string }): number {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error("Collection name is empty");
  const d = db();
  const existing = d.prepare("SELECT id FROM collections WHERE name = ?").get(name) as Row | undefined;
  if (existing) return Number(existing.id);
  const pos = Number((d.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM collections").get() as Row).p);
  const r = d
    .prepare("INSERT INTO collections (name, emoji, color, position, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(name, input.emoji || "📁", input.color || "#22c55e", pos, now());
  return Number(r.lastInsertRowid);
}

/** Update a collection. Renaming onto an existing collection name merges into it. */
export function updateCollection(id: number, patch: { name?: string; emoji?: string; color?: string; position?: number }) {
  const d = db();
  tx(() => {
    if (patch.name !== undefined) {
      const name = patch.name.trim().slice(0, 60);
      if (!name) throw new Error("Collection name is empty");
      const other = d.prepare("SELECT id FROM collections WHERE name = ? AND id != ?").get(name, id) as Row | undefined;
      if (other) {
        d.prepare("UPDATE bookmarks SET collection_id = ? WHERE collection_id = ?").run(Number(other.id), id);
        d.prepare("DELETE FROM collections WHERE id = ?").run(id);
        return;
      }
      d.prepare("UPDATE collections SET name = ? WHERE id = ?").run(name, id);
    }
    if (patch.emoji !== undefined) d.prepare("UPDATE collections SET emoji = ? WHERE id = ?").run(patch.emoji || "📁", id);
    if (patch.color !== undefined) d.prepare("UPDATE collections SET color = ? WHERE id = ?").run(patch.color, id);
    if (patch.position !== undefined) d.prepare("UPDATE collections SET position = ? WHERE id = ?").run(patch.position, id);
  });
}

export function deleteCollection(id: number) {
  db().prepare("DELETE FROM collections WHERE id = ?").run(id);
}

/* -------------------------------- bookmarks ------------------------------- */

export type MediaInput = { kind?: "image" | "video"; path?: string | null; remoteUrl?: string | null; videoUrl?: string | null };

export type BookmarkInput = {
  type: BookmarkType;
  source: Source;
  url?: string | null;
  title?: string;
  description?: string;
  content?: string;
  notes?: string;
  author?: string;
  authorHandle?: string;
  authorAvatar?: string;
  siteName?: string;
  collectionId?: number | null;
  tags?: string[];
  media?: MediaInput[];
  needsFetch?: boolean;
  meta?: Record<string, unknown>;
  publishedAt?: number | null;
  createdAt?: number;
};

export function findByUrl(url: string): number | null {
  const r = db().prepare("SELECT id FROM bookmarks WHERE url = ?").get(url) as Row | undefined;
  return r ? Number(r.id) : null;
}

export function createBookmark(input: BookmarkInput): number {
  if (input.url) {
    const existing = findByUrl(input.url);
    if (existing) throw new DuplicateError(existing);
  }
  const d = db();
  const hasRemoteMedia = (input.media || []).some((m) => !m.path && m.remoteUrl);
  const pending = input.needsFetch || hasRemoteMedia;
  const t = input.createdAt ?? now();
  return tx(() => {
    const r = d
      .prepare(
        `INSERT INTO bookmarks (type, source, url, title, description, content, notes, author, author_handle, author_avatar,
          site_name, collection_id, status, needs_fetch, meta, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.type,
        input.source,
        input.url || null,
        input.title || "",
        input.description || "",
        input.content || "",
        input.notes || "",
        input.author || "",
        input.authorHandle || "",
        input.authorAvatar || "",
        input.siteName || "",
        input.collectionId ?? null,
        pending ? "pending" : "ready",
        input.needsFetch ? 1 : 0,
        JSON.stringify(input.meta || {}),
        input.publishedAt ?? null,
        t,
        t,
      );
    const id = Number(r.lastInsertRowid);
    addMedia(id, input.media || []);
    if (input.tags?.length) setBookmarkTags(id, input.tags);
    return id;
  });
}

export function addMedia(bookmarkId: number, media: MediaInput[]) {
  const d = db();
  const start = Number(
    (d.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM media WHERE bookmark_id = ?").get(bookmarkId) as Row).p,
  );
  const ins = d.prepare("INSERT INTO media (bookmark_id, kind, path, remote_url, video_url, position) VALUES (?, ?, ?, ?, ?, ?)");
  media.forEach((m, i) => ins.run(bookmarkId, m.kind || "image", m.path || null, m.remoteUrl || null, m.videoUrl || null, start + i));
}

export function removeMedia(bookmarkId: number, mediaId: number) {
  const d = db();
  const r = d.prepare("SELECT path FROM media WHERE id = ? AND bookmark_id = ?").get(mediaId, bookmarkId) as Row | undefined;
  if (!r) return;
  d.prepare("DELETE FROM media WHERE id = ?").run(mediaId);
  if (r.path) fs.rmSync(path.join(MEDIA_DIR, String(r.path)), { force: true });
}

export type BookmarkPatch = Partial<
  Pick<BookmarkInput, "title" | "description" | "content" | "notes" | "collectionId" | "tags" | "url" | "author">
>;

export function updateBookmark(id: number, patch: BookmarkPatch) {
  const d = db();
  const cols: Record<string, string> = {
    title: "title",
    description: "description",
    content: "content",
    notes: "notes",
    collectionId: "collection_id",
    url: "url",
    author: "author",
  };
  tx(() => {
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    for (const [k, col] of Object.entries(cols)) {
      const v = (patch as Record<string, unknown>)[k];
      if (v !== undefined) {
        sets.push(`${col} = ?`);
        vals.push(v === "" && (k === "url" || k === "collectionId") ? null : (v as string | number | null));
      }
    }
    sets.push("updated_at = ?");
    vals.push(now());
    d.prepare(`UPDATE bookmarks SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
    if (patch.tags) setBookmarkTags(id, patch.tags);
  });
}

export function deleteBookmark(id: number) {
  db().prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
  fs.rmSync(path.join(MEDIA_DIR, String(id)), { recursive: true, force: true });
}

function hydrate(rows: Row[]): Bookmark[] {
  if (!rows.length) return [];
  const d = db();
  const ids = rows.map((r) => Number(r.id));
  const ph = ids.map(() => "?").join(",");
  const tags = new Map<number, string[]>();
  for (const r of d
    .prepare(`SELECT bt.bookmark_id AS b, t.name FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id IN (${ph}) ORDER BY t.name`)
    .all(...ids) as Row[]) {
    const b = Number(r.b);
    if (!tags.has(b)) tags.set(b, []);
    tags.get(b)!.push(String(r.name));
  }
  const media = new Map<number, Media[]>();
  for (const r of d
    .prepare(`SELECT * FROM media WHERE bookmark_id IN (${ph}) ORDER BY position, id`)
    .all(...ids) as Row[]) {
    const b = Number(r.bookmark_id);
    const src = r.path ? `/api/media/${r.path}` : String(r.remote_url || "");
    if (!src) continue;
    if (!media.has(b)) media.set(b, []);
    media.get(b)!.push({ id: Number(r.id), kind: r.kind === "video" ? "video" : "image", src, videoUrl: (r.video_url as string) || null });
  }
  return rows.map((r) => {
    const id = Number(r.id);
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(String(r.meta || "{}"));
    } catch {}
    return {
      id,
      type: r.type as BookmarkType,
      source: r.source as Source,
      url: (r.url as string) || null,
      title: String(r.title),
      description: String(r.description),
      content: String(r.content),
      notes: String(r.notes),
      author: String(r.author),
      authorHandle: String(r.author_handle),
      authorAvatar: String(r.author_avatar),
      siteName: String(r.site_name),
      collectionId: r.collection_id == null ? null : Number(r.collection_id),
      status: r.status as Bookmark["status"],
      error: String(r.error),
      meta,
      publishedAt: r.published_at == null ? null : Number(r.published_at),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      tags: tags.get(id) || [],
      media: media.get(id) || [],
    };
  });
}

export function getBookmark(id: number): Bookmark | null {
  const r = db().prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as Row | undefined;
  return r ? hydrate([r])[0] : null;
}

export type ListQuery = {
  collection?: string | null; // id | "none" | "all"
  tag?: string | null;
  source?: string | null;
  type?: string | null;
  q?: string | null;
  sort?: "newest" | "oldest" | "title";
  offset?: number;
  limit?: number;
};

export function listBookmarks(qy: ListQuery) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (qy.collection && qy.collection !== "all") {
    if (qy.collection === "none") where.push("b.collection_id IS NULL");
    else {
      where.push("b.collection_id = ?");
      args.push(Number(qy.collection));
    }
  }
  if (qy.tag) {
    where.push("EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id AND t.name = ?)");
    args.push(cleanTagName(qy.tag));
  }
  if (qy.source) {
    where.push("b.source = ?");
    args.push(qy.source);
  }
  if (qy.type) {
    where.push("b.type = ?");
    args.push(qy.type);
  }
  if (qy.q?.trim()) {
    for (const word of qy.q.trim().split(/\s+/).slice(0, 8)) {
      const w = `%${word.replace(/[%_]/g, "")}%`;
      where.push(
        `(b.title LIKE ? OR b.description LIKE ? OR b.content LIKE ? OR b.notes LIKE ? OR b.author LIKE ? OR b.author_handle LIKE ? OR b.url LIKE ?
          OR EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id AND t.name LIKE ?))`,
      );
      args.push(w, w, w, w, w, w, w, w);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order =
    qy.sort === "oldest" ? "b.created_at ASC, b.id ASC" : qy.sort === "title" ? "b.title COLLATE NOCASE ASC" : "b.created_at DESC, b.id DESC";
  const limit = Math.min(qy.limit || 60, 200);
  const offset = qy.offset || 0;
  const d = db();
  const total = Number((d.prepare(`SELECT COUNT(*) AS c FROM bookmarks b ${whereSql}`).get(...args) as Row).c);
  const rows = d.prepare(`SELECT b.* FROM bookmarks b ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args, limit, offset) as Row[];
  const items = hydrate(rows);
  return { items, total, nextOffset: offset + items.length < total ? offset + items.length : null };
}

/* ------------------------------ worker helpers ----------------------------- */

export function pendingIds(limit = 20): number[] {
  return (db().prepare("SELECT id FROM bookmarks WHERE status = 'pending' ORDER BY id LIMIT ?").all(limit) as Row[]).map((r) => Number(r.id));
}

export function rawBookmark(id: number): Row | undefined {
  return db().prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as Row | undefined;
}

export function undownloadedMedia(bookmarkId: number): { id: number; remote_url: string }[] {
  return (
    db().prepare("SELECT id, remote_url FROM media WHERE bookmark_id = ? AND path IS NULL AND remote_url IS NOT NULL").all(bookmarkId) as Row[]
  ).map((r) => ({ id: Number(r.id), remote_url: String(r.remote_url) }));
}

export function setMediaPath(mediaId: number, p: string) {
  db().prepare("UPDATE media SET path = ? WHERE id = ?").run(p, mediaId);
}

export function applyFetched(
  id: number,
  f: Partial<{
    title: string;
    description: string;
    content: string;
    author: string;
    authorHandle: string;
    authorAvatar: string;
    siteName: string;
    publishedAt: number | null;
    meta: Record<string, unknown>;
  }>,
) {
  const d = db();
  const cur = rawBookmark(id);
  if (!cur) return;
  // Only fill fields that are still empty, so user edits are never overwritten.
  const pick = (key: string, v: string | undefined) => (String(cur[key] || "") ? String(cur[key]) : v || "");
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(String(cur.meta || "{}"));
  } catch {}
  d.prepare(
    `UPDATE bookmarks SET title = ?, description = ?, content = ?, author = ?, author_handle = ?, author_avatar = ?, site_name = ?,
      published_at = COALESCE(published_at, ?), meta = ?, updated_at = ? WHERE id = ?`,
  ).run(
    pick("title", f.title),
    pick("description", f.description),
    pick("content", f.content),
    pick("author", f.author),
    pick("author_handle", f.authorHandle),
    pick("author_avatar", f.authorAvatar),
    pick("site_name", f.siteName),
    f.publishedAt ?? null,
    JSON.stringify({ ...meta, ...(f.meta || {}) }),
    now(),
    id,
  );
}

export function setStatus(id: number, status: "pending" | "ready" | "failed", error = "", needsFetch?: boolean) {
  const d = db();
  if (needsFetch === undefined) d.prepare("UPDATE bookmarks SET status = ?, error = ? WHERE id = ?").run(status, error, id);
  else d.prepare("UPDATE bookmarks SET status = ?, error = ?, needs_fetch = ? WHERE id = ?").run(status, error, needsFetch ? 1 : 0, id);
}

export function hasMedia(id: number): boolean {
  return !!db().prepare("SELECT 1 FROM media WHERE bookmark_id = ? LIMIT 1").get(id);
}
