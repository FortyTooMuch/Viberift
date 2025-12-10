import type { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../../lib/supabaseServer';

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
  const { id } = req.query;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = await getUserFromToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    try {
      console.log('Current authenticated user ID:', user.id);
      console.log('Current authenticated user email:', user.email);
      
      // Debug: Log all user's decks
      const { data: allUserDecks } = await supabaseServer
        .from('decks')
        .select('id, name, user_id')
        .eq('user_id', user.id);
      
      console.log('User decks:', allUserDecks?.map(d => ({ id: d.id, name: d.name })));
      console.log('Requested deck ID:', id);
      
      // Also check who owns the requested deck
      const { data: requestedDeck } = await supabaseServer
        .from('decks')
        .select('id, name, user_id')
        .eq('id', id)
        .maybeSingle();
      
      if (requestedDeck) {
        console.log('Requested deck exists but belongs to user:', requestedDeck.user_id);
        console.log('Current user trying to share:', user.id);
        console.log('User IDs match:', requestedDeck.user_id === user.id);
      }

      // First verify the deck exists and belongs to the user
      const { data: deckCheck, error: checkError } = await supabaseServer
        .from('decks')
        .select('id, user_id')
        .eq('id', id)
        .single();

      if (checkError || !deckCheck) {
        console.error('Deck not found:', id, checkError);
        console.error('Available deck IDs:', allUserDecks?.map(d => d.id));
        return res.status(404).json({ error: 'Deck not found' });
      }

      if (deckCheck.user_id !== user.id) {
        console.error('Unauthorized: deck belongs to different user');
        return res.status(403).json({ error: 'You do not have permission to share this deck' });
      }

      // Generate a unique share token
      const shareToken = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      // Update the deck with the share token
      const { data, error } = await supabaseServer
        .from('decks')
        .update({ share_token: shareToken })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      return res.status(200).json({ token: shareToken });
    } catch (error: any) {
      console.error('Share deck error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate share link' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
