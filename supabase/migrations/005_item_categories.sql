-- A required broad category, separate from detailed Estonian topic tags.
alter table public.items add column category text;
with categories(priority, name, tags) as (values
(0,'Ühiskond ja sotsiaalteadused',ARRAY['ühiskond','sotsiaalteadused','sotsioloogia','antropoloogia','ajakirjandus','kommunikatsioon','meediauuringud','poliitika','politoloogia','avalik poliitika','digitaalne ühiskond','digitaalne suveräänsus','majandus','ettevõtlus','ebavõrdsus','linnauuringud','soouuringud','ränne','rahvusvahelised suhted','valitsemine','õigusteadus','intellektuaalomand','jälgimisuuringud']::text[]),
(1,'Humanitaaria ja kultuur',ARRAY['ajalugu','digihumanitaaria','eetika','filosoofia','keeleteadus','kirjandusteadus','kultuuriuuringud','kunst']::text[]),
(2,'Haridus ja õppimine',ARRAY['haridus','kõrgharidus','doktoriõpe','praktiline õpe','lõputöö esitlemine']::text[]),
(3,'Tehnoloogia ja loodusteadused',ARRAY['andmeteadus','arendustehnoloogiad','bioloogia','füüsika','infokorraldus','infoteadus','inseneriteadused','keemia','keskkond','kestlikkus','kliimamuutused','loodusteadused','matemaatika','tarkvaraarendus','tehisintellekt','tehnoloogia','turvalisus']::text[]),
(4,'Tervis ja heaolu',ARRAY['tervis','meditsiin','psühholoogia','sotsiaaltöö']::text[])
), scores as (
 select i.id, c.name, c.priority,
   (select count(*) from unnest(i.topics) t where t = any(c.tags)) as score
 from public.items i cross join categories c
), best as (
 select distinct on (id) id,name from scores where score > 0 order by id,score desc,priority
)
update public.items i set category=b.name from best b where i.id=b.id;
update public.items set category='Valdkondadeülene teadus' where category is null;
alter table public.items alter column category set default 'Valdkondadeülene teadus';
alter table public.items alter column category set not null;
alter table public.items add constraint items_category_estonian check (category in (
'Ühiskond ja sotsiaalteadused','Humanitaaria ja kultuur','Haridus ja õppimine','Tehnoloogia ja loodusteadused','Tervis ja heaolu','Valdkondadeülene teadus'
));
