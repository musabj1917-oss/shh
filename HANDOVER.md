# SHH Handover — October 31 2026

## What was done in this session

### 1. Vercel build fixed (`apps/api`)
- **Problem:** `npm install --prefix=../..` caused `Tracker "idealTree" already exists` (npm 10 bug — two concurrent installs in a monorepo).
- **Fix:** Changed `installCommand` in `apps/api/vercel.json` to `npm ci --prefix=../..`.
- **Commit:** `2a93bbd`

### 2. MCP server added (`mcp/`)
An MCP server was built and deployed so Claude (and any MCP client) can call the Haiku API as tools.

#### Files added
| File | Purpose |
|---|---|
| `mcp/index.ts` | Vercel serverless function — the MCP server itself |
| `mcp/server.ts` | Local HTTP server (port 3002) for Claude Code / dev |
| `mcp/package.json` | Standalone deps for the `mcp/` Vercel project |
| `mcp/vercel.json` | Vercel config for the MCP project |
| `.claude/mcp.json` | Claude Code auto-discovery config |

#### Tools exposed (30 total)
`health_check` · `auth_login` · `auth_register` · `auth_logout` · `profile_me` · `profile_update` · `profile_search` · `profile_get_by_id` · `profile_settings` · `profile_update_settings` · `friends_list` · `friends_requests` · `friends_send_request` · `friends_accept_request` · `friends_reject_request` · `friends_remove` · `friends_block` · `friends_unblock` · `conversations_list` · `conversations_get` · `conversations_messages` · `conversations_send_message` · `conversations_create_dm` · `groups_list` · `groups_create` · `groups_get` · `groups_update` · `groups_members` · `groups_add_member` · `groups_remove_member`

#### Auth flow
The MCP server accepts a Bearer token in this format:
```
Authorization: Bearer <MCP_SECRET>:<SHH_SESSION_TOKEN>
```
- `MCP_SECRET` — set as a Vercel env var on the `shh-inl5` project
- `SHH_SESSION_TOKEN` — obtained by calling `auth_login` via the MCP server

### 3. MCP Vercel project (`shh-inl5`)
A **separate** Vercel project was created from the same repo with root directory set to `mcp/`.

#### Required Vercel env vars
| Key | Value |
|---|---|
| `SHH_API_URL` | `https://shh-r3j8.vercel.app` |
| `MCP_SECRET` | any long random string |

#### Build fixes applied
1. `npm ci` → failed (no lockfile in `mcp/` dir)
2. `npm install --prefix=../..` → failed (`/vercel/package.json` not found when root dir is `mcp/`)
3. `npm install` (no prefix) → current fix — installs from `mcp/package.json` directly ✅

### 4. Using the MCP server from Claude mobile
Once `shh-inl5` deploys successfully:
1. Open Claude app → Settings → Connectors → Add custom connector
2. Name: `SHH API`
3. URL: `https://shh-inl5.vercel.app/mcp`

---

## Repo structure (relevant parts)
```
shh/
├── apps/
│   ├── api/          # Hono API — deployed to shh-r3j8.vercel.app
│   │   ├── src/routes/   # auth, profile, friends, conversations, groups, etc.
│   │   └── vercel.json   # installCommand: npm ci --prefix=../..
│   ├── admin/        # Admin web app
│   └── mobile/       # React Native app
├── mcp/              # MCP server — deployed to shh-inl5.vercel.app
│   ├── index.ts      # Vercel serverless MCP handler
│   ├── server.ts     # Local HTTP MCP server (port 3002)
│   ├── package.json
│   └── vercel.json
├── packages/
│   └── contracts/    # Shared Zod schemas
├── .claude/
│   └── mcp.json      # Claude Code config → http://localhost:3002/mcp
└── package.json      # npm workspaces root
```

## Known issues / next steps
- `package-lock.json` at root does not include `mcp/` workspace yet — run `npm install` locally and commit the updated lockfile so future deploys can use `npm ci`
- Android CI (`Android debug APK` job) has been failing on `master` separately — unrelated to Vercel
