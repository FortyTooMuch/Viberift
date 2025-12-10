-- Add share_token column to decks table for public sharing
ALTER TABLE decks ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Create index for faster lookups by share token
CREATE INDEX IF NOT EXISTS idx_decks_share_token ON decks(share_token);

-- Add comment
COMMENT ON COLUMN decks.share_token IS 'Unique token for public sharing of deck. NULL means not shared.';
