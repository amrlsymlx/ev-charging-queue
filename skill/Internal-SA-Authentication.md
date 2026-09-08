# Internal SA Authentication Design

## Overview

The EV Charging Queue System uses Supabase Auth for internal staff authentication.

Service Advisors (SA) do not use real email addresses.

Managers create SA accounts using only:

- SA Name (Username)
- Password

The system automatically generates an internal email address that is hidden from all users.

This allows us to:

- Use Supabase Auth securely
- Avoid real email requirements
- Avoid email verification
- Keep login simple for SA users

---

# Authentication Flow

## Manager Creates SA

Manager Dashboard

```text
Administration
→ User Management
→ Create SA
```

Manager enters:

```text
Username: john
Password: Password123
```

---

## Internal Email Generation

System automatically generates:

```text
john@sa.internal
```

This email is never shown to the Manager or SA.

---

## Create User

Backend creates Supabase Auth user:

```ts
const email = `${username}@sa.internal`;

await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
```

---

## Profile Creation

System creates profile record.

Example:

```sql
profiles
```

```text
id
username
role
is_active
created_at
```

Stored values:

```text
username = john
role = sa
is_active = true
```

---

# Login Flow

## Login Screen

Display:

```text
Username
Password
```

Do NOT display:

```text
Email
Password
```

---

## Login Process

User enters:

```text
Username: john
Password: Password123
```

Before login request:

```ts
const email = `${username}@sa.internal`;
```

Authenticate using Supabase:

```ts
await supabase.auth.signInWithPassword({
  email,
  password,
});
```

---

# User Experience

## What Manager Sees

User List:

```text
John
Ali
Ahmad
```

Manager never sees:

```text
john@sa.internal
ali@sa.internal
ahmad@sa.internal
```

---

## What SA Sees

Login Screen:

```text
Username
Password
```

SA never sees:

```text
Email
```

SA never knows the generated internal email.

---

# Username Rules

## Requirements

- Must be unique
- Case-insensitive
- Letters, numbers and underscore only
- Cannot contain spaces

Examples:

Valid:

```text
john
ali
ahmad_01
```

Invalid:

```text
John Doe
john@email.com
```

---

# Username Storage

Store username separately from auth email.

Example:

```sql
profiles.username
```

```text
john
```

while auth.users stores:

```text
john@sa.internal
```

---

# Account Status

Managers can disable SA accounts.

Profile table:

```text
is_active = false
```

When disabled:

```text
Login blocked
```

Message:

```text
Your account has been disabled.
Please contact your manager.
```

---

# Password Reset

Manager can reset SA passwords.

Flow:

```text
Manager
→ User Management
→ Reset Password
```

No email reset process.

No forgot password feature.

No email verification feature.

---

# Security Requirements

## Unique Username

Create unique index:

```sql
create unique index idx_profiles_username_lower
on profiles(lower(username));
```

This prevents:

```text
john
John
JOHN
```

from being created as separate accounts.

---

# Roles

Supported roles:

```text
manager
sa
```

---

## Manager Permissions

- Create Manager
- Create SA
- Disable User
- Reset Password
- View Reports
- Manage Settings

---

## SA Permissions

- Start Charging
- End Charging
- Skip Queue
- Remove Queue
- Approve GPS Override

---

# Important Rules

1. No public registration.
2. No public SA creation.
3. No public Manager creation.
4. Only authenticated Managers can create users.
5. Internal email format is hidden from all users.
6. Login always uses Username + Password.
7. Supabase Auth remains the authentication provider.