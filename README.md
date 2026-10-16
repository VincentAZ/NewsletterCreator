# NewsletterCreator

A local-first desktop workspace for newsletters about any subject. Curate source material, write original updates, arrange stories/events/images/calls to action, and export an email or create a Mailchimp draft.

The Electron desktop app is the primary experience on `feat/local-first-redesign`. The previous Next.js app is retained in `apps/web` for regression comparison; its stabilized release stays on `main`.

## Desktop development

Use Node 22.13+ and npm. No cloud credentials are required for manual writing, local storage, image uploads, previews, or HTML export.

```sh
npm ci
npm run desktop:dev
```

For local inference, connect an existing LM Studio HTTP server and ComfyUI in Settings, choose installed models, then generate. Local URLs must use loopback. OpenRouter and fal.ai are explicit optional choices; local failure never switches providers.

The Local AI setup screen detects hardware/connections, discloses model downloads and publisher terms, and offers resumable, checksum-verified setup. See [desktop implementation and release gates](apps/desktop/README.md) before testing managed installation.

## Build and verify

```sh
npm run desktop:typecheck
npx eslint apps/desktop/src packages/core/src
npm run test --workspace @newsletter/desktop
npm run desktop:build
npm run desktop:package
```

Linux UI smoke testing: `xvfb-run -a node tests/desktop-smoke.mjs` after building. The test uses a disposable local database. The active CI workflow targets Windows NSIS, Apple Silicon macOS DMG, and Linux AppImage packages. Artifacts are unsigned development previews unless signing credentials are explicitly supplied to electron-builder.

## Data and deliberate network use

Settings, newsletter profiles, issues, provenance and export recovery state live in SQLite under Electron's OS application-data directory. Images live alongside it. API keys use Electron safeStorage backed by OS facilities; insecure Linux fallback is rejected in favor of session-only keys. Backups contain content/settings/assets, not credentials. Supabase import only reads the chosen preferences row and preserves its legacy prompt/model choices without activating cloud providers.

The renderer cannot access Node, filesystem, credentials or arbitrary networks. A validated IPC boundary delegates privileged actions to the main process. Gathering accesses public source URLs only on request. Setup downloads engines/models after consent. Mailchimp uploads assets and creates or updates a draft only when requested. No code sends or schedules campaigns.

Our app has no analytics, remote fonts or automatic update checks. This is not a claim that the complete third-party inference stack is telemetry-free; that requires separate dependency inspection and real-engine network capture.

## Existing hosted web app

See [web setup and private deployment](apps/web/README.md). Production requires access credentials and the preferences revision migration. Without access credentials the dashboard and APIs return HTTP 503. A fail-closed deployment is protected, but is not yet ready for use until configured and tested with the personal deployment account.

```sh
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

Repository remote operations use the personal GitHub account. Desktop work remains separate from `main`. The existing AILearningCenter mirror is temporarily disabled: its previous `--mirror` command attempted to delete destination `main` on a feature push. The replacement helper is tested against temporary repositories and its repaired workflow is published on both branches. Re-enabling the private-repository mirror awaits explicit destination approval.
