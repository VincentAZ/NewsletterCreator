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
$env:MAILCHIMP_API_KEY = "..."
$env:MAILCHIMP_LIST_ID = "..."
$env:MAILCHIMP_TEMPLATE_ID = "123456"
$env:MAILCHIMP_FROM_NAME = "Your newsletter"
$env:MAILCHIMP_REPLY_TO = "newsletter@example.com"
```

`FAL_KEY` should be an Admin key if you want the app to display account credits from fal's billing endpoint.

Supabase is optional. When configured, the app saves only user preferences: custom sources and the last selected copy/image models. Without Supabase, the dashboard falls back to browser `localStorage`.

Mailchimp is optional. `MAILCHIMP_API_KEY` and `MAILCHIMP_LIST_ID` are required to create a draft campaign. `MAILCHIMP_TEMPLATE_ID` can be set in `.env` or entered in the dashboard. If `MAILCHIMP_SERVER` is omitted, the app infers it from the API key suffix, for example `us21`.

The Mailchimp template should expose editable sections matching the dashboard defaults:

```html
<div mc:edit="preheader"></div>
<div mc:edit="intro"></div>
<div mc:edit="hero_image"></div>
<div mc:edit="body"></div>
```

After copy and image generation, click `Populate Mailchimp` to create a draft campaign and fill those sections. The app does not send or schedule campaigns.

Create this table in Supabase:

```sql
create table if not exists newsletter_preferences (
  preference_id text primary key,
  sources jsonb not null default '[]'::jsonb,
  copy_model text,
  image_model text,
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
