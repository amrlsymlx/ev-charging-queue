create table charging_bays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'available',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table queue_entries (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  phone_number text not null,

  plate_number text not null,

  battery_percentage integer not null,

  joined_at timestamptz default now(),

  status text not null default 'waiting',

  gps_validated boolean default false,

  gps_override_requested boolean default false,

  gps_override_approved boolean default false,

  created_at timestamptz default now(),

  updated_at timestamptz default now()
);

create table charging_sessions (
  id uuid primary key default gen_random_uuid(),

  queue_entry_id uuid references queue_entries(id),

  bay_id uuid references charging_bays(id),

  sa_name text not null,

  planned_duration_minutes integer default 65,

  actual_duration_minutes integer,

  started_at timestamptz,

  ended_at timestamptz,

  status text default 'active',

  created_at timestamptz default now()
);