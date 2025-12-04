import { config } from 'dotenv';
import { resolve } from 'path';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

// Load environment variables FIRST
config({ path: resolve(__dirname, '../.env.local') });

// Create supabase client directly here after env is loaded
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables!');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabaseServer = createClient(supabaseUrl, supabaseKey);

interface CardData {
  card_id: string;
  name: string;
  set_name: string;
  image_url: string;
  card_type?: string;
  rarity?: string;
  domains?: string;
  cost?: number;
  energy?: number;
  power?: number;
  might?: number;
  description?: string;
  collector_number?: string;
  price?: number;
}

async function scrapeRiftdecksCards() {
  console.log('Starting card scraping from riftdecks.com...');
  console.log('Launching browser...');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const allCards: CardData[] = [];
  
  try {
    // First, get the list of all cards
    console.log('Fetching card list...');
    await page.goto('https://riftdecks.com/cards', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for cards to load
    await page.waitForSelector('a', { timeout: 10000 });
    
    const html = await page.content();
    const $ = cheerio.load(html);

    // Find all card links
    const cardLinks: string[] = [];
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (href && href.includes('/cards/details-') && !cardLinks.includes(href)) {
        cardLinks.push(href);
      }
    });

    console.log(`Found ${cardLinks.length} unique cards`);
    
    if (cardLinks.length === 0) {
      console.log('No cards found. The page might still be loading or blocked.');
      await page.screenshot({ path: 'debug-screenshot.png' });
      console.log('Saved screenshot to debug-screenshot.png');
    }
    
    // Fetch details for each card
    let processed = 0;
    for (const link of cardLinks) {
      try {
        const detailUrl = link.startsWith('http') ? link : `https://riftdecks.com${link}`;
        await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        const detailHtml = await page.content();
        const $detail = cheerio.load(detailHtml);

        // Extract card data from the details page
        const cardData: Partial<CardData> = {};
        
        // Get collector number (like OGN-179/298)
        const collectorNumber = $detail('h3:contains("COLLECTOR NUMBER")').next().text().trim() || 
                               $detail('h3:contains("COLLECTOR_NUMBER")').next().text().trim();
        
        if (collectorNumber) {
          // Extract the card ID (e.g., OGN-179 from OGN-179/298)
          const match = collectorNumber.match(/([A-Z]+-[\dA-Z]+)/);
          if (match) {
            cardData.card_id = match[1];
            cardData.collector_number = collectorNumber;
          }
        }

        // Get name
        cardData.name = $detail('h3:contains("NAME")').next().text().trim() || 
                        $detail('h1').first().text().replace(' Riftbound Card', '').trim();

        // Get image URL
        const imageUrl = $detail('img[alt*="normal"]').attr('src') || 
                         $detail('img[src*="full.png"]').attr('src');
        if (imageUrl) {
          cardData.image_url = imageUrl.startsWith('http') ? imageUrl : `https://riftdecks.com${imageUrl}`;
        }

        // Get type
        const types = $detail('h3:contains("TYPES")').next().text().trim().toLowerCase();
        cardData.card_type = types || undefined;

        // Get rarity
        const rarity = $detail('h3:contains("RARITY")').next().text().trim().toLowerCase();
        cardData.rarity = rarity || undefined;

        // Get domains
        const domains = $detail('h3:contains("DOMAINS")').next().text().trim().toLowerCase();
        cardData.domains = domains || undefined;

        // Get cost/CMC
        const cost = $detail('h3:contains("COST")').next().text().trim();
        if (cost && !isNaN(parseInt(cost))) {
          cardData.cost = parseInt(cost);
        }

        // Get energy
        const energy = $detail('h3:contains("ENERGY")').next().text().trim();
        if (energy && !isNaN(parseInt(energy))) {
          cardData.energy = parseInt(energy);
        }

        // Get description
        const description = $detail('h3:contains("DESCRIPTION")').next().text().trim() ||
                           $detail('h3:contains("ALT_TEXT")').next().text().trim();
        cardData.description = description || undefined;

        // Get set
        const sets = $detail('h3:contains("SETS")').next().text().trim();
        cardData.set_name = sets || 'Origin';

        // Get price
        const priceText = $detail('h3:contains("PRICES")').parent().text().match(/\$[\d.]+/);
        if (priceText) {
          cardData.price = parseFloat(priceText[0].replace('$', ''));
        }

        // Only add if we have at least card_id and name
        if (cardData.card_id && cardData.name) {
          allCards.push(cardData as CardData);
          processed++;
          
          if (processed % 10 === 0) {
            console.log(`Processed ${processed}/${cardLinks.length} cards...`);
          }
        }

        // Be nice to the server
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching ${link}:`, error);
      }
    }

    console.log(`\nTotal cards scraped: ${allCards.length}`);
  } finally {
    await browser.close();
  }
  
  return allCards;
}

async function importCardsToDatabase(cards: CardData[]) {
  console.log('\nImporting cards to database...');
  
  let imported = 0;
  let updated = 0;
  let errors = 0;

  for (const card of cards) {
    try {
      // Check if card exists
      const { data: existing } = await supabaseServer
        .from('cards')
        .select('id')
        .eq('card_id', card.card_id)
        .single();

      if (existing) {
        // Update existing card
        const { error } = await supabaseServer
          .from('cards')
          .update({
            name: card.name,
            set_name: card.set_name,
            image_url: card.image_url,
            card_type: card.card_type,
            rarity: card.rarity,
            domains: card.domains,
            cost: card.cost,
            energy: card.energy,
            power: card.power,
            might: card.might,
            description: card.description,
            collector_number: card.collector_number,
            price: card.price,
            updated_at: new Date().toISOString()
          })
          .eq('card_id', card.card_id);

        if (error) throw error;
        updated++;
      } else {
        // Insert new card
        const { error } = await supabaseServer
          .from('cards')
          .insert([{
            card_id: card.card_id,
            name: card.name,
            set_name: card.set_name,
            image_url: card.image_url,
            card_type: card.card_type,
            rarity: card.rarity,
            domains: card.domains,
            cost: card.cost,
            energy: card.energy,
            power: card.power,
            might: card.might,
            description: card.description,
            collector_number: card.collector_number,
            price: card.price
          }]);

        if (error) throw error;
        imported++;
      }

      if ((imported + updated) % 10 === 0) {
        console.log(`Progress: ${imported + updated}/${cards.length}`);
      }
    } catch (error) {
      console.error(`Error importing ${card.card_id} (${card.name}):`, error);
      errors++;
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`New cards imported: ${imported}`);
  console.log(`Existing cards updated: ${updated}`);
  console.log(`Errors: ${errors}`);
}

async function main() {
  try {
    const cards = await scrapeRiftdecksCards();
    
    if (cards.length === 0) {
      console.log('No cards found. Exiting.');
      return;
    }

    // Show sample of what we found
    console.log('\nSample cards:');
    cards.slice(0, 5).forEach(card => {
      console.log(`  ${card.card_id}: ${card.name}`);
    });

    console.log('\nDo you want to import these cards to the database?');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await importCardsToDatabase(cards);
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
