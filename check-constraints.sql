-- Check what constraints exist on the assignments table
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'assignments'::regclass 
AND contype = 'c';

-- Check the actual table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'assignments' 
ORDER BY ordinal_position;