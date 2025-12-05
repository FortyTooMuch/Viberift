import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface RawCard {
  id: string;
  number: string;
  code: string;
  name: string;
  images: {
    small: string;
    large: string;
  };
  set: {
    id: string;
    name: string;
    releaseDate: string;
  };
  cleanName: string;
  rarity: string;
  cardType: string;
  domain: string;
  energyCost: string;
  powerCost: string;
  might: string;
  description?: string;
  flavorText?: string;
}

interface TransformedCard {
  card_id: string;
  name: string;
  category: string | null;
  domains: string[];
  energy_cost: number | null;
  power_cost: number | null;
  might: number | null;
  rarity: string;
  tags: string[];
  abilities_text: string | null;
  flavor_text: string | null;
  set_name: string;
  collector_number: string;
  image_url: string;
}

function transformCard(raw: RawCard): TransformedCard {
  return {
    card_id: raw.id,
    name: raw.name,
    category: raw.cardType || null,
    domains: raw.domain ? [raw.domain] : [],
    energy_cost: raw.energyCost ? parseInt(raw.energyCost, 10) : null,
    power_cost: raw.powerCost ? parseInt(raw.powerCost, 10) : null,
    might: raw.might ? parseInt(raw.might, 10) : null,
    rarity: raw.rarity || 'Common',
    tags: [], // No tags in source data, can be populated later
    abilities_text: raw.description || null,
    flavor_text: raw.flavorText || null,
    set_name: raw.set.name,
    collector_number: raw.number,
    image_url: raw.images.large,
  };
}

async function seedCards() {
  try {
    console.log('🗑️  Deleting all existing cards...');
    const { error: deleteError } = await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.error('Error deleting cards:', deleteError);
      process.exit(1);
    }
    console.log('✅ Deleted all existing cards');

    console.log('📖 Reading card data from JSON file...');
    const jsonPath = path.join(process.cwd(), 'riftbound_cards.json');
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const cards: RawCard[] = JSON.parse(rawData);
    console.log(`✅ Loaded ${cards.length} cards from JSON`);

    console.log('🔄 Transforming cards to schema format...');
    const transformedCards = cards.map(transformCard);

    console.log('💾 Inserting cards into Supabase...');
    // Insert in batches to avoid overwhelming the API
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < transformedCards.length; i += batchSize) {
      const batch = transformedCards.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('cards')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting batch at index ${i}:`, insertError);
        process.exit(1);
      }

      inserted += batch.length;
      console.log(`✅ Inserted ${inserted}/${transformedCards.length} cards`);
    }

    console.log('\n🎉 Card seeding completed successfully!');
    console.log(`📊 Total cards inserted: ${transformedCards.length}`);
  } catch (error) {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  }
}

// Run the seeding
seedCards();
