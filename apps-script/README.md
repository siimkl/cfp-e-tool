# Gmail importer

Run this standalone project as **callsevents208@gmail.com**. Copy **Code.gs**, **Core.gs** and **appsscript.json**. Full first-time instructions are in [the root setup guide](../README.md#e-configure-gmail-apps-script).

## Configuration

In Apps Script **Project Settings → Script Properties → Add script property**, add `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY`. Save each name/value pair. Do not paste keys into the source code.

Optional properties: `OPENAI_MODEL` (default `gpt-6-luna`), `MAILBOX_EMAIL` (default `callsevents208@gmail.com`), `MAX_EMAILS_PER_RUN` (30; hard maximum 30, including older settings above 30), `MAX_BODY_CHARS` (120000). Numeric settings must be positive integers; validation rejects invalid configuration before processing. The importer checks the effective Google account matches the configured mailbox before reading mail or creating a trigger. The `userinfo.email` scope is used for that account check.

### Upload using clasp

Instead of copying files manually, use Google's Apps Script CLI (`clasp`). Sign into [Apps Script settings](https://script.google.com/home/usersettings) as **callsevents208@gmail.com** and enable **Google Apps Script API**. In a terminal in the CFP folder, run:

```powershell
npx @google/clasp login
```

Choose **callsevents208@gmail.com** in Google's sign-in window. After authentication, a standalone project can be created and these files uploaded. This authorises project management; running the importer still requires the separate Gmail/HTTPS permissions in the Apps Script editor. Private keys belong in that project's Script Properties, not in uploaded source files. `.clasp.json` and local authentication files are excluded from Git.

Run `setupTwiceDailyTriggers()` once and grant the requested Google permissions. It creates two daily triggers around 04:00 and 16:00 Europe/Tallinn (approximately ±15 minutes). It replaces only previous `processInbox` triggers and preserves unrelated triggers. The old `setupDailyTrigger()` function remains an alias for this two-run setup. Existing installations also migrate automatically on their next `processInbox()` execution, without reinstalling the schedule on every run. Then run `processInbox()` manually to verify the integration. No deployment as a web app is needed.

## Processing and recovery

The importer uses a script lock to prevent concurrent executions of this project. Each message's database ledger is checked before extraction. `SUCCESS`, `NO_ITEMS` and `PERMANENT_ERROR` are terminal. `ERROR` and interrupted `PROCESSING` messages retry while attempts are below three. Attempts increment before extraction, so a hard execution timeout also counts.

OpenAI network failures, HTTP 429 and HTTP 5xx retry up to three times per extraction, with exponential backoff. These HTTP attempts are separate from the three email-processing attempts. Non-retryable HTTP failures fail promptly. Responses and email bodies are never logged. Errors retain service/status and context without response bodies or credentials.

Each run requests only the first 30 matching Gmail threads, sorts incoming message metadata newest first, and checks at most the newest 30 messages against the ledger. Bodies are read only for messages requiring extraction. Completed messages count toward this 30-message window; they are not replaced with older unprocessed mail. There is no pagination or full-mailbox scan. Old `SCAN_THREAD_OFFSET` and `LOOKBACK_DAYS` properties are ignored and may be removed. New replies in an existing thread are still eligible. Sent messages, drafts and messages from the mailbox’s own aliases are excluded.

In **Executions**, inspect failures. In Supabase, query:

```sql
select message_id, processing_status, attempts, error_message
from processed_emails
where processing_status in ('ERROR', 'PERMANENT_ERROR', 'PROCESSING')
order by received_at desc;

select * from automation_runs order by started_at desc limit 20;
```

After fixing the cause of a permanent error, reset the affected message explicitly in SQL Editor:

```sql
update processed_emails
set processing_status = 'ERROR', attempts = 0, error_message = null
where message_id = 'REPLACE_WITH_THE_ONE_MESSAGE_ID';
```

Then run `processInbox()`. It must still be inside the newest 30-message window. Partial inserts are safe to retry: unique fingerprints and `(item_id, message_id)` source keys prevent duplicate records. Resetting a successful email intentionally calls OpenAI again, so do this only when reprocessing is wanted.

If the run encounters a project/configuration error before it can write to Supabase, Apps Script logs are the source of truth. A `RUNNING` row older than 15 minutes is marked `ERROR` during the next run, indicating a likely hard timeout. API latency can still exceed the Apps Script hard limit even with the soft time budget. If more than 30 incoming messages arrive between runs, messages outside the newest 30 are intentionally not imported. A run stopped by the time budget retries pending messages next time only while they remain in this window.

## Maintenance

`Core.gs` is generated from `shared/core.js`. Make shared logic changes there, run `npm run sync:apps-script`, and copy the generated file to Google. `npm test` runs importer logic with test-only Apps Script/HTTP substitutes; live authorisation and actual model behaviour require the manual checks in the root README.

New Supabase secret keys are sent in `apikey`, not as bearer JWTs. Legacy service-role JWTs additionally use `Authorization: Bearer`. All HTTP destinations are fixed to the configured Supabase project and the OpenAI Responses endpoint. Extracted announcement URLs are never fetched by this script.

## Estonian topic categories

Topic labels are always stored in Estonian. The importer’s structured-output schema and validation use `ACADEMIC_TOPICS` from `shared/core.js`; the staff editor offers the same categories. Migration `002_estonian_topics.sql` translates legacy labels and enforces the vocabulary in PostgreSQL. Other announcement text stays in its source language. To extend the vocabulary, update the shared list and add a migration replacing `items_topics_estonian` before deploying the updated importer and editor.

## Source statistics

Migration `003_source_statistics.sql` adds a private receipt ledger and a public aggregate-only `source_statistics()` RPC. Each normal inbox run upserts one receipt for every message in its latest-30 window, even if already processed or containing no announcements. This provides cumulative unique-message counts without rereading the historical mailbox. `refreshSourceStatistics()` refreshes the same window without calling OpenAI; run it once in the Apps Script editor to populate the overview immediately, or wait for the next scheduled import.

Classification is conservative and independent of the model: direct sources require List-ID or List-Unsubscribe headers, and no forward/reply headers, subject prefixes or quoted/forwarded-body markers. Unknown mail is excluded, not guessed to be direct. Source identity uses List-ID when present, otherwise the actual sender. Forward detection is heuristic: stripped forwarding markers cannot always be recognised, and some genuine newsletters with quoted correspondence may be excluded. Counts demonstrate observed receipt, not current subscription membership. Public results contain source names/domains, counts and first/last dates only; message IDs and source keys remain private. No body or subject is stored in this ledger.
