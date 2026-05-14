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
```

`FAL_KEY` should be an Admin key if you want the app to display account credits from fal's billing endpoint.

## Workflow

1. Load OpenRouter and fal model catalogs.
2. Gather and dedupe AI-news stories.
3. Select stories and generate newsletter copy.
4. Edit the draft, approve sections, or regenerate with feedback.
5. Generate or regenerate the hero image with the selected fal text-to-image model.
6. Approve or reject the final issue.

Every API response includes refreshed OpenRouter and fal balance data.
