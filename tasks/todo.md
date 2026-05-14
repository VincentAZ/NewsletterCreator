# Daily Newsletter Web App

## Plan

- [x] Build a standalone Next.js web app that replaces the n8n daily newsletter flow with an interactive editorial dashboard.
- [x] Gather AI news from RSS/API sources, normalize the payload, dedupe stories, and expose the reading list to the user before generation.
- [x] Let the user choose available OpenRouter text models returned by OpenRouter's models API.
- [x] Generate newsletter copy as strict structured JSON, validate it, and keep the draft editable in the browser.
- [x] Add human-in-the-loop controls to approve/reject the whole newsletter, request whole-draft feedback, and request targeted feedback/regeneration for sections or the hero image prompt.
- [x] Let the user choose fal.ai text-to-image models returned by fal's model search API, generate the hero image, and allow image-specific feedback/regeneration.
- [x] Include OpenRouter and fal credit/balance data in every fetched API payload, and refresh balances after each AI call.
- [x] Keep provider keys server-side only through Next API routes.
- [x] Add a final approval/export step so the generated newsletter and image are not silently published.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Local HTTP smoke test for the rendered dashboard at `http://localhost:3001`
- [x] Local HTTP smoke test for `/api/newsletter/balances`, `/api/newsletter/models`, and `/api/newsletter/draft`

## Review

- The app compiles and builds successfully.
- The dashboard renders the editorial workflow controls.
- Provider/API payloads include `balances`.
- The draft route returns a valid fallback newsletter when provider auth is unavailable.
- Browser plugin smoke testing was attempted, but the required Node browser-control tool was not exposed in this session, so verification used local HTTP requests instead.
