import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { 
  Crown, Sword, Map, Sparkles, Library, List, Check, X 
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
  collector_number?: string;
  abilities_text?: string;
  flavor_text?: string;
};

type DeckCard = {
  id: string;
  card_id: string;
  quantity: number;
  zone: string;
  is_owned: boolean;
  card?: Card;
};

type Zone = 'legend' | 'champion' | 'battlefield' | 'rune' | 'main' | 'side';
type ZoneFilter = 'all' | Zone;
type ViewMode = 'grid' | 'list';
type SortField = 'quantity' | 'name' | 'category' | 'domains' | 'rarity' | 'energy' | 'power';

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic'];
const rarityRank = (value?: string) => {
  if (!value) return 99;
  const idx = RARITY_ORDER.findIndex(r => r.toLowerCase() === value.toLowerCase());
  return idx === -1 ? 99 : idx;
};

const ZONE_CONFIGS = {
  legend: { name: 'Legend', icon: Crown, max: 1, color: '#d4af37' },
  champion: { name: 'Chosen Champion', icon: Sword, max: 1, color: '#ff6b6b' },
  battlefield: { name: 'Battlefields', icon: Map, max: 3, color: '#4ecdc4' },
  rune: { name: 'Runes', icon: Sparkles, max: 12, color: '#a78bfa' },
  main: { name: 'Main Deck', icon: Library, max: 39, color: '#f0e6d2' },
  side: { name: 'Sideboard', icon: List, max: 8, color: '#94a3b8' },
};

export default function SharedDeckView() {
  const router = useRouter();
  const { token } = router.query;

  const [deck, setDeck] = useState<any>(null);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailModalCard, setDetailModalCard] = useState<Card | null>(null);
  const [hoverPreviewCard, setHoverPreviewCard] = useState<Card | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedZones, setExpandedZones] = useState<Set<Zone>>(
    new Set<Zone>(['legend', 'champion', 'battlefield', 'rune', 'main', 'side'])
  );
  const previewSize = { width: 240, height: 340 };
  const handlePrint = () => {
    if (viewMode !== 'list') {
      setViewMode('list');
      setTimeout(() => window.print(), 50);
    } else {
      window.print();
    }
  };

  const safePreviewPos = useMemo(() => {
    if (!hoverPos) return null;
    if (typeof window === 'undefined') return hoverPos;
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - previewSize.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - previewSize.height - margin);
    return {
      x: Math.min(hoverPos.x, maxLeft),
      y: Math.min(hoverPos.y, maxTop)
    };
  }, [hoverPos]);

  // Filters
  const [energyFilter, setEnergyFilter] = useState<number | null>(null);
  const [powerFilter, setPowerFilter] = useState<number | null>(null);
  const [mightFilter, setMightFilter] = useState<number | null>(null);
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<string | null>(null);

  const getBaseName = (cardName: string): string => {
    return cardName
      .replace(/\s*\(Overnumbered\)\s*/gi, '')
      .replace(/\s*\(Alternate Art\)\s*/gi, '')
      .replace(/\s*\(Signed\)\s*/gi, '')
      .replace(/\s*Overnumbered\s*/gi, '')
      .replace(/\s*Alternate Art\s*/gi, '')
        .replace(/\s*Signed\s*/gi, '')
      .trim();
  };
  
    const isAlternateArt = (cardName: string): boolean => /alternate art/i.test(cardName);

  const formatDate = (value?: string | null) => {
    if (!value) return 'Unknown date';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Unknown date';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
    if (!token) return;

    const loadDeck = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/decks/shared/${token}`);
        
        if (!res.ok) {
          setError('Deck not found or not shared');
          setLoading(false);
          return;
        }

        const data = await res.json();
        setDeck(data.deck);
        setDeckCards(data.cards || []);
      } catch (err) {
        console.error('Load shared deck error:', err);
        setError('Failed to load deck');
      } finally {
        setLoading(false);
      }
    };

    loadDeck();
  }, [token]);

  const allCards = useMemo(() => {
    return deckCards.map(dc => dc.card).filter(Boolean) as Card[];
  }, [deckCards]);

  const baseRarityMap = useMemo(() => {
    const map: Record<string, string> = {};
    deckCards.forEach(dc => {
      const card = dc.card;
      if (!card) return;
      const base = getBaseName(card.name);
      const isAlt = isAlternateArt(card.name);
      if (card.rarity) {
        if (!map[base] || !isAlt) {
          map[base] = card.rarity;
        }
      }
    });
    return map;
  }, [deckCards]);

  const resolveRarity = (card?: Card | null) => {
    if (!card) return '';
    const base = getBaseName(card.name);
    const baseRarity = baseRarityMap[base];
    const isAlt = isAlternateArt(card.name);
    if (isAlt) return baseRarity || card.rarity || '';
    return card.rarity || baseRarity || '';
  };

  const availableFilterValues = useMemo(() => {
    const energy = new Set<number>();
    const power = new Set<number>();
    const might = new Set<number>();
    const rarity = new Set<string>();
    const domain = new Set<string>();

    allCards.forEach(card => {
      if (card.energy_cost !== undefined && card.energy_cost !== null) energy.add(card.energy_cost);
      if (card.power_cost !== undefined && card.power_cost !== null) power.add(card.power_cost);
      if (card.might !== undefined && card.might !== null) might.add(card.might);
      const resolved = resolveRarity(card);
      if (resolved) rarity.add(resolved);
      if (card.domains) {
        card.domains.forEach(d => {
          d.split(/[,;]+/).map(s => s.trim()).filter(Boolean).forEach(domain_name => domain.add(domain_name));
        });
      }
    });

    return {
      energy: Array.from(energy).sort((a, b) => a - b),
      power: Array.from(power).sort((a, b) => a - b),
      might: Array.from(might).sort((a, b) => a - b),
      rarity: Array.from(rarity).sort((a, b) => {
        const diff = rarityRank(a) - rarityRank(b);
        return diff !== 0 ? diff : a.localeCompare(b);
      }),
      domain: Array.from(domain).sort()
    };
  }, [allCards, baseRarityMap]);

  const filteredDeckCards = useMemo(() => {
    return deckCards.filter(dc => {
      const card = dc.card;
      if (!card) return false;

      if (zoneFilter !== 'all' && dc.zone !== zoneFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!card.name.toLowerCase().includes(q) &&
            !card.category?.toLowerCase().includes(q) &&
            !card.abilities_text?.toLowerCase().includes(q)) {
          return false;
        }
      }

      if (energyFilter !== null && card.energy_cost !== energyFilter) return false;
      if (powerFilter !== null && card.power_cost !== powerFilter) return false;
      if (mightFilter !== null && card.might !== mightFilter) return false;
      const resolvedRarity = resolveRarity(card);
      if (rarityFilter && resolvedRarity !== rarityFilter) return false;
      if (domainFilter) {
        const cardDomains = card.domains?.flatMap(d => d.split(/[,;]+/).map(s => s.trim())).filter(Boolean) || [];
        if (!cardDomains.includes(domainFilter)) return false;
      }

      return true;
    });
  }, [deckCards, zoneFilter, searchQuery, energyFilter, powerFilter, mightFilter, rarityFilter, domainFilter]);

  const sortedDeckCards = useMemo(() => {
    const sorted = [...filteredDeckCards];
    sorted.sort((a, b) => {
      const ca = a.card;
      const cb = b.card;
      if (!ca || !cb) return 0;
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'quantity':
          return dir * ((a.quantity || 0) - (b.quantity || 0));
        case 'name':
          return dir * ca.name.localeCompare(cb.name);
        case 'category':
          return dir * (ca.category || '').localeCompare(cb.category || '');
        case 'domains':
          return dir * (ca.domains?.join(', ') || '').localeCompare(cb.domains?.join(', ') || '');
        case 'rarity':
          return dir * (rarityRank(resolveRarity(ca)) - rarityRank(resolveRarity(cb)));
        case 'energy':
          return dir * ((ca.energy_cost ?? 0) - (cb.energy_cost ?? 0));
        case 'power':
          return dir * ((ca.power_cost ?? 0) - (cb.power_cost ?? 0));
        default:
          return 0;
      }
    });
    return sorted;
  }, [filteredDeckCards, sortField, sortDir, baseRarityMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const groupedCards = useMemo(() => {
    const groups: Record<Zone, DeckCard[]> = {
      legend: [],
      champion: [],
      battlefield: [],
      rune: [],
      main: [],
      side: []
    };

    deckCards.forEach(dc => {
      if (dc.zone in groups) {
        groups[dc.zone as Zone].push(dc);
      }
    });

    return groups;
  }, [deckCards]);

  const renderDescription = (text?: string) => {
    if (!text) return 'No description available.';

    const lines = text.split(/<br\s*\/?\s*>/i);

    const renderWord = (word: string, index: number) => {
      const bare = word.replace(/[^A-Za-z0-9]/g, '');
      const isCaps = bare.length > 1 && /[A-Z]/.test(bare) && bare === bare.toUpperCase();
      if (!isCaps) return <React.Fragment key={index}>{word}</React.Fragment>;
      return (
        <span
          key={index}
          style={{
            padding: '0 6px',
            border: '1px solid rgba(212,175,55,0.6)',
            borderRadius: '6px',
            margin: '0 2px',
            display: 'inline-block'
          }}
        >
          {word}
        </span>
      );
    };

    return lines.map((line, lineIdx) => (
      <React.Fragment key={lineIdx}>
        {line
          .split(/(\s+)/)
          .filter((token) => token.length > 0)
          .map((word, wordIdx) => renderWord(word, wordIdx))}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', color: '#d4af37' }}>Loading shared deck...</div>
        </div>
      </Layout>
    );
  }

  if (error || !deck) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', color: '#f87171', marginBottom: '1rem' }}>{error || 'Deck not found'}</div>
          <a href="/" style={{ color: '#d4af37', textDecoration: 'underline' }}>Return to Home</a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Card Detail Modal */}
      {detailModalCard && (
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
          onClick={() => setDetailModalCard(null)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(15,12,9,0.98), rgba(26,20,16,0.98))',
              border: '2px solid rgba(212,175,55,0.5)',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '900px',
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'relative', background: 'rgba(15,12,9,0.95)', borderRadius: '10px', overflow: 'hidden' }}>
              {detailModalCard.image_url ? (
                <img
                  src={`/api/proxy-image?url=${encodeURIComponent(detailModalCard.image_url)}`}
                  alt={detailModalCard.name}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              ) : (
                <div style={{ height: '480px', background: 'linear-gradient(135deg, rgba(42,35,28,0.9), rgba(30,25,20,0.9))' }} />
              )}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                border: '4px solid rgba(42,35,28,0.95)',
                borderRadius: '10px',
                pointerEvents: 'none'
              }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontFamily: 'Cinzel, serif', color: '#d4af37' }}>
                {detailModalCard.name}
              </h2>
              <div style={{ fontSize: '0.95rem', color: '#a0a0a0', marginBottom: '16px' }}>
                {detailModalCard.category}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.95rem', lineHeight: 1.6, color: '#f0e6d2' }}>
                {renderDescription(detailModalCard.abilities_text)}
                {detailModalCard.flavor_text && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontStyle: 'italic', color: '#a0a0a0' }}>
                    {detailModalCard.flavor_text}
                  </div>
                )}
              </div>
              <button
                onClick={() => setDetailModalCard(null)}
                style={{
                  marginTop: '16px',
                  padding: '10px',
                  background: 'rgba(248,113,113,0.15)',
                  border: '1px solid #f87171',
                  borderRadius: '8px',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                Close
              </button>
            </div>
          </div>
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
        {/* Left Sidebar - Deck Info */}
        <div className="print-sidebar" style={{ 
          width: '260px', 
          background: 'rgba(26,20,16,0.95)', 
          borderRight: '2px solid rgba(212,175,55,0.3)',
          overflowY: 'auto',
          padding: '1.2rem'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ 
              display: 'inline-block',
              padding: '4px 8px',
              background: 'rgba(59,130,246,0.2)',
              border: '1px solid #3b82f6',
              borderRadius: '4px',
              color: '#60a5fa',
              fontSize: '11px',
              fontWeight: 'bold',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Shared Deck
            </div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '1.35rem', fontFamily: 'Cinzel, serif', color: '#d4af37' }}>
              {deck.name || 'Deck'}
            </h2>

            <div style={{ fontSize: '0.85rem', color: '#c9c9c9', marginBottom: '6px' }}>
              <span style={{ color: '#9ca3af' }}>Created by:</span>{' '}
              <span style={{ color: '#f0e6d2', fontWeight: 600 }}>{deck.owner_name || (deck.user_id ? `${deck.user_id.substring(0, 6)}...` : 'Unknown')}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#c9c9c9', marginBottom: '6px' }}>
              <span style={{ color: '#9ca3af' }}>Created on:</span>{' '}
              <span style={{ color: '#f0e6d2' }}>{formatDate(deck.created_at)}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#c9c9c9', marginBottom: '10px' }}>
              <span style={{ color: '#9ca3af' }}>Estimated value:</span>{' '}
              <span style={{ color: '#f0e6d2' }}>{deck.total_value ? `$${deck.total_value.toFixed(2)}` : 'N/A'}</span>
            </div>

            {deck.description && (
              <p style={{ margin: '10px 0 0 0', fontSize: '0.86rem', color: '#a0a0a0', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                {deck.description}
              </p>
            )}
          </div>
        </div>

        {/* Middle - Card Browser */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'rgba(15,12,9,0.98)' }}>
          {/* Search and Filters */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '2px solid rgba(212,175,55,0.3)' }} className="print-hide">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
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

              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter((e.target.value as ZoneFilter) || 'all')}
                style={{
                  width: '180px',
                  padding: '8px 10px',
                  background: 'rgba(26,20,16,0.6)',
                  border: '1px solid #3d352d',
                  borderRadius: '4px',
                  color: '#f0e6d2',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
              >
                <option value="all">All zones</option>
                <option value="legend">Legend</option>
                <option value="champion">Chosen Champion</option>
                <option value="battlefield">Battlefields</option>
                <option value="rune">Runes</option>
                <option value="main">Main Deck</option>
                <option value="side">Sideboard</option>
              </select>

              <select
                value={viewMode}
                onChange={(e) => setViewMode((e.target.value as ViewMode) || 'grid')}
                style={{
                  width: '140px',
                  padding: '8px 10px',
                  background: 'rgba(26,20,16,0.6)',
                  border: '1px solid #3d352d',
                  borderRadius: '4px',
                  color: '#f0e6d2',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
              >
                <option value="grid">Grid view</option>
                <option value="list">List view</option>
              </select>

              <button
                type="button"
                onClick={handlePrint}
                className="print-hide"
                style={{
                  padding: '8px 12px',
                  background: 'rgba(212,175,55,0.15)',
                  border: '1px solid rgba(212,175,55,0.6)',
                  borderRadius: '6px',
                  color: '#f0e6d2',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  minWidth: '110px'
                }}
              >
                Print PDF
              </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
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
                {availableFilterValues.energy.map(e => (
                  <option key={e} value={e}>{e}</option>
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
                {availableFilterValues.power.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                value={mightFilter ?? ''}
                onChange={(e) => setMightFilter(e.target.value ? Number(e.target.value) : null)}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(26,20,16,0.6)',
                  border: '1px solid #3d352d',
                  borderRadius: '4px',
                  color: '#f0e6d2',
                  fontSize: '13px'
                }}
              >
                <option value="">Might: All</option>
                {availableFilterValues.might.map(m => (
                  <option key={m} value={m}>{m}</option>
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
                {availableFilterValues.rarity.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <select
                value={domainFilter ?? ''}
                onChange={(e) => setDomainFilter(e.target.value || null)}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(26,20,16,0.6)',
                  border: '1px solid #3d352d',
                  borderRadius: '4px',
                  color: '#f0e6d2',
                  fontSize: '13px'
                }}
              >
                <option value="">Domain: All</option>
                {availableFilterValues.domain.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {viewMode === 'list' && (
              <div className="list-header" style={{
                marginTop: '10px',
                display: 'grid',
                gridTemplateColumns: '60px 1fr 110px 140px 160px 90px 80px 80px',
                alignItems: 'center',
                padding: '6px 10px',
                columnGap: 0,
                background: 'rgba(26,20,16,0.98)',
                border: '1px solid rgba(212,175,55,0.4)',
                borderRadius: '8px',
                color: '#e5e5e5',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.4px'
              }}>
                <span style={{ cursor: 'pointer', padding: '0 8px', textAlign: 'center' }} onClick={() => handleSort('quantity')}>Qty</span>
                <span style={{ cursor: 'pointer', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.25)' }} onClick={() => handleSort('name')}>Name</span>
                <span style={{ padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.25)', color: '#c8c1b0' }}>Collector #</span>
                <span style={{ cursor: 'pointer', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.25)' }} onClick={() => handleSort('category')}>Category</span>
                <span style={{ cursor: 'pointer', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.25)' }} onClick={() => handleSort('domains')}>Domains</span>
                <span style={{ cursor: 'pointer', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.25)' }} onClick={() => handleSort('rarity')}>Rarity</span>
                <span style={{ cursor: 'pointer', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.25)' }} onClick={() => handleSort('energy')}>Energy</span>
                <span style={{ cursor: 'pointer', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.25)' }} onClick={() => handleSort('power')}>Power</span>
              </div>
            )}
          </div>

          {/* Card view with zone separators, supporting grid and list modes */}
          <div className="print-main" style={{ flex: 1, overflowY: 'auto', padding: '1rem', position: 'relative' }}>
            {(['legend', 'champion', 'battlefield', 'rune', 'main', 'side'] as Zone[])
              .filter(zone => zoneFilter === 'all' || zoneFilter === zone)
              .map((zone, zoneIdx) => {
                const config = ZONE_CONFIGS[zone];
                const cardsInZone = sortedDeckCards.filter(dc => dc.zone === zone && dc.card);

                return (
                  <div key={zone} style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '1px 0 3px',
                      marginBottom: '5px',
                      borderBottom: '1px dashed rgba(140,120,80,0.14)',
                      background: 'linear-gradient(90deg, rgba(90,75,55,0.12), rgba(60,50,35,0.02))',
                      textAlign: 'center'
                    }}>
                      <span style={{ fontWeight: 700, color: '#d8d0bd', fontSize: '11px', letterSpacing: '0.3px' }}>{config.name}</span>
                      <span style={{ color: '#9a8f7a', fontSize: '10px' }}>({cardsInZone.reduce((sum, dc) => sum + dc.quantity, 0)})</span>
                    </div>

                    {cardsInZone.length === 0 ? (
                      <div style={{ color: '#7a7a7a', fontSize: '12px', padding: '6px 2px' }}>No cards in this zone.</div>
                    ) : viewMode === 'grid' ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '1rem'
                      }}>
                        {cardsInZone.map(({ card, id, quantity }) => (
                          <div
                            key={id}
                            style={{
                              background: 'rgba(42,35,28,0.95)',
                              border: '2px solid rgba(212,175,55,0.3)',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              flexDirection: 'column',
                              position: 'relative'
                            }}
                            onClick={() => card && setDetailModalCard(card)}
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
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              background: 'rgba(15,12,9,0.8)',
                              border: '1px solid rgba(212,175,55,0.6)',
                              borderRadius: '6px',
                              padding: '2px 6px',
                              color: '#f0e6d2',
                              fontWeight: 'bold',
                              fontSize: '12px'
                            }}>
                              x{quantity}
                            </div>

                            <div style={{ 
                              position: 'relative',
                              width: '100%',
                              background: 'rgba(15,12,9,0.95)'
                            }}>
                              {card?.image_url ? (
                                <>
                                  <img 
                                    src={`/api/proxy-image?url=${encodeURIComponent(card.image_url)}`}
                                    alt={card.name}
                                    style={{
                                      width: '100%',
                                      height: 'auto',
                                      display: 'block'
                                    }}
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    border: '3px solid rgba(42,35,28,0.95)',
                                    pointerEvents: 'none'
                                  }} />
                                </>
                              ) : (
                                <div style={{
                                  height: '200px',
                                  background: 'linear-gradient(135deg, rgba(42,35,28,0.9), rgba(30,25,20,0.9))'
                                }} />
                              )}
                            </div>
                            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '3px', color: '#f0e6d2' }}>
                                {card?.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#a0a0a0' }}>
                                {card?.category}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {cardsInZone.map(({ card, id, quantity }) => (
                          <div
                            key={id}
                            className="list-row"
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '60px 1fr 110px 140px 160px 90px 80px 80px',
                              alignItems: 'center',
                              padding: '3px 10px',
                              columnGap: 0,
                              background: 'rgba(42,35,28,0.62)',
                              border: '1px solid rgba(212,175,55,0.18)',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              transition: 'border-color 0.15s, background 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)';
                              e.currentTarget.style.background = 'rgba(42,35,28,0.8)';
                              if (card) setHoverPreviewCard(card);
                            }}
                            onMouseMove={(e) => setHoverPos({ x: e.clientX + 12, y: e.clientY + 12 })}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.18)';
                              e.currentTarget.style.background = 'rgba(42,35,28,0.62)';
                              setHoverPreviewCard(null);
                              setHoverPos(null);
                            }}
                            onClick={() => card && setDetailModalCard(card)}
                          >
                            <span style={{
                              fontWeight: 700,
                              fontSize: '12px',
                              color: '#d7d7d7',
                              textAlign: 'center',
                              padding: '0 8px'
                            }}>x{quantity}</span>

                            <span style={{
                              fontWeight: 700,
                              fontSize: '12px',
                              color: '#f8f4ea',
                              padding: '0 8px',
                              borderLeft: '1px solid rgba(212,175,55,0.18)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>{card?.name}</span>

                            <span style={{ fontSize: '11px', color: '#b0b0b0', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.18)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card?.collector_number || ''}</span>
                            <span style={{ fontSize: '12px', color: '#d7d7d7', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.18)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card?.category || ''}</span>
                            <span style={{ fontSize: '12px', color: '#d7d7d7', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.18)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card?.domains?.join(', ') || ''}</span>
                            <span style={{ fontSize: '12px', color: '#d7d7d7', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.18)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resolveRarity(card) || ''}</span>
                            <span style={{ fontSize: '12px', color: '#d7d7d7', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.18)', textAlign: 'center' }}>{card?.energy_cost ?? ''}</span>
                            <span style={{ fontSize: '12px', color: '#d7d7d7', padding: '0 8px', borderLeft: '1px solid rgba(212,175,55,0.18)', textAlign: 'center' }}>{card?.power_cost ?? ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Hover preview for list view */}
            {viewMode === 'list' && hoverPreviewCard && safePreviewPos && (
              <div style={{
                position: 'fixed',
                top: safePreviewPos.y,
                left: safePreviewPos.x,
                zIndex: 9999,
                pointerEvents: 'none',
                background: 'rgba(15,12,9,0.95)',
                border: '2px solid rgba(212,175,55,0.5)',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
              }}>
                {hoverPreviewCard.image_url ? (
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(hoverPreviewCard.image_url)}`}
                    alt={hoverPreviewCard.name}
                    style={{ display: 'block', width: '240px', height: 'auto' }}
                  />
                ) : (
                  <div style={{ width: '240px', height: '340px', background: 'linear-gradient(135deg, rgba(42,35,28,0.9), rgba(30,25,20,0.9))' }} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .deck-builder {
            position: static !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          .print-hide {
            display: none !important;
          }
          .print-sidebar {
            display: none !important;
          }
          .print-main {
            padding: 6px !important;
          }
          .list-header {
            padding: 4px 6px !important;
            font-size: 9px !important;
            column-gap: 0 !important;
          }
          .list-header span {
            padding: 0 4px !important;
            font-size: 9px !important;
            border-left: 1px solid rgba(0,0,0,0.12) !important;
          }
          .list-header span:first-child {
            border-left: none !important;
            text-align: center !important;
          }
          .list-row {
            padding: 2px 6px !important;
            font-size: 9px !important;
            column-gap: 0 !important;
          }
          .list-row span {
            padding: 0 4px !important;
            font-size: 9px !important;
          }
          .list-row span:first-child {
            text-align: center !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * {
            box-shadow: none !important;
          }
        }
      `}</style>
    </Layout>
  );
}
