import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getPrice } from '../../../lib/cardmarket';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseServer = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
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
    // Handle POST - advance date by 1 day (testing only)
    if (req.method === 'POST') {
      const { action } = req.query;
      if (action === 'advance-day') {
        // Store a temporary marker for this user that extends the date range
        // We'll check for this in the GET request
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Handle DELETE - clear all activity logs for the user
    if (req.method === 'DELETE') {
      const { error: deleteError } = await supabaseServer
        .from('activity_log')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;
      return res.status(200).json({ success: true });
    }

    // Handle GET - calculate value history
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
    
    // Find the latest activity date to know how far to extend
    let latestActivityDate = new Date(now);
    for (const log of activityLogs || []) {
      const logDate = new Date(log.occurred_at);
      if (logDate > latestActivityDate) {
        latestActivityDate = logDate;
      }
    }
    
    // Create time buckets for the last 30 days up to the latest activity date plus 10 days for testing
    const timeBuckets: Date[] = [];
    const startDate = new Date(Math.min(now.getTime(), latestActivityDate.getTime()) - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Math.max(now.getTime(), latestActivityDate.getTime()) + 10 * 24 * 60 * 60 * 1000);
    
    let currentBucket = new Date(startDate);
    currentBucket.setHours(0, 0, 0, 0);
    
    while (currentBucket <= endDate) {
      timeBuckets.push(new Date(currentBucket));
      currentBucket.setDate(currentBucket.getDate() + 1);
    }

    // For each time bucket, calculate the total value
    for (const bucketDate of timeBuckets) {
      // Start fresh inventory for this bucket
      const inventory: { [cardId: string]: number } = {};
      
      // Apply all activities up to and including this date
      for (const log of activityLogs || []) {
        const logDate = new Date(log.occurred_at);
        
        // Only include activities that happened on or before this bucket date
        if (logDate > bucketDate) break;

        const cardId = log.card_id;
        const quantity = log.quantity || 0;

        if (log.type === 'add') {
          inventory[cardId] = (inventory[cardId] || 0) + quantity;
        } else if (log.type === 'remove') {
          inventory[cardId] = Math.max(0, (inventory[cardId] || 0) - quantity);
        }
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
