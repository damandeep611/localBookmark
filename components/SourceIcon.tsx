import { Globe, PenLine } from "lucide-react";
import type { Source } from "@/lib/sources";

export function SourceIcon({ source, className = "size-3.5" }: { source: Source | string; className?: string }) {
  switch (source) {
    case "x":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-label="X">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-label="YouTube">
          <rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#ff0033" />
          <path d="M10 8.8v6.4l5.5-3.2z" fill="#fff" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#e1306c" strokeWidth="2" aria-label="Instagram">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="#e1306c" stroke="none" />
        </svg>
      );
    case "reddit":
      return <Badge className={className} bg="#ff4500" label="r" />;
    case "github":
      return <Badge className={className} bg="#6e7681" label="gh" />;
    case "linkedin":
      return <Badge className={className} bg="#0a66c2" label="in" />;
    case "pinterest":
      return <Badge className={className} bg="#e60023" label="P" />;
    case "manual":
      return <PenLine className={className} aria-label="Manual" />;
    default:
      return <Globe className={className} aria-label="Web" />;
  }
}

function Badge({ bg, label, className }: { bg: string; label: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label={label}>
      <rect width="24" height="24" rx="6" fill={bg} />
      <text x="12" y="16.5" textAnchor="middle" fontSize={label.length > 1 ? 11 : 14} fontWeight="700" fill="#fff" fontFamily="system-ui">
        {label}
      </text>
    </svg>
  );
}
