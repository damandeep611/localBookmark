import "server-only";
import { fetchFor } from "./fetchers";
import { download } from "./storage";
import {
  addMedia,
  applyFetched,
  hasMedia,
  pendingIds,
  rawBookmark,
  setMediaPath,
  setStatus,
  undownloadedMedia,
} from "./repo";
import { hostOf } from "./sources";

/**
 * Tiny in-process job queue. Bookmarks with status = 'pending' get their metadata
 * fetched and their remote media downloaded to ./data/media so they survive
 * deleted tweets / dead links. Survives restarts because state lives in SQLite.
 */
const CONCURRENCY = 3;
const g = globalThis as unknown as { __bmworker?: { running: boolean; active: Set<number> } };
const state = (g.__bmworker ??= { running: false, active: new Set<number>() });

export function kickWorker() {
  if (state.running) return;
  state.running = true;
  void loop().finally(() => {
    state.running = false;
  });
}

async function loop() {
  for (;;) {
    const ids = pendingIds(CONCURRENCY * 4).filter((id) => !state.active.has(id));
    if (!ids.length) return;
    // Process in small parallel batches.
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      await Promise.all(ids.slice(i, i + CONCURRENCY).map(processOne));
    }
  }
}

async function processOne(id: number) {
  state.active.add(id);
  try {
    const row = rawBookmark(id);
    if (!row || row.status !== "pending") return;
    let fetchError = "";
    if (Number(row.needs_fetch) && row.url) {
      try {
        const f = await fetchFor(String(row.url), String(row.type), String(row.source));
        applyFetched(id, f);
        if (f.media?.length && !hasMedia(id)) addMedia(id, f.media);
      } catch (e) {
        fetchError = (e as Error).message || "Fetch failed";
        if (!String(row.title)) applyFetched(id, { title: hostOf(String(row.url)) || String(row.url) });
      }
    }
    for (const m of undownloadedMedia(id)) {
      try {
        setMediaPath(m.id, await download(id, m.remote_url));
      } catch {
        // Keep the remote URL as a fallback; not fatal.
      }
    }
    setStatus(id, fetchError ? "failed" : "ready", fetchError, false);
  } catch (e) {
    setStatus(id, "failed", (e as Error).message || "Unknown error", false);
  } finally {
    state.active.delete(id);
  }
}

export function workerBusy() {
  return state.running;
}
