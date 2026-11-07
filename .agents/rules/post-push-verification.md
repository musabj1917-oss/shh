---
description: Automatically audit all connected services after any git push
globs: *
alwaysApply: true
---

# Post-Push Verification Sentinel Rule

Whenever changes are committed and pushed to GitHub (`git push`):
1. **Invoke the `post-push-sentinel` subagent** or run the automated audit:
   ```bash
   npm run verify:services
   ```
2. **Verify Connected Services Status**:
   - **GitHub**: Confirm `origin/master` is synchronized and working tree is clean.
   - **Neon Database**: Confirm all migrations are applied (`node scripts/test-neon.mjs`).
   - **Firebase / FCM**: Ensure push notifications credentials initialize properly.
   - **Vercel**: Verify project environment variables via `mcp-gateway` (composio1).
   - **Builds**: Ensure root tests (`npm test`), root types (`npm run typecheck`), and mobile types (`cd apps/mobile && npx tsc --noEmit`) pass without error.
3. Report any failures or required actions to the user immediately.
