"use client";
import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Modal } from "./Modal";
import { Field } from "./AddModal";
import { CollectionSelect } from "./CollectionSelect";
import { TagInput } from "./TagInput";
import { api } from "@/lib/client";
import type { Collection, Tag } from "@/lib/types";

type Kind = "twitter" | "youtube" | "urls";

const HELP: Record<Kind, React.ReactNode> = {
  twitter: (
    <>
      <p>
        Install the{" "}
        <a className="link" href="https://github.com/prinsss/twitter-web-exporter" target="_blank" rel="noreferrer">
          twitter-web-exporter
        </a>{" "}
        userscript (via Tampermonkey), open <code>x.com/i/bookmarks</code>, scroll to the very bottom so everything loads, then export
        <b> Bookmarks → JSON</b>. Upload that file here.
      </p>
      <p className="mt-1">Tweet text is imported immediately; images are downloaded to your disk in the background.</p>
    </>
  ),
  youtube: (
    <>
      <p>Run this (Chrome logged into YouTube; swap browser if needed):</p>
      <pre className="mt-1 overflow-x-auto rounded bg-black/50 p-2 text-[11px]">
        yt-dlp --flat-playlist -J --cookies-from-browser chrome &quot;https://www.youtube.com/playlist?list=WL&quot; &gt; watch_later.json
      </pre>
      <p className="mt-1">Works for any playlist URL too. Upload the resulting JSON.</p>
    </>
  ),
  urls: <p>Paste any text containing links — one per line, a CSV, Markdown, an exported note. Each link is fetched in the background.</p>,
};

export function ImportModal({
  open,
  onClose,
  onDone,
  collections,
  tags,
  refreshMeta,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  collections: Collection[];
  tags: Tag[];
  refreshMeta: () => Promise<void>;
}) {
  const [kind, setKind] = useState<Kind>("twitter");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [tagList, setTagList] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      if (file) fd.set("file", file);
      else fd.set("text", text);
      if (collectionId) fd.set("collectionId", String(collectionId));
      fd.set("tags", JSON.stringify(tagList));
      const r = await api.import(fd);
      setResult(`Found ${r.found} · imported ${r.created} · skipped ${r.skipped} already saved.`);
      setFile(null);
      setText("");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-xl">
      <div className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-semibold">Bulk import</h2>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/40 p-1 text-sm">
          {(
            [
              ["twitter", "X bookmarks"],
              ["youtube", "YouTube playlist"],
              ["urls", "List of links"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => (setKind(k), setResult(null), setError(null))}
              className={`rounded-md px-2 py-1.5 ${kind === k ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3 text-xs leading-relaxed text-zinc-400">{HELP[kind]}</div>

        <Field label={kind === "urls" ? "File or pasted text" : "Export file (.json)"}>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-3 text-sm text-zinc-300 hover:border-white/30">
            <Upload className="size-4 text-zinc-500" />
            <span className="truncate">{file ? file.name : "Choose file…"}</span>
            <input type="file" accept=".json,.jsonl,.txt,.csv,.md,.html" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {!file && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder={kind === "urls" ? "https://…\nhttps://…" : "…or paste the JSON here"}
              className="input mt-2 font-mono text-xs"
            />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Put into collection">
            <CollectionSelect value={collectionId} onChange={setCollectionId} collections={collections} onCreated={refreshMeta} />
          </Field>
          <Field label="Add tags to all">
            <TagInput value={tagList} onChange={setTagList} allTags={tags} />
          </Field>
        </div>

        {result && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{result}</div>}
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            Close
          </button>
          <button onClick={run} disabled={busy || (!file && !text.trim())} className="btn-primary">
            {busy && <Loader2 className="size-4 animate-spin" />} Import
          </button>
        </div>
      </div>
    </Modal>
  );
}
