# Database Schema

## charging_bays

Stores physical charging bays.

| Column | Type |
|----------|----------|
| id | uuid |
| name | text |
| status | text |
| created_at | timestamptz |
| updated_at | timestamptz |

Status:

- available
- occupied

Example:

Bay 1
Bay 2

---

## queue_entries

Stores active queue entries.

| Column | Type |
|----------|----------|
| id | uuid |
| name | text |
| phone_number | text |
| plate_number | text |
| battery_percentage | integer |
| joined_at | timestamptz |
| status | text |
| gps_validated | boolean |
| gps_override_requested | boolean |
| gps_override_approved | boolean |
| created_at | timestamptz |
| updated_at | timestamptz |

Status:

- waiting
- charging
- completed
- cancelled
- skipped

---

## charging_sessions

Stores completed and active charging sessions.

| Column | Type |
|----------|----------|
| id | uuid |
| queue_entry_id | uuid |
| bay_id | uuid |
| sa_name | text |
| planned_duration_minutes | integer |
| actual_duration_minutes | integer |
| started_at | timestamptz |
| ended_at | timestamptz |
| status | text |
| created_at | timestamptz |

Status:

- active
- completed
- cancelled

---

## showroom_settings (partial)

Singleton row (`id = 'main'`). Only the column added for the weekly charge
limit is documented here; see the `supabase/*_setup.sql` files for the rest.

| Column | Type |
|----------|----------|
| weekly_charge_limit_enabled | boolean (default false) |
| daily_plate_limit_enabled | boolean (default true) |

At most one of the two can be true (CHECK `showroom_settings_one_plate_limit`);
both false is allowed and means "no charge limit" (the manager dashboard
shows daily / weekly / no limit as three mutually exclusive switches). `daily_plate_limit_enabled` gates the one-queue-join-per-
plate-per-day rule (`has_plate_queued_today` RPC and `trg_enforce_plate_daily_limit`).
See `supabase/plate_limit_toggle_setup.sql`.

When true, a customer plate with an `active`/`completed` charging session
started in the last 7 days can't join the queue. Enforced by the
`trg_enforce_weekly_charge_limit` trigger on `queue_entries` (skipped for
staff) and exposed to the customer app via the
`plate_weekly_charge_available_at(p_plate)` RPC, which returns when the plate
may charge again (NULL = may join). See `supabase/weekly_charge_limit_setup.sql`.

---

## sa_users

Dashboard users.

| Column | Type |
|----------|----------|
| id | uuid |
| name | text |
| email | text |
| role | text |
| created_at | timestamptz |

Role:

- sa
- admin