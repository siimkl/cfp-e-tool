# CFP/E Tool deployment handoff

Deployment target: [siimkl/cfp-e-tool](https://github.com/siimkl/cfp-e-tool).

Dashboard URL: **https://siimkl.github.io/cfp-e-tool/**

Supabase project: **`mpdwmjvnvoiwfxdvpkif`** (Ireland).

The initial database migration has been applied. Public read access and private-table protection have been verified against the live API. Staff-only authentication settings and the dashboard's two GitHub connection variables are configured. Do not run the initial migration again on this project.

Remaining setup: add authorised staff accounts, then authorise and configure the Gmail/OpenAI importer. The dashboard contains no demonstration data and will be empty until staff add announcements or the importer runs.

## 1. Connect Supabase

This step is complete for the project above. For a new replacement project, run [001_initial_schema.sql](supabase/migrations/001_initial_schema.sql) once. Do not run the optional seed on the production project.

These [GitHub repository variables](https://github.com/siimkl/cfp-e-tool/settings/variables/actions) are already set. Update them only if the project or publishable key changes:

| Name                            | Value                       |
| ------------------------------- | --------------------------- |
| `VITE_SUPABASE_URL`             | Your Supabase project URL   |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your `sb_publishable_…` key |

Then open [the deployment workflow](https://github.com/siimkl/cfp-e-tool/actions/workflows/deploy-pages.yml), choose **Run workflow**, keep `main`, and run it. This rebuilds the public dashboard using those variables.

## 2. Enable staff sign-in

Public signups and anonymous sign-ins are disabled. In Supabase **Authentication → Users**, add or invite authorised staff. All authenticated users in this dedicated project have editor access. No staff accounts have been created yet.

The Site URL and redirect allowlist already include:

```text
https://siimkl.github.io/cfp-e-tool/
```

Test email delivery for an invited account; configure your SMTP provider if needed. Full instructions are in [README.md](README.md#c-configure-authentication).

## 3. Connect Gmail and OpenAI

The standalone **CFP-E Inbox Importer** project has been created under **callsevents208@gmail.com**, and `Code.gs`, `Core.gs`, and `appsscript.json` have been uploaded. Open [the importer in Apps Script](https://script.google.com/home/projects/1tIXNs1tM4IA5EGw46lnuhxQjsy6J2ozK--_Yimu1OHjNdQUzGjhFHrd5/edit) using that Google account. Do not create another project.

Project upload authorisation is complete. Gmail execution permission and Script Properties must still be authorised/configured in the editor. For future source updates, the local `.clasp.json` links the CLI to this project and `npx @google/clasp push` uploads the importer files.

Add these **Script Properties**, under Apps Script Project Settings:

| Property              | Value                                         |
| --------------------- | --------------------------------------------- |
| `SUPABASE_URL`        | `https://mpdwmjvnvoiwfxdvpkif.supabase.co`    |
| `SUPABASE_SECRET_KEY` | Private Supabase secret key                   |
| `OPENAI_API_KEY`      | Private OpenAI API project key                |
| `OPENAI_MODEL`        | Optional: `gpt-6-luna` is already the default |

Keep both private keys here only. They do not belong in GitHub variables or the frontend.

Run `processInbox()` manually and authorise Google access. Inspect its execution and the Supabase processing tables. Once successful, run `setupTwiceDailyTriggers()` to schedule processing around 04:00 and 16:00 Europe/Tallinn. Existing scheduled installations migrate on their next run. Each execution checks only the newest 30 received messages; completed messages are skipped and older mailbox pages are not scanned.

## 4. Verify the complete flow

Forward a CFP to the inbox, run the importer, and check it appears on the public dashboard. Reprocess the same message to confirm it is skipped. Sign in as staff, edit the announcement and inspect its private Sources view. Anonymous visitors should see only the public announcement.

No computer needs to stay running: GitHub hosts the dashboard, Google runs the importer, OpenAI performs extraction, and Supabase stores the results.
