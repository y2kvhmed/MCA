-- ============================================================
-- MULTIPLE FILES PER SUBMISSION
-- Lets a student attach several photos (or a PDF) to a single
-- submission. Stored as a JSONB array. The legacy single-file
-- columns (file_path/file_url/file_name/file_size/file_type)
-- stay in sync with the first file for backward compatibility.
-- ============================================================

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS files JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN submissions.files IS
  'Array of attached files: [{ path, url, name, size, type }]';
