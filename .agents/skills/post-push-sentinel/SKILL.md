---
name: post-push-sentinel
description: Autonomous verification skill and agent instructions for auditing all connected project services, deployments, database schema, FCM push tokens, and build checks after a git push.
---

# Post-Push Sentinel Skill

This skill guides the agent in conducting a full post-push verification across all connected external and internal services for Haiku Messenger (`musabj1917-oss/shh`).

## When to Use
- **Always immediately following any `git push` to `origin`.**
- When verifying production readiness after code changes.
- When validating that newly added environment variables, database migrations, or theme tokens are in sync.

## Three Mandatory Post-Push Checks

Whenever a push is made, the sentinel MUST ALWAYS verify these three areas:

### 1. Vercel Build & Deployment Status
- **Target**: Project `shh` (`prj_Ha15kZIMc85SxvHx3XVQI9gB242r`)
- **Verification via MCP**: Query Composio via `mcp-gateway` -> `composio1` with `VERCEL_GET_DEPLOYMENTS` (projectId: `prj_Ha15kZIMc85SxvHx3XVQI9gB242r`, limit: 1).
- **Verification via Live Ping**: Verify HTTP 200 and `x-vercel-id` on `https://shh-cspdfuacz-musab12.vercel.app`.
- **Requirement**: `readyState === 'READY'`, deployment succeeded without build errors.

### 2. Debug APK & Android Mobile Integrity
- **Target**: `apps/mobile/android`
- **Config Generation**: Run `node scripts/write-mobile-config.mjs` to ensure `apps/mobile/src/config.generated.ts` is up to date.
- **Source & Manifest Integrity**: Confirm `AndroidManifest.xml`, `MainActivity.kt`, `MainApplication.kt`, `ImmersiveModule.kt`, `styles.xml`, and `build.gradle` exist and are valid.
- **Mobile Test Suite**: Run `npm run --workspace haiku-mobile test` (Jest unit and component tests).
- **Gradle Task Check**: If Java runtime is available, run `./gradlew tasks` or `./gradlew assembleDebug` in `apps/mobile/android`.
- **Requirement**: Zero test failures, config generated, Android native modules intact.

### 3. Type Check Suite (Triple Layer)
The sentinel must verify zero TypeScript errors across all 3 monorepo layers:
- **Root & Server**: `npm run typecheck` (`tsc --noEmit`)
- **Shared Contracts**: `npm run --workspace @haiku/contracts typecheck` (`tsc --noEmit` in `packages/contracts`)
- **Mobile React Native**: `npm run --workspace haiku-mobile typecheck` (`tsc --noEmit` in `apps/mobile`)
- **Requirement**: All 3 typechecks must exit with code 0.

---

## Connected Services Architecture

1. **GitHub (`origin/master`)**:
   - Remote: `https://github.com/musabj1917-oss/shh.git`
   - Checks: Uncommitted changes, unpushed commits, remote sync.

2. **Neon Lakebase Postgres**:
   - Host: AWS `us-east-1` serverless endpoint.
   - Script: `npm run db:test` or `npm run migrate`.
   - Checks: Latency, connection health, migration parity (`database/migrations/*.sql`).

3. **Firebase Cloud Messaging (FCM)**:
   - Project ID: `haiku-f758f`
   - Service Account: `firebase-adminsdk-fbsvc@haiku-f758f.iam.gserviceaccount.com`
   - VAPID Key: configured for Web Push service worker (`public/firebase-messaging-sw.js`).

4. **Automated Verification Script**:
   To run the entire multi-service audit in one command:
   ```bash
   npm run verify:services
   ```
