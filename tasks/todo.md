# Dashboard UI Alignment Cleanup

## Follow-up Plan

- [x] Fix hero image preview overflow at wide desktop widths.
- [x] Reduce empty draft/image dead space while keeping panels aligned.
- [x] Re-run typecheck/build and rendered smoke tests.

## Follow-up Verification

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Desktop screenshot refreshed at `tasks/dashboard-after-desktop.png`
- [x] Mobile screenshot refreshed at `tasks/dashboard-after-mobile.png`
- [x] Browser metrics: no console errors, no framework overlay, hero preview stayed inside publish pane.

## Plan

- [x] Review existing lessons and current dashboard files.
- [x] Write this plan before implementation.
- [x] Inspect the current component/CSS structure for the visible alignment problems.
- [x] Tighten the dashboard grid so toolbar, steps, and panels use the same column rhythm.
- [x] Normalize panel headers, controls, empty states, source rows, and image/copy areas so they align cleanly.
- [x] Run typecheck/build verification.
- [x] Smoke test the rendered dashboard locally.
- [x] Add review notes with exact verification results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Local rendered dashboard smoke test at `http://localhost:3001`
- [x] Desktop screenshot: `tasks/dashboard-after-desktop.png`
- [x] Mobile screenshot: `tasks/dashboard-after-mobile.png`
- [x] Browser smoke metrics: no Next.js error overlay, no console errors, body content rendered, desktop pane tops and bottoms aligned.

## Review

- The toolbar, step bar, and main workspace now share a consistent four-column rhythm on desktop.
- Source, draft, and image panels align at the same top and bottom coordinates in the desktop smoke test.
- Empty states and source rows now have steadier spacing, and mobile balance cards/control stacks render cleanly.
- Build initially hit Windows `EPERM` while `.next` was read-only/held by the dev server; clearing generated `.next` read-only attributes allowed the build to pass.

---

# Previous Daily Newsletter Web App Notes

## Plan

- [x] Move `Gather news` into the Source Queue card.
- [x] Align the Draft Review header and `Generate copy` button with the Image & Approval header and `Generate image` button.
- [x] Add editable news sources so users can create, read, update, and delete source definitions instead of relying on hardcoded sources.
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
- [x] Local HTTP smoke test for custom-source `/api/newsletter/articles` POST

## Review

- The app compiles and builds successfully.
- The dashboard renders the editorial workflow controls.
- Provider/API payloads include `balances`.
- The draft route returns a valid fallback newsletter when provider auth is unavailable.
- Browser plugin smoke testing was attempted, but the required Node browser-control tool was not exposed in this session, so verification used local HTTP requests instead.
