---
description: Access to Vercel via MCP gateway and Composio
globs: *
alwaysApply: true
---

# Vercel Access via MCP (Composio)

- **Vercel is accessible via the MCP gateway**:
  The MCP gateway server (`mcp-gateway` / `mcp`) connects to **Composio** (`composio1`), which contains active integrations for **Vercel** (as well as Firebase, GitHub, Neon, and YouTube).
- **Usage**:
  When performing actions on Vercel (deployments, domain management, environment variables, project settings, Blob, etc.), use the `mcp-gateway` tools (`gateway_call_tool` with server `composio1` / Composio tools).
- **Rule**:
  Never assume or report that there is no Vercel access; always check and execute via Composio on the MCP gateway.
