import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../lib/supabaseServer';

// Sync cards from RapidAPI or seed a few examples
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow both GET and POST for convenience
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // For now, seed a few example Riftbound cards (you can expand this or sync from RapidAPI)
    const sampleCards = [
      { product_id: 'rift001', name: 'Ahri, Nine-Tailed Fox', set_name: 'Riftbound Core', image_url: null },
      { product_id: 'rift002', name: 'Yasuo, Wandering Swordsman', set_name: 'Riftbound Core', image_url: null },
      { product_id: 'rift003', name: 'Jinx, Loose Cannon', set_name: 'Riftbound Core', image_url: null },
      { product_id: 'rift004', name: 'Lux, Lady of Luminosity', set_name: 'Riftbound Core', image_url: null },
      { product_id: 'rift005', name: 'Zed, Master of Shadows', set_name: 'Riftbound Core', image_url: null },
      { product_id: 'rift006', name: 'Ekko, Boy Who Shattered Time', set_name: 'Riftbound Expansion 1', image_url: null },
      { product_id: 'rift007', name: 'Vi, Piltover Enforcer', set_name: 'Riftbound Expansion 1', image_url: null },
      { product_id: 'rift008', name: 'Katarina, Sinister Blade', set_name: 'Riftbound Core', image_url: null },
      { product_id: 'rift009', name: 'Thresh, Chain Warden', set_name: 'Riftbound Core', image_url: null },
      { product_id: 'rift010', name: 'Teemo, Swift Scout', set_name: 'Riftbound Core', image_url: null }
    ];

    const { data, error } = await supabaseServer.from('cards').upsert(sampleCards, { onConflict: 'product_id', ignoreDuplicates: false });
    if (error) throw error;

    return res.json({ message: 'Cards seeded successfully', count: sampleCards.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
