import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../lib/supabaseServer';
import { getPrice } from '../../../lib/cardmarket';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') ?? null;
  const { data: userRes } = await supabaseServer.auth.getUser(token ?? '');
  const user = userRes?.user ?? null;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Get all collections for this user
    const { data: collections } = await supabaseServer
      .from('collections')
      .select('id')
      .eq('owner_id', user.id);

    if (!collections || collections.length === 0) {
      return res.json({ totalCards: 0, totalValue: 0, collectionCount: 0 });
    }

    const collectionIds = collections.map((c: any) => c.id);

    // Get all items from user's collections
    const { data: items } = await supabaseServer
      .from('collection_items')
      .select('card_id, quantity')
      .in('collection_id', collectionIds);

    const totalCards = (items ?? []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

    // Get prices for all unique cards
    // Normalize card ids to strings and drop empties to satisfy type checks
    const uniqueCardIds: string[] = Array.from(
      new Set(
        (items ?? [])
          .map((i: any) => (i.card_id != null ? String(i.card_id) : null))
          .filter((id: string | null): id is string => Boolean(id))
      )
    );
    
    let totalValue = 0;
    for (const cardId of uniqueCardIds) {
      try {
        const priceInfo = await getPrice(cardId);
        
        const itemsWithCard = (items ?? []).filter((i: any) => i.card_id === cardId);
        const quantity = itemsWithCard.reduce((sum: number, i: any) => sum + i.quantity, 0);
        const price = priceInfo.average ?? 0;
        totalValue += price * quantity;
      } catch {
        // Skip if no price data
      }
    }

    return res.json({
      totalCards,
      totalValue: Math.round(totalValue * 100) / 100,
      collectionCount: collections.length
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
