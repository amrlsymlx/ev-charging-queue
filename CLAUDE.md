@AGENTS.md

## Claude Code notes

- Read the relevant `skill/*.md` doc (PRD, DatabaseSchema, ETA-Calculation, SystemFlow, Roadmap, Internal-SA-Authentication) before changing that area, but verify against the code and `supabase/` SQL; some docs are stale.
- `README.md` has the full flow, architecture and setup guide, including the customer / SA / manager / GPS-override flows.
- `.mcp.json` connects the Supabase MCP server for this project. Use it read-only for inspection (tables, logs, advisors). Do not apply migrations or edit the live database through it unless asked; schema changes belong in a new `supabase/*_setup.sql` file plus `skill/DatabaseSchema.md`.
- Don't open or echo `.env*` files or Supabase keys.
