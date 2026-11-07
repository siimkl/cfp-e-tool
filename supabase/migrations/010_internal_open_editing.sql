begin;

-- Keep this migration self-contained for installations that have not yet run 009.
alter table public.items
  add column if not exists highlighted boolean not null default false;

create index if not exists items_highlighted_idx
  on public.items(highlighted)
  where highlighted = true;

alter table public.items alter column created_by drop default;

grant select, insert, update, delete on public.items to anon, authenticated;
revoke all on public.processed_emails, public.item_sources, public.automation_runs
  from anon, authenticated;

drop policy if exists public_items on public.items;
drop policy if exists staff_read on public.items;
drop policy if exists staff_insert on public.items;
drop policy if exists staff_update on public.items;
drop policy if exists staff_delete on public.items;
drop policy if exists staff_email_read on public.processed_emails;
drop policy if exists staff_source_read on public.item_sources;
drop policy if exists staff_run_read on public.automation_runs;
drop policy if exists internal_items_read on public.items;
drop policy if exists internal_items_insert on public.items;
drop policy if exists internal_items_update on public.items;
drop policy if exists internal_items_delete on public.items;

create policy internal_items_read on public.items
  for select to anon, authenticated using (true);

create policy internal_items_insert on public.items
  for insert to anon, authenticated
  with check (source_type = 'MANUAL' and created_by is null);

create policy internal_items_update on public.items
  for update to anon, authenticated using (true) with check (true);

create policy internal_items_delete on public.items
  for delete to anon, authenticated using (true);

comment on table public.items is
  'Internal shared workspace. Anyone with the application URL can read and maintain announcement records; email provenance remains private.';

commit;
