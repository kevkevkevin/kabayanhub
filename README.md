# KabayanHub

Next.js community hub for Filipinos in Saudi Arabia. Vercel hosts the app; Supabase provides authentication, PostgreSQL, Storage, and realtime updates.

## Local development

Use Node.js 24. Copy `.env.example` to `.env.local` and supply your Supabase project URL and publishable key, then run:

```sh
npm ci
npm run dev
```

Only the publishable key belongs in `NEXT_PUBLIC_*` variables. Never put a secret/service-role key in the frontend or commit credentials. New accounts confirm their email before logging in. Existing Firebase test accounts are not migrated.

English Typing Rush rewards also require `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and the Vercel server environment. This server-only key verifies completed game recordings and credits rewards; never prefix it with `NEXT_PUBLIC_`.

Signed-in players can claim 1 Kabayan Point per 10 game points after completing a round. Wind scores count too. Speed increases at 500, 700, 800, and every 100 points after that, capped at 3×. The server replays a seeded round, checks its elapsed time, and credits each round once in a transaction. Replay validation prevents fabricated scores and invalid power-ups; it does not prove a player is human. Recordings support up to two hours of active play and 12,000 actions and must be claimed within 24 hours. Starting another round on the same account replaces an unfinished round; reloading loses its local recording.

## Database and deployment

Migrations in `supabase/migrations` create feature tables, access policies, atomic profile/reward functions, public image buckets, and realtime subscriptions. The news migration preserves the original 13 public articles and their IDs without overwriting later edits.

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

On Vercel, use the Next.js preset, `npm run build`, Node.js 24, and the default Output Directory. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the intended environments. Leave `KABAYAN_BUILD_DIR` unset there. Dynamic news and market routes use the Next.js runtime, not a static export.

Configure Supabase Auth with the production site URL and exact `/login` confirmation redirects. Configure production SMTP before inviting a wider audience; the default email service has delivery restrictions.

See [migration and administration](docs/supabase-migration.md) and [community implementation](docs/community.md).

## Kabayan Coin arcade

`/kabayan-cascade` uses free Kabayan Coins, a separate, non-transferable currency with no cash or reward value. Coins cannot be bought, transferred, or cashed out. They can be converted to play-only Kabayan Points at 10 coins to 1 KP. Marketplace items are virtual collectibles only, with no physical fulfillment, vouchers, cash, or real-world reward value. Each account receives 1,000 coins when its arcade wallet is first opened and can claim 500 more once per Saudi calendar day. The dashboard displays the shared balance; the game shows recent transactions.

The migration `202610070001_kabayan_coins.sql` owns the wallet, per-game bonus state, saved results, and transaction history. Only authenticated RPCs can grant or spend coins; browsers have read access only to their own rows. Cascades, random symbols, multipliers, and bonus turns are computed in PostgreSQL. Wallet row locks and per-user request IDs make spending atomic and retries idempotent. Pending request IDs are kept locally so a reload can recover an interrupted spin. Future coin games must use the same wallet lock and transaction ledger through reviewed server functions; no generic client credit endpoint is exposed. Existing KP-earning games retain their existing reward behavior. Migration `202610070002_play_coin_conversion.sql` adds atomic, idempotent conversion with a coin ledger entry and KP activity record. The dashboard recovers pending conversions after reload and refreshes both balances and activity. Conversion amounts must be multiples of 10, up to 1,000,000 coins per request.

## Verification

```sh
npm test
npx tsc --noEmit
npm run build
```

`npm test` runs PostgreSQL permissions/transaction tests in PGlite and the Arabic game tests without touching hosted data. The explicit `npm run test:hosted` command uses an authenticated Supabase CLI to create disposable hosted accounts; see the migration guide before using it. Clean up with `node scripts/verify-supabase.cjs --cleanup` after browser verification.

Firebase configuration and `test:legacy:*` scripts remain for rollback/reference. They are not the active backend. The old Firebase project has not been deleted.

## Admin user management

`/admin/users` offers paginated email/name/username searches, KP and coin balances, account dates, balance editing, blocking/unblocking, and confirmed permanent deletion. Server requests verify the administrator's current database role. Balance edits use expected previous balances and the shared wallet lock, preventing gameplay or conversion from being overwritten. An idempotent request ID records each change once in the admin-only `admin_user_audit` table; coin and KP adjustments also appear in member histories.

Blocking sets a protected database flag and synchronizes an Auth ban. Restrictive RLS and write triggers stop existing blocked sessions; trusted typing rewards also reject blocked targets. Account deletion first blocks access, removes the avatar through Storage, and deletes the Auth account with database cleanup/cascades for its profile, balances, social content, and personal records. The audit record remains. Failed cleanup leaves the account blocked with a retryable deletion. Administrator accounts cannot be blocked or deleted through this page. No existing members are modified during deployment.

`node --env-file=.env.local --import tsx scripts/verify-admin-users.ts` explicitly exercises the hosted admin API with disposable accounts, then deletes those exact accounts.

## KP leaderboard

`/leaderboard` ranks active members by their current KP balance, with shared ranks for ties, a top-50 list, and the signed-in member's own rank. The member-only RPC exposes names, usernames, and KP without email or private account fields. The page refreshes every 30 seconds while visible and on returning to the tab. Public Supermarket navigation is temporarily hidden; its routes and administration remain available.
