-- Add trim_size column to Books for KDP cover/manuscript dimensions
-- Values: '5x8', '5.5x8.5', '6x9', '7x10', '8.5x11'
ALTER TABLE Books ADD COLUMN trim_size TEXT DEFAULT '6x9';
