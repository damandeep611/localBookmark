"use client";
import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Tag } from "@/lib/types";

const clean = (s: string) => s.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase();

/** Chip input: type to search existing tags, Enter / comma creates a new one. */
export function TagInput({
  value,
  onChange,
  allTags,
  placeholder = "Add tags…",
  autoFocus,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  allTags: Tag[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = clean(text);
  const suggestions = useMemo(() => {
    const list = allTags.filter((t) => !value.includes(t.name) && (!q || t.name.includes(q)));
    list.sort((a, b) => Number(b.name.startsWith(q)) - Number(a.name.startsWith(q)) || b.count - a.count);
    return list.slice(0, 8);
  }, [allTags, value, q]);
  const exact = allTags.some((t) => t.name === q);
  const options: { name: string; isNew: boolean; count?: number }[] = [
    ...suggestions.map((t) => ({ name: t.name, isNew: false, count: t.count })),
    ...(q && !exact && !value.includes(q) ? [{ name: q, isNew: true }] : []),
  ];

  const add = (name: string) => {
    const n = clean(name);
    if (n && !value.includes(n)) onChange([...value, n]);
    setText("");
    setHi(0);
  };

  return (
    <div className="relative">
      <div
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 focus-within:border-accent/60"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-xs text-zinc-200">
            #{t}
            <button
              type="button"
              className="text-zinc-400 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((x) => x !== t));
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v.slice(0, -1));
            else {
              setText(v);
              setHi(0);
            }
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (text.trim() || options.length) && text.trim()) {
              e.preventDefault();
              e.stopPropagation();
              add(options[hi]?.name ?? text);
            } else if (e.key === "Tab" && text.trim() && options[hi]) {
              e.preventDefault();
              add(options[hi].name);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(h + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(h - 1, 0));
            }
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-zinc-500"
        />
      </div>
      {focus && options.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-xl">
          {options.map((o, i) => (
            <button
              type="button"
              key={o.name + o.isNew}
              onMouseDown={(e) => {
                e.preventDefault();
                add(o.name);
              }}
              onMouseEnter={() => setHi(i)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${i === hi ? "bg-white/10" : ""}`}
            >
              <span>{o.isNew ? <>Create <b>#{o.name}</b></> : <>#{o.name}</>}</span>
              {!o.isNew && <span className="text-xs text-zinc-500">{o.count}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
