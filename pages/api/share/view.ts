import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = String(req.query.token ?? '');
  if (!token) return res.status(400).json({ error: 'token required' });

  const { data: linkData, error: linkErr } = await supabaseServer.from('share_links').select('*').eq('token', token).limit(1);
  if (linkErr) return res.status(500).json({ error: linkErr.message });
  const link = linkData?.[0];
  if (!link) return res.status(404).json({ error: 'Not found' });
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return res.status(410).json({ error: 'Link expired' });

  const { data: items, error: itemsErr } = await supabaseServer
    .from('collection_items')
    .select('*')
    .eq('collection_id', link.collection_id)
    .order('added_at', { ascending: false });
  if (itemsErr) return res.status(500).json({ error: itemsErr.message });

  return res.json({ items, expires_at: link.expires_at });
}
