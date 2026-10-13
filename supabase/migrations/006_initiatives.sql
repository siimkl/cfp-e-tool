begin;
alter table public.items drop constraint items_item_type_check;
alter table public.items add constraint items_item_type_check check (item_type in ('CFP','EVENT','INITIATIVE'));
alter table public.items drop constraint dates_match_type;
alter table public.items add constraint dates_match_type check (
 (item_type='CFP' and event_start is null and event_end is null) or
 (item_type='EVENT' and deadline is null) or
 (item_type='INITIATIVE' and deadline is null and event_start is null and event_end is null)
);
-- First initiative, supplied by the application owner from an announcement.
insert into public.items(item_type,title,organiser,summary,homepage_url,topics,category,source_type,dedupe_key)
values ('INITIATIVE','DigiLabour: new research lab website','DigiLabour · University of Toronto',
'DigiLabour announces its new website as a research lab at the University of Toronto. The lab studies labour and technology, focusing on intersectional inequalities, worker-led tech governance and digital solidarity economies.',
'https://digilabour.com.br',ARRAY['ühiskond','tehnoloogia','ebavõrdsus'],'Ühiskond ja sotsiaalteadused','MANUAL','initiative:digilabour:website-launch')
on conflict do nothing;
commit;
