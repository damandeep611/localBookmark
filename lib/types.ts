import type { BookmarkType, Source } from "./sources";

export type Collection = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  position: number;
  count: number;
};

export type Tag = { id: number; name: string; count: number };

export type Media = {
  id: number;
  kind: "image" | "video";
  src: string; // URL usable in <img>
  videoUrl: string | null;
};

export type Bookmark = {
  id: number;
  type: BookmarkType;
  source: Source;
  url: string | null;
  title: string;
  description: string;
  content: string;
  notes: string;
  author: string;
  authorHandle: string;
  authorAvatar: string;
  siteName: string;
  collectionId: number | null;
  status: "pending" | "ready" | "failed";
  error: string;
  meta: Record<string, unknown>;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  media: Media[];
};

export type ListResponse = { items: Bookmark[]; total: number; nextOffset: number | null };
