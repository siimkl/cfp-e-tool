begin;

-- Preserve retired initiative facts and their private provenance before
-- removing them from the active announcement model.
create table public.retired_initiatives (
  original_id uuid primary key,
  item jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  retired_at timestamptz not null default now()
);

alter table public.retired_initiatives enable row level security;
revoke all on public.retired_initiatives from anon, authenticated;
grant all on public.retired_initiatives to service_role;

insert into public.retired_initiatives(original_id, item, sources)
select
  initiative.id,
  to_jsonb(initiative),
  coalesce(
    (
      select jsonb_agg(to_jsonb(source) order by source.created_at)
      from public.item_sources source
      where source.item_id = initiative.id
    ),
    '[]'::jsonb
  )
from public.items initiative
where initiative.item_type = 'INITIATIVE';

delete from public.items where item_type = 'INITIATIVE';

alter table public.items drop constraint items_item_type_check;
alter table public.items
  add constraint items_item_type_check check (item_type in ('CFP', 'EVENT'));

alter table public.items drop constraint dates_match_type;
alter table public.items
  add constraint dates_match_type check (
    (item_type = 'CFP' and event_start is null and event_end is null) or
    (item_type = 'EVENT' and deadline is null)
  );

drop index if exists public.items_archived_idx;
alter table public.items drop column archived;

comment on table public.retired_initiatives is
  'Private recovery snapshot of initiatives retired when the active model was simplified to CFPs and events.';
comment on table public.items is
  'Internal shared CFP and event workspace. Anyone with the application URL can maintain announcement records; email provenance remains private.';

commit;
