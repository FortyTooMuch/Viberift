const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importCards() {
  console.log('Fetching card list from riftdata.net...');
  
  const response = await fetch('https://riftdata.net/sets/origin/');
  const html = await response.text();
  
  // Extract card IDs from image links (e.g., OGN-001.jpg, OGN-002.jpg)
  const cardMatches = html.match(/OGN-\d{3}/g) || [];
  const uniqueCards = [...new Set(cardMatches)];
  
  console.log(`Found ${uniqueCards.length} unique cards`);
  
  const cards = uniqueCards.map(cardId => ({
    card_id: cardId,
    name: cardId, // We'll use the ID as name for now
    set_name: 'Origin',
    image_url: `https://riftdata.net/sets/origin/${cardId}.jpg`,
    price: 0
  }));
  
  // Insert cards in batches
  const batchSize = 50;
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('cards')
      .upsert(batch, { onConflict: 'card_id' });
    
    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
    } else {
      console.log(`Inserted batch ${i / batchSize + 1} (${batch.length} cards)`);
    }
  }
  
  console.log('Import complete!');
}

importCards().catch(console.error);
