import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import supabase from '../../lib/supabaseClient';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Layout from '../../components/Layout';
import { Plus, MoreVertical, Edit, Trash2, Share2, Download, Upload, X } from 'lucide-react';

export default function CollectionView({}) {
  const router = useRouter();
  const { id: rawId } = router.query;
  const id = typeof rawId === 'string' ? rawId : undefined;
  
  const [session, setSession] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [collection, setCollection] = useState<any>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [prices, setPrices] = useState<Record<string, { lowest: number; average: number }>>({});
  const [expiry, setExpiry] = useState<string>('1d');
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [cardDetailOpen, setCardDetailOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [detailForm, setDetailForm] = useState<{ quantity: number; condition: string; language: string; bought_at: number | null }>({ quantity: 1, condition: 'NM', language: 'EN', bought_at: null });
  const [form, setForm] = useState<{ cardId: string; quantity: number; condition: string; language: string }>({ cardId: '', quantity: 1, condition: 'NM', language: 'EN' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then((r) => setSession(r.data.session));
    const subscription = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.data.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    async function load() {
      // Wait for router to be ready and have valid id
      if (!router.isReady || !id || !session?.access_token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const [cRes, itemsRes] = await Promise.all([
        fetch(`/api/collections?id=${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then((r) => r.json()),
        fetch(`/api/collections/${id}/cards`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then((r) => r.json())
      ]);

      setCollection(cRes?.[0] ?? cRes ?? null);
      setItems(itemsRes?.items ?? []);

      // fetch prices for each card_id (on-demand)
      const unique = Array.from(new Set((itemsRes?.items ?? []).map((i: any) => i.card_id)));
      const entries = await Promise.all(
        unique.map(async (cid: string) => {
          const r = await fetch(`/api/prices?cardId=${encodeURIComponent(cid)}`);
          const b = await r.json();
          return [cid, { lowest: Number(b.lowest ?? 0), average: Number(b.average ?? 0) }] as const;
        })
      );
      setPrices(Object.fromEntries(entries));
      setLoading(false);
    }
    load();
  }, [session, id, router.isReady]);

  const searchCards = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}`);
    const body = await res.json();
    setSearchResults(body.results ?? []);
  };

  const selectCard = (card: any) => {
    setForm((f) => ({ ...f, cardId: card.card_id }));
    setSearchQuery(card.name);
    setSearchResults([]);
  };

  const addItem = async () => {
    const cardId = form.cardId.trim();
    const quantity = Number(form.quantity);
    const condition = form.condition;
    if (!id || !cardId) return;
    if (!session?.access_token) return;

    const res = await fetch('/api/collections/items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId: id, cardId, quantity, condition })
    });

    const body = await res.json();
    if (res.ok) {
      // Refresh the entire collection to get updated items with card details
      const itemsRes = await fetch(`/api/collections/${id}/cards`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      }).then((r) => r.json());
      
      setItems(itemsRes?.items ?? []);
      
      // Fetch price for the newly added card
      const priceRes = await fetch(`/api/prices?cardId=${encodeURIComponent(cardId)}`);
      const priceBody = await priceRes.json();
      setPrices((prev) => ({
        ...prev,
        [cardId]: { lowest: Number(priceBody.lowest ?? 0), average: Number(priceBody.average ?? 0) }
      }));
      
      setAddOpen(false);
      setForm({ cardId: '', quantity: 1, condition: 'NM', language: 'EN' });
      setSearchQuery('');
      setSearchResults([]);
    } else {
      console.error(body?.error ?? 'Failed');
    }
  };

  const openDeleteConfirm = (item: any) => {
    setItemToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const openCardDetail = (item: any) => {
    setSelectedCard(item);
    setDetailForm({
      quantity: item.quantity,
      condition: item.condition,
      language: item.language || 'EN',
      bought_at: item.bought_at || null
    });
    setDetailEditMode(false);
    setCardDetailOpen(true);
  };

  const saveCardDetails = async () => {
    if (!selectedCard || !session?.access_token) return;

    const res = await fetch(`/api/collections/items?id=${selectedCard.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        quantity: detailForm.quantity,
        condition: detailForm.condition,
        language: detailForm.language,
        bought_at: detailForm.bought_at
      })
    });

    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === selectedCard.id ? { ...i, ...updated } : i)));
      setSelectedCard((prev: any) => ({ ...prev, ...updated }));
      setDetailEditMode(false);
    }
  };

  const deleteItem = async () => {
    if (!itemToDelete || !session?.access_token) return;
    if (!id) return;

    const res = await fetch(`/api/collections/items?id=${itemToDelete.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` }
    });

    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setForm({
      cardId: item.card_id,
      quantity: item.quantity,
      condition: item.condition,
      language: item.language || 'EN'
    });
    setEditOpen(true);
  };

  const updateItem = async () => {
    if (!editingItem || !session?.access_token) return;

    const res = await fetch(`/api/collections/items?id=${editingItem.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        quantity: form.quantity,
        condition: form.condition,
        language: form.language
      })
    });

    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? { ...i, ...updated } : i)));
      setEditOpen(false);
      setEditingItem(null);
      setForm({ cardId: '', quantity: 1, condition: 'NM', language: 'EN' });
    }
  };

  const createShare = async () => {
    if (!id || !session?.access_token) return;
    const res = await fetch('/api/share/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId: id, expiry })
    });
    const body = await res.json();
    if (res.ok && body?.url) { setShareUrl(body.url); setShareOpen(false); }
    else console.error(body?.error ?? 'Failed to create share link');
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    // naive CSV parsing: expect headers id,card_id,quantity,condition,added_at
    const lines = text.split(/\r?\n/).filter(Boolean);
    const header = lines.shift()?.split(',') ?? [];
    const idxCard = header.indexOf('card_id');
    const idxQty = header.indexOf('quantity');
    const idxCond = header.indexOf('condition');
    if (!id || !session?.access_token) return;
    for (const line of lines) {
      const cols = line.split(',');
      const cardId = cols[idxCard] ?? '';
      const quantity = Number(cols[idxQty] ?? '1');
      const condition = cols[idxCond] ?? undefined;
      if (!cardId) continue;
      const res = await fetch('/api/collections/items', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: id, cardId, quantity, condition })
      });
      if (res.ok) {
        const body = await res.json();
        setItems((s) => [body, ...s]);
      }
    }
    alert('Import complete');
  };

  return (
    <Layout>
      <div className="container">
        <div className="header">
          <h1>{collection?.name ?? 'Vault'}</h1>
          <div className="header-actions">
            <Button onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} /> Add Card
            </Button>
            <Button onClick={() => setOptionsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MoreVertical size={18} /> Options
            </Button>
          </div>
        </div>

        {loading ? (
          <>
            <div className="totals-card">
              <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
                {[1, 2].map(i => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ width: 100, height: 16, background: 'rgba(212,175,55,0.2)', borderRadius: 4, margin: '0 auto 8px', animation: 'pulse 2s infinite' }} />
                    <div style={{ width: 120, height: 32, background: 'rgba(212,175,55,0.2)', borderRadius: 4, margin: '0 auto', animation: 'pulse 2s infinite' }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="cards-grid">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="card-item" style={{ animation: 'pulse 2s infinite' }}>
                  <div className="card-image-container">
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(212,175,55,0.2)' }} />
                  </div>
                  <div className="card-prices" style={{ padding: '1rem' }}>
                    <div style={{ width: '100%', height: 20, background: 'rgba(212,175,55,0.2)', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="totals-card">
              <Totals items={items} prices={prices} />
            </div>

            <div className="cards-grid">
              {items.map((i) => {
            const p = prices[i.card_id] ?? { lowest: 0, average: 0 };
            const cardName = i.card?.name || i.card_id;
            // Use the image_url from database through proxy to avoid CORS issues
            const cardImage = i.card?.image_url ? `/api/proxy-image?url=${encodeURIComponent(i.card.image_url)}` : null;
            
            // Calculate price change if bought_at exists
            const boughtAt = i.bought_at ? Number(i.bought_at) : null;
            const currentPrice = p.average;
            const priceChange = boughtAt && currentPrice ? (currentPrice - boughtAt) * i.quantity : null;
            const priceChangePercent = boughtAt && boughtAt > 0 ? ((currentPrice - boughtAt) / boughtAt) * 100 : null;
            
            return (
              <div key={i.id} className="card-item">
                <div className="card-actions">
                  <button className="action-btn edit-btn" onClick={(e) => { e.stopPropagation(); openEditModal(i); }} title="Edit">
                    <Edit size={16} />
                  </button>
                  <button className="action-btn delete-btn" onClick={(e) => { e.stopPropagation(); openDeleteConfirm(i); }} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="card-image-container" onClick={() => openCardDetail(i)} style={{ cursor: 'pointer' }}>
                  {cardImage ? (
                    <img 
                      src={cardImage} 
                      alt={cardName} 
                      className="card-image"
                      onError={(e) => {
                        // Hide image if it fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="card-placeholder">
                      <div>{cardName}</div>
                    </div>
                  )}
                  <div className="card-overlay">
                    <div className="card-name">{cardName}</div>
                    <div className="card-details">
                      <span className="card-quantity">Qty: {i.quantity}</span>
                      <span className="card-condition">{i.condition}</span>
                      {i.language && <span className="card-language">{i.language}</span>}
                    </div>
                  </div>
                </div>
                <div className="card-prices">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1rem', color: '#d4af37' }}>€</span>
                    <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f0e6d2' }}>{(p.lowest * i.quantity).toFixed(2)}</span>
                  </div>
                  {priceChange !== null && (
                    <div 
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        color: priceChange >= 0 ? '#4ade80' : '#f87171',
                        fontWeight: 'bold',
                        fontSize: '0.95rem'
                      }}
                    >
                      {priceChange >= 0 ? '▲' : '▼'}
                      <span>€{Math.abs(priceChange).toFixed(2)}</span>
                      {priceChangePercent !== null && (
                        <span style={{ fontSize: '0.85em', opacity: 0.9 }}>({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(0)}%)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
            </div>
          </>
        )}

        {/* Share Modal */}
        <Modal open={addOpen} title="Add Card to Vault" onClose={() => { setAddOpen(false); setSearchQuery(''); setSearchResults([]); }}>
          <div className="row">
            <div style={{ flex: 1, position: 'relative' }}>
              <label>Card Name</label>
              <input value={searchQuery} onChange={(e) => searchCards(e.target.value)} placeholder="Search for a card..." />
              {searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'rgba(26,20,16,0.98)', border: '2px solid #3d352d', borderRadius: 6, marginTop: 4, maxHeight: 200, overflowY: 'auto', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.8)' }}>
                  {searchResults.map((card) => (
                    <div key={card.card_id} onClick={() => selectCard(card)} style={{ padding: 10, cursor: 'pointer', borderBottom: '1px solid #3d352d', transition: 'background 0.2s' }}>
                      <div style={{ color: '#d4af37', fontWeight: 600 }}>{card.name} - {card.card_id}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{card.set_name} • {card.collector_number}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label>Quantity</label>
              <input type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value || 1) }))} />
            </div>
            <div>
              <label>Condition</label>
              <select value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}>
                <option value="M">Mint</option>
                <option value="NM">Near Mint</option>
                <option value="LP">Lightly Played</option>
                <option value="MP">Moderately Played</option>
                <option value="HP">Heavily Played</option>
                <option value="D">Damaged</option>
              </select>
            </div>
            <div>
              <label>Language</label>
              <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}>
                <option value="EN">English</option>
                <option value="FR">French</option>
                <option value="DE">German</option>
                <option value="IT">Italian</option>
                <option value="ES">Spanish</option>
                <option value="PT">Portuguese</option>
                <option value="JA">Japanese</option>
                <option value="KO">Korean</option>
                <option value="CN">Chinese</option>
              </select>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={addItem}>Add Card</Button>
          </div>
        </Modal>

        {/* Options Modal */}
        <Modal open={optionsOpen} title="Collection Options" onClose={() => setOptionsOpen(false)}>
          <div className="options-section">
            <h3>Share Collection</h3>
            <label>Link Expires</label>
            <select value={expiry} onChange={(e) => setExpiry(e.target.value)} style={{ width: '100%', marginBottom: 12 }}>
              <option value="1d">1 day</option>
              <option value="3d">3 days</option>
              <option value="1m">1 month</option>
              <option value="none">Never</option>
            </select>
            <Button onClick={() => setShareOpen(true)}>Create Share Link</Button>
          </div>

          <div className="options-section">
            <h3>Export Collection</h3>
            <a href={`/api/collections/export?collectionId=${collection?.id}`}>
              <Button>Export as CSV</Button>
            </a>
          </div>

          <div className="options-section">
            <h3>Import Cards</h3>
            <input type="file" accept="text/csv" onChange={(e) => e.target.files && importCsv(e.target.files[0])} style={{ width: '100%' }} />
          </div>
        </Modal>

        {/* Card Detail Modal */}
        <Modal open={cardDetailOpen} title={selectedCard?.card?.name || selectedCard?.card_id} onClose={() => { setCardDetailOpen(false); setSelectedCard(null); }}>
          <div className="card-detail-container">
            <div className="card-detail-image">
              {selectedCard?.card?.image_url ? (
                <img 
                  src={`/api/proxy-image?url=${encodeURIComponent(selectedCard.card.image_url)}`}
                  alt={selectedCard?.card?.name || selectedCard?.card_id}
                  style={{ width: '100%', borderRadius: '8px' }}
                />
              ) : (
                <div style={{ background: 'rgba(26, 26, 46, 0.9)', padding: '2rem', borderRadius: '8px', textAlign: 'center', color: '#d4af37' }}>
                  No image available
                </div>
              )}
            </div>
            <div className="card-detail-info">
              <div className="detail-row">
                <span className="detail-label">Set:</span>
                <span className="detail-value">{selectedCard?.card?.set_name || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Collector Number:</span>
                <span className="detail-value">{selectedCard?.card?.collector_number || selectedCard?.card_id || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Card Type:</span>
                <span className="detail-value">{selectedCard?.card?.category || selectedCard?.card?.card_type || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Rarity:</span>
                <span className="detail-value">{selectedCard?.card?.rarity || 'N/A'}</span>
              </div>
              {selectedCard?.card?.domains && selectedCard.card.domains.length > 0 && (
                <div className="detail-row">
                  <span className="detail-label">Domains:</span>
                  <span className="detail-value">{selectedCard.card.domains.join(', ')}</span>
                </div>
              )}
              {selectedCard?.card?.energy_cost !== null && selectedCard?.card?.energy_cost !== undefined && (
                <div className="detail-row">
                  <span className="detail-label">Energy Cost:</span>
                  <span className="detail-value">{selectedCard.card.energy_cost}</span>
                </div>
              )}
              {selectedCard?.card?.power_cost !== null && selectedCard?.card?.power_cost !== undefined && (
                <div className="detail-row">
                  <span className="detail-label">Power Cost:</span>
                  <span className="detail-value">{selectedCard.card.power_cost}</span>
                </div>
              )}
              {selectedCard?.card?.might !== null && selectedCard?.card?.might !== undefined && (
                <div className="detail-row">
                  <span className="detail-label">Might:</span>
                  <span className="detail-value">{selectedCard.card.might}</span>
                </div>
              )}
              {selectedCard?.card?.tags && selectedCard.card.tags.length > 0 && (
                <div className="detail-row">
                  <span className="detail-label">Tags:</span>
                  <span className="detail-value">{selectedCard.card.tags.join(', ')}</span>
                </div>
              )}
              {selectedCard?.card?.abilities_text && (
                <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className="detail-label">Abilities:</span>
                  <span className="detail-value" style={{ marginTop: '0.5rem' }}>{selectedCard.card.abilities_text}</span>
                </div>
              )}
              {selectedCard?.card?.flavor_text && (
                <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className="detail-label">Flavor Text:</span>
                  <span className="detail-value" style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#a0a0a0' }}>{selectedCard.card.flavor_text}</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid rgba(212, 175, 55, 0.3)', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: '#d4af37', margin: 0, fontSize: '1.1rem' }}>Your Collection</h3>
                  {!detailEditMode ? (
                    <Button onClick={() => setDetailEditMode(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Edit</Button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button onClick={() => { setDetailEditMode(false); setDetailForm({ quantity: selectedCard?.quantity, condition: selectedCard?.condition, language: selectedCard?.language || 'EN', bought_at: selectedCard?.bought_at || null }); }} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', background: 'rgba(160, 160, 160, 0.2)' }}>Cancel</Button>
                      <Button onClick={saveCardDetails} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Save</Button>
                    </div>
                  )}
                </div>
                <div className="detail-row">
                  <span className="detail-label">Quantity:</span>
                  {detailEditMode ? (
                    <input 
                      type="number" 
                      min={1} 
                      value={detailForm.quantity} 
                      onChange={(e) => setDetailForm((f) => ({ ...f, quantity: Number(e.target.value || 1) }))}
                      style={{ width: '80px', padding: '0.25rem 0.5rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '4px', color: '#f0e6d2' }}
                    />
                  ) : (
                    <span className="detail-value">{selectedCard?.quantity}</span>
                  )}
                </div>
                <div className="detail-row">
                  <span className="detail-label">Condition:</span>
                  {detailEditMode ? (
                    <select 
                      value={detailForm.condition} 
                      onChange={(e) => setDetailForm((f) => ({ ...f, condition: e.target.value }))}
                      style={{ padding: '0.25rem 0.5rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '4px', color: '#f0e6d2' }}
                    >
                      <option value="M">Mint</option>
                      <option value="NM">Near Mint</option>
                      <option value="LP">Lightly Played</option>
                      <option value="MP">Moderately Played</option>
                      <option value="HP">Heavily Played</option>
                      <option value="D">Damaged</option>
                    </select>
                  ) : (
                    <span className="detail-value">{selectedCard?.condition}</span>
                  )}
                </div>
                <div className="detail-row">
                  <span className="detail-label">Language:</span>
                  {detailEditMode ? (
                    <select 
                      value={detailForm.language} 
                      onChange={(e) => setDetailForm((f) => ({ ...f, language: e.target.value }))}
                      style={{ padding: '0.25rem 0.5rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '4px', color: '#f0e6d2' }}
                    >
                      <option value="EN">English</option>
                      <option value="FR">French</option>
                      <option value="DE">German</option>
                      <option value="IT">Italian</option>
                      <option value="ES">Spanish</option>
                      <option value="PT">Portuguese</option>
                      <option value="JA">Japanese</option>
                      <option value="KO">Korean</option>
                      <option value="CN">Chinese</option>
                    </select>
                  ) : (
                    <span className="detail-value">{selectedCard?.language || 'EN'}</span>
                  )}
                </div>
                <div className="detail-row">
                  <span className="detail-label">Bought At:</span>
                  {detailEditMode ? (
                    <input 
                      type="number" 
                      step="0.01"
                      min={0}
                      placeholder="Price paid"
                      value={detailForm.bought_at || ''} 
                      onChange={(e) => setDetailForm((f) => ({ ...f, bought_at: e.target.value ? Number(e.target.value) : null }))}
                      style={{ width: '100px', padding: '0.25rem 0.5rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '4px', color: '#f0e6d2' }}
                    />
                  ) : (
                    <span className="detail-value">{selectedCard?.bought_at ? `€${Number(selectedCard.bought_at).toFixed(2)}` : 'Not set'}</span>
                  )}
                </div>
                {prices[selectedCard?.card_id] && (
                  <>
                    <div className="detail-row">
                      <span className="detail-label">Lowest Price:</span>
                      <span className="detail-value" style={{ color: '#d4af37', fontWeight: 'bold' }}>€{prices[selectedCard.card_id].lowest.toFixed(2)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Average Price:</span>
                      <span className="detail-value" style={{ color: '#d4af37', fontWeight: 'bold' }}>€{prices[selectedCard.card_id].average.toFixed(2)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Total Value (Lowest):</span>
                      <span className="detail-value" style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '1.1rem' }}>€{(prices[selectedCard.card_id].lowest * selectedCard.quantity).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal open={deleteConfirmOpen} title="Delete Card" onClose={() => { setDeleteConfirmOpen(false); setItemToDelete(null); }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ color: '#f0e6d2', marginBottom: '1rem' }}>
              Are you sure you want to delete <strong style={{ color: '#d4af37' }}>{itemToDelete?.card?.name || itemToDelete?.card_id}</strong> from this collection?
            </p>
            <p style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>
              Quantity: {itemToDelete?.quantity} • Condition: {itemToDelete?.condition}
            </p>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button onClick={() => { setDeleteConfirmOpen(false); setItemToDelete(null); }} style={{ background: 'rgba(160, 160, 160, 0.2)', color: '#f0e6d2' }}>
              Cancel
            </Button>
            <Button onClick={deleteItem} style={{ background: 'rgba(220, 53, 69, 0.9)', color: 'white' }}>
              Delete
            </Button>
          </div>
        </Modal>

        {/* Edit Item Modal */}
        <Modal open={editOpen} title="Edit Card" onClose={() => { setEditOpen(false); setEditingItem(null); }}>
          <div className="row">
            <div>
              <label>Quantity</label>
              <input type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value || 1) }))} />
            </div>
            <div>
              <label>Condition</label>
              <select value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}>
                <option value="M">Mint</option>
                <option value="NM">Near Mint</option>
                <option value="LP">Lightly Played</option>
                <option value="MP">Moderately Played</option>
                <option value="HP">Heavily Played</option>
                <option value="D">Damaged</option>
              </select>
            </div>
            <div>
              <label>Language</label>
              <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}>
                <option value="EN">English</option>
                <option value="FR">French</option>
                <option value="DE">German</option>
                <option value="IT">Italian</option>
                <option value="ES">Spanish</option>
                <option value="PT">Portuguese</option>
                <option value="JA">Japanese</option>
                <option value="KO">Korean</option>
                <option value="CN">Chinese</option>
              </select>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <Button onClick={updateItem}>Save Changes</Button>
          </div>
        </Modal>

        {/* Share Link Modal */}
        <Modal open={shareOpen} title="Create Share Link" onClose={() => setShareOpen(false)}>
          <div className="row">
            <div>
              <label>Link Expires</label>
              <select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                <option value="1d">1 day</option>
                <option value="3d">3 days</option>
                <option value="1m">1 month</option>
                <option value="none">Never</option>
              </select>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={createShare}>Create Link</Button>
          </div>
          {shareUrl && (
            <div style={{ marginTop: 16 }}>
              <input type="text" readOnly value={window.location.origin + shareUrl} style={{ width: '100%', padding: 8 }} />
              <Button onClick={() => navigator.clipboard.writeText(window.location.origin + shareUrl)} style={{ marginTop: 8 }}>Copy Link</Button>
            </div>
          )}
        </Modal>
      </div>

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        .back-link {
          color: #d4af37;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 1.5rem;
          font-size: 0.95rem;
          transition: color 0.2s;
        }

        .back-link:hover {
          color: #f0d070;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .header h1 {
          font-size: 2rem;
          color: #f0e6d2;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 0.75rem;
        }

        .totals-card {
          background: rgba(26, 26, 46, 0.8);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .card-item {
          background: rgba(26, 26, 46, 0.9);
          border: 2px solid rgba(212, 175, 55, 0.3);
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.3s ease;
          position: relative;
        }

        .card-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 16px rgba(212, 175, 55, 0.4);
          border-color: rgba(212, 175, 55, 0.6);
        }

        .card-item:hover .card-actions {
          opacity: 1;
        }

        .card-actions {
          position: absolute;
          top: 8px;
          right: 8px;
          display: flex;
          gap: 6px;
          z-index: 2;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
        }

        .action-btn svg {
          display: block;
        }

        .edit-btn {
          background: rgba(212, 175, 55, 0.9);
          color: #1a1a2e;
        }

        .edit-btn:hover {
          background: rgba(212, 175, 55, 1);
          transform: scale(1.1);
        }

        .delete-btn {
          background: rgba(220, 53, 69, 0.9);
          color: white;
        }

        .delete-btn:hover {
          background: rgba(220, 53, 69, 1);
          transform: scale(1.1);
        }

        .card-image-container {
          position: relative;
          width: 100%;
          padding-bottom: 140%;
          overflow: hidden;
          background: #000;
        }

        .card-image {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .card-placeholder {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(26, 26, 46, 0.9), rgba(40, 40, 60, 0.9));
          color: #d4af37;
          font-weight: bold;
          text-align: center;
          padding: 1rem;
        }

        .card-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.98), rgba(0, 0, 0, 0.85) 50%, rgba(0, 0, 0, 0.4));
          padding: 0.75rem;
          color: #f0e6d2;
        }

        .card-name {
          font-weight: bold;
          font-size: 0.95rem;
          margin-bottom: 0.5rem;
          color: #f0e6d2;
        }

        .card-details {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }

        .card-quantity {
          color: #d4af37;
        }

        .card-condition {
          color: #a0a0a0;
        }

        .card-prices {
          padding: 0.6rem 0.75rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0, 0, 0, 0.4);
          border-top: 1px solid rgba(212, 175, 55, 0.2);
        }

        .price-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .price-label {
          font-size: 0.75rem;
          color: #a0a0a0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .price-value {
          font-size: 1.1rem;
          font-weight: bold;
          color: #d4af37;
        }

        .options-section {
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid rgba(212, 175, 55, 0.2);
        }

        .options-section:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .options-section h3 {
          color: #d4af37;
          margin-bottom: 1rem;
          font-size: 1.1rem;
        }

        .options-section label {
          display: block;
          margin-bottom: 0.5rem;
          color: #f0e6d2;
        }

        .options-section select,
        .options-section input[type="text"],
        .options-section input[type="file"] {
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 4px;
          color: #f0e6d2;
        }

        .card-detail-container {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 2rem;
          min-height: 500px;
        }

        .card-detail-image {
          display: flex;
          align-items: flex-start;
        }

        .card-detail-info {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
          border: 1px solid rgba(212, 175, 55, 0.2);
        }

        .detail-label {
          font-weight: 600;
          color: #a0a0a0;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .detail-value {
          color: #f0e6d2;
          font-size: 1rem;
          text-align: right;
        }

        .mobile-bottom-bar {
          display: none;
        }

        @media (max-width: 768px) {
          .card-detail-container {
            grid-template-columns: 1fr;
          }
          
          .card-detail-image {
            max-width: 400px;
            margin: 0 auto;
          }

          .header-actions {
            display: none;
          }

          .mobile-bottom-bar {
            display: flex;
          }

          .cards-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 1rem;
          }

          .header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .header h1 {
            font-size: 1.5rem;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>

      {/* Mobile Bottom Action Bar */}
      <div className="mobile-bottom-bar">
        <Button onClick={() => setAddOpen(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
          <Plus size={18} /> Add Card
        </Button>
        <Button onClick={() => setOptionsOpen(true)} variant="secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
          <MoreVertical size={18} /> Options
        </Button>
      </div>
    </Layout>
  );
}

function Totals({ items, prices }: { items: any[]; prices: Record<string, { lowest: number; average: number }> }) {
  const totals = useMemo(() => {
    let lowest = 0;
    let average = 0;
    for (const i of items) {
      const p = prices[i.card_id] ?? { lowest: 0, average: 0 };
      lowest += p.lowest * (Number(i.quantity) || 1);
      average += p.average * (Number(i.quantity) || 1);
    }
    return { lowest, average };
  }, [items, prices]);

  return (
    <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#a0a0a0', fontSize: '0.85rem', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lowest Total</div>
        <div style={{ color: '#d4af37', fontSize: '1.5rem', fontWeight: 'bold' }}>€{totals.lowest.toFixed(2)}</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#a0a0a0', fontSize: '0.85rem', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Average Total</div>
        <div style={{ color: '#d4af37', fontSize: '1.5rem', fontWeight: 'bold' }}>€{totals.average.toFixed(2)}</div>
      </div>
    </div>
  );
}
