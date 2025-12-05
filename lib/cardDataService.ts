/**
 * Card Data Service
 * 
 * This service abstracts card data fetching to support multiple data sources:
 * 1. Local Database (Supabase) - Current implementation
 * 2. Riot API - Future implementation when API key is available
 * 
 * To switch to Riot API:
 * - Set USE_RIOT_API = true
 * - Ensure RIOT_API_KEY is set in .env.local
 * - The rest of the code will automatically use Riot API endpoints
 */

// Configuration
const USE_RIOT_API = process.env.NEXT_PUBLIC_USE_RIOT_API === 'true';
const RIOT_API_KEY = process.env.RIOT_API_KEY;
const RIOT_API_BASE = 'https://riftbound-content.ams.gdrips.com/api';

// Type definitions matching Riot API structure
export interface CardStatsDTO {
  energy?: number;
  might?: number;
  cost?: number;
  power?: number;
}

export interface CardArtDTO {
  thumbnailURL?: string;
  fullURL?: string;
  artist?: string;
}

export interface CardDTO {
  id: string;
  collectorNumber?: number;
  set: string;
  name: string;
  description?: string;
  type?: string;
  rarity?: string;
  faction?: string;
  stats?: CardStatsDTO;
  keywords?: string[];
  art?: CardArtDTO;
  flavorText?: string;
  tags?: string[];
  // Local database fields (for backwards compatibility)
  card_id?: string;
  set_name?: string;
  image_url?: string;
  category?: string;
  domains?: string[];
  energy_cost?: number;
  power_cost?: number;
  might?: number;
  abilities_text?: string;
  flavor_text?: string;
}

export interface SetDTO {
  id: string;
  name: string;
  cards: CardDTO[];
}

export interface RiftboundContentDTO {
  game: string;
  version: string;
  lastUpdated: string;
  sets: SetDTO[];
}

/**
 * Fetch all cards from the configured data source
 */
export async function getAllCards(locale: string = 'en'): Promise<CardDTO[]> {
  if (USE_RIOT_API && RIOT_API_KEY) {
    return fetchFromRiotAPI(locale);
  }
  return fetchFromLocalDatabase();
}

/**
 * Search cards from the configured data source
 */
export async function searchCards(
  query: string,
  locale: string = 'en'
): Promise<CardDTO[]> {
  if (USE_RIOT_API && RIOT_API_KEY) {
    return searchRiotAPI(query, locale);
  }
  return searchLocalDatabase(query);
}

/**
 * Get a single card by ID
 */
export async function getCardById(cardId: string): Promise<CardDTO | null> {
  if (USE_RIOT_API && RIOT_API_KEY) {
    return getCardFromRiotAPI(cardId);
  }
  return getCardFromLocalDatabase(cardId);
}

/**
 * Normalize card data to unified format
 * Converts between Riot API format and local database format
 */
export function normalizeCard(card: any): CardDTO {
  // If it's already in Riot API format
  if (card.id && !card.card_id) {
    return {
      id: card.id,
      card_id: card.id,
      collectorNumber: card.collectorNumber,
      set: card.set,
      set_name: card.set,
      name: card.name,
      description: card.description,
      type: card.type,
      category: card.type,
      rarity: card.rarity,
      faction: card.faction,
      stats: card.stats,
      keywords: card.keywords,
      art: card.art,
      image_url: card.art?.fullURL,
      flavorText: card.flavorText,
      flavor_text: card.flavorText,
      tags: card.tags,
      energy_cost: card.stats?.energy,
      power_cost: card.stats?.power,
      domains: card.faction ? [card.faction] : [],
    };
  }

  // If it's in local database format
  if (card.card_id) {
    return {
      card_id: card.card_id,
      id: card.card_id,
      set: card.set_name,
      set_name: card.set_name,
      name: card.name,
      description: card.description,
      type: card.category,
      category: card.category,
      rarity: card.rarity,
      image_url: card.image_url,
      flavorText: card.flavor_text,
      flavor_text: card.flavor_text,
      tags: card.tags,
      keywords: card.keywords,
      stats: {
        energy: card.energy_cost,
        power: card.power_cost,
        might: card.might,
      },
      art: card.image_url
        ? {
            fullURL: card.image_url,
            thumbnailURL: card.image_url,
          }
        : undefined,
      domains: card.domains,
      energy_cost: card.energy_cost,
      power_cost: card.power_cost,
      might: card.might,
    };
  }

  return card;
}

// ============================================================================
// Riot API Implementation
// ============================================================================

async function fetchFromRiotAPI(locale: string = 'en'): Promise<CardDTO[]> {
  try {
    const response = await fetch(
      `${RIOT_API_BASE}/riftbound/content/v1/contents?locale=${locale}`,
      {
        headers: {
          'X-Riot-Token': RIOT_API_KEY!,
        },
      }
    );

    if (!response.ok) {
      console.error('Riot API error:', response.status, response.statusText);
      // Fallback to local database if Riot API fails
      return fetchFromLocalDatabase();
    }

    const data: RiftboundContentDTO = await response.json();
    const allCards: CardDTO[] = [];

    for (const set of data.sets) {
      for (const card of set.cards) {
        allCards.push(normalizeCard(card));
      }
    }

    return allCards;
  } catch (error) {
    console.error('Error fetching from Riot API:', error);
    // Fallback to local database
    return fetchFromLocalDatabase();
  }
}

async function searchRiotAPI(
  query: string,
  locale: string = 'en'
): Promise<CardDTO[]> {
  try {
    const allCards = await fetchFromRiotAPI(locale);
    const lowerQuery = query.toLowerCase();

    return allCards.filter(
      (card) =>
        card.name.toLowerCase().includes(lowerQuery) ||
        card.id.toLowerCase().includes(lowerQuery) ||
        card.description?.toLowerCase().includes(lowerQuery)
    );
  } catch (error) {
    console.error('Error searching Riot API:', error);
    // Fallback to local database
    return searchLocalDatabase(query);
  }
}

async function getCardFromRiotAPI(cardId: string): Promise<CardDTO | null> {
  try {
    const allCards = await fetchFromRiotAPI();
    const card = allCards.find((c) => c.id === cardId || c.card_id === cardId);
    return card || null;
  } catch (error) {
    console.error('Error fetching card from Riot API:', error);
    // Fallback to local database
    return getCardFromLocalDatabase(cardId);
  }
}

// ============================================================================
// Local Database Implementation (Current)
// ============================================================================

async function fetchFromLocalDatabase(): Promise<CardDTO[]> {
  try {
    const response = await fetch('/api/cards/search?q=');
    const data = await response.json();
    return (data.results || []).map(normalizeCard);
  } catch (error) {
    console.error('Error fetching from local database:', error);
    return [];
  }
}

async function searchLocalDatabase(query: string): Promise<CardDTO[]> {
  try {
    const response = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return (data.results || []).map(normalizeCard);
  } catch (error) {
    console.error('Error searching local database:', error);
    return [];
  }
}

async function getCardFromLocalDatabase(cardId: string): Promise<CardDTO | null> {
  try {
    const response = await fetch(`/api/cards/search?q=${encodeURIComponent(cardId)}`);
    const data = await response.json();
    const card = (data.results || []).find(
      (c: any) => c.card_id === cardId || c.id === cardId
    );
    return card ? normalizeCard(card) : null;
  } catch (error) {
    console.error('Error fetching card from local database:', error);
    return null;
  }
}
