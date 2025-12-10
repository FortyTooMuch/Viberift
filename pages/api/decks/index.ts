import type { NextApiRequest, NextApiResponse } from 'next';
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

  if (req.method === 'GET') {
    // Get user's decks or a specific deck by ID
    const { id } = req.query;
    
    if (id) {
      // Get specific deck
      const { data: deck, error } = await supabaseServer
        .from('decks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return res.status(404).json({ error: 'Deck not found' });
      
      // Check if user owns this deck or if it's public
      if (deck.user_id !== user.id && !deck.is_public) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      return res.status(200).json(deck);
    }

    // Get all user's decks
    const { data: decks, error } = await supabaseServer
      .from('decks')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    
    console.log(`Returning ${decks?.length || 0} decks for user ${user.id} (${user.email})`);
    console.log('Deck IDs:', decks?.map(d => ({ id: d.id, name: d.name })));
    
    return res.status(200).json({ decks });
  }

  if (req.method === 'POST') {
    // Create new deck
    const { name, description } = req.body;

    console.log('Creating deck for user:', user.id, user.email);
    console.log('Deck name:', name);

    const { data: deck, error } = await supabaseServer
      .from('decks')
      .insert({
        user_id: user.id,
        name: name || 'Untitled Deck',
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Deck creation error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('Deck created successfully:', deck.id, deck.name);
    return res.status(201).json(deck);
  }

  if (req.method === 'PATCH') {
    // Update deck
    const { id } = req.query;
    const { name, description, legend_card_id, champion_card_id, is_public, image_url } = req.body;

    if (!id) return res.status(400).json({ error: 'Deck ID required' });

    // Verify ownership
    const { data: existing } = await supabaseServer
      .from('decks')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (legend_card_id !== undefined) updates.legend_card_id = legend_card_id;
    if (champion_card_id !== undefined) updates.champion_card_id = champion_card_id;
    if (is_public !== undefined) updates.is_public = is_public;
    if (image_url !== undefined) updates.image_url = image_url;

    const { data: deck, error } = await supabaseServer
      .from('decks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(deck);
  }

  if (req.method === 'DELETE') {
    // Delete deck
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Deck ID required' });

    // Verify ownership
    const { data: existing } = await supabaseServer
      .from('decks')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { error } = await supabaseServer
      .from('decks')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
