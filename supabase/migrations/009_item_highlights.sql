begin;

alter table public.items
  add column highlighted boolean not null default false;

create index items_highlighted_idx
  on public.items(highlighted)
  where highlighted = true;

comment on column public.items.highlighted is
  'Staff-curated flag for visually emphasising and filtering announcements.';

commit;
