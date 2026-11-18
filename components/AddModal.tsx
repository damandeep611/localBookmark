"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Link2, Loader2 } from "lucide-react";
import { Modal } from "./Modal";
import { TagInput } from "./TagInput";
import { CollectionSelect } from "./CollectionSelect";
import { ImagePicker } from "./ImagePicker";
import { SourceIcon } from "./SourceIcon";
import { api, setLastCollection } from "@/lib/client";
import { detect, isUrl, SOURCE_LABELS, type Source } from "@/lib/sources";
import type { Collection, Tag } from "@/lib/types";

export type AddInitial = { tab?: "link" | "write"; url?: string; content?: string; files?: File[] };

const SOURCES = Object.keys(SOURCE_LABELS) as Source[];

export function AddModal({
  open,
  initial,
  onClose,
  onSaved,
  collections,
  tags,
  defaultCollection,
  refreshMeta,
  onOpenExisting,
}: {
  open: boolean;
  initial: AddInitial;
  onClose: () => void;
  onSaved: (id: number) => void;
  collections: Collection[];
  tags: Tag[];
  defaultCollection: number | null;
  refreshMeta: () => Promise<void>;
  onOpenExisting: (id: number) => void;
}) {
  const [tab, setTab] = useState<"link" | "write">("link");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState<Source | "">("");
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [tagList, setTagList] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; existingId?: number } | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  // Reset form every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setTab(initial.tab ?? (initial.files?.length || initial.content ? "write" : "link"));
    setUrl(initial.url ?? "");
    setTitle("");
    setContent(initial.content ?? "");
    setNotes("");
    setFiles(initial.files ?? []);
    setSource("");
    setCollectionId(defaultCollection);
    setTagList([]);
    setError(null);
  }, [open, initial, defaultCollection]);

  // Paste images straight into the open modal.
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const imgs = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
      if (imgs.length) {
        e.preventDefault();
        setFiles((f) => [...f, ...imgs]);
        setTab("write");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]);

  const detected = url && isUrl(url) ? detect(url) : null;

  const save = async () => {
    if (busy) return;
    setError(null);
    const fd = new FormData();
    if (tab === "link") {
      if (!detected) return setError({ msg: "Paste a valid link (https://…)" });
      fd.set("url", url.trim());
      if (notes.trim()) fd.set("notes", notes);
      if (source) fd.set("source", source);
    } else {
      if (!content.trim() && !files.length && !title.trim()) return setError({ msg: "Write something or add an image" });
      if (url.trim()) {
        if (!detected) return setError({ msg: "The reference link isn't a valid URL" });
        fd.set("url", url.trim());
      }
      fd.set("title", title);
      fd.set("content", content);
      fd.set("source", source || (detected?.source ?? "manual"));
      files.forEach((f) => fd.append("files", f));
    }
    if (collectionId) fd.set("collectionId", String(collectionId));
    fd.set("tags", JSON.stringify(tagList));
    setBusy(true);
    try {
      const { id } = await api.create(fd);
      setLastCollection(collectionId);
      onSaved(id);
    } catch (e) {
      const err = e as Error & { existingId?: number };
      setError({ msg: err.message, existingId: err.existingId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void save();
          }
        }}
        className="flex flex-col gap-4 p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-black/40 p-1">
            <TabBtn active={tab === "link"} onClick={() => setTab("link")}>
              <Link2 className="size-4" /> Link
            </TabBtn>
            <TabBtn active={tab === "write"} onClick={() => setTab("write")}>
              <FileText className="size-4" /> Write / Images
            </TabBtn>
          </div>
          <span className="text-xs text-zinc-500">Ctrl+Enter to save</span>
        </div>

        {tab === "link" ? (
          <>
            <Field label="Link">
              <div className="relative">
                <input
                  ref={urlRef}
                  autoFocus
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://x.com/… · youtube.com/… · any URL"
                  className="input pr-28"
                />
                {detected && (
                  <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1.5 rounded-md bg-white/10 px-2 py-0.5 text-xs text-zinc-300">
                    <SourceIcon source={source || detected.source} /> {SOURCE_LABELS[source || detected.source]}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">Title, text and images are fetched in the background — you can keep adding.</p>
            </Field>
            <Field label="Note (optional)">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Why did you save this?" className="input resize-y" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Title (optional)">
              <input autoFocus={!initial.content} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give it a name" className="input" />
            </Field>
            <Field label="Content">
              <textarea
                autoFocus={!!initial.content}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="Paste the post text, a quote, your summary…"
                className="input resize-y leading-relaxed"
              />
            </Field>
            <Field label="Images">
              <ImagePicker files={files} onChange={setFiles} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Reference link (optional)">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="input" />
              </Field>
              <Field label="Saved from">
                <SourceSelect value={source || detected?.source || "manual"} onChange={setSource} />
              </Field>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Collection">
            <CollectionSelect value={collectionId} onChange={setCollectionId} collections={collections} onCreated={refreshMeta} />
          </Field>
          {tab === "link" && (
            <Field label="Saved from">
              <SourceSelect value={source || detected?.source || "web"} onChange={setSource} />
            </Field>
          )}
        </div>
        <Field label="Tags">
          <TagInput value={tagList} onChange={setTagList} allTags={tags} />
        </Field>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error.msg}
            {error.existingId && (
              <button type="button" className="ml-2 underline" onClick={() => onOpenExisting(error.existingId!)}>
                Open it
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy && <Loader2 className="size-4 animate-spin" />} Save bookmark
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SourceSelect({ value, onChange }: { value: Source; onChange: (s: Source) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Source)} className="input h-10">
      {SOURCES.map((s) => (
        <option key={s} value={s}>
          {SOURCE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${active ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">{label}</span>
      {children}
    </div>
  );
}
