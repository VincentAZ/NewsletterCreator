# Desktop development preview

## Implemented

- Electron with a sandboxed React/Vite renderer, context isolation, validated typed IPC and denied renderer network/permission requests.
- SQLite revision-checked profiles/issues, serialized local autosave, restart recovery, assets, JSON backups and validated restore with a recovery backup.
- Library, topic-neutral newsletter setup, RSS/website/article source inbox, original and curated blocks, targeted regeneration/undo, desktop/mobile/plain-text preview, self-contained HTML export.
- Explicit local LM Studio/ComfyUI providers and optional OpenRouter/fal providers. Structured copy is validated; source IDs cannot be invented. Model failures leave the saved issue unchanged.
- Native setup with platform-specific manifests, verified/resumable downloads, isolated Python virtual environment, built-in ComfyUI SDXL graph, hardware/disk/port checks, cancellation, repair and owned-process shutdown.
- Mailchimp hosted image upload, persistent campaign/asset checkpoints, uncertain-create recovery, draft status checks and stored-HTML verification. No send/schedule routes.
- Read-only Supabase import: imported profiles retain Serpico branding and sources; all legacy model/prompt fields are archived in the local profile and backups. Reimporting the same row returns the existing imported profile. Cloud providers are never activated by import.

## Runtime boundaries

`src/main/runtime-manifest.json` pins llmster 0.0.25-1, uv 0.13.1, ComfyUI v0.41.0, Qwen3 4B Q4_K_M and SDXL 1.0 artifacts with official source URLs and SHA checks. Model downloads alone total about 9.4 GB decimal. Some publishers do not return archive sizes in HEAD responses; setup labels unknown sizes explicitly. Python 3.12.12 and PyTorch 2.9.1 are selected explicitly. Remaining transitive Python dependencies still resolve from the pinned ComfyUI requirements and need a fully hashed cross-platform lock before a stable managed-installer release.

Engine archives/models are downloaded at the user's request, not redistributed in installers. Users review linked publisher terms during setup. Model repository terms and engine terms remain independent.

The application owns its engine binaries, ComfyUI virtual environment, model downloads and only child processes it directly starts. LM Studio's upstream bootstrap also initializes its **standard user data directory**. This is not full application-directory isolation. Existing LM Studio installations are detected and never overwritten or taken over. Do not claim the stronger isolation gate has passed until a supported upstream isolated-runtime mechanism is proven. Source material is passed as untrusted reference data; it is never executed.

Inference requests are serialized, but existing engines may retain resident models. ComfyUI cancellation removes this application's queued prompt; it deliberately does not interrupt a shared server's already-running job. Automatic eviction and immediate owned-engine cancellation under memory pressure still need hardware validation.

## Verification performed and remaining gates

Automated tests cover local revisions/restarts, backup validation/assets, unrelated newsletter topics, targeted generation, malformed output and no cloud fallback, partial/all-source collection failures, resumable integrity-checked downloads, queued cancellation, private-address rejection, port conflicts and Mailchimp draft retry reuse. The Electron smoke test covers manual newsletter creation, autosave, HTML/plain-text preview and reopening a saved issue.

The following are **release blockers**, not claims of completed validation:

- Real clean-machine managed installation and text/image inference on NVIDIA Windows/Linux and Apple Silicon macOS. This development host has an existing LM Studio installation and no usable NVIDIA driver connection; it cannot stand in for those machines.
- Fully isolated LM Studio data, locked/hashed transitive Python dependencies, real-engine memory/cancellation/restart tests and third-party network capture. The app's own network boundary is independently tested.
- Live Mailchimp draft/image/content verification with personal credentials and the chosen audience. Mocked API tests do not replace a live handoff.
- Personal Vercel access credentials and Supabase revision migration, followed by authenticated dashboard/API verification for the old web release. Anonymous hosted access currently fails closed.
- Signing/notarization credentials and platform installation smoke tests. Until supplied, installers are labeled development previews.

Keep this branch separate from `main` until the release gates are met.
