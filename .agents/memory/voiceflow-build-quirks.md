---
name: VoiceFlow AI build quirks
description: esbuild and runtime dependency issues specific to this project
---

**Rule:** When adding packages that use the `ws` WebSocket module (e.g. Telnyx SDK), you must:
1. Add `"ws"` to the `external` array in `apps/api-server/build.mjs`
2. Also install `ws` as a direct dependency so Node can resolve it at runtime

**Why:** esbuild marks it external (can't bundle), but the package still needs to exist in node_modules for Node ESM to find it at runtime.

**How to apply:** Any time a new backend SDK has WebSocket features (streaming, realtime), check for this pattern.
