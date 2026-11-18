"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Quote,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Modal } from "./Modal";
import { TagInput } from "./TagInput";
import { CollectionSelect } from "./CollectionSelect";
import { SourceIcon } from "./SourceIcon";
import { api, fmtDate } from "@/lib/client";
import { hostOf, SOURCE_LABELS, youtubeId } from "@/lib/sources";
import type { Bookmark, Collection, Media, Tag } from "@/lib/types";

export function DetailModal({
  id,
  onClose,
  collections,
  tags,
  onChanged,
  onDeleted,
  refreshMeta,
}: {
  id: number | null;
  onClose: () => void;
  collections: Collection[];
  tags: Tag[];
  onChanged: (b: Bookmark) => void;
  onDeleted: (id: number) => void;
  refreshMeta: () => Promise<void>;
}) {
  const [b, setB] = useState<Bookmark | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setB(null);
    setEditing(false);
    if (id != null) api.get(id).then(setB).catch(() => onClose());
  }, [id, onClose]);

  // Poll while the background worker is still fetching.
  useEffect(() => {
    if (!b || b.status !== "pending") return;
    const t = setTimeout(() => api.get(b.id).then((nb) => (setB(nb), onChanged(nb))), 1500);
    return () => clearTimeout(t);
  }, [b, onChanged]);

  const patch = useCallback(
    async (p: Parameters<typeof api.update>[1]) => {
      if (!b) return;
      const nb = await api.update(b.id, p);
      setB(nb);
      onChanged(nb);
      if (p.tags || "collectionId" in p) void refreshMeta();
    },
    [b, onChanged, refreshMeta],
  );

  const del = async () => {
    if (!b || !confirm("Delete this bookmark? Saved images are removed too.")) return;
    await api.remove(b.id);
    onDeleted(b.id);
  };

  return (
    <Modal open={id != null} onClose={onClose} className="max-w-6xl">
      {!b ? (
        <div className="flex h-64 items-center justify-center text-zinc-500">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="flex max-h-[88vh] flex-col">
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
            <span className="text-zinc-300">
              <SourceIcon source={b.source} className="size-4" />
            </span>
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{b.title || hostOf(b.url) || "Untitled"}</h2>
            <button onClick={() => setEditing((e) => !e)} className={`icon-btn ${editing ? "bg-white/10 text-white" : ""}`} title="Edit text">
              <Pencil className="size-4" />
            </button>
            {b.url && (
              <a href={b.url} target="_blank" rel="noreferrer" className="btn-primary h-8 px-3 text-xs">
                <ExternalLink className="size-3.5" /> View source
              </a>
            )}
            <button onClick={del} className="icon-btn text-red-400 hover:bg-red-500/15" title="Delete">
              <Trash2 className="size-4" />
            </button>
            <button onClick={onClose} className="icon-btn" title="Close (Esc)">
              <X className="size-4" />
            </button>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_300px] lg:overflow-hidden">
            {/* Main, type-specific */}
            <main className="min-w-0 lg:overflow-y-auto">
              {b.status === "failed" && (
                <div className="m-4 mb-0 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span className="flex-1">Couldn&apos;t fetch details: {b.error}. You can fill them in yourself with the ✏️ button.</span>
                  <RetryButton id={b.id} onDone={() => api.get(b.id).then(setB)} />
                </div>
              )}
              {editing ? (
                <EditView b={b} onSave={async (p) => (await patch(p), setEditing(false))} />
              ) : b.type === "tweet" ? (
                <TweetView b={b} />
              ) : b.type === "youtube" ? (
                <YoutubeView b={b} />
              ) : b.type === "link" ? (
                <LinkView b={b} />
              ) : (
                <NoteView b={b} />
              )}
              <NotesEditor key={b.id} value={b.notes} onSave={(notes) => patch({ notes })} />
            </main>

            {/* Sidebar */}
            <aside className="flex flex-col gap-5 border-t border-white/[0.06] p-4 text-sm lg:overflow-y-auto lg:border-t-0 lg:border-l">
              <Meta label="Collection">
                <CollectionSelect
                  value={b.collectionId}
                  collections={collections}
                  onChange={(collectionId) => patch({ collectionId })}
                  onCreated={refreshMeta}
                />
              </Meta>
              <Meta label="Tags">
                <TagInput value={b.tags} onChange={(t) => patch({ tags: t })} allTags={tags} />
              </Meta>
              <Meta label="Saved from">
                <span className="inline-flex items-center gap-2 rounded-md bg-white/5 px-2 py-1">
                  <SourceIcon source={b.source} /> {SOURCE_LABELS[b.source] ?? b.source}
                </span>
              </Meta>
              {(b.author || b.authorHandle) && (
                <Meta label="Author">
                  {b.author} {b.authorHandle && <span className="text-zinc-500">@{b.authorHandle}</span>}
                </Meta>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Meta label="Added">{fmtDate(b.createdAt)}</Meta>
                <Meta label="Published">{fmtDate(b.publishedAt)}</Meta>
              </div>
              <Meta label="Status">
                <span className="flex items-center gap-2">
                  <StatusPill status={b.status} />
                  {b.url && b.status !== "pending" && <RetryButton id={b.id} label="Re-fetch" onDone={() => api.get(b.id).then(setB)} />}
                </span>
              </Meta>
              <MediaManager b={b} onChange={(nb) => (setB(nb), onChanged(nb))} />
              {b.url && (
                <Meta label="URL">
                  <a href={b.url} target="_blank" rel="noreferrer" className="break-all text-zinc-400 hover:text-white">
                    {b.url}
                  </a>
                </Meta>
              )}
            </aside>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* --------------------------------- views --------------------------------- */

function TweetView({ b }: { b: Bookmark }) {
  const quote = b.meta.quote as { text?: string; author?: string; handle?: string; url?: string } | undefined;
  return (
    <div className="mx-auto max-w-2xl p-5 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        {b.authorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.authorAvatar} alt="" className="size-11 rounded-full bg-zinc-800" />
        ) : (
          <div className="flex size-11 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
            <SourceIcon source="x" className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold">{b.author || "Unknown"}</div>
          {b.authorHandle && <div className="text-sm text-zinc-500">@{b.authorHandle}</div>}
        </div>
      </div>
      <RichText text={b.content || b.title} className="text-[17px] leading-relaxed text-zinc-100" />
      {b.media.length > 0 && <MediaGrid media={b.media} />}
      {quote?.text && (
        <a href={quote.url} target="_blank" rel="noreferrer" className="mt-4 block rounded-xl border border-white/10 p-4 hover:bg-white/[0.03]">
          <div className="mb-1 flex items-center gap-2 text-sm text-zinc-400">
            <Quote className="size-3.5" /> {quote.author} {quote.handle && <span>@{quote.handle}</span>}
          </div>
          <p className="text-sm whitespace-pre-wrap text-zinc-300">{quote.text}</p>
        </a>
      )}
      <div className="mt-4 flex gap-4 text-sm text-zinc-500">
        {b.publishedAt && <span>{new Date(b.publishedAt).toLocaleString()}</span>}
        {typeof b.meta.likes === "number" && <span>♥ {Number(b.meta.likes).toLocaleString()}</span>}
        {typeof b.meta.retweets === "number" && <span>⟲ {Number(b.meta.retweets).toLocaleString()}</span>}
      </div>
    </div>
  );
}

function YoutubeView({ b }: { b: Bookmark }) {
  const vid = (b.meta.videoId as string) || (b.url ? youtubeId(b.url) : null);
  const duration = Number(b.meta.duration || 0);
  return (
    <div className="p-4 sm:p-6">
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        {vid && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${vid}`}
            title={b.title}
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
      <h1 className="mt-4 text-xl font-semibold">{b.title}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {b.author}
        {duration > 0 && <> · {fmtDuration(duration)}</>}
      </p>
      {b.description && <RichText text={b.description} className="mt-3 text-sm text-zinc-300" />}
      {b.content && <RichText text={b.content} className="mt-3 text-sm text-zinc-300" />}
    </div>
  );
}

function LinkView({ b }: { b: Bookmark }) {
  return (
    <div>
      {b.media[0] && (
        <div className="relative flex max-h-[420px] items-center justify-center overflow-hidden bg-black">
          {/* blurred backdrop like the design */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.media[0].src} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.media[0].src} alt="" className="relative max-h-[420px] object-contain" />
        </div>
      )}
      <div className="mx-auto max-w-3xl p-5 sm:p-8">
        <p className="mb-1 text-xs tracking-wide text-zinc-500 uppercase">{b.siteName || hostOf(b.url)}</p>
        <h1 className="text-2xl font-semibold">{b.title || hostOf(b.url)}</h1>
        {b.description && <p className="mt-3 leading-relaxed text-zinc-300">{b.description}</p>}
        {b.content && <RichText text={b.content} className="mt-4 leading-relaxed text-zinc-200" />}
        {b.media.length > 1 && <MediaGrid media={b.media.slice(1)} />}
      </div>
    </div>
  );
}

/** Manual notes and image bookmarks. */
function NoteView({ b }: { b: Bookmark }) {
  const images = b.media;
  if (b.type === "image" && !b.content) return <Gallery media={images} title={b.title} />;
  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8">
      {b.title && <h1 className="mb-4 text-2xl font-semibold">{b.title}</h1>}
      {b.content && <RichText text={b.content} className="text-[16px] leading-relaxed text-zinc-200" />}
      {images.length > 0 && <MediaGrid media={images} />}
    </div>
  );
}

function Gallery({ media, title }: { media: Media[]; title: string }) {
  const [i, setI] = useState(0);
  const m = media[i];
  if (!m) return <div className="p-8 text-zinc-500">No images.</div>;
  return (
    <div className="p-4">
      <div className="relative flex min-h-[300px] items-center justify-center rounded-xl bg-black">
        <MediaItem m={m} className="max-h-[65vh] w-auto rounded-lg object-contain" />
        {media.length > 1 && (
          <>
            <button onClick={() => setI((i - 1 + media.length) % media.length)} className="absolute left-2 rounded-full bg-black/60 p-2 hover:bg-black/80">
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => setI((i + 1) % media.length)} className="absolute right-2 rounded-full bg-black/60 p-2 hover:bg-black/80">
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
      {media.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {media.map((x, j) => (
            <button key={x.id} onClick={() => setI(j)} className={`size-16 shrink-0 overflow-hidden rounded-md border-2 ${j === i ? "border-accent" : "border-transparent opacity-60"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {title && <h1 className="mt-4 text-xl font-semibold">{title}</h1>}
    </div>
  );
}

function MediaGrid({ media }: { media: Media[] }) {
  const cols = media.length === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <div className={`mt-4 grid gap-2 ${cols}`}>
      {media.map((m) => (
        <MediaItem key={m.id} m={m} className="w-full rounded-xl border border-white/10 bg-black object-cover" link />
      ))}
    </div>
  );
}

function MediaItem({ m, className, link }: { m: Media; className: string; link?: boolean }) {
  if (m.kind === "video") {
    const isLocalVideo = m.src.endsWith(".mp4");
    return <video src={isLocalVideo ? m.src : (m.videoUrl ?? undefined)} poster={isLocalVideo ? undefined : m.src} controls className={className} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={m.src} alt="" loading="lazy" className={className} />;
  return link ? (
    <a href={m.src} target="_blank" rel="noreferrer">
      {img}
    </a>
  ) : (
    img
  );
}

function EditView({ b, onSave }: { b: Bookmark; onSave: (p: { title: string; content: string; description: string }) => Promise<void> }) {
  const [title, setTitle] = useState(b.title);
  const [content, setContent] = useState(b.content);
  const [description, setDescription] = useState(b.description);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3 p-5">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input text-lg font-semibold" />
      {(b.type === "link" || b.type === "youtube" || b.description) && (
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} className="input" />
      )}
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content / full text" rows={12} className="input leading-relaxed" />
      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave({ title, content, description });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 className="size-4 animate-spin" />} Save changes
        </button>
      </div>
    </div>
  );
}

function NotesEditor({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [v, setV] = useState(value);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const last = useRef(value);
  const commit = async () => {
    if (v === last.current) return;
    setState("saving");
    await onSave(v);
    last.current = v;
    setState("saved");
    setTimeout(() => setState("idle"), 1500);
  };
  return (
    <section className="mx-4 mt-2 mb-5 rounded-xl border border-white/[0.06] bg-black/20 p-4 sm:mx-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">📝 My notes &amp; takeaways</h3>
        <span className="text-xs text-zinc-500">{state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "Autosaves"}</span>
      </div>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        rows={Math.max(3, Math.min(14, v.split("\n").length + 1))}
        placeholder="What's the key idea here? What will you do with it?"
        className="w-full resize-y bg-transparent text-sm leading-relaxed outline-none placeholder:text-zinc-600"
      />
    </section>
  );
}

function MediaManager({ b, onChange }: { b: Bookmark; onChange: (b: Bookmark) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Meta label={`Images (${b.media.length})`}>
      <div className="flex flex-wrap gap-2">
        {b.media.map((m) => (
          <div key={m.id} className="group relative size-14 overflow-hidden rounded-md bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.src} alt="" className="size-full object-cover" />
            <button
              onClick={async () => confirm("Remove this image?") && onChange(await api.removeMedia(b.id, m.id))}
              className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 opacity-0 group-hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex size-14 items-center justify-center rounded-md border border-dashed border-white/15 text-zinc-500 hover:text-zinc-200"
          title="Add images"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*,video/mp4"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          if (!files.length) return;
          setBusy(true);
          try {
            onChange(await api.addMedia(b.id, files));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Meta>
  );
}

/* -------------------------------- helpers -------------------------------- */

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <div className="text-zinc-200">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Bookmark["status"] }) {
  const map = {
    ready: "bg-emerald-500/15 text-emerald-300",
    pending: "bg-sky-500/15 text-sky-300",
    failed: "bg-amber-500/15 text-amber-300",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${map[status]}`}>
      {status === "pending" && <Loader2 className="size-3 animate-spin" />}
      {status === "ready" ? "Archived" : status === "pending" ? "Fetching" : "Fetch failed"}
    </span>
  );
}

function RetryButton({ id, onDone, label = "Retry" }: { id: number; onDone: () => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await api.refetch(id);
        setTimeout(() => {
          setBusy(false);
          onDone();
        }, 400);
      }}
      className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/10"
    >
      <RefreshCw className={`size-3 ${busy ? "animate-spin" : ""}`} /> {label}
    </button>
  );
}

const URL_RE = /(https?:\/\/[^\s]+)/g;
function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <p className={`break-words whitespace-pre-wrap ${className}`}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
            {p.length > 60 ? p.slice(0, 57) + "…" : p}
          </a>
        ) : (
          p
        ),
      )}
    </p>
  );
}

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
