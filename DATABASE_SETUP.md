# Database Setup Guide

This guide will help you set up the Supabase database with the complete schema and seed data for Rift Architect.

## Prerequisites

- Supabase account and project created
- Supabase URL and Service Role Key in `.env.local`

## Step 1: Run the Schema

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `db/schema.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute

This creates all the necessary tables:
- `collections` - User's vaults
- `collection_items` - Cards in each vault
- `cards` - Card catalog with full metadata
- `card_prices` - Price data for cards
- `user_profiles` - User profile info
- `activity_log` - Activity feed data
- `share_links` - Shareable collection links
- `price_alerts` - Price alert configuration

## Step 2: Load Seed Data

1. Still in the **SQL Editor**
2. Copy the entire contents of `db/seed_cards.sql`
3. Paste into the SQL Editor
4. Click **Run** to execute

This populates:
- **20 sample cards** from the Origins and Echoes of Eternity sets
- **Price data** for all seeded cards (in EUR)

Sample cards include:
- Flame Chompers (Common Unit)
- Rift Titan (Mythic Unit)
- Arcane Bolt (Common Spell)
- Forge Hammer (Uncommon Relic)
- Rift Portal (Mythic Legendary Artifact)
- And 15 more...

## Step 3: Set Up Storage (For Avatar Uploads)

Follow the steps in `AVATAR_SETUP.md` to create the storage bucket and policies for profile picture uploads.

## Verify Setup

After running both SQL files, verify the setup:

```sql
-- Check cards table
SELECT COUNT(*) FROM cards;
-- Should return 20

-- Check prices table
SELECT COUNT(*) FROM card_prices;
-- Should return 20

-- Preview a card
SELECT card_id, name, category, rarity, set_name FROM cards LIMIT 3;
```

## Card Data Structure

Each card includes:
- `card_id` - Unique identifier (e.g., "FND-006/298")
- `name` - Card name
- `category` - Unit, Spell, or Relic
- `domains` - Array of domain types (Fury, Order, Cunning, Growth)
- `energy_cost` - Energy required to play
- `power_cost` - Power cost (for spells)
- `might` - Unit strength
- `rarity` - Common, Uncommon, Rare, or Mythic
- `tags` - Array of card tags (Guardian, Spirit, etc.)
- `abilities_text` - Card abilities
- `flavor_text` - Lore text
- `category_subtype` - Equipment, Legendary Artifact, etc.
- `set_name` - Set name
- `collector_number` - Collector number
- `is_alt_art` - Alternative art variant flag
- `is_overnumbered` - Overnumbered card flag

## Next Steps

After database setup is complete:

1. Run `npm run dev` to start the development server
2. Sign in with Google or Discord OAuth
3. Create your first vault (collection)
4. Search for cards and inscribe them to your vault
5. Check your profile to see stats and activity feed

## Troubleshooting

**Cards not showing in search:**
- Verify seed data was loaded: `SELECT COUNT(*) FROM cards;`
- Check browser console for API errors

**Prices showing as €0.00:**
- Verify price data was loaded: `SELECT COUNT(*) FROM card_prices;`
- Prices are cached for 10 minutes

**Activity feed empty:**
- Activity is logged when you add/remove cards from collections
- Try adding a card to see it appear in the feed
