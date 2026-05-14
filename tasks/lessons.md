# Lessons

- Do not assume the original workspace path is still current after the user says they renamed the project folder. Re-discover the active project directory and restart servers from that folder.
- Do not present optional provider metadata headers as required `.env` setup. For OpenRouter, keep the required setup focused on `OPENROUTER_API_KEY`; only mention `HTTP-Referer`/`X-Title` if the user specifically wants request attribution metadata.
- In local dev, a project `.env` file should override inherited shell environment values; otherwise stale provider keys can survive server restarts and produce misleading auth errors.
- For the current NewsletterCreator scope, do not recommend issue/history persistence by default. Persist only user configuration such as custom sources and last selected models unless the user asks for saved newsletters, publishing history, accounts, or collaboration.
- Keep source types aligned with the product language. For NewsletterCreator, expose sources as RSS feeds or website scrape targets; do not introduce provider-specific search shortcuts like HN Algolia unless the user explicitly asks for them.
