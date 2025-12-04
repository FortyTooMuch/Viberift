import React, { useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { Package, LogIn, UserPlus, Plus, Layers } from 'lucide-react';
import Modal from '../components/Modal';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'create' | 'rename' | 'image' | 'duplicate' | 'delete' | 'createDeck' | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<any>(null);
  const [inputValue, setInputValue] = useState('');
  const [vaultCards, setVaultCards] = useState<any[]>([]);
  const [cardSearch, setCardSearch] = useState('');
  const [loadingCards, setLoadingCards] = useState(false);

  useEffect(() => {
    const session = supabase.auth.getSession().then((r) => r.data.session);
    session.then((s) => {
      setUser(s?.user ?? null);
      setAuthChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthChecking(false);
    });
    return () => sub?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleClick = () => setMenuOpen(null);
    if (menuOpen) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [menuOpen]);

  useEffect(() => {
    async function loadCollections() {
      if (!user) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        setLoading(false);
        return;
      }

      const [collectionsRes, decksRes] = await Promise.all([
        fetch('/api/collections', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/decks', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      const collectionsPayload = await collectionsRes.json();
      const decksPayload = await decksRes.json();
      
      setCollections(collectionsPayload.collections ?? []);
      setDecks(decksPayload.decks ?? []);
      setLoading(false);
    }
    loadCollections();
  }, [user]);

  const signInGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const signInDiscord = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'discord' });
  };

  const onCreate = () => {
    setInputValue('');
    setModalType('create');
  };

  const onCreateDeck = () => {
    setInputValue('');
    setModalType('createDeck');
  };

  const handleCreate = async () => {
    const name = inputValue.trim() || 'Untitled Vault';
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;
    
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    if (res.ok) {
      const payload = await res.json();
      setCollections([...collections, payload]);
    }
    setModalType(null);
  };

  const handleCreateDeck = async () => {
    const name = inputValue.trim() || 'Untitled Deck';
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;
    
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    if (res.ok) {
      const payload = await res.json();
      // Navigate to deck builder
      window.location.href = `/decks/${payload.id}`;
    }
    setModalType(null);
  };

  const onRename = (collection: any) => {
    setSelectedCollection(collection);
    setInputValue(collection.name);
    setModalType('rename');
    setMenuOpen(null);
  };

  const handleRename = async () => {
    if (!selectedCollection || !inputValue.trim()) return;
    
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;
    
    const res = await fetch(`/api/collections/${selectedCollection.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: inputValue.trim() })
    });
    
    if (res.ok) {
      setCollections(collections.map(c => c.id === selectedCollection.id ? { ...c, name: inputValue.trim() } : c));
    }
    setModalType(null);
  };

  const onChooseImage = async (collection: any) => {
    setSelectedCollection(collection);
    setCardSearch('');
    setModalType('image');
    setMenuOpen(null);
    
    // Load cards in this vault
    setLoadingCards(true);
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;
    
    const res = await fetch(`/api/collections/${collection.id}/cards`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      // Sort by price descending (most valuable first)
      const sorted = (data.items || []).sort((a: any, b: any) => {
        const priceA = a.card?.price || 0;
        const priceB = b.card?.price || 0;
        return priceB - priceA;
      });
      setVaultCards(sorted);
    }
    setLoadingCards(false);
  };

  const handleChooseImage = async (cardImageUrl: string) => {
    if (!selectedCollection || !cardImageUrl) return;
    
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;
    
    const res = await fetch(`/api/collections/${selectedCollection.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: cardImageUrl })
    });
    
    if (res.ok) {
      setCollections(collections.map(c => c.id === selectedCollection.id ? { ...c, image_url: cardImageUrl } : c));
    }
    setModalType(null);
  };

  const onDuplicate = (collection: any) => {
    setSelectedCollection(collection);
    setModalType('duplicate');
    setMenuOpen(null);
  };

  const handleDuplicate = async () => {
    if (!selectedCollection) return;
    
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;
    
    const res = await fetch(`/api/collections/${selectedCollection.id}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const payload = await res.json();
      setCollections([...collections, payload]);
    }
    setModalType(null);
  };

  const onDelete = (collection: any) => {
    setSelectedCollection(collection);
    setModalType('delete');
    setMenuOpen(null);
  };

  const handleDelete = async () => {
    if (!selectedCollection) return;
    
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;
    
    const res = await fetch(`/api/collections/${selectedCollection.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      setCollections(collections.filter(c => c.id !== selectedCollection.id));
    }
    setModalType(null);
  };

  return (
    <Layout>
      {authChecking ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div style={{ width: 40, height: 40, border: '4px solid rgba(212, 175, 55, 0.2)', borderTop: '4px solid #d4af37', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : !user ? (
        <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', padding: '0 16px' }}>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 42, marginBottom: 16 }}>
            Welcome to the Guild
          </h1>
          <p style={{ fontSize: 18, marginBottom: 32 }}>
            Forge legendary collections. Chronicle card values. Share your vault with the realm.
          </p>
          <div className="welcome-buttons" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button onClick={signInGoogle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogIn size={18} /> Sign in with Google
            </Button>
            <Button onClick={signInDiscord} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogIn size={18} /> Sign in with Discord
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="collection-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12 }}>
            <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif' }}>Your Vaults</h2>
            <Button onClick={onCreate} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} /> New Vault
            </Button>
          </div>

          {loading ? (
            <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="card" style={{ height: 200, animation: 'pulse 2s infinite' }} />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p className="muted">No vaults yet. Create your first collection!</p>
            </div>
          ) : (
            <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {collections.map((c) => (
                <div 
                  key={c.id} 
                  className="card" 
                  style={{ 
                    height: 200,
                    position: 'relative',
                    backgroundImage: c.image_url ? `url(${c.image_url})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(212,175,55,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6)';
                  }}
                >
                  <a 
                    href={`/collections/${c.id}`}
                    style={{ 
                      textDecoration: 'none', 
                      color: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: '100%',
                      cursor: 'pointer'
                    }}
                  >
                      <div 
                        style={{ 
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, rgba(26,20,16,0.3) 0%, rgba(15,12,9,0.85) 100%)',
                          pointerEvents: 'none'
                        }}
                      />
                      <div style={{ position: 'relative', zIndex: 1, padding: 16 }}>
                        <h3 style={{ 
                          margin: 0, 
                          fontFamily: 'Cinzel, serif', 
                          fontSize: 20,
                          color: '#d4af37',
                          textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                        }}>
                          {c.name}
                        </h3>
                        {c.description && (
                          <p className="muted" style={{ 
                            marginTop: 8, 
                            fontSize: 14,
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                          }}>
                            {c.description}
                          </p>
                        )}
                      </div>
                      <div style={{ 
                        position: 'relative', 
                        zIndex: 1, 
                        padding: 16, 
                        borderTop: '1px solid rgba(212,175,55,0.2)' 
                      }}>
                        <small className="muted" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                          Created {new Date(c.created_at).toLocaleDateString()}
                        </small>
                      </div>
                  </a>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpen(menuOpen === c.id ? null : c.id);
                    }}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      zIndex: 10,
                      background: 'rgba(15,12,9,0.85)',
                      border: 'none',
                      borderRadius: 4,
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#d4af37',
                      fontSize: 18,
                      fontWeight: 'bold',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                    }}
                  >
                    ⋮
                  </button>
                  {menuOpen === c.id && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 44,
                        right: 8,
                        zIndex: 11,
                        background: 'rgba(15,12,9,0.95)',
                        border: '1px solid #d4af37',
                        borderRadius: 4,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.8)',
                        minWidth: 160,
                        overflow: 'hidden'
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRename(c);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: 'transparent',
                          border: 'none',
                          color: '#b8a895',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 14,
                          borderBottom: '1px solid rgba(212,175,55,0.2)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212,175,55,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onChooseImage(c);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: 'transparent',
                          border: 'none',
                          color: '#b8a895',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 14,
                          borderBottom: '1px solid rgba(212,175,55,0.2)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212,175,55,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Set Cover Image
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDuplicate(c);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: 'transparent',
                          border: 'none',
                          color: '#b8a895',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 14,
                          borderBottom: '1px solid rgba(212,175,55,0.2)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212,175,55,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDelete(c);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: 'transparent',
                          border: 'none',
                          color: '#d9534f',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 14
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(217,83,79,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Decks Section */}
          <div style={{ marginTop: 48, borderTop: '2px solid rgba(212, 175, 55, 0.2)', paddingTop: 32 }}>
            <div className="collection-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12 }}>
              <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={24} /> Your Decks
              </h2>
              <Button onClick={onCreateDeck} variant="secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={18} /> New Deck
              </Button>
            </div>

            {loading ? (
              <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {[1, 2].map(i => (
                  <div key={i} className="card" style={{ height: 150, animation: 'pulse 2s infinite' }} />
                ))}
              </div>
            ) : decks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <p className="muted">No decks yet. Build your first deck!</p>
              </div>
            ) : (
              <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {decks.map((deck) => (
                  <a
                    key={deck.id}
                    href={`/decks/${deck.id}`}
                    className="card"
                    style={{
                      height: 150,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: 20,
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.3s ease',
                      background: 'linear-gradient(135deg, rgba(42,37,32,0.9) 0%, rgba(26,20,16,0.9) 100%)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(212,175,55,0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6)';
                    }}
                  >
                    <h3 style={{ margin: '0 0 8px 0', fontFamily: 'Cinzel, serif', fontSize: 18 }}>{deck.name}</h3>
                    {deck.description && (
                      <p className="muted" style={{ fontSize: 14, margin: 0 }}>{deck.description}</p>
                    )}
                    <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 12, color: '#a0a0a0' }}>
                      Updated {new Date(deck.updated_at).toLocaleDateString()}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Action Bar - Only visible on mobile */}
      {user && !loading && (
        <div className="mobile-bottom-bar">
          <Button onClick={onCreate} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <Plus size={18} /> New Vault
          </Button>
        </div>
      )}

      <Modal open={modalType === 'create'} title="Create New Vault" onClose={() => setModalType(null)}>
        <input
          type="text"
          placeholder="Vault name"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(26,20,16,0.6)',
            border: '1px solid #3d352d',
            borderRadius: 4,
            color: '#e8dcc4',
            fontSize: 14,
            marginBottom: 16
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setModalType(null)}>Cancel</Button>
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </Modal>

      <Modal open={modalType === 'createDeck'} title="Create New Deck" onClose={() => setModalType(null)}>
        <input
          type="text"
          placeholder="Deck name"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateDeck()}
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(26,20,16,0.6)',
            border: '1px solid #3d352d',
            borderRadius: 4,
            color: '#e8dcc4',
            fontSize: 14,
            marginBottom: 16
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setModalType(null)}>Cancel</Button>
          <Button onClick={handleCreateDeck}>Create</Button>
        </div>
      </Modal>

      <Modal open={modalType === 'rename'} title="Rename Vault" onClose={() => setModalType(null)}>
        <input
          type="text"
          placeholder="Vault name"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(26,20,16,0.6)',
            border: '1px solid #3d352d',
            borderRadius: 4,
            color: '#e8dcc4',
            fontSize: 14,
            marginBottom: 16
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setModalType(null)}>Cancel</Button>
          <Button onClick={handleRename}>Save</Button>
        </div>
      </Modal>

      <Modal open={modalType === 'image'} title="Set Cover Image" onClose={() => setModalType(null)}>
        <input
          type="text"
          placeholder="Search cards..."
          value={cardSearch}
          onChange={(e) => setCardSearch(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(26,20,16,0.6)',
            border: '1px solid #3d352d',
            borderRadius: 4,
            color: '#e8dcc4',
            fontSize: 14,
            marginBottom: 16
          }}
        />
        {loadingCards ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ animation: 'pulse 2s infinite' }}>Loading cards...</div>
          </div>
        ) : vaultCards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <p className="muted">No cards in this vault yet.</p>
            <Button variant="ghost" onClick={() => setModalType(null)} style={{ marginTop: 12 }}>Close</Button>
          </div>
        ) : (
          <>
            <div style={{
              maxHeight: 400,
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 12,
              marginBottom: 16
            }}>
              {vaultCards
                .filter((item: any) => 
                  !cardSearch || 
                  item.card?.name?.toLowerCase().includes(cardSearch.toLowerCase())
                )
                .map((item: any, idx: number) => (
                  <div
                    key={item.id || item.card_id}
                    onClick={() => handleChooseImage(item.card?.image_url)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: 4,
                      overflow: 'hidden',
                      border: selectedCollection?.image_url === item.card?.image_url 
                        ? '2px solid #d4af37' 
                        : '2px solid transparent',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCollection?.image_url !== item.card?.image_url) {
                        e.currentTarget.style.border = '2px solid rgba(212,175,55,0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCollection?.image_url !== item.card?.image_url) {
                        e.currentTarget.style.border = '2px solid transparent';
                      }
                    }}
                  >
                    {item.card?.image_url ? (
                      <img 
                        src={item.card.image_url} 
                        alt={item.card?.name || 'Card'} 
                        style={{ 
                          width: '100%', 
                          display: 'block',
                          aspectRatio: '5/7',
                          objectFit: 'cover'
                        }} 
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        aspectRatio: '5/7',
                        background: 'rgba(26,20,16,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        color: '#666'
                      }}>
                        No Image
                      </div>
                    )}
                    {idx === 0 && (
                      <div style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: '#d4af37',
                        color: '#0f0c09',
                        fontSize: 10,
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: 3,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                      }}>
                        MOST VALUABLE
                      </div>
                    )}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                      padding: '4px 6px',
                      fontSize: 10,
                      color: '#e8dcc4'
                    }}>
                      {item.card?.name || 'Unknown'}
                    </div>
                  </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setModalType(null)}>Cancel</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={modalType === 'duplicate'} title="Duplicate Vault" onClose={() => setModalType(null)}>
        <p style={{ marginBottom: 16 }}>
          This will create a copy of <strong style={{ color: '#d4af37' }}>{selectedCollection?.name}</strong> including all cards.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setModalType(null)}>Cancel</Button>
          <Button onClick={handleDuplicate}>Duplicate</Button>
        </div>
      </Modal>

      <Modal open={modalType === 'delete'} title="Delete Vault" onClose={() => setModalType(null)}>
        <p style={{ marginBottom: 16 }}>
          Are you sure you want to delete <strong style={{ color: '#d4af37' }}>{selectedCollection?.name}</strong>?
          <br /><br />
          <span style={{ color: '#d9534f' }}>This action cannot be undone.</span>
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setModalType(null)}>Cancel</Button>
          <Button onClick={handleDelete} style={{ background: '#d9534f', borderColor: '#d9534f' }}>Delete</Button>
        </div>
      </Modal>
    </Layout>
  );
}
