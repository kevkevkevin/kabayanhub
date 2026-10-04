# KabayanHub

Next.js community hub for Filipinos in Saudi Arabia. Vercel hosts the app; Supabase provides authentication, PostgreSQL, Storage, and realtime updates.

## Local development

Use Node.js 24. Copy `.env.example` to `.env.local` and supply your Supabase project URL and publishable key, then run:

```sh
npm ci
npm run dev
```

Only the publishable key belongs in `NEXT_PUBLIC_*` variables. Never put a secret/service-role key in the frontend or commit credentials. New accounts confirm their email before logging in. Existing Firebase test accounts are not migrated.

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

## Verification

```sh
npm test
npx tsc --noEmit
npm run build
```

`npm test` runs PostgreSQL permissions/transaction tests in PGlite and the Arabic game tests without touching hosted data. The explicit `npm run test:hosted` command uses an authenticated Supabase CLI to create disposable hosted accounts; see the migration guide before using it. Clean up with `node scripts/verify-supabase.cjs --cleanup` after browser verification.

Firebase configuration and `test:legacy:*` scripts remain for rollback/reference. They are not the active backend. The old Firebase project has not been deleted.
