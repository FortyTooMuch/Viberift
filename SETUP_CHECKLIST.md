# 🎯 Setup Checklist

Follow this checklist to get Rift Architect running with dummy data.

## ✅ Prerequisites

- [ ] Supabase account created
- [ ] Supabase project created
- [ ] Node.js 18+ installed
- [ ] Git repo cloned locally

## ✅ Environment Setup

- [ ] Create `.env.local` file in project root
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` from Supabase project settings
- [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase project settings
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` from Supabase project settings

## ✅ Database Setup

- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Copy contents of `db/schema.sql`
- [ ] Paste into SQL Editor and click **Run**
- [ ] Verify: No errors in execution
- [ ] Copy contents of `db/seed_cards.sql`
- [ ] Paste into SQL Editor and click **Run**
- [ ] Verify: Check `SELECT COUNT(*) FROM cards;` returns 20
- [ ] Verify: Check `SELECT COUNT(*) FROM card_prices;` returns 20

## ✅ Storage Setup (For Avatars)

- [ ] Go to Supabase Dashboard → Storage
- [ ] Click **New Bucket**
- [ ] Name: `profiles`
- [ ] Check **Public bucket** ✅
- [ ] Click **Create bucket**
- [ ] Go to bucket **Policies** tab
- [ ] Click **New Policy** → **For full customization**
- [ ] Policy Name: "Users can upload own avatar"
- [ ] Allowed operation: **INSERT**
- [ ] Target roles: **authenticated**
- [ ] Policy definition: `(bucket_id = 'profiles')`
- [ ] Click **Review** → **Save policy**
- [ ] Click **New Policy** again
- [ ] Policy Name: "Public avatar access"
- [ ] Allowed operation: **SELECT**
- [ ] Target roles: **public**
- [ ] Policy definition: `(bucket_id = 'profiles')`
- [ ] Click **Review** → **Save policy**

## ✅ OAuth Setup (Google)

- [ ] Go to Supabase Dashboard → Authentication → Providers
- [ ] Click **Google** provider
- [ ] Toggle **Enable Google provider** ON
- [ ] Follow Google Cloud Console setup
- [ ] Add Client ID and Client Secret
- [ ] Save configuration

## ✅ OAuth Setup (Discord)

- [ ] Go to Supabase Dashboard → Authentication → Providers
- [ ] Click **Discord** provider
- [ ] Toggle **Enable Discord provider** ON
- [ ] Follow Discord Developer Portal setup
- [ ] Add Client ID and Client Secret
- [ ] Save configuration

## ✅ Install Dependencies

- [ ] Open terminal in project directory
- [ ] Run `npm install`
- [ ] Verify: No errors during installation

## ✅ Start Development Server

- [ ] Run `npm run dev`
- [ ] Verify: Server starts on http://localhost:3000
- [ ] Verify: No compilation errors

## ✅ Test the App

- [ ] Open http://localhost:3000 in browser
- [ ] Click **Sign In**
- [ ] Sign in with Google or Discord
- [ ] Create a new vault (collection)
- [ ] Click **⚔ Inscribe Relic**
- [ ] Search for "Flame" in the search box
- [ ] Select "Flame Chompers" from dropdown
- [ ] Set quantity to 2
- [ ] Click **⚔ Inscribe**
- [ ] Verify: Card appears in collection with price
- [ ] Go to **Profile** page
- [ ] Verify: Stats show 1 vault, 2 relics, value > €0
- [ ] Verify: Activity feed shows the card addition
- [ ] Click avatar to test image upload
- [ ] Select a test image
- [ ] Verify: Avatar updates

## ✅ Verify Data

Run these queries in Supabase SQL Editor to verify:

```sql
-- Should show your collection
SELECT * FROM collections;

-- Should show your items
SELECT * FROM collection_items;

-- Should show 20 cards
SELECT card_id, name, rarity, set_name FROM cards LIMIT 10;

-- Should show 20 prices
SELECT card_id, average FROM card_prices LIMIT 10;

-- Should show your activity
SELECT * FROM activity_log;
```

## 🎉 Success!

If all checkboxes are marked, you're ready to use Rift Architect!

### Sample Cards to Try

Search for these cards to add to your collection:
- "Flame Chompers" (€0.25)
- "Stone Guardian" (€2.00)
- "Rift Titan" (€35.00)
- "Shadow Assassin" (€5.00)
- "Mind Shatter" (€6.50)
- "Rift Portal" (€65.00)

### Next Steps

- Add more cards to your collection
- Export your collection as CSV
- Create shareable links
- Upload a custom avatar

### Need Help?

- See `DATABASE_SETUP.md` for database details
- See `AVATAR_SETUP.md` for storage setup
- See `QUICK_START.md` for overview
- See `MIGRATION_NOTES.md` for technical details
