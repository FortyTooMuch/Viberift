import type { NextApiRequest, NextApiResponse } from 'next';
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
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') ?? null;
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Deck ID required' });

  // Verify deck access
  const { data: deck } = await supabaseServer
    .from('decks')
    .select('user_id, is_public')
    .eq('id', id)
    .single();

  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  
  const isOwner = deck.user_id === user.id;
  const canView = isOwner || deck.is_public;
  
  if (!canView) return res.status(403).json({ error: 'Forbidden' });

  if (req.method === 'GET') {
    // Get all cards in deck with card details
    const { data: deckCards, error } = await supabaseServer
      .from('deck_cards')
      .select('*')
      .eq('deck_id', id);

    if (error) return res.status(500).json({ error: error.message });

    // Fetch card details from cards table
    const cardIds = [...new Set((deckCards || []).map((dc: { card_id: string }) => dc.card_id))];
    const { data: cards } = await supabaseServer
      .from('cards')
      .select('*')
      .in('card_id', cardIds);

    // Check ownership from user's collections
    if (isOwner) {
      const { data: userCollections } = await supabaseServer
        .from('collections')
        .select('id')
        .eq('user_id', user.id);

      if (userCollections && userCollections.length > 0) {
        const collectionIds = (userCollections || []).map((c: { id: string }) => c.id);
        const { data: ownedCards } = await supabaseServer
          .from('collection_items')
          .select('card_id')
          .in('collection_id', collectionIds);

        const ownedCardIds = new Set((ownedCards || []).map((c: { card_id: string }) => c.card_id));

        // Update is_owned status
        for (const deckCard of deckCards) {
          deckCard.is_owned = ownedCardIds.has(deckCard.card_id);
        }
      }
    }

    // Attach card details to deck cards
    const enrichedCards = (deckCards || []).map((dc: any) => ({
      ...dc,
      card: (cards || []).find((c: any) => c.card_id === dc.card_id)
    }));

    return res.status(200).json({ cards: enrichedCards });
  }

  if (req.method === 'POST') {
    // Add card to deck
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

    const { card_id, quantity, zone } = req.body;

    if (!card_id || !zone) {
      return res.status(400).json({ error: 'card_id and zone required' });
    }

    const validZones = ['legend', 'champion', 'battlefield', 'rune', 'main', 'side'];
    if (!validZones.includes(zone)) {
      return res.status(400).json({ error: 'Invalid zone' });
    }

    // Guardrails for single-card zones
    if (zone === 'legend' || zone === 'champion') {
      const { data: existingSingle } = await supabaseServer
        .from('deck_cards')
        .select('id, quantity')
        .eq('deck_id', id)
        .eq('zone', zone);
      const existingCount = (existingSingle || []).reduce((sum: number, dc: any) => sum + (dc.quantity ?? 0), 0);
      if (existingCount >= 1) {
        return res.status(400).json({ error: `Only one ${zone} allowed in deck` });
      }
    }

    // Check if card already exists in this zone
    const { data: existing } = await supabaseServer
      .from('deck_cards')
      .select('*')
      .eq('deck_id', id)
      .eq('card_id', card_id)
      .eq('zone', zone)
      .maybeSingle();

    if (existing) {
      // Update quantity
      const { data: updated, error } = await supabaseServer
        .from('deck_cards')
        .update({ quantity: existing.quantity + (quantity || 1) })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(updated);
    }

    // Insert new card
    const { data: deckCard, error } = await supabaseServer
      .from('deck_cards')
      .insert({
        deck_id: id,
        card_id,
        quantity: quantity || 1,
        zone,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert deck_card:', { deck_id: id, card_id, zone, quantity }, error);
      return res.status(500).json({ error: error.message, details: error });
    }
    return res.status(201).json(deckCard);
  }

  if (req.method === 'PATCH') {
    // Update card quantity
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

    const { card_id, zone, quantity } = req.body;

    if (!card_id || !zone || quantity === undefined) {
      return res.status(400).json({ error: 'card_id, zone, and quantity required' });
    }

    const { data: updated, error } = await supabaseServer
      .from('deck_cards')
      .update({ quantity })
      .eq('deck_id', id)
      .eq('card_id', card_id)
      .eq('zone', zone)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    // Remove card from deck
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

    const { card_id, zone } = req.query;

    if (!card_id || !zone) {
      return res.status(400).json({ error: 'card_id and zone required' });
    }

    const { error } = await supabaseServer
      .from('deck_cards')
      .delete()
      .eq('deck_id', id)
      .eq('card_id', card_id)
      .eq('zone', zone);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
