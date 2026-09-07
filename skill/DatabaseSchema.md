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