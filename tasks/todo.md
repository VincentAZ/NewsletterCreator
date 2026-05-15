# Mailchimp Draft Completeness Fix

## Plan

- [x] Diagnose the blank preview and incomplete From state from the current Mailchimp API flow.
- [x] Require real Mailchimp sender config instead of falling back to placeholder From values.
- [x] Populate campaign content with full rendered HTML so the draft preview is not blank.
- [x] Return/send checklist warnings from Mailchimp when available.
- [x] Update docs to match the simpler reliable Mailchimp flow.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- The blank preview was caused by relying on Mailchimp template section injection, which is fragile for this account/template flow.
- The app now always sends full rendered HTML and plain text to Mailchimp campaign content.
- `MAILCHIMP_FROM_NAME`, `MAILCHIMP_REPLY_TO`, and `MAILCHIMP_TEMPLATE_ID` are now required; no placeholder sender fallback is used.
- The Mailchimp send checklist is fetched after draft creation and surfaced in the dashboard status when Mailchimp still reports incomplete items.
- Removed obsolete `mc:edit`/section-map docs and env examples.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Database Preference Load/Save Fix

## Plan

- [x] Review existing lessons and current preference persistence notes.
- [x] Inspect dashboard load/save code, preferences API, Supabase helper, and current logs.
- [x] Reproduce the database preference failure through the live API or a focused route/helper probe.
- [x] Fix the root cause with minimal changes to the persistence flow.
- [x] Verify preference save and reload behavior, plus typecheck/build as appropriate.
- [x] Document results and any follow-up notes here.

## Verification

- [x] Focused preference save/load check
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Live API checks confirmed Supabase can save and reload the preference fields; the issue was not the schema or REST mapping.
- Changed the dashboard to use the stable `default-preferences` row instead of a random browser-local row ID.
- Added one-time migration from an existing browser-local legacy preference row when the stable row is empty.
- Updated README persistence wording to match the stable database row.
- Removed the temporary API test row after verification so synthetic test values are not left in the app.
- `npm run typecheck` passed.
- `npm run build` passed after clearing generated `.next` read-only attributes for the known Windows `EPERM` cleanup issue.

---

# Simplify Fixed Mailchimp Template

## Plan

- [x] Remove Mailchimp template/template-section inputs from the dashboard.
- [x] Stop saving Mailchimp template details as editable user preferences.
- [x] Make the Mailchimp API use the single configured template from `.env` plus default section names.
- [x] Update README so required Mailchimp setup is obvious and minimal.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Removed the dashboard inputs for Mailchimp template ID and editable section names.
- Populate Mailchimp now sends only the generated draft and hero image; the server uses the single `.env` Mailchimp configuration.
- Preferences now persist only custom sources, selected copy model, and selected image model.
- Removed Mailchimp columns from the current schema script and README schema. Existing Supabase columns can remain unused.
- Added optional `.env` overrides for Mailchimp section names, while keeping defaults of `preheader`, `intro`, `hero_image`, and `body`.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Mailchimp Populate Button Feedback

## Plan

- [x] Inspect the dashboard click handler and Mailchimp API response path.
- [x] Make the Populate Mailchimp action visibly enter a busy state and report success/failure.
- [x] Ensure non-2xx API responses are surfaced instead of appearing like no-op clicks.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Hardened the Mailchimp populate handler so clicks show progress and errors in the dashboard status.
- Added error handling around Mailchimp and image requests so unexpected failures do not leave the app stuck busy.
- Updated shared JSON request helpers to throw on non-2xx responses and surface API error messages.
- `npm run typecheck` passed.
- `npm run build` passed after clearing the recurring generated `.next` read-only attributes.

---

# Supabase Schema Runner Setup

## Plan

- [x] Make the schema runner accept either a full DB URL or a Supabase DB password plus project URL.
- [x] Improve the missing-connection error message so it tells the user exactly what to add.
- [x] Update README and `.env.example` with the supported env vars.
- [x] Verify the script failure path and typecheck.

## Verification

- [x] `npm run db:ensure-schema` without DB credentials shows actionable setup instructions.
- [x] `npm run typecheck`

## Review

- Updated the schema runner to use `SUPABASE_DB_URL`, `DATABASE_URL`, or derive a Postgres URL from `SUPABASE_URL` plus `SUPABASE_DB_PASSWORD`.
- Improved the missing-connection message with exact `.env` options.
- Documented `SUPABASE_DB_PASSWORD` in README and `.env.example`.
- `npm run db:ensure-schema` now shows the improved setup instructions when DB credentials are absent.
- `npm run typecheck` passed.

---

# Database-Only Preferences

## Plan

- [x] Add an idempotent database schema script for the current `newsletter_preferences` table.
- [x] Add an npm command so the latest schema can be applied from the repo.
- [x] Remove browser-local preference storage for sources, selected models, and Mailchimp template values.
- [x] Make the dashboard load and save those values through Supabase preferences only.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Validate the schema script help/failure path when no DB connection string is configured.

## Review

- Added `scripts/ensure-supabase-schema.sql` with idempotent create/alter/update statements for `newsletter_preferences`.
- Added `npm run db:ensure-schema`, which applies the schema through `psql` using `SUPABASE_DB_URL` or `DATABASE_URL`.
- Removed browser-local storage for preference values; only the anonymous preference row ID remains in localStorage.
- Dashboard preference loads and saves now use Supabase only for custom sources, copy model, image model, Mailchimp template ID, and Mailchimp editable section names.
- Removed the old server-side fallback that saved legacy preference columns when Mailchimp columns were missing.
- Updated README setup instructions for `SUPABASE_DB_URL` and the schema command.
- `npm run typecheck` passed.
- `npm run build` passed after clearing the recurring generated `.next` read-only attributes.
- `npm run db:ensure-schema` correctly failed with setup instructions because no `SUPABASE_DB_URL` or `DATABASE_URL` is currently configured.

---

# Persist Mailchimp Template Inputs

## Plan

- [x] Review current preference loading and saving for dashboard settings.
- [x] Extend saved preferences to include the Mailchimp template ID and editable section names.
- [x] Load saved Mailchimp values on startup with defaults for missing fields.
- [x] Fix Mailchimp preference load precedence so same-browser local values are not overwritten by older Supabase defaults.
- [x] Verify typecheck/build and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] If build hits the recurring Windows `.next` `EPERM`, clear generated `.next` read-only attributes and rerun `npm run build`.
- [x] Verify Mailchimp preference reload in a browser context; first attempt found no dashboard DOM on the active port, so confirm the served app target.

## Review

- Added Mailchimp template ID and section names to the dashboard preferences payload.
- Saved and loaded those values through browser `localStorage`, with same-browser Mailchimp values taking precedence over older Supabase defaults.
- Extended the preferences API and Supabase helper so updated Supabase tables can persist Mailchimp fields too; the earlier legacy fallback was later removed by the Database-Only Preferences task.
- Updated the README Supabase schema with `mailchimp_template_id` and `mailchimp_section_map`.
- `npm run typecheck` passed.
- `npm run build` passed after the first run hit the recurring Windows `.next` `EPERM` and generated `.next` attributes were cleared.
- Browser/CDP verification against a production `next start` instance confirmed seeded Mailchimp template values reload into the dashboard inputs.

---

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

# Card Help Buttons

## Plan

- [x] Identify the dashboard cards and panels that need inline help.
- [x] Add a reusable `?` help control with accessible labels and hover/focus tooltip text.
- [x] Place help controls on the model, source, article, draft, image, Mailchimp, and source-item cards.
- [x] Add responsive styles so help controls do not crowd headers or resize cards.
- [x] Run typecheck/build verification.
- [x] Document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Local dashboard HTTP smoke test at `http://127.0.0.1:3000`

## Review

- Added shared `?` help controls with hover/focus tooltip text and native title fallback.
- Added help to the model toolbar, source queue, source manager, add-source form, individual source cards, article selector, draft review, generated draft-section cards, hero image, and Mailchimp template panel.
- Added styles for compact circular help buttons and constrained tooltips that do not alter card layout.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows `.next` `EPERM`; clearing generated `.next` read-only attributes allowed the build to pass.
- Local dashboard smoke test returned `200` and included the new help labels in rendered HTML.

---

# Mailchimp Template Population

---

# Draft Section Delete Control

## Plan

- [x] Review the existing draft section editor and state update helpers.
- [x] Add a delete action that removes one generated draft section from the current draft.
- [x] Add a visible section-level delete control without disrupting regenerate/edit controls.
- [x] Run typecheck/build verification.
- [x] Document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Local dashboard HTTP smoke test at `http://127.0.0.1:3000`

## Review

- Added a `deleteSection` draft state helper that removes the chosen section and preserves at least one section.
- Added a section-level `Delete section` danger button beside `Regenerate section`.
- Added responsive layout styles for the section action row.
- `npm run typecheck` passed.
- `npm run build` passed.
- Local dev server returned `200` at `http://127.0.0.1:3000`; in-app Browser control was unavailable in this session, so click-through UI verification could not be run.

---

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
