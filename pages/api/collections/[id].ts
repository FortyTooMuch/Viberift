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

    if (req.method === 'PATCH') {
      // Update collection (name, description, image_url)
      const { name, description, image_url } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (image_url !== undefined) updates.image_url = image_url;

      const { data, error } = await supabaseServer
        .from('collections')
        .update(updates)
        .eq('id', id)
        .eq('owner_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    }

    if (req.method === 'DELETE') {
      // Delete collection and all its items
      const { error: deleteItemsError } = await supabaseServer
        .from('collection_items')
        .delete()
        .eq('collection_id', id);

      if (deleteItemsError) throw deleteItemsError;

      const { error: deleteError } = await supabaseServer
        .from('collections')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id);

      if (deleteError) throw deleteError;
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
