"use client";
import { useState } from "react";
import { AlertTriangle, Images, Loader2, Play } from "lucide-react";
import type { Bookmark } from "@/lib/types";
import { hostOf } from "@/lib/sources";
import { SourceIcon } from "./SourceIcon";

export function BookmarkCard({ b, onOpen, onTag }: { b: Bookmark; onOpen: () => void; onTag: (t: string) => void }) {
  const [broken, setBroken] = useState(false);
  const cover = broken ? undefined : b.media[0];
  const label = b.title || b.content.slice(0, 120) || hostOf(b.url) || "Untitled";
  return (
    <article
      onClick={onOpen}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-card-hover"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-black/40">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.src} alt="" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : b.content ? (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 p-5">
            <p className="line-clamp-5 text-center text-[15px] leading-snug font-medium text-zinc-800">{b.content}</p>
          </div>
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <span className="text-3xl font-semibold tracking-tight text-zinc-500 uppercase">{initials(b.siteName || hostOf(b.url) || label)}</span>
          </div>
        )}
        {cover?.kind === "video" || b.type === "youtube" ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/60 p-3 backdrop-blur"><Play className="size-5 fill-white text-white" /></span>
          </span>
        ) : null}
        {b.media.length > 1 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white backdrop-blur">
            <Images className="size-3" /> {b.media.length}
          </span>
        )}
        {b.status === "pending" && (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-zinc-200 backdrop-blur">
            <Loader2 className="size-3 animate-spin" /> fetching
          </span>
        )}
        {b.status === "failed" && (
          <span title={b.error} className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-amber-500/80 px-1.5 py-0.5 text-[11px] text-black">
            <AlertTriangle className="size-3" /> fetch failed
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm leading-snug font-medium text-zinc-100">{label}</h3>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
            {b.tags.slice(0, 3).map((t) => (
              <button
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  onTag(t);
                }}
                className="truncate text-xs text-zinc-500 hover:text-zinc-200"
              >
                #{t}
              </button>
            ))}
          </div>
          <span className="shrink-0 text-zinc-400" title={b.source}>
            <SourceIcon source={b.source} />
          </span>
        </div>
      </div>
    </article>
  );
}

function initials(s: string) {
  const words = s.replace(/\.[a-z]+$/i, "").split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
}
