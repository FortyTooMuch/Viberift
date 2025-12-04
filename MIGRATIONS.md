# Database Migrations

## How to Apply Migrations

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste and execute

## Pending Migrations

### Add `bought_at` column
File: `db/add_bought_at_column.sql`

This migration adds a `bought_at` column to the `collection_items` table to store the price paid when a card was added to the collection.

**To apply:**
```sql
-- Copy and run this in Supabase SQL Editor:
ALTER TABLE collection_items
ADD COLUMN IF NOT EXISTS bought_at DECIMAL(10, 2);

COMMENT ON COLUMN collection_items.bought_at IS 'Price paid when card was added to collection';
```

### Add `language` column (if not already applied)
File: `db/add_language_column.sql`

This migration adds a `language` column to the `collection_items` table.

**To apply:**
```sql
-- Copy and run this in Supabase SQL Editor:
ALTER TABLE collection_items
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'EN';

COMMENT ON COLUMN collection_items.language IS 'Language of the card (EN, FR, DE, etc.)';
```

## Verification

After applying migrations, verify the columns exist:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'collection_items' 
  AND column_name IN ('language', 'bought_at');
```

Expected result:
```
column_name | data_type       | column_default
------------|-----------------|---------------
language    | text            | 'EN'::text
bought_at   | numeric         | NULL
```
