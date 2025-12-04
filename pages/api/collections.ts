import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../lib/supabaseServer';

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
      // list collections for user
      const { data, error } = await supabaseServer
        .from('collections')
        .select('*')
        .eq('owner_id', user.id);
      if (error) throw error;
      return res.json({ collections: data });
    }

    if (req.method === 'POST') {
      // create a new collection
      const payload = req.body;
      const { data, error } = await supabaseServer
        .from('collections')
        .insert([{ owner_id: user.id, name: payload?.name ?? 'New collection' }])
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
