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

## Rules

1. **Cross-platform first.** Every change must work on iOS, Android and web. Check `Platform.OS` before using native-only APIs (haptics, secure store, maps) and provide a web fallback.
2. **TypeScript strict.** No `any` unless unavoidable; type Supabase rows and component props.
3. **Match existing code.** Follow the naming, styling and file structure already in the repo. Reuse components in `components/` and helpers in `lib/` before writing new ones.
4. **Check dependencies before adding.** Use `npx expo install <pkg>` so versions match the SDK. Don't add a library for something the current stack already does.
5. **Keep changes small.** Do only what was asked. No drive-by refactors or reformatting of unrelated code.
6. **Docs may be stale, so verify against the code and the SQL in `supabase/`.** The `skill/` docs describe intent, but some are out of date (for example the user tables and roles differ between docs). Treat the code and `supabase/` SQL as the source of truth.

## Supabase and security

- Never commit secrets, service-role keys or `.env` files. Only the public anon key belongs in client code.
- Store tokens and credentials with `lib/secureStorage.ts`, not AsyncStorage or plain state.
- Schema changes go in a SQL file under `supabase/` and in `skill/DatabaseSchema.md`. Never edit the live database by hand.
- Any new table needs Row Level Security policies.
- Don't edit anything under `supabase/.temp/`.

## Git

- Don't commit or push unless asked.
- Write short, imperative commit messages.
