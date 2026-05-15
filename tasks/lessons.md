# Lessons

- Do not assume the original workspace path is still current after the user says they renamed the project folder. Re-discover the active project directory and restart servers from that folder.
- Do not present optional provider metadata headers as required `.env` setup. For OpenRouter, keep the required setup focused on `OPENROUTER_API_KEY`; only mention `HTTP-Referer`/`X-Title` if the user specifically wants request attribution metadata.
- In local dev, a project `.env` file should override inherited shell environment values; otherwise stale provider keys can survive server restarts and produce misleading auth errors.
- For the current NewsletterCreator scope, do not recommend issue/history persistence by default. Persist only user configuration such as custom sources and last selected models unless the user asks for saved newsletters, publishing history, accounts, or collaboration.
- Keep source types aligned with the product language. For NewsletterCreator, expose sources as RSS feeds or website scrape targets; do not introduce provider-specific search shortcuts like HN Algolia unless the user explicitly asks for them.
- When adding compact controls inside broader button containers, check CSS specificity against parent rules such as `.toolbar button`; use selectors specific enough to preserve intended dimensions.
- When helping with Mailchimp setup, state the required `.env` values up front before discussing template IDs or `mc:edit` section names: `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, `MAILCHIMP_TEMPLATE_ID`, `MAILCHIMP_FROM_NAME`, and `MAILCHIMP_REPLY_TO`.
- For this app, treat Mailchimp as a single-user, single-template integration. Do not add dashboard/database complexity for switching templates or section maps unless the user explicitly asks for multi-template support.
- For website source gathering, do not treat any nonzero scrape result as complete. If direct scraping returns fewer than the source limit, supplement from the fallback feed before applying the limit.
- When reproducing a source-gathering bug, use the exact persisted source URL from preferences. Similar domains can have very different fallback coverage, as with `the-decoder.de` versus `the-decoder.com`.
