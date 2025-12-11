import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { LogIn, Plus, Layers, Check, X, Share2 } from 'lucide-react';
import CollectionCard from '../components/CollectionCard';
import DeckCard from '../components/DeckCard';
import { TextInputModal, ConfirmModal, ImageModal } from '../components/Modals';
import { useCollections } from '../hooks/useCollections';
import { useDecks } from '../hooks/useDecks';
import supabase from '../lib/supabaseClient';

type ModalType =
  | 'create'
  | 'rename'
  | 'image'
  | 'duplicate'
  | 'delete'
  | 'createDeck'
  | 'renameDeck'
  | 'imageDeck'
  | 'duplicateDeck'
  | 'deleteDeck'
  | 'shareDeck'
  | null;

const Home: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<any>(null);
  const [selectedDeck, setSelectedDeck] = useState<any>(null);
  const [inputValue, setInputValue] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [vaultCards, setVaultCards] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [deckMetadata, setDeckMetadata] = useState<Record<string, { domains: string[]; valid: boolean }>>({});
  const [vaultMetadata, setVaultMetadata] = useState<Record<string, { totalValue: number }>>({});
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  const { collections, setCollections, loading: loadingCollections } = useCollections(user);
  const { decks, setDecks, loading: loadingDecks } = useDecks(user);
  const loading = loadingCollections || loadingDecks;

  useEffect(() => {
    const fetchDeckMetadata = async () => {
      if (!user || decks.length === 0) return;
      const token = await getToken();
      if (!token) return;

      const metadataPromises = decks.map(async (deck) => {
        try {
          const [cardsRes, validationRes] = await Promise.all([
            fetch(`/api/decks/${deck.id}/cards`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`/api/decks/${deck.id}/validate`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          const cardsData = cardsRes.ok ? await cardsRes.json() : { cards: [] };
          const validationData = validationRes.ok ? await validationRes.json() : { valid: false };

          // Extract legend card to get domains
          const legendCard = cardsData.cards?.find((dc: any) => dc.zone === 'legend')?.card;
          const domains = legendCard?.domains || [];
          const normalizedDomains = domains
            .flatMap((d: string) => d.split(/[,;]+/))
            .map((d: string) => d.trim())
            .filter(Boolean);

          return { deckId: deck.id, domains: normalizedDomains, valid: validationData.valid };
        } catch {
          return { deckId: deck.id, domains: [], valid: false };
        }
      });

      const metadata = await Promise.all(metadataPromises);
      const metadataMap = metadata.reduce((acc, item) => {
        acc[item.deckId] = { domains: item.domains, valid: item.valid };
        return acc;
      }, {} as Record<string, { domains: string[]; valid: boolean }>);

      setDeckMetadata(metadataMap);
    };

    fetchDeckMetadata();
  }, [decks, user]);

  useEffect(() => {
    const fetchVaultMetadata = async () => {
      if (!user || collections.length === 0) return;
      const token = await getToken();
      if (!token) return;

      const metadataPromises = collections.map(async (collection) => {
        try {
          const [itemsRes, pricesRes] = await Promise.all([
            fetch(`/api/collections/${collection.id}/cards`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`/api/collections/${collection.id}/cards`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          const itemsData = itemsRes.ok ? await itemsRes.json() : { items: [] };
          const items = itemsData.items || [];

          // Fetch prices for all cards in this vault
          const cardIds: string[] = Array.from(new Set(items.map((i: any) => String(i.card_id)))) as string[];
          const pricePromises = cardIds.map(async (cardId: string) => {
            try {
              const priceRes = await fetch(`/api/prices?cardId=${encodeURIComponent(cardId)}`);
              const priceData = await priceRes.json();
              return { cardId, average: Number(priceData.average ?? 0) };
            } catch {
              return { cardId, average: 0 };
            }
          });

          const prices = await Promise.all(pricePromises);
          const priceMap = Object.fromEntries(prices.map(p => [p.cardId, p.average]));

          // Calculate total value
          let totalValue = 0;
          for (const item of items) {
            const price = priceMap[item.card_id] || 0;
            totalValue += price * (Number(item.quantity) || 1);
          }

          return { collectionId: collection.id, totalValue };
        } catch {
          return { collectionId: collection.id, totalValue: 0 };
        }
      });

      const metadata = await Promise.all(metadataPromises);
      const metadataMap = metadata.reduce((acc, item) => {
        acc[item.collectionId] = { totalValue: item.totalValue };
        return acc;
      }, {} as Record<string, { totalValue: number }>);

      setVaultMetadata(metadataMap);
    };

    fetchVaultMetadata();
  }, [collections, user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthChecking(false);
    });

    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthChecking(false);
    });

    return () => subscription.data.subscription?.unsubscribe();
  }, []);

  const redirectBase =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL;

  const signInGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectBase || undefined }
    });

  const signInDiscord = () =>
    supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: redirectBase || undefined }
    });

  const getToken = async () => {
    const session = await supabase.auth.getSession();
    return session.data.session?.access_token;
  };

  // Collection actions
  const openCreateCollection = () => {
    setInputValue('');
    setModalType('create');
  };

  const handleCreateCollection = async () => {
    const name = inputValue.trim() || 'New Vault';
    const token = await getToken();
    if (!token) return;

    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      const payload = await res.json();
      setCollections([...collections, payload]);
    }
    setInputValue('');
    setModalType(null);
  };

  const openRenameCollection = (collection: any) => {
    setSelectedCollection(collection);
    setInputValue(collection?.name || '');
    setModalType('rename');
    setMenuOpen(null);
  };

  const handleRenameCollection = async () => {
    if (!selectedCollection) return;
    const name = inputValue.trim();
    if (!name) return;

    const token = await getToken();
    if (!token) return;

    const res = await fetch(`/api/collections/${selectedCollection.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      const updated = await res.json();
      setCollections(collections.map(c => (c.id === updated.id ? updated : c)));
    }

    setModalType(null);
    setSelectedCollection(null);
    setInputValue('');
  };

  const openCollectionImage = async (collection: any) => {
    setSelectedCollection(collection);
    setCardSearch('');
    setModalType('image');
    setLoadingCards(true);
    setVaultCards([]);

    const token = await getToken();
    if (!token) {
      setLoadingCards(false);
      return;
    }

    const res = await fetch(`/api/collections/${collection.id}/cards`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const payload = await res.json();
      setVaultCards(payload.items || []);
    }

    setLoadingCards(false);
    setMenuOpen(null);
  };

  const handleChooseCollectionImage = async (imageUrl: string, _focus?: string) => {
    if (!selectedCollection || !imageUrl) return;

    const token = await getToken();
    if (!token) return;

    const res = await fetch(`/api/collections/${selectedCollection.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    if (res.ok) {
      const updated = await res.json();
      setCollections(collections.map(c => (c.id === updated.id ? updated : c)));
    }

    setModalType(null);
    setSelectedCollection(null);
    setCardSearch('');
    setVaultCards([]);
  };

  const openDuplicateCollection = (collection: any) => {
    setSelectedCollection(collection);
    setModalType('duplicate');
    setMenuOpen(null);
  };

  const handleDuplicateCollection = async () => {
    if (!selectedCollection) return;

    const token = await getToken();
    if (!token) return;

    const res = await fetch(`/api/collections/${selectedCollection.id}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const payload = await res.json();
      setCollections([...collections, payload]);
    }

    setModalType(null);
    setSelectedCollection(null);
  };

  const openDeleteCollection = (collection: any) => {
    setSelectedCollection(collection);
    setModalType('delete');
    setMenuOpen(null);
  };

  const handleDeleteCollection = async () => {
    if (!selectedCollection) return;

    const token = await getToken();
    if (!token) return;

    const res = await fetch(`/api/collections/${selectedCollection.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setCollections(collections.filter(c => c.id !== selectedCollection.id));
    }

    setModalType(null);
    setSelectedCollection(null);
  };

  // Deck actions
  const openCreateDeck = () => {
    setInputValue('');
    setModalType('createDeck');
  };

  const handleCreateDeck = async () => {
    const name = inputValue.trim() || 'New Deck';
    const token = await getToken();
    if (!token) return;

    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      const payload = await res.json();
      setDecks([...decks, payload]);
    }

    setModalType(null);
    setInputValue('');
  };

  const openRenameDeck = (deck: any) => {
    setSelectedDeck(deck);
    setInputValue(deck?.name || '');
    setModalType('renameDeck');
    setMenuOpen(null);
  };

  const handleRenameDeck = async () => {
    if (!selectedDeck) return;
    const name = inputValue.trim();
    if (!name) return;

    const token = await getToken();
    if (!token) return;

    const res = await fetch(`/api/decks?id=${selectedDeck.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      const updated = await res.json();
      setDecks(decks.map(d => (d.id === updated.id ? updated : d)));
    }

    setModalType(null);
    setSelectedDeck(null);
    setInputValue('');
  };

  const openDeckImage = async (deck: any) => {
    setSelectedDeck(deck);
    setCardSearch('');
    setModalType('imageDeck');
    setLoadingCards(true);
    setVaultCards([]);

    const token = await getToken();
    if (!token) {
      setLoadingCards(false);
      return;
    }

    const res = await fetch(`/api/decks/${deck.id}/cards`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const payload = await res.json();
      setVaultCards(payload.cards || []);
    }

    setLoadingCards(false);
    setMenuOpen(null);
  };

  const handleChooseDeckImage = async (imageUrl: string, _focus?: string) => {
    if (!selectedDeck || !imageUrl) return;

    const token = await getToken();
    if (!token) return;

    const res = await fetch(`/api/decks?id=${selectedDeck.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    if (res.ok) {
      const updated = await res.json();
      setDecks(decks.map(d => (d.id === updated.id ? updated : d)));
    }

    setModalType(null);
    setSelectedDeck(null);
    setCardSearch('');
    setVaultCards([]);
  };

  const openDuplicateDeck = (deck: any) => {
    setSelectedDeck(deck);
    setModalType('duplicateDeck');
    setMenuOpen(null);
  };

  const handleDuplicateDeck = async () => {
    if (!selectedDeck) return;

    const token = await getToken();
    if (!token) return;

    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${selectedDeck.name || 'Deck'} (Copy)`,
        description: selectedDeck.description || null,
      }),
    });

    if (res.ok) {
      const payload = await res.json();
      setDecks([...decks, payload]);
    }

    setModalType(null);
    setSelectedDeck(null);
  };

  const openDeleteDeck = (deck: any) => {
    setSelectedDeck(deck);
    setModalType('deleteDeck');
    setMenuOpen(null);
  };

  const handleDeleteDeck = async () => {
    if (!selectedDeck) return;

    const token = await getToken();
    if (!token) return;

    const res = await fetch(`/api/decks?id=${selectedDeck.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setDecks(decks.filter(d => d.id !== selectedDeck.id));
    }

    setModalType(null);
    setSelectedDeck(null);
  };

  const openShareDeck = (deck: any) => {
    setSelectedDeck(deck);
    setShareLink(null);
    setModalType('shareDeck');
    setMenuOpen(null);
  };

  const generateShareLink = async () => {
    if (!selectedDeck) return;
    const token = await getToken();
    if (!token) return;
    
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/decks/${selectedDeck.id}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        const link = `${window.location.origin}/shared/${data.token}`;
        setShareLink(link);
      }
    } catch (error) {
      console.error('Generate share link error:', error);
    } finally {
      setGeneratingLink(false);
    }
  };

  const exportDeckToCSV = () => {
    if (!selectedDeck) return;
    
    // We'll need to fetch the deck cards first
    const fetchAndExport = async () => {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/decks/${selectedDeck.id}/cards`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        const rows = [['Zone', 'Card Name', 'Quantity', 'Category']];
        
        data.cards?.forEach((dc: any) => {
          if (dc.card) {
            rows.push([
              dc.zone,
              dc.card.name,
              dc.quantity.toString(),
              dc.card.category || ''
            ]);
          }
        });

        const csvContent = rows.map(row => 
          row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedDeck.name || 'deck'}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      }
    };

    fetchAndExport();
  };

  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
    }
  };

  return (
    <Layout>
      {authChecking ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div style={{ width: 40, height: 40, border: '4px solid rgba(212, 175, 55, 0.2)', borderTop: '4px solid #d4af37', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : !user ? (
        <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', padding: '0 16px' }}>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 42, marginBottom: 16 }}>Master Your Collection</h1>
          <p style={{ fontSize: 18, marginBottom: 32, lineHeight: 1.6 }}>
            Build competitive decks with intelligent validation. Track your card portfolio with real-time market pricing. 
            Organize your collection across custom vaults. Everything you need to elevate your Riftbound TCG experience.
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
          {/* Collections */}
          <div className="collection-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12 }}>
            <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif' }}>Your Vaults</h2>
            <Button onClick={openCreateCollection} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              {collections.map(c => (
                <CollectionCard
                  key={c.id}
                  collection={c}
                  metadata={vaultMetadata[c.id]}
                  menuOpen={menuOpen}
                  setMenuOpen={setMenuOpen}
                  onRename={() => openRenameCollection(c)}
                  onChooseImage={() => openCollectionImage(c)}
                  onDuplicate={() => openDuplicateCollection(c)}
                  onDelete={() => openDeleteCollection(c)}
                />
              ))}
            </div>
          )}

          {/* Decks */}
          <div style={{ marginTop: 48, borderTop: '2px solid rgba(212, 175, 55, 0.2)', paddingTop: 32 }}>
            <div className="collection-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12 }}>
              <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif' }}>
                Your Decks
              </h2>
              <Button onClick={openCreateDeck} variant="secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                {decks.map(deck => (
                  <DeckCard
                    key={deck.id}
                    deck={deck}
                    metadata={deckMetadata[deck.id]}
                    menuOpen={menuOpen}
                    setMenuOpen={setMenuOpen}
                    onRename={() => openRenameDeck(deck)}
                    onChooseImage={() => openDeckImage(deck)}
                    onDuplicate={() => openDuplicateDeck(deck)}
                    onShare={() => openShareDeck(deck)}
                    onDelete={() => openDeleteDeck(deck)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collection Modals */}
      <TextInputModal
        open={modalType === 'create'}
        title="Create New Vault"
        inputValue={inputValue}
        setInputValue={setInputValue}
        onClose={() => setModalType(null)}
        onAction={handleCreateCollection}
        actionLabel="Create"
      />

      <TextInputModal
        open={modalType === 'rename'}
        title="Rename Vault"
        inputValue={inputValue}
        setInputValue={setInputValue}
        onClose={() => setModalType(null)}
        onAction={handleRenameCollection}
        actionLabel="Save"
      />

      <ImageModal
        open={modalType === 'image'}
        title="Set Vault Cover Image"
        cardSearch={cardSearch}
        setCardSearch={setCardSearch}
        loadingCards={loadingCards}
        vaultCards={vaultCards}
        onChoose={handleChooseCollectionImage}
        onClose={() => setModalType(null)}
        emptyText="No cards in this vault yet."
      />

      <ConfirmModal
        open={modalType === 'duplicate'}
        title="Duplicate Vault"
        message={`Duplicate ${selectedCollection?.name || 'this vault'}?`}
        onClose={() => setModalType(null)}
        onConfirm={handleDuplicateCollection}
        confirmLabel="Duplicate"
      />

      <ConfirmModal
        open={modalType === 'delete'}
        title="Delete Vault"
        message="Are you sure? This cannot be undone."
        onClose={() => setModalType(null)}
        onConfirm={handleDeleteCollection}
        confirmLabel="Delete"
        danger
      />

      {/* Deck Modals */}
      <TextInputModal
        open={modalType === 'createDeck'}
        title="Create New Deck"
        inputValue={inputValue}
        setInputValue={setInputValue}
        onClose={() => setModalType(null)}
        onAction={handleCreateDeck}
        actionLabel="Create"
      />

      <TextInputModal
        open={modalType === 'renameDeck'}
        title="Rename Deck"
        inputValue={inputValue}
        setInputValue={setInputValue}
        onClose={() => setModalType(null)}
        onAction={handleRenameDeck}
        actionLabel="Save"
      />

      <ImageModal
        open={modalType === 'imageDeck'}
        title="Set Deck Cover Image"
        cardSearch={cardSearch}
        setCardSearch={setCardSearch}
        loadingCards={loadingCards}
        vaultCards={vaultCards}
        onChoose={handleChooseDeckImage}
        onClose={() => setModalType(null)}
        emptyText="No cards in this deck yet."
      />

      <ConfirmModal
        open={modalType === 'duplicateDeck'}
        title="Duplicate Deck"
        message={`Duplicate ${selectedDeck?.name || 'this deck'}? (cards are not copied).`}
        onClose={() => setModalType(null)}
        onConfirm={handleDuplicateDeck}
        confirmLabel="Duplicate"
      />

      <ConfirmModal
        open={modalType === 'deleteDeck'}
        title="Delete Deck"
        message="Are you sure? This cannot be undone."
        onClose={() => setModalType(null)}
        onConfirm={handleDeleteDeck}
        confirmLabel="Delete"
        danger
      />

      {/* Share Deck Modal */}
      {modalType === 'shareDeck' && selectedDeck && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '24px'
          }}
          onClick={() => setModalType(null)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(15,12,9,0.98), rgba(26,20,16,0.98))',
              border: '2px solid rgba(212,175,55,0.5)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.5rem', fontFamily: 'Cinzel, serif', color: '#d4af37' }}>
              Share {selectedDeck.name}
            </h2>

            {/* Export CSV */}
            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.3)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#f0e6d2' }}>Export as CSV</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#a0a0a0' }}>
                Download your deck list as a CSV file
              </p>
              <button
                onClick={() => {
                  exportDeckToCSV();
                  setModalType(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(74,222,128,0.4)',
                  background: 'transparent',
                  color: '#4ade80',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  boxShadow: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(74,222,128,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(74,222,128,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(74,222,128,0.4)';
                }}
              >
                Download CSV
              </button>
            </div>

            {/* Generate Public Link */}
            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.3)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#f0e6d2' }}>Public Link</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#a0a0a0' }}>
                Create a shareable link that anyone can view
              </p>
              {shareLink ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ 
                    padding: '10px', 
                    background: 'rgba(26,20,16,0.6)', 
                    border: '1px solid #3d352d', 
                    borderRadius: '4px',
                    color: '#f0e6d2',
                    fontSize: '13px',
                    wordBreak: 'break-all'
                  }}>
                    {shareLink}
                  </div>
                  <button
                    onClick={copyShareLink}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(96,165,250,0.4)',
                      background: 'transparent',
                      color: '#60a5fa',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      boxShadow: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(96,165,250,0.1)';
                      e.currentTarget.style.borderColor = 'rgba(96,165,250,0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)';
                    }}
                  >
                    Copy Link
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateShareLink}
                  disabled={generatingLink}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: generatingLink ? '1px solid rgba(153,153,153,0.4)' : '1px solid rgba(192,132,252,0.4)',
                    background: 'transparent',
                    color: generatingLink ? '#999999' : '#c084fc',
                    cursor: generatingLink ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    opacity: generatingLink ? 0.5 : 1,
                    boxShadow: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!generatingLink) {
                      e.currentTarget.style.background = 'rgba(192,132,252,0.1)';
                      e.currentTarget.style.borderColor = 'rgba(192,132,252,0.6)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!generatingLink) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'rgba(192,132,252,0.4)';
                    }
                  }}
                >
                  {generatingLink ? 'Generating...' : 'Generate Link'}
                </button>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => setModalType(null)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid rgba(239,68,68,0.4)',
                background: 'transparent',
                color: '#ef4444',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                boxShadow: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Home;
