import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data"));
export const MEDIA_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "media");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  emoji TEXT NOT NULL DEFAULT '📁',
  color TEXT NOT NULL DEFAULT '#22c55e',
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,              -- tweet | youtube | image | link | note
  source TEXT NOT NULL,            -- x | youtube | instagram | reddit | github | web | manual
  url TEXT,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  author_handle TEXT NOT NULL DEFAULT '',
  author_avatar TEXT NOT NULL DEFAULT '',
  site_name TEXT NOT NULL DEFAULT '',
  collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ready',  -- pending | ready | failed
  needs_fetch INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_collection ON bookmarks(collection_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_status ON bookmarks(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url) WHERE url IS NOT NULL;

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_bt_tag ON bookmark_tags(tag_id);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'image',  -- image | video
  path TEXT,                           -- relative to MEDIA_DIR once stored locally
  remote_url TEXT,
  video_url TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_media_bookmark ON media(bookmark_id);
`;

const g = globalThis as unknown as { __bmdb?: DatabaseSync };

export function db(): DatabaseSync {
  if (g.__bmdb) return g.__bmdb;
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const d = new DatabaseSync(path.join(DATA_DIR, "app.db"));
  d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  d.exec(SCHEMA);
  g.__bmdb = d;
  return d;
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN");
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export const now = () => Date.now();
