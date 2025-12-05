import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') ?? null;
  const { data: userRes } = await supabaseServer.auth.getUser(token ?? '');
  const user = userRes?.user ?? null;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);

    // Get activity with collection names
    const { data: activity, error } = await supabaseServer
      .from('activity_log')
      .select(`
        id,
        type,
        card_id,
        quantity,
        occurred_at,
        collection_id,
        collections!inner(name)
      `)
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Activity fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Activity data:', activity);

    // Fetch card names for all card_ids
    const cardIds = Array.from(new Set((activity ?? []).map((log: any) => log.card_id).filter(Boolean)));
    const cardNamesMap: Record<string, string> = {};
    
    if (cardIds.length > 0) {
      const { data: cards } = await supabaseServer
        .from('cards')
        .select('card_id, name')
        .in('card_id', cardIds);
      
      (cards ?? []).forEach((card: any) => {
        cardNamesMap[card.card_id] = card.name;
      });
    }

    const formattedActivity = (activity ?? []).map((log: any) => ({
      id: log.id,
      type: log.type,
      cardId: log.card_id,
      cardName: cardNamesMap[log.card_id] || log.card_id,
      quantity: log.quantity,
      collectionId: log.collection_id,
      collectionName: log.collections?.name ?? 'Unknown Vault',
      occurredAt: log.occurred_at
    }));

    return res.json({ activity: formattedActivity });
  } catch (err: any) {
    console.error('Activity error:', err);
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
