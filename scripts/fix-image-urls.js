const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndUpdateCards() {
  // Check a few cards
  console.log('Checking sample cards...');
  const { data: samples, error } = await supabase
    .from('cards')
    .select('*')
    .limit(5);
  
  if (error) {
    console.error('Error fetching cards:', error);
    return;
  }
  
  console.log('Sample cards:', JSON.stringify(samples, null, 2));
  
  // Check if OGN-003 exists
  const { data: ogn003 } = await supabase
    .from('cards')
    .select('*')
    .eq('card_id', 'OGN-003')
    .single();
  
  console.log('\nOGN-003:', ogn003);
  
  // Update all cards to have image_url
  console.log('\nUpdating image_url for all cards...');
  
  const { data: allCards } = await supabase
    .from('cards')
    .select('card_id');
  
  console.log(`Found ${allCards?.length} cards to update`);
  
  if (allCards && allCards.length > 0) {
    const updates = allCards.map(card => ({
      card_id: card.card_id,
      image_url: `https://riftdata.net/sets/origin/${card.card_id}.jpg`
    }));
    
    const { error: updateError } = await supabase
      .from('cards')
      .upsert(updates, { onConflict: 'card_id' });
    
    if (updateError) {
      console.error('Update error:', updateError);
    } else {
      console.log('✓ Updated all card image URLs');
    }
  }
}

checkAndUpdateCards().catch(console.error);
