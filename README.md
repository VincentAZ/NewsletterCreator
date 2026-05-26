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
$env:MAILCHIMP_TEMPLATE_ID = "123456"
$env:MAILCHIMP_FROM_NAME = "Your newsletter"
$env:MAILCHIMP_REPLY_TO = "newsletter@example.com"
$env:MAILCHIMP_SECTION_PREHEADER = "preheader"
$env:MAILCHIMP_SECTION_INTRO = "intro"
$env:MAILCHIMP_SECTION_HERO_IMAGE = "hero_image"
$env:MAILCHIMP_SECTION_BODY = "body"
```

`FAL_KEY` should be an Admin key if you want the app to display account credits from fal's billing endpoint.

Supabase is required for persisted dashboard preferences. Custom sources, selected models, the currently edited eight workflow prompts, saved prompt sets, and the last used prompt set are stored in the `newsletter_preferences` table under the stable `default-preferences` row.

Mailchimp is configured once through `.env`. `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, `MAILCHIMP_FROM_NAME`, and `MAILCHIMP_REPLY_TO` are required to create a draft campaign. `MAILCHIMP_REPLY_TO` must be a real sender address Mailchimp accepts for the account. In UI fields that ask for an email address, enter only the address, for example `info@example.com`, not `MAILCHIMP_REPLY_TO=info@example.com`. If `MAILCHIMP_SERVER` is omitted, the app infers it from the API key suffix, for example `us21`.

Set `MAILCHIMP_TEMPLATE_ID` only for a Classic coded Mailchimp template with editable `mc:edit` regions. By default the app fills `preheader`, `intro`, `hero_image`, and `body`; override those names with `MAILCHIMP_SECTION_PREHEADER`, `MAILCHIMP_SECTION_INTRO`, `MAILCHIMP_SECTION_HERO_IMAGE`, and `MAILCHIMP_SECTION_BODY` if your template uses different editable section names. Restart the Next dev server after changing `.env`.

Mailchimp New Builder / multichannel templates are not API-populatable by this app. If `MAILCHIMP_TEMPLATE_ID` points to one, the app will stop with an explicit error instead of creating a draft in the wrong layout. After copy and image generation, click `Populate Mailchimp` to create a draft campaign. The app links to the draft inside Mailchimp's admin UI because public campaign/archive URLs are only reliable after sending. The app does not send or schedule campaigns.

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

Every API response includes refreshed OpenRouter and fal balance data.
