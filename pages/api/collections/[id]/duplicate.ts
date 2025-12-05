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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') ?? null;
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid collection ID' });

  try {
    // Get original collection
    const { data: original, error: fetchError } = await supabaseServer
      .from('collections')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !original) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Create new collection with same properties
    const { data: newCollection, error: createError } = await supabaseServer
      .from('collections')
      .insert([{
        owner_id: user.id,
        name: `${original.name} (Copy)`,
        description: original.description,
        image_url: original.image_url
      }])
      .select()
      .single();

    if (createError || !newCollection) throw createError;

    // Get all items from original collection
    const { data: items, error: itemsError } = await supabaseServer
      .from('collection_items')
      .select('*')
      .eq('collection_id', id);

    if (itemsError) throw itemsError;

    // Duplicate all items to new collection
    if (items && items.length > 0) {
      const newItems = items.map((item: any) => ({
        collection_id: newCollection.id,
        card_id: item.card_id,
        quantity: item.quantity,
        condition: item.condition,
        foil: item.foil,
        notes: item.notes
      }));

      const { error: insertError } = await supabaseServer
        .from('collection_items')
        .insert(newItems);

      if (insertError) throw insertError;
    }

    return res.status(201).json(newCollection);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
