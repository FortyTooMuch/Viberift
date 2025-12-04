const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runSeed() {
  console.log('Reading seed file...');
  const seedFile = fs.readFileSync(path.join(__dirname, '../db/seed_cards.sql'), 'utf-8');
  
  // Execute the SQL
  console.log('Executing seed SQL...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: seedFile });
  
  if (error) {
    console.error('Error running seed:', error);
    
    // Alternative: Parse and insert manually
    console.log('\nTrying manual insertion...');
    
    // Extract INSERT statements
    const insertMatches = seedFile.match(/INSERT INTO cards[^;]+;/gs);
    
    if (insertMatches) {
      for (const insertStmt of insertMatches) {
        const { error: insertError } = await supabase.rpc('exec_sql', { sql_query: insertStmt });
        if (insertError) {
          console.error('Insert error:', insertError);
        } else {
          console.log('✓ Inserted batch');
        }
      }
    }
  } else {
    console.log('✓ Seed completed successfully');
  }
  
  // Check how many cards we have
  const { count } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nTotal cards in database: ${count}`);
}

runSeed().catch(console.error);
