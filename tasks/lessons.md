# Lessons

- Do not assume the original workspace path is still current after the user says they renamed the project folder. Re-discover the active project directory and restart servers from that folder.
- Do not present optional provider metadata headers as required `.env` setup. For OpenRouter, keep the required setup focused on `OPENROUTER_API_KEY`; only mention `HTTP-Referer`/`X-Title` if the user specifically wants request attribution metadata.
- In local dev, a project `.env` file should override inherited shell environment values; otherwise stale provider keys can survive server restarts and produce misleading auth errors.
