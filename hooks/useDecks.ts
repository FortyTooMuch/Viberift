import { useState, useEffect } from 'react';
import supabase from '../lib/supabaseClient';

export function useDecks(user: any) {
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function loadDecks() {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return setLoading(false);
      const res = await fetch('/api/decks', { headers: { Authorization: `Bearer ${token}` } });
      const payload = await res.json();
      setDecks(payload.decks ?? []);
      setLoading(false);
    }
    loadDecks();
  }, [user]);

  return { decks, setDecks, loading };
}
