# ✅ Migration Complete: Local Database with Dummy Data

## What Changed

The app has been updated to use **local Supabase database** instead of external APIs (Riot Games, Cardmarket). All card data and prices are now stored in Supabase and can be managed directly.

## Key Updates

### 1. Database Schema
- **Expanded `cards` table** with 18 fields including domains, abilities, rarity, tags
- **All tables updated** to use `card_id` instead of `product_id`
- **Removed deprecated fields** like `variant_code`

### 2. Seed Data Provided
- **20 sample cards** from Origins and Echoes of Eternity sets
- **Full metadata** including abilities, flavor text, domains, tags
- **Price data** ranging from €0.15 to €65.00

### 3. API Endpoints Updated
All API routes now work with local database:
- `/api/cards/search` - Searches cards table
- `/api/prices` - Reads from card_prices table
- `/api/collections/items` - Uses card_id
- `/api/profile/stats` - Uses card_id for calculations
- `/api/profile/activity` - Tracks card_id in logs

### 4. Frontend Updated
- Collection detail page uses card_id
- Search shows collector numbers
- Profile activity feed displays card_id
- CSV import/export uses new schema

## Setup Steps

1. **Run schema**: Copy `db/schema.sql` → Supabase SQL Editor → Run
2. **Load data**: Copy `db/seed_cards.sql` → Supabase SQL Editor → Run
3. **Create storage**: Follow `AVATAR_SETUP.md` for avatar uploads
4. **Start dev server**: `npm run dev`

## Testing the App

1. **Sign in** with Google or Discord
2. **Create a vault** (collection)
3. **Search for cards**: Try "Flame", "Rift", "Arcane", "Stone"
4. **Add cards** to your vault with quantities
5. **View prices** - Each card has stored price data
6. **Check profile** - See stats and activity feed
7. **Export CSV** - Download your collection data

## Sample Cards to Try

| Card Name | Set | Rarity | Price |
|-----------|-----|--------|-------|
| Flame Chompers | Origins | Common | €0.25 |
| Rift Titan | Origins | Mythic | €35.00 |
| Shadow Assassin | Origins | Rare | €5.00 |
| Rift Portal | Origins | Mythic | €65.00 |
| Chronos Keeper | Echoes | Mythic | €42.00 |

## Files Created/Updated

**New Files:**
- `db/seed_cards.sql` - 20 cards + prices
- `DATABASE_SETUP.md` - Setup guide
- `MIGRATION_NOTES.md` - Technical details
- `QUICK_START.md` - This file

**Updated Files:**
- `db/schema.sql` - Expanded cards table
- `pages/api/cards/search.ts` - Query local DB
- `pages/api/collections/items.ts` - Use card_id
- `pages/api/prices.ts` - Query card_prices
- `pages/api/profile/*.ts` - Use card_id
- `pages/collections/[id].tsx` - Frontend updates
- `lib/cardmarket.ts` - Read from Supabase
- `README.md` - Updated documentation

## Next Steps (Optional)

### Add More Cards
Insert more cards into the database:

```sql
INSERT INTO cards (card_id, name, category, domains, energy_cost, might, rarity, set_name, collector_number) 
VALUES ('FND-999/298', 'Your Card', 'Unit', ARRAY['Fury'], 4, 5, 'Rare', 'Origins', '999/298');

INSERT INTO card_prices (card_id, lowest, average, currency, last_fetched)
VALUES ('FND-999/298', 3.50, 5.00, 'EUR', NOW());
```

### Connect External APIs Later
The schema supports future API integration:
- Add sync script to pull from Riot API
- Update prices from Cardmarket periodically
- Keep local database as cache/source of truth

## Verification

Check everything works:

```sql
-- Should return 20
SELECT COUNT(*) FROM cards;

-- Should return 20
SELECT COUNT(*) FROM card_prices;

-- View a sample card
SELECT card_id, name, rarity, domains, set_name 
FROM cards 
WHERE name LIKE '%Titan%';
```

## Troubleshooting

**Cards not showing in search?**
→ Verify seed data loaded: `SELECT COUNT(*) FROM cards;`

**Prices showing €0.00?**
→ Check price data: `SELECT * FROM card_prices LIMIT 5;`

**Can't add cards to collection?**
→ Check browser console (F12) for API errors

**Avatar upload not working?**
→ Follow `AVATAR_SETUP.md` to create storage bucket

---

🎉 **You're all set!** Start building your legendary collection.
