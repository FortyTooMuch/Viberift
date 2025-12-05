-- Supabase / Postgres schema for Rift Architect (Riftbound collection tracker)

-- IMPORTANT: After running this schema, create a storage bucket named 'profiles' in Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create new bucket: 'profiles'
-- 3. Set as Public bucket
-- 4. Add policy to allow authenticated users to upload to their own folder:
--    CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT 
--    WITH CHECK (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

-- collections owned by a user (owner_id references auth.users)
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  image_url text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  card_id text not null, -- references cards.card_id
  quantity integer default 1,
  condition text,
  added_at timestamptz default now()
);

-- cards table stores canonical card info
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  card_id text unique not null,
  name text not null,
  category text,
  domains text[], -- array of domain strings
  energy_cost integer,
  power_cost integer,
  might integer,
  rarity text,
  tags text[], -- array of tag strings
  abilities_text text,
  flavor_text text,
  category_subtype text,
  set_name text,
  collector_number text,
  is_alt_art boolean default false,
  is_overnumbered boolean default false,
  image_url text,
  created_at timestamptz default now()
);

-- full-text search index for card names
create index if not exists idx_cards_name on cards using gin(to_tsvector('english', name));

-- index for card_id lookups
create index if not exists idx_cards_card_id on cards(card_id);

-- cached prices (keyed by card_id)
create table if not exists card_prices (
  card_id text primary key,
  lowest numeric(10,2),
  average numeric(10,2),
  currency text,
  last_fetched timestamptz,
  fetched_by text
);

-- share links for collections
create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- price alerts
create table if not exists price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id text,
  collection_id uuid,
  threshold numeric(10,2) not null,
  direction text check (direction in ('above','below')),
  active boolean default true,
  created_at timestamptz default now()
);

-- user profile (display name and avatar)
create table if not exists user_profiles (
  user_id uuid primary key,
  username text unique,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- activity feed: track adds/removes of collection items
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  collection_id uuid,
  type text check (type in ('add','remove')) not null,
  card_id text,
  quantity integer,
  occurred_at timestamptz default now()
);
