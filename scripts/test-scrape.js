const cheerio = require('cheerio');

async function test() {
  const response = await fetch('https://riftdecks.com/cards');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('=== Testing different selectors ===\n');
  
  // Try different link selectors
  console.log('Links with "details":', $('a[href*="details"]').length);
  console.log('Links with "cards/":', $('a[href*="cards/"]').length);
  console.log('All links:', $('a').length);
  
  // Show first few links
  console.log('\nFirst 10 links:');
  $('a').slice(0, 10).each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    console.log(`${i}: ${href} - "${text.substring(0, 50)}"`);
  });
  
  // Look for card names/images
  console.log('\n=== Looking for card elements ===');
  console.log('Images:', $('img').length);
  console.log('Divs with card class:', $('[class*="card"]').length);
  
  // Check if it's dynamically loaded
  console.log('\nChecking for scripts with data:');
  $('script').each((i, el) => {
    const content = $(el).html();
    if (content && content.includes('cards')) {
      console.log(`Script ${i} mentions cards`);
    }
  });
}

test().catch(console.error);
