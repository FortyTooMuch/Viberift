import { NextApiRequest, NextApiResponse } from 'next';
import { searchCards, getAllCards, normalizeCard } from '../../../lib/cardDataService';

/**
 * Unified Card Search Endpoint
 * 
 * This endpoint abstracts the card data source and supports both:
 * - Local Database (current)
 * - Riot API (when configured)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const query = String(req.query.q ?? '').trim();
    const locale = String(req.query.locale ?? 'en');

    let results;

    if (!query || query.length < 2) {
      // Fetch all cards if no query
      results = await getAllCards(locale);
    } else {
      // Search cards
      results = await searchCards(query, locale);
    }

    return res.json({
      results: results.slice(0, 500), // Limit to 500 results
      source: process.env.NEXT_PUBLIC_USE_RIOT_API === 'true' ? 'riot-api' : 'local',
    });
  } catch (err: any) {
    console.error('Card search error:', err);
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
