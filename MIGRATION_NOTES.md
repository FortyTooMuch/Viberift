# Migration to Card-Based System

## Overview

The app has been migrated from using external API endpoints (Riot API, Cardmarket API) to using a local Supabase-based card database with dummy data. This provides a working foundation that can be connected to external APIs later.

## Key Changes

### Database Schema Updates

**`cards` table** - Expanded with full card metadata:
- `card_id` - Primary identifier (e.g., "FND-006/298")
- `name`, `category`, `domains[]`, `energy_cost`, `power_cost`, `might`
- `rarity`, `tags[]`, `abilities_text`, `flavor_text`
- `category_subtype`, `set_name`, `collector_number`
- `is_alt_art`, `is_overnumbered`

**All references changed from `product_id` to `card_id`:**
- `collection_items` table
- `card_prices` table
- `price_alerts` table
- `activity_log` table

### API Endpoints Updated

**`/api/cards/search`**
- Now queries Supabase `cards` table directly
- Full-text search on `name` and `card_id`
- Returns `card_id`, `name`, `set_name`, `collector_number`, `category`, `rarity`

**`/api/collections/items`**
- Changed from `productId` to `cardId`
- Removed `variant_code` field (no longer needed)

**`/api/prices`**
- Changed from `productId` to `cardId` query parameter
- Reads from `card_prices` table in Supabase

**`/api/profile/stats`**
- Updated to use `card_id` for price lookups
- Changed `average_price` to `average` column name

**`/api/profile/activity`**
- Updated to use `card_id` instead of `product_id`

**`/api/collections/export`**
- CSV export now uses `card_id` field
- Removed `variant_code` from export

### Frontend Updates

**`pages/collections/[id].tsx`**
- All state and functions updated to use `cardId`
- Search results now show `collector_number`
- Item display shows `card_id` instead of `product_id`
- CSV import expects `card_id` column

**`pages/profile.tsx`**
- Activity feed displays `cardId` in activity log

**`lib/cardmarket.ts`**
- Completely rewritten to fetch from Supabase `card_prices` table
- Removed RapidAPI integration
- Returns price data from local database with 10-minute cache

## Seed Data

**20 sample cards** included:
- 17 cards from "Origins" set (FND-001 to FND-295)
- 3 cards from "Echoes of Eternity" set (ECH-015 to ECH-089)

**Card variety:**
- 11 Units (Common to Mythic)
- 6 Spells (Instant & Sorcery)
- 3 Relics (Equipment & Legendary)

**Price range:**
- Commons: €0.15 - €0.40 average
- Uncommons: €1.00 - €2.00 average
- Rares: €4.50 - €7.50 average
- Mythics: €28.00 - €65.00 average

## Setup Instructions

1. **Run Schema**: Execute `db/schema.sql` in Supabase SQL Editor
2. **Load Data**: Execute `db/seed_cards.sql` in Supabase SQL Editor
3. **Verify**: Check tables have data (`SELECT COUNT(*) FROM cards;`)
4. **Test**: Search for cards, add to collections, view prices

See `DATABASE_SETUP.md` for detailed setup instructions.

## Future API Integration

The current structure is designed to easily integrate external APIs later:

**For card data:**
- Keep Supabase as the source of truth
- Optionally sync from external API periodically
- Update `cards` table via batch import

**For pricing:**
- Add background job to fetch prices from Cardmarket
- Update `card_prices` table with fresh data
- Keep existing caching mechanism

**Migration path:**
1. Create API sync script
2. Map external API fields to our schema
3. Run periodic updates (daily/weekly)
4. Keep dummy data for development/testing
