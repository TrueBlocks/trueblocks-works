-- Add paper_type column to Books for KDP spine width calculation
-- Values: 'premium-color', 'standard-color', 'bw-white', 'bw-cream'
ALTER TABLE Books ADD COLUMN paper_type TEXT DEFAULT 'premium-color';
