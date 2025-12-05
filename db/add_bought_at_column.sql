-- Add bought_at column to collection_items table
-- This column stores the price paid when the card was added to the collection

ALTER TABLE collection_items
ADD COLUMN IF NOT EXISTS bought_at DECIMAL(10, 2);

-- Add comment to explain the column
COMMENT ON COLUMN collection_items.bought_at IS 'Price paid when card was added to collection';
