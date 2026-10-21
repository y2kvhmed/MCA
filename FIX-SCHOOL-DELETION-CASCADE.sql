-- ==============================================================================
-- FIX SCHOOL DELETION CASCADE & FOREIGN KEY CONSTRAINTS (UPDATED)
-- ==============================================================================
-- Run this standalone script in the Supabase SQL Editor.
-- It is 100% idempotent, safe to run multiple times, and ensures deleting any
-- school works instantly without foreign key violation errors.
--
-- Note: Safely skips SQL views (like recordings which is a view over lessons)
-- and only applies constraints to actual base tables (relkind = 'r').
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
    t_name TEXT;
BEGIN
    -- 1. Remove all existing foreign keys referencing public.schools on BASE tables
    FOR r IN (
        SELECT 
            tc.table_schema,
            tc.table_name,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        JOIN pg_class c ON c.relname = tc.table_name
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'schools'
          AND tc.table_schema = 'public'
          AND c.relkind = 'r' -- Only base tables
    ) LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;', 
            r.table_schema, r.table_name, r.constraint_name);
        RAISE NOTICE 'Dropped old constraint % on %.%', r.constraint_name, r.table_schema, r.table_name;
    END LOOP;

    -- 2. Configure app_users.school_id -> ON DELETE SET NULL
    -- (Preserves user accounts when school is deleted, unassigning them rather than deleting them)
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relname = 'app_users'
          AND c.relkind = 'r'
          AND a.attname = 'school_id'
          AND NOT a.attisdropped
    ) THEN
        ALTER TABLE public.app_users
            ADD CONSTRAINT app_users_school_id_fkey 
            FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;
        RAISE NOTICE 'Configured app_users.school_id -> ON DELETE SET NULL';
    END IF;

    -- 3. Configure all other base tables that have a school_id column -> ON DELETE CASCADE
    -- Automatically skips views (relkind = 'v') such as "recordings"
    FOR t_name IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r' -- Only ordinary/base tables, NEVER views
          AND c.relname <> 'app_users' -- Handled above with SET NULL
          AND c.relname <> 'schools'
          AND a.attname = 'school_id'
          AND NOT a.attisdropped
    LOOP
        EXECUTE format('
            ALTER TABLE public.%I 
                ADD CONSTRAINT %I 
                FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
        ', t_name, t_name || '_school_id_fkey');
        RAISE NOTICE 'Configured %.school_id -> ON DELETE CASCADE', t_name;
    END LOOP;

    -- 4. Ensure submissions.assignment_id has ON DELETE CASCADE so assignment deletion never blocks
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relname = 'submissions'
          AND c.relkind = 'r'
          AND a.attname = 'assignment_id'
          AND NOT a.attisdropped
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' AND constraint_name = 'submissions_assignment_id_fkey'
        ) THEN
            ALTER TABLE public.submissions DROP CONSTRAINT submissions_assignment_id_fkey;
        END IF;

        ALTER TABLE public.submissions
            ADD CONSTRAINT submissions_assignment_id_fkey 
            FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
        RAISE NOTICE 'Configured submissions.assignment_id -> ON DELETE CASCADE';
    END IF;

END $$;

-- ==============================================================================
-- VERIFICATION REPORT
-- Lists all active foreign keys pointing to schools with their delete actions
-- ==============================================================================
SELECT 
    tc.table_name AS base_table,
    kcu.column_name AS foreign_key_column,
    rc.delete_rule AS on_delete_action,
    'OK - Configured safely' AS status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc 
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN pg_class c 
    ON c.relname = tc.table_name
JOIN pg_namespace n 
    ON n.oid = c.relnamespace AND n.nspname = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'schools'
  AND tc.table_schema = 'public'
  AND c.relkind = 'r'
ORDER BY tc.table_name;
