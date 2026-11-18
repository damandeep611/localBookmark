# Session notes: read this first when resuming

_Last updated: 2026-11-17 (end of session 1)_

Also read `README.md` (how to run and use the app) and `AGENTS.md` (Next.js 16 warning: read the docs in `node_modules/next/dist/docs/` before using unfamiliar Next APIs).

---

## 1. What the user wants

- A **local, personal bookmark archive** web app that runs with **one Docker command** on a localhost port.
- **Main goal:** clear the **X/Twitter bookmarks** and **YouTube Watch Later** lists by **2026-11-19** (2 days from session 1) **without losing the knowledge** in them. Content and images must be stored locally.
- Bookmarks come from many places: X posts, YouTube, images saved from social media (Instagram etc.), links, and **manually written notes**.
- **Every card in the grid looks the same, but the detail ("open") view differs by type** (tweet vs YouTube vs image vs link vs note).
- Every bookmark records **which platform it was saved from** (the "source").
- **Adding must be fast and easy.** Several input methods: paste a link, paste or drag images, **manual entry (paragraph text + one or more images)**, and bulk import.
- **Nothing hardcoded.** Collections (one per bookmark) and tags (many per bookmark) are created by the user, inline, and are easy to manage (rename, merge, delete).
- The user prefers **speed of building**; no heavy scraping. AI summaries and chat are **v2, not v1**.
- UI follows the designs in `public/design/Home-design.png` (grid, collection pills row, tag chips row) and `public/design/bookmark-open.png` (modal with a large media area plus a right-hand info sidebar). Dark theme with a green accent.

## 2. Decisions made

| Topic | Decision |
|---|---|
| Stack | Next.js **16.4.6** (App Router, Turbopack), React 19, Tailwind v4, TypeScript, lucide-react |
| DB | **Built-in `node:sqlite`** (Node 24): no native modules, no ORM, raw SQL in `lib/repo.ts`. Search uses LIKE (no FTS yet). |
| Media | Downloaded to `DATA_DIR/media/<bookmarkId>/<random>.<ext>`, served by `/api/media/[...path]` |
| Link metadata | No scraper. X uses `api.fxtwitter.com/status/<id>` (third-party). YouTube uses oEmbed plus the `i.ytimg.com` thumbnail. Everything else uses Open Graph `<meta>` tags (regex parse). Instagram is fetched with the `facebookexternalhit` user agent. |
| Background work | In-process queue (`lib/worker.ts`). Bookmarks with `status='pending'` get metadata fetched and media downloaded. The queue restarts on each `GET /api/bookmarks`, so it survives restarts. |
| URL canonicalization | Tweets become `https://x.com/i/status/<id>`. YouTube becomes `https://www.youtube.com/watch?v=<id>`. There is a unique index on `url` (duplicate gives 409 with `existingId`). |
| Organization | **Collection** (0–1 per bookmark), **Tags** (many, stored lowercase without `#`), **Source** (auto-detected, user can override) |
| Merging | Renaming a tag or collection onto an existing name **merges** them |
| App name | "Stash" (the user can rename it) |
| Docker | `node:24-slim`, `output: "standalone"`, **named volume `stash-data`** mounted at `/app/data` |

## 3. Current state (end of session 1): v1 working

Verified by curl/API tests and headless Edge screenshots:
- Grid, collection pills, source filter, tag chips, search (Ctrl+K or `/`), sort, infinite scroll, deep link `/?b=<id>`.
- Add modal: **Link** tab, and **Write / Images** tab (title, content, multiple images, optional reference link, "saved from" source). Collection picker with inline create. Tag input with create-on-Enter.
- Global **paste** (URL, image or text) and **drag-drop** open quick-add. **N** opens add.
- Detail views per type: Tweet / YouTube (embed) / Link (hero image) / Note / Image gallery. Notes & takeaways box (autosaves on blur), text edit mode (pencil icon), add or remove images, re-fetch/retry, delete.
- Organize modal (collections: emoji, name, color, delete; tags: rename/merge, delete).
- Import modal: **X bookmarks JSON** (twitter-web-exporter, tolerant parser), **yt-dlp JSON / JSONL**, **any text with URLs**. Options to put the import into a collection and add tags to all.
- Docker image builds and runs. `docker compose up -d --build` serves http://localhost:3000. It was **left running, with an empty DB** (test data wiped).

## 4. Known issues / gotchas

1. **Docker Desktop on this machine cannot bind-mount host folders** (`mkdir /run/desktop/mnt/host/d: file exists`, and C: fails too). That's why compose uses a named volume. A likely fix is `wsl --shutdown` and then restarting Docker Desktop. After that, compose could switch to `./data:/app/data`. Backup now: `docker cp stash:/app/data ./stash-backup`.
2. **5 ESLint errors**, all `react-hooks/set-state-in-effect` (form reset on open in AddModal, loading in App, DetailModal reset). They don't break build or behavior and haven't been cleaned up yet.
3. **Tweet videos**: only the thumbnail is stored locally. The mp4 plays from the remote `video_url`. Downloading videos is a possible improvement.
4. The **X importer hasn't been tested against a real twitter-web-exporter file**. If an import fails or looks wrong, ask the user for one sample entry and adjust `parseTwitter` in `lib/importers.ts`.
5. If media download fails, the remote URL is kept as a fallback. The card falls back to text or initials when an image fails to load.
6. `node:sqlite` prints an ExperimentalWarning. It's suppressed in Docker via `NODE_OPTIONS`.
7. Paths use `/*turbopackIgnore: true*/` comments in `lib/db.ts` and `lib/storage.ts` to stop Turbopack tracing the whole project. Keep them.
8. Git repo was created by create-next-app (one initial commit). **None of our work is committed yet.** Only commit when the user asks.

## 5. Next steps / ideas (not started)

- [ ] User runs the exports (twitter-web-exporter, then `yt-dlp ... list=WL`), imports them, checks the media, then clears the lists.
- [ ] Fix the import parser if the real export format differs.
- [ ] Fix the lint errors (refactor effects to keyed components or event handlers).
- [ ] Bulk select: move many bookmarks to a collection, tag many, delete many.
- [ ] Download tweet videos locally (optional, size limits).
- [ ] SQLite FTS5 search; export/backup button in the UI.
- [ ] v2: AI summary and "chat with bookmarks" (as in the design screenshot), color extraction, embeddings.

## 6. File map

```
app/page.tsx                      → <App/> (client)
app/api/bookmarks/route.ts        GET list (filters: collection|tag|source|type|q|sort|offset|limit), POST create (multipart or JSON)
app/api/bookmarks/[id]/…          GET/PATCH/DELETE, /media (POST add, DELETE ?mediaId), /refetch
app/api/collections[/id]          list (+counts, uncategorized, sources) / create / patch (merge on rename) / delete
app/api/tags[/id]                 list (?collection=) / create / rename-merge / delete
app/api/import/route.ts           kind=twitter|youtube|urls, file or text, collectionId, tags
app/api/media/[...path]/route.ts  serves files from DATA_DIR/media
lib/db.ts        schema + lazy singleton (DATA_DIR env, default ./data)
lib/repo.ts      all queries; applyFetched only fills EMPTY fields (never overwrites user edits)
lib/fetchers.ts  fxtwitter / YouTube oEmbed / Open Graph
lib/worker.ts    background queue (concurrency 3)
lib/importers.ts X / yt-dlp / URL list parsers
lib/sources.ts   URL → {type, source, canonical url} (shared client+server)
lib/client.ts    browser API wrapper, date helpers, last-used collection (localStorage)
components/      App, BookmarkCard, AddModal, DetailModal, ImportModal, ManageModal,
                 TagInput, CollectionSelect, ImagePicker, SourceIcon, Modal
```

Bookmark `type`: `tweet | youtube | image | link | note`. `source`: `x | youtube | instagram | reddit | github | linkedin | pinterest | web | manual`. `status`: `pending | ready | failed`.
