# Favicon Visibility Update

## Plan

- [x] Inspect the current favicon/app icon assets and source logo dimensions.
- [x] Generate sharper favicon assets with less whitespace and stronger contrast at small sizes.
- [x] Verify the files are valid images and the app metadata still references them correctly.
- [x] Run typecheck/build verification.
- [x] Document results.

## Verification

- [x] Confirm generated `icon.png` and `apple-icon.png` dimensions.
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Replaced the low-visibility favicon with a simplified high-contrast two-arrow mark on a dark rounded-square background.
- Generated `apps/web/src/app/icon.png` at 512x512 and `apps/web/src/app/apple-icon.png` at 180x180.
- Added explicit Next metadata icon references in `apps/web/src/app/layout.tsx`.
- The provided Google Drive logo path was not mounted in this shell, so the visible favicon was recreated as a simplified small-size mark instead of reading that external file directly.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows `.next` `EPERM`; clearing generated `.next` read-only attributes allowed the build to pass.

---

# Mailchimp Template Population

## Plan

- [x] Review the current final approval/export surface and Mailchimp API requirements.
- [x] Add server-side Mailchimp configuration and helper code that creates a draft campaign and sets template content.
- [x] Add a Next API route that accepts the approved newsletter draft and hero image, then populates Mailchimp without sending.
- [x] Add dashboard controls for template section names and a populate-template action after copy and image exist.
- [x] Document required Mailchimp environment variables and template setup.
- [x] Run typecheck/build verification.
- [x] Document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Local rendered dashboard smoke test at `http://127.0.0.1:3000`
- [x] Local Mailchimp config route smoke test at `http://127.0.0.1:3000/api/newsletter/mailchimp`

## Review

- Added `/api/newsletter/mailchimp` for creating a Mailchimp draft campaign and filling campaign content without sending.
- Added a server-side Mailchimp helper that reads `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, optional `MAILCHIMP_SERVER`, optional `MAILCHIMP_TEMPLATE_ID`, `MAILCHIMP_FROM_NAME`, and `MAILCHIMP_REPLY_TO`.
- Added a publish-panel Mailchimp template section map so the dashboard can populate `preheader`, `intro`, `hero_image`, and `body` editable template sections after copy and image exist.
- The API falls back to full HTML campaign content when no template id is configured or entered.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows `.next` `EPERM`; clearing generated `.next` read-only attributes allowed the build to pass.
- Local dashboard smoke test rendered the Mailchimp template controls, and the Mailchimp config route returned `{"configured":false}` without Mailchimp credentials.

---

# Source Type Cleanup

## Plan

- [x] Review current source fetching and source type UI.
- [x] Remove HN Algolia as a user-facing source type.
- [x] Add a website scrape source type for normal web pages.
- [x] Update defaults and source forms so users choose only RSS feed or website scrape.
- [x] Run typecheck/build verification.
- [x] Document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Removed HN Algolia from defaults, source forms, and source fetching.
- Added `website` as the second source type alongside `rss`.
- Website scrape fetches the target page and extracts article-like links from anchors, falling back to the page title when no usable links are found.
- Saved legacy non-RSS source types are normalized to `website` so old preferences do not break the UI.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows `.next` `EPERM`; clearing generated `.next` read-only attributes allowed the build to pass.

---

# Model Search Dropdown Fix

## Plan

- [x] Review the current search implementation and user-reported behavior.
- [x] Verify how many models match `chat` and why the dropdown still appears unfiltered.
- [x] Update model filtering so active search terms strictly control dropdown options.
- [x] Preserve a valid model selection when the current model no longer matches the active search.
- [x] Run typecheck/build verification.
- [x] Document results and any UX change.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Root cause: search included long model descriptions, pricing, and context metadata. That made search terms like `chat` match models whose visible name/id did not look related.
- Changed picker search to match only visible picker identity fields: model id, model name, and category.
- When an active search excludes the currently selected model, the app now selects the first matching model so the dropdown reflects the search instead of keeping a non-matching selection visible.
- Verified `chat` now matches 8 OpenRouter copy models by name/id/category, down from 30 when description text was included.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows `.next` `EPERM`; clearing generated `.next` read-only attributes allowed the build to pass.
