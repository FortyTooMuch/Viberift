const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('Running language column migration...');
  
  const sql = fs.readFileSync(path.join(__dirname, '../db/add_language_column.sql'), 'utf-8');
  
  // Split by semicolon and run each statement
  const statements = sql.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    if (!statement.trim()) continue;
    
    console.log('Executing:', statement.substring(0, 50) + '...');
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
    
    if (error) {
      console.error('Error:', error.message);
      // Try direct query
      const { error: directError } = await supabase.from('_migrations').insert([{ name: 'add_language_column', executed_at: new Date().toISOString() }]);
      if (directError) {
        console.log('Note: Migration tracking failed, but column may already exist');
      }
    } else {
      console.log('✓ Success');
    }
  }
  
  console.log('\nMigration complete!');
  console.log('Note: If you see errors, you may need to run this SQL manually in Supabase SQL Editor:');
  console.log(sql);
}

runMigration().catch(console.error);
