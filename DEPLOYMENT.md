# CFP/E Tool deployment handoff

Deployment target: [siimkl/cfp-e-tool](https://github.com/siimkl/cfp-e-tool).

Dashboard URL: **https://siimkl.github.io/cfp-e-tool/**

The first deployment can show the setup screen while the database and email importer are connected. It contains no demonstration data and no private credentials.

## 1. Connect Supabase

Create a dedicated Supabase project. In its SQL Editor, run [001_initial_schema.sql](supabase/migrations/001_initial_schema.sql) once. Do not run the optional seed on the production project.

In [GitHub repository variables](https://github.com/siimkl/cfp-e-tool/settings/variables/actions), add:

| Name                            | Value                       |
| ------------------------------- | --------------------------- |
| `VITE_SUPABASE_URL`             | Your Supabase project URL   |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your `sb_publishable_…` key |

Then open [the deployment workflow](https://github.com/siimkl/cfp-e-tool/actions/workflows/deploy-pages.yml), choose **Run workflow**, keep `main`, and run it. This rebuilds the public dashboard using those variables.

## 2. Enable staff sign-in

In Supabase Authentication, disable public signups and anonymous sign-ins. Invite authorised staff. All authenticated users in this dedicated project have editor access.

Set the Site URL and add this exact redirect URL:

```text
https://siimkl.github.io/cfp-e-tool/
```

Test email delivery for an invited account; configure your SMTP provider if needed. Full instructions are in [README.md](README.md#c-configure-authentication).

## 3. Connect Gmail and OpenAI

Sign into [Google Apps Script](https://script.google.com/) as **uti208@gmail.com**. Create a standalone project and copy the three files from [apps-script](apps-script): `Code.gs`, `Core.gs`, and `appsscript.json`.

Add these **Script Properties**, under Apps Script Project Settings:

| Property              | Value                                         |
| --------------------- | --------------------------------------------- |
| `SUPABASE_URL`        | Same Supabase project URL                     |
| `SUPABASE_SECRET_KEY` | Private Supabase secret key                   |
| `OPENAI_API_KEY`      | Private OpenAI API project key                |
| `OPENAI_MODEL`        | Optional: `gpt-6-luna` is already the default |

Keep both private keys here only. They do not belong in GitHub variables or the frontend.

Run `processInbox()` manually and authorise Google access. Inspect its execution and the Supabase processing tables. Once successful, run `setupDailyTrigger()` to schedule processing around 04:00 Europe/Tallinn.

## 4. Verify the complete flow

Forward a CFP to the inbox, run the importer, and check it appears on the public dashboard. Reprocess the same message to confirm it is skipped. Sign in as staff, edit the announcement and inspect its private Sources view. Anonymous visitors should see only the public announcement.

No computer needs to stay running: GitHub hosts the dashboard, Google runs the importer, OpenAI performs extraction, and Supabase stores the results.
