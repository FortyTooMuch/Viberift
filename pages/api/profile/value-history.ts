import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getPrice } from '../../../lib/cardmarket';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseServer = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Get all activity logs for the user, ordered by date
    const { data: activityLogs, error: activityError } = await supabaseServer
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: true });

    if (activityError) throw activityError;

    // Get all current collection items to calculate current state
    const { data: collections, error: collectionsError } = await supabaseServer
      .from('collections')
      .select('id')
      .eq('owner_id', user.id);

    if (collectionsError) throw collectionsError;

    const collectionIds = (collections || []).map((c: { id: string }) => c.id);

    const { data: currentItems, error: itemsError } = await supabaseServer
      .from('collection_items')
      .select('card_id, quantity')
      .in('collection_id', collectionIds);

    if (itemsError) throw itemsError;

    // Build a map of card quantities over time
    const cardInventory: { [cardId: string]: number } = {};
    const valueHistory: { date: string; value: number }[] = [];

    // Initialize with current state
    if (currentItems) {
      for (const item of currentItems) {
        cardInventory[item.card_id] = (cardInventory[item.card_id] || 0) + item.quantity;
      }
    }

    // Work backwards from activity logs to reconstruct historical states
    // We'll sample at key points in time
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Create time buckets for the last 30 days
    const timeBuckets: Date[] = [];
    for (let i = 30; i >= 0; i--) {
      const bucketDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      bucketDate.setHours(0, 0, 0, 0);
      timeBuckets.push(bucketDate);
    }

    // For each time bucket, calculate the total value
    const inventory: { [cardId: string]: number } = {};
    let activityIndex = 0;

    for (const bucketDate of timeBuckets) {
      // Apply all activities up to this date
      while (activityIndex < (activityLogs?.length || 0)) {
        const log = activityLogs![activityIndex];
        const logDate = new Date(log.occurred_at);
        
        if (logDate > bucketDate) break;

        const cardId = log.card_id;
        const quantity = log.quantity || 0;

        if (log.type === 'add') {
          inventory[cardId] = (inventory[cardId] || 0) + quantity;
        } else if (log.type === 'remove') {
          inventory[cardId] = Math.max(0, (inventory[cardId] || 0) - quantity);
        }

        activityIndex++;
      }

      // Calculate total value at this point
      let totalValue = 0;
      for (const [cardId, qty] of Object.entries(inventory)) {
        if (qty > 0) {
          const priceInfo = await getPrice(cardId);
          totalValue += (priceInfo.lowest ?? 0) * qty;
        }
      }

      valueHistory.push({
        date: bucketDate.toISOString().split('T')[0],
        value: Math.round(totalValue * 100) / 100
      });
    }

    return res.status(200).json({ history: valueHistory });
  } catch (err) {
    console.error('Value history error:', err);
    return res.status(500).json({ error: 'Failed to load value history' });
  }
}
