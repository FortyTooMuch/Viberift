import type { NextApiRequest, NextApiResponse } from 'next';
import supabaseServer from '../../../../lib/supabaseServer';

async function getUserFromToken(token?: string | null) {
  if (!token) return null;
  try {
    const { data, error } = await supabaseServer.auth.getUser(token as string);
    if (error) return null;
    return data.user ?? null;
  } catch (e) {
    return null;
  }
}

type ValidationResult = {
  valid: boolean;
  errors: string[];
  checks: {
    hasLegend: boolean;
    hasChampion: boolean;
    championMatchesLegend: boolean;
    runesComplete: boolean;
    runesDomainMatch: boolean;
    battlefieldsComplete: boolean;
    mainBoardComplete: boolean;
    cardLimitsValid: boolean;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') ?? null;
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Deck ID required' });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get deck
  const { data: deck, error: deckError } = await supabaseServer
    .from('decks')
    .select('*')
    .eq('id', id)
    .single();

  if (deckError || !deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  // Check access
  if (deck.user_id !== user.id && !deck.is_public) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Get all deck cards
  const { data: deckCards } = await supabaseServer
    .from('deck_cards')
    .select('*')
    .eq('deck_id', id);

  if (!deckCards) {
    return res.status(500).json({ error: 'Failed to fetch deck cards' });
  }

  // Get card details
  const cardIds = [...new Set((deckCards || []).map((dc: { card_id: string }) => dc.card_id))];
  const { data: cards } = await supabaseServer
    .from('cards')
    .select('*')
    .in('card_id', cardIds);
  type Card = { card_id: string; name?: string; category?: string; tags?: string[]; domains?: string[] };
  const cardMap = new Map<string, Card>((cards || []).map((c: Card) => [c.card_id, c]));

  // Initialize validation result
  const result: ValidationResult = {
    valid: false,
    errors: [],
    checks: {
      hasLegend: false,
      hasChampion: false,
      championMatchesLegend: false,
      runesComplete: false,
      runesDomainMatch: false,
      battlefieldsComplete: false,
      mainBoardComplete: false,
      cardLimitsValid: false,
    }
  };

  // Get legend card details
  let legendCard: Card | null = null;
  let legendDomains: string[] = [];
  let legendChampionTag: string | null = null;

  if (deck.legend_card_id) {
    legendCard = cardMap.get(deck.legend_card_id) ?? null;
    if (legendCard) {
      result.checks.hasLegend = true;
      legendDomains = legendCard.domains || [];
      
      // Extract champion tag from legend tags (e.g., "sett")
      if (legendCard.tags && Array.isArray(legendCard.tags)) {
        legendChampionTag = legendCard.tags.find((tag: string) => 
          tag.toLowerCase() !== 'legend'
        ) ?? null;
      }
    }
  } else {
    result.errors.push('No legend selected');
  }

  // Check champion
  let championCard: Card | null = null;
  if (deck.champion_card_id) {
    championCard = cardMap.get(deck.champion_card_id) ?? null;
    if (championCard && championCard.category === 'champion') {
      result.checks.hasChampion = true;

      // Check if champion matches legend
      if (legendChampionTag && championCard.tags?.includes(legendChampionTag)) {
        result.checks.championMatchesLegend = true;
      } else {
        result.errors.push(`Champion must match legend's champion type (${legendChampionTag || 'unknown'})`);
      }
    }
  } else {
    result.errors.push('No champion selected');
  }

  // Check runes (12 cards, correct domain)
  const runes = (deckCards || []).filter((dc: { zone: string }) => dc.zone === 'rune');
  const runeCount = runes.reduce((sum: number, r: any) => sum + r.quantity, 0);
  
  if (runeCount === 12) {
    result.checks.runesComplete = true;
  } else {
    result.errors.push(`Rune deck must have exactly 12 cards (currently ${runeCount})`);
  }

  // Check rune domains match legend
  if (legendDomains.length > 0) {
    const invalidRunes = runes.filter((r: any) => {
      const card = cardMap.get(r.card_id);
      if (!card || !card.domains) return true;
      return !card.domains.some((d: string) => legendDomains.includes(d));
    });

    if (invalidRunes.length === 0) {
      result.checks.runesDomainMatch = true;
    } else {
      result.errors.push(`All runes must match legend domains (${legendDomains.join(', ')})`);
    }
  }

  // Check battlefields (3 cards)
  const battlefields = (deckCards || []).filter((dc: { zone: string }) => dc.zone === 'battlefield');
  const battlefieldCount = battlefields.reduce((sum: number, b: any) => sum + b.quantity, 0);
  
  if (battlefieldCount === 3) {
    result.checks.battlefieldsComplete = true;
  } else {
    result.errors.push(`Battlefield deck must have exactly 3 cards (currently ${battlefieldCount})`);
  }

  // Check main board (39 cards)
  const mainCards = (deckCards || []).filter((dc: { zone: string }) => dc.zone === 'main');
  const mainCount = mainCards.reduce((sum: number, m: any) => sum + m.quantity, 0);
  
  if (mainCount === 39) {
    result.checks.mainBoardComplete = true;
  } else {
    result.errors.push(`Main board must have exactly 39 cards (currently ${mainCount})`);
  }

  // Check card limits (max 3 of each card across main + side)
  const cardCounts = new Map<string, number>();
  
  (deckCards || []).forEach((dc: any) => {
    if (dc.zone === 'main' || dc.zone === 'side') {
      const current = cardCounts.get(dc.card_id) || 0;
      cardCounts.set(dc.card_id, current + dc.quantity);
    }
  });

  const overLimit = Array.from(cardCounts.entries()).filter(([_, count]) => count > 3);
  
  if (overLimit.length === 0) {
    result.checks.cardLimitsValid = true;
  } else {
    overLimit.forEach(([cardId, count]) => {
      const card = cardMap.get(cardId);
      result.errors.push(`${card?.name || cardId} exceeds limit (${count}/3)`);
    });
  }

  // Check overall validity
  result.valid = Object.values(result.checks).every(check => check === true);

  return res.status(200).json(result);
}
