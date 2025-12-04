import { NextApiRequest, NextApiResponse } from 'next';
import { getPrice } from '../../lib/cardmarket';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { cardId } = req.query;
    if (!cardId || Array.isArray(cardId)) {
      return res.status(400).json({ error: 'cardId required' });
    }

    const price = await getPrice(String(cardId));
    return res.json(price);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}
