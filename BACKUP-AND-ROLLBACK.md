# Backup & Rollback Guide

## DO THIS BEFORE RUNNING ANY SECURITY MIGRATION

We are changing authentication and RLS. A mistake can lock everyone out.
A backup means we can restore in 5 minutes.

---

## Method 1 (easiest): Supabase Dashboard backup

1. Open: **Project Settings → Backups**
2. If Backups is available on your plan, click **Backup now**.
3. Confirm.

If Backups is not on your plan, use Method 2.

---

## Method 2: Manual pg_dump (works on Free plan)

Run this locally. You need the **SERVICE ROLE** key from
**Project Settings → API → service_role** (NOT the anon key).

```powershell
# Install pg_dump if missing: https://www.postgresql.org/download/
# Replace HOST, PORT, DB_NAME, SERVICE_ROLE_PASSWORD with your project's values.
# Find them in Project Settings -> Database -> Connection string.

$env:PGPASSWORD = "YOUR_SERVICE_ROLE_PASSWORD"

pg_dump `
  -h db.YOURPROJECT.supabase.co `
  -p 5432 `
  -U postgres `
  -d postgres `
  -Fc `
  -f "supabase-backup-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
```

This produces a binary dump. To restore later:

```powershell
$env:PGPASSWORD = "YOUR_SERVICE_ROLE_PASSWORD"
pg_restore --clean --if-exists -h db.YOURPROJECT.supabase.co -p 5432 -U postgres -d postgres supabase-backup-YYYYMMDD-HHMMSS.dump
```

---

## What to back up even if you skip the full dump

At minimum, export these before touching auth:

```sql
-- In Supabase SQL editor, run this and save the CSV output:
SELECT id, email, name, role, is_active, password_hash
FROM app_users
ORDER BY role, name;
```

If a migration breaks login, we can restore from this CSV.

---

## Rollback if something breaks

Each SECURITY-FIX-*.sql file has a matching rollback at the top.
If login breaks after SECURITY-FIX-1, run its rollback block and report.
