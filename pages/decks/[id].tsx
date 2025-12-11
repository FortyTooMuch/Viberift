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

const ImageWithSkeleton: React.FC<{ src?: string; alt: string; height?: number; borderColor?: string }> = ({ src, alt, height = 220, borderColor = 'rgba(42,35,28,0.95)' }) => {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div style={{ height, width: '100%', background: 'linear-gradient(135deg, rgba(42,35,28,0.9), rgba(30,25,20,0.9))', border: `3px solid ${borderColor}` }} />
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', background: 'rgba(15,12,9,0.95)' }}>
      {!loaded && (
        <div
          style={{
            height,
            width: '100%',
            background: 'linear-gradient(90deg, rgba(40,35,30,0.5), rgba(55,48,41,0.8), rgba(40,35,30,0.5))',
            backgroundSize: '200% 100%',
            animation: 'card-skeleton 1.2s ease-in-out infinite'
          }}
        />
      )}
      <img
        src={`/api/proxy-image?url=${encodeURIComponent(src)}`}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.25s ease'
        }}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: `3px solid ${borderColor}`, pointerEvents: 'none' }} />
    </div>
  );
};

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
  const [domainFilter, setDomainFilter] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [variantModalCard, setVariantModalCard] = useState<Card | null>(null);
  const [variantModalVariants, setVariantModalVariants] = useState<Card[]>([]);
  const [detailModalCard, setDetailModalCard] = useState<Card | null>(null);
  const [preferredVariantMap, setPreferredVariantMap] = useState<Record<string, string>>({});
  const [rememberVariantSelection, setRememberVariantSelection] = useState(true);
  const [variantModalMode, setVariantModalMode] = useState<'add' | 'choose'>('add');
  const [selectedVariantCardMap, setSelectedVariantCardMap] = useState<Record<string, Card>>({});
  const [hoverPreviewCard, setHoverPreviewCard] = useState<Card | null>(null);
  const [hoverPreviewPosition, setHoverPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const hoverTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(new Set());
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [leftSidebarMinimized, setLeftSidebarMinimized] = useState(false);
  const [rightSidebarMinimized, setRightSidebarMinimized] = useState(false);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 2000);
  };

  const normalizeDomains = (domains?: string[]) => {
    if (!domains) return [] as string[];
    return domains
      .flatMap((d) => d.split(/[,;]+/))
      .map((d) => d.trim())
      .filter(Boolean);
  };

  const getBaseName = (cardName: string): string => {
    // Remove variant suffixes like (Overnumbered), (Alternate Art), (Signed), etc.
    return cardName
      .replace(/\s*\(Overnumbered\)\s*/gi, '')
      .replace(/\s*\(Alternate Art\)\s*/gi, '')
      .replace(/\s*\(Signed\)\s*/gi, '')
      .replace(/\s*Overnumbered\s*/gi, '')
      .replace(/\s*Alternate Art\s*/gi, '')
      .trim();
  };

  const getCardVariants = (card: Card): Card[] => {
    const baseName = getBaseName(card.name);
    return allCards.filter(c => getBaseName(c.name) === baseName && c.category === card.category);
  };

  const getDisplayCard = (card: Card): Card => {
    const baseName = getBaseName(card.name);
    const selected = selectedVariantCardMap[baseName];
    return selected || card;
  };

  const getCardById = (cardId: string): Card | undefined => {
    return allCards.find((c) => c.card_id === cardId);
  };

  const getDeckCardBaseName = (deckCard: DeckCard): string => {
    const resolved = deckCard.card || getCardById(deckCard.card_id);
    return resolved ? getBaseName(resolved.name) : deckCard.card_id;
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

  // Load owned cards across all user collections
  useEffect(() => {
    async function loadOwned() {
      if (!session?.access_token) return;
      setLoadingOwned(true);
      try {
        const collectionsRes = await fetch('/api/collections', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!collectionsRes.ok) { setLoadingOwned(false); return; }
        const collectionsPayload = await collectionsRes.json();
        const collections: any[] = collectionsPayload.collections || [];
        const ownedSet = new Set<string>();
        // Fetch cards for each collection in parallel (limit to avoid too many requests if needed)
        await Promise.all(collections.map(async (c) => {
          try {
            const cardsRes = await fetch(`/api/collections/${c.id}/cards`, { headers: { Authorization: `Bearer ${session.access_token}` } });
            if (!cardsRes.ok) return;
            const cardsPayload = await cardsRes.json();
            const items = cardsPayload.cards || cardsPayload.items || [];
            items.forEach((it: any) => {
              if (it.card_id) ownedSet.add(it.card_id);
              // some payloads might nest card object
              if (it.card?.card_id) ownedSet.add(it.card.card_id);
            });
          } catch {}
        }));
        setOwnedCardIds(ownedSet);
      } catch {
        setOwnedCardIds(new Set());
      } finally {
        setLoadingOwned(false);
      }
    }
    loadOwned();
  }, [session]);

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
    return normalizeDomains(legendCard?.domains);
  }, [legendCard]);

  const legendBaseName = useMemo(() => {
    return getBaseName(legendCard?.name || '').toLowerCase();
  }, [legendCard]);

  const legendRootName = useMemo(() => {
    if (!legendBaseName) return '';
    const parts = legendBaseName.split(/[^a-z0-9]+/i).filter(Boolean);
    return (parts[0] || '').toLowerCase();
  }, [legendBaseName]);

  const legendChampionTag = useMemo(() => {
    if (!legendCard?.tags) return null;
    return legendCard.tags.find((tag: string) => tag.toLowerCase() !== 'legend');
  }, [legendCard]);

  const championCard = useMemo(() => {
    if (!deck?.champion_card_id) return null;
    return deckCards.find(dc => dc.card_id === deck.champion_card_id)?.card;
  }, [deck, deckCards]);

  const availableFilterValues = useMemo(() => {
    const energyValues = new Set<number>();
    const powerValues = new Set<number>();
    const mightValues = new Set<number>();
    const rarityValues = new Set<string>();
    const domainValues = new Set<string>();

    allCards.forEach(card => {
      if (card.energy_cost !== undefined && card.energy_cost !== null) energyValues.add(card.energy_cost);
      if (card.power_cost !== undefined && card.power_cost !== null) powerValues.add(card.power_cost);
      if (card.might !== undefined && card.might !== null) mightValues.add(card.might);
      if (card.rarity) rarityValues.add(card.rarity);
      if (card.domains) {
        normalizeDomains(card.domains).forEach(d => domainValues.add(d));
      }
    });

    return {
      energy: Array.from(energyValues).sort((a, b) => a - b),
      power: Array.from(powerValues).sort((a, b) => a - b),
      might: Array.from(mightValues).sort((a, b) => a - b),
      rarity: Array.from(rarityValues).sort(),
      domain: Array.from(domainValues).sort()
    };
  }, [allCards]);

  const getZoneCards = (zone: Zone) => {
    return deckCards.filter(dc => dc.zone === zone);
  };

  const getIllegalReason = (deckCard: DeckCard): string | null => {
    const card = deckCard.card;
    if (!card) return null;
    const config = ZONE_CONFIGS[deckCard.zone as Zone];
    const cardDomains = normalizeDomains(card.domains);

    // Zone/category checks
    if (deckCard.zone === 'legend' && card.category !== 'Legend') return 'Must be a Legend';
    if (deckCard.zone === 'champion') {
      if (card.category !== 'Champion Unit') return 'Must be a Champion Unit';
      if (legendChampionTag && !card.tags?.includes(legendChampionTag)) return 'Does not match Legend tag';
      if (legendRootName) {
        const champBase = getBaseName(card.name).toLowerCase();
        if (!champBase.includes(legendRootName)) return 'Does not match Legend name';
      }
      if (legendDomains.length > 0 && cardDomains.length > 0 && !cardDomains.every((d) => legendDomains.includes(d))) {
        return `Domains must match Legend (has: ${cardDomains.join(', ')}; allowed: ${legendDomains.join(', ')})`;
      }
    }
    if (deckCard.zone === 'battlefield' && card.category !== 'Battlefield') return 'Must be a Battlefield';
    if (deckCard.zone === 'rune') {
      if (card.category !== 'Rune') return 'Must be a Rune';
      if (legendDomains.length > 0 && cardDomains.length > 0 && !cardDomains.every((d) => legendDomains.includes(d))) {
        return `Domains must match Legend (has: ${cardDomains.join(', ')}; allowed: ${legendDomains.join(', ')})`;
      }
    }
    if (deckCard.zone === 'main' || deckCard.zone === 'side') {
      if (['Legend', 'Rune', 'Battlefield'].includes(card.category)) return 'Wrong type for this zone';
      if (legendDomains.length > 0 && cardDomains.length > 0 && !cardDomains.every((d) => legendDomains.includes(d))) {
        return `Domains must match Legend (has: ${cardDomains.join(', ')}; allowed: ${legendDomains.join(', ')})`;
      }
    }

    // Quantity checks
    const zoneCount = getZoneCount(deckCard.zone as Zone);
    if (config && zoneCount > config.max) {
      return `Too many ${config.name}`;
    }

    if (deckCard.zone !== 'legend' && deckCard.zone !== 'champion') {
      const baseName = getDeckCardBaseName(deckCard);
      const totalCopies = deckCards
        .filter((dc) => getDeckCardBaseName(dc) === baseName)
        .reduce((sum, dc) => sum + dc.quantity, 0);
      if (deckCard.zone === 'rune' && totalCopies > ZONE_CONFIGS.rune.max) {
        return `Over ${ZONE_CONFIGS.rune.max} copies`;
      }
      if (deckCard.zone !== 'rune' && totalCopies > 3) return 'Over 3 copies';
    }

    return null;
  };

  const getChecklistIssue = (key: keyof ValidationChecks): string | null => {
    if (key === 'hasLegend') {
      if (!legendCard) return 'Add a Legend in the Legend zone.';
      return null;
    }
    if (key === 'hasChampion') {
      const champ = deckCards.find((dc) => dc.zone === 'champion');
      if (!champ) return 'Add a Champion Unit in the Champion zone.';
      return null;
    }
    if (key === 'championMatchesLegend') {
      const champ = deckCards.find((dc) => dc.zone === 'champion');
      if (!champ) return 'Add a Champion Unit in the Champion zone.';
      return getIllegalReason(champ);
    }
    if (key === 'runesComplete') {
      const need = ZONE_CONFIGS.rune.max;
      const count = getZoneCount('rune');
      if (count < need) return `Add ${need - count} more runes (need ${need} total).`;
      if (count > need) return `Reduce runes to ${need} max.`;
      return null;
    }
    if (key === 'runesDomainMatch') {
      const firstBad = getZoneCards('rune').find((dc) => getIllegalReason(dc));
      return firstBad ? getIllegalReason(firstBad) : null;
    }
    if (key === 'battlefieldsComplete') {
      const need = ZONE_CONFIGS.battlefield.max;
      const count = getZoneCount('battlefield');
      if (count < need) return `Add ${need - count} more battlefields (need ${need} total).`;
      if (count > need) return `Reduce battlefields to ${need} max.`;
      return null;
    }
    if (key === 'mainBoardComplete') {
      const need = ZONE_CONFIGS.main.max;
      const count = getZoneCount('main');
      if (count < need) return `Add ${need - count} more cards to your main deck (need ${need} total).`;
      if (count > need) return `Reduce main deck to ${need} max.`;
      return null;
    }
    if (key === 'cardLimitsValid') {
      const firstBad = deckCards.find((dc) => {
        const reason = getIllegalReason(dc);
        return reason && reason.includes('Over');
      });
      return firstBad ? getIllegalReason(firstBad) : null;
    }
    return null;
  };

  const getZoneCount = (zone: Zone) => {
    return getZoneCards(zone).reduce((sum, dc) => sum + dc.quantity, 0);
  };

  const filteredCards = useMemo(() => {
    let filtered = allCards.filter(card => {
      const cardDomains = normalizeDomains(card.domains);

      // Search query
      if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Owned filter
      if (showOwnedOnly) {
        if (!ownedCardIds.has(card.card_id)) return false;
      }

      // Zone-specific filters
      switch (selectedZone) {
        case 'legend':
          if (card.category !== 'Legend') return false;
          break;
        
        case 'champion':
          if (card.category !== 'Champion Unit') return false;
          if (legendChampionTag && !card.tags?.includes(legendChampionTag)) return false;
          if (legendRootName) {
            const champBase = getBaseName(card.name).toLowerCase();
            if (!champBase.includes(legendRootName)) return false;
          }
          if (legendDomains.length > 0) {
            if (!cardDomains.every(d => legendDomains.includes(d))) return false;
          }
          break;
        
        case 'battlefield':
          if (card.category !== 'Battlefield') return false;
          break;
        
        case 'rune':
          if (card.category !== 'Rune') return false;
          if (legendDomains.length > 0) {
            if (!cardDomains.every(d => legendDomains.includes(d))) return false;
          }
          break;
        
        case 'main':
        case 'side':
          // Exclude legends, runes, battlefields
          if (['Legend', 'Rune', 'Battlefield'].includes(card.category)) return false;
          // Filter by domain if legend is selected
          if (legendDomains.length > 0) {
            if (!cardDomains.every(d => legendDomains.includes(d))) return false;
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
      
      // Domain filter
      if (domainFilter && !cardDomains.includes(domainFilter)) return false;

      return true;
    });

    // Group by base name to show only one card per variant group
    const seen = new Set<string>();
    const uniqueFiltered = filtered.filter(card => {
      const baseName = getBaseName(card.name);
      const key = `${baseName}-${card.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return uniqueFiltered;
  }, [allCards, selectedZone, searchQuery, showOwnedOnly, legendDomains, legendChampionTag, energyFilter, powerFilter, mightFilter, rarityFilter, domainFilter, deckCards]);

  const addCard = async (card: Card) => {
    if (!session?.access_token || !id) return;

    // Check if there are multiple variants
    const variants = getCardVariants(card);
    if (variants.length > 1) {
      const baseName = getBaseName(card.name);
      const selectedVariant = selectedVariantCardMap[baseName];
      if (selectedVariant) {
        await addCardVariant(selectedVariant);
        return;
      }

      const preferredId = preferredVariantMap[baseName];
      const preferredVariant = preferredId ? variants.find(v => v.card_id === preferredId) : null;

      if (preferredVariant) {
        setSelectedVariantCardMap((prev) => ({ ...prev, [baseName]: preferredVariant }));
        await addCardVariant(preferredVariant);
        return;
      }

      // No preference yet: just add the current card variant without forcing a selection
      setSelectedVariantCardMap((prev) => ({ ...prev, [baseName]: card }));
      await addCardVariant(card);
      return;
    }

    // Proceed with adding single variant
    await addCardVariant(card);
  };

  const addCardVariant = async (card: Card) => {
    if (!session?.access_token || !id) return;

    const zone: Zone = selectedZone;
    const baseName = getBaseName(card.name);

    setSelectedVariantCardMap((prev) => ({ ...prev, [baseName]: card }));
    
    // Check if card already exists in deck (any zone for copy limit)
    const existing = deckCards.find(dc => dc.card_id === card.card_id && dc.zone === zone);
    const totalCopiesByBase = deckCards
      .filter((dc) => getDeckCardBaseName(dc) === baseName)
      .reduce((sum, dc) => sum + dc.quantity, 0);

    // Enforce copy limits (runes can go higher up to zone max)
    if (zone !== 'legend' && zone !== 'champion') {
      if (zone === 'rune') {
        const maxRunes = ZONE_CONFIGS.rune.max;
        if (totalCopiesByBase >= maxRunes) {
          showNotification(`You can only have ${maxRunes} copies of "${card.name}" in your runes.`);
          return;
        }
      } else if (totalCopiesByBase >= 3) {
        showNotification(`You can only have 3 copies of "${card.name}" in your deck.`);
        return;
      }
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

  const updateDeckCardQuantity = async (deckCard: DeckCard, quantity: number) => {
    if (!session?.access_token || !id) return;

    const baseName = getDeckCardBaseName(deckCard);
    const totalOther = deckCards
      .filter((dc) => dc.id !== deckCard.id && getDeckCardBaseName(dc) === baseName)
      .reduce((sum, dc) => sum + dc.quantity, 0);

    if (quantity <= 0) {
      await removeCard(deckCard);
      return;
    }

    if (deckCard.zone === 'legend' || deckCard.zone === 'champion') {
      if (quantity > 1) {
        showNotification(`You can only have one ${deckCard.zone}.`);
        return;
      }
    } else if (deckCard.zone === 'rune') {
      const maxRunes = ZONE_CONFIGS.rune.max;
      if (totalOther + quantity > maxRunes) {
        showNotification(`You can only have up to ${maxRunes} copies of a rune card.`);
        quantity = Math.max(0, maxRunes - totalOther);
      }
    } else {
      if (totalOther + quantity > 3) {
        showNotification('You can only have up to 3 copies of a card.');
        quantity = Math.max(0, 3 - totalOther);
      }
    }

    try {
      // Optimistic update
      setDeckCards((prev) => prev.map((dc) => (dc.id === deckCard.id ? { ...dc, quantity } : dc)));

      const res = await fetch(`/api/decks/${id}/cards`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          card_id: deckCard.card_id,
          zone: deckCard.zone,
          quantity
        })
      });

      if (!res.ok) {
        await loadDeck();
        return;
      }

      const validationRes = await fetch(`/api/decks/${id}/validate`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (validationRes.ok) {
        setValidation(await validationRes.json());
      }
    } catch (error) {
      console.error('Update quantity error:', error);
      await loadDeck();
    }
  };

  const generateShareLink = async () => {
    if (!session?.access_token || !id) return;
    setGeneratingLink(true);
    
    try {
      const res = await fetch(`/api/decks/${id}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        const link = `${window.location.origin}/shared/${data.token}`;
        setShareLink(link);
        showNotification('Share link generated!');
      } else {
        showNotification('Failed to generate share link');
      }
    } catch (error) {
      console.error('Generate share link error:', error);
      showNotification('Error generating share link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const exportToCSV = () => {
    const rows = [['Zone', 'Card Name', 'Quantity', 'Category']];
    
    deckCards.forEach(dc => {
      const card = dc.card || getCardById(dc.card_id);
      if (card) {
        rows.push([
          dc.zone,
          card.name,
          dc.quantity.toString(),
          card.category || ''
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
    link.download = `${deck?.name || 'deck'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('CSV exported!');
  };

  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      showNotification('Link copied to clipboard!');
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#f0e6d2', fontFamily: 'Cinzel, serif', fontSize: '1.4rem' }}>
                  {detailModalCard.name}
                </h2>
                <div style={{ color: '#c5ba9b', fontSize: '0.9rem', marginTop: '4px' }}>
                  {detailModalCard.category}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', color: '#d4af37', fontSize: '0.9rem' }}>
                {detailModalCard.domains?.map((d) => (
                  <span key={d} style={{ padding: '4px 8px', border: '1px solid rgba(212,175,55,0.5)', borderRadius: '6px' }}>{d}</span>
                ))}
                {detailModalCard.rarity && (
                  <span style={{ padding: '4px 8px', border: '1px solid rgba(212,175,55,0.5)', borderRadius: '6px' }}>{detailModalCard.rarity}</span>
                )}
              </div>
              <div style={{ color: '#f0e6d2', fontSize: '0.95rem', lineHeight: 1.4 }}>
                {renderDescription(detailModalCard.abilities_text || detailModalCard.flavor_text)}
              </div>
              {![
                'Legend',
                'Battlefield',
                'Rune'
              ].includes(detailModalCard.category) && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', color: '#a0a0a0', fontSize: '0.9rem' }}>
                  <span>Energy: {detailModalCard.energy_cost ?? '—'}</span>
                  <span>Power: {detailModalCard.power_cost ?? '—'}</span>
                  {![
                    'Gear',
                    'Spell'
                  ].includes(detailModalCard.category) && (
                    <span>Might: {detailModalCard.might ?? '—'}</span>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={() => {
                    addCard(detailModalCard);
                    setDetailModalCard(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'rgba(74,222,128,0.2)',
                    border: '1px solid #4ade80',
                    borderRadius: '8px',
                    color: '#4ade80',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  Add to Deck
                </button>
                <button
                  onClick={() => setDetailModalCard(null)}
                  style={{
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
        </div>
      )}

      {/* Share Modal */}
      {shareModalOpen && (
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
          onClick={() => setShareModalOpen(false)}
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
              Share Deck
            </h2>

            {/* Export CSV */}
            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.3)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#f0e6d2' }}>Export as CSV</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#a0a0a0' }}>
                Download your deck list as a CSV file
              </p>
              <button
                onClick={() => {
                  exportToCSV();
                  setShareModalOpen(false);
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
              onClick={() => setShareModalOpen(false)}
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
          width: leftSidebarMinimized ? '32px' : '220px', 
          background: leftSidebarMinimized ? 'transparent' : 'rgba(26,20,16,0.95)', 
          borderRight: leftSidebarMinimized ? 'none' : '2px solid rgba(212,175,55,0.3)',
          overflowY: leftSidebarMinimized ? 'visible' : 'auto',
          overflowX: 'visible',
          padding: leftSidebarMinimized ? '0' : '1rem',
          transition: 'all 0.3s ease',
          position: 'relative',
          flexShrink: 0
        }}>
          {/* Toggle Button */}
          <button
            onClick={() => setLeftSidebarMinimized(!leftSidebarMinimized)}
            style={{
              position: 'absolute',
              left: '0',
              top: '12px',
              zIndex: 999,
              width: leftSidebarMinimized ? '32px' : '100%',
              height: leftSidebarMinimized ? '48px' : 'auto',
              padding: leftSidebarMinimized ? '0' : '8px',
              background: leftSidebarMinimized ? 'rgba(15,12,9,0.7)' : 'transparent',
              border: 'none',
              borderRight: leftSidebarMinimized ? '2px solid rgba(212,175,55,0.4)' : 'none',
              borderRadius: '0',
              color: leftSidebarMinimized ? '#d4af37' : '#7a6f5d',
              cursor: 'pointer',
              marginBottom: leftSidebarMinimized ? 0 : '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: leftSidebarMinimized ? '16px' : '11px',
              transition: 'all 0.2s',
              boxShadow: leftSidebarMinimized ? '2px 0 8px rgba(0,0,0,0.3)' : 'none',
              backdropFilter: leftSidebarMinimized ? 'blur(4px)' : 'none',
              fontWeight: leftSidebarMinimized ? 'normal' : '500',
              textTransform: leftSidebarMinimized ? 'none' : 'uppercase',
              letterSpacing: leftSidebarMinimized ? '0' : '0.5px'
            }}
            onMouseEnter={(e) => {
              if (leftSidebarMinimized) {
                e.currentTarget.style.background = 'rgba(15,12,9,0.9)';
                e.currentTarget.style.borderRightColor = 'rgba(212,175,55,0.6)';
              } else {
                e.currentTarget.style.color = '#d4af37';
              }
            }}
            onMouseLeave={(e) => {
              if (leftSidebarMinimized) {
                e.currentTarget.style.background = 'rgba(15,12,9,0.7)';
                e.currentTarget.style.borderRightColor = 'rgba(212,175,55,0.4)';
              } else {
                e.currentTarget.style.color = '#7a6f5d';
              }
            }}
            title={leftSidebarMinimized ? 'Show deck info' : 'Hide deck info'}
          >
            {leftSidebarMinimized ? '›' : 'hide ‹'}
          </button>
          
          {!leftSidebarMinimized && (
            <>
          <div style={{ marginBottom: '1.5rem', marginTop: '60px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontFamily: 'Cinzel, serif', color: '#d4af37' }}>
              {deck?.name || 'Deck'}
            </h2>
            {deck?.description && (
              <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#a0a0a0', lineHeight: '1.4' }}>
                {deck.description}
              </p>
            )}
            <button
              onClick={() => setShareModalOpen(true)}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: '1px solid rgba(212,175,55,0.3)',
                borderRadius: '4px',
                color: '#b8a895',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(212,175,55,0.05)';
                e.currentTarget.style.borderColor = 'rgba(212,175,55,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)';
              }}
            >
              <Share2 size={14} />
              Share Deck
            </button>
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
                .filter(([key, value]) => !value)
                .map(([key, value]) => {
                const labelMap: Record<string, string> = {
                  hasLegend: 'Legend',
                  hasChampion: 'Champion',
                  championMatchesLegend: 'Champion matches Legend',
                  runesComplete: 'Runes',
                  runesDomainMatch: 'Runes match Legend domains',
                  battlefieldsComplete: 'Battlefields',
                  mainBoardComplete: 'Main',
                  cardLimitsValid: 'Copy limits'
                };
                const friendly = labelMap[key] ?? key.replace(/([A-Z])/g, ' $1').trim();
                const issue = getChecklistIssue(key as keyof ValidationChecks);
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
                    background: 'rgba(248,113,113,0.1)',
                    borderRadius: '4px',
                    color: '#f87171',
                    cursor: issue ? 'pointer' : 'default'
                  }}
                  onClick={() => {
                    if (!issue) return;
                    showNotification(issue);
                  }}
                >
                  <X size={14} />
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
            </>
          )}
        </div>

        {/* Middle - Card Browser */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'rgba(15,12,9,0.98)' }}>
          {/* Search and Filters */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '2px solid rgba(212,175,55,0.3)', position: 'sticky', top: 0, background: 'rgba(15,12,9,0.98)', zIndex: 1001 }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 12px',
                    background: 'rgba(26,20,16,0.6)',
                    border: '1px solid #3d352d',
                    borderRadius: '4px',
                    color: '#f0e6d2',
                    fontSize: '14px'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      padding: '4px',
                      background: 'transparent',
                      border: 'none',
                      color: '#a0a0a0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#f87171';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#a0a0a0';
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
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
                {availableFilterValues.energy.map(n => (
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
                {availableFilterValues.power.map(n => (
                  <option key={n} value={n}>{n}</option>
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
                {availableFilterValues.might.map(n => (
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
          </div>

          {/* Card Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gap: '1rem' 
            }}>
              {filteredCards.map((card) => {
                const displayCard = getDisplayCard(card);
                const baseName = getBaseName(card.name);
                const matchingDeckCards = deckCards.filter((dc) => {
                  if (dc.zone !== selectedZone) return false;
                  const resolvedCard = dc.card || getCardById(dc.card_id);
                  const resolvedName = resolvedCard ? getBaseName(resolvedCard.name) : '';
                  return resolvedName === baseName;
                });
                const quantity = matchingDeckCards.reduce((sum, dc) => sum + dc.quantity, 0);
                const inDeck = matchingDeckCards[0];
                const variants = getCardVariants(card);
                const hasMultipleVariants = variants.length > 1;

                return (
                  <div
                    key={card.card_id}
                    style={{background: 'rgba(42,35,28,0.95)',
                      border: '2px solid rgba(212,175,55,0.3)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    onClick={() => setDetailModalCard(displayCard)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)';
                    }}
                  >
                    <div style={{ position: 'relative', width: '100%' }}>
                      <ImageWithSkeleton
                        src={displayCard.image_url}
                        alt={displayCard.name}
                        height={240}
                        borderColor="rgba(42,35,28,0.95)"
                      />
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
                      {hasMultipleVariants && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: 'rgba(138,43,226,0.95)',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          fontSize: '11px'
                        }}>
                          {variants.length} variants
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '3px', color: '#f0e6d2' }}>
                        {displayCard.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#a0a0a0', marginBottom: '6px', flex: 1 }}>
                        {card.category}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addCard(card);
                          }}
                          style={{
                            flex: 1,
                            padding: '4px',
                            background: 'rgba(74,222,128,0.2)',
                            border: '1px solid #4ade80',
                            borderRadius: '4px',
                            color: '#4ade80',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            fontSize: '11px'
                          }}
                          title="Add"
                        >
                          <Plus size={12} />
                        </button>
                        {hasMultipleVariants && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRememberVariantSelection(false);
                              setVariantModalMode('choose');
                              setVariantModalCard(card);
                              setVariantModalVariants(variants);
                            }}
                            style={{
                              padding: '4px',
                              background: 'rgba(147,197,253,0.2)',
                              border: '1px solid #93c5fd',
                              borderRadius: '4px',
                              color: '#bfdbfe',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '3px',
                              fontSize: '11px'
                            }}
                          >
                            <List size={12} />
                          </button>
                        )}
                        {quantity > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              inDeck && removeCard(inDeck);
                            }}
                            style={{
                              flex: 1,
                              padding: '4px',
                              background: 'rgba(248,113,113,0.2)',
                              border: '1px solid #f87171',
                              borderRadius: '4px',
                              color: '#f87171',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '3px',
                              fontSize: '11px'
                            }}
                            title="Remove"
                          >
                            <Minus size={12} />
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
          width: rightSidebarMinimized ? '32px' : '260px', 
          background: rightSidebarMinimized ? 'transparent' : 'rgba(26,20,16,0.95)', 
          borderLeft: rightSidebarMinimized ? 'none' : '2px solid rgba(212,175,55,0.3)',
          overflowY: rightSidebarMinimized ? 'visible' : 'auto',
          overflowX: 'visible',
          padding: rightSidebarMinimized ? '0' : '1rem',
          transition: 'all 0.3s ease',
          position: 'relative',
          flexShrink: 0
        }}>
          {/* Toggle Button */}
          <button
            onClick={() => setRightSidebarMinimized(!rightSidebarMinimized)}
            style={{
              position: 'absolute',
              right: '0',
              top: '12px',
              zIndex: 999,
              width: rightSidebarMinimized ? '32px' : '100%',
              height: rightSidebarMinimized ? '48px' : 'auto',
              padding: rightSidebarMinimized ? '0' : '8px',
              background: rightSidebarMinimized ? 'rgba(15,12,9,0.7)' : 'transparent',
              border: 'none',
              borderLeft: rightSidebarMinimized ? '2px solid rgba(212,175,55,0.4)' : 'none',
              borderRadius: '0',
              color: rightSidebarMinimized ? '#d4af37' : '#7a6f5d',
              cursor: 'pointer',
              marginBottom: rightSidebarMinimized ? 0 : '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: rightSidebarMinimized ? '16px' : '11px',
              transition: 'all 0.2s',
              boxShadow: rightSidebarMinimized ? '-2px 0 8px rgba(0,0,0,0.3)' : 'none',
              backdropFilter: rightSidebarMinimized ? 'blur(4px)' : 'none',
              fontWeight: rightSidebarMinimized ? 'normal' : '500',
              textTransform: rightSidebarMinimized ? 'none' : 'uppercase',
              letterSpacing: rightSidebarMinimized ? '0' : '0.5px'
            }}
            onMouseEnter={(e) => {
              if (rightSidebarMinimized) {
                e.currentTarget.style.background = 'rgba(15,12,9,0.9)';
                e.currentTarget.style.borderLeftColor = 'rgba(212,175,55,0.6)';
              } else {
                e.currentTarget.style.color = '#d4af37';
              }
            }}
            onMouseLeave={(e) => {
              if (rightSidebarMinimized) {
                e.currentTarget.style.background = 'rgba(15,12,9,0.7)';
                e.currentTarget.style.borderLeftColor = 'rgba(212,175,55,0.4)';
              } else {
                e.currentTarget.style.color = '#7a6f5d';
              }
            }}
            title={rightSidebarMinimized ? 'Show deck zones' : 'Hide deck zones'}
          >
            {rightSidebarMinimized ? '‹' : 'hide ›'}
          </button>

          {!rightSidebarMinimized && (
            <>
          <h3 style={{ margin: '60px 0 16px 0', fontSize: '1.1rem', fontFamily: 'Cinzel, serif', color: '#d4af37' }}>
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
                {/* Zone Header with split actions: left selects filter, right toggles list */}
                <div
                  style={{
                    display: 'flex',
                    width: '100%',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: `2px solid ${isSelected ? config.color : 'rgba(212,175,55,0.2)'}`,
                    background: isSelected ? `${config.color}20` : 'rgba(42,37,32,0.5)',
                    transition: 'all 0.2s'
                  }}
                >
                  <button
                    onClick={() => setSelectedZone(zone)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'transparent',
                      border: 'none',
                      color: config.color,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      textAlign: 'left',
                      fontFamily: 'Cinzel, serif'
                    }}
                  >
                    <Icon size={20} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{config.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a0a0a0', marginTop: '2px' }}>
                        {count} / {config.max}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => toggleZone(zone)}
                    aria-label="Toggle zone list"
                    style={{
                      width: '46px',
                      background: 'rgba(26,20,16,0.7)',
                      border: 'none',
                      borderLeft: '1px solid rgba(212,175,55,0.3)',
                      color: config.color,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(26,20,16,0.9)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(26,20,16,0.7)';
                    }}
                  >
                    <div
                      style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}
                    >
                      ▼
                    </div>
                  </button>
                </div>

                {/* Expanded Card List */}
                {isExpanded && cards.length > 0 && (
                  <div style={{ 
                    marginTop: '8px',
                    paddingLeft: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    {cards.map((dc) => {
                      const resolvedCard = dc.card || getCardById(dc.card_id);
                      const displayCard = resolvedCard ? getDisplayCard(resolvedCard) : null;
                      const illegalReason = getIllegalReason(dc);
                      return (
                        <div
                          key={dc.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px',
                            background: illegalReason ? 'rgba(248,113,113,0.15)' : 'rgba(42,37,32,0.5)',
                            border: illegalReason ? '1px solid rgba(248,113,113,0.5)' : `1px solid ${config.color}40`,
                            borderRadius: '6px',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            if (displayCard) {
                              const baseName = getBaseName(displayCard.name);
                              setSearchQuery(baseName);
                              setSelectedZone(dc.zone as Zone);
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = illegalReason ? 'rgba(248,113,113,0.25)' : 'rgba(42,37,32,0.8)';
                            e.currentTarget.style.borderColor = illegalReason ? 'rgba(248,113,113,0.8)' : `${config.color}80`;
                            if (displayCard) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              hoverTimerRef.current = setTimeout(() => {
                                const previewWidth = 300;
                                const previewHeight = 420;
                                let x = rect.left - previewWidth - 10;
                                let y = rect.top;
                                
                                // Check if preview would go off left edge
                                if (x < 10) {
                                  x = rect.right + 10;
                                }
                                
                                // Check if preview would go off right edge
                                if (x + previewWidth > window.innerWidth - 10) {
                                  x = window.innerWidth - previewWidth - 10;
                                }
                                
                                // Check if preview would go off bottom edge
                                if (y + previewHeight > window.innerHeight - 10) {
                                  y = window.innerHeight - previewHeight - 10;
                                }
                                
                                // Check if preview would go off top edge
                                if (y < 10) {
                                  y = 10;
                                }
                                
                                setHoverPreviewCard(displayCard);
                                setHoverPreviewPosition({ x, y });
                              }, 500);
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = illegalReason ? 'rgba(248,113,113,0.15)' : 'rgba(42,37,32,0.5)';
                            e.currentTarget.style.borderColor = illegalReason ? 'rgba(248,113,113,0.5)' : `${config.color}40`;
                            if (hoverTimerRef.current) {
                              clearTimeout(hoverTimerRef.current);
                              hoverTimerRef.current = null;
                            }
                            setHoverPreviewCard(null);
                            setHoverPreviewPosition(null);
                          }}
                        >
                          <input
                            type="number"
                            min={dc.zone === 'legend' || dc.zone === 'champion' ? 1 : 0}
                            max={dc.zone === 'legend' || dc.zone === 'champion' ? 1 : (dc.zone === 'rune' ? ZONE_CONFIGS.rune.max : 3)}
                            value={dc.quantity}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const raw = Number(e.target.value);
                              if (Number.isNaN(raw)) return;

                              const min = dc.zone === 'legend' || dc.zone === 'champion' ? 1 : 0;
                              const max = dc.zone === 'legend' || dc.zone === 'champion' ? 1 : (dc.zone === 'rune' ? ZONE_CONFIGS.rune.max : 3);
                              const clamped = Math.min(Math.max(raw, min), max);

                              setDeckCards((prev) => prev.map((item) => item.id === dc.id ? { ...item, quantity: clamped } : item));
                              updateDeckCardQuantity(dc, clamped);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            style={{
                              width: '38px',
                              height: '26px',
                              textAlign: 'center',
                              background: `${config.color}25`,
                              border: `1px solid ${config.color}`,
                              borderRadius: '4px',
                              color: config.color,
                              fontWeight: 'bold',
                              fontSize: '0.85rem',
                              padding: '0 4px'
                            }}
                            title="Set quantity"
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#f0e6d2', fontSize: '0.85rem', fontWeight: '500' }}>
                              {displayCard?.name || dc.card?.name || dc.card_id}
                            </div>
                            {dc.is_owned && (
                              <div style={{ fontSize: '0.7rem', color: '#4ade80', marginTop: '2px' }}>
                                ✓ Owned
                              </div>
                            )}
                            {illegalReason && (
                              <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '4px' }}>
                                {illegalReason}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCard(dc);
                            }}
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
                      );
                    })}
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
          </>
          )}
        </div>
      </div>

      {/* Variant Selection Modal */}
      {variantModalCard && variantModalVariants.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => {
            setVariantModalCard(null);
            setVariantModalVariants([]);
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(26,20,16,0.98), rgba(15,12,9,0.98))',
              border: '2px solid rgba(212,175,55,0.5)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontFamily: 'Cinzel, serif', color: '#d4af37', fontSize: '1.5rem' }}>
              Choose Variant
            </h2>
            <p style={{ margin: '0 0 24px 0', color: '#a0a0a0', fontSize: '14px' }}>
              Select which version of "{getBaseName(variantModalCard.name)}" to {variantModalMode === 'add' ? 'add to your deck' : 'use'}:
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#d4af37', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={rememberVariantSelection}
                onChange={(e) => setRememberVariantSelection(e.target.checked)}
              />
              Remember this variant for future adds
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {variantModalVariants.map(variant => (
                <div
                  key={variant.card_id}
                  onClick={() => {
                    const baseName = getBaseName(variantModalCard.name);
                    if (rememberVariantSelection) {
                      setPreferredVariantMap((prev) => ({ ...prev, [baseName]: variant.card_id }));
                    }
                    setSelectedVariantCardMap((prev) => ({ ...prev, [baseName]: variant }));
                    if (variantModalMode === 'add') {
                      addCardVariant(variant);
                    }
                    setVariantModalCard(null);
                    setVariantModalVariants([]);
                  }}
                  style={{
                    background: 'rgba(42,35,28,0.95)',
                    border: '2px solid rgba(212,175,55,0.3)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)';
                  }}
                >
                  <div style={{ position: 'relative', width: '100%' }}>
                    <ImageWithSkeleton
                      src={variant.image_url}
                      alt={variant.name}
                      height={300}
                      borderColor="rgba(26,20,16,0.98)"
                    />
                  </div>
                  <div style={{ padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#f0e6d2', marginBottom: '4px' }}>
                      {variant.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#a0a0a0' }}>
                      #{variant.collector_number}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setVariantModalCard(null);
                setVariantModalVariants([]);
              }}
              style={{
                marginTop: '24px',
                padding: '10px 20px',
                background: 'rgba(248,113,113,0.2)',
                border: '1px solid #f87171',
                borderRadius: '6px',
                color: '#f87171',
                cursor: 'pointer',
                width: '100%',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hover Preview Overlay */}
      {hoverPreviewCard && hoverPreviewPosition && (
        <div
          style={{
            position: 'fixed',
            left: `${hoverPreviewPosition.x}px`,
            top: `${hoverPreviewPosition.y}px`,
            zIndex: 9998,
            pointerEvents: 'none',
            width: '300px',
            background: 'rgba(15,12,9,0.98)',
            border: '2px solid rgba(212,175,55,0.6)',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
          }}
        >
          {hoverPreviewCard.image_url ? (
            <img
              src={`/api/proxy-image?url=${encodeURIComponent(hoverPreviewCard.image_url)}`}
              alt={hoverPreviewCard.name}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          ) : (
            <div style={{ height: '420px', background: 'linear-gradient(135deg, rgba(42,35,28,0.9), rgba(30,25,20,0.9))' }} />
          )}
        </div>
      )}

      <style jsx>{`
        
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

        @keyframes card-skeleton {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </Layout>
  );
}
