-- ==============================================================================
-- SYSTEM SECURITY, MAINTENANCE & INTEGRITY FIXES SCRIPT (UPDATED)
-- ==============================================================================
-- Run this standalone script in the Supabase SQL Editor.
-- It is 100% idempotent and safe to run multiple times.
-- ==============================================================================

-- 1. Ensure app_settings table exists and has all required columns
CREATE TABLE IF NOT EXISTS public.app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    allow_student_login BOOLEAN NOT NULL DEFAULT true,
    allow_teacher_login BOOLEAN NOT NULL DEFAULT true,
    maintenance_message TEXT DEFAULT 'The app is currently undergoing scheduled maintenance. Please check back shortly.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist in case the table was created earlier with a partial schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'maintenance_mode') THEN
        ALTER TABLE public.app_settings ADD COLUMN maintenance_mode BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'allow_student_login') THEN
        ALTER TABLE public.app_settings ADD COLUMN allow_student_login BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'allow_teacher_login') THEN
        ALTER TABLE public.app_settings ADD COLUMN allow_teacher_login BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'maintenance_message') THEN
        ALTER TABLE public.app_settings ADD COLUMN maintenance_message TEXT DEFAULT 'The app is currently undergoing scheduled maintenance. Please check back shortly.';
    END IF;
END $$;

-- Enable Row Level Security (RLS) on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (needed for maintenance check before and during login)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public read on app_settings" ON public.app_settings;
    CREATE POLICY "Allow public read on app_settings" ON public.app_settings
    FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Allow all on app_settings" ON public.app_settings;
    CREATE POLICY "Allow all on app_settings" ON public.app_settings
    FOR ALL USING (true) WITH CHECK (true);
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.app_settings TO anon, authenticated, service_role;

-- Ensure default settings row (id = 1) exists
INSERT INTO public.app_settings (id, maintenance_mode, allow_student_login, allow_teacher_login, maintenance_message)
VALUES (1, false, true, true, 'The application is undergoing scheduled maintenance. Please check back shortly.')
ON CONFLICT (id) DO UPDATE SET
    maintenance_message = COALESCE(public.app_settings.maintenance_message, EXCLUDED.maintenance_message);

-- 2. Foreign Key Cascade Protections
-- Ensures deleting an assignment automatically cascades without foreign key constraint violation
DO $$
BEGIN
    -- Fix submissions foreign key to cascade on assignment delete
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'submissions_assignment_id_fkey'
    ) THEN
        ALTER TABLE public.submissions DROP CONSTRAINT submissions_assignment_id_fkey;
        ALTER TABLE public.submissions 
            ADD CONSTRAINT submissions_assignment_id_fkey 
            FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
    END IF;

    -- Fix assignment_comments foreign key if the table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'assignment_comments'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'assignment_comments_assignment_id_fkey'
        ) THEN
            ALTER TABLE public.assignment_comments DROP CONSTRAINT assignment_comments_assignment_id_fkey;
            ALTER TABLE public.assignment_comments 
                ADD CONSTRAINT assignment_comments_assignment_id_fkey 
                FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Ensure teacher_schools cascades on delete
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'teacher_schools_teacher_id_fkey'
    ) THEN
        ALTER TABLE public.teacher_schools DROP CONSTRAINT teacher_schools_teacher_id_fkey;
        ALTER TABLE public.teacher_schools 
            ADD CONSTRAINT teacher_schools_teacher_id_fkey 
            FOREIGN KEY (teacher_id) REFERENCES public.app_users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'teacher_schools_school_id_fkey'
    ) THEN
        ALTER TABLE public.teacher_schools DROP CONSTRAINT teacher_schools_school_id_fkey;
        ALTER TABLE public.teacher_schools 
            ADD CONSTRAINT teacher_schools_school_id_fkey 
            FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Verification output
SELECT 
    'SUCCESS: System settings & security fixes are live!' AS status,
    (SELECT maintenance_mode FROM public.app_settings WHERE id = 1) AS maintenance_mode_status,
    (SELECT COUNT(*) FROM public.schools) AS total_schools,
    (SELECT COUNT(*) FROM public.app_users) AS total_users;
