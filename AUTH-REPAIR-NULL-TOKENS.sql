-- Repair Auth rows created by SECURITY-FIX-3 / SECURITY-FIX-ALL-IN-ONE.
--
-- Root cause from the Supabase Auth log:
--   Scan error on column "confirmation_token"
-- The SQL bridge inserted auth.users rows without initializing nullable token
-- fields. GoTrue scans these token fields as strings and fails on NULL.
--
-- This is idempotent: it changes NULL token fields to empty strings and sets
-- empty-string defaults so future SQL-bridged accounts do not get NULL tokens.
-- It does NOT change passwords, user IDs, emails, identities, or roles.
--
-- Run in the Supabase SQL Editor. Then retry login once.

BEGIN;

DO $$
DECLARE
  token_column text;
  changed_rows bigint;
BEGIN
  FOR token_column IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'users'
      AND column_name IN (
        'confirmation_token',
        'recovery_token',
        'email_change',
        'email_change_token_new',
        'email_change_token_current',
        'phone_change',
        'phone_change_token',
        'reauthentication_token'
      )
      AND data_type IN ('text', 'character varying', 'character')
  LOOP
    EXECUTE format(
      'ALTER TABLE auth.users ALTER COLUMN %I SET DEFAULT %L',
      token_column,
      ''
    );
    EXECUTE format(
      'UPDATE auth.users SET %1$I = %2$L WHERE %1$I IS NULL',
      token_column,
      ''
    );
    GET DIAGNOSTICS changed_rows = ROW_COUNT;
    RAISE NOTICE 'Normalized % NULL value(s) in auth.users.%', changed_rows, token_column;
  END LOOP;
END;
$$;

COMMIT;

-- Verify actual user rows, not just column definitions. Every count should be 0.
SELECT
  count(*) FILTER (WHERE confirmation_token IS NULL) AS confirmation_token_null,
  count(*) FILTER (WHERE recovery_token IS NULL) AS recovery_token_null,
  count(*) FILTER (WHERE email_change IS NULL) AS email_change_null,
  count(*) FILTER (WHERE email_change_token_new IS NULL) AS email_change_token_new_null,
  count(*) FILTER (WHERE email_change_token_current IS NULL) AS email_change_token_current_null,
  count(*) FILTER (WHERE phone_change IS NULL) AS phone_change_null,
  count(*) FILTER (WHERE phone_change_token IS NULL) AS phone_change_token_null,
  count(*) FILTER (WHERE reauthentication_token IS NULL) AS reauthentication_token_null
FROM auth.users;

-- Rollback note:
-- Restoring NULL values would recreate the Auth crash. Empty and NULL both
-- mean "no token"; keep the normalized values rather than rolling this back.
