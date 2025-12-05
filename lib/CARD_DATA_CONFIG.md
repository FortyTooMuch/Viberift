/**
 * Card Data Source Configuration
 * 
 * This file documents how to configure the card data source.
 * 
 * CURRENT SETUP (Local Database):
 * - Uses Supabase database stored in your local environment
 * - Set NEXT_PUBLIC_USE_RIOT_API = false (or leave it unset)
 * - No additional API key needed
 * 
 * FUTURE SETUP (Riot API):
 * - Uses official Riot API for card data
 * - Set NEXT_PUBLIC_USE_RIOT_API = true in .env.local
 * - Set RIOT_API_KEY = your-api-key in .env.local (keep this secret!)
 * 
 * SWITCHING BETWEEN SOURCES:
 * 1. Get your API key from Riot
 * 2. Add to .env.local:
 *    NEXT_PUBLIC_USE_RIOT_API=true
 *    RIOT_API_KEY=your-api-key-here
 * 3. Restart your dev server
 * 4. The app will automatically use Riot API
 * 
 * FALLBACK BEHAVIOR:
 * - If Riot API fails, the app automatically falls back to local database
 * - This ensures reliability and graceful degradation
 */

// Example .env.local configuration:

/**
# Current Setup (Local Database Only)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Future: Riot API Setup
# NEXT_PUBLIC_USE_RIOT_API=true
# RIOT_API_KEY=your-riot-api-key
*/
