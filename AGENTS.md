# EV Charging Queue

Expo / React Native app (Expo Router, TypeScript) with a Supabase backend. Runs on iOS, Android and web (deployed on Vercel).

## Expo has changed

Your training data is out of date. Before writing any Expo, Expo Router or React Native code, read the docs for the version in `package.json` (currently Expo SDK 57): https://docs.expo.dev/versions/latest/

## Commands

- `npm start` – start the dev server
- `npm run android` / `npm run ios` / `npm run web` – run on a platform
- `npm run lint` – run ESLint (`expo lint`); run it after changes and fix what you introduced

## Project layout

- `app/` – Expo Router screens and layouts (file-based routing), grouped by role:
  - `index.tsx`, `_layout.tsx` – landing page and root layout
  - `customer/` – join queue, queue status, tracking
  - `public/` – public queue board
  - `sa/` – service advisor login and dashboard
  - `admin/` – manager login, dashboard, password reset
  - `admin/settings/` – bays, blocked plates, operating hours, showroom location, terms, create manager/SA (`showroom.native.tsx` is the native variant of `showroom.tsx`)
- `components/` – shared UI components
- `lib/` – helpers (ETA, geocoding, alerts, secure storage)
- `supabase/` – SQL setup and migration scripts
- `skill/` – product and design docs (PRD, schema, ETA calculation, system flow, roadmap). Read the relevant one before changing that area.

## Code style and conventions

1. **Cross-platform first.** Every change must work on iOS, Android and web. Check `Platform.OS` before using native-only APIs (haptics, secure store, maps) and provide a web fallback.
2. **TypeScript strict.** No `any` unless unavoidable; type Supabase rows and component props.
3. **Reuse before adding.** Look in `components/` and `lib/` first; shared domain types live in `types/domain.ts`. Platform variants use `.native.tsx` / `.web.tsx` suffixes (e.g. `Analytics.web.tsx`, `showroom.native.tsx`).
4. **Install packages with `npx expo install <pkg>`** so versions match the SDK. Don't add a library for something the current stack already does.
5. **Touch only the files the request needs.** No reformatting or refactors of unrelated code.
6. **Docs may be stale, so verify against the code and the SQL in `supabase/`.** The `skill/` docs describe intent, but some are out of date (for example the user tables and roles differ between docs). Treat the code and `supabase/` SQL as the source of truth.

## Testing

No test suite exists. After changes: run `npm run lint` and fix what you introduced, then check the affected flow with `npm run web`. For anything using GPS, maps, haptics or secure storage, also check the web fallback path. If you couldn't run the app, say so.

## Supabase and security

- Never commit secrets, service-role keys or `.env` files. Only the public anon key belongs in client code.
- Store tokens and credentials with `lib/secureStorage.ts`, not AsyncStorage or plain state.
- Schema changes go in a SQL file under `supabase/` and in `skill/DatabaseSchema.md`. Never edit the live database by hand.
- Any new table needs Row Level Security policies.
- Don't edit anything under `supabase/.temp/`.

## How it works (read before changing queue logic)

- **Domain**: walk-in FCFS queue for a showroom's EV charging bays. Customers (no login) join via QR + GPS on-site check (or a GPS-override request an SA approves); SAs start/end sessions manually; Managers (`admin` role) configure bays, hours, blocked plates, terms, staff accounts. The app never talks to charger hardware.
- **State**: `context/QueueContext.tsx` is the single client store (bays, queue entries, sessions, all mutations). Types are in `types/domain.ts`. Session timer math and ETA are in `lib/eta.ts` and `QueueContext`.
- **Realtime vs polling**: `bays`, `showroom_settings` and `charging_sessions` use Supabase Realtime. `queue_entries` is deliberately **not** in the Realtime publication (it carries phone numbers) and is polled every 4–5 s. Don't add it to the publication.
- **Anon exposure**: anonymous customers can only read a column subset of `queue_entries` (no name/phone); lookups go through the `find_my_queue_entry` RPC. Don't widen anon reads.
- **GPS is re-validated server-side** by a Postgres trigger (`enforce_gps_validation`) from submitted lat/lng. The client `gpsValidated` flag is UI feedback only.
- **Privileged actions** (create/delete SA, create manager, reset SA password) run in Deno Edge Functions under `supabase/functions/` using the service-role key. They must never move into the client.
- **Route guarding**: use `lib/useRequireRole.ts`; never trust route params for access, always round-trip `supabase.auth.getUser()` and check role in `app_metadata`/`user_metadata`.
- **Device gate**: a device that has visited any `/customer` or `/public` route is redirected from `/` back into the customer flow unless it holds a staff session. Remember this when testing SA/manager login on a used device.
- **Migrations** in `supabase/*_setup.sql` are applied incrementally by hand (SQL editor or CLI), starting with `queue_setup.sql`. Add a new file rather than editing an applied one.
- **Env**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SITE_URL` (must exactly match a Supabase Auth redirect allow-list entry). `.env`, `.env.development`, `.env.production` exist locally; never print or commit them.
- **Deploy**: static web export (`npx expo export -p web` → `dist/`) on Vercel via `vercel.json`.

## Commits and PRs

- Don't commit or push unless asked.
- Commit subjects are imperative and under 72 characters. Run `npm run lint` before committing.
- Never commit `.env*` files or the service-role key.
