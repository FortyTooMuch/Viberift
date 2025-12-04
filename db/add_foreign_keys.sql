-- Add foreign key constraints to enable Supabase joins

-- Add foreign key from activity_log to collections
ALTER TABLE activity_log 
ADD CONSTRAINT activity_log_collection_id_fkey 
FOREIGN KEY (collection_id) 
REFERENCES collections(id) 
ON DELETE SET NULL;

-- Add foreign key from activity_log to cards (optional, for data integrity)
-- Note: This is commented out since card_id is just text and we don't have a constraint from collection_items either
-- If you want to enforce this, uncomment the line below:
-- ALTER TABLE activity_log ADD CONSTRAINT activity_log_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(card_id) ON DELETE SET NULL;
