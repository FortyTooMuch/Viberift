import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Button from '../../components/Button';

export default function ShareView() {
  const [data, setData] = useState<any>(null);
  const token = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';

  useEffect(() => {
    async function load() {
      if (!token) return;
      const res = await fetch(`/api/share/view?token=${token}`);
      const body = await res.json();
      setData(body);
    }
    load();
  }, [token]);

  if (!data) return <Layout><main style={{ padding: 16 }}>Loading…</main></Layout>;
  if (data?.error) return <Layout><main style={{ padding: 16 }}>Error: {data.error}</main></Layout>;

  return (
    <Layout>
      <header className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Shared Collection</h2>
        <a href="/collections"><Button variant="secondary">Collections</Button></a>
      </header>
      <div className="card" style={{ marginTop: 12 }}>
        <p>Expires: {data.expires_at ? new Date(data.expires_at).toLocaleString() : 'No expiry'}</p>
        <ol style={{ marginTop: 12 }}>
          {(data.items ?? []).map((i: any) => (
            <li key={i.id}>{i.product_id} — qty {i.quantity} — {i.condition}</li>
          ))}
        </ol>
      </div>
    </Layout>
  );
}
