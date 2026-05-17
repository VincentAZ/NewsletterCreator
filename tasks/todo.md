# Fix Missing Mailchimp Populated Button Footer

## Plan

- [x] Capture lesson from the continued missing button/footer after local template verification.
- [x] Inspect actual app Mailchimp render/template-section path.
- [x] Add robust generated-content fallback so the Learning Center button and footer appear even when Mailchimp preview replaces fixed template rows.
- [x] Render and inspect generated populated HTML with fallback.
- [x] Run focused checks and document results.

## Verification

- [x] Generated populated render inspected
- [x] Real Mailchimp draft read-back smoke test
- [x] `npm run typecheck`

## Review

- The old Mailchimp template-section path could return generated content while still omitting the Learning Center button; attempting to rewrite that same template-backed draft with direct HTML did not remove the old template render.
- Updated `createMailchimpCampaignDraft` / `setCampaignContent` to write complete branded HTML directly from the first content update.
- Expanded the direct HTML renderer to include the Serpico logo header, generated intro, generated hero image, generated article body, blue "Explore the Learning Center" button, divider, dark CTA, and gray footer.
- Added persistent-content read-back validation so Mailchimp drafts must contain the generated subject, Learning Center button, and footer/unsubscribe content.
- Real Mailchimp smoke draft read-back passed with `hasSubject: true`, `hasButton: true`, and `hasFooter: true`; the temporary campaign was deleted.
- Rendered the actual Mailchimp read-back HTML to `tasks/mailchimp-final-readback-768.png` and visually confirmed the blue button and gray footer are present.
- `npm run typecheck` passed.

---

# Restore Persistent Mailchimp Footer And Learning Button

## Plan

- [x] Inspect current template and app section replacement behavior.
- [x] Move "Explore the Learning Center" outside `mc:edit="body"` so app-populated body content cannot replace it.
- [x] Keep the footer outside all editable regions and verify it remains after simulated Mailchimp section replacement.
- [x] Render placeholder and simulated populated previews; inspect for button/footer and layout issues.
- [x] Patch any visual or structural issues found during verification.
- [x] Re-run editable-region and typecheck checks.
- [x] Document results.

## Verification

- [x] Placeholder render inspected
- [x] Simulated populated render inspected
- [x] Template region check
- [x] `npm run typecheck`

## Review

- Moved the blue "Explore the Learning Center" button into a fixed `learning-center-block` row outside `mc:edit="body"`, so app-generated article content no longer replaces it.
- Confirmed the gray footer remains outside all editable Mailchimp regions.
- Rendered and inspected the placeholder view in `tasks/template-placeholder-768.png`.
- Rendered and inspected a simulated populated view in `tasks/template-populated-full-768.png`; both the blue Learning Center button and gray footer are visible after body replacement.
- Final checks passed: persistent button/footer contract, four unique editable regions, and `npm run typecheck`.

---

# Visual Verify Mailchimp Template

## Plan

- [x] Capture the verification lesson after the user pointed out the missing rendered comparison.
- [x] Render `template-HTML` locally at the same 768px-wide screenshot context as the attached template.
- [x] Inspect the rendered screenshot against the attached template for header, footer, body CTA, hero, and CTA block differences.
- [x] Patch spacing/content if the rendered output is visibly off.
- [x] Re-run template-region and typecheck verification.
- [x] Document visual verification results.

## Verification

- [x] Local rendered screenshot inspected
- [x] Template region check
- [x] `npm run typecheck`

## Review

- Rendered `template-HTML` through headless Chrome using a temporary `.html` copy and saved the inspected output to `tasks/template-render-768.png`.
- Initial render showed the layout was too narrow versus the provided 768px screenshot, so the template container was widened to 720px and spacing was retuned.
- Body fallback now visually matches the placeholder structure more closely: left-aligned text, centered text inside the blue "Explore the Learning Center" button, matching body gutters, and a divider/CTA/footer flow close to the attached template.
- Local Chrome could not load the remote Mailchimp-hosted logo/divider assets in this sandbox, so the screenshot uses a visible gradient fallback for the divider and a broken remote-logo placeholder. In Mailchimp, those hosted images should load normally.
- Re-verified the four unique editable regions and ran `npm run typecheck`.

---

# Match Mailchimp Placeholder Preview

## Plan

- [x] Re-read the current `template-HTML` and prior task notes.
- [x] Adjust fallback/default content so the Mailchimp template preview matches the attached placeholder: headline only, centered placeholder hero, two body paragraphs, centered blue button, matching header/footer/CTA spacing.
- [x] Keep the app-compatible `mc:edit` regions unchanged.
- [x] Verify editable regions and run `npm run typecheck`.
- [x] Document results.

## Verification

- [x] Template region check
- [x] `npm run typecheck`

## Review

- Updated `template-HTML` fallback content to match the placeholder preview: headline-only intro, centered hero placeholder, two body paragraphs, and the centered blue "Explore the Learning Center" button.
- Tuned header/logo sizing, body padding, CTA spacing, CTA button width, and footer sizing to better match the attached template screenshot.
- Preserved the four app-populated Mailchimp Classic editable regions: `preheader`, `intro`, `hero_image`, and `body`.
- Verified the editable-region contract and ran `npm run typecheck`.

---

# Fix Preview-Matched Mailchimp Template

## Plan

- [x] Read current `template-HTML`, app Mailchimp rendering code, and existing project lessons.
- [x] Check current Mailchimp template-language docs for editable-region constraints.
- [x] Replace `template-HTML` with a Classic coded template that matches the supplied preview and app-generated content shape.
- [x] Verify required `mc:edit` regions are present and not nested.
- [x] Run focused project checks and document the result.

## Verification

- [x] Template region check
- [x] `npm run typecheck`

## Review

- Reworked `template-HTML` into a Mailchimp Classic coded template aligned with the supplied preview: taller navy logo header, generated-newsletter intro, full-width hero area, section/article body styling, divider image, dark CTA block, and muted footer.
- Moved the app-populated regions onto container elements with exactly the expected unique names: `preheader`, `intro`, `hero_image`, and `body`.
- Kept the hero region as a container so the app can inject its generated image HTML through the Mailchimp campaign-content API.
- Verified the editable-region contract and ran `npm run typecheck`.

---

# Mailchimp Preview-Matched Template HTML

## Plan

- [x] Create a new `template-HTML` file for the Mailchimp Classic template.
- [x] Keep the app-compatible editable regions: `preheader`, `intro`, `hero_image`, and `body`.
- [x] Adjust the HTML/CSS so generated newsletter content sits inside the Serpico preview layout instead of the generic placeholder layout.
- [x] Verify the file contains the required `mc:edit` regions and run focused project checks.
- [x] Document results.

## Verification

- [x] Template region check
- [x] `npm run typecheck`

## Review

- Added `template-HTML` as a Mailchimp Classic coded template with the Serpico logo header, intro, hero, generated body area, divider image, CTA, and footer.
- Preserved the app's expected editable section names: `preheader`, `intro`, `hero_image`, and `body`.
- Added body-region styles for the generated newsletter sections/articles so app-created content renders inside the branded preview layout.
- `npm run typecheck` passed.

---

# Editable Preferences Persistence Audit

## Plan

- [x] Trace source editing from dashboard input handlers through preference save and reload.
- [x] Audit every user-editable dashboard setting against the database preference payload.
- [x] Fix missing persistence/load mappings with minimal schema/API/UI changes.
- [x] Verify source URL updates persist after save and reload, including page/model load paths where applicable.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] Focused preference save/load check
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Source URL edits were already wired into the dashboard state and preferences payload, but autosave requests could finish out of order and let an older source snapshot win.
- Added a save-version guard around debounced and immediate preference saves so stale responses cannot mark old editable state as current.
- Added the currently edited prompt values to the preference row as `current_prompt_set`, so editable prompt fields are included in page/model-load persistence instead of only named prompt snapshots.
- Updated the preferences API/types/schema docs for `current_prompt_set`.
- Added a Supabase save fallback that drops missing optional preference columns one at a time, so stale live schemas no longer block source URL persistence.
- `npm run db:ensure-schema` still cannot connect to the Supabase Postgres hostname from this machine; it fails on DNS for `db.<project-ref>.supabase.co`.
- Focused API check through local Next on `127.0.0.1:3003` saved and reloaded a changed source URL successfully, then removed the temporary test row.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Verify New Classic Mailchimp Template

## Plan

- [x] Read the updated `MAILCHIMP_TEMPLATE_ID` from `.env` and inspect Mailchimp template metadata.
- [x] Run a temporary Mailchimp draft smoke test with the same template-section payload shape used by the app.
- [x] Delete the temporary smoke draft after read-back.
- [x] Relax validation so Classic HTML templates are accepted even when `default-content` does not list named sections.
- [x] Run typecheck/build verification.

## Verification

- [x] Template `10032142` read as `content_type: html`.
- [x] Smoke draft rendered non-empty HTML and contained the generated subject/body markers.
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Updated template `10032142` is Classic HTML (`content_type: html`).
- Temporary smoke draft `16b73192c7` rendered HTML length 7041 and included generated subject/body markers, then was deleted.
- Validation now accepts Classic HTML templates and relies on campaign content read-back to prove the generated newsletter rendered.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Mailchimp Correct Template Compatibility

## Plan

- [x] Inspect configured Mailchimp template metadata and default-content sections.
- [x] Test Mailchimp's documented template attach modes against the configured template.
- [x] Stop silent fallback to the app-generated layout when `MAILCHIMP_TEMPLATE_ID` is set.
- [x] Allow only API-compatible Classic templates with editable `mc:edit` sections.
- [x] Update README and lessons with the template compatibility constraint.
- [x] Run typecheck/build verification.

## Verification

- [x] Mailchimp template metadata inspected for `MAILCHIMP_TEMPLATE_ID`.
- [x] Template attach smoke tests run for `content_type: template` and `content_type: multichannel`.
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Configured template `10032140` is named `Daily AI Brief` and has Mailchimp `content_type` of `multichannel`.
- `/templates/10032140/default-content` returned no named editable sections.
- Creating a test campaign with `content_type: template` plus `template_id: 10032140` returned `template_id` 10032140 but `html_length` 0.
- Creating a test campaign with `content_type: multichannel` plus `template_id: 10032140` also returned `html_length` 0.
- The app no longer silently falls back to the generated HTML layout when `MAILCHIMP_TEMPLATE_ID` is set.
- Template mode now validates that the template is not multichannel/New Builder and exposes editable sections before creating a campaign.
- If template mode is valid, the app attempts section population and fails if Mailchimp does not return rendered newsletter HTML.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Mailchimp Preview Still Blank

## Plan

- [ ] Capture the correction that repeating UI instructions is not useful here.
- [ ] Inspect the latest Mailchimp draft content and checklist state.
- [ ] Create a controlled draft through the current code path and read back Mailchimp content.
- [x] Patch the content path to the simplest preview-reliable behavior observed.
- [x] Verify with Mailchimp read-back plus typecheck/build.

## Verification

- [x] Mailchimp read-back shows non-empty HTML content on a new controlled draft.
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Latest user-created draft `8850940784` had `template_id` 10032140, non-empty plain text, and `html_length` 0, confirming the template-section path still produced no previewable HTML.
- A controlled direct-HTML smoke draft stored non-empty HTML and included the generated subject in Mailchimp read-back; the temporary smoke draft was deleted.
- Removed the template-section content branch so `Populate Mailchimp` always writes full rendered HTML plus plain text.
- README now documents that `MAILCHIMP_TEMPLATE_ID` is intentionally not used because this account's template-section API path can produce blank previews.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Mailchimp Preview Visibility Debug

## Plan

- [x] Capture the repeated preview failure as a lesson.
- [x] Inspect newest Mailchimp draft metadata/content through read-only API calls.
- [x] Identify whether the draft is missing content, missing template association, missing preview URL, or blocked by Mailchimp checklist items.
- [x] Patch the minimal Mailchimp flow needed to create previewable drafts.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] Read-only Mailchimp draft/content inspection
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Read-only Mailchimp inspection found the newest draft `ce717bed83` had `plain_text_length` 1065 but `html_length` 0, so Mailchimp had no HTML to preview.
- The app now verifies the final stored campaign content after the HTML fallback and throws a clear error if Mailchimp still does not return previewable HTML.
- The dashboard no longer labels the public archive URL as `Preview`; new results link to the Mailchimp admin draft page using `web_id`.
- README now documents that public campaign/archive URLs are only reliable after sending.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Mailchimp Blank Preview Regression

## Plan

- [x] Capture the correction lesson from the blank preview regression.
- [x] Verify the Mailchimp template/content API behavior against official docs.
- [x] Replace the fragile template-section payload with a preview-reliable content path.
- [x] Keep `MAILCHIMP_TEMPLATE_ID` available only where it does not risk blank campaign content.
- [x] Update README to explain the reliable preview behavior and template caveat.
- [x] Run typecheck/build verification.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Mailchimp template section content is still attempted when `MAILCHIMP_TEMPLATE_ID` is configured.
- After the template content update, the app now reads campaign content back from Mailchimp and verifies the generated newsletter text appears in the rendered HTML.
- If Mailchimp accepts the template payload but does not render the generated newsletter content, the same draft is rewritten with full rendered HTML plus plain text so the preview is not blank.
- README now documents the template attempt plus reliable HTML fallback behavior.
- `tasks/lessons.md` was updated to prevent defaulting to fragile raw template-section payloads for preview-critical drafts.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Dev Server Missing Manifest Fix

---

# Restore Mailchimp Template Usage

## Plan

- [x] Confirm the current Mailchimp API flow and template payload shape.
- [x] Reintroduce server-side `MAILCHIMP_TEMPLATE_ID` support while preserving the full-HTML fallback.
- [x] Use configurable editable section names for Classic template `mc:edit` regions.
- [x] Update README setup notes so the required restart and template constraints are clear.
- [x] Run typecheck/build verification.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- `MAILCHIMP_TEMPLATE_ID` is now read server-side and, when present, campaign content is sent as a Mailchimp template payload.
- Editable template sections default to `preheader`, `intro`, `hero_image`, and `body`, with `.env` overrides available for templates that use different `mc:edit` names.
- If `MAILCHIMP_TEMPLATE_ID` is omitted, the previous full-HTML campaign content path remains in place.
- README now documents template mode, section-name overrides, and the need to restart the Next dev server after `.env` changes.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Generate Copy Prompt Trace

## Plan

- [x] Locate the dashboard `Generate copy` control and the `Copy system prompt` field.
- [x] Trace the request payload sent when `Generate copy` is clicked.
- [x] Trace the server-side draft generation prompt construction.
- [x] Answer which prompt text is used and where in the workflow `Copy system prompt` applies.

## Verification

- [x] Confirm references from source code, not only the screenshot.

## Review

- `Copy system prompt` defaults to `Return valid JSON only.` and is sent as `systemPrompt` when `Generate copy` posts to `/api/newsletter/draft`.
- The full generated copy task prompt is built separately by `buildNewsletterPrompt`, then sent as the OpenRouter user message.
- The prompt applies to the Draft Review copy-generation workflow, including whole-newsletter generation and section regeneration.

---

# Prompt Library And Visibility

## Plan

- [x] Inventory every prompt path in the app and centralize default prompt text.
- [x] Add database-backed saved prompt profiles plus last-used prompt tracking.
- [x] Expose/edit all workflow prompt templates in the UI, including the hidden draft task prompt.
- [x] Add save/select controls in the Draft Review card and apply selected prompt profiles across the workflow.
- [x] Send the edited draft task prompt to the draft API and use it server-side.
- [x] Update schema/docs and run typecheck/build verification.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Rendered dashboard smoke check for prompt controls

## Review

- Centralized default workflow prompts in `apps/web/src/lib/newsletter/prompts.ts`.
- Added editable prompt profiles covering AI scrape system prompt, AI scrape task prompt, copy system prompt, copy task prompt, image system prompt, and image task prompt.
- Added `prompt_sets` and `last_prompt_set_id` persistence through the preferences API and Supabase schema.
- Draft Review now includes a saved prompt dropdown, prompt name input, save prompt button, and new prompt button.
- The articles API now sends the edited scrape task prompt to OpenRouter for website/fallback article selection.
- The draft API now sends the edited copy task prompt to OpenRouter for whole-newsletter and section regeneration.
- README schema/docs were updated for saved prompt persistence.
- `npm run typecheck` passed.
- `npm run build` initially hit the known generated `.next` Windows `EPERM`; after stopping repo Next dev processes and removing generated `.next`, the build passed.
- `npm run db:ensure-schema` could not apply the schema because the derived Supabase database hostname did not resolve from this machine.
- Rendered dashboard smoke check at `http://127.0.0.1:3000/` confirmed `Saved prompts`, `Prompt name`, `Save prompt`, `Copy system prompt`, `Copy task prompt`, `AI scrape system prompt`, `AI scrape task prompt`, `Image system prompt`, and `Image task prompt` are present.
- Browser plugin verification was not available because the required Node REPL control tool was not exposed after tool discovery, so verification used HTTP-rendered HTML instead.
- Stopped the Codex-started dev server after verification.

---

# Release Codex Dev Server

## Plan

- [x] Identify the Codex-started dev server blocking the user's `npm run dev`.
- [x] Stop the Codex-started Next dev process tree.
- [x] Verify no repo Next dev processes remain.
- [x] Capture the lesson so future checks do not leave the user's port occupied.

## Verification

- [x] No `node.exe`/`cmd.exe` process remains with a `NewsletterCreator` dev-server command line.

## Review

- Stopped PID `41552` and its parent dev runner PID `20968`.
- Port ownership is now released for the user's terminal-run `npm run dev`.
- Added a lesson to stop Codex-owned dev servers after verification unless the user explicitly wants them kept alive.

---

# Duplicate Dev Server Cleanup

## Plan

- [x] Confirm the reported PID belongs to this repo's Next dev server.
- [x] Stop the duplicate/stale Next dev processes for `apps/web`.
- [x] Restart one dev server and verify the dashboard responds.
- [x] Document the result.

## Verification

- [x] `npm run dev` starts without the duplicate-server error
- [x] Local dashboard HTTP smoke check

## Review

- Stopped the stale duplicate Next dev processes that were holding `apps/web`.
- Restarted one dev server from the repo root.
- The app is serving at `http://localhost:3000`.
- `GET /` returned `200` and rendered the dashboard shell.
- `GET /api/newsletter/preferences?preferenceId=default-preferences` returned `200`.
- `dev-server.codex.err.log` is currently empty.

## Plan

- [x] Stop duplicate Next dev processes that are sharing the same generated `.next/dev` cache.
- [x] Clear generated `.next` output only after the repo dev processes are stopped.
- [x] Restart a single clean dev server and verify preferences/models API routes return non-500 responses.
- [x] Harden `Load models` error handling so route failures surface in UI status without an unhandled rejection.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] Preferences API smoke check
- [x] Models API smoke check
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Stopped duplicate Next dev/build processes for this repo that were sharing generated `.next/dev` state.
- Cleared generated `.next` output only after those processes were stopped.
- Restarted one clean dev server on `http://127.0.0.1:3002`.
- Verified `/api/newsletter/preferences?preferenceId=default-preferences` returns `200`.
- Verified `/api/newsletter/models` returns `200`.
- Wrapped `loadModels` in `try`/`catch`/`finally` so API failures update dashboard status and clear busy state instead of becoming an unhandled rejection.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# AI Scrape Model Closed Selector Fix

## Plan

- [x] Confirm why the Source Queue AI scrape model control can appear blank and open.
- [x] Replace the always-open scrape model list with a closed, bounded selector that preserves the selected model.
- [x] Keep search filtering and capability display intact without implicitly changing saved model selections.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Replaced the always-open Source Queue scrape model listbox with a closed native select.
- The selected scrape model is now kept as an option when the current search filter does not include it, preventing a blank selected control.
- Removed unused listbox/button styles for the old scrape picker.
- `npm run typecheck` passed.
- `npm run build` initially hit the recurring generated `.next` Windows `EPERM`; clearing generated `.next` output allowed the build to pass.
- Local HTTP smoke check at `http://127.0.0.1:3002` returned `200`, rendered `AI scrape model`, and no longer rendered the old `modelOptionList` listbox markup.

---

# Load Models Scrape Preference Reload

## Plan

- [x] Review the existing scrape model preference schema/API and dashboard load flow.
- [x] Make `Load models` refresh saved preferences and apply the stored AI scrape model after model catalogs load.
- [x] Keep automatic preference saving from overwriting the stored scrape model during the load race.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- `Load models` now fetches the active preference row alongside the model catalogs.
- If the database row has `scrapeModel`, the dashboard applies that saved AI scrape model after models load instead of falling back to the first/default model.
- If the preference fetch fails or Supabase is not configured, the existing fallback behavior remains unchanged.
- `npm run typecheck` passed.
- `npm run build` initially hit the recurring generated `.next` Windows `EPERM`; clearing generated `.next` output allowed the build to pass.

---

# Source Queue Scrape Picker Overflow Fix

## Plan

- [x] Confirm the Source Queue scrape model picker overflow behavior and the current related worktree changes.
- [x] Replace the narrow Source Queue native scrape-model dropdown with an in-pane constrained model picker.
- [x] Add focused styles so long model names/IDs wrap or truncate inside the Source Queue pane without affecting the top Models card.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Replaced the Source Queue scrape model native dropdown with a bounded in-pane option list, avoiding the browser popup that could overlap Draft Review.
- Added Source Queue-safe sizing, overflow, and selected-option styles for long OpenRouter model names and IDs.
- `npm run typecheck` passed.
- `npm run build` initially hit the known generated `.next` Windows `EPERM`; clearing generated `.next` output allowed the build to pass.
- Local HTTP smoke check at `http://127.0.0.1:3000` returned `200` and rendered the dashboard plus `modelOptionList`.

---

# Source Scrape Model Persistence And Layout Fix

## Plan

- [x] Confirm the current dashboard, preferences API, and schema handling for the AI scrape/source model.
- [x] Fix the Source Queue model picker layout so long model controls stay inside the pane and do not resize/jump.
- [x] Stop scrape model search from implicitly changing and saving the selected model while typing.
- [x] Align README schema/persistence docs with the actual `scrape_model` database column.
- [x] Improve preference save errors enough to expose missing-column/schema issues.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Fixed Source Queue model controls so long model names and capability text stay inside the source pane.
- Search fields now filter model dropdown options without implicitly changing and saving the selected copy, scrape, or image model.
- Confirmed the live database was missing `newsletter_preferences.scrape_model`; added the column and reloaded the Supabase/PostgREST schema cache.
- Verified the default preference row now saves and reloads `scrapeModel` as `openai/gpt-4.1-mini`.
- Updated `npm run db:ensure-schema` to fall back to `npx supabase db query` when `psql` is not installed.
- Updated README schema/persistence docs to include the AI scrape/source model.
- `npm run typecheck` passed.
- `npm run build` passed after clearing the known generated `.next` Windows `EPERM` lock.

---

# Mailchimp Template ID Commit

## Plan

- [x] Inspect Mailchimp environment values and current API helper behavior.
- [x] Fix the malformed local `MAILCHIMP_REPLY_TO` value.
- [x] Use the configured Mailchimp template ID when setting campaign content.
- [x] Run typecheck/build verification.
- [x] Commit the change for production testing.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Fixed the malformed local `MAILCHIMP_REPLY_TO` value.
- Mailchimp campaign creation now marks campaigns as template content and sets content with the configured `MAILCHIMP_TEMPLATE_ID`.
- Added default editable section names of `preheader`, `intro`, `hero_image`, and `body`, with optional `.env` overrides for templates that use different `mc:edit` names.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows generated `.next` `EPERM`; deleting generated `.next` output allowed a clean build to pass.

---

# Source Queue Scrape Picker Placeholder

## Plan

- [x] Adjust Source Queue so scrape model controls always use the same visible format as the Models card.
- [x] Keep scrape model controls disabled and empty until `Load models` has populated OpenRouter models.
- [x] Preserve Gather news disabled state until a loaded scrape model is available.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Source Queue now always shows the scrape model picker format: search field, model dropdown, capability panel, and helper text.
- Before `Load models`, the search and dropdown are disabled, the dropdown says `Load models first`, and the capability panel shows the load-models placeholder.
- After `Load models`, the controls populate with OpenRouter models and continue saving the selected scrape model.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows generated `.next` `EPERM`; deleting generated `.next` output allowed a clean build to pass.

---

# Source Queue Model Picker Format

## Plan

- [x] Inspect the existing Models picker structure and Source Queue scrape settings.
- [x] Add scrape model search/filter state using OpenRouter models.
- [x] Replace the compact scrape selector with the same search, select, and capability-panel format used by Models.
- [x] Preserve the existing requirement that scrape model controls appear only after `Load models`.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Source Queue now uses the same model picker format as the top Models card after `Load models`: search input, model select, and capability panel.
- Added independent scrape model search state so filtering scrape models does not affect copy model filtering.
- The scrape picker still remains hidden until OpenRouter models are loaded.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows generated `.next` `EPERM`; removing generated `.next` output allowed a clean build to pass.

---

# Disable Gather Until Models Loaded

## Plan

- [x] Capture the correction in lessons.
- [x] Inspect current Gather news enablement and status behavior.
- [x] Disable Gather news until OpenRouter models are loaded and a scrape model is selected.
- [x] Add a guard/status message if Gather news is invoked before model loading.
- [x] Verify typecheck/build and document where scrape model is persisted.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- `Gather news` was enabled because the button only checked `isBusy` and active source count.
- Added `canGatherNews`, requiring OpenRouter models to be loaded, a scrape model to be selected, active sources to exist, and no busy operation.
- Added a defensive guard in `loadArticles` that reports: `Click Load models and choose an AI scrape model before gathering news.`
- The scrape model choice is persisted in Supabase through the preferences API as `scrapeModel`, stored in the `newsletter_preferences.scrape_model` column.
- `npm run typecheck` passed.
- `npm run build` passed after deleting stale generated `.next` output inside `apps/web`.

---

# Explicit Model Load For Scrape Model

## Plan

- [x] Stop auto-loading model catalogs on dashboard startup.
- [x] Hide Source Queue scrape model selection until `Load models` has populated OpenRouter models.
- [x] Persist the selected scrape model in Supabase preferences and load it back after models are loaded.
- [x] Update help/status copy to explain the `Load models` dependency.
- [x] Update schema/types/API preference handling for `scrape_model`.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Removed automatic `/api/newsletter/models` loading from dashboard startup.
- Source Queue now shows helper text until `Load models` is clicked, then displays the `AI scrape model` selector.
- The selected scrape model is persisted through preferences as `scrapeModel` / `scrape_model`.
- Updated preference types, API payload handling, and schema script for `scrape_model`.
- Updated model/source help copy to explain that `Load models` populates copy, scrape, and image model selectors.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows generated `.next` `EPERM`; clearing generated `.next` read-only attributes allowed the build to pass.

---

# Scrape Model Catalog Choices

## Plan

- [x] Capture the correction in lessons.
- [x] Inspect current model-loading flow and scrape model dropdown behavior.
- [x] Auto-load model catalogs on startup so scrape model choices are populated without a separate click.
- [x] Improve scrape model helper text/status so it is clear the selector uses OpenRouter models.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- The scrape model selector showed one option because the OpenRouter catalog was only loaded after clicking `Load models`.
- The dashboard now loads `/api/newsletter/models` during initial state load, so scrape/copy/image model selectors are populated automatically.
- Added helper text under `AI scrape model` showing how many OpenRouter models are loaded.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Visible AI Scrape Prompt And Model

## Plan

- [x] Capture the correction in lessons.
- [x] Add source-scrape system prompt and model controls to the Source Queue section.
- [x] Pass the selected scrape prompt/model through the articles API.
- [x] Update website AI scraping to use request-provided prompt/model with env fallbacks.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Added an `AI scrape model` selector in Source Queue.
- Added an editable `AI scrape system prompt` field in Source Queue.
- The Gather news request now sends `scrapeModel` and `scrapeSystemPrompt` to `/api/newsletter/articles`.
- Website AI scraping now uses the request-provided prompt/model, falling back to `OPENROUTER_SCRAPE_MODEL`, `OPENROUTER_MODEL`, and then `openai/gpt-4.1-mini`.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows generated `.next` `EPERM`; clearing generated `.next` read-only attributes allowed the build to pass.

---

# AI Website Source Scraping

## Plan

- [x] Update lessons for the correction that website sources must be AI-scraped.
- [x] Inspect the current website source scrape path and article route.
- [x] Replace direct regex article extraction with AI-assisted extraction from fetched page context.
- [x] Keep RSS parsing unchanged and preserve existing dedupe/scoring behavior.
- [x] Add graceful errors when website AI scraping cannot run.
- [x] Run typecheck/build verification and document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Website sources now fetch the source page and send compact link/page context to OpenRouter for AI article selection.
- Removed the direct regex-to-article path; regex is now only used to collect candidate links for the AI scraper to evaluate.
- If the source page has no usable links, the page-title fallback is still passed through AI before becoming an article.
- Google News fallback candidates are also AI-selected before being accepted.
- RSS feeds remain mechanically parsed as feeds.
- Website AI scraping requires `OPENROUTER_API_KEY`; `OPENROUTER_SCRAPE_MODEL` can optionally override the scrape model, otherwise `OPENROUTER_MODEL` or `openai/gpt-4.1-mini` is used.
- `npm run typecheck` passed.
- The first build attempts hit the recurring Windows generated `.next` `EPERM`; clearing generated `.next` read-only attributes allowed `npm run build` to pass.

---

# Editable Generation System Prompts

## Plan

- [x] Inspect the current Generate Copy and Generate Image UI/API request flow.
- [x] Add visible editable system prompt controls in both sections.
- [x] Send the edited prompts to the copy and image generation APIs.
- [x] Update server-side generation helpers to honor the provided prompts with sane defaults.
- [x] Run typecheck/build verification and a local rendered-page smoke check.
- [x] Document results.

## Verification

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Local dashboard smoke check includes both editable prompt fields

## Review

- Added editable Copy system prompt and Image system prompt textareas in the Generate Copy and Generate Image sections.
- The draft API now accepts the edited copy system prompt and passes it to OpenRouter as the chat system message, falling back to `Return valid JSON only.` when blank.
- The image API now accepts the edited image system prompt and prepends it to the generated image prompt before fal.ai receives the request.
- Styled the prompt editors with a compact monospace textarea treatment.
- `npm run typecheck` passed.
- The first `npm run build` hit the recurring Windows `.next` `EPERM`; clearing generated `.next` read-only attributes allowed the build to pass.
- Local dashboard smoke check at `http://127.0.0.1:3000` confirmed both prompt fields render.

---

---

# Vercel Deployment Failure Fix

## Plan

- [x] Inspect project/package/Vercel-relevant configuration.
- [x] Reproduce the deploy build failure locally.
- [x] Fix the root cause with the smallest viable change.
- [x] Run verification commands that cover Vercel's build path.
- [x] Document the result and any deploy follow-up.

## Verification

- [x] `npm run build`
- [x] `npm run typecheck`
- [x] `git ls-files | rg '(^|/)\.next/'` returns no tracked `.next` files

## Review

- The app build itself was not failing locally; `npm run build` completed successfully.
- Vercel's log included the key warning: `.next` was uploaded, and the deployment entered `@vercel/next` legacy mode.
- Confirmed `apps/web/.next` was committed/tracked in git, including generated build and dev artifacts.
- Added `.next` and `apps/web/.next` to `.gitignore`.
- Removed `apps/web/.next` from git tracking with `git rm --cached -r`, leaving local generated files alone.
- `npm run typecheck` passed.
- `npm run build` passed after the generated artifacts were untracked.
- No `.next` files remain in `git ls-files`, so the next Vercel deployment should build from source instead of uploaded build output.

---

# Website Source Partial Result Fix

## Plan

- [x] Reproduce or isolate why a website source can stop below its configured limit.
- [x] Adjust website scraping so sparse direct scrape results can be supplemented by fallback results.
- [x] Verify The Decoder web source returns up to its configured limit.
- [x] Run typecheck/build verification.
- [x] Document results.

## Verification

- [x] The Decoder website source API probe
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Website scraping could return a short nonzero direct scrape result and stop before trying the fuller fallback.
- Updated website sources to supplement direct scrape results with fallback feed results, dedupe, sort by score, and then apply the configured source limit.
- The persisted The Decoder source used `the-decoder.de`, whose Google News `site:` fallback only returned 3 items.
- Added equivalent-host fallback search for The Decoder so `the-decoder.de` also searches `the-decoder.com`.
- The persisted The Decoder web source with limit 20 now returns 20 articles through the API.
- `npm run typecheck` passed.
- `npm run build` passed.

---

# Website Source Gather Fix

## Plan

- [x] Review the website source fetch and parse logic.
- [x] Reproduce the empty result with a website source through the local articles API or a focused helper probe.
- [x] Fix the root cause with minimal changes to website scraping.
- [x] Verify website sources return articles and RSS sources still work.
- [x] Run typecheck/build verification.
- [x] Document results.

## Verification

- [x] Website source API probe
- [x] RSS source API probe
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- The Decoder website URL reproduced the empty result because direct fetches return HTTP 500 in this environment.
- Website sources now try the direct page scrape first, then fall back to a Google News RSS `site:domain AI` query when the site cannot be fetched or has no scrapeable links.
- Added browser-like accept/user-agent headers for website fetches.
- Cleaned feed text extraction so escaped Google News HTML summaries are stripped before display.
- Website API probe for The Decoder returned articles through the fallback.
- RSS API probe for OpenAI Blog still returned articles.
- `npm run typecheck` passed.
- `npm run build` passed.

---

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

---

# Mailchimp Blank Preview Fix

## Plan

- [x] Reproduce the current Mailchimp content payload shape from code and identify why Mailchimp preview can render blank.
- [x] Change the Mailchimp content update to provide full rendered HTML plus plain text while preserving required campaign settings.
- [x] Run a focused Mailchimp payload smoke check so the preview path cannot regress silently.
- [x] Run typecheck/build verification.
- [x] Document results and remaining Mailchimp account-side checks.

## Verification

- [x] Mailchimp payload smoke check
- [x] `npm run typecheck`
- [x] `npm run build`

## Review

- Root cause: the configured Mailchimp template exposes zero editable default-content sections, so the previous `template.sections` payload could be accepted without producing visible preview content.
- Campaign creation now uses a normal regular campaign and updates `/campaigns/{id}/content` with full rendered `html` plus `plain_text`.
- Removed the runtime dependency on `MAILCHIMP_TEMPLATE_ID` and `MAILCHIMP_SECTION_*` values; README now documents only the Mailchimp values required by the current HTML-content flow.
- A temporary Mailchimp draft smoke test confirmed full HTML content is stored by Mailchimp, then deleted the temporary draft.
- `npm run typecheck` passed.
- `npm run build` passed.

---

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
