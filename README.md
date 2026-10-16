# Daily Newsletter Web App

Standalone Next.js dashboard for producing an AI-news newsletter with human review.

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

```powershell
$env:OPENROUTER_API_KEY = "sk-or-..."
$env:FAL_KEY = "..."
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "..."
$env:SUPABASE_DB_URL = "postgresql://postgres..."
$env:SUPABASE_DB_PASSWORD = "..."
$env:MAILCHIMP_API_KEY = "..."
$env:MAILCHIMP_LIST_ID = "..."
$env:MAILCHIMP_FROM_NAME = "Your newsletter"
$env:MAILCHIMP_REPLY_TO = "newsletter@example.com"
```

`FAL_KEY` should be an Admin key if you want the app to display account credits from fal's billing endpoint.

Supabase is required for persisted dashboard preferences. Custom sources, selected models, the currently edited eight workflow prompts, saved prompt sets, and the last used prompt set are stored in the `newsletter_preferences` table under the stable `default-preferences` row.

Mailchimp is configured once through `.env`. `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, `MAILCHIMP_FROM_NAME`, and `MAILCHIMP_REPLY_TO` are required to create a draft campaign. `MAILCHIMP_REPLY_TO` must be a real sender address Mailchimp accepts for the account. In UI fields that ask for an email address, enter only the address, for example `info@example.com`, not `MAILCHIMP_REPLY_TO=info@example.com`. If `MAILCHIMP_SERVER` is omitted, the app infers it from the API key suffix, for example `us21`.

Mailchimp drafts use the app's full branded HTML and matching plain text. Template IDs and section mappings are not used. Click **Populate Mailchimp** after reviewing the copy and image; the app creates a draft and never sends or schedules it.

## Private deployment and upgrade

Production runs (including Vercel) require `NEWSLETTER_ADMIN_USER` and a strong `NEWSLETTER_ADMIN_PASSWORD`. The dashboard and API routes use HTTP Basic authentication over HTTPS. Without these values, production access fails closed with HTTP 503. Local development remains accessible without authentication; do not expose the development server publicly.

Before deploying this version, run the schema migration below to add the `revision` column. Existing preferences are preserved. Saves use an atomic revision check; conflicts and failed loads stop autosave until saved preferences are reloaded. Do not run older clients concurrently after upgrading.

Apply or update the Supabase schema:

```powershell
npm run db:ensure-schema
```

The schema command uses `psql` when installed and falls back to the Supabase CLI through `npx`. It uses `SUPABASE_DB_URL` or `DATABASE_URL`; if those are not set, it can derive the connection from `SUPABASE_URL` plus `SUPABASE_DB_PASSWORD`. It applies this idempotent schema:

```sql
create table if not exists public.newsletter_preferences (
  preference_id text primary key,
  sources jsonb not null default '[]'::jsonb,
  copy_model text,
  scrape_model text,
  image_model text,
  current_prompt_set jsonb,
  prompt_sets jsonb not null default '[]'::jsonb,
  last_prompt_set_id text,
  updated_at timestamptz not null default now()
);
```

## Workflow

1. Load OpenRouter and fal model catalogs.
2. Gather and dedupe AI-news stories.
3. Select stories and generate newsletter copy.
4. Edit the draft, approve sections, or regenerate with feedback.
5. Generate or regenerate the hero image with the selected fal text-to-image model.
6. Populate a Mailchimp template as a draft campaign for final review.

Provider workflow responses include refreshed balance data. Source collection reports per-source failures and keeps successful results.
