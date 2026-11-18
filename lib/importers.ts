import "server-only";
import type { BookmarkInput, MediaInput } from "./repo";
import { detect, isUrl, tweetId } from "./sources";
import { firstLine } from "./fetchers";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export type ImportKind = "twitter" | "youtube" | "urls";

function parseJsonLoose(text: string): Any {
  const t = text.trim().replace(/^﻿/, "");
  try {
    return JSON.parse(t);
  } catch {
    // JSON Lines (e.g. `yt-dlp -j`)
    return t
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  }
}

function asArray(j: Any): Any[] {
  if (Array.isArray(j)) return j;
  for (const k of ["entries", "data", "tweets", "bookmarks", "items"]) if (Array.isArray(j?.[k])) return j[k];
  return [];
}

/**
 * Twitter/X bookmarks export. Tolerant of several shapes: twitter-web-exporter JSON,
 * raw GraphQL tweet objects, or simple {url} lists.
 */
export function parseTwitter(text: string): BookmarkInput[] {
  const items = asArray(parseJsonLoose(text));
  const out: BookmarkInput[] = [];
  for (const raw of items) {
    const it = raw?.tweet_results?.result ?? raw?.tweet ?? raw;
    const legacy = it?.legacy ?? {};
    const user = it?.user ?? it?.author ?? it?.core?.user_results?.result?.legacy ?? it?.core?.user_results?.result?.core ?? {};
    const id = String(it?.id_str ?? it?.rest_id ?? it?.id ?? legacy?.id_str ?? (it?.url ? tweetId(it.url) : "") ?? "");
    if (!/^\d+$/.test(id)) continue;
    const text: string = it?.full_text ?? it?.text ?? legacy?.full_text ?? it?.note_tweet?.note_tweet_results?.result?.text ?? "";
    const handle: string = it?.screen_name ?? user?.screen_name ?? "";
    const name: string = it?.name ?? user?.name ?? "";
    const avatar: string = it?.profile_image_url ?? user?.profile_image_url_https ?? user?.avatar_url ?? "";
    const created = it?.created_at ?? legacy?.created_at;
    const publishedAt = created ? (typeof created === "number" ? created : Date.parse(created)) || null : null;

    const rawMedia: Any[] = it?.media ?? it?.extended_entities?.media ?? legacy?.extended_entities?.media ?? legacy?.entities?.media ?? [];
    const media: MediaInput[] = rawMedia
      .map((m: Any): MediaInput | null => {
        const type = String(m?.type || "photo");
        if (type === "photo") {
          const u = m?.original ?? m?.media_url_https ?? m?.url;
          return u && /^https?:/.test(u) ? { kind: "image", remoteUrl: u } : null;
        }
        const variants: Any[] = m?.video_info?.variants ?? [];
        const best = variants
          .filter((v) => v?.content_type === "video/mp4")
          .sort((a, b) => (b?.bitrate ?? 0) - (a?.bitrate ?? 0))[0]?.url;
        const videoUrl = best ?? m?.original ?? m?.url ?? null;
        const thumb = m?.thumbnail ?? m?.media_url_https ?? null;
        return { kind: "video", remoteUrl: thumb, videoUrl };
      })
      .filter(Boolean) as MediaInput[];

    out.push({
      type: "tweet",
      source: "x",
      url: `https://x.com/i/status/${id}`,
      title: text ? firstLine(text) || `Post by @${handle}` : "",
      content: text,
      author: name,
      authorHandle: handle,
      authorAvatar: avatar,
      siteName: "X",
      publishedAt,
      media,
      needsFetch: !text, // only a URL/id → enrich via fxtwitter
      meta: { tweetId: id, likes: it?.favorite_count ?? legacy?.favorite_count, retweets: it?.retweet_count ?? legacy?.retweet_count },
    });
  }
  return out;
}

/** YouTube playlist dump from `yt-dlp --flat-playlist -J` (or -j JSON lines). */
export function parseYoutube(text: string): BookmarkInput[] {
  const items = asArray(parseJsonLoose(text));
  const out: BookmarkInput[] = [];
  for (const it of items) {
    const id: string = it?.id ?? "";
    if (!/^[\w-]{11}$/.test(id)) continue;
    const title: string = it?.title ?? "";
    out.push({
      type: "youtube",
      source: "youtube",
      url: `https://www.youtube.com/watch?v=${id}`,
      title,
      description: it?.description ?? "",
      author: it?.channel ?? it?.uploader ?? "",
      authorHandle: (it?.uploader_id ?? "").replace(/^@/, ""),
      siteName: "YouTube",
      media: [{ kind: "image", remoteUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }],
      needsFetch: !title,
      meta: { videoId: id, duration: it?.duration ?? null, channelUrl: it?.channel_url ?? null },
    });
  }
  return out;
}

/** Any text containing URLs (one per line, CSV, Markdown...). */
export function parseUrls(text: string): BookmarkInput[] {
  const found = text.match(/https?:\/\/[^\s"'<>)\]]+/g) || [];
  const seen = new Set<string>();
  const out: BookmarkInput[] = [];
  for (const raw of found) {
    const cleaned = raw.replace(/[.,;]+$/, "");
    if (!isUrl(cleaned)) continue;
    const d = detect(cleaned);
    if (seen.has(d.url)) continue;
    seen.add(d.url);
    out.push({ type: d.type, source: d.source, url: d.url, needsFetch: true });
  }
  return out;
}

export function parseImport(kind: ImportKind, text: string): BookmarkInput[] {
  if (kind === "twitter") return parseTwitter(text);
  if (kind === "youtube") return parseYoutube(text);
  return parseUrls(text);
}
