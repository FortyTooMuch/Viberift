import React, { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import Layout from '../../components/Layout';
import Button from '../../components/Button';
import { Package, Plus, ExternalLink } from 'lucide-react';

export default function CollectionsPage() {
  const [session, setSession] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then((r) => setSession(r.data.session));
    const subscription = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.data.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    async function load() {
      if (!session?.access_token) return;
      const res = await fetch('/api/collections', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const payload = await res.json();
      setCollections(payload.collections ?? []);
    }
    load();
  }, [session]);

  const onCreate = async () => {
    const name = prompt('Name your vault') ?? 'Untitled Vault';
    if (!session?.access_token) return;
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const c = await res.json();
    setCollections((prev) => [c, ...prev]);
  };

  return (
    <Layout>
      <header className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={24} /> Your Vaults
          </h2>
          <p className="muted" style={{ marginTop: 6 }}>Create and manage your card collections.</p>
        </div>
        <Button onClick={onCreate} className="desktop-only-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={18} /> New Vault
        </Button>
      </header>

      <div className="card" style={{ marginTop: 16 }}>
        {collections.length === 0 ? (
          <p className="muted">No vaults forged yet. Begin your chronicle!
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {collections.map((c) => (
              <li key={c.id} style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <a href={`/collections/${c.id}`}>{c.name}</a>
                  <div className="muted" style={{ fontSize: 12 }}>created {new Date(c.created_at).toLocaleString()}</div>
                </div>
                <a href={`/collections/${c.id}`}>
                  <Button variant="secondary">Open</Button>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="mobile-bottom-bar">
        <Button onClick={onCreate} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
          <Plus size={18} /> New Vault
        </Button>
      </div>
    </Layout>
  );
}
