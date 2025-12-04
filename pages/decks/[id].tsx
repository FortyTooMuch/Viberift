import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import supabase from '../../lib/supabaseClient';
import Layout from '../../components/Layout';
import Button from '../../components/Button';
import { 
  Crown, Sword, Map, Sparkles, Library, List, 
  Filter, Check, X, Plus, Minus, Save, Share2 
} from 'lucide-react';

type Card = {
  card_id: string;
  name: string;
  category: string;
  tags: string[];
  domains: string[];
  energy_cost?: number;
  power_cost?: number;
  might?: number;
  rarity?: string;
  image_url?: string;
};

type DeckCard = {
  id: string;
  card_id: string;
  quantity: number;
  zone: string;
  is_owned: boolean;
  card?: Card;
};

type ValidationChecks = {
  hasLegend: boolean;
  hasChampion: boolean;
  championMatchesLegend: boolean;
  runesComplete: boolean;
  runesDomainMatch: boolean;
  battlefieldsComplete: boolean;
  mainBoardComplete: boolean;
  cardLimitsValid: boolean;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
  checks: ValidationChecks;
};

type Zone = 'legend' | 'champion' | 'battlefield' | 'rune' | 'main' | 'side';

const ZONE_CONFIGS = {
  legend: { name: 'Legend', icon: Crown, max: 1, color: '#d4af37' },
  champion: { name: 'Chosen Champion', icon: Sword, max: 1, color: '#ff6b6b' },
  battlefield: { name: 'Battlefields', icon: Map, max: 3, color: '#4ecdc4' },
  rune: { name: 'Runes', icon: Sparkles, max: 12, color: '#a78bfa' },
  main: { name: 'Main Deck', icon: Library, max: 39, color: '#f0e6d2' },
  side: { name: 'Sideboard', icon: List, max: 8, color: '#94a3b8' },
};

export default function DeckBuilder() {
  const router = useRouter();
  const { id } = router.query;

  const [session, setSession] = useState<any>(null);
  const [deck, setDeck] = useState<any>(null);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  
  const [selectedZone, setSelectedZone] = useState<Zone>('legend');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOwnedOnly, setShowOwnedOnly] = useState(false);
  const [expandedZones, setExpandedZones] = useState<Set<Zone>>(new Set(['legend']));
  
  // Filters
  const [energyFilter, setEnergyFilter] = useState<number | null>(null);
  const [powerFilter, setPowerFilter] = useState<number | null>(null);
  const [mightFilter, setMightFilter] = useState<number | null>(null);
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 2000);
  };

  const toggleZone = (zone: Zone) => {
    const newExpanded = new Set(expandedZones);
    if (newExpanded.has(zone)) {
      newExpanded.delete(zone);
    } else {
      newExpanded.add(zone);
    }
    setExpandedZones(newExpanded);
  };

  useEffect(() => {
    supabase.auth.getSession().then((r) => setSession(r.data.session));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.data.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!id || !session?.access_token) return;
    loadDeck();
  }, [id, session]);

  const loadDeck = async () => {
    if (!session?.access_token || !id) return;
    setLoading(true);

    const [deckRes, cardsRes, allCardsRes, validationRes] = await Promise.all([
      fetch(`/api/decks?id=${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
      fetch(`/api/decks/${id}/cards`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
      fetch('/api/cards/search?q=', { headers: { Authorization: `Bearer ${session.access_token}` } }),
      fetch(`/api/decks/${id}/validate`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
    ]);

    const deckData = await deckRes.json();
    const cardsData = await cardsRes.json();
    const allCardsData = await allCardsRes.json();
    const validationData = await validationRes.json();

    setDeck(deckData);
    setDeckCards(cardsData.cards || []);
    setAllCards(allCardsData.results || []);
    setValidation(validationData || null);
    setLoading(false);
  };

  const legendCard = useMemo(() => {
    if (!deck?.legend_card_id) return null;
    return deckCards.find(dc => dc.card_id === deck.legend_card_id)?.card;
  }, [deck, deckCards]);

  const legendDomains = useMemo(() => {
    return legendCard?.domains || [];
  }, [legendCard]);

  const legendChampionTag = useMemo(() => {
    if (!legendCard?.tags) return null;
    return legendCard.tags.find((tag: string) => tag.toLowerCase() !== 'legend');
  }, [legendCard]);

  const championCard = useMemo(() => {
    if (!deck?.champion_card_id) return null;
    return deckCards.find(dc => dc.card_id === deck.champion_card_id)?.card;
  }, [deck, deckCards]);

  const getZoneCards = (zone: Zone) => {
    return deckCards.filter(dc => dc.zone === zone);
  };

  const getZoneCount = (zone: Zone) => {
    return getZoneCards(zone).reduce((sum, dc) => sum + dc.quantity, 0);
  };

  const filteredCards = useMemo(() => {
    let filtered = allCards.filter(card => {
      // Search query
      if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Owned filter - skip for now, needs proper collection integration
      // if (showOwnedOnly) {
      //   const isInDeck = deckCards.find(dc => dc.card_id === card.card_id && dc.is_owned);
      //   if (!isInDeck) return false;
      // }

      // Zone-specific filters
      switch (selectedZone) {
        case 'legend':
          if (card.category !== 'legend') return false;
          break;
        
        case 'champion':
          if (card.category !== 'champion') return false;
          if (legendChampionTag && !card.tags?.includes(legendChampionTag)) return false;
          break;
        
        case 'battlefield':
          if (card.category !== 'battlefield') return false;
          break;
        
        case 'rune':
          if (card.category !== 'rune') return false;
          if (legendDomains.length > 0) {
            if (!card.domains?.some(d => legendDomains.includes(d))) return false;
          }
          break;
        
        case 'main':
        case 'side':
          // Exclude legends, runes, battlefields
          if (['legend', 'rune', 'battlefield'].includes(card.category)) return false;
          // Filter by domain if legend is selected
          if (legendDomains.length > 0) {
            if (!card.domains?.some(d => legendDomains.includes(d))) return false;
          }
          break;
      }

      // Energy filter
      if (energyFilter !== null && card.energy_cost !== energyFilter) return false;
      
      // Power filter
      if (powerFilter !== null && card.power_cost !== powerFilter) return false;
      
      // Might filter
      if (mightFilter !== null && card.might !== mightFilter) return false;
      
      // Rarity filter
      if (rarityFilter && card.rarity !== rarityFilter) return false;

      return true;
    });

    return filtered;
  }, [allCards, selectedZone, searchQuery, showOwnedOnly, legendDomains, legendChampionTag, energyFilter, powerFilter, mightFilter, rarityFilter, deckCards]);

  const addCard = async (card: Card) => {
    if (!session?.access_token || !id) return;

    const zone: Zone = selectedZone;
    
    // Check if card already exists in deck (any zone for 3-copy limit)
    const existing = deckCards.find(dc => dc.card_id === card.card_id && dc.zone === zone);
    const totalCopies = deckCards
      .filter(dc => dc.card_id === card.card_id)
      .reduce((sum, dc) => sum + dc.quantity, 0);

    // Enforce 3-copy limit (except legend/champion which are limited to 1 by zone)
    if (zone !== 'legend' && zone !== 'champion' && totalCopies >= 3) {
      showNotification(`You can only have 3 copies of "${card.name}" in your deck.`);
      return;
    }

    // Enforce single-card zones
    if (zone === 'legend' || zone === 'champion') {
      const zoneCards = deckCards.filter(dc => dc.zone === zone);
      if (zoneCards.length > 0) {
        showNotification(`You can only have one ${zone} in your deck.`);
        return;
      }
    }

    try {
      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      if (existing) {
        setDeckCards(prev => prev.map(dc => 
          dc.id === existing.id ? { ...dc, quantity: dc.quantity + 1 } : dc
        ));
      } else {
        setDeckCards(prev => [...prev, {
          id: tempId,
          card_id: card.card_id,
          quantity: 1,
          zone,
          is_owned: false,
          card
        }]);
      }

      // Update legend/champion reference in deck
      if (zone === 'legend') {
        setDeck((prev: any) => ({ ...prev, legend_card_id: card.card_id }));
        await fetch(`/api/decks?id=${id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ legend_card_id: card.card_id })
        });
      } else if (zone === 'champion') {
        setDeck((prev: any) => ({ ...prev, champion_card_id: card.card_id }));
        await fetch(`/api/decks?id=${id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ champion_card_id: card.card_id })
        });
      }

      // Add card to deck_cards
      const res = await fetch(`/api/decks/${id}/cards`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          card_id: card.card_id,
          quantity: 1,
          zone
        })
      });

      if (!res.ok) {
        // Revert optimistic update on error
        const errorData = await res.json();
        showNotification(errorData.error || 'Failed to add card');
        await loadDeck();
        return;
      }

      // Sync with server to get correct IDs and ownership
      const added = await res.json();
      setDeckCards(prev => prev.map(dc => 
        dc.id === tempId ? { ...dc, id: added.id } : dc
      ));

      // Refresh validation
      const validationRes = await fetch(`/api/decks/${id}/validate`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (validationRes.ok) {
        setValidation(await validationRes.json());
      }
    } catch (error) {
      console.error('Add card error:', error);
      await loadDeck();
    }
  };

  const removeCard = async (deckCard: DeckCard) => {
    if (!session?.access_token || !id) return;

    try {
      // Optimistic update
      if (deckCard.quantity > 1) {
        setDeckCards(prev => prev.map(dc => 
          dc.id === deckCard.id ? { ...dc, quantity: dc.quantity - 1 } : dc
        ));
      } else {
        setDeckCards(prev => prev.filter(dc => dc.id !== deckCard.id));
      }

      // API call
      if (deckCard.quantity > 1) {
        const res = await fetch(`/api/decks/${id}/cards`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            card_id: deckCard.card_id,
            zone: deckCard.zone,
            quantity: deckCard.quantity - 1
          })
        });
        
        if (!res.ok) {
          await loadDeck();
          return;
        }
      } else {
        const res = await fetch(`/api/decks/${id}/cards?card_id=${deckCard.card_id}&zone=${deckCard.zone}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        
        if (!res.ok) {
          await loadDeck();
          return;
        }
      }

      // Refresh validation
      const validationRes = await fetch(`/api/decks/${id}/validate`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (validationRes.ok) {
        setValidation(await validationRes.json());
      }
    } catch (error) {
      console.error('Remove card error:', error);
      await loadDeck();
    }
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', color: '#d4af37' }}>Loading deck builder...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Notification Bar */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: 64,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'linear-gradient(135deg, rgba(212,175,55,0.95), rgba(180,145,25,0.95))',
          color: '#1a1a2e',
          padding: '12px 24px',
          borderRadius: '0 0 8px 8px',
          fontWeight: 'bold',
          fontSize: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          animation: 'slideDown 0.3s ease-out',
          maxWidth: '90%',
          textAlign: 'center'
        }}>
          {notification}
        </div>
      )}
      
      <div className="deck-builder" style={{ 
        display: 'flex', 
        position: 'fixed', 
        top: 64, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        overflow: 'hidden' 
      }}>
        {/* Left Sidebar - Deck Info & Validation */}
        <div style={{ 
          width: '220px', 
          background: 'rgba(26,20,16,0.95)', 
          borderRight: '2px solid rgba(212,175,55,0.3)',
          overflowY: 'auto',
          padding: '1rem'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontFamily: 'Cinzel, serif', color: '#d4af37' }}>
              {deck?.name || 'Deck'}
            </h2>
            {deck?.description && (
              <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#a0a0a0', lineHeight: '1.4' }}>
                {deck.description}
              </p>
            )}
          </div>

          {/* Validation Checklist */}
          {validation && (
            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: `2px solid ${validation.valid ? '#4ade80' : '#f87171'}` }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(212,175,55,0.2)'
              }}>
                {validation.valid ? <Check size={20} color="#4ade80" /> : <X size={20} color="#f87171" />}
                <h3 style={{ margin: 0, fontSize: '1rem', color: validation.valid ? '#4ade80' : '#f87171', fontFamily: 'Cinzel, serif' }}>
                  {validation.valid ? 'Valid Deck' : 'Invalid Deck'}
                </h3>
              </div>
              {Object.entries(validation.checks)
                .filter(([key]) => key !== 'runesDomainMatch' && key !== 'championMatchesLegend' && key !== 'cardLimitsValid')
                .map(([key, value]) => {
                const labelMap: Record<string, string> = {
                  hasLegend: 'Legend',
                  hasChampion: 'Champion',
                  runesComplete: 'Runes',
                  battlefieldsComplete: 'Battlefields',
                  mainBoardComplete: 'Main'
                };
                const friendly = labelMap[key] ?? key.replace(/([A-Z])/g, ' $1').trim();
                return (
                <div 
                  key={key} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '0.8rem', 
                    marginBottom: '8px',
                    padding: '6px',
                    background: value ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                    borderRadius: '4px',
                    color: value ? '#4ade80' : '#f87171'
                  }}
                >
                  {value ? <Check size={14} /> : <X size={14} />}
                  <span style={{ flex: 1 }}>
                    {friendly}
                  </span>
                </div>
              );})}
            </div>
          )}

          {/* Deck Notes */}
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: 'rgba(0,0,0,0.3)', 
            borderRadius: '6px', 
            border: '2px solid rgba(212,175,55,0.3)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#d4af37', fontFamily: 'Cinzel, serif' }}>
              Deck Notes
            </h3>
            <textarea
              defaultValue={deck?.description || ''}
              placeholder="Describe your deck idea, game plan, and key synergies..."
              onBlur={async (e) => {
                const value = e.currentTarget.value;
                try {
                  await fetch(`/api/decks?id=${id}`, {
                    method: 'PATCH',
                    headers: {
                      Authorization: `Bearer ${session?.access_token}` || '',
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ description: value })
                  });
                  setDeck({ ...deck, description: value });
                } catch {}
              }}
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                display: 'block',
                minHeight: '220px',
                resize: 'vertical',
                padding: '10px',
                background: 'rgba(26,20,16,0.6)',
                border: '1px solid #3d352d',
                borderRadius: '6px',
                color: '#f0e6d2',
                fontSize: '13px',
                lineHeight: 1.6
              }}
            />
          </div>
        </div>

        {/* Middle - Card Browser */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'rgba(15,12,9,0.98)' }}>
          {/* Search and Filters */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '2px solid rgba(212,175,55,0.3)', position: 'sticky', top: 0, background: 'rgba(15,12,9,0.98)', zIndex: 10 }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'rgba(26,20,16,0.6)',
                  border: '1px solid #3d352d',
                  borderRadius: '4px',
                  color: '#f0e6d2',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={() => setShowOwnedOnly(!showOwnedOnly)}
                aria-pressed={showOwnedOnly}
                style={{
                  padding: '8px 10px',
                  background: showOwnedOnly ? 'rgba(74,222,128,0.2)' : 'rgba(42,37,32,0.6)',
                  border: `1px solid ${showOwnedOnly ? '#4ade80' : '#3d352d'}`,
                  borderRadius: '6px',
                  color: showOwnedOnly ? '#4ade80' : '#f0e6d2',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = showOwnedOnly ? 'rgba(74,222,128,0.3)' : 'rgba(42,37,32,0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = showOwnedOnly ? 'rgba(74,222,128,0.2)' : 'rgba(42,37,32,0.6)';
                }}
              >
                <Filter size={16} />
                <span style={{ fontSize: '13px' }}>Owned Only</span>
              </button>
            </div>

            {/* Filters Row */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={energyFilter ?? ''}
                onChange={(e) => setEnergyFilter(e.target.value ? Number(e.target.value) : null)}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(26,20,16,0.6)',
                  border: '1px solid #3d352d',
                  borderRadius: '4px',
                  color: '#f0e6d2',
                  fontSize: '13px'
                }}
              >
                <option value="">Energy: All</option>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              <select
                value={powerFilter ?? ''}
                onChange={(e) => setPowerFilter(e.target.value ? Number(e.target.value) : null)}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(26,20,16,0.6)',
                  border: '1px solid #3d352d',
                  borderRadius: '4px',
                  color: '#f0e6d2',
                  fontSize: '13px'
                }}
              >
                <option value="">Power: All</option>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              <select
                value={rarityFilter ?? ''}
                onChange={(e) => setRarityFilter(e.target.value || null)}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(26,20,16,0.6)',
                  border: '1px solid #3d352d',
                  borderRadius: '4px',
                  color: '#f0e6d2',
                  fontSize: '13px'
                }}
              >
                <option value="">Rarity: All</option>
                <option value="Common">Common</option>
                <option value="Rare">Rare</option>
                <option value="Epic">Epic</option>
                <option value="Legendary">Legendary</option>
              </select>
            </div>
          </div>

          {/* Card Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gap: '1rem' 
            }}>
              {filteredCards.map((card) => {
                const inDeck = deckCards.find(dc => dc.card_id === card.card_id && dc.zone === selectedZone);
                const quantity = inDeck?.quantity || 0;

                return (
                  <div
                    key={card.card_id}
                    style={{
                      background: 'rgba(26,26,46,0.9)',
                      border: '2px solid rgba(212,175,55,0.3)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)';
                    }}
                  >
                    <div style={{ 
                      height: '200px', 
                      background: card.image_url ? `url(/api/proxy-image?url=${encodeURIComponent(card.image_url)})` : 'linear-gradient(135deg, rgba(26,26,46,0.9), rgba(40,40,60,0.9))',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative'
                    }}>
                      {quantity > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(212,175,55,0.95)',
                          color: '#1a1a2e',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}>
                          {quantity}x
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#f0e6d2' }}>
                        {card.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#a0a0a0', marginBottom: '8px' }}>
                        {card.category}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => addCard(card)}
                          style={{
                            flex: 1,
                            padding: '6px',
                            background: 'rgba(74,222,128,0.2)',
                            border: '1px solid #4ade80',
                            borderRadius: '4px',
                            color: '#4ade80',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <Plus size={14} /> Add
                        </button>
                        {quantity > 0 && (
                          <button
                            onClick={() => inDeck && removeCard(inDeck)}
                            style={{
                              flex: 1,
                              padding: '6px',
                              background: 'rgba(248,113,113,0.2)',
                              border: '1px solid #f87171',
                              borderRadius: '4px',
                              color: '#f87171',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <Minus size={14} /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Collapsible Subdecks */}
        <div style={{ 
          width: '260px', 
          background: 'rgba(26,20,16,0.95)', 
          borderLeft: '2px solid rgba(212,175,55,0.3)',
          overflowY: 'auto',
          padding: '1rem'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontFamily: 'Cinzel, serif', color: '#d4af37' }}>
            Deck Zones
          </h3>

          {(Object.keys(ZONE_CONFIGS) as Zone[]).map((zone) => {
            const config = ZONE_CONFIGS[zone];
            const Icon = config.icon;
            const cards = getZoneCards(zone);
            const count = getZoneCount(zone);
            const isExpanded = expandedZones.has(zone);
            const isSelected = selectedZone === zone;

            return (
              <div key={zone} style={{ marginBottom: '12px' }}>
                {/* Zone Header Button */}
                <button
                  onClick={() => {
                    toggleZone(zone);
                    setSelectedZone(zone);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: isSelected ? `${config.color}20` : 'rgba(42,37,32,0.5)',
                    border: `2px solid ${isSelected ? config.color : 'rgba(212,175,55,0.2)'}`,
                    borderRadius: '6px',
                    color: config.color,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s',
                    fontFamily: 'Cinzel, serif'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${config.color}30`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected ? `${config.color}20` : 'rgba(42,37,32,0.5)';
                  }}
                >
                  <Icon size={20} />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{config.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#a0a0a0', marginTop: '2px' }}>
                      {count} / {config.max}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '1.2rem',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </div>
                </button>

                {/* Expanded Card List */}
                {isExpanded && cards.length > 0 && (
                  <div style={{ 
                    marginTop: '8px',
                    paddingLeft: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    {cards.map((dc) => (
                      <div
                        key={dc.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px',
                          background: 'rgba(42,37,32,0.5)',
                          border: `1px solid ${config.color}40`,
                          borderRadius: '6px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(42,37,32,0.8)';
                          e.currentTarget.style.borderColor = `${config.color}80`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(42,37,32,0.5)';
                          e.currentTarget.style.borderColor = `${config.color}40`;
                        }}
                      >
                        <div style={{ 
                          minWidth: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `${config.color}30`,
                          border: `2px solid ${config.color}`,
                          borderRadius: '4px',
                          fontWeight: 'bold', 
                          color: config.color,
                          fontSize: '0.85rem'
                        }}>
                          {dc.quantity}x
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#f0e6d2', fontSize: '0.85rem', fontWeight: '500' }}>
                            {dc.card?.name || dc.card_id}
                          </div>
                          {dc.is_owned && (
                            <div style={{ fontSize: '0.7rem', color: '#4ade80', marginTop: '2px' }}>
                              ✓ Owned
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeCard(dc)}
                          style={{
                            padding: '6px',
                            background: 'rgba(248,113,113,0.2)',
                            border: '1px solid #f87171',
                            borderRadius: '4px',
                            color: '#f87171',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(248,113,113,0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(248,113,113,0.2)';
                          }}
                        >
                          <Minus size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {isExpanded && cards.length === 0 && (
                  <div style={{ 
                    marginTop: '8px',
                    padding: '12px',
                    textAlign: 'center',
                    color: '#666',
                    fontSize: '0.8rem',
                    fontStyle: 'italic'
                  }}>
                    No cards added yet
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <style jsx>{`
        .deck-builder button {
          box-shadow: none !important;
        }
        
        @keyframes slideDown {
          from {
            transform: translateX(-50%) translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </Layout>
  );
}
