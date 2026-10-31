/**
 * SHH MCP Server — Vercel Serverless Function
 *
 * Deployed at: https://<your-vercel-url>/mcp
 * Add this URL to Claude → Settings → Connectors → Add custom connector
 *
 * Set these env vars in your Vercel project:
 *   SHH_API_URL   — e.g. https://shh-r3j8.vercel.app
 *   MCP_SECRET    — a random string; pass as Bearer token from Claude to authenticate
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const BASE_URL = (process.env.SHH_API_URL ?? "").replace(/\/$/, "");
const SECRET   = process.env.MCP_SECRET ?? "";

// ── HTTP helper ──────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function api(method: Method, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method, headers,
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

function buildServer(userToken?: string) {
  const t = userToken ?? "";
  const s = new McpServer({ name: "shh-api", version: "0.1.0" });

  s.tool("health_check", "Check API health", {},
    async () => ok(await api("GET", "/v1/health")));

  s.tool("auth_login", "Log in — returns a session token to use as Bearer token",
    { email: z.string().email(), password: z.string() },
    async ({ email, password }) => ok(await api("POST", "/v1/auth/login", { email, password })));

  s.tool("auth_register", "Register a new account",
    { email: z.string().email(), password: z.string(), username: z.string(), displayName: z.string(), dateOfBirth: z.string() },
    async (args) => ok(await api("POST", "/v1/auth/register", args)));

  s.tool("auth_logout", "Invalidate current session", {},
    async () => ok(await api("POST", "/v1/auth/logout", undefined, t)));

  s.tool("profile_me", "Get own profile", {},
    async () => ok(await api("GET", "/v1/profile/me", undefined, t)));

  s.tool("profile_update", "Update display name, username or bio",
    { displayName: z.string().optional(), username: z.string().optional(), bio: z.string().optional() },
    async (args) => ok(await api("PATCH", "/v1/profile/me", args, t)));

  s.tool("profile_search", "Search users",
    { q: z.string() },
    async ({ q }) => ok(await api("GET", `/v1/profile/search?q=${encodeURIComponent(q)}`, undefined, t)));

  s.tool("profile_get_by_id", "Get a user's public profile",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await api("GET", `/v1/profile/id/${userId}`, undefined, t)));

  s.tool("friends_list", "List friends", {},
    async () => ok(await api("GET", "/v1/friends", undefined, t)));

  s.tool("friends_requests", "List pending friend requests", {},
    async () => ok(await api("GET", "/v1/friends/requests", undefined, t)));

  s.tool("friends_send_request", "Send a friend request",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await api("POST", `/v1/friends/requests/${userId}`, undefined, t)));

  s.tool("friends_accept_request", "Accept a friend request",
    { requestId: z.string().uuid() },
    async ({ requestId }) => ok(await api("POST", `/v1/friends/requests/${requestId}/accept`, undefined, t)));

  s.tool("friends_reject_request", "Reject a friend request",
    { requestId: z.string().uuid() },
    async ({ requestId }) => ok(await api("POST", `/v1/friends/requests/${requestId}/reject`, undefined, t)));

  s.tool("friends_remove", "Remove a friend",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await api("DELETE", `/v1/friends/${userId}`, undefined, t)));

  s.tool("friends_block", "Block a user",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await api("POST", `/v1/friends/blocks/${userId}`, undefined, t)));

  s.tool("friends_unblock", "Unblock a user",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await api("DELETE", `/v1/friends/blocks/${userId}`, undefined, t)));

  s.tool("conversations_list", "List all conversations", {},
    async () => ok(await api("GET", "/v1/conversations", undefined, t)));

  s.tool("conversations_get", "Get a conversation",
    { conversationId: z.string().uuid() },
    async ({ conversationId }) => ok(await api("GET", `/v1/conversations/${conversationId}`, undefined, t)));

  s.tool("conversations_messages", "List messages in a conversation",
    { conversationId: z.string().uuid(), before: z.string().optional(), limit: z.number().int().min(1).max(50).optional() },
    async ({ conversationId, before, limit }) => {
      const p = new URLSearchParams();
      if (before) p.set("before", before);
      if (limit)  p.set("limit", String(limit));
      return ok(await api("GET", `/v1/conversations/${conversationId}/messages${p.size ? `?${p}` : ""}`, undefined, t));
    });

  s.tool("conversations_send_message", "Send a message",
    { conversationId: z.string().uuid(), body: z.string(), expiresInHours: z.number().optional() },
    async ({ conversationId, ...rest }) => ok(await api("POST", `/v1/conversations/${conversationId}/messages`, rest, t)));

  s.tool("conversations_create_dm", "Start a DM",
    { userId: z.string().uuid() },
    async ({ userId }) => ok(await api("POST", "/v1/conversations", { userId }, t)));

  s.tool("groups_list", "List groups", {},
    async () => ok(await api("GET", "/v1/groups", undefined, t)));

  s.tool("groups_create", "Create a group",
    { name: z.string(), description: z.string().optional() },
    async (args) => ok(await api("POST", "/v1/groups", args, t)));

  s.tool("groups_get", "Get group details",
    { groupId: z.string().uuid() },
    async ({ groupId }) => ok(await api("GET", `/v1/groups/${groupId}`, undefined, t)));

  s.tool("groups_members", "List group members",
    { groupId: z.string().uuid() },
    async ({ groupId }) => ok(await api("GET", `/v1/groups/${groupId}/members`, undefined, t)));

  s.tool("account_change_password", "Change password",
    { currentPassword: z.string(), newPassword: z.string() },
    async (args) => ok(await api("POST", "/v1/account/change-password", args, t)));

  return s;
}

// ── Vercel handler ───────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  // Extract user's SHH token from Authorization header (Bearer <shh-session-token>)
  // If MCP_SECRET is set, the first segment is the gateway secret, second is the SHH token:
  //   Authorization: Bearer <MCP_SECRET>:<SHH_TOKEN>
  const authHeader = req.headers["authorization"] ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  let userToken = bearer;
  if (SECRET) {
    const [secret, ...rest] = bearer.split(":");
    if (secret !== SECRET) { res.status(401).json({ error: "Unauthorized" }); return; }
    userToken = rest.join(":");
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session persistence on serverless
  });

  const mcpServer = buildServer(userToken);
  await mcpServer.connect(transport);
  await transport.handleRequest(req as any, res as any, req.body);
}
