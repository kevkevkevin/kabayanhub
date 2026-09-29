# User role protection

Client signup must create `/users/{uid}` with `role: "user"`. A signed-in owner may edit their other profile fields, but cannot add, change, or remove `role`, including through merge or replacement writes. Legacy profiles without a role remain editable without acquiring a role. Client deletion of user documents is denied; account deletion must go through a trusted administrative workflow.

Assign or revoke roles only through a trusted Admin SDK environment or the Firebase console using authorized IAM access. Existing administrator roles are preserved. The fix prevents new client-side role changes; it does not identify or revoke any roles assigned before deployment. Review current administrators separately before public launch.

This is a focused role-permission fix. It does not change the existing points system or other profile fields. The community feed awards no Kabayan Points for posting, replying, liking, or following.

## Local regression tests

With dependencies installed and Java 21+ on PATH, run:

```sh
npm run test:rules
```

The test command launches only the Firestore emulator with the isolated `demo-kabayan-rules` project and loads the repository rules. No production data or Firebase login is required. It covers signup, owner edits, legacy users, admin access, role manipulation, replacement writes, anonymous/other-user writes, and batched escalation attempts.

## Deployment

Repository edits do not update live Firebase rules. Deploy only `firestore:rules` to the verified intended Firebase project when deploying this change; do not deploy Hosting or unrelated services for this fix.
