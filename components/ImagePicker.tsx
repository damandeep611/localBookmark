"use client";
import { useEffect, useMemo, useRef } from "react";
import { ImagePlus, X } from "lucide-react";

/** Multi-image picker with previews. Supports click, drag-drop and paste (handled by parent). */
export function ImagePicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
        if (dropped.length) onChange([...files, ...dropped]);
      }}
      className="rounded-lg border border-dashed border-white/15 bg-black/20 p-2"
    >
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <div key={urls[i]} className="group relative size-20 overflow-hidden rounded-md bg-black/40">
            {f.type.startsWith("video/") ? (
              <video src={urls[i]} className="size-full object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[i]} alt="" className="size-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white opacity-0 group-hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-white/10 text-xs text-zinc-400 hover:border-white/25 hover:text-zinc-200"
        >
          <ImagePlus className="size-5" />
          Add
        </button>
      </div>
      {files.length === 0 && <p className="mt-2 px-1 text-xs text-zinc-500">Drop, paste (Ctrl+V) or click to add images.</p>}
      <input
        ref={input}
        type="file"
        accept="image/*,video/mp4"
        multiple
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          if (picked.length) onChange([...files, ...picked]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
