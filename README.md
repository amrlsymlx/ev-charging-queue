# Summary
**EV Charging Queue Management**

A walk-in EV charging queue system for a car showroom. Customers scan a QR code, verify they're on-site via GPS, and join a single shared FCFS queue for one of the showroom's charging bays. Service Advisors (SA) run charging sessions from a dashboard; Managers/Admins configure bays, staff accounts, operating hours, and review history. The app does **not** control the charger hardware directly — starting/ending charging is a manual SA action that starts a timer.

Built with Expo (React Native + Web) and Supabase (Postgres, Auth, Realtime, Edge Functions), deployed as a static web app.

---

## Overview

- **Single shared queue, 2 physical bays** (configurable), First Come First Served.
- **No appointment / walk-in only.** Customer provides name, phone, plate number, and battery %.
- **GPS-gated join**: customer must be within a configured radius of the showroom, or submit a GPS override request for SA approval.
- **Manual charging control**: SA explicitly starts/ends each session; the system just tracks bay status, elapsed time, and history.
- **Three user surfaces**: Customer (public, no login), SA (dashboard, login required), Manager/Admin (settings + SA dashboard, login required).
- **Public live board**: a read-only screen (e.g. for a lobby TV) showing bay status and the waiting queue.

---

## Flow

### Customer flow
```
Scan QR code
  → Land on /customer
  → GPS check (within radius?)
      YES → Registration form (name, phone, plate, battery %, T&Cs)
      NO  → Submit GPS override request → wait for SA approval
  → Queue entry created (status: waiting)
  → Live queue/status screen
      - current bay occupants
      - live waiting list + own position
      - estimated waiting time (ETA)
  → SA starts charging → status: charging (grace period, then charging countdown)
  → SA ends charging → status: completed, session recorded
```
Customers can also look up an existing entry later via plate number + phone (`/customer/track`), since the anon read of the shared queue list never exposes names/phone numbers.

### SA flow
```
Login (/sa/login)
  → Dashboard (/sa/dashboard)
  → View live queue + bay status
  → Start Charging  (assign waiting entry → bay; waiting → charging)
  → Timer runs (grace + charging minutes, editable per entry)
  → End Charging     (charging → completed; bay → available)
  → Skip / Remove entries, approve/reject GPS overrides, toggle Rain Mode
```

### Manager/Admin flow
Everything an SA can do, plus settings screens under `/admin/settings`:
- Bays — add/rename/enable/disable/reorient bays
- Blocked plate numbers
- Operating hours & public holidays
- Showroom info (name, coordinates, GPS radius)
- Terms & Conditions text
- Create SA / Manager accounts, reset SA passwords
- Charging duration & grace period defaults
- Activity log and exportable session/queue history (Excel/PDF)

### GPS override flow
```
Customer outside radius → requests override → entry held pending
  → SA/Manager reviews
      Approve → customer proceeds into the waiting queue
      Reject  → registration blocked, entry cancelled
```

---

## Architecture

**Client**: Expo Router (file-based routing) app, deployed as a static SPA — there is no custom backend server. All business logic that must be trusted (GPS re-validation, RLS, password hashing) runs inside Postgres/Supabase, not the client.

```
app/                      Screens (Expo Router file-based routes)
  index.tsx                Landing page (SA / Manager login links)
  customer/                Public customer-facing screens (join, status, track)
  public/board.tsx         Public live queue board (read-only, for a TV/kiosk)
  sa/                       SA login + dashboard
  admin/                    Manager/Admin login, dashboard, settings/*

context/QueueContext.tsx  Central client state: loads bays / queue_entries /
                           charging_sessions from Supabase, subscribes to
                           Realtime + polling, exposes all queue/session
                           mutations (join, start/end charging, overrides,
                           bay management, rain mode) to every screen.

lib/                      Supabase client, ETA/session-timer math, GPS
                           geocoding, activity-log helper, Excel/PDF export,
                           operating-hours evaluation, secure token storage.

components/                Shared UI: queue panel, battery indicator, plate
                           badge, charger visual, sessions chart, etc.

types/domain.ts            Shared TypeScript domain types.

supabase/
  *_setup.sql               Incrementally-applied SQL migrations: tables,
                             RLS policies, triggers (e.g. server-side GPS
                             re-validation), RPCs (e.g. find_my_queue_entry,
                             set_rain_mode, set_sa_password).
  functions/                Deno Edge Functions for privileged operations
                             that need the service-role key (never exposed
                             to the client): create/delete SA accounts,
                             create manager accounts, reset SA passwords.
```

**Data flow**: screens call functions exposed by `QueueContext`, which talk directly to Supabase's Postgres REST API (`@supabase/supabase-js`) and RPCs. `bays`, `showroom_settings`, and `charging_sessions` update over Supabase **Realtime** (Postgres logical replication → websocket). `queue_entries` is deliberately excluded from the Realtime publication because it carries phone numbers, so it's kept fresh by polling instead (4–5s interval).

**Roles & auth**: Supabase Auth issues a session with `role` in `user_metadata`/`app_metadata` (`sa`, `manager`/`admin`). Row Level Security policies and Postgres triggers enforce what each role can read/write — e.g. anonymous customers only get a column subset of `queue_entries` (no name/phone), and privileged writes (creating SA accounts, resetting passwords) are done via Edge Functions using the service-role key, which never reaches the client bundle. GPS validity submitted by the client is only used for instant UI feedback; the server independently recomputes it from submitted coordinates against the showroom's stored location via a Postgres trigger.

**Session timing**: each charging session has a grace period + charging duration (defaults configurable, per-entry override supported for staff/priority vehicles). ETA for a waiting position is computed client-side by simulating which bay frees up soonest, factoring in per-entry duration overrides (`context/QueueContext.tsx`, `lib/eta.ts`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://docs.expo.dev/versions/v54.0.0/) (React Native + Expo Router, `expo-router/entry`), React 19 |
| Web output | `react-native-web`, static export (`expo export -p web`) |
| Backend | [Supabase](https://supabase.com/) — Postgres, Auth, Realtime, Row Level Security, Edge Functions (Deno) |
| Maps / geolocation | `expo-location`, `leaflet` / `react-leaflet`, `react-native-maps`, Haversine distance check |
| State | React Context (`QueueContext`) — no external state library |
| Storage | `expo-secure-store` (native keychain/keystore for auth tokens), `AsyncStorage`-free on web |
| Exports | `xlsx` (Excel export), `expo-print` + `expo-sharing` (PDF export) |
| Charts | Custom `SessionsChart` component |
| Analytics | `@vercel/analytics` |
| Hosting | Vercel (static site, `vercel.json` → `expo export -p web` → `dist/`) |
| Language | TypeScript |

---

## Input & Output

**Customer input**
- GPS coordinates (via `expo-location`), auto-captured on join
- Name, phone number, car plate number, battery percentage (slider)
- Terms & Conditions acceptance
- Optional: GPS override request reason

**Customer output**
- Live queue status: bay occupancy, own position, ETA countdown, session progress bar
- Queue lookup results (by plate + phone)

**SA input**
- Login credentials (email/password)
- Start/End charging actions (select bay, optional duration override)
- Skip/remove queue entry, approve/reject GPS override, toggle rain mode

**SA/Manager output**
- Live dashboard: both bays' status, active session timers, waiting queue
- Activity log (audit trail of every mutation, with actor/role/target/details)
- Exportable session/queue history (`.xlsx` via `lib/exportExcel.ts`, PDF via `lib/exportPdf.ts`)

**Manager-only input**
- Bay CRUD, blocked plate list, operating hours/holidays, showroom name & GPS radius, T&Cs text, SA/Manager account creation & password resets, default charging/grace duration.

**Database (Supabase Postgres) — core tables**
- `bays` — physical charging bays (status, enabled, orientation)
- `queue_entries` — one row per customer/staff queue join (status, GPS flags, battery %, timestamps)
- `charging_sessions` — one row per start→end charging session (durations, actor, timestamps)
- `showroom_settings` — singleton row: grace/charging minutes, rain mode, GPS radius, showroom name/coords
- `sa_users` — SA/manager directory (role, encrypted password copy for the custom SA login flow)
- `activity_logs` — audit trail of every mutation across the app
- Supporting tables for blocked plates, operating hours, terms & conditions

---

## How to Set Up on Another Device

> Reference the versioned Expo docs at https://docs.expo.dev/versions/v54.0.0/ — this project targets Expo SDK 57.

### Prerequisites
- Node.js (LTS) and npm
- A Supabase project (existing project, or create a new one at [supabase.com](https://supabase.com))
- Expo CLI is used via `npx`, no global install required
- Xcode (for iOS simulator) / Android Studio (for Android emulator) — optional, only needed for native builds

### 1. Clone and install
```bash
git clone <repo-url>
cd ev-charging-queue
npm install
```

### 2. Configure environment variables
Create a `.env` file (or `.env.development` / `.env.production` as needed) in the project root:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_SITE_URL=<your-deployed-site-url>   # used for auth redirect links (password reset, invites)
```
These map to `lib/supabase.ts`; `EXPO_PUBLIC_SITE_URL` **must** exactly match an entry in your Supabase project's Auth → URL Configuration → Redirect URLs allow list, or password-reset/invite links will silently fall back to the Site URL.

### 3. Set up the Supabase database
Apply the SQL migrations in `supabase/*.sql` **in order** (they're numbered/named sequentially — start with `queue_setup.sql`, then `bays_management_setup.sql`, etc.) via the Supabase SQL Editor or the Supabase CLI:
```bash
supabase link --project-ref <your-project-ref>
# then apply each supabase/*_setup.sql file, in the order listed in the folder
```
This creates the tables, RLS policies, triggers (server-side GPS re-validation, input validation), and RPCs (`find_my_queue_entry`, `set_rain_mode`, `set_sa_password`, `get_sa_password`) the app depends on.

### 4. Deploy the Edge Functions
The privileged account-management operations run as Supabase Edge Functions (they use the service-role key, which must never live in the client app):
```bash
supabase functions deploy create-sa-account
supabase functions deploy create-manager-account
supabase functions deploy delete-sa-account
supabase functions deploy reset-sa-password
```
Set the required secret on the project (not committed to the repo):
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 5. Create an initial manager account
Use the `create-manager-account` Edge Function (or the Supabase dashboard) to create the first manager login, since manager accounts are otherwise only creatable by an existing manager from within the app's Settings screen.

### 6. Run the app locally
```bash
npx expo start        # opens Expo dev tools; choose a target
npx expo start --web  # run directly in a browser
npx expo start --ios      # requires Xcode / iOS simulator
npx expo start --android  # requires Android Studio / emulator
```

### 7. Build for production (web)
```bash
npx expo export -p web
```
Outputs a static site to `dist/`, matching the `buildCommand`/`outputDirectory` in `vercel.json`. Deploy `dist/` to Vercel (or any static host) — pushing to the connected Git repo will trigger this automatically if the Vercel project is linked.

### Notes
- The app enforces a **device-level gate**: once a browser/device has visited any `/customer` or `/public` route, it's redirected away from the landing page (`/`) back into the customer flow unless it holds a valid staff session — useful for kiosk devices, but be aware of it when testing SA/Manager login on a device that already visited the customer flow.
- GPS validation defaults to a radius configured in `showroom_settings`; there is a GPS-test-enabled toggle (`supabase/add_gps_test_enabled.sql`) for testing the flow without being physically on-site — check that migration/setting before demoing off-location.
