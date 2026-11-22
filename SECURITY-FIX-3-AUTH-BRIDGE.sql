-- =============================================================================
-- SECURITY FIX 3 — SUPABASE AUTH BRIDGE  (RUN THIS FIRST)
-- =============================================================================
-- WHY
--   The app currently keeps its own login (a JSON blob in local storage) and
--   compares passwords in the plain-text `app_users.password_hash` column.
--   Because no real Supabase session exists, `auth.uid()` is always NULL and
--   NO row-level-security rule can tell one user from another. That is the root
--   cause of the whole security problem.
--
-- WHAT THIS SCRIPT DOES
--   1. Creates a real Supabase Auth account for EVERY row in `app_users`,
--      reusing the SAME uuid, email and password. After this, a normal login
--      (supabase.auth.signInWithPassword) returns a valid session and the
--      database can identify the caller with auth.uid().
--   2. Installs a trigger so any FUTURE user created by the admin (insert), any
--      password change (update) is automatically mirrored into Supabase Auth.
--   3. Removes the plain-text secret from `app_users`: after mirroring, the
--      column is overwritten with the bcrypt hash only. Passwords are never
--      stored in clear text again.
--
-- SAFETY
--   * No user is deleted and no login is broken: the SAME password keeps working.
--   * Idempotent: safe to run again; existing accounts are refreshed, not
--     duplicated, and already-bcrypt values are reused as-is.
--
-- RUN ORDER
--   1. THIS script.
--   2. Deploy the updated app (new login code) and verify everyone can log in.
--   3. SECURITY-FIX-2-SQL-ADVISOR-CLEANUP.sql
--   4. SECURITY-FIX-4-RLS-LOCKDOWN.sql
-- =============================================================================

-- Password hashing lives in pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Sync function: mirror one app_users row into auth.users + auth.identities,
--    then replace the stored secret with the bcrypt hash only.
--    SECURITY DEFINER so it runs with the privileges needed to write to the
--    auth schema even when triggered by the anon key from the app.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_app_user_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_hash  text;
  v_email text;
BEGIN
  -- Ignore this function's own "store the bcrypt hash" follow-up write, and any
  -- update that touched neither the password nor the email.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.password_hash IS NOT DISTINCT FROM OLD.password_hash
       AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
      RETURN NEW;
    END IF;
  END IF;

  v_email := lower(trim(NEW.email));

  IF NEW.password_hash IS NULL OR NEW.password_hash = '' THEN
    RETURN NEW;                        -- nothing to mirror
  ELSIF NEW.password_hash LIKE '$2%' THEN
    v_hash := NEW.password_hash;       -- already a bcrypt hash, reuse it
  ELSE
    v_hash := crypt(NEW.password_hash, gen_salt('bf'));
  END IF;

  -- (a) the auth user
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_hash,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.created_at, NOW()),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', NEW.role),
    jsonb_build_object('role', NEW.role, 'name', NEW.name)
  )
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        email              = EXCLUDED.email,
        updated_at         = NOW();

  -- (b) the email identity (required to sign in on current Supabase).
  --     Built as a dynamic statement so the same SQL works whether the identity
  --     columns are uuid or text (the schema changed between Supabase versions).
  EXECUTE format(
    'INSERT INTO auth.identities
       (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
     VALUES (%L, %L, %L::jsonb, %L, %L, NOW(), NOW(), NOW())
     ON CONFLICT DO NOTHING',
    NEW.id::text,
    NEW.id::text,
    json_build_object('sub', NEW.id::text, 'email', v_email, 'email_verified', true)::text,
    'email',
    NEW.id::text
  );

  -- (c) never keep a clear-text secret on the row.
  IF NEW.password_hash NOT LIKE '$2%' THEN
    UPDATE public.app_users SET password_hash = v_hash WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_app_user_to_auth ON public.app_users;
CREATE TRIGGER trg_sync_app_user_to_auth
AFTER INSERT OR UPDATE OF password_hash, email ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.sync_app_user_to_auth();

-- -----------------------------------------------------------------------------
-- 2. Backfill: create an Auth account for every existing app_users row and
--    replace the clear-text password with its bcrypt hash.
--    Each row is handled independently so one bad email cannot abort the run.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r       RECORD;
  v_hash  text;
  v_email text;
  ok      int := 0;
  failed  int := 0;
BEGIN
  FOR r IN SELECT id, email, password_hash, role, name, created_at FROM public.app_users LOOP
    BEGIN
      v_email := lower(trim(r.email));

      IF r.password_hash IS NULL OR r.password_hash = '' THEN
        -- No usable password: skip mirroring, leave the row untouched.
        failed := failed + 1;
        RAISE NOTICE 'Auth bridge skipped % (%) : empty password', r.email, r.id;
        CONTINUE;
      ELSIF r.password_hash LIKE '$2%' THEN
        v_hash := r.password_hash;
      ELSE
        v_hash := crypt(r.password_hash, gen_salt('bf'));
      END IF;

      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
      ) VALUES (
        r.id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        v_hash,
        COALESCE(r.created_at, NOW()),
        COALESCE(r.created_at, NOW()),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', r.role),
        jsonb_build_object('role', r.role, 'name', r.name)
      )
      ON CONFLICT (id) DO UPDATE
        SET encrypted_password = EXCLUDED.encrypted_password,
            email              = EXCLUDED.email,
            updated_at         = NOW();

      EXECUTE format(
        'INSERT INTO auth.identities
           (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
         VALUES (%L, %L, %L::jsonb, %L, %L, NOW(), NOW(), NOW())
         ON CONFLICT DO NOTHING',
        r.id::text,
        r.id::text,
        json_build_object('sub', r.id::text, 'email', v_email, 'email_verified', true)::text,
        'email',
        r.id::text
      );

      -- Replace the clear-text secret with the bcrypt hash (the trigger's own
      -- guard stops this from re-running the sync work).
      IF r.password_hash NOT LIKE '$2%' THEN
        UPDATE public.app_users SET password_hash = v_hash WHERE id = r.id;
      END IF;

      ok := ok + 1;
    EXCEPTION WHEN others THEN
      failed := failed + 1;
      RAISE NOTICE 'Auth bridge skipped % (%): %', r.email, r.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Auth bridge complete. mirrored %, skipped %', ok, failed;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Verification — run this SELECT and read the result.
--    missing_auth_accounts    : should be 0 (users who still cannot sign in)
--    identities_missing       : should be 0
--    plaintext_passwords_left : should be 0 (no clear-text secret remains)
-- -----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.app_users)                                  AS app_users_total,
  (SELECT count(*) FROM auth.users)                                        AS auth_users_total,
  (SELECT count(*) FROM public.app_users u
     WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id))      AS missing_auth_accounts,
  (SELECT count(*) FROM public.app_users u
     WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id)) AS identities_missing,
  (SELECT count(*) FROM public.app_users
     WHERE password_hash IS NOT NULL
       AND password_hash <> ''
       AND password_hash NOT LIKE '$2%')                                   AS plaintext_passwords_left;
