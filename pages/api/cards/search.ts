import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const query = String(req.query.q ?? '').trim();
    // Allow empty query for deck builder to fetch all cards
    // if (!query || query.length < 2) {
    //   return res.json({ results: [] });
    // }

    // Check if Supabase credentials are configured
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Search cards table - if no query, return all cards (limited)
    let queryBuilder = supabase
      .from('cards')
      .select('card_id, name, set_name, collector_number, category, rarity, image_url, tags, domains, energy_cost, power_cost, might, abilities_text, flavor_text')
      .limit(500);

    if (query && query.length >= 2) {
      queryBuilder = queryBuilder.or(`name.ilike.%${query}%,card_id.ilike.%${query}%`);
    }

    const { data: cards, error } = await queryBuilder;

    if (error) {
      console.error('Card search error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ 
      results: (cards || []).map((c: any) => ({
        card_id: c.card_id,
        name: c.name,
        set_name: c.set_name,
        collector_number: c.collector_number,
        category: c.category,
        rarity: c.rarity,
        image_url: c.image_url,
        tags: Array.isArray(c.tags) ? c.tags : [],
        domains: Array.isArray(c.domains) ? c.domains : [],
        energy_cost: c.energy_cost,
        power_cost: c.power_cost,
        might: c.might,
        abilities_text: c.abilities_text,
        flavor_text: c.flavor_text
      }))
    });
  } catch (err: any) {
    console.error('Card search error:', err);
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}

