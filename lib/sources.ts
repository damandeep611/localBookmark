// Shared (client + server) helpers for detecting where a URL comes from.

export type BookmarkType = "tweet" | "youtube" | "image" | "link" | "note";
export type Source =
  | "x"
  | "youtube"
  | "instagram"
  | "reddit"
  | "github"
  | "linkedin"
  | "pinterest"
  | "web"
  | "manual";

export const SOURCE_LABELS: Record<Source, string> = {
  x: "X / Twitter",
  youtube: "YouTube",
  instagram: "Instagram",
  reddit: "Reddit",
  github: "GitHub",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  web: "Web",
  manual: "Manual",
};

export function tweetId(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com)\/(?:[^/]+|i(?:\/web)?)\/status(?:es)?\/(\d+)/i);
  return m ? m[1] : null;
}

export function youtubeId(url: string): string | null {
  const m =
    url.match(/youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)([\w-]{11})/i) ||
    url.match(/youtu\.be\/([\w-]{11})/i);
  return m ? m[1] : null;
}

export function isUrl(text: string): boolean {
  try {
    const u = new URL(text.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function detect(rawUrl: string): { type: BookmarkType; source: Source; url: string } {
  const url = rawUrl.trim();
  const tid = tweetId(url);
  if (tid) return { type: "tweet", source: "x", url: `https://x.com/i/status/${tid}` };
  const yid = youtubeId(url);
  if (yid) return { type: "youtube", source: "youtube", url: `https://www.youtube.com/watch?v=${yid}` };

  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}
  const isImage = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(url);
  const source: Source = /(^|\.)instagram\.com$/.test(host)
    ? "instagram"
    : /(^|\.)reddit\.com$|^redd\.it$/.test(host)
      ? "reddit"
      : /(^|\.)github\.com$/.test(host)
        ? "github"
        : /(^|\.)linkedin\.com$/.test(host)
          ? "linkedin"
          : /(^|\.)pinterest\.[a-z.]+$|^pin\.it$/.test(host)
            ? "pinterest"
            : /(^|\.)(twitter|x)\.com$/.test(host)
              ? "x"
              : /(^|\.)youtube\.com$|^youtu\.be$/.test(host)
                ? "youtube"
                : "web";
  return { type: isImage ? "image" : "link", source, url };
}

export function hostOf(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
