-- Simple assignment creation that works with existing constraints
-- Run this to create sample assignments

-- First, let's see what assignment types are allowed
-- Common types are usually: homework, quiz, exam, project, lab

-- Try creating assignments with different types
DO $$
DECLARE
    teacher_id UUID;
    school_id UUID;
BEGIN
    -- Get IDs
    SELECT id INTO teacher_id FROM app_users WHERE email = 'teacher@physics.edu' LIMIT 1;
    SELECT id INTO school_id FROM schools WHERE name = 'Physics Academy' LIMIT 1;
    
    IF teacher_id IS NULL THEN
        RAISE NOTICE 'Teacher not found, creating one...';
        INSERT INTO app_users (email, name, role, is_active, password_hash, school_id)
        VALUES ('teacher@physics.edu', 'Mr. Saddam', 'teacher', true, 'teacher123', school_id)
        RETURNING id INTO teacher_id;
    END IF;
    
    IF school_id IS NULL THEN
        RAISE NOTICE 'School not found, creating one...';
        INSERT INTO schools (name, description)
        VALUES ('Physics Academy', 'Default school for physics learning')
        RETURNING id INTO school_id;
        
        -- Update teacher with school
        UPDATE app_users SET school_id = school_id WHERE id = teacher_id;
    END IF;
    
    -- Try different assignment types until one works
    BEGIN
        INSERT INTO assignments (teacher_id, school_id, title, description, max_score, is_published, assignment_type)
        VALUES (teacher_id, school_id, 'Newton Laws Assignment', 'Study Newton laws of motion', 100, true, 'homework');
        RAISE NOTICE 'Created assignment with type: homework';
    EXCEPTION WHEN check_violation THEN
        BEGIN
            INSERT INTO assignments (teacher_id, school_id, title, description, max_score, is_published, assignment_type)
            VALUES (teacher_id, school_id, 'Newton Laws Assignment', 'Study Newton laws of motion', 100, true, 'quiz');
            RAISE NOTICE 'Created assignment with type: quiz';
        EXCEPTION WHEN check_violation THEN
            BEGIN
                INSERT INTO assignments (teacher_id, school_id, title, description, max_score, is_published, assignment_type)
                VALUES (teacher_id, school_id, 'Newton Laws Assignment', 'Study Newton laws of motion', 100, true, 'exam');
                RAISE NOTICE 'Created assignment with type: exam';
            EXCEPTION WHEN check_violation THEN
                -- Try without assignment_type (let it use default)
                INSERT INTO assignments (teacher_id, school_id, title, description, max_score, is_published)
                VALUES (teacher_id, school_id, 'Newton Laws Assignment', 'Study Newton laws of motion', 100, true);
                RAISE NOTICE 'Created assignment without explicit type';
            END;
        END;
    END;
    
END $$;