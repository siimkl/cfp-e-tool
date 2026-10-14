begin;
alter table public.items add column event_time text check (event_time is null or length(event_time) <= 100);
-- Correction from the original announcement supplied by the owner.
update public.items set event_start='2026-10-16', event_end='2026-10-16',
 event_time='14:00 CET', location='Microsoft Teams', event_mode='ONLINE',
 category='Ühiskond ja sotsiaalteadused',
 topics=ARRAY['digitaalne ühiskond','tehnoloogia','valitsemine','ettevõtlus']
where id='0621b3f8-2a73-4dc0-a53d-ea3d44b1a50d'
 and title='Dreamy Stacks: Digital Public Infrastructure, Futurity, and Failure in Startup India';
commit;
