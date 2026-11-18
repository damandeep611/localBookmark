"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import type { Collection } from "@/lib/types";
import { api } from "@/lib/client";

/** Dropdown with search; typing a new name offers "Create collection". */
export function CollectionSelect({
  value,
  onChange,
  collections,
  onCreated,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  collections: Collection[];
  onCreated: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = collections.find((c) => c.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(
    () => collections.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())),
    [collections, q],
  );
  const exact = collections.some((c) => c.name.toLowerCase() === q.trim().toLowerCase());

  const create = async () => {
    const name = q.trim();
    if (!name) return;
    setBusy(true);
    try {
      const { id } = await api.createCollection({ name });
      await onCreated();
      onChange(id);
      setOpen(false);
      setQ("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 text-sm hover:border-white/20"
      >
        <span className={current ? "" : "text-zinc-500"}>{current ? `${current.emoji} ${current.name}` : "No collection"}</span>
        <ChevronDown className="size-4 text-zinc-500" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                if (filtered.length === 1 && q) {
                  onChange(filtered[0].id);
                  setOpen(false);
                  setQ("");
                } else if (q.trim() && !exact) void create();
              }
            }}
            placeholder="Search or create…"
            className="mb-1 w-full rounded-md bg-black/40 px-2 py-1.5 text-sm outline-none placeholder:text-zinc-500"
          />
          <div className="max-h-56 overflow-auto">
            <Item active={value === null} onClick={() => (onChange(null), setOpen(false))}>
              <span className="text-zinc-400">No collection</span>
            </Item>
            {filtered.map((c) => (
              <Item key={c.id} active={value === c.id} onClick={() => (onChange(c.id), setOpen(false), setQ(""))}>
                {c.emoji} {c.name}
              </Item>
            ))}
            {q.trim() && !exact && (
              <button
                type="button"
                disabled={busy}
                onClick={create}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-accent hover:bg-white/10"
              >
                <Plus className="size-4" /> Create “{q.trim()}”
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Item({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10">
      <span>{children}</span>
      {active && <Check className="size-4 text-accent" />}
    </button>
  );
}
