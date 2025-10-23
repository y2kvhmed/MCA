-- Simple fix for assignments table issues
-- Run this in your Supabase SQL Editor

-- First, let's check what assignment types are allowed
DO $$
BEGIN
    -- Try to insert sample assignments with proper types
    INSERT INTO assignments (
        teacher_id, 
        school_id, 
        title, 
        description, 
        instructions, 
        due_date, 
        max_score, 
        assignment_type,
        is_published
    )
    SELECT 
        (SELECT id FROM app_users WHERE email = 'teacher@physics.edu' LIMIT 1),
        (SELECT id FROM schools WHERE name = 'Physics Academy' LIMIT 1),
        'Newton''s Laws of Motion',
        'Complete the worksheet on Newton''s three laws of motion',
        'Read chapter 4 in your textbook and complete all exercises. Show your work for all calculations.',
        NOW() + INTERVAL '7 days',
        100,
        'homework',
        true
    WHERE NOT EXISTS (SELECT 1 FROM assignments WHERE title = 'Newton''s Laws of Motion')
    AND EXISTS (SELECT 1 FROM app_users WHERE email = 'teacher@physics.edu')
    AND EXISTS (SELECT 1 FROM schools WHERE name = 'Physics Academy');
    
    INSERT INTO assignments (
        teacher_id, 
        school_id, 
        title, 
        description, 
        instructions, 
        due_date, 
        max_score, 
        assignment_type,
        is_published
    )
    SELECT 
        (SELECT id FROM app_users WHERE email = 'teacher@physics.edu' LIMIT 1),
        (SELECT id FROM schools WHERE name = 'Physics Academy' LIMIT 1),
        'Energy and Work Problems',
        'Solve problems related to kinetic and potential energy',
        'Complete problems 1-15 from the energy worksheet. Include diagrams where appropriate.',
        NOW() + INTERVAL '5 days',
        80,
        'homework',
        true
    WHERE NOT EXISTS (SELECT 1 FROM assignments WHERE title = 'Energy and Work Problems')
    AND EXISTS (SELECT 1 FROM app_users WHERE email = 'teacher@physics.edu')
    AND EXISTS (SELECT 1 FROM schools WHERE name = 'Physics Academy');
    
    INSERT INTO assignments (
        teacher_id, 
        school_id, 
        title, 
        description, 
        instructions, 
        due_date, 
        max_score, 
        assignment_type,
        is_published
    )
    SELECT 
        (SELECT id FROM app_users WHERE email = 'teacher@physics.edu' LIMIT 1),
        (SELECT id FROM schools WHERE name = 'Physics Academy' LIMIT 1),
        'Physics Quiz - Chapter 1',
        'Multiple choice quiz on basic physics concepts',
        'Answer all 20 questions. You have 30 minutes to complete.',
        NOW() + INTERVAL '3 days',
        50,
        'quiz',
        true
    WHERE NOT EXISTS (SELECT 1 FROM assignments WHERE title = 'Physics Quiz - Chapter 1')
    AND EXISTS (SELECT 1 FROM app_users WHERE email = 'teacher@physics.edu')
    AND EXISTS (SELECT 1 FROM schools WHERE name = 'Physics Academy');

EXCEPTION WHEN OTHERS THEN
    -- If the above fails, let's try with minimal data
    RAISE NOTICE 'Standard insert failed, trying minimal approach: %', SQLERRM;
    
    -- Try inserting with just required fields
    INSERT INTO assignments (teacher_id, school_id, title, max_score)
    SELECT 
        (SELECT id FROM app_users WHERE email = 'teacher@physics.edu' LIMIT 1),
        (SELECT id FROM schools WHERE name = 'Physics Academy' LIMIT 1),
        'Sample Physics Assignment',
        100
    WHERE NOT EXISTS (SELECT 1 FROM assignments WHERE title = 'Sample Physics Assignment')
    AND EXISTS (SELECT 1 FROM app_users WHERE email = 'teacher@physics.edu')
    AND EXISTS (SELECT 1 FROM schools WHERE name = 'Physics Academy');
    
END $$;

-- Create a function to safely create assignments
CREATE OR REPLACE FUNCTION create_sample_assignment(
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_instructions TEXT DEFAULT NULL,
    p_max_score INTEGER DEFAULT 100,
    p_days_until_due INTEGER DEFAULT 7
)
RETURNS UUID AS $$
DECLARE
    teacher_id UUID;
    school_id UUID;
    assignment_id UUID;
BEGIN
    -- Get teacher and school IDs
    SELECT id INTO teacher_id FROM app_users WHERE email = 'teacher@physics.edu' LIMIT 1;
    SELECT id INTO school_id FROM schools WHERE name = 'Physics Academy' LIMIT 1;
    
    IF teacher_id IS NULL OR school_id IS NULL THEN
        RAISE EXCEPTION 'Teacher or school not found';
    END IF;
    
    -- Insert assignment with minimal required fields
    INSERT INTO assignments (
        teacher_id,
        school_id,
        title,
        description,
        instructions,
        due_date,
        max_score,
        is_published
    ) VALUES (
        teacher_id,
        school_id,
        p_title,
        p_description,
        p_instructions,
        NOW() + (p_days_until_due || ' days')::INTERVAL,
        p_max_score,
        true
    ) RETURNING id INTO assignment_id;
    
    RETURN assignment_id;
END;
$$ LANGUAGE plpgsql;

-- Use the function to create assignments safely
DO $$
BEGIN
    -- Only create if they don't exist
    IF NOT EXISTS (SELECT 1 FROM assignments WHERE title = 'Newton''s Laws of Motion') THEN
        PERFORM create_sample_assignment(
            'Newton''s Laws of Motion',
            'Complete the worksheet on Newton''s three laws of motion',
            'Read chapter 4 in your textbook and complete all exercises.',
            100,
            7
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM assignments WHERE title = 'Energy Problems') THEN
        PERFORM create_sample_assignment(
            'Energy Problems',
            'Solve kinetic and potential energy problems',
            'Complete problems 1-15 from the worksheet.',
            80,
            5
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM assignments WHERE title = 'Physics Quiz') THEN
        PERFORM create_sample_assignment(
            'Physics Quiz',
            'Basic physics concepts quiz',
            'Answer all questions within the time limit.',
            50,
            3
        );
    END IF;
END $$;

COMMIT;