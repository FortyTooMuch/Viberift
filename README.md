# ⚒ Rift Architect — Legendary Collection Chronicle

A fantasy-themed, mobile-first collection tracker for Riftbound (League of Legends TCG). Forge your vaults, chronicle legendary relics, and share your treasures with the realm.

Built with Next.js, TypeScript, and Supabase. Features stone-carved aesthetics with golden accents inspired by fantasy architecture.

## ✨ Features

- **⚒ Forge Vaults** — Create and manage your card collections with fantasy flair
- **⚔ Inscribe Relics** — Add cards with autocomplete search from local database
- **💰 Real-time Pricing** — Track card values stored in Supabase (EUR)
- **⚡ Instant Updates** — Collections refresh automatically after changes
- **🔗 Portal Creation** — Generate shareable read-only links with expiry options
- **📜 Ancient Scrolls** — CSV import/export for bulk management
- **👤 Architect's Chronicle** — Rich profile page with:
  - 📸 Direct image upload for avatars (no URL needed)
  - 📊 Collection statistics (total vaults, relics, value)
  - 📖 Activity feed showing recent changes (git-style commits)
  - 🎨 Auto-generated avatars using DiceBear API
- **🗃️ Local Card Database** — 20 seeded cards with full metadata ready to use

## 🎨 Theme

Fantasy-forward design with architectural motifs:
- Stone textures and carved aesthetics
- Golden (#d4af37) and bronze accents
- Cinzel & Cormorant Garamond serif fonts
- Mystical gradients and shadow effects
- Mobile-first responsive layout

## 🚀 Local Development

1. **Install dependencies**

```powershell
npm install
```

2. **Configure environment** in `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
```

3. **Set up database** (see [DATABASE_SETUP.md](./DATABASE_SETUP.md))

- Run `db/schema.sql` in Supabase SQL Editor
- Run `db/seed_cards.sql` to load 20 sample cards
- Follow [AVATAR_SETUP.md](./AVATAR_SETUP.md) for storage bucket

4. **Run the dev server**

```powershell
npm run dev
```

Visit http://localhost:3000 to enter the Architect's Guild.

## 📦 Database Setup

**Quick Start:**

1. Go to Supabase Dashboard → SQL Editor
2. Run `db/schema.sql` (creates all tables)
3. Run `db/seed_cards.sql` (loads 20 sample cards with prices)
4. Create storage bucket for avatars (see below)

**What's Included:**

- 20 cards from Origins and Echoes of Eternity sets
- Full card metadata (domains, abilities, flavor text, rarity)
- Price data for all cards (€0.15 to €65.00)
- Complete schema with all necessary tables

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for detailed instructions.

## 📸 Avatar Upload Setup

For avatar uploads to work, you need to create a storage bucket in Supabase:

1. **Create Storage Bucket**:
   - Go to Supabase Dashboard → Storage
   - Create new bucket named `profiles`
   - Set as **Public bucket** ✅

2. **Add Storage Policies**:
   ```sql
   -- Allow authenticated users to upload
   CREATE POLICY "Users can upload own avatar" ON storage.objects
   FOR INSERT WITH CHECK (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);
   
   -- Allow public read access
   CREATE POLICY "Public avatar access" ON storage.objects
   FOR SELECT USING (bucket_id = 'profiles');
   ```

See [AVATAR_SETUP.md](./AVATAR_SETUP.md) for detailed instructions.

## 🏗 Architecture

- **Frontend**: Next.js 14+ with TypeScript, mobile-first PWA
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Card Data**: Local Supabase database with seeded cards
- **Pricing**: Stored in Supabase card_prices table (10-min cache)
- **Authentication**: OAuth (Google, Discord)
- **Styling**: Custom CSS with fantasy-architectural theme

## 📚 Tech Stack

- Next.js + React 18 + TypeScript
- Supabase (@supabase/supabase-js)
- Google Fonts (Cinzel, Cormorant Garamond)
- Node.js 18+ (global fetch API)

## 🎯 Current Status

**✅ Completed:**
- Complete fantasy-architectural UI theme
- OAuth authentication (Google, Discord)
- Collection CRUD (create, view, update, delete vaults)
- Card search with autocomplete
- Add/remove cards from collections
- Real-time price display
- CSV import/export
- Shareable links with expiry
- Profile page with avatar upload
- Collection statistics
- Activity feed (git-style)
- Local card database with 20 seeded cards

**🔄 Future Enhancements:**
- External API integration (Riot Games, Cardmarket)
- Automated price updates
- Price alerts and notifications
- Collection cover images
- Advanced search filters
- Mobile PWA installation

