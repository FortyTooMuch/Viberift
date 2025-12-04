import { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../lib/supabaseServer';

function toCsv(rows: any[], fields: string[]): string {
  const escape = (val: any) => {
    if (val === null || val === undefined) return '';
    const s = String(val).replace(/"/g, '""');
    return /[",\r\n]/.test(s) ? `"${s}"` : s;
  };
  const header = fields.join(',');
  const lines = rows.map((r) => fields.map((f) => escape(r[f])).join(','));
  return [header, ...lines].join('\r\n');
}

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
    const collectionId = String(req.query.collectionId ?? '');
    if (!collectionId) return res.status(400).json({ error: 'collectionId required' });

    const { data, error } = await supabaseServer.from('collection_items').select('*').eq('collection_id', collectionId);
    if (error) throw error;

    const fields = ['id', 'card_id', 'quantity', 'condition', 'added_at'];
    const csv = toCsv(data ?? [], fields);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=collection-${collectionId}.csv`);
    res.status(200).send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Server error' });
  }
}
