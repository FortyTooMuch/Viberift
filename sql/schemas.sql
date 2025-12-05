-- ============================================================================
-- Cards Table
-- ============================================================================
create table public.cards (
  id uuid not null default gen_random_uuid (),
  card_id text not null,
  name text not null,
  category text null,
  domains text[] null,
  energy_cost integer null,
  power_cost integer null,
  might integer null,
  rarity text null,
  tags text[] null,
  abilities_text text null,
  flavor_text text null,
  set_name text null,
  collector_number text null,
  is_alt_art boolean null default false,
  is_overnumbered boolean null default false,
  image_url text null,
  created_at timestamp with time zone null default now(),
  constraint cards_pkey primary key (id),
  constraint cards_card_id_key unique (card_id)
) TABLESPACE pg_default;

-- ============================================================================
-- Cards Indexes
-- ============================================================================
create index IF not exists idx_cards_name on public.cards using gin (to_tsvector('english'::regconfig, name)) TABLESPACE pg_default;

create index IF not exists idx_cards_card_id on public.cards using btree (card_id) TABLESPACE pg_default;

create index IF not exists idx_cards_rarity on public.cards using btree (rarity) TABLESPACE pg_default;

create index IF not exists idx_cards_domains on public.cards using btree (domains) TABLESPACE pg_default;
