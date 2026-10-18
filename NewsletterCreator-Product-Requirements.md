# NewsletterCreator

## Product requirements for independent UI/UX design

Version 1.0 · October 17, 2026

## 1. Assignment

Design a desktop application that helps an ordinary person create a useful, attractive email newsletter about any subject. Use this document as the complete product brief.

Develop an independent design concept. Choose the information architecture, navigation, visual language, interaction patterns, and arrangement of content yourself. Explain how those choices help people complete the tasks described here.

This document specifies product outcomes and behavior. Section order is not a proposed screen sequence. Domain terms such as “newsletter,” “issue,” and “source” describe information; they do not prescribe menu names. No particular number of screens, columns, panels, steps, or navigation destinations is required.

The requirements describe the intended product, not a claim that every integration or release condition has already been verified. A prototype must distinguish representative sample states from operations backed by working services.

## 2. Product purpose

NewsletterCreator helps individuals and small organizations turn their own knowledge and selected source material into newsletters they can confidently share.

A newsletter may contain original announcements, commentary, curated articles, events, images, and calls to action. It can be entirely original, entirely curated, or a mixture. It must work equally well for a neighborhood group, a small business, an educator, a hobby community, or a professional publication. Technology news is one possible subject, not the default identity of the product.

The core promise is:

> Create and keep your newsletters on your computer. Write yourself or use optional AI assistance. Decide when information leaves your device.

Users must be able to produce a complete newsletter without creating an app account, configuring AI, connecting a mailing platform, or supplying news sources.

### Desired user outcomes

- Understand what the product does and begin without a technical explanation.
- Write something useful before spending time configuring tools.
- Know which newsletter and edition they are working on.
- Combine collected material with their own voice without losing either.
- Understand what AI will change before it changes anything substantial.
- Trust saving, recovery, and export behavior.
- Review what recipients will receive before handing it off.
- Return later and continue without reconstructing their work.

## 3. Users and representative situations

### Community organizer

Writes occasional updates for residents or volunteers. Has original announcements, a few local links, and event information. May never use AI. Needs a straightforward way to assemble and export an issue with a recognizable identity.

### Small business owner

Writes customer updates containing practical advice, business news, product photographs, offers, and a booking or purchase link. Has limited time and wants repeatable branding without becoming an email designer.

### Curator or subject specialist

Collects articles from several publications, evaluates relevance, adds commentary, and summarizes selected material. Needs source attribution, selective rewriting, and confidence that generated copy reflects the supplied material.

### Privacy-conscious local AI user

Wants writing and image assistance to run on their computer. Needs understandable setup, hardware guidance, connection status, and recovery when an engine or model is unavailable.

These are overlapping needs, not separate product modes that users must identify themselves with.

## 4. Product boundaries and priorities

### Required for the release

All requirements in sections 5–15 are required unless explicitly described as optional. Optional integrations must be supported, but users do not have to configure or use them.

The essential path is: create a newsletter, create an issue, write or assemble content, review it, and export it. Every design must make that path achievable without AI.

### Optional for the user

- Gathering content from the internet.
- Text and image generation.
- Managed installation of local AI dependencies.
- Connecting compatible engines that are already installed.
- Selecting cloud AI providers.
- Mailchimp draft creation.
- Importing preferences from Supabase.
- Advanced generation instructions.

### Outside this release

- Team accounts, real-time collaboration, permissions, or approval chains.
- Subscriber database management, contact imports, or segmentation inside the app.
- Sending or scheduling email campaigns from the app.
- Open tracking, click tracking, campaign analytics, or A/B testing.
- A hosted newsletter website or social publishing system.
- Cloud synchronization or an app subscription/billing system.
- An unrestricted web research agent or automatic discovery of the entire web.
- A general-purpose image editor, image inpainting, or model-training tool.
- Calendar integrations, recurring-event scheduling, or a structured event-management system.
- A requirement for direct manipulation of rendered email HTML or a full rich-text document engine.

Additional ideas may be described separately as future opportunities. They must not become prerequisites for completing the required workflows.

## 5. Core information and relationships

### Newsletter

A reusable publication identity with a name, optional topic, intended audience, voice, language, branding, collection preferences, and reusable sources. One person can maintain multiple unrelated newsletters.

Only the name is required to begin. Other information can be supplied later.

### Issue

One edition of a newsletter. An issue has an internal name, email subject, preview text, introduction, ordered content sections, collected source material, saved assets, and a last-modified time.

The internal issue name and recipient-facing email subject are distinct. Preview text is the short text that many email clients display beside or below the subject.

### Source

A reusable location from which material can be collected: an RSS/Atom feed, a website containing article links, or a specific article URL. A source has a name, type, address, and enabled/disabled state.

### Collected article

A reference item with a title, original URL, source name, publication date when available, collection time, excerpt, available readable content, and selection state. The app must distinguish full-content references from excerpt-only references.

An article being selected for drafting is different from it already being included in an issue.

### Content section

An ordered unit of issue content. Supported purposes are a curated story, original text, an event announcement, an image, and a call to action. Sections can contain editable headings and body text, a link, an image and its description, and references to supporting articles as applicable.

“Section” is a neutral content concept. The design may choose another understandable user-facing name or presentation.

### Asset

A logo or content image stored with the application’s local data. Referenced images must remain available after restarting the app or moving/deleting the original imported image file.

### Provider and operation

A provider performs text or image generation. An operation represents ongoing work such as collecting sources, downloading dependencies, generating content, or handing an issue to Mailchimp. Configuration, connectivity, operation progress, and successful completion are separate facts.

## 6. Creating, organizing, and resuming work

**ORG-01 — Start with little information.** Let a user create a newsletter by supplying only its name. Topic, audience, voice, branding, sources, and AI configuration must not block this action.

**ORG-02 — Offer optional starting points.** Support a blank beginning and useful examples for a community organization, small business, and AI news publication. Examples must be optional, editable, and clearly described. Choosing one must not lock the user into a subject or workflow.

**ORG-03 — Manage newsletter identity.** Support name, topic, audience, tone, language, organization name, brand color, logo and logo description, footer/contact information, and an optional publication-level call to action with message, label, and URL.

**ORG-04 — Work across editions.** Users can create, find, reopen, duplicate, rename, and delete issues. Show enough identifying information to distinguish similar editions, including their newsletter and last modification time.

**ORG-05 — Work across publications.** Users can maintain multiple newsletters, edit their settings, duplicate a newsletter configuration, and delete a newsletter. Duplication must clearly state what is copied; copying a configuration must not silently copy its entire issue history.

**ORG-06 — Explain destructive actions.** Deleting a newsletter must state that its associated issues will also be removed if deletion cascades. Provide confirmation or a clearly defined recovery mechanism. Avoid vague confirmations that hide the scope.

**ORG-07 — Resume meaningfully.** Reopening an issue must make its saved content and unfinished work accessible. A returning user should not have to complete introductory guidance again.

## 7. Finding and evaluating source material

**SRC-01 — Manage sources.** Add, edit, enable, disable, and remove RSS/Atom feeds, websites, and individual article URLs. Explain source types in ordinary language. Validate addresses and retain entered values when validation fails.

**SRC-02 — Configure freshness.** Let each newsletter define how far back to look for material. The supported range is 1–365 days. Do not assume the same time window is appropriate for every subject.

**SRC-03 — Collect intentionally.** Collection begins through an explicit user action. Explain that it accesses configured sources on the internet. Do not imply that this action searches every website.

**SRC-04 — Preserve useful results.** Retain successful articles when some sources fail. Report the number of successful sources, relevant result counts, and source-specific errors. Distinguish a valid result with zero matching articles from an operation that could not read any source.

**SRC-05 — Retry safely.** Allow retry after failure. Repeated collection must deduplicate articles by URL and preserve existing user content and intentional selections where applicable.

**SRC-06 — Support evaluation.** Show article title, source, available publication date, excerpt, original link, and full-content/excerpt-only status. Missing dates must be described as unavailable rather than invented. Let users inspect available article text and open the original source.

**SRC-07 — Narrow the collection.** Provide local text search, filtering by source, and a way to inspect all articles or only selected articles. Users can select and deselect individual articles and efficiently adjust larger selections.

**SRC-08 — Add material without AI.** An article can become a story section using its title, excerpt, URL, and source reference without calling a model. If the article is already included, offer a way to find that section instead of silently inserting another copy.

**SRC-09 — Keep selection comprehensible.** Distinguish “selected as material for generation” from “included in the newsletter.” Explain the scope of select-all and clear-selection actions, especially while filters are active.

**SRC-10 — Retain references.** Preserve the relationship between a story and its source material through editing and duplication. Source material is reference data, never executable instructions or authority to change app behavior.

## 8. Writing and editing an issue

**EDIT-01 — Manual authoring is complete.** Users can write the subject, preview text, introduction, and content themselves. No source collection, model connection, or account is required.

**EDIT-02 — Mix content freely.** Support curated stories, original commentary and announcements, event information, images, and calls to action in a single issue. Event information can be authored as ordinary text; a calendar or specialized date/location data model is not required.

**EDIT-03 — Edit recipient-facing content.** Users must be able to change the headings, copy, links, and image descriptions they are responsible for publishing. Generated content must remain editable. Publication branding and footer content must also be editable in an appropriate context.

**EDIT-04 — Arrange and duplicate.** Add, reorder, duplicate, and remove sections. A duplicate is independently editable and retains its associated references and images. Reordering must have a keyboard-operable alternative to dragging.

**EDIT-05 — Inspect supporting material.** Make it possible to inspect the articles supporting a story without losing the editing context. Use understandable terms such as “Sources”; do not require users to understand technical provenance terminology.

**EDIT-06 — Protect original material.** Collecting articles or generating a new draft must not erase original announcements, events, images, or calls to action. Changes to one section must not replace unrelated sections.

**EDIT-07 — Provide useful undo.** Undo supported editorial operations, including insertion, duplication, movement, removal, and AI replacement. Undoing one operation must preserve unrelated later edits. If reversing an operation conflicts with newer changes to the same content, resolve that explicitly rather than silently destroying those changes.

**EDIT-08 — Respect text editing conventions.** Native text undo remains available inside editable fields. Ctrl/Cmd+Z outside text editing can undo supported editorial operations. Do not promise unlimited or restart-persistent undo history unless it is actually implemented.

**EDIT-09 — Keep drafts intact during work.** Prevent concurrent edits that could race with an asynchronous replacement. Any temporary editing lock must have a clear reason, understandable scope, and visible completion or cancellation state.

## 9. Text generation

**TXT-01 — Make assistance optional.** AI helps the user draft and revise; it does not become a prerequisite for writing or export.

**TXT-02 — Choose the provider explicitly.** Support local text generation through LM Studio and optional cloud generation through OpenRouter. Local is the default. The chosen provider must be clear before an operation sends content.

**TXT-03 — Generate an issue draft.** Use the newsletter’s topic, audience, tone, and language; selected article material; and relevant original notes to generate a subject, preview text, introduction, and curated story sections. Original material remains independently preserved.

**TXT-04 — Confirm replacement scope.** Before replacing an existing subject, preview text, introduction, or story sections, explain exactly what will change and what will remain. A genuinely empty issue does not require an unnecessary replacement warning.

**TXT-05 — Rewrite selectively.** Let the user regenerate a selected section with a goal such as shorter, warmer, or clearer, or with custom feedback. Preserve its identity, appropriate source references, and associated assets. Do not replace the rest of the issue.

**TXT-06 — Require grounded output.** Generated material must use supplied references and original content. Do not invent quotations, dates, factual claims, source IDs, or links. Distinguish sourced reporting from the author’s commentary. Generated output still requires human review; the app must not imply that a model guarantees factual accuracy.

**TXT-07 — Handle context limits honestly.** Validate requests against the configured model capacity. If material cannot fit, explain the problem and provide an actionable next step. Do not silently drop selected stories, fabricate token precision, or switch providers.

**TXT-08 — Preserve work on failure.** Malformed output, timeout, connection failure, cancellation, or insufficient memory must not erase or partially corrupt the draft. Offer retry, adjustment of the request/provider, or continued manual writing.

**TXT-09 — Support advanced configuration.** Provide model selection, connection testing, configured context capacity, and editable writing instructions. Technical settings must be available without becoming an obstacle for people who write manually.

## 10. Images and publication identity

**IMG-01 — Import images.** Accept PNG, JPEG, and WebP files and store a durable local copy. Explain unsupported formats, invalid files, and the 12 MB file-size limit before data is lost.

**IMG-02 — Generate images optionally.** Support local generation through ComfyUI and optional cloud generation through fal.ai. Text and image provider choices are independent. A user may write manually and generate an image, or use text generation and upload an image.

**IMG-03 — Describe and replace.** Let users provide an image prompt, inspect the result, supply alternative text, replace the image, or remove it. A failed replacement must preserve the prior usable image and surrounding content.

**IMG-04 — Preserve associations.** Images must survive issue duplication, app restart, backup, and restore. Referenced assets must not be deleted merely because another issue or section is removed.

**IMG-05 — Apply branding predictably.** Newsletter identity and optional logo must be reflected in the email output. Changing application appearance is distinct from changing recipient-facing branding.

Image cropping, retouching, an asset marketplace, and a large template catalog are not required.

## 11. Local AI setup and provider management

**AI-01 — Offer three viable paths.** Users can continue without AI, connect compatible engines already on their computer, or request managed setup of supported local engines and models.

**AI-02 — Assess the computer.** Check operating system, architecture, available memory, GPU/acceleration, free disk space, relevant installed engines, and port conflicts. Give an understandable outcome and next action, not just hardware identifiers.

**AI-03 — Explain downloads before installation.** Identify engines and models, expected download/storage sizes when known, destination and ownership, and applicable publisher terms. Disclose unknown sizes. Downloads begin only after explicit user action and any necessary terms acknowledgment.

**AI-04 — Support managed installation.** Use pinned, integrity-checked artifacts from official sources and application-managed locations. The initial managed inference target is a compact Qwen-family text model and a standard SDXL image workflow using built-in ComfyUI nodes. Exact versions belong to the installation manifest, not hardcoded interface copy.

**AI-05 — Show real installation state.** Support progress, cancellation, retry, repair, and recovery after interruption. Present measured progress when available; otherwise show the actual stage without an invented completion percentage or time estimate.

**AI-06 — Respect the user’s machine.** Do not change system Python, automatically install GPU drivers, overwrite compatible user-owned engines, or take ownership of external processes. If a dependency uses storage outside an application-managed location, disclose that boundary accurately.

**AI-07 — Show meaningful readiness.** Distinguish not installed, installed but stopped, reachable, incompatible, model unavailable, and ready for the requested operation. A saved URL or model name does not prove a working connection.

**AI-08 — Control only owned engines.** Managed engines bind to loopback and are health-checked. Start and stop only processes owned by the app. For existing engines, provide connection guidance instead of implying that the app can safely stop them.

**AI-09 — Limit memory contention.** Run text and image generation sequentially by default. Explain queuing and memory-related failures. Do not promise that external engines release model memory merely because an app request completes.

**AI-10 — Make cancellation truthful.** Distinguish stopping the app’s request from stopping computation on a shared engine. If a shared engine continues processing, state that accurately; ignore unwanted late results and preserve the issue.

**AI-11 — Define hardware support.** Managed inference initially targets Windows/Linux with supported NVIDIA hardware and Apple Silicon Macs. Other hardware must retain manual writing, image import, export, and compatible existing-engine connections. Unsupported acceleration gets a specific explanation and usable alternatives.

## 12. Review and export

**OUT-01 — Review the actual output.** Show the recipient-facing email using the same rendering rules as export. Reflect the user’s latest edits and loaded images, including edits not yet saved. A review must not be a separate mock representation that differs from exported content.

**OUT-02 — Review different formats.** Support desktop-sized and mobile-sized email views and a plain-text representation. Keep the content readable and avoid clipped controls or unintended horizontal scrolling. Make clear that email clients can differ; preview is not a universal deliverability or rendering guarantee.

**OUT-03 — Preserve semantic parity.** HTML and plain text must contain the same substantive newsletter content: subject-related text, introduction, stories, original announcements, events, calls to action, relevant links, and footer information. Images must have meaningful alternative text where applicable.

**OUT-04 — Export locally.** Let the user explicitly save a self-contained HTML file with embedded local images. Show success and the destination, or a recoverable failure. Opening or reviewing an issue must not automatically export it.

**OUT-05 — Keep plain text usable.** Let users inspect and select/copy the plain-text output. A dedicated plain-text file export is a useful enhancement, not a prerequisite for this release.

**OUT-06 — Save before handoff.** Flush pending changes before exporting or creating a Mailchimp draft. If saving fails, explain that export has not completed and preserve all work.

**OUT-07 — Connect Mailchimp explicitly.** Support API credentials, audience ID, sender name, and reply-to email. Explain missing configuration where it prevents draft creation. Users exporting local HTML must not need a Mailchimp connection.

**OUT-08 — Create a draft, never send.** On explicit user request, upload the issue’s images, render content with hosted image URLs, and create or recover a Mailchimp campaign draft. Include the service-required address and unsubscribe information. Final recipient review, scheduling, and sending happen in Mailchimp.

**OUT-09 — Recover incomplete handoffs.** Persist progress, uploaded-asset mappings, and campaign IDs. Retry should resume known work and avoid unnecessary duplicate campaigns or uploads. If a creation response is lost, reconcile the uncertain outcome before creating another campaign.

**OUT-10 — Verify completion.** Only report Mailchimp success after verifying the stored campaign content and required uploaded assets. Provide a way to open the resulting draft. Do not mark an issue sent, published, reviewed, or approved merely because it has content or has been exported.

## 13. Local data, saving, and recovery

**DATA-01 — Store locally by default.** Keep newsletter definitions, issues, collected material, settings, assets, and handoff state on the user’s computer. Normal use does not require a cloud database.

**DATA-02 — Autosave safely.** Save edits automatically with visible pending, saving, saved, and failed states. A saved indicator must reflect completed persistence. Avoid stale or overlapping writes silently replacing newer content.

**DATA-03 — Guard navigation.** Switching issues or otherwise leaving work that needs saving must flush changes. If that fails, keep the work available and let the user recover. Do not discard content because the user followed a help action or opened another task.

**DATA-04 — Detect conflicts.** When another app instance has newer data, reject stale overwrites and explain the conflict. Preserve the user’s unsaved text while they decide how to recover. Do not silently choose which version wins.

**DATA-05 — Recover after restart.** Successfully saved work, source associations, images, and incomplete export recovery state must survive restarting. An unexpected interruption must not be represented as a successful operation.

**DATA-06 — Back up locally.** Export a backup containing newsletter settings, issues, collected source material, and image assets. Exclude credentials and Mailchimp campaign-recovery mappings from portable backups.

**DATA-07 — Restore deliberately.** Validate the backup before changing data. Explain that restoration replaces local newsletter data, create a recovery backup first, and preserve the machine’s credentials. Reset campaign mappings rather than accidentally reusing another installation’s handoff state. A bad backup must not destroy valid data.

**DATA-08 — Import optional Supabase preferences.** Provide an explicit, one-time, read-only import using a project URL, credentials, and preference identifier. Preserve imported branding and sources, prevent duplicate imports of the same record, and do not modify or delete remote data. Import must not silently activate a cloud AI provider. It is not a synchronization feature.

**DATA-09 — Protect credentials.** Use operating-system credential protection. If secure storage is unavailable, support session-only credentials and explain that they will need to be entered again. Never display secrets in progress messages, logs, backups, or exported newsletters.

## 14. Privacy and network boundaries

“Local” means local storage and local inference; it does not mean that reading a website or downloading a model can happen without the internet.

Required boundaries:

- No mandatory app account or online activation for manual authoring.
- No app analytics, remote fonts, automatic update checks, or background cloud-provider calls.
- Manual editing, saved-content review, local image import, and local HTML export work offline.
- Local generation works offline once compatible engines and models are installed and available.
- Source gathering, dependency downloads, optional cloud generation, Supabase import, and Mailchimp handoff require their respective network connections.
- Local provider failure must never trigger silent cloud fallback.
- Explain which content will leave the computer when users select a cloud operation.
- External source content must not execute code, change settings, issue commands, or override generation instructions.
- Differentiate the app’s verified behavior from third-party runtime behavior. Do not claim the complete AI stack is telemetry-free without examining the relevant dependencies and network traffic.

## 15. Usability, accessibility, and operational states

### Interaction requirements

- Make the next useful action understandable without requiring an interactive tutorial.
- Offer contextual help and onboarding where useful; users can dismiss it and find it again.
- Keep frequently used writing actions discoverable and advanced configuration available on demand.
- Let users take a direct manual-writing path or return to sourcing after starting to write. Do not enforce an unnecessary linear process.
- Explain technical concepts only where they affect a decision. Do not make API keys, context sizes, model identifiers, or database terminology the primary language of authoring.
- Avoid duplicating controls or instructions without a clear navigational purpose.
- Give risky replacement and deletion actions clear scope. Routine actions should not accumulate needless confirmations.
- Use truthful status language. Configuration, collection, selection, drafting, review, export, and sending are different states.

### Accessibility and window behavior

- Support keyboard access to every essential action, visible focus, logical focus order, meaningful labels, and screen-reader announcements for important status changes.
- Dialogs must manage focus and return it meaningfully when closed. Keyboard users must be able to cancel and recover.
- Do not encode meaning exclusively through color, animation, hover, or icons.
- Maintain readable text and sufficient contrast; target WCAG 2.2 AA where applicable to the desktop interface.
- Respect reduced-motion preferences and support 125% zoom without losing actions or content.
- Validate 940×680, 1280×800, 1440×900, and 1920×1080 windows. These are evaluation sizes, not prescribed layout breakpoints.
- Accommodate long newsletter names, long article titles, many sources, lengthy copy, and missing images without overlap or clipped controls.
- Retain familiar native window controls on Windows, macOS, and Linux.

### States that must be designed

For each affected workflow, show its relevant empty, working, successful, and unsuccessful states. In particular, cover:

1. First launch with no newsletters and no configured AI.
2. A newsletter with no issues, and an issue with no content.
3. No sources, only disabled sources, and a valid collection with zero matching articles.
4. Partial source failure and complete collection failure.
5. Article text unavailable beyond an excerpt; publication date unavailable.
6. Unsaved edits, saving in progress, save failure, and stale-write conflict.
7. Local engine missing, stopped, unreachable, incompatible, or missing the selected model.
8. Insufficient storage, interrupted download, integrity failure, and installation repair.
9. Generation queued, running, cancelled, timed out, invalid, or out of memory.
10. Image import cancelled or rejected; a referenced image unavailable.
11. Export cancelled, successful, or failed because the destination cannot be written.
12. Mailchimp not configured, credentials rejected, upload interrupted, and uncertain campaign creation recovered on retry.
13. Backup cancelled, created, invalid, or restored with a recovery copy available.

Errors should explain what happened, what has been preserved, and the next useful action. Keep entered values and drafts whenever recovery is possible.

## 16. Platform and implementation constraints

The deliverable is a desktop application for Windows, macOS, and Linux. The production implementation uses Electron, React, and TypeScript, with durable local structured storage and an application-owned asset directory. UI design is independent of the choice of navigation or visual styling.

Filesystem access, credentials, network operations, and engine/process management belong to trusted desktop services, not unrestricted interface code. Requests across that boundary must be typed and validated. The interface must respect service results rather than inventing readiness or completion.

The content model is structured issue fields and ordered sections. A visually fluid editing experience is welcome, but do not make the design depend on storing arbitrary executable HTML, a collaborative document engine, or a separate scratchpad system.

Operational limits that need graceful presentation:

- Up to 100 configured sources per newsletter.
- Up to 300 collected articles per issue.
- Up to 100 authored sections per issue.
- Image imports up to 12 MB in PNG, JPEG, or WebP format.
- Backup restoration up to 200 MB.
- Model-specific request limits; generated output may have stricter limits than manually authored issues.

Surface limits at relevant actions. Do not turn the writing experience into a technical capacity dashboard.

Release readiness must be established separately from visual completeness. Produce Windows installers, macOS packages, and Linux AppImage packages; label unsigned or unverified builds as development previews. Production acceptance requires platform installation and launch checks, real local text/image generation on supported hardware, recovery tests, privacy/network verification, and a live Mailchimp draft handoff when that integration is enabled. Configure signing and notarization when the necessary credentials are available. Do not imply that a successful prototype or automated mock proves those release conditions.

## 17. Shared evaluation scenarios and sample content

Use these same scenarios to make independent design proposals comparable. All names and content below are fictional fixtures. Their inclusion is not a requirement to use a particular visual theme.

### Scenario A — A newsletter without AI

Newsletter: **Oakfield Neighbors**.

Audience: local residents. Voice: warm and practical. Language: English.

Issue: **November Community Update**. Subject: **A cleanup day, a book swap, and a reason to meet**. Preview text: **Three ways to take part in the neighborhood this month.**

Content to author:

- Introduction welcoming residents and thanking volunteers.
- Original announcement: the community center is collecting unopened toiletries during November.
- Event: park cleanup on November 7, 2026, from 9–11 a.m.; meet at the east entrance and bring gloves.
- Event: book swap on November 14, 2026, from 10 a.m.–noon at the community center.
- Optional uploaded photograph with a useful description.
- Call to action: volunteer through `https://example.com/oakfield/volunteer`.

Task: start with no account, sources, AI, or Mailchimp; complete the newsletter; inspect mobile and plain-text output; save HTML; restart and reopen the issue.

### Scenario B — Curated stories plus original business content

Newsletter: **Willow & Grain**. Audience: customers of a small home-and-garden shop. Voice: knowledgeable and approachable. Collection window: 30 days.

Use three fictional collected references:

- “Five ways to prepare container gardens for cooler weather”; source **Seasonal Gardening Journal**; published October 12, 2026; full text available; URL `https://example.com/garden/containers`.
- “Repairing a wooden planter instead of replacing it”; source **Practical Home Notes**; published October 10, 2026; excerpt only; URL `https://example.com/home/planters`.
- “Local weekend markets”; source **Town Calendar**; publication date unavailable; URL `https://example.com/town/markets`.

Original material: a staff recommendation, a product photograph, and an invitation to an in-store workshop on November 21, 2026. Registration link: `https://example.com/willow/workshop`.

Task: collect material with one additional source failing; select two references; insert one without AI; generate a draft using the selected local provider; rewrite one section to be shorter; retain the workshop announcement and photograph; undo the rewrite without undoing an unrelated edit; retry collection without duplicates.

### Scenario C — A technology newsletter with optional cloud help

Newsletter: **Applied AI Notes**. Audience: professionals interested in practical AI use. Collection window: 7 days. Content: two attributed summaries, original commentary, and a training event announcement written by the author.

Task: explicitly select OpenRouter for writing and fal.ai for an illustration; understand what data each operation sends; recover from one failed generation; review the complete issue; create a Mailchimp draft with hosted images; resume an interrupted handoff without creating an avoidable duplicate. Sending remains outside the application.

### Scenario D — Local setup and recovery

Begin with an unsupported or insufficient-memory machine, then show a supported-machine setup with a download interruption. Explain the manual-writing path, connection to an existing engine, download requirements, retry, and actual model readiness. Do not show a success state merely because settings were saved.

### Scenario E — A returning writer under failure conditions

Use multiple newsletters and several similarly named issues. Make an edit, simulate a failed save, and attempt to switch issues. The work must remain available. Recover saving, reopen after restart, create a backup, reject an invalid restore, and successfully restore a valid backup after explaining replacement scope.

## 18. What each design proposal must deliver

Provide one coherent design direction with enough detail to assess both usability and feasibility:

1. **Concept and rationale:** who the design serves, its organizing idea, and the tradeoffs it makes.
2. **Information architecture:** how people find their work, write, manage references, configure optional services, and export. Choose the organization independently.
3. **Task flows:** first-use manual authoring, returning to an issue, mixed source/original authoring, local AI setup, and export/recovery.
4. **Visual system:** typography, spacing, color, hierarchy, interaction feedback, accessibility, and responsive behavior. Choose these freely.
5. **Representative interface designs:** enough views and interactions to demonstrate the complete essential path and the important states listed in section 15.
6. **Realistic content:** populated examples using the evaluation scenarios, plus useful empty states. Do not rely on placeholder charts or decorative status indicators.
7. **Interaction specification:** selection behavior, content arrangement, editing, rewrite scope, undo, saving, cancellation, dialogs, and keyboard operation.
8. **Requirement coverage:** identify where each requirement group is addressed and disclose anything not implemented in the proposal or prototype.
9. **Prototype boundaries:** clearly identify simulated service results. Do not present a mock model connection, download, save, or campaign handoff as a verified integration.

The visual concept is open. Favor a clear, distinctive and usable product over decorative novelty. Additional onboarding is only useful if it improves task completion; it cannot substitute for understandable interactions.

## 19. Acceptance and comparison criteria

Evaluate proposals using the same tasks and content, with the same constraints. Judge more than the first-launch image.

| Criterion         | Evidence to look for                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| First-use clarity | A nontechnical person can begin a manual newsletter without seeking AI configuration.                          |
| Writing quality   | Original and curated content are easy to edit, arrange, and review together.                                   |
| Cognitive load    | Important actions are understandable; optional configuration does not dominate ordinary writing.               |
| Control and trust | Replacement scope, source attribution, save state, and network destinations are clear.                         |
| Recovery          | Failed saving, collection, generation, installation, and handoff leave usable recovery paths.                  |
| Topic neutrality  | The same experience works for community, business, and technology subjects.                                    |
| Accessibility     | Essential flows work with a keyboard, readable text, adequate contrast, and zoom.                              |
| Adaptability      | The design remains usable across the specified window sizes and realistic content volumes.                     |
| Distinctiveness   | The proposal has a coherent visual and interaction identity that supports its product rationale.               |
| Feasibility       | The design respects local storage, optional integrations, structured content, and honest service capabilities. |

A strong proposal must show how a person gets from an idea to a usable newsletter and how they recover when something goes wrong. Beautiful presentation alone does not satisfy the requirements.
