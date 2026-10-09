import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const configurationReady =
  /^https:\/\/[^/]+/.test(url) &&
  key.startsWith('sb_publishable_') &&
  !/YOUR_/.test(url + key);
export const supabase = configurationReady ? createClient(url, key) : null;
export const publicItemColumns =
  'id,item_type,title,category,journal,organiser,summary,deadline,event_start,event_end,event_mode,location,homepage_url,topics,archived,created_at,updated_at,source_type';
