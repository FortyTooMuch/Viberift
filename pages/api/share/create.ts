import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../lib/supabaseServer';

function expiryFromParam(param?: string): Date | null {
  switch ((param ?? '').toLowerCase()) {
    case '1d':
      return new Date(Date.now() + 24 * 3600 * 1000);
    case '3d':
      return new Date(Date.now() + 3 * 24 * 3600 * 1000);
    case '1m':
      return new Date(Date.now() + 30 * 24 * 3600 * 1000);
    case 'none':
    case 'noend':
    case 'infinite':
      return null;
    default:
      return new Date(Date.now() + 24 * 3600 * 1000);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') ?? null;
  const { data: userRes } = await supabaseServer.auth.getUser(token ?? '');
  const user = userRes?.user ?? null;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { collectionId, expiry } = req.body ?? {};
  if (!collectionId) return res.status(400).json({ error: 'collectionId required' });

  const expiresAt = expiryFromParam(expiry);
  const tokenStr = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const { data, error } = await supabaseServer
    .from('share_links')
    .insert([{ collection_id: collectionId, token: tokenStr, expires_at: expiresAt }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  const link = data?.[0];
  return res.status(201).json({ url: `/share/${link.token}`, expires_at: link.expires_at });
}
