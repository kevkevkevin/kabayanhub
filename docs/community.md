# Community feed

The `/community` page provides a chronological, text-first social feed with 500-character posts, 280-character replies, likes, follows, an Everyone/Following switch, public profile views, copyable post links, owner deletion, and private reports with an admin review queue. No social operation calls the points system, increments points, or writes reward activities. Existing non-social rewards remain unchanged.

The dashboard and Settings share the same profile editor for a unique username, display name, 160-character bio, and profile photo. Existing members publish their community profile on first save. Legacy account usernames are suggestions; community handles are reserved transactionally when the public profile is saved. The public feed resolves profile details by UID, so previous posts and replies reflect later changes. Avatar uploads are cropped and encoded to a 512×512 JPEG in the browser. JPG, PNG, and WebP inputs up to 5 MB are accepted; Storage enforces owner-only JPEG uploads up to 2 MB at a fixed per-user path. Removing a photo hides it from the public profile; the last uploaded object remains at that path until overwritten or administratively deleted.

## Data and permissions

- `socialProfiles/{uid}`: public display fields only, no email or private account details.
- `socialHandles/{username}`: one UID per handle; atomic reservation/release when renaming.
- `socialProfiles/{uid}/following/{targetUid}`: owner-managed, owner-readable following list.
- `socialPosts/{postId}`: immutable author UID, text, and server timestamp.
- `socialPosts/{postId}/likes/{uid}`: one like per account; counts use aggregation queries.
- `socialPosts/{postId}/replies/{replyId}`: replies with immutable authorship.
- `socialReports/{postId}_{reporterUid}`: one report per account/post, readable by the reporter and administrators. Admins can dismiss or remove the reported post.

Posts are fetched in pages of 20, newest first. Following queries use groups of 30 UIDs and merge results against the same timestamp/document-ID cursor. The feed refreshes after posting or via Refresh feed; it does not subscribe to the entire timeline. Replies are fetched when opened. Private account details are not copied into public profiles. The earlier client-side role-escalation fix remains enforced.

Deleting a post removes it from the feed and makes its reply/like collections unreadable. Firestore does not recursively delete subcollections, so a trusted cleanup job is recommended for removing orphaned documents at scale. This initial release does not include DMs, reposts, media posts, push notifications, automatic spam classification, or server-enforced posting rate limits.

## Local verification

Requires Node dependencies and Java 21+ on PATH:

```sh
npm run test:rules
npm run test:social
npx tsc --noEmit
npx eslint app/components/social app/community lib/social.ts lib/firebase.ts
```

For an isolated browser preview:

```sh
npx firebase emulators:start --project demo-kabayan-social --only auth,firestore,storage --config firebase.social-test.json
```

In another PowerShell terminal:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8089'
node tests/seed-social-preview.cjs
$env:NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true'
$env:KABAYAN_BUILD_DIR = '.kabayan-social-preview'
npm run dev -- --port 3002
```

Open `http://localhost:3002/community`. The seed script creates local-only sample accounts and posts. Demo login: `maya@example.test` / `KabayanDemo123!`. Emulator mode uses a hard-coded demo project and rejects non-localhost browser connections. Never set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` for a production build.

## Deploying the feature

Local repository changes do not update Firebase. Before production use:

1. Verify the intended Firebase project, existing administrators, Storage bucket configuration, and billing availability for uploads.
2. Deploy `firestore:rules`, `firestore:indexes`, and `storage` from the provided configuration; wait for indexes to finish building. The new Storage rules preserve the repository's known administrator product-upload path, but compare them with any existing console-only rules before deployment. Preserve unrelated live indexes if the CLI proposes removal.
3. Build and deploy the site using its existing hosting workflow with emulator mode disabled. The repository has an existing static-export blocker on dynamic market routes; address that before a full production export.
4. Verify a real account can publish a public profile, upload its avatar, and interact with a post, then assign a community moderator to review reports. For an open public launch, add App Check and server-side rate limiting as the next abuse-control layer.

No deployment or live-data migration is performed by the local test commands.
