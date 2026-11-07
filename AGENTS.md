# Agent Guidelines & Integrations

## MCP & Tool Access
- **Vercel Access**:
  - Available through the MCP gateway (`mcp-gateway` / `mcp`).
  - Connected downstream through **Composio** (`composio1`), which contains active integrations for **Vercel**, **Firebase**, **GitHub**, and **Neon**.
  - Execute Vercel workflows (deployments, environment variables, domains, projects) using `mcp-gateway` tools (`gateway_call_tool` / Composio execution tools).

## Subagents
- **`post-push-sentinel`**:
  - Automatically invoked after git pushes or manually via `npm run verify:services`.
  - **Always audits three core pillars after every push**:
    1. **Vercel Build**: Deployment status `READY` on project `shh` via Composio / live deployment check.
    2. **Debug APK & Android**: Mobile config generation, Android manifest/Kotlin sources integrity, and mobile Jest test suite.
    3. **Type Check (Triple Layer)**: Zero errors in Root (`tsc`), `@haiku/contracts` (`tsc`), and Mobile (`tsc`).
  - Also verifies GitHub remote sync, Neon Lakebase Postgres connectivity & migrations, Firebase FCM Admin SDK, and backend test suites.
