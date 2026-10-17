# NewsletterCreator

A local-first desktop app for writing email newsletters about any subject. Keep a few newsletters, write each edition as blocks (text, events, images, calls to action), pull in source stories if you want them, preview the email, and export self-contained HTML or hand a draft to Mailchimp.

Free and open source under the [MIT License](LICENSE). No account, no sign-in, no analytics. Everything you write stays on your computer unless you connect a service and use it.

## Download

Packages for Windows (x64), macOS (Apple Silicon) and Linux (x64 AppImage) are attached to each [GitHub Release](../../releases). They are built by the public workflow in this repository and are **not code-signed**, so each operating system shows a one-time warning for software it cannot verify; the release notes explain the two clicks needed on each platform.

## What's inside

- **Writing desk** — every newsletter in the rail, a resume card for the edition you touched last, editions as cards or a compact list.
- **Studio** — a paper-style editor with the email subject, preview text and introduction on one card, blocks below, and optional source and live-preview panels that become drawers on small windows.
- **Review & export** — desktop, mobile and plain-text previews that share one renderer with the exported HTML.
- **Optional AI** — connect an LM Studio or ComfyUI server on your own machine, install a managed local runtime after reviewing the publishers' terms, or choose OpenRouter / fal.ai explicitly. Nothing falls back to the cloud silently. Until a writing model is chosen the AI buttons lead to setup instead of a dialog that cannot run.
- **Mailchimp** — creates or updates a draft campaign with hosted images when you ask. No code sends or schedules.

## Development

Node 22.13+ and npm.

```sh
npm ci
npm run desktop:dev
```

### Verify

```sh
npm test                                   # shared helpers
npm run desktop:typecheck
npx eslint apps/desktop/src packages/core/src
npm run test --workspace @newsletter/desktop
npm run desktop:build
xvfb-run -a node tests/desktop-smoke.mjs                                      # Linux; drop xvfb-run on a desktop session
xvfb-run -a -s "-screen 0 1920x1200x24" node tests/desktop-studio.mjs
xvfb-run -a -s "-screen 0 1920x1200x24" node tests/desktop-contrast.mjs
npm run desktop:package
xvfb-run -a node tests/desktop-package-smoke.mjs
```

The smoke test checks create/edit/preview/export, restart recovery and that startup makes zero network requests. The studio suite covers source insertion, scoped undo, generation failure and retry, image persistence, save conflicts and the recovery bar, keyboard controls, modal focus, four window sizes and 125% zoom. The contrast suite re-measures text and control contrast and hit-area minimums (WCAG 2.2 AA) on nine seeded views and fails on regressions. CI runs all of this on Linux and builds packages on all three platforms; a `v*` tag publishes a release.

See [apps/desktop/README.md](apps/desktop/README.md) for the runtime boundaries, the managed local-AI installer, and the hardware and live-service checks that cannot run in CI.

## Data and network

Newsletters, editions, settings and export state live in SQLite under the OS application-data directory, with images alongside as files. API keys use Electron `safeStorage`; where the OS cannot encrypt them they are kept for the session only. Backups contain content, settings and images, never credentials.

The renderer has no Node, filesystem, credential or network access; a validated IPC boundary delegates to the main process. Source collection fetches the public URLs you added, when you ask. Local AI setup downloads engines and models after consent. Mailchimp is contacted only on an explicit action. There are no remote fonts, analytics or update checks. Third-party inference engines are separate software with their own behavior.

## Legacy web app

`apps/web` is the earlier Next.js version, kept for regression comparison. It is not part of the desktop release.

## License

MIT — see [LICENSE](LICENSE).
