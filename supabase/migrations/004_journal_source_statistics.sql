begin;
-- Identify journals through each email's actual announcement provenance, not
-- through its publisher domain or shared mailing-list sender.
create or replace function public.source_statistics()
returns table (source_name text, source_domain text, source_kind text, email_count bigint, first_received_at timestamptz, last_received_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with journal_receipts as (
    select distinct r.message_id,
      lower(regexp_replace(trim(i.journal), '\s+', ' ', 'g')) as journal_key,
      regexp_replace(trim(i.journal), '\s+', ' ', 'g') as journal_name,
      r.source_domain, r.received_at
    from public.source_receipts r
    join public.item_sources s on s.message_id = r.message_id
    join public.items i on i.id = s.item_id
    where r.classification = 'DIRECT' and nullif(trim(i.journal), '') is not null
  ), grouped as (
    select min(j.journal_name) as source_name,
      string_agg(distinct j.source_domain, ', ' order by j.source_domain) as source_domain,
      'JOURNAL'::text as source_kind, count(distinct j.message_id) as email_count,
      min(j.received_at) as first_received_at, max(j.received_at) as last_received_at,
      'journal:' || j.journal_key as stable_key
    from journal_receipts j group by j.journal_key
    union all
    select min(r.source_name), min(r.source_domain), min(r.source_kind),
      count(distinct r.message_id), min(r.received_at), max(r.received_at), r.source_key
    from public.source_receipts r
    where r.classification = 'DIRECT'
      and not exists (select 1 from journal_receipts j where j.message_id = r.message_id)
    group by r.source_key
  )
  select g.source_name, g.source_domain, g.source_kind, g.email_count, g.first_received_at, g.last_received_at
  from grouped g
  order by (g.source_kind = 'JOURNAL') desc, g.email_count desc, g.source_name, g.stable_key;
$$;
commit;
