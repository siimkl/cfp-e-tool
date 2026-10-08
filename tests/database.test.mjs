import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ACADEMIC_TOPICS } from '../shared/core.js';

test('migration runs in PostgreSQL and enforces public/staff/service permissions', async () => {
  const db = new PGlite();
  try {
    // Minimal Supabase-provided roles/auth objects. The actual application migration is unmodified.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('11111111-1111-4111-8111-111111111111');`);
    await db.exec(
      readFileSync(
        new URL(
          '../supabase/migrations/001_initial_schema.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await db.exec(
      readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8'),
    );
    await db.exec(
      "update items set topics = array['doctoral research', 'doctoral researchers', 'academic writing'] where title = 'Example: Research Methods Workshop'",
    );
    await db.exec(
      readFileSync(
        new URL(
          '../supabase/migrations/002_estonian_topics.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    assert.deepEqual(
      (
        await db.query(
          "select topics from items where title = 'Example: Research Methods Workshop'",
        )
      ).rows[0].topics,
      ['akadeemiline kirjutamine', 'doktoriõpe'],
    );
    await assert.rejects(
      db.query("update items set topics = array['academic writing']"),
      /items_topics_estonian/,
    );
    await db.query(
      "update items set topics = $1 where title = 'Example: Research Methods Workshop'",
      [ACADEMIC_TOPICS],
    );
    await db.exec(`insert into public.items(item_type,title,archived) values ('CFP','Hidden record',true);
      insert into processed_emails(message_id,received_at,processing_status) values ('mail1',now(),'SUCCESS');`);
    await db.exec(
      readFileSync(
        new URL(
          '../supabase/migrations/003_source_statistics.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await db.exec(`insert into source_receipts(message_id,source_key,source_name,source_domain,source_kind,classification,received_at) values
      ('direct1','list:journal.org','Journal','journal.org','LIST','DIRECT','2026-10-01'),
      ('direct2','list:journal.org','Journal','journal.org','LIST','DIRECT','2026-10-02'),
      ('forward1',null,null,null,null,'FORWARDED','2026-10-03'),
      ('unknown1',null,null,null,null,'UNKNOWN','2026-10-04');`);
    await db.exec('set role anon');
    await assert.rejects(
      db.query('select * from source_receipts'),
      /permission denied/,
    );
    const sourceStats = (await db.query('select * from source_statistics()'))
      .rows;
    assert.equal(sourceStats.length, 1);
    assert.equal(Number(sourceStats[0].email_count), 2);
    assert.equal(sourceStats[0].source_name, 'Journal');
    assert.ok(!('message_id' in sourceStats[0]));
    await assert.rejects(
      db.query('delete from source_receipts'),
      /permission denied/,
    );
    assert.equal((await db.query('select * from items')).rows.length, 6);
    for (const sql of [
      "insert into items(item_type,title) values('CFP','bad')",
      "update items set title='bad'",
      'delete from items',
      'select * from processed_emails',
      'select * from item_sources',
      'select * from automation_runs',
    ])
      await assert.rejects(db.query(sql), /permission denied/);
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);`,
    );
    assert.equal((await db.query('select * from items')).rows.length, 7);
    assert.equal(
      (await db.query('select * from processed_emails')).rows.length,
      1,
    );
    await db.exec(
      "insert into items(item_type,title,source_type) values ('CFP','Manual staff CFP','MANUAL')",
    );
    await assert.rejects(
      db.query(
        "insert into items(item_type,title,source_type) values ('CFP','Bad automation','EMAIL')",
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query('update processed_emails set attempts=1'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('insert into automation_runs default values'),
      /permission denied/,
    );
    await db.exec(
      "update items set archived=true where title='Manual staff CFP'",
    );
    await db.exec("delete from items where title='Manual staff CFP'");
    await db.exec('reset role; set role service_role');
    await db.exec(
      "insert into items(item_type,title,source_type,dedupe_key) values ('CFP','Automated','EMAIL','unique')",
    );
    await assert.rejects(
      db.query(
        "insert into items(item_type,title,dedupe_key) values ('CFP','Duplicate','unique')",
      ),
      /unique/,
    );
    await assert.rejects(
      db.query(
        "insert into items(item_type,title,event_start) values ('CFP','Wrong dates','2027-01-01')",
      ),
      /dates_match_type/,
    );
    await db.exec(
      "insert into item_sources(item_id,message_id,source_excerpt) select id,'mail1','Excerpt' from items where title='Automated'",
    );
    await db.exec("delete from items where title='Automated'");
    assert.equal((await db.query('select * from item_sources')).rows.length, 0);
    await db.exec('reset role');
    await db.exec(
      readFileSync(
        new URL(
          '../supabase/migrations/004_journal_source_statistics.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await db.exec(`insert into processed_emails(message_id,received_at,processing_status) values
      ('direct1',now(),'SUCCESS'),('direct2',now(),'SUCCESS'),('forward1',now(),'SUCCESS');
      insert into items(item_type,title,journal) values
      ('CFP','Alpha call','Journal Alpha'),('CFP','Alpha second call','Journal Alpha'),('CFP','Beta call','Journal Beta');
      insert into item_sources(item_id,message_id) select id,'direct1' from items where title in ('Alpha call','Alpha second call','Beta call');
      insert into item_sources(item_id,message_id) select id,'direct2' from items where title='Alpha call';
      insert into item_sources(item_id,message_id) select id,'forward1' from items where title='Beta call';
      set role anon;`);
    const journals = (await db.query('select * from source_statistics()')).rows;
    assert.equal(journals.length, 2);
    assert.deepEqual(
      journals.map((row) => [
        row.source_name,
        Number(row.email_count),
        row.source_kind,
      ]),
      [
        ['Journal Alpha', 2, 'JOURNAL'],
        ['Journal Beta', 1, 'JOURNAL'],
      ],
    );
  } finally {
    await db.close();
  }
});
