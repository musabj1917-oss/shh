#!/usr/bin/env node
/**
 * SHH (Haiku Messenger) MCP Server — HTTP/SSE transport
 *
 * Runs a Streamable HTTP MCP server on :3002/mcp so any MCP client
 * (Claude Desktop, Claude Code, Cursor, etc.) can connect via URL.
 *
 * Setup:
 *   1. npm run dev:api          (API on :3001)
 *   2. npm run dev:mcp          (this server on :3002)
 *   3. Point your MCP client to http://localhost:3002/mcp
 *
 * Auth:
 *   Call auth_login first to get a token, then pass it as the
 *   Authorization header:  Bearer <token>
 *   Or set SHH_API_TOKEN env var to pre-authenticate all tool calls.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

const BASE_URL = (process.env.SHH_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const PORT     = Number(process.env.MCP_PORT ?? 3002);

// ── HTTP helper ──────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function call(
  method: HttpMethod,
  path: string,
  body?: unknown,
  token?: string,
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = token ?? process.env.SHH_API_TOKEN ?? "";
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, body: json };
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// ── Build MCP server ─────────────────────────────────────────────────────────

function buildServer() {
  const server = new McpServer({ name: "shh-api", version: "0.1.0" });

  // ── Health ─────────────────────────────────────────────────────────────────

  server.tool("health_check",
    "Check API health and service configuration status",
    {},
    async () => ok(await call("GET", "/v1/health")),
  );

  // ── Auth ───────────────────────────────────────────────────────────────────

  server.tool("auth_login",
    "Log in with email + password. Returns a session token.",
    { email: z.string().email(), password: z.string() },
    async ({ email, password }) =>
      ok(await call("POST", "/v1/auth/login", { email, password })),
  );

  server.tool("auth_register",
    "Register a new user account",
    {
      email:       z.string().email(),
      password:    z.string(),
      username:    z.string(),
      displayName: z.string(),
      dateOfBirth: z.string().describe("ISO date, e.g. 2000-01-15"),
    },
    async (args) => ok(await call("POST", "/v1/auth/register", args)),
  );

  server.tool("auth_logout",
    "Invalidate the current session token",
    {},
    async () => ok(await call("POST", "/v1/auth/logout")),
  );

  // ── Profile ────────────────────────────────────────────────────────────────

  server.tool("profile_me",
    "Get the authenticated user's own profile",
    {},
    async () => ok(await call("GET", "/v1/profile/me")),
  );

  server.tool("profile_update",
    "Update display name, bio, or username",
    {
      displayName: z.string().optional(),
      username:    z.string().optional(),
      bio:         z.string().optional(),
    },
    async (args) => ok(await call("PATCH", "/v1/profile/me", args)),
  );

  server.tool("profile_search",
    "Search users by username or display name",
    { q: z.string().describe("Search query") },
    async ({ q }) => ok(await call("GET", `/v1/profile/search?q=${encodeURIComponent(q)}`)),
  );

  server.tool("profile_get_by_id",
    "Get a user's public profile by their user ID",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await call("GET", `/v1/profile/id/${userId}`)),
  );

  server.tool("profile_settings",
    "Get current privacy / notification settings",
    {},
    async () => ok(await call("GET", "/v1/profile/settings")),
  );

  server.tool("profile_update_settings",
    "Update privacy or notification settings",
    {
      allowFriendRequests:  z.boolean().optional(),
      allowMessageRequests: z.boolean().optional(),
      showInDiscover:       z.boolean().optional(),
    },
    async (args) => ok(await call("PATCH", "/v1/profile/settings", args)),
  );

  // ── Friends ────────────────────────────────────────────────────────────────

  server.tool("friends_list",
    "List all friends of the authenticated user",
    {},
    async () => ok(await call("GET", "/v1/friends")),
  );

  server.tool("friends_requests",
    "List pending friend requests (incoming + outgoing)",
    {},
    async () => ok(await call("GET", "/v1/friends/requests")),
  );

  server.tool("friends_send_request",
    "Send a friend request to a user",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await call("POST", `/v1/friends/requests/${userId}`)),
  );

  server.tool("friends_accept_request",
    "Accept a pending friend request",
    { requestId: z.string().uuid() },
    async ({ requestId }) => ok(await call("POST", `/v1/friends/requests/${requestId}/accept`)),
  );

  server.tool("friends_reject_request",
    "Reject a pending friend request",
    { requestId: z.string().uuid() },
    async ({ requestId }) => ok(await call("POST", `/v1/friends/requests/${requestId}/reject`)),
  );

  server.tool("friends_remove",
    "Remove a friend",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await call("DELETE", `/v1/friends/${userId}`)),
  );

  server.tool("friends_blocks_list",
    "List blocked users",
    {},
    async () => ok(await call("GET", "/v1/friends/blocks")),
  );

  server.tool("friends_block",
    "Block a user",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await call("POST", `/v1/friends/blocks/${userId}`)),
  );

  server.tool("friends_unblock",
    "Unblock a user",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await call("DELETE", `/v1/friends/blocks/${userId}`)),
  );

  // ── Conversations ──────────────────────────────────────────────────────────

  server.tool("conversations_list",
    "List all conversations (DMs + groups) for the authenticated user",
    {},
    async () => ok(await call("GET", "/v1/conversations")),
  );

  server.tool("conversations_get",
    "Get a single conversation by ID",
    { conversationId: z.string().uuid() },
    async ({ conversationId }) => ok(await call("GET", `/v1/conversations/${conversationId}`)),
  );

  server.tool("conversations_messages",
    "List messages in a conversation",
    {
      conversationId: z.string().uuid(),
      before:         z.string().optional().describe("Cursor: message ID to paginate before"),
      limit:          z.number().int().min(1).max(50).optional(),
    },
    async ({ conversationId, before, limit }) => {
      const params = new URLSearchParams();
      if (before) params.set("before", before);
      if (limit)  params.set("limit",  String(limit));
      const qs = params.size ? `?${params}` : "";
      return ok(await call("GET", `/v1/conversations/${conversationId}/messages${qs}`));
    },
  );

  server.tool("conversations_send_message",
    "Send a message to a conversation",
    {
      conversationId: z.string().uuid(),
      body:           z.string().describe("Message text"),
      expiresInHours: z.number().optional().describe("Self-destruct after N hours"),
    },
    async ({ conversationId, body, expiresInHours }) =>
      ok(await call("POST", `/v1/conversations/${conversationId}/messages`, { body, expiresInHours })),
  );

  server.tool("conversations_create_dm",
    "Start a DM conversation with another user",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await call("POST", "/v1/conversations", { userId })),
  );

  // ── Groups ─────────────────────────────────────────────────────────────────

  server.tool("groups_list",
    "List all groups the authenticated user belongs to",
    {},
    async () => ok(await call("GET", "/v1/groups")),
  );

  server.tool("groups_create",
    "Create a new group",
    { name: z.string(), description: z.string().optional() },
    async (args) => ok(await call("POST", "/v1/groups", args)),
  );

  server.tool("groups_get",
    "Get group details",
    { groupId: z.string().uuid() },
    async ({ groupId }) => ok(await call("GET", `/v1/groups/${groupId}`)),
  );

  server.tool("groups_update",
    "Update group name or description (admin only)",
    {
      groupId:     z.string().uuid(),
      name:        z.string().optional(),
      description: z.string().optional(),
    },
    async ({ groupId, ...body }) => ok(await call("PATCH", `/v1/groups/${groupId}`, body)),
  );

  server.tool("groups_members",
    "List members of a group",
    { groupId: z.string().uuid() },
    async ({ groupId }) => ok(await call("GET", `/v1/groups/${groupId}/members`)),
  );

  server.tool("groups_add_member",
    "Add a member to a group (admin only)",
    { groupId: z.string().uuid(), userId: z.string().uuid() },
    async ({ groupId, userId }) =>
      ok(await call("POST", `/v1/groups/${groupId}/members`, { userId })),
  );

  server.tool("groups_remove_member",
    "Remove a member from a group",
    { groupId: z.string().uuid(), memberId: z.string().uuid() },
    async ({ groupId, memberId }) =>
      ok(await call("DELETE", `/v1/groups/${groupId}/members/${memberId}`)),
  );

  // ── Account ────────────────────────────────────────────────────────────────

  server.tool("account_change_password",
    "Change the authenticated user's password",
    { currentPassword: z.string(), newPassword: z.string() },
    async (args) => ok(await call("POST", "/v1/account/change-password", args)),
  );

  server.tool("account_delete",
    "Request account deletion (starts grace period)",
    { password: z.string() },
    async (args) => ok(await call("POST", "/v1/account/delete", args)),
  );

  return server;
}

// ── HTTP server ──────────────────────────────────────────────────────────────
// One McpServer + transport per session (stateful Streamable HTTP).

const sessions = new Map<string, StreamableHTTPServerTransport>();

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // CORS pre-flight
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. MCP endpoint is POST /mcp" }));
    return;
  }

  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (req.method === "POST") {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && sessions.has(sessionId)) {
        transport = sessions.get(sessionId)!;
      } else {
        // New session
        transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
        const mcpServer = buildServer();
        await mcpServer.connect(transport);
        sessions.set(transport.sessionId!, transport);
        transport.onclose = () => sessions.delete(transport.sessionId!);
      }

      const body = await readBody(req);
      await transport.handleRequest(req, res, JSON.parse(body.toString()));
      return;
    }

    if (req.method === "GET") {
      // SSE stream for server-sent notifications
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing or unknown Mcp-Session-Id" }));
        return;
      }
      await sessions.get(sessionId)!.handleRequest(req, res);
      return;
    }

    if (req.method === "DELETE") {
      if (sessionId) sessions.delete(sessionId);
      res.writeHead(204); res.end();
      return;
    }

    res.writeHead(405); res.end();
  } catch (err) {
    console.error("[mcp]", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
});

http.listen(PORT, () => {
  console.log(`[mcp] SHH MCP server listening on http://localhost:${PORT}/mcp`);
  console.log(`[mcp] API base: ${BASE_URL}`);
});
