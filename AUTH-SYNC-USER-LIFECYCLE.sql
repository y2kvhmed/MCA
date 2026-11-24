-- =============================================================================
-- AUTH-SYNC-USER-LIFECYCLE.sql
-- Keeps public.app_users and Supabase Auth (auth.users / auth.identities)
-- in sync for CREATE / EDIT / DELETE of users.
--
-- WHY THIS EXISTS
-- ---------------
-- The admin "Add user" and "Edit user" screens already write to Supabase Auth:
-- every INSERT/UPDATE on public.app_users fires trg_sync_app_user_to_auth,
-- which mirrors the row into auth.users with a bcrypt hash. That part works.
--
-- The problem is DELETE. Deleting a user only removed the public.app_users row
-- (both the in-app delete and earlier dashboard deletes), leaving an ORPHANED
-- auth.users row behind. When you then try to create a new user whose email is
-- the same as that orphan, the bridge's INSERT INTO auth.users hits the UNIQUE
-- email constraint (same email, different id) and throws, so the whole
-- transaction rolls back and NOTHING is created.
--
-- WHAT THIS DOES
-- --------------
--  PART 1  AFTER DELETE trigger -> remove the Auth account + identity too.
--  PART 2  Harden the bridge so a stale email owner is absorbed, not fatal.
--  PART 3  One-time cleanup of orphaned Auth rows that already exist.
--  PART 4  Verification query.
--
-- ROLLBACK (restores the previous behaviour)
-- ------------------------------------------
--   DROP TRIGGER  IF EXISTS trg_delete_app_user_auth ON public.app_users;
--   DROP FUNCTION IF EXISTS public.delete_app_user_auth();
--   (PART 2 keeps the same function name; re-run SECURITY-FIX-ALL-IN-ONE.sql
--    PART 1 to restore the original sync_app_user_to_auth body if needed.)
--
-- Safe to re-run (idempotent).
-- =============================================================================


-- ###########################################################################
-- PART 1 / 4 — DELETE STOPS LEAVING ORPHANS
-- ###########################################################################

CREATE OR REPLACE FUNCTION public.delete_app_user_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.identities WHERE user_id = OLD.id;
  DELETE FROM auth.users      WHERE id      = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_app_user_auth ON public.app_users;
CREATE TRIGGER trg_delete_app_user_auth
AFTER DELETE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.delete_app_user_auth();


-- ###########################################################################
-- PART 2 / 4 — BRIDGE ABSORBS A STALE EMAIL OWNER INSTEAD OF CRASHING
-- ###########################################################################
-- Same body as SECURITY-FIX-ALL-IN-ONE.sql PART 1, plus: before inserting the
-- Auth row, any leftover auth.users row that holds this email under a DIFFERENT
-- id is removed. That turns the old "unique email violation -> rollback" into a
-- successful create.

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
  IF TG_OP = 'UPDATE' THEN
    IF NEW.password_hash IS NOT DISTINCT FROM OLD.password_hash
       AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
      RETURN NEW;
    END IF;
  END IF;

  v_email := lower(trim(NEW.email));

  IF NEW.password_hash IS NULL OR NEW.password_hash = '' THEN
    RETURN NEW;
  ELSIF NEW.password_hash LIKE '$2%' THEN
    v_hash := NEW.password_hash;
  ELSE
    v_hash := crypt(NEW.password_hash, gen_salt('bf'));
  END IF;

  -- Absorb a stale owner of this email (orphan from an old delete).
  DELETE FROM auth.identities
   WHERE user_id IN (SELECT id FROM auth.users
                      WHERE lower(email) = v_email AND id <> NEW.id);
  DELETE FROM auth.users
   WHERE lower(email) = v_email AND id <> NEW.id;

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


-- ###########################################################################
-- PART 3 / 4 — ONE-TIME CLEANUP OF EXISTING ORPHANS
-- ###########################################################################
-- Removes Auth accounts that have no matching app_users profile. These are the
-- rows that block re-creating a user with the same email.

DELETE FROM auth.identities
 WHERE NOT EXISTS (SELECT 1 FROM public.app_users a WHERE a.id = auth.identities.user_id);

DELETE FROM auth.users
 WHERE NOT EXISTS (SELECT 1 FROM public.app_users a WHERE a.id = auth.users.id);


-- ###########################################################################
-- PART 4 / 4 — VERIFICATION  (all values should be 0)
-- ###########################################################################

SELECT
  (SELECT count(*) FROM public.app_users)                                             AS app_users_total,
  (SELECT count(*) FROM auth.users)                                                   AS auth_users_total,
  (SELECT count(*) FROM public.app_users u
     WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id))                 AS missing_auth_accounts,
  (SELECT count(*) FROM auth.users u
     WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id))       AS identities_missing,
  (SELECT count(*) FROM auth.users u
     WHERE NOT EXISTS (SELECT 1 FROM public.app_users a WHERE a.id = u.id))           AS orphaned_auth_accounts,
  (SELECT count(*) FROM public.app_users
     WHERE password_hash IS NOT NULL AND password_hash <> ''
       AND password_hash NOT LIKE '$2%')                                              AS plaintext_left;
