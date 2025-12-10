import type { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../../lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Find deck by share token (no auth required)
    const { data: deck, error: deckError } = await supabaseServer
      .from('decks')
      .select('*')
      .eq('share_token', token)
      .single();

    if (deckError || !deck) {
      return res.status(404).json({ error: 'Deck not found or not shared' });
    }

    // Fetch deck owner profile for display name
    let ownerName: string | null = null;
    if (deck.user_id) {
      const { data: profile, error: profileError } = await supabaseServer
        .from('user_profiles')
        .select('username')
        .eq('user_id', deck.user_id)
        .maybeSingle();

      if (profileError) {
        console.error('Fetch profile error:', profileError);
      } else {
        console.log('Shared deck profile lookup:', { deckUserId: deck.user_id, profile });
        if (profile) {
          ownerName = profile.username || null;
        }
      }
    }

    // Fetch deck cards with card details
    const { data: deckCards, error: cardsError } = await supabaseServer
      .from('deck_cards')
      .select('*')
      .eq('deck_id', deck.id)
      .order('zone');

    if (cardsError) {
      console.error('Fetch deck cards error:', cardsError);
      return res.status(500).json({ error: 'Failed to fetch deck cards' });
    }

    // Fetch card details separately
    const cardIds = deckCards?.map(dc => dc.card_id).filter(Boolean) || [];
    let cardDetails: any[] = [];
    
    if (cardIds.length > 0) {
      const { data: cards, error: cardDetailsError } = await supabaseServer
        .from('cards')
        .select('*')
        .in('card_id', cardIds);
      
      if (cardDetailsError) {
        console.error('Fetch card details error:', cardDetailsError);
      } else {
        cardDetails = cards || [];
      }
    }

    // Attach card details to deck cards
    const deckCardsWithDetails = deckCards?.map(dc => ({
      ...dc,
      card: cardDetails.find(c => c.card_id === dc.card_id)
    })) || [];

    return res.status(200).json({
      deck: { ...deck, owner_name: ownerName },
      cards: deckCardsWithDetails
    });
  } catch (error: any) {
    console.error('Fetch shared deck error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch deck' });
  }
}
