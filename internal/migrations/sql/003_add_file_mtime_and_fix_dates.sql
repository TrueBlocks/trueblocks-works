-- Migration 003: Add file_mtime column and standardize date formats
-- This migration:
-- 1. Adds file_mtime column to Works table
-- 2. Converts all RFC3339 timestamps to SQLite format (YYYY-MM-DD HH:MM:SS)
-- Note: file_mtime will be populated from actual files by Go code after ALTER TABLE

-- Add file_mtime column (Unix timestamp in seconds)
ALTER TABLE Works ADD COLUMN file_mtime INTEGER;

-- Standardize date formats in Works table
UPDATE Works 
SET created_at = datetime(created_at)
WHERE created_at LIKE '%T%';

UPDATE Works 
SET modified_at = datetime(modified_at)
WHERE modified_at LIKE '%T%';

-- Standardize date formats in Collections table
UPDATE Collections 
SET created_at = datetime(created_at)
WHERE created_at LIKE '%T%';

UPDATE Collections 
SET modified_at = datetime(modified_at)
WHERE modified_at LIKE '%T%';

-- Standardize date formats in Organizations table (has date_added, not created_at)
UPDATE Organizations 
SET modified_at = datetime(modified_at)
WHERE modified_at LIKE '%T%';

UPDATE Organizations 
SET date_added = datetime(date_added)
WHERE date_added LIKE '%T%';

-- Standardize date formats in Submissions table
UPDATE Submissions 
SET created_at = datetime(created_at)
WHERE created_at LIKE '%T%';

UPDATE Submissions 
SET modified_at = datetime(modified_at)
WHERE modified_at LIKE '%T%';

UPDATE Submissions 
SET submission_date = datetime(submission_date)
WHERE submission_date LIKE '%T%';

UPDATE Submissions 
SET response_date = datetime(response_date)
WHERE response_date LIKE '%T%';

-- Standardize date formats in Notes table
UPDATE Notes 
SET created_at = datetime(created_at)
WHERE created_at LIKE '%T%';

UPDATE Notes 
SET modified_at = datetime(modified_at)
WHERE modified_at LIKE '%T%';
