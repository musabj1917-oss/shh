---
name: post-push-sentinel
description: Autonomous verification skill and agent instructions for auditing all connected project services, deployments, database schema, FCM push tokens, and build checks after a git push.
---

# Post-Push Sentinel Skill

This skill guides the agent in conducting a full post-push verification across all connected external and internal services for Haiku Messenger (`musabj1917-oss/shh`).

## When to Use
- Immediately following any `git push` to `origin`.
- When verifying production readiness before or after a deployment.
- When verifying that newly added environment variables or database migrations are in sync across Vercel, Neon, and Firebase.

## Connected Services Architecture

1. **GitHub (`origin/master`)**:
   - Remote: `https://github.com/musabj1917-oss/shh.git`
   - Checks: Uncommitted local changes, sync with remote, commit hash.

2. **Vercel**:
   - Accessible via MCP gateway (`mcp-gateway` -> `composio1`).
   - Project: `shh` (`prj_Ha15kZIMc85SxvHx3XVQI9gB242r`).
   - Checks: Environment variable parity, deployment trigger.

3. **Neon Lakebase Postgres**:
   - Host: AWS `us-east-1` serverless endpoint.
   - Script: `npm run db:test` or `npm run migrate`.
   - Checks: Latency, connection health, migration parity (`database/migrations/*.sql`).

4. **Firebase Cloud Messaging (FCM)**:
   - Project ID: `haiku-f758f`
   - Service Account: `firebase-adminsdk-fbsvc@haiku-f758f.iam.gserviceaccount.com`
   - VAPID Key: configured for Web Push service worker (`public/firebase-messaging-sw.js`).

5. **Local & Mobile Test Suite**:
   - `npm run verify:services` (automated multi-service audit)
   - `npm test` (Hono API test suite)
   - `npm run typecheck` (Root contracts and server)
   - `cd apps/mobile && npx tsc --noEmit` (Expo / React Native type check)

## Verification Runbook
To execute an immediate audit:
```bash
npm run verify:services
```
