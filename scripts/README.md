# Card Database Seeding

This directory contains scripts for managing card data in the Supabase database.

## Seed Cards from JSON

The `seed-cards.ts` script will:
1. **Delete all existing cards** from the database
2. **Transform card data** from `riftbound_cards.json` to match the database schema
3. **Bulk insert** all cards into Supabase in batches of 500

### Schema Mapping

| JSON Field | Database Field | Notes |
|-----------|----------------|-------|
| `id` | `card_id` | Unique card identifier |
| `name` | `name` | Card name |
| `cardType` | `category` | Type of card (Champion, Spell, etc.) |
| `domain` | `domains` | Array with single domain |
| `energyCost` | `energy_cost` | Parsed as integer |
| `powerCost` | `power_cost` | Parsed as integer |
| `might` | `might` | Parsed as integer |
| `rarity` | `rarity` | Card rarity |
| `description` | `abilities_text` | Card effect/abilities |
| `flavorText` | `flavor_text` | Flavor text |
| `set.name` | `set_name` | Set name |
| `number` | `collector_number` | Card number (e.g., 001/024) |
| `images.large` | `image_url` | Large card image URL |

### Running the Seed

```bash
npm run seed-cards
```

### Prerequisites

Ensure your `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

### Progress

The script will output:
- ✅ Deletion confirmation
- ✅ Cards loaded count
- ✅ Batch insertion progress
- 🎉 Final completion summary

### Notes

- Cards are inserted in batches of 500 for optimal performance
- The `card_id` field must be unique (enforced by database constraint)
- Empty or null values are handled gracefully
- Image URLs are fetched from TCGPlayer CDN
