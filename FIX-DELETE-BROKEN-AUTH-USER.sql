-- =============================================================================
-- FIX — "Database error loading user" when deleting a bridged Auth account
-- =============================================================================
-- WHY THIS HAPPENS
--   SECURITY-FIX-3 / SECURITY-FIX-ALL-IN-ONE created every Auth account with a
--   direct `INSERT INTO auth.users (...)` using a SHORT column list. Supabase's
--   own signup flow fills many more columns than that.
--
--   GoTrue (Supabase Auth) reads the whole row into a Go struct. If any field it
--   expects is NULL, the scan fails. The dashboard's "Delete user" action loads
--   the user BEFORE deleting, so a malformed row makes the delete impossible
--   even though the row clearly exists.
--
--   AUTH-REPAIR-NULL-TOKENS.sql fixed the *_token columns. A row can still be
--   broken by another column, or by a missing/malformed auth.identities row.
--
-- HOW TO USE
--   Step 1 (read-only) shows exactly which columns are NULL on the broken user
--   but NOT NULL on a working user. Step 2 deletes both records.
--   Replace  student@example.com  and  admin@example.com  before running.
--   Everything here is safe to run top to bottom; Step 1 changes nothing.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- STEP 1a — which columns are NULL on the broken user and set on a good one?
--   Pick a working account (one that can log in) for the second email.
--   Whatever this list shows is the field that breaks the load.
-- -----------------------------------------------------------------------------
WITH target AS (
  SELECT id, email, to_jsonb(u) AS j
  FROM auth.users u
  WHERE lower(email) = lower('student@example.com')   -- <-- the student that won't delete
),
healthy AS (
  SELECT id, email, to_jsonb(u) AS j
  FROM auth.users u
  WHERE lower(email) = lower('admin@example.com')     -- <-- an account that logs in fine
)
SELECT t.email            AS broken_user,
       h.email            AS working_user,
       tk.key             AS column_name,
       tk.value           AS broken_value,
       hk.value           AS working_value
FROM target t
CROSS JOIN healthy h
CROSS JOIN LATERAL jsonb_each(t.j) AS tk(key, value)
JOIN LATERAL jsonb_each(h.j) AS hk(key, value) ON hk.key = tk.key
WHERE tk.value = 'null'::jsonb           -- NULL on the broken row
  AND hk.value <> 'null'::jsonb          -- but populated on a healthy row
ORDER BY tk.key;
-- Empty result = the user row itself is fine; the problem is the identity row
-- (Step 1b) or the row is missing entirely (Step 1c).


-- -----------------------------------------------------------------------------
-- STEP 1b — does this user have a usable email identity?
--   Expect exactly 1 row, provider = email, with a JSON identity_data body.
--   0 rows here is a common reason the Auth user cannot be loaded.
-- -----------------------------------------------------------------------------
SELECT i.user_id, i.id AS identity_id, i.provider, i.provider_id, i.identity_data
FROM auth.identities i
WHERE i.user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('student@example.com'));


-- -----------------------------------------------------------------------------
-- STEP 1c — confirm the profile row, and sanity-check where the duplicates are
-- -----------------------------------------------------------------------------
SELECT id, email, role, school_id, is_active
FROM public.app_users
WHERE lower(email) = lower('student@example.com');


-- -----------------------------------------------------------------------------
-- STEP 2 — delete the account properly (Auth user + identity + app profile).
--   Run this only after Step 1 confirms the id you expect.
--   Deleting the auth.identities rows first avoids FK surprises; it is harmless
--   if the foreign key already cascades.
-- -----------------------------------------------------------------------------
BEGIN;

DELETE FROM auth.identities
 WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email) = lower('student@example.com'));

DELETE FROM auth.users
 WHERE lower(email) = lower('student@example.com');

DELETE FROM public.app_users
 WHERE lower(email) = lower('student@example.com');

COMMIT;


-- -----------------------------------------------------------------------------
-- VERIFY — both should return 0 rows for that email.
-- -----------------------------------------------------------------------------
SELECT 'auth.users' AS source, count(*) AS remaining FROM auth.users
 WHERE lower(email) = lower('student@example.com')
UNION ALL
SELECT 'app_users', count(*) FROM public.app_users
 WHERE lower(email) = lower('student@example.com');


-- =============================================================================
-- ROLLBACK
--   There is none, and none is wanted: this deletes a user on purpose.
--   If the row is deleted by mistake, the account must be recreated (insert an
--   app_users row and the bridge trigger will rebuild the Auth account).
--
-- NOTE
--   Broader clean-up option: the rows the bridge created are all built from the
--   same short column list, so other accounts may be malformed the same way.
--   Step 1a with any two emails will reveal it. If you want, the same NULL
--   normalisation can be extended to every remaining column GoTrue reads.
-- =============================================================================
