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
    await db.exec('set role anon');
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
  } finally {
    await db.close();
  }
});
