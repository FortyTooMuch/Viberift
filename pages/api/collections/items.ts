import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../lib/supabaseServer';

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
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') ?? null;
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const collectionId = String(req.query.collectionId ?? '');
      if (!collectionId) return res.status(400).json({ error: 'collectionId required' });

      const { data, error } = await supabaseServer
        .from('collection_items')
        .select('*')
        .eq('collection_id', collectionId)
        .order('added_at', { ascending: false });
      if (error) throw error;
      return res.json({ items: data ?? [] });
    }

    if (req.method === 'POST') {
      const payload = req.body;
      if (!payload?.collectionId || !payload?.cardId) return res.status(400).json({ error: 'collectionId and cardId required' });

      // Check if card already exists in this collection with same condition and language
      const { data: existing, error: findError } = await supabaseServer
        .from('collection_items')
        .select('*')
        .eq('collection_id', payload.collectionId)
        .eq('card_id', payload.cardId)
        .eq('condition', payload.condition ?? 'NM')
        .eq('language', payload.language ?? 'EN')
        .maybeSingle();

      if (findError && findError.code !== 'PGRST116') throw findError;

      if (existing) {
        // Card exists, update quantity
        const newQuantity = existing.quantity + (payload.quantity ?? 1);
        const { data: updated, error: updateError } = await supabaseServer
          .from('collection_items')
          .update({ quantity: newQuantity })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (updateError) throw updateError;
        // log activity
        await supabaseServer.from('activity_log').insert([{ user_id: user.id, collection_id: payload.collectionId, type: 'add', card_id: payload.cardId, quantity: payload.quantity ?? 1 }]);
        return res.status(200).json(updated);
      } else {
        // Card doesn't exist, insert new
        const insert = {
          collection_id: payload.collectionId,
          card_id: payload.cardId,
          quantity: payload.quantity ?? 1,
          condition: payload.condition ?? null,
          language: payload.language ?? 'EN'
        };

        const { data, error } = await supabaseServer.from('collection_items').insert([insert]).select();
        if (error) throw error;
        // log activity
        await supabaseServer.from('activity_log').insert([{ user_id: user.id, collection_id: payload.collectionId, type: 'add', card_id: payload.cardId, quantity: payload.quantity ?? 1 }]);
        return res.status(201).json(data?.[0] ?? {});
      }
    }

    if (req.method === 'PATCH') {
      const itemId = String(req.query.id ?? '');
      if (!itemId) return res.status(400).json({ error: 'Item ID required' });

      const payload = req.body;
      const update: any = {};
      if (payload.quantity !== undefined) update.quantity = payload.quantity;
      if (payload.condition !== undefined) update.condition = payload.condition;
      if (payload.language !== undefined) update.language = payload.language;
      if (payload.bought_at !== undefined) update.bought_at = payload.bought_at;

      // Verify ownership
      const { data: item } = await supabaseServer
        .from('collection_items')
        .select('collection_id, card_id, quantity')
        .eq('id', itemId)
        .single();

      if (!item) return res.status(404).json({ error: 'Item not found' });

      const { data: collection } = await supabaseServer
        .from('collections')
        .select('owner_id')
        .eq('id', item.collection_id)
        .single();

      if (!collection || collection.owner_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { data, error } = await supabaseServer
        .from('collection_items')
        .update(update)
        .eq('id', itemId)
        .select();

      if (error) throw error;

      // Log activity if quantity changed
      if (payload.quantity !== undefined && payload.quantity !== item.quantity) {
        const quantityDiff = payload.quantity - item.quantity;
        await supabaseServer.from('activity_log').insert([{ 
          user_id: user.id, 
          collection_id: item.collection_id, 
          type: quantityDiff > 0 ? 'add' : 'remove', 
          card_id: item.card_id,
          quantity: Math.abs(quantityDiff)
        }]);
      }

      return res.json(data?.[0] ?? {});
    }

    if (req.method === 'DELETE') {
      const itemId = String(req.query.id ?? '');
      if (!itemId) return res.status(400).json({ error: 'Item ID required' });

      // Verify ownership
      const { data: item } = await supabaseServer
        .from('collection_items')
        .select('collection_id, card_id, quantity')
        .eq('id', itemId)
        .single();

      if (!item) return res.status(404).json({ error: 'Item not found' });

      const { data: collection } = await supabaseServer
        .from('collections')
        .select('owner_id')
        .eq('id', item.collection_id)
        .single();

      if (!collection || collection.owner_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { error } = await supabaseServer
        .from('collection_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      
      // log activity with the full quantity being removed
      await supabaseServer.from('activity_log').insert([{ 
        user_id: user.id, 
        collection_id: item.collection_id, 
        type: 'remove', 
        card_id: item.card_id,
        quantity: item.quantity
      }]);

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
