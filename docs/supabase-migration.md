# Supabase migration

Target project: `yhvtgxrqxqbqqeokfwpg`. Website: `https://www.kabayanhub.org`.

The app uses Supabase Auth, PostgreSQL, Storage, and Realtime. Firebase's 13 public news articles were copied with their IDs, content, images, timestamps, and reward settings intact. The import is versioned as `202609300003_news.sql` and compares exactly against the export in hosted verification. Other Firebase accounts and records were test data and were not copied. Firebase remains available for rollback.

## Deployment order

1. Apply versioned Supabase migrations to the intended project.
2. Set the two public Supabase variables in Vercel, using Node.js 24 and the Next.js preset.
3. Set Supabase Auth Site URL to `https://www.kabayanhub.org` and allow `https://www.kabayanhub.org/login` plus exact local/preview login redirects needed for testing.
4. Verify a preview, then deploy production and check news, login, dashboard, community, and uploads.
5. Create a new account through `/signup` and confirm its email. Grant administrator access only through trusted SQL after checking the intended account.

Publishing frontend code does not apply database migrations. Future schema changes need `npx supabase db push` as well as a website deployment. Configure production SMTP for reliable signup email delivery; the hosted default sender has recipient/rate restrictions.

## Administrator setup

After the owner has signed up and confirmed their email, run this in the project's SQL editor, replacing the placeholder with the owner's verified email:

```sql
update public.users p
set data = jsonb_set(p.data, '{role}', '"admin"'::jsonb)
from auth.users a
where p.id = a.id::text
  and lower(a.email) = lower('OWNER_EMAIL_HERE')
  and a.email_confirmed_at is not null
returning p.id, p.data->>'role' as role;
```

Expect exactly one row. No browser endpoint grants admin status; signup metadata is ignored for roles. Account owners can edit tracker preferences; public identity edits use `save_profile`. Roles, balances, and reward history are protected from direct client writes.

## Hosted smoke verification

`node scripts/verify-supabase.cjs` explicitly targets this project. It retrieves credentials through an already-authenticated Supabase CLI and keeps the server key only in process memory. It creates two disposable confirmed accounts, checks positive and negative access cases, compares news, and stores temporary test login credentials in the OS temp directory for browser verification. It does not send signup emails.

Run `node scripts/verify-supabase.cjs --cleanup` afterward. It removes only recorded disposable account IDs, their dependent test data, reports, and avatars. Do not run hosted smoke tests routinely against a live community; use `npm test` for normal development.

## Rollback

The prior Firebase app is Git commit `f5b9e3d`; its project is `kabayanhub-f59a2`. Roll back the website deployment or deploy that commit with the original Firebase environment configuration. Do not delete either backend while deciding to roll back. After real users start creating Supabase data, a rollback needs a separate plan to preserve their new records.
