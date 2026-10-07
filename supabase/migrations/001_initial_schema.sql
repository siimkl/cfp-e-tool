begin;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('CFP', 'EVENT')),
  title text not null check (length(trim(title)) between 1 and 500),
  journal text,
  organiser text,
  summary text,
  deadline date,
  event_start date,
  event_end date,
  event_mode text not null default 'UNKNOWN' check (event_mode in ('IN_PERSON', 'ONLINE', 'HYBRID', 'UNKNOWN')),
  location text,
  homepage_url text check (homepage_url is null or homepage_url ~* '^https?://[^[:space:]@]+$'),
  topics text[] not null default '{}',
  source_type text not null default 'MANUAL' check (source_type in ('EMAIL', 'MANUAL')),
  dedupe_key text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  constraint sensible_event_dates check (event_end is null or (event_start is not null and event_end >= event_start)),
  constraint dates_match_type check ((item_type = 'CFP' and event_start is null and event_end is null) or (item_type = 'EVENT' and deadline is null))
);
create index items_type_idx on public.items(item_type);
create index items_deadline_idx on public.items(deadline);
create index items_event_start_idx on public.items(event_start);
create index items_created_at_idx on public.items(created_at desc);
create index items_archived_idx on public.items(archived);
create unique index items_dedupe_idx on public.items(dedupe_key) where dedupe_key is not null;

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger items_updated_at before update on public.items for each row execute function public.touch_updated_at();

create table public.processed_emails (
  message_id text primary key,
  thread_id text,
  sender text,
  subject text,
  received_at timestamptz not null,
  processing_status text not null check (processing_status in ('PROCESSING', 'SUCCESS', 'NO_ITEMS', 'ERROR', 'PERMANENT_ERROR')),
  attempts integer not null default 0 check (attempts >= 0),
  extracted_count integer not null default 0 check (extracted_count >= 0),
  error_message text,
  processed_at timestamptz
);
create table public.item_sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  message_id text not null references public.processed_emails(message_id) on delete cascade,
  source_url text,
  source_excerpt text check (length(source_excerpt) <= 500),
  extraction_confidence numeric check (extraction_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique(item_id, message_id)
);
create index item_sources_message_idx on public.item_sources(message_id);
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  emails_seen integer not null default 0,
  emails_processed integer not null default 0,
  items_created integer not null default 0,
  duplicates_found integer not null default 0,
  errors integer not null default 0,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'SUCCESS', 'PARTIAL', 'ERROR'))
);

alter table public.items enable row level security;
alter table public.processed_emails enable row level security;
alter table public.item_sources enable row level security;
alter table public.automation_runs enable row level security;

-- Explicit grants also work on projects with permissive default privileges.
revoke all on public.items, public.processed_emails, public.item_sources, public.automation_runs from anon, authenticated;
grant select on public.items to anon;
grant select, insert, update, delete on public.items to authenticated;
grant select on public.processed_emails, public.item_sources, public.automation_runs to authenticated;
grant all on public.items, public.processed_emails, public.item_sources, public.automation_runs to service_role;

create policy public_items on public.items for select to anon using (archived = false);
create policy staff_read on public.items for select to authenticated using (true);
create policy staff_insert on public.items for insert to authenticated with check (source_type = 'MANUAL' and created_by = (select auth.uid()));
create policy staff_update on public.items for update to authenticated using (true) with check (true);
create policy staff_delete on public.items for delete to authenticated using (true);
create policy staff_email_read on public.processed_emails for select to authenticated using (true);
create policy staff_source_read on public.item_sources for select to authenticated using (true);
create policy staff_run_read on public.automation_runs for select to authenticated using (true);

comment on table public.items is 'Public announcement facts only. Never put email bodies or sender metadata here.';
comment on table public.processed_emails is 'Private per-message processing ledger. Raw email bodies are never retained.';
commit;
