import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../../lib/supabaseServer';

async function getUserFromToken(token?: string | null) {
  if (!token) return null;
  try {
    const { data, error } = await supabaseServer.auth.getUser(token as string);
    if (error) return null;
    return data.user ?? null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') ?? null;
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid collection ID' });

  try {
    // Verify ownership
    const { data: collection, error: fetchError } = await supabaseServer
      .from('collections')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Get collection items
    const { data: items, error: itemsError } = await supabaseServer
      .from('collection_items')
      .select('*')
      .eq('collection_id', id)
      .order('added_at', { ascending: false });

    if (itemsError) throw itemsError;

    // Get card details for each item
    const itemsWithCards = await Promise.all(
      (items || []).map(async (item: any) => {
        const { data: cards, error: cardError } = await supabaseServer
          .from('cards')
          .select('card_id, name, set_name, image_url, category, rarity, domains, energy_cost, power_cost, might, tags, abilities_text, flavor_text, collector_number')
          .eq('card_id', item.card_id)
          .limit(1);
        
        if (cardError) {
          console.error(`Failed to fetch card ${item.card_id}:`, cardError.message);
        }
        
        const card = cards && cards.length > 0 ? cards[0] : null;
        
        return {
          ...item,
          card
        };
      })
    );

    return res.json({ items: itemsWithCards });
  } catch (err: any) {
    console.error('Error fetching collection cards:', err);
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
