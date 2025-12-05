import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') ?? null;
  const { data: userRes } = await supabaseServer.auth.getUser(token ?? '');
  const user = userRes?.user ?? null;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseServer.from('user_profiles').select('*').eq('user_id', user.id).limit(1);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data?.[0] ?? {});
  }

  if (req.method === 'POST') {
    const { username, avatar_url } = req.body ?? {};
    const { data, error } = await supabaseServer
      .from('user_profiles')
      .upsert({ user_id: user.id, username, avatar_url, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data?.[0] ?? {});
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
