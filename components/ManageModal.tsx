"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { api } from "@/lib/client";
import type { Collection, Tag } from "@/lib/types";

const COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#f97316", "#eab308", "#14b8a6", "#64748b"];

export function ManageModal({
  open,
  onClose,
  collections,
  tags,
  refresh,
}: {
  open: boolean;
  onClose: () => void;
  collections: Collection[];
  tags: Tag[];
  refresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"collections" | "tags">("collections");
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📁");
  const [err, setErr] = useState<string | null>(null);

  const wrap = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const shownTags = tags.filter((t) => t.name.includes(q.trim().toLowerCase().replace(/^#/, "")));

  return (
    <Modal open={open} onClose={onClose} className="max-w-xl">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Organize</h2>
          <div className="flex gap-1 rounded-lg bg-black/40 p-1 text-sm">
            {(["collections", "tags"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1 capitalize ${tab === t ? "bg-white/10 text-white" : "text-zinc-400"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Edit names inline (saved when you leave the field). Renaming to an existing name <b>merges</b> them.
        </p>

        {tab === "collections" ? (
          <div className="flex flex-col gap-2">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newName.trim()) return;
                void wrap(async () => {
                  await api.createCollection({ name: newName, emoji: newEmoji, color: COLORS[collections.length % COLORS.length] });
                  setNewName("");
                  setNewEmoji("📁");
                });
              }}
            >
              <input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} className="input w-14 text-center" maxLength={4} />
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New collection name" className="input flex-1" />
              <button className="btn-primary" type="submit">
                <Plus className="size-4" /> Add
              </button>
            </form>
            <div className="max-h-[50vh] overflow-y-auto">
              {collections.map((c) => (
                <div key={`${c.id}-${c.name}-${c.emoji}-${c.color}`} className="flex items-center gap-2 border-b border-white/[0.05] py-2">
                  <input
                    defaultValue={c.emoji}
                    maxLength={4}
                    onBlur={(e) => e.target.value !== c.emoji && wrap(() => api.updateCollection(c.id, { emoji: e.target.value }))}
                    className="input w-12 text-center"
                  />
                  <input
                    defaultValue={c.name}
                    onBlur={(e) => e.target.value.trim() !== c.name && wrap(() => api.updateCollection(c.id, { name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="input flex-1"
                  />
                  <input
                    type="color"
                    defaultValue={c.color}
                    onBlur={(e) => e.target.value !== c.color && wrap(() => api.updateCollection(c.id, { color: e.target.value }))}
                    className="h-9 w-9 cursor-pointer rounded border border-white/10 bg-transparent"
                    title="Color"
                  />
                  <span className="w-10 text-right text-xs text-zinc-500">{c.count}</span>
                  <button
                    onClick={() =>
                      confirm(`Delete collection "${c.name}"? Its ${c.count} bookmarks are kept (moved to Unsorted).`) &&
                      wrap(() => api.deleteCollection(c.id))
                    }
                    className="icon-btn text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {!collections.length && <p className="py-6 text-center text-sm text-zinc-500">No collections yet.</p>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tags…" className="input" />
            <div className="max-h-[50vh] overflow-y-auto">
              {shownTags.map((t) => (
                <div key={`${t.id}-${t.name}`} className="flex items-center gap-2 border-b border-white/[0.05] py-2">
                  <span className="text-zinc-500">#</span>
                  <input
                    defaultValue={t.name}
                    onBlur={(e) => e.target.value.trim().toLowerCase() !== t.name && wrap(() => api.renameTag(t.id, e.target.value))}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="input flex-1"
                  />
                  <span className="w-10 text-right text-xs text-zinc-500">{t.count}</span>
                  <button
                    onClick={() => confirm(`Delete #${t.name}? It's removed from ${t.count} bookmarks.`) && wrap(() => api.deleteTag(t.id))}
                    className="icon-btn text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {!shownTags.length && <p className="py-6 text-center text-sm text-zinc-500">No tags. Create them while adding bookmarks.</p>}
            </div>
          </div>
        )}
        {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</div>}
      </div>
    </Modal>
  );
}
