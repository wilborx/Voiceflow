---
name: VoiceFlow AI DB rebuild requirement
description: How TypeScript project references work for @workspace/db in this monorepo
---

**Rule:** After any schema change in `lib/db/src/schema/`, run:
```
cd lib/db && npx tsc -p tsconfig.json
```
before running `typecheck` on api-server — otherwise `@workspace/db` members appear missing.

**Why:** api-server uses TypeScript project references (`"references"` in tsconfig.json), which resolve `@workspace/db` from its compiled `dist/` declarations, not source. The declarations go stale after schema edits.

**How to apply:** Schema change → rebuild db lib → then typecheck api-server.
