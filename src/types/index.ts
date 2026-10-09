export type ItemType = 'CFP' | 'EVENT';
export type EventMode = 'IN_PERSON' | 'ONLINE' | 'HYBRID' | 'UNKNOWN';
export interface ItemInput {
  item_type: ItemType;
  title: string;
  category: string;
  journal: string | null;
  organiser: string | null;
  summary: string | null;
  deadline: string | null;
  event_start: string | null;
  event_end: string | null;
  event_mode: EventMode;
  location: string | null;
  homepage_url: string | null;
  topics: string[];
}
export interface Item extends ItemInput {
  id: string;
  source_type: 'EMAIL' | 'MANUAL';
  archived: boolean;
  created_at: string;
  updated_at: string;
  dedupe_key?: string | null;
}
export interface Source {
  id: string;
  source_excerpt: string | null;
  extraction_confidence: number | null;
  processed_emails: {
    sender: string | null;
    subject: string | null;
    received_at: string;
  } | null;
}
