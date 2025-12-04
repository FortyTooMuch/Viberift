const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function parseSeedAndInsert() {
  console.log('Reading seed file...');
  const seedFile = fs.readFileSync(path.join(__dirname, '../db/seed_cards.sql'), 'utf-8');
  
  // Extract values from INSERT statements
  const valuesRegex = /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*ARRAY\[([^\]]*)\],\s*(\d+|NULL),\s*(\d+|NULL),\s*(\d+|NULL),\s*'([^']+)',\s*ARRAY\[([^\]]*)\],\s*'([^']*)',\s*([^,]+),\s*([^,]+),\s*'([^']+)',\s*'([^']+)',\s*([^,]+),\s*([^)]+)\)/g;
  
  const cards = [];
  let match;
  
  while ((match = valuesRegex.exec(seedFile)) !== null) {
    const [_, cardId, name, category, domains, energyCost, powerCost, might, rarity, tags, abilitiesText, flavorText, categorySubtype, setName, collectorNumber, isAltArt, isOvernumbered] = match;
    
    cards.push({
      card_id: cardId,
      name: name,
      set_name: setName.replace(/'/g, ''),
      image_url: `https://riftdata.net/sets/origin/${cardId}.jpg`
    });
  }
  
  console.log(`Parsed ${cards.length} cards`);
  
  if (cards.length === 0) {
    console.error('No cards parsed! Check the regex pattern.');
    return;
  }
  
  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('cards')
      .upsert(batch, { onConflict: 'card_id' });
    
    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
    } else {
      console.log(`✓ Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} cards)`);
    }
  }
  
  // Check total
  const { count } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nTotal cards in database: ${count}`);
}

parseSeedAndInsert().catch(console.error);
