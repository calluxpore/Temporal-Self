export interface Memory {
  id: string;
  lat: number;
  lng: number;
  title: string;
  date: string;
  notes: string;
  /** @deprecated Use imageDataUrls; first image is imageDataUrls?.[0] ?? imageDataUrl */
  imageDataUrl?: string | null;
  /** Multiple images per memory (data URLs). When set, imageDataUrl is ignored for display. */
  imageDataUrls?: string[];
  createdAt: string;
  /** Optional for backward compatibility with saved data; treat missing as null. */
  groupId?: string | null;
  /** When true, memory is hidden from the map (still in sidebar, greyed). */
  hidden?: boolean;
  /** Order within group (or ungrouped). Lower = first. Used for sidebar and map label order. */
  order?: number;
  /** Custom icon/emoji label (1–3 chars). When set, overrides the default A/B/C label on sidebar and map. */
  customLabel?: string | null;
  /** Tags for filtering (e.g. "food", "travel", "family"). */
  tags?: string[];
  /** When true, memory appears in Favorites quick-access. */
  starred?: boolean;
  /** Attached URLs (articles, songs, places). */
  links?: string[];
  /** Spaced repetition: next time to ask "do you remember?" (ISO string). When missing, treat as due for review. */
  nextReviewAt?: string | null;
  /** Number of successful repetitions (SM-2: used for interval I(1), I(2), I(n)). */
  reviewCount?: number;
  /** SM-2: last interval in days (for n>2: next = intervalDays × easeFactor). */
  intervalDays?: number;
  /** SM-2: ease factor (1.3–2.5). Default 2.5 for new items. */
  easeFactor?: number;
  /** Number of times user clicked "Show me" (failed recall) in practice. */
  failedReviewCount?: number;
}

export interface Group {
  id: string;
  name: string;
  collapsed: boolean;
  /** When true, group and its memories are hidden from the map. */
  hidden?: boolean;
}

export interface PendingLatLng {
  lat: number;
  lng: number;
}
