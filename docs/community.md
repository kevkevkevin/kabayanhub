# Community feed

`/community` provides chronological text posts (500 characters), replies (280), likes, follows, Everyone/Following filters, public profiles, shareable links, owner deletion, and reports with an administrator review queue. Social interactions do not award Kabayan Points.

Dashboard and Settings share a profile editor for unique usernames, display name, bio (160 characters), and photo. `save_profile` reserves usernames with a PostgreSQL unique index and updates public/private display fields in one transaction. Public posts resolve profiles by user ID, so later edits appear on earlier posts. Account email and role are not exposed in profiles or the leaderboard.

## Data and permissions

Each feature uses its own PostgreSQL table. The repository layer in `lib/backend/db.ts` retains existing document-shaped page models while storing CMS payloads in `data` JSONB. Filtering, numeric/date ordering, pagination, and counts run on the server. This is an incremental data-model migration, not a fully normalized rewrite of every feature.

The social tables are `social_profiles`, `social_posts`, `follows`, `likes`, `replies`, and `social_reports`. Nested records use `parent_id`. Foreign keys cascade post deletions to likes/replies and account deletions to profiles. Reports remain private to their author and administrators. The read-only `leaderboard` table contains only usernames, display names, and point balances, synchronized by a database trigger and readable by signed-in members.

RLS enforces ownership; browser users cannot edit roles or point balances. Posts/replies cannot change authors or be edited after creation. Profile updates use an authenticated database function. Other existing reward features use server-chosen amounts and duplicate protection; the optional Tambayan lottery can award at most one winner per server-controlled round. These controls do not prove that a person read an article, shared externally, or completed a game honestly.

Following queries group 30 IDs and merge pages by a common timestamp/ID cursor. The feed refreshes after posting or via Refresh feed. Profiles, follows, chat, stickers, and configuration use Supabase Realtime with a visibility-aware refresh fallback. The document query interface caps an individual query at 1,000 rows; feed/reply views use explicit pagination.

## Images

Avatar inputs accept JPG/PNG/WebP up to 5 MB, crop to 512×512, and encode as JPEG. The `avatars` bucket accepts only JPEG uploads up to 2 MB at `social/avatars/{uid}/avatar.jpg`; only that owner may overwrite/delete it. Removing a photo clears its profile reference. The prior object remains until overwritten or removed through account cleanup. `market-images` accepts administrator-managed product images up to 10 MB. Both buckets expose public images.

## Verification and operation

Run `npm test` for local database permissions and Arabic-game tests. Hosted verification additionally checks real auth, Storage ownership, image downloads, profiles, social interactions, and exact preservation of the 13 news articles. See `docs/supabase-migration.md` for setup and cleanup.

This release does not include DMs, reposts, media posts, push notifications, automatic spam classification, or general posting rate limits. Reports are reviewed in the community administrator panel. Firebase emulator fixtures are historical and do not seed the new backend.
