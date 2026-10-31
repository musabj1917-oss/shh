#!/usr/bin/env node
/**
 * SHH (Haiku Messenger) MCP Server
 *
 * Exposes the local API as MCP tools so Claude Code can inspect data,
 * trigger endpoints, and help debug — all against your running dev server.
 *
 * Usage:
 *   1. Copy .env to the repo root (or set SHH_API_URL + SHH_API_TOKEN env vars)
 *   2. Start the API:  npm run dev:api
 *   3. Claude Code picks this up via .claude/mcp.json (already configured)
 *
 * Auth: set SHH_API_TOKEN to a valid session token obtained from
 *   POST /v1/auth/login  →  response.token
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.SHH_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const TOKEN    = process.env.SHH_API_TOKEN ?? "";

// ── HTTP helper ──────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function call(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

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

// ── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({ name: "shh-api", version: "0.1.0" });

// ── Health ───────────────────────────────────────────────────────────────────

server.tool("health_check",
  "Check API health and service configuration status",
  {},
  async () => ok(await call("GET", "/v1/health")),
);

// ── Auth ─────────────────────────────────────────────────────────────────────

server.tool("auth_login",
  "Log in with email + password. Returns a session token — copy it to SHH_API_TOKEN in .claude/mcp.json.",
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

// ── Profile ──────────────────────────────────────────────────────────────────

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

// ── Friends ──────────────────────────────────────────────────────────────────

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

// ── Conversations ────────────────────────────────────────────────────────────

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

// ── Groups ───────────────────────────────────────────────────────────────────

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

// ── Account ──────────────────────────────────────────────────────────────────

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

// ── Boot ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
