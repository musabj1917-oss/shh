# Agent Guidelines & Integrations

## MCP & Tool Access
- **Vercel Access**:
  - Available through the MCP gateway (`mcp-gateway` / `mcp`).
  - Connected downstream through **Composio** (`composio1`), which contains active integrations for **Vercel**, **Firebase**, **GitHub**, and **Neon**.
  - Execute Vercel workflows (deployments, environment variables, domains, projects) using `mcp-gateway` tools (`gateway_call_tool` / Composio execution tools).

## Subagents
- **`post-push-sentinel`**:
  - Automatically invoked after git pushes or manually via `npm run verify:services`.
  - Verifies all connected services: GitHub repository sync, Vercel deployments & env vars, Neon Postgres connectivity & migrations, Firebase FCM Admin SDK, test suites, and mobile React Native compilation.
