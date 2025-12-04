-- Add language column to collection_items table
ALTER TABLE collection_items 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'EN';

-- Add index for language searches
CREATE INDEX IF NOT EXISTS idx_collection_items_language 
ON collection_items(language);
