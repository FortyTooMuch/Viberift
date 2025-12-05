-- Add additional card detail columns
ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_type TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rarity TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS domains TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS cost INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS energy INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS power INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS might INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS collector_number TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(card_type);
CREATE INDEX IF NOT EXISTS idx_cards_domains ON cards(domains);
CREATE INDEX IF NOT EXISTS idx_cards_cost ON cards(cost);
