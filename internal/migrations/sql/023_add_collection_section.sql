-- Add section column to CollectionDetails for prologue/epilogue designation
-- Values: NULL (normal/body), 'prologue', 'epilogue'
ALTER TABLE CollectionDetails ADD COLUMN section TEXT DEFAULT NULL;
