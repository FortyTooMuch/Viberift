import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { LogIn, Plus, Layers } from 'lucide-react';
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

  const { collections, setCollections, loading: loadingCollections } = useCollections(user);
  const { decks, setDecks, loading: loadingDecks } = useDecks(user);
  const loading = loadingCollections || loadingDecks;

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

  const signInGoogle = () => supabase.auth.signInWithOAuth({ provider: 'google' });
  const signInDiscord = () => supabase.auth.signInWithOAuth({ provider: 'discord' });

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

  return (
    <Layout>
      {authChecking ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <div style={{ width: 40, height: 40, border: '4px solid rgba(212, 175, 55, 0.2)', borderTop: '4px solid #d4af37', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : !user ? (
        <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', padding: '0 16px' }}>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 42, marginBottom: 16 }}>Welcome to the Guild</h1>
          <p style={{ fontSize: 18, marginBottom: 32 }}>Forge legendary collections. Chronicle card values. Share your vault with the realm.</p>
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
              <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={24} /> Your Decks
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
                    menuOpen={menuOpen}
                    setMenuOpen={setMenuOpen}
                    onRename={() => openRenameDeck(deck)}
                    onChooseImage={() => openDeckImage(deck)}
                    onDuplicate={() => openDuplicateDeck(deck)}
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
    </Layout>
  );
};

export default Home;
