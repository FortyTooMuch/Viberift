import { useState, useEffect } from 'react';
import supabase from '../lib/supabaseClient';

export function useCollections(user: any) {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function loadCollections() {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return setLoading(false);
      const res = await fetch('/api/collections', { headers: { Authorization: `Bearer ${token}` } });
      const payload = await res.json();
      setCollections(payload.collections ?? []);
      setLoading(false);
    }
    loadCollections();
  }, [user]);

  return { collections, setCollections, loading };
}
