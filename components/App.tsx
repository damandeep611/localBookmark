"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Bookmark as BookmarkIcon, Download, Loader2, Plus, Search, Settings2, X } from "lucide-react";
import { api, getLastCollection, type CollectionsResponse } from "@/lib/client";
import { isUrl, SOURCE_LABELS, type Source } from "@/lib/sources";
import type { Bookmark, Tag } from "@/lib/types";
import { BookmarkCard } from "./BookmarkCard";
import { AddModal, type AddInitial } from "./AddModal";
import { DetailModal } from "./DetailModal";
import { ImportModal } from "./ImportModal";
import { ManageModal } from "./ManageModal";
import { SourceIcon } from "./SourceIcon";

type Sort = "newest" | "oldest" | "title";
const PAGE = 60;

export function App() {
  const [meta, setMeta] = useState<CollectionsResponse>({ collections: [], total: 0, uncategorized: 0, sources: {} });
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [rowTags, setRowTags] = useState<Tag[]>([]);

  const [collection, setCollection] = useState("all");
  const [tag, setTag] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const [items, setItems] = useState<Bookmark[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addInitial, setAddInitial] = useState<AddInitial>({});
  const [importOpen, setImportOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const anyModal = detailId != null || addOpen || importOpen || manageOpen;

  /* ------------------------------ data loading ----------------------------- */

  const refreshMeta = useCallback(async () => {
    const [m, t] = await Promise.all([api.collections(), api.tags()]);
    setMeta(m);
    setAllTags(t);
  }, []);

  useEffect(() => {
    api.tags(collection === "all" ? undefined : collection).then(setRowTags).catch(() => {});
  }, [collection, allTags]);

  const params = useMemo(() => ({ collection, tag, source, q, sort }), [collection, tag, source, q, sort]);

  const load = useCallback(
    async (opts: { append?: boolean; keep?: number } = {}) => {
      const id = ++reqId.current;
      if (!opts.append && !opts.keep) setLoading(true);
      const offset = opts.append ? (nextOffset ?? 0) : 0;
      const limit = opts.keep ? Math.max(PAGE, opts.keep) : PAGE;
      try {
        const r = await api.list({ ...params, offset, limit });
        if (id !== reqId.current) return;
        setItems((prev) => (opts.append ? [...prev, ...r.items] : r.items));
        setTotal(r.total);
        setNextOffset(r.nextOffset);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [params, nextOffset],
  );

  // Reload when filters change.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    void refreshMeta();
  }, [refreshMeta]);

  // Deep link: ?b=<id> opens that bookmark; keep the URL in sync.
  useEffect(() => {
    const id = Number(new URLSearchParams(location.search).get("b"));
    if (id) setDetailId(id);
  }, []);
  useEffect(() => {
    const url = new URL(location.href);
    if (detailId != null) url.searchParams.set("b", String(detailId));
    else url.searchParams.delete("b");
    history.replaceState(null, "", url);
  }, [detailId]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 200);
    return () => clearTimeout(t);
  }, [qInput]);

  // Poll while background fetches are running.
  const hasPending = items.some((b) => b.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    const t = setTimeout(() => void load({ keep: items.length }), 2500);
    return () => clearTimeout(t);
  }, [hasPending, items, load]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || nextOffset == null) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && void load({ append: true }), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [nextOffset, load]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2500);
  };

  /* ------------------------ quick add: paste / drop / keys ------------------- */

  const openAdd = useCallback((init: AddInitial = {}) => {
    setAddInitial(init);
    setAddOpen(true);
  }, []);

  useEffect(() => {
    const typing = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

    const onPaste = (e: ClipboardEvent) => {
      if (anyModal || typing(e.target)) return;
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
      const text = e.clipboardData?.getData("text/plain")?.trim() || "";
      if (files.length) {
        e.preventDefault();
        openAdd({ tab: "write", files });
      } else if (text && isUrl(text)) {
        e.preventDefault();
        openAdd({ tab: "link", url: text });
      } else if (text) {
        e.preventDefault();
        openAdd({ tab: "write", content: text });
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (anyModal || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n" || e.key === "a") {
        e.preventDefault();
        openAdd({ tab: "link" });
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (anyModal) return;
      e.preventDefault();
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      setDragging(false);
      if (anyModal) return;
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
      const url = e.dataTransfer?.getData("text/uri-list") || e.dataTransfer?.getData("text/plain") || "";
      if (files.length) openAdd({ tab: "write", files });
      else if (isUrl(url.trim())) openAdd({ tab: "link", url: url.trim() });
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [anyModal, openAdd]);

  const defaultCollection = /^\d+$/.test(collection) ? Number(collection) : getLastCollection();

  const quickCreateCollection = async () => {
    const name = prompt("New collection name");
    if (!name?.trim()) return;
    const { id } = await api.createCollection({ name });
    await refreshMeta();
    setCollection(String(id));
    setTag(null);
  };

  const onChanged = useCallback((nb: Bookmark) => setItems((prev) => prev.map((b) => (b.id === nb.id ? nb : b))), []);
  const closeDetail = useCallback(() => setDetailId(null), []);

  const sourcesPresent = (Object.keys(SOURCE_LABELS) as Source[]).filter((s) => meta.sources[s]);
  const activeColl = meta.collections.find((c) => String(c.id) === collection);
  const filtered = tag || source || q;

  /* ---------------------------------- view --------------------------------- */

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 pb-16 sm:px-6">
      {/* Top bar */}
      <header className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center gap-3 bg-bg/85 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2 pr-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-black">
            <BookmarkIcon className="size-4 fill-black" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Stash</span>
        </div>

        <div className="relative order-last w-full sm:order-none sm:mx-auto sm:w-auto sm:min-w-[340px] sm:flex-1 sm:max-w-xl">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            ref={searchRef}
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setQInput(""), (e.target as HTMLInputElement).blur())}
            placeholder={`Search ${activeColl ? `in ${activeColl.name}` : "everything"}…`}
            className="h-10 w-full rounded-xl border border-white/[0.06] bg-card pr-16 pl-9 text-sm outline-none placeholder:text-zinc-500 focus:border-white/20"
          />
          <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded border border-white/10 px-1.5 text-[10px] text-zinc-500">Ctrl K</kbd>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <label className="flex h-10 items-center gap-1.5 rounded-xl border border-white/[0.06] bg-card px-3 text-sm text-zinc-300">
            <ArrowDownUp className="size-3.5 text-zinc-500" />
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-transparent outline-none">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title</option>
            </select>
          </label>
          <button onClick={() => setImportOpen(true)} className="btn-ghost h-10" title="Bulk import">
            <Download className="size-4" /> <span className="hidden md:inline">Import</span>
          </button>
          <button onClick={() => setManageOpen(true)} className="btn-ghost h-10" title="Organize collections & tags">
            <Settings2 className="size-4" /> <span className="hidden md:inline">Organize</span>
          </button>
          <button onClick={() => openAdd({ tab: "link" })} className="btn-primary h-10" title="Add (N) — or just paste anywhere">
            <Plus className="size-4" /> Add
          </button>
        </div>
      </header>

      {/* Collections */}
      <nav className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 py-2">
        <Pill active={collection === "all"} onClick={() => (setCollection("all"), setTag(null))} count={meta.total}>
          All
        </Pill>
        {meta.collections.map((c) => (
          <Pill
            key={c.id}
            active={collection === String(c.id)}
            color={c.color}
            onClick={() => (setCollection(String(c.id)), setTag(null))}
            count={c.count}
          >
            <span>{c.emoji}</span> {c.name}
          </Pill>
        ))}
        {meta.uncategorized > 0 && meta.collections.length > 0 && (
          <Pill active={collection === "none"} onClick={() => (setCollection("none"), setTag(null))} count={meta.uncategorized}>
            <span className="text-zinc-400">Unsorted</span>
          </Pill>
        )}
        <button onClick={quickCreateCollection} className="ml-1 flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-white/5 hover:text-zinc-200" title="New collection">
          <Plus className="size-4" />
        </button>
      </nav>

      {/* Sources + tags */}
      <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pt-1 pb-4">
        {sourcesPresent.map((s) => (
          <button
            key={s}
            onClick={() => setSource(source === s ? null : s)}
            title={`${SOURCE_LABELS[s]} (${meta.sources[s]})`}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition ${
              source === s ? "border-white/30 bg-white/10 text-white" : "border-white/[0.06] bg-card text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <SourceIcon source={s} /> {meta.sources[s]}
          </button>
        ))}
        {sourcesPresent.length > 0 && rowTags.length > 0 && <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />}
        {rowTags.map((t) => (
          <button
            key={t.id}
            onClick={() => setTag(tag === t.name ? null : t.name)}
            className={`h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition ${
              tag === t.name ? "bg-accent text-black" : "bg-card text-zinc-300 hover:bg-card-hover"
            }`}
          >
            #{t.name} <span className={tag === t.name ? "text-black/60" : "text-zinc-500"}>({t.count})</span>
          </button>
        ))}
      </div>

      {filtered && (
        <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
          <span>
            {total} result{total === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => (setTag(null), setSource(null), setQInput(""))}
            className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-xs hover:bg-white/10"
          >
            <X className="size-3" /> clear filters
          </button>
        </div>
      )}

      {/* Grid */}
      {loading && !items.length ? (
        <div className="flex flex-1 items-center justify-center py-24 text-zinc-500">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Empty filtered={!!filtered || collection !== "all"} onAdd={() => openAdd({ tab: "link" })} onImport={() => setImportOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((b) => (
            <BookmarkCard key={b.id} b={b} onOpen={() => setDetailId(b.id)} onTag={(t) => setTag(t)} />
          ))}
        </div>
      )}
      <div ref={sentinel} className="h-10" />

      {/* Modals */}
      <AddModal
        open={addOpen}
        initial={addInitial}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          flash("Saved ✓");
          void load();
          void refreshMeta();
        }}
        onOpenExisting={(id) => (setAddOpen(false), setDetailId(id))}
        collections={meta.collections}
        tags={allTags}
        defaultCollection={defaultCollection}
        refreshMeta={refreshMeta}
      />
      <DetailModal
        id={detailId}
        onClose={closeDetail}
        collections={meta.collections}
        tags={allTags}
        onChanged={onChanged}
        onDeleted={(id) => {
          setDetailId(null);
          setItems((prev) => prev.filter((b) => b.id !== id));
          setTotal((t) => t - 1);
          void refreshMeta();
          flash("Deleted");
        }}
        refreshMeta={refreshMeta}
      />
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => (void load(), void refreshMeta())}
        collections={meta.collections}
        tags={allTags}
        refreshMeta={refreshMeta}
      />
      <ManageModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        collections={meta.collections}
        tags={allTags}
        refresh={async () => {
          await refreshMeta();
          void load();
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-3 z-40 flex items-center justify-center rounded-3xl border-2 border-dashed border-accent/70 bg-accent/5 text-lg font-medium text-accent">
          Drop images or a link to save
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-black shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  count,
  color = "#22c55e",
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={active ? { backgroundColor: color, color: "#04130a" } : undefined}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition ${
        active ? "shadow-lg" : "text-zinc-300 hover:bg-white/5"
      }`}
    >
      {children}
      <span className={active ? "opacity-60" : "text-zinc-500"}>({count})</span>
    </button>
  );
}

function Empty({ filtered, onAdd, onImport }: { filtered: boolean; onAdd: () => void; onImport: () => void }) {
  if (filtered) return <div className="py-24 text-center text-zinc-500">Nothing here yet.</div>;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <BookmarkIcon className="size-6" />
      </div>
      <h2 className="text-xl font-semibold">Your stash is empty</h2>
      <p className="text-sm leading-relaxed text-zinc-400">
        Paste a link or an image anywhere on this page (<kbd className="kbd">Ctrl V</kbd>), drag files in, press <kbd className="kbd">N</kbd>, or
        bulk-import your X bookmarks &amp; YouTube Watch Later.
      </p>
      <div className="flex gap-2">
        <button onClick={onAdd} className="btn-primary">
          <Plus className="size-4" /> Add bookmark
        </button>
        <button onClick={onImport} className="btn-ghost">
          <Download className="size-4" /> Import
        </button>
      </div>
    </div>
  );
}
