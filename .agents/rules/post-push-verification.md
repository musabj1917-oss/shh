---
description: Automatically audit all connected services, Vercel build, debug APK, and type checks after any git push
globs: *
alwaysApply: true
---

# Post-Push Verification Sentinel Rule

Whenever changes are committed and pushed to GitHub (`git push`):

1. **Mandatory Post-Push Checks**:
   - **Vercel Build**: Check deployment status of project `shh` on Vercel via MCP gateway (`composio1` / `VERCEL_GET_DEPLOYMENTS`) or live HTTP check. Confirm `readyState: 'READY'`.
   - **Debug APK & Android**: Verify mobile configuration generation (`scripts/write-mobile-config.mjs`), Android sources/manifest integrity, and mobile tests (`npm run --workspace haiku-mobile test`).
   - **Type Check (Triple Layer)**: Run and verify all 3 TypeScript compilation targets:
     * Root & server: `npm run typecheck`
     * Contracts package: `npm run --workspace @haiku/contracts typecheck`
     * Mobile app: `npm run --workspace haiku-mobile typecheck`

2. **Automated Audit Script**:
   Execute the full post-push verification suite:
   ```bash
   npm run verify:services
   ```

3. **Verify Connected Services**:
   - **GitHub**: Confirm `origin/master` is synchronized and worktree is clean.
   - **Neon Database**: Confirm all migrations are applied and database is reachable.
   - **Firebase / FCM**: Ensure FCM push notification credentials initialize properly.
   - **Backend Tests**: Run `npm test` (all 14 test suites passing).

4. **Reporting**:
   Report the status of all checks to the user immediately.
