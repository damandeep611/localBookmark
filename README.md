# Stash — local bookmark archive

A local-first bookmark app for X posts, YouTube videos, saved images, links and your own notes.
Everything (SQLite DB + downloaded images) stays on your machine.

## Run

```bash
docker compose up -d --build     # → http://localhost:3000
```

Different port: `PORT=4000 docker compose up -d`. Stop: `docker compose down` (data is kept).

### Dev

```bash
npm install
npm run dev                      # → http://localhost:3000, data in ./data
```

Requires Node 24+ (uses the built-in `node:sqlite`, no native modules).

## Adding bookmarks (fast paths)

| Action | What happens |
|---|---|
| **Paste a URL anywhere** (Ctrl+V) | Quick-add opens with the link and the detected source. Enter saves. |
| **Paste / drag an image** | Quick-add opens in *Write / Images* mode with the image attached. |
| **Paste plain text** | Opens *Write* mode with the text as content. |
| **N** | Open quick-add. **Ctrl+K** or **/** focuses search. |
| **Write / Images tab** | Manual bookmark: title, paragraph text, multiple images, optional reference link, "saved from" source. |
| **Import** | Bulk import X bookmarks, YouTube playlists, or any list of links. |

Link bookmarks save instantly; title/text/images are fetched in the background and
**images are downloaded locally**, so they survive deleted tweets and dead links.

- X posts → `api.fxtwitter.com` (text, author, photos, video thumbnails)
- YouTube → oEmbed (title, channel, thumbnail)
- Everything else → Open Graph tags
- If a fetch fails, the bookmark is still saved; edit it yourself (✏️) or hit *Retry*.

## Organizing

- **Collection**: one per bookmark (the big pills). Create inline from any collection picker or the `+` pill.
- **Tags**: many per bookmark. Type to search, Enter creates.
- **Source**: auto-detected from the URL, overridable (e.g. an image you saved from Instagram).
- **Organize** panel: rename / recolor / delete collections and tags. Renaming onto an existing name **merges** them.

## Exporting your lists before clearing them

**X bookmarks**: install [twitter-web-exporter](https://github.com/prinsss/twitter-web-exporter) (Tampermonkey userscript),
open `x.com/i/bookmarks`, scroll to the bottom, export *Bookmarks → JSON*, then *Import → X bookmarks*.

**YouTube Watch Later**:

```bash
yt-dlp --flat-playlist -J --cookies-from-browser chrome "https://www.youtube.com/playlist?list=WL" > watch_later.json
```

Then *Import → YouTube playlist*. Keep the raw export files too, as a second backup.

## Backup

```bash
docker cp stash:/app/data ./stash-backup     # DB + all media
```

## Layout

```
app/api/…          route handlers (bookmarks, collections, tags, import, media)
lib/db.ts          SQLite schema (node:sqlite)
lib/repo.ts        all queries
lib/fetchers.ts    X / YouTube / Open Graph metadata
lib/worker.ts      background fetch + media download queue
lib/importers.ts   X export, yt-dlp JSON, URL lists
components/        UI (grid, add modal, per-type detail views, organize, import)
public/design/     original design references
```
