import "server-only";
import { tweetId, youtubeId, hostOf } from "./sources";
import { UA } from "./storage";
import type { MediaInput } from "./repo";

export type Fetched = {
  title?: string;
  description?: string;
  content?: string;
  author?: string;
  authorHandle?: string;
  authorAvatar?: string;
  siteName?: string;
  publishedAt?: number | null;
  media?: MediaInput[];
  meta?: Record<string, unknown>;
};

/* ---------------------------------- X ------------------------------------ */

type FxMedia = { type: string; url: string; thumbnail_url?: string };
type FxTweet = {
  text: string;
  author: { name: string; screen_name: string; avatar_url?: string };
  created_timestamp?: number;
  media?: { all?: FxMedia[] };
  quote?: FxTweet & { url?: string };
  likes?: number;
  retweets?: number;
  replies?: number;
  url?: string;
};

export async function fetchTweet(url: string): Promise<Fetched> {
  const id = tweetId(url);
  if (!id) throw new Error("Not a tweet URL");
  const res = await fetch(`https://api.fxtwitter.com/status/${id}`, {
    headers: { "User-Agent": "bookmark-save/1.0 (personal archive)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`fxtwitter HTTP ${res.status}`);
  const json = (await res.json()) as { tweet?: FxTweet; message?: string };
  const t = json.tweet;
  if (!t) throw new Error(json.message || "Tweet not found (deleted or private?)");
  const media: MediaInput[] = (t.media?.all || []).map((m) =>
    m.type === "photo"
      ? { kind: "image", remoteUrl: m.url }
      : { kind: "video", remoteUrl: m.thumbnail_url || null, videoUrl: m.url },
  );
  const quote = t.quote
    ? { text: t.quote.text, author: t.quote.author?.name, handle: t.quote.author?.screen_name, url: t.quote.url }
    : undefined;
  return {
    title: firstLine(t.text) || `Post by @${t.author.screen_name}`,
    content: t.text,
    author: t.author.name,
    authorHandle: t.author.screen_name,
    authorAvatar: t.author.avatar_url || "",
    siteName: "X",
    publishedAt: t.created_timestamp ? t.created_timestamp * 1000 : null,
    media,
    meta: { tweetId: id, likes: t.likes, retweets: t.retweets, replies: t.replies, quote },
  };
}

/* -------------------------------- YouTube --------------------------------- */

export async function fetchYoutube(url: string): Promise<Fetched> {
  const id = youtubeId(url);
  if (!id) throw new Error("Not a YouTube URL");
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  if (!res.ok) {
    // Private/removed videos: still keep the thumbnail if it exists.
    return { siteName: "YouTube", media: [{ kind: "image", remoteUrl: thumb }], meta: { videoId: id } };
  }
  const j = (await res.json()) as { title?: string; author_name?: string; author_url?: string };
  return {
    title: j.title,
    author: j.author_name,
    authorHandle: j.author_url?.split("/").pop()?.replace(/^@/, "") || "",
    siteName: "YouTube",
    media: [{ kind: "image", remoteUrl: thumb }],
    meta: { videoId: id, channelUrl: j.author_url },
  };
}

/* ------------------------------ Generic (OG) ------------------------------ */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z#0-9]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m)
    .trim();
}

function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return out;
}

export async function fetchGeneric(url: string, source: string): Promise<Fetched> {
  const ua = source === "instagram" || source === "x" ? "facebookexternalhit/1.1" : UA;
  const res = await fetch(url, {
    headers: { "User-Agent": ua, Accept: "text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.8", "Accept-Language": "en" },
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ctype = res.headers.get("content-type") || "";
  if (ctype.startsWith("image/")) {
    return { title: decodeURIComponent(new URL(url).pathname.split("/").pop() || hostOf(url)), media: [{ kind: "image", remoteUrl: url }] };
  }
  // Read at most ~1MB of HTML — metadata lives in <head>.
  const html = (await res.text()).slice(0, 1_000_000);
  const head = html.split(/<\/head>/i)[0];
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = parseAttrs(m[0]);
    const key = (a.property || a.name || a.itemprop || "").toLowerCase();
    if (key && a.content && !meta[key]) meta[key] = decode(a.content);
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = meta["og:title"] || meta["twitter:title"] || (titleTag ? decode(titleTag) : "") || hostOf(url);
  const description = meta["og:description"] || meta["twitter:description"] || meta["description"] || "";
  let image = meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || meta["twitter:image:src"] || "";
  if (image) {
    try {
      image = new URL(image, res.url || url).toString();
    } catch {
      image = "";
    }
  }
  const published = meta["article:published_time"] || meta["og:published_time"] || meta["date"];
  const publishedAt = published && !isNaN(Date.parse(published)) ? Date.parse(published) : null;
  return {
    title,
    description,
    author: meta["author"] || meta["article:author"] || "",
    siteName: meta["og:site_name"] || hostOf(url),
    publishedAt,
    media: image ? [{ kind: "image", remoteUrl: image }] : [],
  };
}

export async function fetchFor(url: string, type: string, source: string): Promise<Fetched> {
  if (type === "tweet") return fetchTweet(url);
  if (type === "youtube") return fetchYoutube(url);
  if (type === "image") return { title: decodeURIComponent(new URL(url).pathname.split("/").pop() || ""), media: [{ kind: "image", remoteUrl: url }] };
  return fetchGeneric(url, source);
}

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim()) || "";
  const clean = line.replace(/https?:\/\/t\.co\/\S+/g, "").trim();
  return clean.length > 110 ? clean.slice(0, 107) + "…" : clean;
}
export { firstLine };
