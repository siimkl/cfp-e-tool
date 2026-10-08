begin;
create table public.source_receipts (
  message_id text primary key,
  source_key text,
  source_name text,
  source_domain text,
  source_kind text check (source_kind in ('LIST', 'NEWSLETTER')),
  classification text not null check (classification in ('DIRECT', 'FORWARDED', 'UNKNOWN')),
  received_at timestamptz not null,
  checked_at timestamptz not null default now(),
  check (classification <> 'DIRECT' or (source_key is not null and source_name is not null and source_domain is not null and source_kind is not null))
);
alter table public.source_receipts enable row level security;
revoke all on public.source_receipts from public, anon, authenticated;
grant all on public.source_receipts to service_role;

-- Only aggregate source identity/counts are public; message IDs remain private.
create function public.source_statistics()
returns table (source_name text, source_domain text, source_kind text, email_count bigint, first_received_at timestamptz, last_received_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select min(r.source_name), min(r.source_domain), min(r.source_kind), count(*), min(r.received_at), max(r.received_at)
  from public.source_receipts r
  where r.classification = 'DIRECT'
  group by r.source_key
  order by count(*) desc, min(r.source_name), r.source_key;
$$;
revoke all on function public.source_statistics() from public;
grant execute on function public.source_statistics() to anon, authenticated, service_role;
comment on table public.source_receipts is 'Private idempotent receipt ledger. No email body, subject or staff address retained. Ambiguous/forwarded messages excluded from public source counts.';
commit;
