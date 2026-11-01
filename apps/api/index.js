// src/app.ts
import { Hono as Hono14 } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit as bodyLimit2 } from "hono/body-limit";

// src/routes/auth.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { Hono } from "hono";
import { OAuth2Client } from "google-auth-library";
import { z as z2 } from "zod";

// src/contracts.ts
import { z } from "zod";
var isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter date of birth in YYYY-MM-DD format (e.g. 2000-12-01).").refine((value) => {
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a real date in YYYY-MM-DD format.");
function meetsMinimumAge(dateOfBirth, now = /* @__PURE__ */ new Date(), minimumAge = 13) {
  const birth = /* @__PURE__ */ new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== dateOfBirth) return false;
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - minimumAge, now.getUTCMonth(), now.getUTCDate()));
  return birth.getTime() <= cutoff.getTime();
}
var usernameSchema = z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9_]+$/, "Use 3\u201324 letters, numbers, or underscores.");
var emailSchema = z.string().trim().toLowerCase().email().max(254);
var passwordSchema = z.string().min(12).max(128);
var registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(60),
  dateOfBirth: isoDate
}).strict();
var loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
var googleRegisterSchema = z.object({
  idToken: z.string().min(20).max(8192),
  dateOfBirth: isoDate.optional(),
  username: usernameSchema.optional(),
  displayName: z.string().trim().min(1).max(60).optional()
}).strict();
var profilePatchSchema = z.object({
  username: usernameSchema.optional(),
  displayName: z.string().trim().min(1).max(60).optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  location: z.string().trim().max(80).nullable().optional(),
  birthdayMonth: z.number().int().min(1).max(12).nullable().optional(),
  birthdayDay: z.number().int().min(1).max(31).nullable().optional(),
  avatarAttachmentId: z.string().uuid().nullable().optional()
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one profile change.").refine((value) => value.birthdayMonth === void 0 === (value.birthdayDay === void 0), "Update the birthday month and day together.").refine((value) => {
  if (value.birthdayMonth == null || value.birthdayDay == null) return true;
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return value.birthdayDay <= daysInMonth[value.birthdayMonth - 1];
}, "That birthday is not a valid calendar date.");
var sendMessageSchema = z.object({
  text: z.string().trim().min(1).max(4e3).optional(),
  attachmentId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
  expiresInHours: z.union([z.literal(1), z.literal(24), z.literal(168)]).nullable().optional()
}).strict().refine((value) => Boolean(value.text || value.attachmentId), "A message needs text or an attachment.");
var groupCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  memberIds: z.array(z.string().uuid()).max(99).default([])
}).strict();
var storyCreateSchema = z.object({
  attachmentId: z.string().uuid(),
  caption: z.string().trim().max(280).optional(),
  mediaType: z.enum(["image", "video"])
}).strict();
var reportSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  category: z.enum(["harassment", "spam", "impersonation", "unsafe_content", "other"]),
  reason: z.string().trim().max(2e3).optional(),
  evidenceAttachmentId: z.string().uuid().optional()
}).strict().refine((value) => Boolean(value.targetUserId || value.groupId || value.messageId), "Select something to report.");
var messageKindSchema = z.enum(["text", "image", "video", "voice"]);

// src/db.ts
import { neon } from "@neondatabase/serverless";
var cached;
function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("CONFIG_DATABASE_URL_MISSING");
  if (!cached) cached = neon(connectionString);
  return cached;
}
function dbReady() {
  return Boolean(process.env.DATABASE_URL);
}

// src/http.ts
function jsonError(c, status, code, message, details) {
  return c.json({ error: { code, message, ...details === void 0 ? {} : { details } } }, status);
}
async function parseJson(c, schema) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return { response: jsonError(c, 400, "INVALID_JSON", "Request body must be valid JSON.") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return { response: jsonError(c, 422, "VALIDATION_ERROR", "Check the submitted fields.", result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))) };
  }
  return { data: result.data };
}
function errorCode(error) {
  const value = error;
  return value?.code || value?.message;
}

// src/security.ts
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
var SCRYPT_N = 32768;
var SCRYPT_R = 8;
var SCRYPT_P = 1;
var SCRYPT_BYTES = 64;
function derive(password, salt, length, options) {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, key) => error ? reject(error) : resolve(key));
  });
}
function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await derive(password, salt, SCRYPT_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}
async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [algorithm, nText, rText, pText, saltText, hashText] = stored.split("$");
  if (algorithm !== "scrypt" || !nText || !rText || !pText || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  try {
    const actual = await derive(password, Buffer.from(saltText, "base64url"), expected.length, {
      N: Number(nText),
      r: Number(rText),
      p: Number(pText),
      maxmem: 64 * 1024 * 1024
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

// src/services/session.ts
import { randomUUID } from "node:crypto";

// src/config.ts
function envInt(name, fallback, min, max) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
function isProduction() {
  return process.env.NODE_ENV === "production";
}

// src/services/session.ts
async function createSession(userId, userAgent) {
  const token = createOpaqueToken(32);
  const days = envInt("SESSION_TTL_DAYS", 30, 1, 60);
  await getDb()`
    INSERT INTO sessions (id, user_id, token_hash, user_agent, expires_at)
    VALUES (${randomUUID()}, ${userId}, ${sha256(token)}, ${userAgent?.slice(0, 200) || null}, now() + (${days} * interval '1 day'))`;
  return { token, expiresInSeconds: days * 86400 };
}

// src/services/email.ts
import nodemailer from "nodemailer";
function buildVerificationLink(token) {
  const base = process.env.API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";
  return `${base}/v1/auth/verify-email?token=${encodeURIComponent(token)}`;
}
async function sendVerificationEmail(email, token) {
  const link = buildVerificationLink(token);
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV !== "production" && process.env.DEV_EMAIL_ECHO === "true") {
      console.info(`[dev email] verification for ${email}: ${link}`);
      return { delivered: false, developmentLink: link };
    }
    throw new Error("CONFIG_SMTP_MISSING");
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : void 0
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || "Haiku Messenger <no-reply@example.invalid>",
    to: email,
    subject: "Verify your Haiku Messenger email",
    text: `Verify your email within 30 minutes: ${link}
If you did not create this account, ignore this message.`
  });
  return { delivered: true };
}
async function sendPasswordResetEmail(email, token) {
  const base = process.env.ADMIN_WEB_URL?.replace(/\/$/, "") || "https://admin-musab12.vercel.app";
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV !== "production" && process.env.DEV_EMAIL_ECHO === "true") {
      console.info(`[dev email] password reset for ${email}: ${link}`);
      return { delivered: false, developmentLink: link };
    }
    throw new Error("CONFIG_SMTP_MISSING");
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : void 0 });
  await transport.sendMail({ from: process.env.SMTP_FROM || "Haiku Messenger <no-reply@example.invalid>", to: email, subject: "Reset your Haiku Messenger password", text: `Reset your password within 30 minutes: ${link}
If you did not request this, ignore this message.` });
  return { delivered: true };
}

// src/services/firebase.ts
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
var isInitialized = false;
function initFirebaseAdmin() {
  if (isInitialized) return true;
  if (getApps().length > 0) {
    isInitialized = true;
    return true;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      isInitialized = true;
      console.log("[Firebase] Admin SDK initialized successfully.");
      return true;
    } catch (err) {
      console.error("[Firebase] Failed to initialize Firebase Admin SDK:", err);
      return false;
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      initializeApp({
        credential: applicationDefault()
      });
      isInitialized = true;
      console.log("[Firebase] Admin SDK initialized via applicationDefault().");
      return true;
    } catch (err) {
      console.error("[Firebase] Failed applicationDefault init:", err);
      return false;
    }
  }
  return false;
}
async function verifyFirebaseToken(idToken) {
  if (!initFirebaseAdmin()) {
    console.warn("[Firebase] ID token verification skipped: Firebase credentials not configured in env.");
    return null;
  }
  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified,
      displayName: decoded.name
    };
  } catch (err) {
    console.error("[Firebase] ID token verification failed:", err);
    return null;
  }
}

// src/middleware/auth.ts
import { createMiddleware } from "hono/factory";
var requireUser = createMiddleware(async (c, next) => {
  const authorization = c.req.header("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 512) return jsonError(c, 401, "AUTH_REQUIRED", "Sign in to continue.");
  try {
    const rows = await getDb()`
      SELECT u.id, u.email, u.email_verified_at, u.status, p.username, p.display_name
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      JOIN user_profiles p ON p.user_id = u.id
      WHERE s.token_hash = ${sha256(token)}
        AND s.revoked_at IS NULL AND s.expires_at > now()
        AND u.status = 'active' AND u.deleted_at IS NULL
      LIMIT 1`;
    if (!rows.length) return jsonError(c, 401, "SESSION_INVALID", "Your session expired. Sign in again.");
    const row = rows[0];
    if (!row.email_verified_at) return jsonError(c, 403, "EMAIL_UNVERIFIED", "Verify your email before using Haiku Messenger.");
    c.set("user", {
      id: String(row.id),
      email: String(row.email),
      emailVerifiedAt: String(row.email_verified_at),
      username: String(row.username),
      displayName: String(row.display_name),
      accountStatus: "active"
    });
    await next();
  } catch (error) {
    console.error("auth middleware failed", safeErrorName(error));
    return jsonError(c, 503, "AUTH_TEMPORARILY_UNAVAILABLE", "Authentication is temporarily unavailable.");
  }
});
function safeErrorName(error) {
  return error instanceof Error ? error.name : "UnknownError";
}

// src/middleware/rate-limit.ts
async function enforceRateLimit(c, bucket, limit, windowSeconds) {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${bucket}:${sha256(ip)}`.slice(0, 240);
  try {
    const rows = await getDb()`INSERT INTO rate_limit_buckets (bucket_key,window_started_at,hit_count)
      VALUES (${key},now(),1)
      ON CONFLICT(bucket_key) DO UPDATE SET
        hit_count=CASE WHEN rate_limit_buckets.window_started_at <= now()-(${windowSeconds}*interval '1 second') THEN 1 ELSE rate_limit_buckets.hit_count+1 END,
        window_started_at=CASE WHEN rate_limit_buckets.window_started_at <= now()-(${windowSeconds}*interval '1 second') THEN now() ELSE rate_limit_buckets.window_started_at END
      RETURNING hit_count,window_started_at`;
    const row = rows[0];
    if (Number(row.hit_count) > limit) {
      const startedAt = new Date(row.window_started_at).getTime();
      const retryAfter = Math.max(1, windowSeconds - Math.floor((Date.now() - startedAt) / 1e3));
      c.header("Retry-After", String(retryAfter));
      return jsonError(c, 429, "RATE_LIMITED", "Too many requests. Please try again shortly.");
    }
    return null;
  } catch {
    return jsonError(c, 503, "RATE_LIMIT_UNAVAILABLE", "Please retry shortly.");
  }
}

// src/routes/auth.ts
var authRoutes = new Hono();
var googleClient = new OAuth2Client();
var safeName = (error) => error instanceof Error ? error.name : "UnknownError";
async function createVerification(userId, email) {
  const token = createOpaqueToken();
  await getDb()`INSERT INTO email_verification_tokens(id,user_id,token_hash,expires_at) VALUES (${randomUUID2()},${userId},${sha256(token)},now()+interval '30 minutes')`;
  return sendVerificationEmail(email, token);
}
async function profileFor(userId) {
  const rows = await getDb()`SELECT u.id,u.email,u.email_verified_at,p.username,p.display_name FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=${userId} AND u.deleted_at IS NULL LIMIT 1`;
  return rows[0] || null;
}
function publicUser(row) {
  return { id: String(row.id), email: String(row.email), emailVerified: Boolean(row.email_verified_at), username: String(row.username), displayName: String(row.display_name) };
}
authRoutes.post("/register", async (c) => {
  const limited = await enforceRateLimit(c, "register", 5, 3600);
  if (limited) return limited;
  const parsed = await parseJson(c, registerSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;
  if (!meetsMinimumAge(input.dateOfBirth)) return jsonError(c, 422, "AGE_REQUIREMENT", "You must be at least 13 years old to create an account.");
  if (process.env.NODE_ENV === "production" && !process.env.SMTP_HOST) return jsonError(c, 503, "CONFIG_EMAIL_MISSING", "Email verification is not configured yet.");
  const id = randomUUID2(), passwordHash = await hashPassword(input.password);
  try {
    await getDb().transaction([
      getDb()`INSERT INTO users(id,email,password_hash,date_of_birth,status) VALUES (${id},${input.email},${passwordHash},${input.dateOfBirth},'active')`,
      getDb()`INSERT INTO user_profiles(user_id,username,display_name) VALUES (${id},${input.username},${input.displayName})`
    ]);
  } catch (error) {
    if (errorCode(error) === "23505") return jsonError(c, 409, "ACCOUNT_CONFLICT", "That email or username is already in use.");
    console.error("registration failed", safeName(error));
    return jsonError(c, 503, "REGISTRATION_UNAVAILABLE", "Account creation is temporarily unavailable.");
  }
  try {
    const verification = await createVerification(id, input.email);
    return c.json({ user: { id, email: input.email, username: input.username, displayName: input.displayName, emailVerified: false }, verification: verification.delivered ? { status: "sent" } : { status: "development-only", link: verification.developmentLink }, message: "Verify your email before signing in." }, 201);
  } catch (error) {
    if (errorCode(error) === "CONFIG_SMTP_MISSING") return jsonError(c, 503, "CONFIG_EMAIL_MISSING", "The account was created but email delivery is not configured. Set up SMTP, then request another verification email.");
    console.error("verification delivery failed", safeName(error));
    return jsonError(c, 503, "VERIFICATION_EMAIL_FAILED", "The account was created but verification email delivery failed. You can request another verification email.");
  }
});
authRoutes.post("/resend-verification", async (c) => {
  const limited = await enforceRateLimit(c, "resend-verification", 5, 3600);
  if (limited) return limited;
  const parsed = await parseJson(c, emailSchema);
  if ("response" in parsed) return parsed.response;
  if (process.env.NODE_ENV === "production" && !process.env.SMTP_HOST) return jsonError(c, 503, "CONFIG_EMAIL_MISSING", "Email verification is not configured.");
  const rows = await getDb()`SELECT id,email FROM users WHERE email=${parsed.data} AND email_verified_at IS NULL AND status='active' AND deleted_at IS NULL LIMIT 1`;
  if (rows.length) {
    const user = rows[0];
    try {
      await createVerification(user.id, user.email);
    } catch (error) {
      if (errorCode(error) === "CONFIG_SMTP_MISSING") return jsonError(c, 503, "CONFIG_EMAIL_MISSING", "Email delivery is not configured.");
      return jsonError(c, 503, "EMAIL_SEND_FAILED", "Verification email could not be sent.");
    }
  }
  return c.json({ message: "If the account needs verification, instructions will be sent." });
});
authRoutes.post("/login", async (c) => {
  const limited = await enforceRateLimit(c, "login", 10, 900);
  if (limited) return limited;
  const parsed = await parseJson(c, loginSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;
  try {
    const rows = await getDb()`SELECT u.id,u.email,u.email_verified_at,u.password_hash,u.status,p.username,p.display_name
      FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.email=${input.email} AND u.deleted_at IS NULL LIMIT 1`;
    const row = rows[0];
    if (!row || row.status !== "active" || !await verifyPassword(input.password, row.password_hash)) return jsonError(c, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    if (!row.email_verified_at) return jsonError(c, 403, "EMAIL_UNVERIFIED", "Verify your email before signing in.");
    const session = await createSession(String(row.id), c.req.header("user-agent"));
    return c.json({ accessToken: session.token, tokenType: "Bearer", expiresIn: session.expiresInSeconds, user: publicUser(row) });
  } catch (error) {
    console.error("login failed", safeName(error));
    return jsonError(c, 503, "LOGIN_UNAVAILABLE", "Sign-in is temporarily unavailable.");
  }
});
authRoutes.post("/google", async (c) => {
  const limited = await enforceRateLimit(c, "google-login", 10, 900);
  if (limited) return limited;
  const parsed = await parseJson(c, googleRegisterSchema);
  if ("response" in parsed) return parsed.response;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return jsonError(c, 503, "CONFIG_GOOGLE_MISSING", "Google sign-in is not configured.");
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: parsed.data.idToken, audience: clientId });
    const identity = ticket.getPayload();
    if (!identity?.sub || !identity.email || identity.email_verified !== true) return jsonError(c, 401, "GOOGLE_IDENTITY_INVALID", "Google could not verify this identity.");
    const email = identity.email.toLowerCase();
    let rows = await getDb()`SELECT u.id,u.email,u.email_verified_at,u.status,p.username,p.display_name
      FROM auth_identities i JOIN users u ON u.id=i.user_id JOIN user_profiles p ON p.user_id=u.id
      WHERE i.provider='google' AND i.provider_subject=${identity.sub} AND u.deleted_at IS NULL LIMIT 1`;
    let row = rows[0];
    if (!row) {
      rows = await getDb()`SELECT u.id,u.email,u.email_verified_at,u.status,p.username,p.display_name FROM users u JOIN user_profiles p ON p.user_id=u.id
        WHERE u.email=${email} AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL LIMIT 1`;
      if (rows.length) {
        row = rows[0];
        if (row.status !== "active") return jsonError(c, 403, "ACCOUNT_UNAVAILABLE", "This account cannot sign in.");
        await getDb()`INSERT INTO auth_identities(id,user_id,provider,provider_subject,provider_email) VALUES (${randomUUID2()},${String(row.id)},'google',${identity.sub},${email}) ON CONFLICT(provider,provider_subject) DO NOTHING`;
      } else {
        if (!parsed.data.dateOfBirth || !parsed.data.username) return c.json({ registrationRequired: true, verifiedEmail: email, displayName: identity.name || "", message: "Submit this verified token again with a date of birth and username." });
        if (!meetsMinimumAge(parsed.data.dateOfBirth)) return jsonError(c, 422, "AGE_REQUIREMENT", "You must be at least 13 years old to create an account.");
        const id = randomUUID2();
        await getDb().transaction([
          getDb()`INSERT INTO users(id,email,email_verified_at,date_of_birth,status) VALUES (${id},${email},now(),${parsed.data.dateOfBirth},'active')`,
          getDb()`INSERT INTO user_profiles(user_id,username,display_name) VALUES (${id},${parsed.data.username},${parsed.data.displayName || identity.name || parsed.data.username})`,
          getDb()`INSERT INTO auth_identities(id,user_id,provider,provider_subject,provider_email) VALUES (${randomUUID2()},${id},'google',${identity.sub},${email})`
        ]);
        row = await profileFor(id);
      }
    }
    if (!row || row.status !== "active") return jsonError(c, 403, "ACCOUNT_UNAVAILABLE", "This account cannot sign in.");
    const session = await createSession(String(row.id), c.req.header("user-agent"));
    return c.json({ accessToken: session.token, tokenType: "Bearer", expiresIn: session.expiresInSeconds, user: publicUser(row) });
  } catch (error) {
    if (errorCode(error) === "23505") return jsonError(c, 409, "ACCOUNT_CONFLICT", "This Google account is already linked to another user.");
    if (errorCode(error) === "CONFIG_GOOGLE_MISSING") return jsonError(c, 503, "CONFIG_GOOGLE_MISSING", "Google sign-in is not configured.");
    console.error("Google identity verification failed", safeName(error));
    return jsonError(c, 401, "GOOGLE_IDENTITY_INVALID", "Google identity verification failed.");
  }
});
authRoutes.get("/firebase/config", async (c) => {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    return c.json({ configured: false });
  }
  return c.json({
    configured: true,
    apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  });
});
authRoutes.post("/firebase", async (c) => {
  const limited = await enforceRateLimit(c, "firebase-auth", 10, 3600);
  if (limited) return limited;
  const body = await c.req.json().catch(() => null);
  const idToken = body?.idToken;
  if (!idToken || typeof idToken !== "string") {
    return jsonError(c, 400, "TOKEN_MISSING", "Firebase ID token is required.");
  }
  const verified = await verifyFirebaseToken(idToken);
  if (!verified) {
    return jsonError(c, 401, "FIREBASE_TOKEN_INVALID", "Firebase authentication could not be verified.");
  }
  const email = verified.email ? verified.email.trim().toLowerCase() : null;
  if (!email) {
    return jsonError(c, 422, "EMAIL_MISSING", "Firebase account must have an associated email address.");
  }
  try {
    const existingIdentity = await getDb()`SELECT user_id FROM auth_identities WHERE provider='firebase' AND provider_subject=${verified.uid} LIMIT 1`;
    let userId;
    if (existingIdentity.length) {
      userId = String(existingIdentity[0].user_id);
    } else {
      const existingUser = await getDb()`SELECT id FROM users WHERE email=${email} LIMIT 1`;
      if (existingUser.length) {
        userId = String(existingUser[0].id);
        await getDb()`INSERT INTO auth_identities(id,user_id,provider,provider_subject,provider_email) VALUES (${randomUUID2()},${userId},'firebase',${verified.uid},${email})`;
      } else {
        const dob = body?.dateOfBirth || "2000-01-01";
        const baseName = (verified.displayName || email.split("@")[0]).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";
        const username = body?.username || `${baseName}_${randomUUID2().slice(0, 4)}`;
        userId = randomUUID2();
        await getDb().transaction([
          getDb()`INSERT INTO users(id,email,email_verified_at,date_of_birth,status) VALUES (${userId},${email},now(),${dob},'active')`,
          getDb()`INSERT INTO user_profiles(user_id,username,display_name) VALUES (${userId},${username},${verified.displayName || username})`,
          getDb()`INSERT INTO auth_identities(id,user_id,provider,provider_subject,provider_email) VALUES (${randomUUID2()},${userId},'firebase',${verified.uid},${email})`
        ]);
      }
    }
    const row = await profileFor(userId);
    if (!row || row.status === "suspended" || row.status === "deleted") {
      return jsonError(c, 403, "ACCOUNT_UNAVAILABLE", "This account cannot sign in.");
    }
    const session = await createSession(userId, c.req.header("user-agent"));
    return c.json({ accessToken: session.token, tokenType: "Bearer", expiresIn: session.expiresInSeconds, user: publicUser(row) });
  } catch (err) {
    console.error("Firebase sign-in error:", err);
    return jsonError(c, 500, "FIREBASE_SIGNIN_FAILED", "Could not complete Firebase sign-in.");
  }
});
authRoutes.get("/verify-email", async (c) => {
  const token = c.req.query("token") || "";
  if (token.length < 20 || token.length > 256) return jsonError(c, 400, "TOKEN_INVALID", "This verification link is invalid or expired.");
  const rows = await getDb()`WITH used AS (
      UPDATE email_verification_tokens SET used_at=now() WHERE token_hash=${sha256(token)} AND used_at IS NULL AND expires_at>now() RETURNING user_id
    ), verified AS (
      UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()),updated_at=now() WHERE id IN (SELECT user_id FROM used) RETURNING id
    ) SELECT id FROM verified`;
  if (!rows.length) return jsonError(c, 400, "TOKEN_INVALID", "This verification link is invalid or expired.");
  return c.html('<!doctype html><meta name="viewport" content="width=device-width"><title>Email verified</title><main style="font:16px system-ui;max-width:32rem;margin:15vh auto;padding:24px;color:#20352f"><h1>Email verified</h1><p>Your Haiku Messenger account is ready. Return to the app and sign in.</p></main>');
});
authRoutes.post("/forgot-password", async (c) => {
  const limited = await enforceRateLimit(c, "forgot-password", 5, 3600);
  if (limited) return limited;
  const parsed = await parseJson(c, emailSchema);
  if ("response" in parsed) return parsed.response;
  if (process.env.NODE_ENV === "production" && !process.env.SMTP_HOST) return jsonError(c, 503, "CONFIG_EMAIL_MISSING", "Password recovery email is not configured.");
  try {
    const rows = await getDb()`SELECT id,email FROM users WHERE email=${parsed.data} AND status='active' AND deleted_at IS NULL LIMIT 1`;
    if (rows.length) {
      const user = rows[0], token = createOpaqueToken();
      await getDb()`INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) VALUES (${randomUUID2()},${user.id},${sha256(token)},now()+interval '30 minutes')`;
      await sendPasswordResetEmail(user.email, token);
    }
    return c.json({ message: "If an eligible account exists, recovery instructions will be sent." });
  } catch (error) {
    if (errorCode(error) === "CONFIG_SMTP_MISSING") return jsonError(c, 503, "CONFIG_EMAIL_MISSING", "Password recovery email is not configured.");
    console.error("password recovery failed", safeName(error));
    return jsonError(c, 503, "RECOVERY_UNAVAILABLE", "Password recovery is temporarily unavailable.");
  }
});
authRoutes.post("/reset-password", async (c) => {
  const parsed = await parseJson(c, z2.object({ token: z2.string().min(20).max(256), password: passwordSchema }).strict());
  if ("response" in parsed) return parsed.response;
  const newHash = await hashPassword(parsed.data.password);
  const rows = await getDb()`WITH token AS (
      UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=${sha256(parsed.data.token)} AND used_at IS NULL AND expires_at>now() RETURNING user_id
    ), changed AS (
      UPDATE users SET password_hash=${newHash},updated_at=now() WHERE id IN (SELECT user_id FROM token) RETURNING id
    ), revoked AS (
      UPDATE sessions SET revoked_at=now() WHERE user_id IN (SELECT id FROM changed) AND revoked_at IS NULL RETURNING id
    ) SELECT id FROM changed`;
  if (!rows.length) return jsonError(c, 400, "TOKEN_INVALID", "This password reset link is invalid or expired.");
  return c.json({ message: "Password changed. Sign in again on your devices." });
});
authRoutes.post("/change-password", requireUser, async (c) => {
  const user = c.get("user");
  const parsed = await parseJson(c, z2.object({ currentPassword: z2.string().min(1).max(256), newPassword: passwordSchema }).strict());
  if ("response" in parsed) return parsed.response;
  const rows = await getDb()`SELECT password_hash FROM users WHERE id=${user.id} AND status='active' AND deleted_at IS NULL LIMIT 1`;
  const passwordHash = rows[0]?.password_hash;
  if (!passwordHash) return jsonError(c, 409, "PASSWORD_RESET_REQUIRED", "This account has no password set. Use email recovery to establish one.");
  if (!await verifyPassword(parsed.data.currentPassword, passwordHash)) return jsonError(c, 403, "CURRENT_PASSWORD_INVALID", "Your current password is incorrect.");
  const nextHash = await hashPassword(parsed.data.newPassword), token = (c.req.header("authorization") || "").slice(7).trim();
  await getDb().transaction([
    getDb()`UPDATE users SET password_hash=${nextHash},updated_at=now() WHERE id=${user.id}`,
    getDb()`UPDATE sessions SET revoked_at=now() WHERE user_id=${user.id} AND token_hash<>${sha256(token)} AND revoked_at IS NULL`
  ]);
  return c.json({ message: "Password updated. Other sessions have been signed out." });
});
authRoutes.get("/me", requireUser, async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT p.bio,p.location,p.birthday_month,p.birthday_day,p.avatar_object_key,u.created_at,u.status,
      us.presence_visible,us.read_receipts_enabled,us.typing_indicators_enabled
    FROM users u JOIN user_profiles p ON p.user_id=u.id LEFT JOIN user_settings us ON us.user_id=u.id WHERE u.id=${user.id} LIMIT 1`;
  return c.json({ user, profile: rows[0] || null });
});
authRoutes.post("/logout", requireUser, async (c) => {
  const token = (c.req.header("authorization") || "").slice(7).trim();
  await getDb()`UPDATE sessions SET revoked_at=now() WHERE token_hash=${sha256(token)} AND revoked_at IS NULL`;
  return c.json({ message: "Signed out." });
});
authRoutes.post("/logout-all", requireUser, async (c) => {
  const user = c.get("user");
  await getDb()`UPDATE sessions SET revoked_at=now() WHERE user_id=${user.id} AND revoked_at IS NULL`;
  return c.json({ message: "All sessions were signed out." });
});

// src/routes/profile.ts
import { Hono as Hono2 } from "hono";
import { z as z3 } from "zod";
var profileRoutes = new Hono2();
profileRoutes.use("*", requireUser);
profileRoutes.get("/me", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT u.id,u.email,p.username,p.display_name,p.bio,p.location,p.avatar_object_key,p.username_changed_at,u.created_at
    FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=${user.id} LIMIT 1`;
  return c.json({ profile: rows[0] || null });
});
profileRoutes.patch("/me", async (c) => {
  const user = c.get("user");
  const parsed = await parseJson(c, profilePatchSchema);
  if ("response" in parsed) return parsed.response;
  const patch = parsed.data;
  if (patch.username && patch.username !== user.username) {
    const rows = await getDb()`SELECT username_changed_at FROM user_profiles WHERE user_id=${user.id} LIMIT 1`;
    const changedAt = rows[0]?.username_changed_at;
    if (changedAt && Date.now() - new Date(changedAt).getTime() < 30 * 864e5) {
      return jsonError(c, 409, "USERNAME_CHANGE_COOLDOWN", "You can change your username once every 30 days.", { availableAt: new Date(new Date(changedAt).getTime() + 30 * 864e5).toISOString() });
    }
  }
  let avatarKey = null;
  if (patch.avatarAttachmentId) {
    const rows = await getDb()`SELECT object_key,status,purpose,expires_at FROM attachments WHERE id=${patch.avatarAttachmentId} AND owner_id=${user.id} LIMIT 1`;
    const item = rows[0];
    if (!item || item.status !== "ready" || item.purpose !== "avatar" || item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) return jsonError(c, 422, "AVATAR_ATTACHMENT_INVALID", "Choose an uploaded profile image that is still available.");
    avatarKey = item.object_key;
  }
  try {
    await getDb()`UPDATE user_profiles SET
      username=CASE WHEN ${patch.username !== void 0} THEN ${patch.username ?? null} ELSE username END,
      username_changed_at=CASE WHEN ${patch.username !== void 0 && patch.username !== user.username} THEN now() ELSE username_changed_at END,
      display_name=CASE WHEN ${patch.displayName !== void 0} THEN ${patch.displayName ?? null} ELSE display_name END,
      bio=CASE WHEN ${patch.bio !== void 0} THEN ${patch.bio ?? null} ELSE bio END,
      location=CASE WHEN ${patch.location !== void 0} THEN ${patch.location ?? null} ELSE location END,
      birthday_month=CASE WHEN ${patch.birthdayMonth !== void 0} THEN ${patch.birthdayMonth ?? null} ELSE birthday_month END,
      birthday_day=CASE WHEN ${patch.birthdayDay !== void 0} THEN ${patch.birthdayDay ?? null} ELSE birthday_day END,
      avatar_object_key=CASE WHEN ${patch.avatarAttachmentId !== void 0} THEN ${avatarKey} ELSE avatar_object_key END,
      updated_at=now() WHERE user_id=${user.id}`;
    const rows = await getDb()`SELECT username,display_name,bio,location,birthday_month,birthday_day,avatar_object_key,username_changed_at FROM user_profiles WHERE user_id=${user.id} LIMIT 1`;
    return c.json({ profile: rows[0] });
  } catch (error) {
    if (error?.code === "23505") return jsonError(c, 409, "USERNAME_TAKEN", "That username is already in use.");
    return jsonError(c, 503, "PROFILE_UPDATE_FAILED", "Profile could not be updated.");
  }
});
profileRoutes.get("/username-available", async (c) => {
  const parsed = usernameSchema.safeParse(c.req.query("username") || "");
  if (!parsed.success) return jsonError(c, 422, "USERNAME_INVALID", "Use 3\xE2\x80\x9324 lowercase letters, numbers, or underscores.");
  const user = c.get("user");
  const rows = await getDb()`SELECT 1 FROM user_profiles WHERE username=${parsed.data} AND user_id<>${user.id} LIMIT 1`;
  return c.json({ username: parsed.data, available: rows.length === 0 });
});
profileRoutes.get("/search", async (c) => {
  const limited = await enforceRateLimit(c, "people-search", 40, 60);
  if (limited) return limited;
  const user = c.get("user"), query = (c.req.query("q") || "").trim().slice(0, 48);
  if (query.length < 2) return jsonError(c, 422, "SEARCH_TOO_SHORT", "Enter at least two characters.");
  const like = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await getDb()`SELECT p.user_id AS id,p.username,p.display_name,p.bio,p.location,p.avatar_object_key
    FROM user_profiles p JOIN users u ON u.id=p.user_id
    WHERE u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL AND p.user_id<>${user.id}
      AND (p.username ILIKE ${like} ESCAPE '\\' OR p.display_name ILIKE ${like} ESCAPE '\\')
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=${user.id}))
      AND NOT EXISTS(SELECT 1 FROM friendships f WHERE f.user_low=LEAST(${user.id}::uuid,p.user_id) AND f.user_high=GREATEST(${user.id}::uuid,p.user_id))
    ORDER BY p.username LIMIT 30`;
  return c.json({ people: rows });
});
profileRoutes.get("/discover", async (c) => {
  const user = c.get("user"), mode = c.req.query("mode") === "popular" ? "popular" : "random";
  const limit = Math.min(30, Math.max(1, Number.parseInt(c.req.query("limit") || "20", 10) || 20));
  const rows = await getDb()`WITH eligible AS (
      SELECT p.user_id AS id,p.username,p.display_name,p.bio,p.location,p.avatar_object_key,
        (SELECT count(*)::int FROM friendships f WHERE f.user_low=p.user_id OR f.user_high=p.user_id) AS connection_count
      FROM user_profiles p JOIN users u ON u.id=p.user_id
      WHERE u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL AND p.user_id<>${user.id}
        AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=${user.id}))
        AND NOT EXISTS(SELECT 1 FROM friendships f WHERE f.user_low=LEAST(${user.id}::uuid,p.user_id) AND f.user_high=GREATEST(${user.id}::uuid,p.user_id))
    ) SELECT * FROM eligible ORDER BY CASE WHEN ${mode}='popular' THEN connection_count END DESC,random() LIMIT ${limit}`;
  return c.json({ mode, people: rows });
});
profileRoutes.get("/id/:userId", async (c) => {
  const user = c.get("user"), target = c.req.param("userId");
  if (!/^[0-9a-f-]{36}$/i.test(target)) return jsonError(c, 404, "PROFILE_NOT_FOUND", "Profile not found.");
  if (target !== user.id) {
    const blocked = await getDb()`SELECT 1 FROM blocks WHERE (blocker_id=${user.id} AND blocked_id=${target}) OR (blocker_id=${target} AND blocked_id=${user.id}) LIMIT 1`;
    if (blocked.length) return jsonError(c, 404, "PROFILE_NOT_FOUND", "Profile not found.");
  }
  const rows = await getDb()`SELECT p.user_id AS id,p.username,p.display_name,p.bio,p.location,p.avatar_object_key,u.created_at
    FROM user_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=${target} AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL LIMIT 1`;
  if (!rows.length) return jsonError(c, 404, "PROFILE_NOT_FOUND", "Profile not found.");
  const friendship = await getDb()`SELECT 1 FROM friendships WHERE user_low=LEAST(${user.id}::uuid,${target}::uuid) AND user_high=GREATEST(${user.id}::uuid,${target}::uuid) LIMIT 1`;
  return c.json({ profile: rows[0], isFriend: friendship.length > 0 });
});
var settingsSchema = z3.object({ quietMode: z3.boolean().optional(), notificationsEnabled: z3.boolean().optional(), senderPreviews: z3.boolean().optional(), presenceVisible: z3.boolean().optional(), readReceiptsEnabled: z3.boolean().optional(), typingIndicatorsEnabled: z3.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one setting.");
profileRoutes.get("/settings", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT quiet_mode,notifications_enabled,sender_previews,presence_visible,read_receipts_enabled,typing_indicators_enabled FROM user_settings WHERE user_id=${user.id} LIMIT 1`;
  return c.json({ settings: rows[0] || { quiet_mode: true, notifications_enabled: true, sender_previews: true, presence_visible: true, read_receipts_enabled: true, typing_indicators_enabled: true } });
});
profileRoutes.patch("/settings", async (c) => {
  const user = c.get("user"), parsed = await parseJson(c, settingsSchema);
  if ("response" in parsed) return parsed.response;
  const s = parsed.data;
  await getDb()`INSERT INTO user_settings(user_id,quiet_mode,notifications_enabled,sender_previews,presence_visible,read_receipts_enabled,typing_indicators_enabled)
    VALUES (${user.id},${s.quietMode ?? true},${s.notificationsEnabled ?? true},${s.senderPreviews ?? true},${s.presenceVisible ?? true},${s.readReceiptsEnabled ?? true},${s.typingIndicatorsEnabled ?? true})
    ON CONFLICT(user_id) DO UPDATE SET
      quiet_mode=CASE WHEN ${s.quietMode !== void 0} THEN ${s.quietMode ?? null} ELSE user_settings.quiet_mode END,
      notifications_enabled=CASE WHEN ${s.notificationsEnabled !== void 0} THEN ${s.notificationsEnabled ?? null} ELSE user_settings.notifications_enabled END,
      sender_previews=CASE WHEN ${s.senderPreviews !== void 0} THEN ${s.senderPreviews ?? null} ELSE user_settings.sender_previews END,
      presence_visible=CASE WHEN ${s.presenceVisible !== void 0} THEN ${s.presenceVisible ?? null} ELSE user_settings.presence_visible END,
      read_receipts_enabled=CASE WHEN ${s.readReceiptsEnabled !== void 0} THEN ${s.readReceiptsEnabled ?? null} ELSE user_settings.read_receipts_enabled END,
      typing_indicators_enabled=CASE WHEN ${s.typingIndicatorsEnabled !== void 0} THEN ${s.typingIndicatorsEnabled ?? null} ELSE user_settings.typing_indicators_enabled END,
      updated_at=now()`;
  const rows = await getDb()`SELECT quiet_mode,notifications_enabled,sender_previews,presence_visible,read_receipts_enabled,typing_indicators_enabled FROM user_settings WHERE user_id=${user.id} LIMIT 1`;
  return c.json({ settings: rows[0] });
});

// src/routes/friends.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import { Hono as Hono3 } from "hono";

// src/services/notifications.ts
import { randomUUID as randomUUID3 } from "node:crypto";

// src/services/realtime.ts
import * as Ably from "ably";
var restClient;
function getRest() {
  const key = process.env.ABLY_API_KEY;
  if (!key) throw new Error("CONFIG_ABLY_MISSING");
  if (!restClient) restClient = new Ably.Rest({ key });
  return restClient;
}
async function createRealtimeTokenRequest(userId, conversationIds, preferences) {
  const capability = {};
  if (preferences.notificationsEnabled) capability[`haiku:user:${userId}`] = ["subscribe"];
  for (const id of conversationIds) {
    capability[`haiku:conversation:${id}:events`] = ["subscribe"];
    const ephemeral = ["subscribe"];
    if (preferences.typingIndicatorsEnabled) ephemeral.push("publish");
    if (preferences.presenceVisible) ephemeral.push("presence");
    capability[`haiku:conversation:${id}:ephemeral`] = ephemeral;
  }
  return getRest().auth.createTokenRequest({
    clientId: userId,
    capability: JSON.stringify(capability),
    ttl: 10 * 60 * 1e3
  });
}
async function publishMessageCreated(conversationId, messageId) {
  const client = getRest();
  await client.channels.get(`haiku:conversation:${conversationId}:events`).publish("message.created", { conversationId, messageId });
}
async function publishUserEvent(userId, name, data) {
  const client = getRest();
  await client.channels.get(`haiku:user:${userId}`).publish(name, data);
}

// src/services/notifications.ts
async function createNotification(userId, type, actorId, entityId, payload = {}) {
  const id = randomUUID3();
  await getDb()`INSERT INTO notifications (id,user_id,actor_id,type,entity_id,payload) VALUES (${id},${userId},${actorId},${type},${entityId},${JSON.stringify(payload)}::jsonb)`;
  try {
    await publishUserEvent(userId, "notification.created", { id, type, entityId });
  } catch {
  }
  return id;
}

// src/routes/friends.ts
var friendRoutes = new Hono3();
friendRoutes.use("*", requireUser);
function pair(a, b) {
  return a < b ? [a, b] : [b, a];
}
friendRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT p.user_id AS id,p.username,p.display_name,p.bio,p.location,p.avatar_object_key,f.created_at
    FROM friendships f
    JOIN users u ON u.id=CASE WHEN f.user_low=${user.id} THEN f.user_high ELSE f.user_low END
    JOIN user_profiles p ON p.user_id=u.id
    WHERE (f.user_low=${user.id} OR f.user_high=${user.id}) AND u.status='active' AND u.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=${user.id}))
    ORDER BY p.display_name LIMIT 500`;
  return c.json({ friends: rows });
});
friendRoutes.get("/requests", async (c) => {
  const user = c.get("user");
  const direction = c.req.query("direction") === "outgoing" ? "outgoing" : "incoming";
  const rows = direction === "incoming" ? await getDb()`SELECT r.id,r.created_at,p.user_id AS user_id,p.username,p.display_name,p.bio,p.avatar_object_key
        FROM friend_requests r JOIN user_profiles p ON p.user_id=r.sender_id
        JOIN users u ON u.id=r.sender_id WHERE r.recipient_id=${user.id} AND r.status='pending' AND u.status='active' ORDER BY r.created_at DESC LIMIT 100` : await getDb()`SELECT r.id,r.created_at,p.user_id AS user_id,p.username,p.display_name,p.bio,p.avatar_object_key
        FROM friend_requests r JOIN user_profiles p ON p.user_id=r.recipient_id
        JOIN users u ON u.id=r.recipient_id WHERE r.sender_id=${user.id} AND r.status='pending' AND u.status='active' ORDER BY r.created_at DESC LIMIT 100`;
  return c.json({ direction, requests: rows });
});
friendRoutes.post("/requests/:userId", async (c) => {
  const limited = await enforceRateLimit(c, "friend-request", 30, 3600);
  if (limited) return limited;
  const user = c.get("user");
  const recipientId = c.req.param("userId");
  if (!/^[0-9a-f-]{36}$/i.test(recipientId) || recipientId === user.id) return jsonError(c, 422, "RECIPIENT_INVALID", "Choose another Haiku Messenger user.");
  const blocked = await getDb()`SELECT 1 FROM blocks WHERE (blocker_id=${user.id} AND blocked_id=${recipientId}) OR (blocker_id=${recipientId} AND blocked_id=${user.id}) LIMIT 1`;
  if (blocked.length) return jsonError(c, 404, "USER_NOT_FOUND", "That user is unavailable.");
  const target = await getDb()`SELECT 1 FROM users WHERE id=${recipientId} AND status='active' AND email_verified_at IS NOT NULL AND deleted_at IS NULL LIMIT 1`;
  if (!target.length) return jsonError(c, 404, "USER_NOT_FOUND", "That user is unavailable.");
  const [low, high] = pair(user.id, recipientId);
  const existingFriendship = await getDb()`SELECT 1 FROM friendships WHERE user_low=${low} AND user_high=${high} LIMIT 1`;
  if (existingFriendship.length) return jsonError(c, 409, "ALREADY_FRIENDS", "You are already friends.");
  const id = randomUUID4();
  try {
    await getDb()`INSERT INTO friend_requests(id,sender_id,recipient_id,status) VALUES (${id},${user.id},${recipientId},'pending')`;
  } catch (error) {
    if (error?.code === "23505") return jsonError(c, 409, "REQUEST_PENDING", "A friend request is already pending.");
    return jsonError(c, 503, "REQUEST_FAILED", "The request could not be sent.");
  }
  try {
    await createNotification(recipientId, "friend_request", user.id, id, {});
  } catch {
  }
  return c.json({ request: { id, status: "pending", recipientId } }, 201);
});
friendRoutes.post("/requests/:requestId/accept", async (c) => {
  const user = c.get("user");
  const requestId = c.req.param("requestId");
  const accepted = await getDb()`WITH request AS (
      UPDATE friend_requests SET status='accepted',responded_at=now()
      WHERE id=${requestId} AND recipient_id=${user.id} AND status='pending'
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=friend_requests.sender_id) OR (b.blocker_id=friend_requests.sender_id AND b.blocked_id=${user.id}))
      RETURNING sender_id,recipient_id
    ), friendship AS (
      INSERT INTO friendships(user_low,user_high)
        SELECT LEAST(sender_id,recipient_id),GREATEST(sender_id,recipient_id) FROM request
        ON CONFLICT DO NOTHING RETURNING user_low,user_high
    ) SELECT request.sender_id,request.recipient_id FROM request`;
  if (!accepted.length) return jsonError(c, 404, "REQUEST_NOT_FOUND", "This request is no longer available.");
  const request = accepted[0];
  try {
    await createNotification(request.sender_id, "friend_accepted", user.id, requestId, {});
  } catch {
  }
  return c.json({ status: "accepted", friendId: request.sender_id });
});
friendRoutes.post("/requests/:requestId/reject", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`UPDATE friend_requests SET status='rejected',responded_at=now()
    WHERE id=${c.req.param("requestId")} AND recipient_id=${user.id} AND status='pending' RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "REQUEST_NOT_FOUND", "This request is no longer available.");
  return c.json({ status: "rejected" });
});
friendRoutes.delete("/requests/:requestId", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`UPDATE friend_requests SET status='canceled',responded_at=now()
    WHERE id=${c.req.param("requestId")} AND sender_id=${user.id} AND status='pending' RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "REQUEST_NOT_FOUND", "This request is no longer available.");
  return c.json({ status: "canceled" });
});
friendRoutes.delete("/:userId", async (c) => {
  const user = c.get("user");
  const friendId = c.req.param("userId");
  if (!/^[0-9a-f-]{36}$/i.test(friendId)) return jsonError(c, 404, "FRIEND_NOT_FOUND", "Friend not found.");
  const [low, high] = pair(user.id, friendId);
  const deleted = await getDb()`DELETE FROM friendships WHERE user_low=${low} AND user_high=${high} RETURNING user_low`;
  if (!deleted.length) return jsonError(c, 404, "FRIEND_NOT_FOUND", "Friend not found.");
  return c.json({ status: "removed" });
});
friendRoutes.get("/blocks", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT b.blocked_id AS id,p.username,p.display_name,b.created_at
    FROM blocks b JOIN user_profiles p ON p.user_id=b.blocked_id WHERE b.blocker_id=${user.id} ORDER BY b.created_at DESC LIMIT 500`;
  return c.json({ blockedUsers: rows });
});
friendRoutes.post("/blocks/:userId", async (c) => {
  const limited = await enforceRateLimit(c, "block-account", 20, 3600);
  if (limited) return limited;
  const user = c.get("user");
  const blockedId = c.req.param("userId");
  if (!/^[0-9a-f-]{36}$/i.test(blockedId) || blockedId === user.id) return jsonError(c, 422, "USER_INVALID", "You cannot block this account.");
  const target = await getDb()`SELECT id FROM users WHERE id=${blockedId} AND deleted_at IS NULL LIMIT 1`;
  if (!target.length) return jsonError(c, 404, "USER_NOT_FOUND", "User not found.");
  const [low, high] = pair(user.id, blockedId);
  await getDb().transaction([
    getDb()`INSERT INTO blocks(blocker_id,blocked_id) VALUES (${user.id},${blockedId}) ON CONFLICT DO NOTHING`,
    getDb()`DELETE FROM friendships WHERE user_low=${low} AND user_high=${high}`,
    getDb()`UPDATE friend_requests SET status='canceled',responded_at=now() WHERE status='pending' AND ((sender_id=${user.id} AND recipient_id=${blockedId}) OR (sender_id=${blockedId} AND recipient_id=${user.id}))`
  ]);
  return c.json({ status: "blocked" });
});
friendRoutes.delete("/blocks/:userId", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`DELETE FROM blocks WHERE blocker_id=${user.id} AND blocked_id=${c.req.param("userId")} RETURNING blocked_id`;
  if (!rows.length) return jsonError(c, 404, "BLOCK_NOT_FOUND", "That block was not found.");
  return c.json({ status: "unblocked" });
});

// src/routes/conversations.ts
import { randomUUID as randomUUID5 } from "node:crypto";
import { Hono as Hono4 } from "hono";
import { z as z4 } from "zod";
var conversationRoutes = new Hono4();
conversationRoutes.use("*", requireUser);
function orderedPair(a, b) {
  return a < b ? [a, b] : [b, a];
}
function validUuid(value) {
  return /^[0-9a-f-]{36}$/i.test(value);
}
conversationRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT c.id,c.kind,c.created_at,
      CASE WHEN c.kind='group' THEN g.name ELSE (SELECT p.display_name FROM conversation_members other JOIN user_profiles p ON p.user_id=other.user_id WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL LIMIT 1) END AS title,
      CASE WHEN c.kind='group' THEN g.photo_object_key ELSE (SELECT p.avatar_object_key FROM conversation_members other JOIN user_profiles p ON p.user_id=other.user_id WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL LIMIT 1) END AS avatar_object_key,
      lm.id AS last_message_id,lm.body AS last_message_text,lm.message_type AS last_message_type,lm.created_at AS last_message_at,
      (SELECT count(*)::int FROM message_receipts mr JOIN messages m ON m.id=mr.message_id
        WHERE mr.user_id=${user.id} AND mr.read_at IS NULL AND m.conversation_id=c.id AND m.sender_id<>${user.id}
          AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())) AS unread_count,
      (SELECT count(*)::int FROM conversation_members m WHERE m.conversation_id=c.id AND m.left_at IS NULL) AS member_count
    FROM conversations c
    JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=${user.id} AND mine.left_at IS NULL
    LEFT JOIN haiku_groups g ON g.conversation_id=c.id
    LEFT JOIN LATERAL (SELECT m.id,m.body,m.message_type,m.created_at FROM messages m
      WHERE m.conversation_id=c.id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
        AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id=m.id AND h.user_id=${user.id})
      ORDER BY m.created_at DESC,m.id DESC LIMIT 1) lm ON true
    WHERE (c.kind='group' AND g.suspended_at IS NULL) OR (
      EXISTS (SELECT 1 FROM friendships f JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
        WHERE f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id))
      AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
        WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id}))
    ) ORDER BY COALESCE(lm.created_at,c.created_at) DESC LIMIT 100`;
  return c.json({ conversations: rows });
});
conversationRoutes.post("/direct/:otherUserId", async (c) => {
  const user = c.get("user");
  const otherId = c.req.param("otherUserId");
  if (!validUuid(otherId) || otherId === user.id) return jsonError(c, 422, "USER_INVALID", "Choose another user.");
  const [low, high] = orderedPair(user.id, otherId);
  const permissions = await getDb()`SELECT 1 FROM friendships f
    JOIN users a ON a.id=${user.id} AND a.status='active' AND a.deleted_at IS NULL
    JOIN users b ON b.id=${otherId} AND b.status='active' AND b.email_verified_at IS NOT NULL AND b.deleted_at IS NULL
    WHERE f.user_low=${low} AND f.user_high=${high}
      AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id=${user.id} AND blocked_id=${otherId}) OR (blocker_id=${otherId} AND blocked_id=${user.id})) LIMIT 1`;
  if (!permissions.length) return jsonError(c, 403, "FRIENDSHIP_REQUIRED", "Private conversations are available after the friend request is accepted.");
  const key = `${low}:${high}`;
  const conversationId = randomUUID5();
  await getDb().transaction([
    getDb()`INSERT INTO conversations(id,kind,direct_key,created_by) VALUES (${conversationId},'direct',${key},${user.id}) ON CONFLICT(direct_key) DO NOTHING`,
    getDb()`INSERT INTO conversation_members(conversation_id,user_id) SELECT id,${user.id} FROM conversations WHERE direct_key=${key} ON CONFLICT DO NOTHING`,
    getDb()`INSERT INTO conversation_members(conversation_id,user_id) SELECT id,${otherId} FROM conversations WHERE direct_key=${key} ON CONFLICT DO NOTHING`
  ]);
  const rows = await getDb()`SELECT id FROM conversations WHERE direct_key=${key} LIMIT 1`;
  if (!rows.length) return jsonError(c, 503, "CONVERSATION_CREATE_FAILED", "The conversation could not be created.");
  return c.json({ conversationId: String(rows[0].id), kind: "direct" }, 201);
});
conversationRoutes.get("/:conversationId/messages", async (c) => {
  const user = c.get("user");
  const conversationId = c.req.param("conversationId");
  if (!validUuid(conversationId)) return jsonError(c, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  const access = await getDb()`SELECT c.kind FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE c.id=${conversationId} AND cm.user_id=${user.id} AND cm.left_at IS NULL
      AND ((c.kind='group' AND EXISTS (SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)) OR (
        EXISTS (SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id)
          WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
          WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id}))
      )) LIMIT 1`;
  if (!access.length) return jsonError(c, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  await getDb()`UPDATE message_receipts mr SET delivered_at=COALESCE(mr.delivered_at,now()) FROM messages m
    WHERE mr.message_id=m.id AND mr.user_id=${user.id} AND mr.delivered_at IS NULL AND m.conversation_id=${conversationId}
      AND m.sender_id<>${user.id} AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())`;
  const limit = Math.max(1, Math.min(100, Number.parseInt(c.req.query("limit") || "40", 10) || 40));
  const before = c.req.query("before");
  if (before && Number.isNaN(Date.parse(before))) return jsonError(c, 422, "CURSOR_INVALID", "Message cursor is invalid.");
  const cursor = before ? new Date(before).toISOString() : null;
  const read = await getDb()`SELECT m.id,m.sender_id,m.message_type,m.body,m.attachment_id,m.reply_to_id,m.created_at,m.edited_at,
      CASE WHEN m.sender_id=${user.id} THEN (SELECT CASE
        WHEN count(*) FILTER(WHERE COALESCE(s.read_receipts_enabled,true))>0 AND bool_and(mr.read_at IS NOT NULL) FILTER(WHERE COALESCE(s.read_receipts_enabled,true)) THEN 'read'
        WHEN count(*)>0 AND bool_and(mr.delivered_at IS NOT NULL) THEN 'delivered' ELSE 'sent' END
        FROM message_receipts mr LEFT JOIN user_settings s ON s.user_id=mr.user_id WHERE mr.message_id=m.id) ELSE NULL END AS receipt_status,
      (SELECT jsonb_build_object('username',p.username,'displayName',p.display_name) FROM user_profiles p WHERE p.user_id=m.sender_id) AS sender
    FROM messages m
    WHERE m.conversation_id=${conversationId} AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
      AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id=m.id AND h.user_id=${user.id})
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=m.sender_id) OR (b.blocker_id=m.sender_id AND b.blocked_id=${user.id}))
      AND (${cursor}::timestamptz IS NULL OR m.created_at<${cursor}::timestamptz)
    ORDER BY m.created_at DESC,m.id DESC LIMIT ${limit}`;
  return c.json({ messages: read.reverse(), hasMore: read.length === limit });
});
conversationRoutes.post("/:conversationId/messages", async (c) => {
  const limited = await enforceRateLimit(c, "send-message", 120, 60);
  if (limited) return limited;
  const user = c.get("user");
  const conversationId = c.req.param("conversationId");
  if (!validUuid(conversationId)) return jsonError(c, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  const parsed = await parseJson(c, sendMessageSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;
  let attachment;
  if (input.attachmentId) {
    const rows2 = await getDb()`SELECT id,media_type,purpose,status,owner_id,expires_at FROM attachments WHERE id=${input.attachmentId} LIMIT 1`;
    attachment = rows2[0];
    if (!attachment || attachment.owner_id !== user.id || attachment.status !== "ready" || attachment.purpose !== "message" || attachment.expires_at && new Date(attachment.expires_at).getTime() <= Date.now()) {
      return jsonError(c, 422, "ATTACHMENT_INVALID", "This attachment is not available. Upload it again.");
    }
  }
  const messageType = attachment ? attachment.media_type : "text";
  const id = randomUUID5();
  const hours = input.expiresInHours;
  const rows = await getDb()`INSERT INTO messages (id,conversation_id,sender_id,message_type,body,attachment_id,reply_to_id,expires_at)
    SELECT ${id},c.id,${user.id},${messageType},${input.text ?? null},${input.attachmentId ?? null},${input.replyToId ?? null},
      CASE WHEN ${messageType === "video" || messageType === "voice"} THEN now()+interval '10 minutes'
           WHEN ${hours ?? null}::int IS NOT NULL THEN now()+(${hours ?? 0}*interval '1 hour') ELSE NULL END
    FROM conversations c JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=${user.id} AND mine.left_at IS NULL
    WHERE c.id=${conversationId} AND (
      (c.kind='direct'
        AND EXISTS (SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id)
          WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
          WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})))
      OR (c.kind='group' AND EXISTS (SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)
        AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id=(SELECT g.id FROM haiku_groups g WHERE g.conversation_id=c.id) AND gm.user_id=${user.id} AND gm.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=(SELECT g.id FROM haiku_groups g WHERE g.conversation_id=c.id) AND gm.user_id<>${user.id} AND gm.left_at IS NULL
          WHERE (b.blocker_id=${user.id} AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=${user.id})))
    ) AND (${input.replyToId ?? null}::uuid IS NULL OR EXISTS (SELECT 1 FROM messages parent WHERE parent.id=${input.replyToId ?? null} AND parent.conversation_id=c.id AND parent.deleted_at IS NULL AND (parent.expires_at IS NULL OR parent.expires_at>now())))
      AND (${input.attachmentId ?? null}::uuid IS NULL OR EXISTS (SELECT 1 FROM attachments a WHERE a.id=${input.attachmentId ?? null} AND a.owner_id=${user.id} AND a.status='ready' AND a.purpose='message' AND (a.expires_at IS NULL OR a.expires_at>now())))
    RETURNING id,conversation_id,sender_id,message_type,body,attachment_id,reply_to_id,created_at,expires_at`;
  if (!rows.length) return jsonError(c, 403, "MESSAGE_NOT_ALLOWED", "You cannot send a message in this conversation. Check membership, friendship, and block settings.");
  const message = rows[0];
  if (message.attachment_id) await getDb()`UPDATE attachments SET expires_at=${message.expires_at ?? null} WHERE id=${message.attachment_id} AND owner_id=${user.id}`;
  await getDb()`INSERT INTO message_receipts(message_id,user_id)
    SELECT ${message.id},cm.user_id FROM conversation_members cm WHERE cm.conversation_id=${conversationId} AND cm.user_id<>${user.id} AND cm.left_at IS NULL ON CONFLICT DO NOTHING`;
  let realtime = "published";
  try {
    await publishMessageCreated(conversationId, message.id);
  } catch {
    realtime = "unavailable";
  }
  const recipients = await getDb()`SELECT user_id FROM conversation_members WHERE conversation_id=${conversationId} AND user_id<>${user.id} AND left_at IS NULL LIMIT 100`;
  for (const row of recipients) {
    try {
      await createNotification(row.user_id, "message", user.id, message.id, { conversationId });
    } catch {
    }
  }
  return c.json({ message, realtime }, 201);
});
conversationRoutes.patch("/:conversationId/messages/:messageId", async (c) => {
  const user = c.get("user");
  const parsed = await parseJson(c, z4.object({ text: z4.string().trim().min(1).max(4e3) }).strict());
  if ("response" in parsed) return parsed.response;
  const rows = await getDb()`UPDATE messages m SET body=${parsed.data.text},edited_at=now()
    FROM conversation_members cm WHERE m.id=${c.req.param("messageId")} AND m.conversation_id=${c.req.param("conversationId")}
      AND m.sender_id=${user.id} AND m.message_type='text' AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
      AND m.created_at>now()-interval '15 minutes' AND cm.conversation_id=m.conversation_id AND cm.user_id=${user.id} AND cm.left_at IS NULL
    RETURNING m.id,m.body,m.edited_at,m.created_at,m.expires_at`;
  if (!rows.length) return jsonError(c, 404, "MESSAGE_NOT_EDITABLE", "This message cannot be edited. It may have expired or be older than 15 minutes.");
  try {
    await publishMessageCreated(c.req.param("conversationId"), c.req.param("messageId"));
  } catch {
  }
  return c.json({ message: rows[0] });
});
conversationRoutes.delete("/:conversationId/messages/:messageId", async (c) => {
  const user = c.get("user");
  const mode = c.req.query("mode") === "everyone" ? "everyone" : "me";
  const conversationId = c.req.param("conversationId");
  const messageId = c.req.param("messageId");
  if (mode === "me") {
    const allowed = await getDb()`SELECT 1 FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id
      WHERE m.id=${messageId} AND m.conversation_id=${conversationId} AND cm.user_id=${user.id} AND cm.left_at IS NULL LIMIT 1`;
    if (!allowed.length) return jsonError(c, 404, "MESSAGE_NOT_FOUND", "Message not found.");
    await getDb()`INSERT INTO message_hidden(message_id,user_id) VALUES (${messageId},${user.id}) ON CONFLICT DO NOTHING`;
    return c.json({ status: "deleted_for_me" });
  }
  const owned = await getDb()`SELECT m.attachment_id FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id
    WHERE m.id=${messageId} AND m.conversation_id=${conversationId} AND m.sender_id=${user.id} AND m.deleted_at IS NULL AND cm.user_id=${user.id} AND cm.left_at IS NULL LIMIT 1`;
  if (!owned.length) return jsonError(c, 404, "MESSAGE_NOT_FOUND", "Only your own available messages can be deleted for everyone.");
  const attached = owned[0].attachment_id;
  const rows = await getDb()`UPDATE messages SET body=NULL,attachment_id=NULL,deleted_at=now(),deletion_kind='sender'
    WHERE id=${messageId} AND conversation_id=${conversationId} AND sender_id=${user.id} AND deleted_at IS NULL RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "MESSAGE_NOT_FOUND", "Message not found.");
  if (attached) await getDb()`UPDATE attachments SET expires_at=now() WHERE id=${attached}`;
  try {
    await publishMessageCreated(conversationId, messageId);
  } catch {
  }
  return c.json({ status: "deleted_for_everyone" });
});
conversationRoutes.post("/:conversationId/read", async (c) => {
  const user = c.get("user");
  const conversationId = c.req.param("conversationId");
  const visible = await getDb()`SELECT 1 FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE c.id=${conversationId} AND cm.user_id=${user.id} AND cm.left_at IS NULL AND (
      (c.kind='group' AND EXISTS(SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)) OR
      (c.kind='direct' AND EXISTS(SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id) WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})))
    ) LIMIT 1`;
  if (!visible.length) return jsonError(c, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  const settings = await getDb()`SELECT read_receipts_enabled FROM user_settings WHERE user_id=${user.id} LIMIT 1`;
  if (settings[0]?.read_receipts_enabled !== false) {
    await getDb()`UPDATE message_receipts mr SET read_at=COALESCE(mr.read_at,now()) FROM messages m
      WHERE mr.message_id=m.id AND mr.user_id=${user.id} AND mr.read_at IS NULL AND m.conversation_id=${conversationId}
        AND m.sender_id<>${user.id} AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())`;
  }
  await getDb()`UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=${conversationId} AND user_id=${user.id}`;
  return c.json({ status: "read" });
});
conversationRoutes.get("/:conversationId/search", async (c) => {
  const limited = await enforceRateLimit(c, "message-search", 30, 60);
  if (limited) return limited;
  const user = c.get("user");
  const conversationId = c.req.param("conversationId");
  if (!validUuid(conversationId)) return jsonError(c, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  const q = (c.req.query("q") || "").trim().slice(0, 100);
  if (q.length < 2) return jsonError(c, 422, "SEARCH_TOO_SHORT", "Enter at least two characters.");
  const membership = await getDb()`SELECT 1 FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE c.id=${conversationId} AND cm.user_id=${user.id} AND cm.left_at IS NULL AND (
      (c.kind='group' AND EXISTS(SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)) OR
      (c.kind='direct' AND EXISTS(SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id) WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})))
    ) LIMIT 1`;
  if (!membership.length) return jsonError(c, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await getDb()`SELECT id,sender_id,body,created_at,edited_at FROM messages m
    WHERE conversation_id=${conversationId} AND message_type='text' AND body ILIKE ${like} ESCAPE '\\'
      AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>now())
      AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id=m.id AND h.user_id=${user.id})
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=m.sender_id) OR (b.blocker_id=m.sender_id AND b.blocked_id=${user.id}))
    ORDER BY created_at DESC LIMIT 50`;
  return c.json({ messages: rows });
});
conversationRoutes.post("/realtime/token-request", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT c.id FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE cm.user_id=${user.id} AND cm.left_at IS NULL AND (
      (c.kind='group' AND EXISTS (SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)) OR (EXISTS (SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${user.id}::uuid,other.user_id) AND f.user_high=GREATEST(${user.id}::uuid,other.user_id)
        WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL
          WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})))
    ) LIMIT 150`;
  try {
    const prefs = await getDb()`SELECT presence_visible,typing_indicators_enabled,notifications_enabled FROM user_settings WHERE user_id=${user.id} LIMIT 1`;
    const preference = prefs[0];
    const tokenRequest = await createRealtimeTokenRequest(user.id, rows.map((row) => String(row.id)), { presenceVisible: preference?.presence_visible !== false, typingIndicatorsEnabled: preference?.typing_indicators_enabled !== false, notificationsEnabled: preference?.notifications_enabled !== false });
    c.header("Cache-Control", "no-store");
    return c.json(tokenRequest);
  } catch (error) {
    if (error instanceof Error && error.message === "CONFIG_ABLY_MISSING") return jsonError(c, 503, "CONFIG_ABLY_MISSING", "Realtime messaging is not configured.");
    return jsonError(c, 503, "REALTIME_UNAVAILABLE", "Realtime connection is temporarily unavailable.");
  }
});
conversationRoutes.get("/notifications", async (c) => {
  const user = c.get("user");
  const before = c.req.query("before");
  const rows = await getDb()`SELECT n.id,n.type,n.actor_id,n.entity_id,n.payload,n.created_at,n.read_at,p.username,p.display_name
    FROM notifications n LEFT JOIN user_profiles p ON p.user_id=n.actor_id
    WHERE n.user_id=${user.id} AND n.expires_at>now() AND (${before || null}::timestamptz IS NULL OR n.created_at<${before || null}::timestamptz)
    ORDER BY n.created_at DESC LIMIT 50`;
  return c.json({ notifications: rows });
});
conversationRoutes.post("/notifications/:id/read", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=${c.req.param("id")} AND user_id=${user.id} AND expires_at>now() RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
  return c.json({ status: "read" });
});

// src/routes/media.ts
import { randomUUID as randomUUID7 } from "node:crypto";
import { Hono as Hono5 } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z as z5 } from "zod";

// src/services/storage.ts
import { randomUUID as randomUUID6 } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
var localRoot = path.resolve(process.cwd(), "../../.haiku-media");
function safePath(objectKey) {
  if (!/^[a-f0-9-]{36}$/.test(objectKey)) throw new Error("MEDIA_KEY_INVALID");
  const result = path.join(localRoot, objectKey);
  if (!result.startsWith(localRoot + path.sep)) throw new Error("MEDIA_KEY_INVALID");
  return result;
}
function localStorage() {
  if (isProduction() || process.env.VERCEL) throw new Error("CONFIG_LOCAL_MEDIA_NOT_ALLOWED");
  return {
    mode: "local",
    async uploadPlan(_key, mimeType, _size, baseUrl, attachmentId) {
      return { mode: "proxy", url: `${baseUrl.replace(/\/$/, "")}/v1/media/${attachmentId}/content`, method: "PUT", headers: { "Content-Type": mimeType }, expiresInSeconds: 300 };
    },
    async downloadUrl(objectKey, baseUrl) {
      return { mode: "proxy", url: `${baseUrl.replace(/\/$/, "")}/v1/media/object/${objectKey}`, expiresInSeconds: 60 };
    },
    async putLocal(key, bytes) {
      await mkdir(localRoot, { recursive: true });
      await writeFile(safePath(key), bytes, { flag: "wx" });
    },
    async readLocal(key) {
      return readFile(safePath(key));
    },
    async checkObject(key, expectedMimeType) {
      const bytes = await readFile(safePath(key));
      return { byteSize: bytes.byteLength, mimeType: expectedMimeType || "application/octet-stream", prefix: bytes.subarray(0, 32) };
    },
    async deleteObject(key) {
      try {
        await unlink(safePath(key));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  };
}
function neonS3Storage() {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.MEDIA_BUCKET;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) throw new Error("CONFIG_NEON_OBJECT_STORAGE_MISSING");
  const s3 = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
  return {
    mode: "neon-s3",
    async uploadPlan(objectKey, mimeType, byteSize) {
      const command = new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: mimeType, ContentLength: byteSize });
      const url = await getSignedUrl(s3, command, { expiresIn: 300 });
      return { mode: "signed", url, method: "PUT", headers: { "Content-Type": mimeType }, expiresInSeconds: 300 };
    },
    async downloadUrl(objectKey, _baseUrl, opts) {
      const safeName2 = opts?.fileName ? opts.fileName.replace(/[^A-Za-z0-9._-]/g, "_") : void 0;
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: objectKey, ...safeName2 ? { ResponseContentDisposition: `attachment; filename="${safeName2}"` } : {}, ...opts?.contentType ? { ResponseContentType: opts.contentType } : {} }), { expiresIn: 60 });
      return { mode: "signed", url, expiresInSeconds: 60 };
    },
    async checkObject(objectKey) {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey, Range: "bytes=0-31" }));
      const prefix = object.Body ? await object.Body.transformToByteArray() : new Uint8Array();
      return { byteSize: Number(head.ContentLength || 0), mimeType: String(head.ContentType || "application/octet-stream"), prefix };
    },
    async deleteObject(objectKey) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    }
  };
}
var cached2;
function getStorage() {
  if (cached2) return cached2;
  const mode = process.env.MEDIA_STORAGE || "local";
  if (mode === "local") cached2 = localStorage();
  else if (mode === "neon-s3") cached2 = neonS3Storage();
  else throw new Error("CONFIG_MEDIA_STORAGE_INVALID");
  return cached2;
}
function newObjectKey() {
  return randomUUID6();
}
function verifyMediaSignature(mediaType, mimeType, bytes) {
  const b = bytes;
  const starts = (...signature) => signature.every((value, index) => b[index] === value);
  const mime = mimeType.toLowerCase().split(";")[0].trim();
  if (mediaType === "image") {
    if (mime === "image/jpeg" && starts(255, 216, 255)) return true;
    if (mime === "image/png" && starts(137, 80, 78, 71, 13, 10, 26, 10)) return true;
    if (mime === "image/webp" && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return true;
  }
  if (mediaType === "video" && mime === "video/mp4" && String.fromCharCode(...b.slice(4, 8)) === "ftyp") return true;
  if (mediaType === "voice") {
    if (mime === "audio/mp4" && String.fromCharCode(...b.slice(4, 8)) === "ftyp") return true;
    if (mime === "audio/ogg" && String.fromCharCode(...b.slice(0, 4)) === "OggS") return true;
    if ((mime === "audio/webm" || mime === "audio/matroska") && starts(26, 69, 223, 163)) return true;
    if (mime === "audio/mpeg" && (starts(73, 68, 51) || b[0] === 255 && (b[1] & 224) === 224)) return true;
  }
  return false;
}

// src/routes/media.ts
var mediaRoutes = new Hono5();
mediaRoutes.use("*", requireUser);
var uploadIntentSchema = z5.object({
  purpose: z5.enum(["message", "story", "avatar", "report", "group"]),
  mediaType: z5.enum(["image", "video", "voice"]),
  mimeType: z5.string().min(3).max(120),
  byteSize: z5.number().int().positive().max(50 * 1024 * 1024),
  conversationId: z5.string().uuid().optional(),
  groupId: z5.string().uuid().optional()
}).strict().superRefine((value, ctx) => {
  if (value.purpose === "avatar" && value.mediaType !== "image") ctx.addIssue({ code: "custom", message: "Profile pictures must be images.", path: ["mediaType"] });
  if (value.purpose === "story" && !["image", "video"].includes(value.mediaType)) ctx.addIssue({ code: "custom", message: "Stories support photos or video.", path: ["mediaType"] });
  if (value.purpose === "group" && value.mediaType !== "image") ctx.addIssue({ code: "custom", message: "Group photos must be images.", path: ["mediaType"] });
  if (value.purpose === "message" && !value.conversationId) ctx.addIssue({ code: "custom", message: "A conversation is required for message media.", path: ["conversationId"] });
  if (value.purpose === "group" && !value.groupId) ctx.addIssue({ code: "custom", message: "A group is required for its photo.", path: ["groupId"] });
  if (value.purpose === "story" && value.byteSize > 50 * 1024 * 1024) ctx.addIssue({ code: "custom", message: "Story media must be 50 MB or smaller.", path: ["byteSize"] });
  if (value.mediaType === "image" && value.byteSize > 10 * 1024 * 1024) ctx.addIssue({ code: "custom", message: "Images must be 10 MB or smaller.", path: ["byteSize"] });
  if (value.mediaType === "voice" && value.byteSize > 10 * 1024 * 1024) ctx.addIssue({ code: "custom", message: "Voice notes must be 10 MB or smaller.", path: ["byteSize"] });
  const allowed = value.mediaType === "image" ? ["image/jpeg", "image/png", "image/webp"] : value.mediaType === "video" ? ["video/mp4"] : ["audio/mp4", "audio/ogg", "audio/webm", "audio/matroska", "audio/mpeg"];
  if (!allowed.includes(value.mimeType.toLowerCase().split(";")[0])) ctx.addIssue({ code: "custom", message: "This media format is not supported.", path: ["mimeType"] });
});
async function canUseConversation(userId, conversationId) {
  const rows = await getDb()`SELECT c.id FROM conversations c JOIN conversation_members mine ON mine.conversation_id=c.id
    WHERE c.id=${conversationId} AND mine.user_id=${userId} AND mine.left_at IS NULL AND (
      (c.kind='direct' AND EXISTS (SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${userId}::uuid,other.user_id) AND f.user_high=GREATEST(${userId}::uuid,other.user_id)
        WHERE other.conversation_id=c.id AND other.user_id<>${userId} AND other.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${userId} AND other.left_at IS NULL
          WHERE (b.blocker_id=${userId} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${userId})))
      OR (c.kind='group' AND EXISTS (SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)
        AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id=(SELECT g.id FROM haiku_groups g WHERE g.conversation_id=c.id) AND gm.user_id=${userId} AND gm.left_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=(SELECT g.id FROM haiku_groups g WHERE g.conversation_id=c.id) AND gm.user_id<>${userId} AND gm.left_at IS NULL
          WHERE (b.blocker_id=${userId} AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=${userId})))
    ) LIMIT 1`;
  return rows.length > 0;
}
mediaRoutes.post("/upload-intents", async (c) => {
  const limited = await enforceRateLimit(c, "media-upload-intent", 30, 600);
  if (limited) return limited;
  const user = c.get("user");
  const parsed = await parseJson(c, uploadIntentSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;
  try {
    if (getStorage().mode === "local" && input.byteSize > 10 * 1024 * 1024) return jsonError(c, 413, "LOCAL_MEDIA_LIMIT", "Local development uploads are limited to 10 MB. Configure signed object storage for larger files.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("CONFIG_")) return jsonError(c, 503, message, "Media storage is not configured.");
    return jsonError(c, 503, "MEDIA_STORAGE_UNAVAILABLE", "Media storage is not available.");
  }
  if (input.purpose === "message" && !await canUseConversation(user.id, input.conversationId)) return jsonError(c, 403, "MEDIA_NOT_ALLOWED", "You cannot attach media to this conversation.");
  if (input.purpose === "group") {
    const role = await getDb()`SELECT role FROM group_members WHERE group_id=${input.groupId} AND user_id=${user.id} AND left_at IS NULL LIMIT 1`;
    if (!role.length || !["owner", "admin"].includes(String(role[0].role))) return jsonError(c, 403, "GROUP_ADMIN_REQUIRED", "Only group admins can upload a group photo.");
  }
  try {
    const id = randomUUID7();
    const objectKey = newObjectKey();
    await getDb()`INSERT INTO attachments(id,owner_id,object_key,purpose,media_type,mime_type,byte_size,status)
      VALUES (${id},${user.id},${objectKey},${input.purpose},${input.mediaType},${input.mimeType.toLowerCase().split(";")[0]},${input.byteSize},'pending')`;
    const baseUrl = process.env.API_PUBLIC_URL || new URL(c.req.url).origin;
    const plan = await getStorage().uploadPlan(objectKey, input.mimeType, input.byteSize, baseUrl, id);
    return c.json({ attachmentId: id, objectKey, upload: plan }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("CONFIG_")) return jsonError(c, 503, message, "Media storage is not configured.");
    return jsonError(c, 503, "MEDIA_STORAGE_UNAVAILABLE", "Upload could not be prepared.");
  }
});
mediaRoutes.put("/:attachmentId/content", bodyLimit({ maxSize: 10 * 1024 * 1024 }), async (c) => {
  const user = c.get("user");
  const id = c.req.param("attachmentId");
  const rows = await getDb()`SELECT id,object_key,purpose,media_type,mime_type,byte_size,status,owner_id FROM attachments WHERE id=${id} AND owner_id=${user.id} LIMIT 1`;
  const attachment = rows[0];
  if (!attachment || attachment.status !== "pending") return jsonError(c, 404, "UPLOAD_NOT_FOUND", "Upload was not found or is no longer available.");
  let storage;
  try {
    storage = getStorage();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return jsonError(c, 503, message || "CONFIG_MEDIA_STORAGE_MISSING", "Media storage is not configured.");
  }
  if (storage.mode !== "local" || !storage.putLocal) return jsonError(c, 405, "USE_SIGNED_UPLOAD", "Upload the file to the temporary signed URL, then confirm it.");
  const contentType = c.req.header("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== attachment.mime_type) return jsonError(c, 415, "MEDIA_TYPE_MISMATCH", "The uploaded file type does not match the upload request.");
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength !== Number(attachment.byte_size)) return jsonError(c, 413, "MEDIA_SIZE_MISMATCH", "The uploaded file size does not match the declared size.");
  if (!verifyMediaSignature(attachment.media_type, attachment.mime_type, bytes)) return jsonError(c, 415, "MEDIA_SIGNATURE_INVALID", "The file contents do not match the declared media type.");
  try {
    await storage.putLocal(attachment.object_key, bytes);
    await getDb()`UPDATE attachments SET status='ready',ready_at=now() WHERE id=${id} AND owner_id=${user.id} AND status='pending'`;
    return c.json({ attachmentId: id, status: "ready" });
  } catch {
    return jsonError(c, 503, "MEDIA_WRITE_FAILED", "The upload could not be saved. Retry with a new upload.");
  }
});
mediaRoutes.post("/:attachmentId/complete", async (c) => {
  const user = c.get("user");
  const id = c.req.param("attachmentId");
  const rows = await getDb()`SELECT id,object_key,purpose,media_type,mime_type,byte_size,status,owner_id FROM attachments WHERE id=${id} AND owner_id=${user.id} LIMIT 1`;
  const attachment = rows[0];
  if (!attachment || attachment.status !== "pending") return jsonError(c, 404, "UPLOAD_NOT_FOUND", "Upload was not found or is no longer available.");
  try {
    const object = await getStorage().checkObject?.(attachment.object_key, attachment.mime_type);
    if (!object || object.byteSize !== Number(attachment.byte_size) || object.mimeType.toLowerCase().split(";")[0] !== attachment.mime_type || !verifyMediaSignature(attachment.media_type, attachment.mime_type, object.prefix)) {
      await getStorage().deleteObject(attachment.object_key).catch(() => void 0);
      await getDb()`UPDATE attachments SET status='failed' WHERE id=${id} AND owner_id=${user.id}`;
      return jsonError(c, 415, "MEDIA_VALIDATION_FAILED", "The uploaded file did not pass server validation.");
    }
    await getDb()`UPDATE attachments SET status='ready',ready_at=now() WHERE id=${id} AND owner_id=${user.id} AND status='pending'`;
    return c.json({ attachmentId: id, status: "ready" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("CONFIG_")) return jsonError(c, 503, message, "Media storage is not configured.");
    return jsonError(c, 503, "MEDIA_VERIFY_FAILED", "Upload could not be verified. Retry confirmation.");
  }
});
async function authorizedAttachment(userId, attachmentId) {
  const rows = await getDb()`SELECT a.id,a.object_key,a.mime_type,a.owner_id,a.purpose,a.media_type,a.expires_at,a.status,
      CASE WHEN a.purpose='message' THEN m.conversation_id ELSE NULL END AS conversation_id,
      CASE WHEN a.purpose='story' THEN s.user_id ELSE NULL END AS story_author,
      CASE WHEN a.purpose='group' THEN g.id ELSE NULL END AS group_id
    FROM attachments a
    LEFT JOIN messages m ON m.attachment_id=a.id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
    LEFT JOIN stories s ON s.attachment_id=a.id AND s.deleted_at IS NULL AND s.expires_at>now()
    LEFT JOIN haiku_groups g ON g.photo_object_key=a.object_key
    WHERE a.id=${attachmentId} AND a.status='ready' AND (a.expires_at IS NULL OR a.expires_at>now()) LIMIT 1`;
  const item = rows[0];
  if (!item) return null;
  if (item.owner_id === userId && (item.purpose === "avatar" || item.purpose === "report")) return item;
  if (item.purpose === "message" && item.conversation_id) {
    const access = await getDb()`SELECT 1 FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
      WHERE c.id=${item.conversation_id} AND cm.user_id=${userId} AND cm.left_at IS NULL AND (
        (c.kind='group' AND EXISTS (SELECT 1 FROM haiku_groups g WHERE g.conversation_id=c.id AND g.suspended_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${userId} AND b.blocked_id=${item.owner_id}) OR (b.blocker_id=${item.owner_id} AND b.blocked_id=${userId}))) OR (EXISTS (SELECT 1 FROM conversation_members other JOIN friendships f ON f.user_low=LEAST(${userId}::uuid,other.user_id) AND f.user_high=GREATEST(${userId}::uuid,other.user_id)
          WHERE other.conversation_id=c.id AND other.user_id<>${userId} AND other.left_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${userId} AND other.left_at IS NULL
            WHERE (b.blocker_id=${userId} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${userId})))
      ) LIMIT 1`;
    return access.length ? item : null;
  }
  if (item.purpose === "story" && item.story_author) {
    const access = await getDb()`SELECT 1 FROM users u WHERE u.id=${userId} AND u.status='active' AND u.email_verified_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id=${userId} AND blocked_id=${item.story_author}) OR (blocker_id=${item.story_author} AND blocked_id=${userId}))
      AND (${userId}=${item.story_author} OR EXISTS(SELECT 1 FROM friendships f WHERE f.user_low=LEAST(${userId}::uuid,${item.story_author}::uuid) AND f.user_high=GREATEST(${userId}::uuid,${item.story_author}::uuid))) LIMIT 1`;
    return access.length ? item : null;
  }
  if (item.purpose === "group" && item.group_id) {
    const access = await getDb()`SELECT 1 FROM group_members mine JOIN users u ON u.id=mine.user_id JOIN haiku_groups g ON g.id=mine.group_id
      WHERE mine.group_id=${item.group_id} AND mine.user_id=${userId} AND mine.left_at IS NULL AND u.status='active' AND g.suspended_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${userId} AND b.blocked_id=${item.owner_id}) OR (b.blocker_id=${item.owner_id} AND b.blocked_id=${userId})) LIMIT 1`;
    return access.length ? item : null;
  }
  return null;
}
mediaRoutes.get("/avatars/:userId", async (c) => {
  const viewer = c.get("user"), ownerId = c.req.param("userId");
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) return jsonError(c, 404, "MEDIA_NOT_FOUND", "This media is unavailable.");
  const rows = await getDb()`SELECT p.avatar_object_key,a.id,a.object_key,a.mime_type,a.expires_at
    FROM user_profiles p JOIN users u ON u.id=p.user_id
    JOIN attachments a ON a.owner_id=p.user_id AND a.object_key=p.avatar_object_key AND a.purpose='avatar' AND a.status='ready'
    WHERE p.user_id=${ownerId} AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL
      AND (a.expires_at IS NULL OR a.expires_at>now())
      AND (${viewer.id}=${ownerId} OR NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${viewer.id} AND b.blocked_id=${ownerId}) OR (b.blocker_id=${ownerId} AND b.blocked_id=${viewer.id}))) LIMIT 1`;
  if (!rows.length) return jsonError(c, 404, "MEDIA_NOT_FOUND", "This media is unavailable.");
  const item = rows[0];
  try {
    return c.json({ ...await getStorage().downloadUrl(item.object_key, process.env.API_PUBLIC_URL || new URL(c.req.url).origin), mimeType: item.mime_type, expiresAt: item.expires_at });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("CONFIG_")) return jsonError(c, 503, message, "Media storage is not configured.");
    return jsonError(c, 503, "MEDIA_URL_FAILED", "Media could not be opened.");
  }
});
mediaRoutes.delete("/:attachmentId", async (c) => {
  const user = c.get("user"), id = c.req.param("attachmentId");
  const rows = await getDb()`SELECT a.object_key,a.status FROM attachments a WHERE a.id=${id} AND a.owner_id=${user.id}
    AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.attachment_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM stories s WHERE s.attachment_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM reports r WHERE r.evidence_attachment_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM haiku_groups g WHERE g.photo_object_key=a.object_key)
    AND NOT EXISTS(SELECT 1 FROM user_profiles p WHERE p.avatar_object_key=a.object_key) LIMIT 1`;
  if (!rows.length) return jsonError(c, 404, "MEDIA_NOT_FOUND", "This attachment cannot be deleted or is already in use.");
  const key = String(rows[0].object_key);
  try {
    await getStorage().deleteObject(key);
  } catch {
  }
  await getDb()`UPDATE attachments SET status='failed',expires_at=now() WHERE id=${id} AND owner_id=${user.id}`;
  return c.json({ status: "deleted" });
});
mediaRoutes.get("/:attachmentId", async (c) => {
  const user = c.get("user");
  const attachment = await authorizedAttachment(user.id, c.req.param("attachmentId"));
  if (!attachment) return jsonError(c, 404, "MEDIA_NOT_FOUND", "This media is unavailable.");
  try {
    const url = await getStorage().downloadUrl(attachment.object_key, process.env.API_PUBLIC_URL || new URL(c.req.url).origin);
    return c.json({ ...url, mimeType: attachment.mime_type, expiresAt: attachment.expires_at });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("CONFIG_")) return jsonError(c, 503, message, "Media storage is not configured.");
    return jsonError(c, 503, "MEDIA_URL_FAILED", "Media could not be opened.");
  }
});
mediaRoutes.get("/object/:objectKey", async (c) => {
  const user = c.get("user");
  let attachmentId = null;
  const rows = await getDb()`SELECT id FROM attachments WHERE object_key=${c.req.param("objectKey")} LIMIT 1`;
  if (rows.length) attachmentId = String(rows[0].id);
  if (!attachmentId) return jsonError(c, 404, "MEDIA_NOT_FOUND", "This media is unavailable.");
  const attachment = await authorizedAttachment(user.id, attachmentId);
  if (!attachment) return jsonError(c, 404, "MEDIA_NOT_FOUND", "This media is unavailable.");
  try {
    const storage = getStorage();
    if (storage.mode !== "local" || !storage.readLocal) return jsonError(c, 404, "MEDIA_NOT_FOUND", "This media is unavailable.");
    const bytes = await storage.readLocal(attachment.object_key);
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new Response(body.buffer, { headers: { "Content-Type": attachment.mime_type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return jsonError(c, 404, "MEDIA_NOT_FOUND", "This media is unavailable.");
  }
});

// src/routes/groups.ts
import { randomBytes as randomBytes2, randomUUID as randomUUID8 } from "node:crypto";
import { Hono as Hono6 } from "hono";
import { z as z6 } from "zod";
var groupRoutes = new Hono6();
groupRoutes.use("*", requireUser);
var uuid = z6.string().uuid();
var createGroupSchema = z6.object({ name: z6.string().trim().min(1).max(80), memberIds: z6.array(uuid).max(99).default([]) }).strict();
var addMembersSchema = z6.object({ userIds: z6.array(uuid).min(1).max(99) }).strict();
var inviteSchema = z6.object({ expiresInHours: z6.number().int().min(1).max(720).default(168), maxUses: z6.number().int().min(1).max(500).default(25), approvalRequired: z6.boolean().default(false) }).strict();
var patchGroupSchema = z6.object({ name: z6.string().trim().min(1).max(80).optional(), photoAttachmentId: z6.string().uuid().nullable().optional() }).strict().refine((value) => Object.keys(value).length > 0, "Provide a group name or photo change.");
async function roleFor(userId, groupId) {
  const rows = await getDb()`SELECT gm.role FROM group_members gm JOIN haiku_groups g ON g.id=gm.group_id WHERE gm.user_id=${userId} AND gm.group_id=${groupId} AND gm.left_at IS NULL AND g.suspended_at IS NULL LIMIT 1`;
  return rows[0]?.role || null;
}
async function groupConversation(groupId) {
  const rows = await getDb()`SELECT id,conversation_id,name,owner_id FROM haiku_groups WHERE id=${groupId} AND suspended_at IS NULL LIMIT 1`;
  return rows[0];
}
function inviteUrl(token) {
  const base = (process.env.MOBILE_INVITE_BASE_URL || "haikumessenger://join/").trim().replace(/\/?$/, "/");
  return `${base}${encodeURIComponent(token)}`;
}
groupRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT g.id,g.conversation_id,g.name,g.photo_object_key,g.owner_id,gm.role,gm.joined_at,
      (SELECT count(*)::int FROM group_members x WHERE x.group_id=g.id AND x.left_at IS NULL) AS member_count,
      (SELECT m.body FROM messages m WHERE m.conversation_id=g.conversation_id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now()) ORDER BY m.created_at DESC LIMIT 1) AS last_message
    FROM group_members gm JOIN haiku_groups g ON g.id=gm.group_id
    WHERE gm.user_id=${user.id} AND gm.left_at IS NULL AND g.suspended_at IS NULL ORDER BY g.updated_at DESC LIMIT 100`;
  return c.json({ groups: rows });
});
groupRoutes.post("/", async (c) => {
  const limited = await enforceRateLimit(c, "group-create", 10, 86400);
  if (limited) return limited;
  const user = c.get("user");
  const parsed = await parseJson(c, createGroupSchema);
  if ("response" in parsed) return parsed.response;
  const ids = [...new Set(parsed.data.memberIds)].filter((id) => id !== user.id);
  if (ids.length !== parsed.data.memberIds.filter((id) => id !== user.id).length) return jsonError(c, 422, "DUPLICATE_MEMBER", "Remove duplicate group members.");
  if (ids.length) {
    const rows = await getDb()`SELECT u.id FROM users u WHERE u.id=ANY(${ids}::uuid[]) AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=${user.id}))`;
    if (rows.length !== ids.length) return jsonError(c, 422, "GROUP_MEMBER_INVALID", "One or more selected people are unavailable or blocked.");
  }
  const groupId = randomUUID8(), conversationId = randomUUID8();
  try {
    const queries = [
      getDb()`INSERT INTO conversations(id,kind,created_by) VALUES (${conversationId},'group',${user.id})`,
      getDb()`INSERT INTO haiku_groups(id,conversation_id,name,owner_id) VALUES (${groupId},${conversationId},${parsed.data.name},${user.id})`,
      getDb()`INSERT INTO conversation_members(conversation_id,user_id) VALUES (${conversationId},${user.id})`,
      getDb()`INSERT INTO group_members(group_id,user_id,role,added_by) VALUES (${groupId},${user.id},'owner',${user.id})`
    ];
    for (const id of ids) {
      queries.push(getDb()`INSERT INTO conversation_members(conversation_id,user_id) VALUES (${conversationId},${id})`);
      queries.push(getDb()`INSERT INTO group_members(group_id,user_id,role,added_by) VALUES (${groupId},${id},'member',${user.id})`);
    }
    await getDb().transaction(queries);
    for (const id of ids) {
      try {
        await createNotification(id, "group_membership", user.id, groupId, { name: parsed.data.name });
      } catch {
      }
    }
    return c.json({ group: { id: groupId, conversationId, name: parsed.data.name, ownerId: user.id, memberCount: ids.length + 1 } }, 201);
  } catch {
    return jsonError(c, 503, "GROUP_CREATE_FAILED", "The group could not be created.");
  }
});
groupRoutes.get("/:groupId", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId");
  const role = await roleFor(user.id, groupId);
  if (!role) return jsonError(c, 404, "GROUP_NOT_FOUND", "Group not found.");
  const rows = await getDb()`SELECT g.id,g.name,g.photo_object_key,g.owner_id,g.created_at,g.updated_at,
      (SELECT count(*)::int FROM group_members m WHERE m.group_id=g.id AND m.left_at IS NULL) AS member_count
    FROM haiku_groups g WHERE g.id=${groupId} LIMIT 1`;
  return c.json({ group: rows[0], role });
});
groupRoutes.patch("/:groupId", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId"), role = await roleFor(user.id, groupId);
  if (!role || !["owner", "admin"].includes(role)) return jsonError(c, 403, "GROUP_ADMIN_REQUIRED", "Only the owner or an admin can change group details.");
  const parsed = await parseJson(c, patchGroupSchema);
  if ("response" in parsed) return parsed.response;
  let photoKey = null;
  if (parsed.data.photoAttachmentId) {
    const rows2 = await getDb()`SELECT object_key FROM attachments WHERE id=${parsed.data.photoAttachmentId} AND owner_id=${user.id} AND purpose='group' AND media_type='image' AND status='ready' LIMIT 1`;
    if (!rows2.length) return jsonError(c, 422, "GROUP_PHOTO_INVALID", "Upload a valid group photo first.");
    photoKey = String(rows2[0].object_key);
  }
  const rows = await getDb()`UPDATE haiku_groups SET
      name=CASE WHEN ${parsed.data.name !== void 0} THEN ${parsed.data.name ?? null} ELSE name END,
      photo_object_key=CASE WHEN ${parsed.data.photoAttachmentId !== void 0} THEN ${photoKey} ELSE photo_object_key END,
      updated_at=now() WHERE id=${groupId} AND suspended_at IS NULL RETURNING id,name,photo_object_key,owner_id,updated_at`;
  if (!rows.length) return jsonError(c, 404, "GROUP_NOT_FOUND", "Group not found or suspended.");
  return c.json({ group: rows[0] });
});
groupRoutes.get("/:groupId/members", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId");
  if (!await roleFor(user.id, groupId)) return jsonError(c, 404, "GROUP_NOT_FOUND", "Group not found.");
  const rows = await getDb()`SELECT gm.user_id AS id,gm.role,gm.joined_at,p.username,p.display_name,p.avatar_object_key
    FROM group_members gm JOIN user_profiles p ON p.user_id=gm.user_id JOIN users u ON u.id=gm.user_id
    WHERE gm.group_id=${groupId} AND gm.left_at IS NULL AND u.status='active' ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,p.display_name LIMIT 100`;
  return c.json({ members: rows });
});
groupRoutes.post("/:groupId/members", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId");
  const role = await roleFor(user.id, groupId);
  if (!role || !["owner", "admin"].includes(role)) return jsonError(c, 403, "GROUP_ADMIN_REQUIRED", "Only the group owner or an admin can add members.");
  const parsed = await parseJson(c, addMembersSchema);
  if ("response" in parsed) return parsed.response;
  const group = await groupConversation(groupId);
  if (!group) return jsonError(c, 404, "GROUP_NOT_FOUND", "Group not found.");
  const ids = [...new Set(parsed.data.userIds)].filter((id) => id !== user.id);
  if (ids.length !== parsed.data.userIds.filter((id) => id !== user.id).length) return jsonError(c, 422, "DUPLICATE_MEMBER", "Remove duplicate users.");
  const available = await getDb()`SELECT u.id FROM users u WHERE u.id=ANY(${ids}::uuid[]) AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=${groupId} AND gm.left_at IS NULL
      WHERE (b.blocker_id=u.id AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=u.id))`;
  if (available.length !== ids.length) return jsonError(c, 422, "GROUP_MEMBER_INVALID", "One or more people are unavailable or blocked by a group member.");
  const queries = [];
  for (const id of ids) {
    queries.push(getDb()`INSERT INTO group_members(group_id,user_id,role,added_by) VALUES (${groupId},${id},'member',${user.id}) ON CONFLICT(group_id,user_id) DO UPDATE SET left_at=NULL,role='member',joined_at=now(),added_by=${user.id}`);
    queries.push(getDb()`INSERT INTO conversation_members(conversation_id,user_id) VALUES (${group.conversation_id},${id}) ON CONFLICT(conversation_id,user_id) DO UPDATE SET left_at=NULL,joined_at=now()`);
  }
  await getDb().transaction(queries);
  for (const id of ids) {
    try {
      await createNotification(id, "group_membership", user.id, groupId, { name: group.name });
    } catch {
    }
  }
  return c.json({ added: ids.length });
});
groupRoutes.delete("/:groupId/members/:memberId", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId"), memberId = c.req.param("memberId");
  const group = await groupConversation(groupId);
  if (!group || group.owner_id !== user.id) return jsonError(c, 403, "GROUP_OWNER_REQUIRED", "Only the owner can remove existing members.");
  if (memberId === user.id) return jsonError(c, 409, "OWNER_CANNOT_REMOVE_SELF", "Transfer group ownership before leaving.");
  const rows = await getDb()`WITH removed AS (
      UPDATE group_members SET left_at=now() WHERE group_id=${groupId} AND user_id=${memberId} AND left_at IS NULL AND role<>'owner' RETURNING user_id
    ), left_conversation AS (
      UPDATE conversation_members cm SET left_at=now() FROM removed
      WHERE cm.conversation_id=${group.conversation_id} AND cm.user_id=removed.user_id AND cm.left_at IS NULL RETURNING cm.user_id
    ) SELECT user_id FROM left_conversation`;
  if (!rows.length) return jsonError(c, 404, "GROUP_MEMBER_NOT_FOUND", "Group member not found.");
  return c.json({ status: "removed" });
});
groupRoutes.put("/:groupId/admins/:memberId", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId"), memberId = c.req.param("memberId");
  const group = await groupConversation(groupId);
  if (!group || group.owner_id !== user.id) return jsonError(c, 403, "GROUP_OWNER_REQUIRED", "Only the owner can appoint administrators.");
  const rows = await getDb()`UPDATE group_members SET role='admin' WHERE group_id=${groupId} AND user_id=${memberId} AND left_at IS NULL AND role='member' RETURNING user_id`;
  if (!rows.length) return jsonError(c, 404, "GROUP_MEMBER_NOT_FOUND", "Active member not found.");
  return c.json({ status: "admin_assigned" });
});
groupRoutes.delete("/:groupId/admins/:memberId", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId"), memberId = c.req.param("memberId");
  const group = await groupConversation(groupId);
  if (!group || group.owner_id !== user.id) return jsonError(c, 403, "GROUP_OWNER_REQUIRED", "Only the owner can change administrator roles.");
  const rows = await getDb()`UPDATE group_members SET role='member' WHERE group_id=${groupId} AND user_id=${memberId} AND left_at IS NULL AND role='admin' RETURNING user_id`;
  if (!rows.length) return jsonError(c, 404, "GROUP_ADMIN_NOT_FOUND", "Group administrator not found.");
  return c.json({ status: "admin_removed" });
});
groupRoutes.put("/:groupId/owner/:memberId", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId"), nextOwner = c.req.param("memberId");
  const group = await groupConversation(groupId);
  if (!group || group.owner_id !== user.id) return jsonError(c, 403, "GROUP_OWNER_REQUIRED", "Only the current owner can transfer ownership.");
  const member = await roleFor(nextOwner, groupId);
  if (!member) return jsonError(c, 404, "GROUP_MEMBER_NOT_FOUND", "The new owner must already be a group member.");
  await getDb().transaction([
    getDb()`UPDATE group_members SET role='admin' WHERE group_id=${groupId} AND user_id=${user.id} AND role='owner'`,
    getDb()`UPDATE group_members SET role='owner' WHERE group_id=${groupId} AND user_id=${nextOwner} AND left_at IS NULL`,
    getDb()`UPDATE haiku_groups SET owner_id=${nextOwner},updated_at=now() WHERE id=${groupId}`
  ]);
  return c.json({ status: "ownership_transferred", ownerId: nextOwner });
});
groupRoutes.get("/:groupId/invites", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId");
  const role = await roleFor(user.id, groupId);
  if (!role || !["owner", "admin"].includes(role)) return jsonError(c, 403, "GROUP_ADMIN_REQUIRED", "Only the owner or an admin can manage invitation links.");
  const limited = await enforceRateLimit(c, "group-invite-list", 60, 3600);
  if (limited) return limited;
  const rows = await getDb()`SELECT id,created_at,expires_at,max_uses,uses,approval_required
    FROM group_invite_links WHERE group_id=${groupId} AND revoked_at IS NULL AND expires_at>now() AND uses<max_uses
    ORDER BY created_at DESC LIMIT 50`;
  return c.json({ invites: rows });
});
groupRoutes.post("/:groupId/invites", async (c) => {
  const limited = await enforceRateLimit(c, "group-invite", 20, 3600);
  if (limited) return limited;
  const user = c.get("user"), groupId = c.req.param("groupId");
  const role = await roleFor(user.id, groupId);
  if (!role || !["owner", "admin"].includes(role)) return jsonError(c, 403, "GROUP_ADMIN_REQUIRED", "Only the owner or an admin can create invitation links.");
  const parsed = await parseJson(c, inviteSchema);
  if ("response" in parsed) return parsed.response;
  const token = randomBytes2(32).toString("base64url"), id = randomUUID8();
  try {
    const rows = await getDb()`INSERT INTO group_invite_links(id,group_id,token_hash,created_by,expires_at,max_uses,approval_required)
      SELECT ${id},g.id,${sha256(token)},${user.id},now()+(${parsed.data.expiresInHours}*interval '1 hour'),${parsed.data.maxUses},${parsed.data.approvalRequired}
      FROM haiku_groups g WHERE g.id=${groupId} AND g.suspended_at IS NULL RETURNING id`;
    if (!rows.length) return jsonError(c, 404, "GROUP_NOT_FOUND", "Group not found or suspended.");
  } catch {
    return jsonError(c, 503, "INVITE_CREATE_FAILED", "The invitation link could not be created.");
  }
  return c.json({ invite: { id, token, url: inviteUrl(token), expiresInHours: parsed.data.expiresInHours, maxUses: parsed.data.maxUses, approvalRequired: parsed.data.approvalRequired } }, 201);
});
groupRoutes.delete("/:groupId/invites/:inviteId", async (c) => {
  const limited = await enforceRateLimit(c, "group-invite-revoke", 30, 3600);
  if (limited) return limited;
  const user = c.get("user"), groupId = c.req.param("groupId");
  const role = await roleFor(user.id, groupId);
  if (!role || !["owner", "admin"].includes(role)) return jsonError(c, 403, "GROUP_ADMIN_REQUIRED", "Only the owner or an admin can revoke invitation links.");
  const rows = await getDb()`UPDATE group_invite_links SET revoked_at=now() WHERE id=${c.req.param("inviteId")} AND group_id=${groupId} AND revoked_at IS NULL RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "INVITE_NOT_FOUND", "Invitation link is no longer active.");
  return c.json({ status: "revoked" });
});
groupRoutes.post("/join/:token", async (c) => {
  const limited = await enforceRateLimit(c, "group-join", 20, 3600);
  if (limited) return limited;
  const user = c.get("user"), token = c.req.param("token");
  if (token.length < 32 || token.length > 128) return jsonError(c, 404, "INVITE_INVALID", "This invitation is invalid or expired.");
  const existing = await getDb()`SELECT 1 FROM group_invite_links l JOIN group_members gm ON gm.group_id=l.group_id
    WHERE l.token_hash=${sha256(token)} AND gm.user_id=${user.id} AND gm.left_at IS NULL LIMIT 1`;
  if (existing.length) return jsonError(c, 409, "ALREADY_MEMBER", "You are already in this group.");
  const invite = await getDb()`SELECT l.id,l.group_id,l.approval_required,g.conversation_id,g.name FROM group_invite_links l JOIN haiku_groups g ON g.id=l.group_id
    WHERE l.token_hash=${sha256(token)} AND l.revoked_at IS NULL AND l.expires_at>now() AND l.uses<l.max_uses AND g.suspended_at IS NULL LIMIT 1`;
  if (!invite.length) return jsonError(c, 404, "INVITE_INVALID", "This invitation is invalid, expired, or no longer has places.");
  const value = invite[0];
  const blocked = await getDb()`SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=${value.group_id} AND gm.left_at IS NULL
    WHERE (b.blocker_id=${user.id} AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=${user.id}) LIMIT 1`;
  if (blocked.length) return jsonError(c, 403, "BLOCKED_GROUP_MEMBER", "A group member has blocked you or is blocked by you.");
  if (value.approval_required) {
    const pending = await getDb()`SELECT 1 FROM group_join_requests WHERE group_id=${value.group_id} AND user_id=${user.id} AND status='pending' LIMIT 1`;
    if (pending.length) return jsonError(c, 409, "JOIN_REQUEST_PENDING", "You already have a pending request for this group.");
    const requestId = randomUUID8();
    try {
      const requested = await getDb()`WITH claimed AS (
          UPDATE group_invite_links l SET uses=l.uses+1
          FROM haiku_groups g
          WHERE l.id=${value.id} AND l.group_id=g.id AND l.approval_required=true AND l.revoked_at IS NULL
            AND l.expires_at>now() AND l.uses<l.max_uses AND g.suspended_at IS NULL
            AND NOT EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=l.group_id AND gm.user_id=${user.id} AND gm.left_at IS NULL)
            AND NOT EXISTS(SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=l.group_id AND gm.left_at IS NULL
              WHERE (b.blocker_id=${user.id} AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=${user.id}))
            AND NOT EXISTS(SELECT 1 FROM group_join_requests r WHERE r.group_id=l.group_id AND r.user_id=${user.id} AND r.status='pending')
          RETURNING l.id AS invite_id,l.group_id
        ), created AS (
          INSERT INTO group_join_requests(id,group_id,invite_id,user_id)
          SELECT ${requestId},claimed.group_id,claimed.invite_id,${user.id} FROM claimed
          RETURNING id,group_id,invite_id
        ) SELECT created.id,claimed.group_id,g.name FROM created JOIN claimed ON claimed.invite_id=created.invite_id
          JOIN haiku_groups g ON g.id=claimed.group_id`;
      if (!requested.length) {
        const pending2 = await getDb()`SELECT 1 FROM group_join_requests WHERE group_id=${value.group_id} AND user_id=${user.id} AND status='pending' LIMIT 1`;
        if (pending2.length) return jsonError(c, 409, "JOIN_REQUEST_PENDING", "You already have a pending request for this group.");
        return jsonError(c, 404, "INVITE_INVALID", "This invitation is invalid, expired, or no longer available.");
      }
      try {
        const admins = await getDb()`SELECT user_id FROM group_members WHERE group_id=${value.group_id} AND left_at IS NULL AND role IN ('owner','admin')`;
        for (const admin of admins) {
          const adminId = String(admin.user_id);
          if (adminId !== user.id) try {
            await createNotification(adminId, "group_invite", user.id, value.group_id, { groupName: value.name, requestId });
          } catch {
          }
        }
      } catch {
      }
      return c.json({ status: "approval_required", requestId, groupName: value.name }, 202);
    } catch (error) {
      if (error?.code === "23505") return jsonError(c, 409, "JOIN_REQUEST_PENDING", "You already have a pending request for this group.");
      return jsonError(c, 503, "JOIN_REQUEST_FAILED", "Your request could not be submitted.");
    }
  }
  try {
    const joined = await getDb()`WITH claimed AS (
        UPDATE group_invite_links l SET uses=l.uses+1
        FROM haiku_groups g
        WHERE l.id=${value.id} AND l.group_id=g.id AND l.approval_required=false AND l.revoked_at IS NULL
          AND l.expires_at>now() AND l.uses<l.max_uses AND g.suspended_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=l.group_id AND gm.user_id=${user.id} AND gm.left_at IS NULL)
          AND NOT EXISTS(SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=l.group_id AND gm.left_at IS NULL
            WHERE (b.blocker_id=${user.id} AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=${user.id}))
        RETURNING l.group_id
      ), member AS (
        INSERT INTO group_members(group_id,user_id,role,added_by)
        SELECT claimed.group_id,${user.id},'member',NULL FROM claimed
        ON CONFLICT(group_id,user_id) DO UPDATE SET left_at=NULL,role='member',joined_at=now()
        RETURNING group_id,user_id
      ), conversation_member AS (
        INSERT INTO conversation_members(conversation_id,user_id)
        SELECT g.conversation_id,member.user_id FROM member JOIN haiku_groups g ON g.id=member.group_id
        ON CONFLICT(conversation_id,user_id) DO UPDATE SET left_at=NULL,joined_at=now()
        RETURNING conversation_id,user_id
      ) SELECT member.group_id FROM member JOIN conversation_member ON conversation_member.user_id=member.user_id`;
    if (!joined.length) return jsonError(c, 404, "INVITE_INVALID", "This invitation is invalid, expired, or no longer available.");
    return c.json({ status: "joined", groupId: String(joined[0].group_id) }, 201);
  } catch {
    return jsonError(c, 503, "GROUP_JOIN_FAILED", "You could not join this group. Please retry.");
  }
});
groupRoutes.get("/:groupId/join-requests", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId"), role = await roleFor(user.id, groupId);
  if (!role || !["owner", "admin"].includes(role)) return jsonError(c, 403, "GROUP_ADMIN_REQUIRED", "Only the owner or an admin can review requests.");
  const rows = await getDb()`SELECT r.id,r.created_at,p.user_id AS user_id,p.username,p.display_name FROM group_join_requests r
    JOIN user_profiles p ON p.user_id=r.user_id WHERE r.group_id=${groupId} AND r.status='pending' ORDER BY r.created_at LIMIT 100`;
  return c.json({ requests: rows });
});
groupRoutes.post("/:groupId/join-requests/:requestId/accept", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId"), role = await roleFor(user.id, groupId);
  if (!role || !["owner", "admin"].includes(role)) return jsonError(c, 403, "GROUP_ADMIN_REQUIRED", "Only the owner or an admin can accept requests.");
  const group = await groupConversation(groupId);
  if (!group) return jsonError(c, 404, "GROUP_NOT_FOUND", "Group not found.");
  const rows = await getDb()`WITH accepted AS (
      UPDATE group_join_requests SET status='accepted',resolved_at=now()
      WHERE id=${c.req.param("requestId")} AND group_id=${groupId} AND status='pending'
        AND EXISTS(SELECT 1 FROM users u WHERE u.id=group_join_requests.user_id AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM blocks b JOIN group_members gm ON gm.group_id=group_join_requests.group_id AND gm.left_at IS NULL
          WHERE (b.blocker_id=group_join_requests.user_id AND b.blocked_id=gm.user_id) OR (b.blocker_id=gm.user_id AND b.blocked_id=group_join_requests.user_id))
        AND (invite_id IS NULL OR EXISTS(SELECT 1 FROM group_invite_links l WHERE l.id=group_join_requests.invite_id AND l.revoked_at IS NULL AND l.expires_at>now()))
      RETURNING user_id
    ), member AS (
      INSERT INTO group_members(group_id,user_id,role,added_by)
        SELECT ${groupId},accepted.user_id,'member',${user.id} FROM accepted
        ON CONFLICT(group_id,user_id) DO UPDATE SET left_at=NULL,role='member',joined_at=now()
        RETURNING user_id
    ), conversation_member AS (
      INSERT INTO conversation_members(conversation_id,user_id)
        SELECT ${group.conversation_id},member.user_id FROM member
        ON CONFLICT(conversation_id,user_id) DO UPDATE SET left_at=NULL,joined_at=now()
        RETURNING user_id
    ) SELECT accepted.user_id FROM accepted JOIN conversation_member USING(user_id)`;
  if (!rows.length) return jsonError(c, 404, "JOIN_REQUEST_NOT_FOUND", "Request is no longer available.");
  const newMember = String(rows[0].user_id);
  return c.json({ status: "accepted", userId: newMember });
});
groupRoutes.post("/:groupId/join-requests/:requestId/reject", async (c) => {
  const user = c.get("user"), groupId = c.req.param("groupId"), role = await roleFor(user.id, groupId);
  if (!role || !["owner", "admin"].includes(role)) return jsonError(c, 403, "GROUP_ADMIN_REQUIRED", "Only the owner or an admin can reject requests.");
  const rows = await getDb()`UPDATE group_join_requests SET status='rejected',resolved_at=now() WHERE id=${c.req.param("requestId")} AND group_id=${groupId} AND status='pending' RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "JOIN_REQUEST_NOT_FOUND", "Request is no longer available.");
  return c.json({ status: "rejected" });
});

// src/routes/stories.ts
import { randomUUID as randomUUID9 } from "node:crypto";
import { Hono as Hono7 } from "hono";
import { z as z7 } from "zod";
var storyRoutes = new Hono7();
storyRoutes.use("*", requireUser);
storyRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT s.id,s.user_id,s.media_type,s.caption,s.created_at,s.expires_at,
      p.username,p.display_name,p.avatar_object_key,a.id AS attachment_id,
      (SELECT count(*)::int FROM story_views v WHERE v.story_id=s.id) AS view_count,
      EXISTS(SELECT 1 FROM story_views v WHERE v.story_id=s.id AND v.viewer_id=${user.id}) AS viewed
    FROM stories s JOIN users u ON u.id=s.user_id JOIN user_profiles p ON p.user_id=s.user_id
    JOIN attachments a ON a.id=s.attachment_id AND a.status='ready'
    WHERE s.deleted_at IS NULL AND s.expires_at>now() AND u.status='active' AND u.email_verified_at IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=s.user_id) OR (b.blocker_id=s.user_id AND b.blocked_id=${user.id}))
      AND (s.user_id=${user.id} OR EXISTS(SELECT 1 FROM friendships f WHERE f.user_low=LEAST(${user.id}::uuid,s.user_id) AND f.user_high=GREATEST(${user.id}::uuid,s.user_id)))
    ORDER BY s.created_at DESC LIMIT 200`;
  return c.json({ stories: rows });
});
storyRoutes.post("/", async (c) => {
  const limited = await enforceRateLimit(c, "story-create", 20, 86400);
  if (limited) return limited;
  const user = c.get("user");
  const parsed = await parseJson(c, storyCreateSchema);
  if ("response" in parsed) return parsed.response;
  const { attachmentId, caption, mediaType } = parsed.data;
  const id = randomUUID9();
  const rows = await getDb()`WITH ready AS (
      UPDATE attachments SET expires_at=now()+interval '24 hours'
      WHERE id=${attachmentId} AND owner_id=${user.id} AND purpose='story' AND media_type=${mediaType} AND status='ready'
        AND (expires_at IS NULL OR expires_at>now()) RETURNING id
    ) INSERT INTO stories(id,user_id,attachment_id,media_type,caption,expires_at)
      SELECT ${id},${user.id},ready.id,${mediaType},${caption ?? null},now()+interval '24 hours' FROM ready
      RETURNING id,user_id,media_type,caption,created_at,expires_at,attachment_id`;
  if (!rows.length) return jsonError(c, 422, "STORY_MEDIA_INVALID", "Upload a valid photo or video before posting.");
  return c.json({ story: rows[0] }, 201);
});
storyRoutes.get("/:storyId", async (c) => {
  const user = c.get("user"), storyId = c.req.param("storyId");
  const rows = await getDb()`SELECT s.id,s.user_id,s.media_type,s.caption,s.created_at,s.expires_at,a.id AS attachment_id,
      p.username,p.display_name,p.avatar_object_key
    FROM stories s JOIN users u ON u.id=s.user_id JOIN user_profiles p ON p.user_id=s.user_id JOIN attachments a ON a.id=s.attachment_id
    WHERE s.id=${storyId} AND s.deleted_at IS NULL AND s.expires_at>now() AND a.status='ready'
      AND u.status='active' AND u.email_verified_at IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=s.user_id) OR (b.blocker_id=s.user_id AND b.blocked_id=${user.id}))
      AND (s.user_id=${user.id} OR EXISTS(SELECT 1 FROM friendships f WHERE f.user_low=LEAST(${user.id}::uuid,s.user_id) AND f.user_high=GREATEST(${user.id}::uuid,s.user_id))) LIMIT 1`;
  if (!rows.length) return jsonError(c, 404, "STORY_NOT_FOUND", "This story is no longer available.");
  const story = rows[0];
  if (story.user_id !== user.id) await getDb()`INSERT INTO story_views(story_id,viewer_id) VALUES (${storyId},${user.id}) ON CONFLICT(story_id,viewer_id) DO UPDATE SET viewed_at=now()`;
  return c.json({ story });
});
storyRoutes.get("/:storyId/viewers", async (c) => {
  const user = c.get("user"), storyId = c.req.param("storyId");
  const owns = await getDb()`SELECT 1 FROM stories WHERE id=${storyId} AND user_id=${user.id} AND deleted_at IS NULL LIMIT 1`;
  if (!owns.length) return jsonError(c, 404, "STORY_NOT_FOUND", "Story not found.");
  const rows = await getDb()`SELECT v.viewed_at,p.user_id AS id,p.username,p.display_name,p.avatar_object_key
    FROM story_views v JOIN user_profiles p ON p.user_id=v.viewer_id JOIN users u ON u.id=v.viewer_id
    WHERE v.story_id=${storyId} AND u.status='active' AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=v.viewer_id) OR (b.blocker_id=v.viewer_id AND b.blocked_id=${user.id}))
    ORDER BY v.viewed_at DESC LIMIT 500`;
  return c.json({ viewers: rows });
});
storyRoutes.post("/:storyId/replies", async (c) => {
  const user = c.get("user"), storyId = c.req.param("storyId");
  const parsed = await parseJson(c, z7.object({ text: z7.string().trim().min(1).max(1e3) }).strict());
  if ("response" in parsed) return parsed.response;
  const story = await getDb()`SELECT user_id FROM stories WHERE id=${storyId} AND deleted_at IS NULL AND expires_at>now() LIMIT 1`;
  if (!story.length) return jsonError(c, 404, "STORY_NOT_FOUND", "This story is no longer available.");
  const recipient = String(story[0].user_id);
  if (recipient === user.id) return jsonError(c, 409, "OWN_STORY_REPLY", "You cannot reply to your own story.");
  const blocked = await getDb()`SELECT 1 FROM blocks WHERE (blocker_id=${user.id} AND blocked_id=${recipient}) OR (blocker_id=${recipient} AND blocked_id=${user.id}) LIMIT 1`;
  if (blocked.length) return jsonError(c, 404, "STORY_NOT_FOUND", "This story is no longer available.");
  const friends = await getDb()`SELECT 1 FROM friendships WHERE user_low=LEAST(${user.id}::uuid,${recipient}::uuid) AND user_high=GREATEST(${user.id}::uuid,${recipient}::uuid) LIMIT 1`;
  if (!friends.length) return jsonError(c, 404, "STORY_NOT_FOUND", "This story is no longer available.");
  const id = randomUUID9();
  await getDb()`INSERT INTO story_replies(id,story_id,sender_id,body) VALUES (${id},${storyId},${user.id},${parsed.data.text})`;
  try {
    await createNotification(recipient, "story_reply", user.id, id, { storyId });
  } catch {
  }
  return c.json({ reply: { id, storyId, createdAt: (/* @__PURE__ */ new Date()).toISOString() } }, 201);
});
storyRoutes.get("/replies/inbox", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT r.id,r.story_id,r.body,r.created_at,p.user_id AS sender_id,p.username,p.display_name
    FROM story_replies r JOIN stories s ON s.id=r.story_id JOIN user_profiles p ON p.user_id=r.sender_id
    WHERE s.user_id=${user.id} AND s.deleted_at IS NULL AND s.expires_at>now() AND r.created_at>now()-interval '7 days'
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=${user.id} AND b.blocked_id=r.sender_id) OR (b.blocker_id=r.sender_id AND b.blocked_id=${user.id}))
    ORDER BY r.created_at DESC LIMIT 100`;
  return c.json({ replies: rows });
});
storyRoutes.delete("/:storyId", async (c) => {
  const user = c.get("user"), storyId = c.req.param("storyId");
  const rows = await getDb()`UPDATE stories SET deleted_at=now() WHERE id=${storyId} AND user_id=${user.id} AND deleted_at IS NULL RETURNING attachment_id`;
  if (!rows.length) return jsonError(c, 404, "STORY_NOT_FOUND", "Story not found.");
  const attachmentId = String(rows[0].attachment_id);
  await getDb()`UPDATE attachments SET expires_at=now() WHERE id=${attachmentId}`;
  return c.json({ status: "deleted" });
});

// src/routes/reports.ts
import { randomUUID as randomUUID10 } from "node:crypto";
import { Hono as Hono8 } from "hono";
var reportRoutes = new Hono8();
reportRoutes.use("*", requireUser);
reportRoutes.post("/", async (c) => {
  const limited = await enforceRateLimit(c, "report-submit", 10, 3600);
  if (limited) return limited;
  const user = c.get("user");
  const parsed = await parseJson(c, reportSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;
  if (input.targetUserId === user.id) return jsonError(c, 422, "REPORT_SELF", "You cannot report your own account.");
  if (input.targetUserId) {
    const target = await getDb()`SELECT 1 FROM users WHERE id=${input.targetUserId} AND deleted_at IS NULL LIMIT 1`;
    if (!target.length) return jsonError(c, 404, "REPORT_TARGET_NOT_FOUND", "Report target not found.");
  }
  if (input.groupId) {
    const group = await getDb()`SELECT 1 FROM haiku_groups WHERE id=${input.groupId} LIMIT 1`;
    if (!group.length) return jsonError(c, 404, "REPORT_TARGET_NOT_FOUND", "Report target not found.");
  }
  if (input.messageId) {
    const message = await getDb()`SELECT m.id FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id
      WHERE m.id=${input.messageId} AND cm.user_id=${user.id} AND cm.left_at IS NULL AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now()) LIMIT 1`;
    if (!message.length) return jsonError(c, 404, "REPORT_TARGET_NOT_FOUND", "That message is unavailable.");
  }
  if (input.evidenceAttachmentId) {
    const evidence = await getDb()`SELECT 1 FROM attachments WHERE id=${input.evidenceAttachmentId} AND owner_id=${user.id} AND purpose='report' AND status='ready' LIMIT 1`;
    if (!evidence.length) return jsonError(c, 422, "REPORT_EVIDENCE_INVALID", "Evidence must be uploaded with the report attachment flow.");
  }
  const id = randomUUID10();
  await getDb()`INSERT INTO reports(id,reporter_user_id,target_user_id,group_id,message_id,category,reason,evidence_attachment_id)
    VALUES (${id},${user.id},${input.targetUserId ?? null},${input.groupId ?? null},${input.messageId ?? null},${input.category},${input.reason ?? null},${input.evidenceAttachmentId ?? null})`;
  return c.json({ report: { id, status: "open", createdAt: (/* @__PURE__ */ new Date()).toISOString() }, message: "Thank you. Your report was submitted for review." }, 201);
});
reportRoutes.get("/mine", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT id,category,status,created_at,reviewed_at FROM reports WHERE reporter_user_id=${user.id} AND created_at>now()-interval '365 days' ORDER BY created_at DESC LIMIT 100`;
  return c.json({ reports: rows });
});

// src/routes/account.ts
import { randomUUID as randomUUID11 } from "node:crypto";
import { Hono as Hono9 } from "hono";
var accountRoutes = new Hono9();
accountRoutes.use("*", requireUser);
accountRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT u.id,u.email,u.email_verified_at,u.status,p.username,p.display_name,p.bio,p.location,p.avatar_object_key
    FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=${user.id} LIMIT 1`;
  return c.json({ user, account: rows[0] || null });
});
accountRoutes.get("/sessions", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT id,user_agent,created_at,last_seen_at,expires_at
    FROM sessions WHERE user_id=${user.id} AND revoked_at IS NULL AND expires_at>now() ORDER BY last_seen_at DESC LIMIT 50`;
  return c.json({ sessions: rows });
});
accountRoutes.delete("/sessions/:sessionId", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`UPDATE sessions SET revoked_at=now() WHERE id=${c.req.param("sessionId")} AND user_id=${user.id} AND revoked_at IS NULL RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "SESSION_NOT_FOUND", "Session not found.");
  return c.json({ status: "revoked" });
});
accountRoutes.delete("/sessions", async (c) => {
  const user = c.get("user");
  const current = (c.req.header("authorization") || "").slice(7).trim();
  await getDb()`UPDATE sessions SET revoked_at=now() WHERE user_id=${user.id} AND token_hash<>${sha256(current)} AND revoked_at IS NULL`;
  return c.json({ status: "other_sessions_revoked" });
});
accountRoutes.get("/deletion", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT id,scheduled_for FROM account_deletion_requests WHERE user_id=${user.id} AND canceled_at IS NULL AND completed_at IS NULL AND scheduled_for>now() ORDER BY created_at DESC LIMIT 1`;
  return c.json({ request: rows[0] || null });
});
accountRoutes.post("/deletion", async (c) => {
  const user = c.get("user");
  const existing = await getDb()`SELECT id,scheduled_for FROM account_deletion_requests WHERE user_id=${user.id} AND canceled_at IS NULL AND completed_at IS NULL LIMIT 1`;
  if (existing.length) return c.json({ request: existing[0], alreadyScheduled: true });
  const raw = Number.parseInt(process.env.ACCOUNT_DELETION_GRACE_DAYS || "30", 10);
  const days = Math.max(7, Math.min(90, Number.isFinite(raw) ? raw : 30));
  const id = randomUUID11();
  const rows = await getDb()`INSERT INTO account_deletion_requests(id,user_id,scheduled_for) VALUES (${id},${user.id},now()+(${days}*interval '1 day')) RETURNING id,scheduled_for`;
  return c.json({ request: rows[0], graceDays: days, warning: "When deletion completes, account data and associated media are removed where operationally possible. Copies saved outside Haiku Messenger, device caches, and backups cannot be guaranteed erased." }, 201);
});
accountRoutes.delete("/deletion", async (c) => {
  const user = c.get("user");
  const rows = await getDb()`UPDATE account_deletion_requests SET canceled_at=now() WHERE user_id=${user.id} AND canceled_at IS NULL AND completed_at IS NULL AND scheduled_for>now() RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "DELETION_REQUEST_NOT_FOUND", "There is no pending deletion request to cancel.");
  return c.json({ status: "canceled" });
});
accountRoutes.get("/export", async (c) => {
  const user = c.get("user");
  const profile = await getDb()`SELECT p.username,p.display_name,p.bio,p.location,p.birthday_month,p.birthday_day,u.email,u.created_at
    FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=${user.id} LIMIT 1`;
  const friends = await getDb()`SELECT p.username,p.display_name,f.created_at FROM friendships f
    JOIN user_profiles p ON p.user_id=CASE WHEN f.user_low=${user.id} THEN f.user_high ELSE f.user_low END
    WHERE f.user_low=${user.id} OR f.user_high=${user.id} ORDER BY p.username`;
  const settings = await getDb()`SELECT quiet_mode,notifications_enabled,sender_previews,presence_visible,read_receipts_enabled,typing_indicators_enabled FROM user_settings WHERE user_id=${user.id} LIMIT 1`;
  const conversations = await getDb()`SELECT c.id,c.kind,g.name AS group_name,
      (SELECT p.display_name FROM conversation_members other JOIN user_profiles p ON p.user_id=other.user_id WHERE other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL LIMIT 1) AS direct_name
    FROM conversations c JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=${user.id} AND mine.left_at IS NULL
    LEFT JOIN haiku_groups g ON g.conversation_id=c.id WHERE c.kind='group' OR NOT EXISTS(SELECT 1 FROM blocks b JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>${user.id} AND other.left_at IS NULL WHERE (b.blocker_id=${user.id} AND b.blocked_id=other.user_id) OR (b.blocker_id=other.user_id AND b.blocked_id=${user.id})) ORDER BY c.created_at DESC LIMIT 100`;
  const conversationIds = conversations.map((row) => String(row.id));
  const messages = conversationIds.length ? await getDb()`SELECT id,conversation_id,message_type,body,created_at,edited_at
      FROM messages WHERE conversation_id=ANY(${conversationIds}::uuid[]) AND sender_id=${user.id} AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>now())
      ORDER BY created_at DESC LIMIT 2000` : [];
  return c.json({ exportedAt: (/* @__PURE__ */ new Date()).toISOString(), profile: profile[0] || null, friends, settings: settings[0] || null, conversations, messages, scope: "This limited export includes your profile, friend list, settings, and your own unexpired messages only. It excludes media bytes and messages authored by others." });
});

// src/routes/admin.ts
import { Hono as Hono11 } from "hono";
import { z as z9 } from "zod";

// src/middleware/admin.ts
import { createMiddleware as createMiddleware2 } from "hono/factory";
var requireAdmin = createMiddleware2(async (c, next) => {
  const user = c.get("user");
  const rows = await getDb()`SELECT r.role_name, r.permissions FROM admin_members m
    JOIN admin_roles r ON r.role_name=m.role_name
    WHERE m.user_id=${user.id} AND m.revoked_at IS NULL LIMIT 1`;
  if (!rows.length) return jsonError(c, 403, "ADMIN_REQUIRED", "Administrator access is required.");
  const row = rows[0];
  c.set("admin", { role: row.role_name, permissions: row.permissions || {} });
  await next();
});
function hasAdminPermission(c, permission) {
  const admin = c.get("admin");
  return admin.role === "owner" || admin.permissions[permission] === true;
}

// src/services/audit.ts
import { randomUUID as randomUUID12 } from "node:crypto";
async function auditAdmin(actorId, action, entityType, entityId, reason, metadata = {}) {
  await getDb()`INSERT INTO admin_audit_events (id,admin_user_id,action,entity_type,entity_id,reason,metadata)
    VALUES (${randomUUID12()},${actorId},${action.slice(0, 100)},${entityType.slice(0, 80)},${entityId?.slice(0, 200) || null},${reason?.slice(0, 500) || null},${JSON.stringify(metadata)}::jsonb)`;
}

// src/routes/app-releases.ts
import { randomUUID as randomUUID13 } from "node:crypto";
import { Hono as Hono10 } from "hono";
import { z as z8 } from "zod";
var APK_MIME = "application/vnd.android.package-archive";
var MAX_APK_BYTES = Math.min(1024 * 1024 * 1024, Math.max(1024 * 1024, Number.parseInt(process.env.APK_MAX_BYTES || "", 10) || 300 * 1024 * 1024));
var tableReady;
function ensureReleaseTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await getDb()`CREATE TABLE IF NOT EXISTS app_releases (
        id uuid PRIMARY KEY,
        platform text NOT NULL DEFAULT 'android',
        version text NOT NULL,
        file_name text NOT NULL,
        object_key text NOT NULL UNIQUE,
        byte_size bigint NOT NULL,
        mime_type text NOT NULL DEFAULT 'application/vnd.android.package-archive',
        notes text,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
        is_active boolean NOT NULL DEFAULT false,
        download_count integer NOT NULL DEFAULT 0,
        uploaded_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        activated_at timestamptz
      )`;
    })().catch((error) => {
      tableReady = void 0;
      throw error;
    });
  }
  return tableReady;
}
var publicRow = (row) => ({
  id: row.id,
  platform: row.platform,
  version: row.version,
  file_name: row.file_name,
  byte_size: Number(row.byte_size),
  notes: row.notes,
  status: row.status,
  is_active: row.is_active,
  download_count: row.download_count,
  created_at: row.created_at,
  activated_at: row.activated_at
});
async function purgeStalePending() {
  try {
    const stale = await getDb()`SELECT id,object_key FROM app_releases WHERE status='pending' AND created_at < now() - interval '1 day'`;
    for (const item of stale) {
      try {
        await getStorage().deleteObject(item.object_key);
      } catch {
      }
      await getDb()`DELETE FROM app_releases WHERE id=${item.id}::uuid`;
    }
  } catch {
  }
}
async function activateRelease(id) {
  const rows = await getDb()`WITH off AS (UPDATE app_releases SET is_active=false WHERE platform='android' AND is_active AND id<>${id}::uuid)
    UPDATE app_releases SET is_active=true, activated_at=now() WHERE id=${id}::uuid AND status='ready' RETURNING id`;
  return rows.length > 0;
}
var isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
var releaseAdminRoutes = new Hono10();
releaseAdminRoutes.use("*", async (c, next) => {
  if (!hasAdminPermission(c, "releases.manage")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have app release permission.");
  try {
    await ensureReleaseTable();
  } catch {
    return jsonError(c, 503, "DATABASE_UNAVAILABLE", "The release database is not ready.");
  }
  await next();
});
releaseAdminRoutes.get("/", async (c) => {
  await purgeStalePending();
  const rows = await getDb()`SELECT id,platform,version,file_name,byte_size,notes,status,is_active,download_count,created_at,activated_at
    FROM app_releases ORDER BY created_at DESC LIMIT 50`;
  return c.json({ releases: rows.map(publicRow), storageReady: process.env.MEDIA_STORAGE === "neon-s3", maxBytes: MAX_APK_BYTES });
});
var planSchema = z8.object({
  version: z8.string().trim().min(1).max(32).regex(/^[0-9A-Za-z][0-9A-Za-z._+-]*$/, "Use letters, numbers, dots and dashes only."),
  fileName: z8.string().trim().min(5).max(120).regex(/\.apk$/i, "The file must be an .apk."),
  byteSize: z8.number().int().min(100 * 1024).max(MAX_APK_BYTES),
  notes: z8.string().trim().max(1e3).optional()
});
releaseAdminRoutes.post("/upload-plan", async (c) => {
  const parsed = await parseJson(c, planSchema);
  if ("response" in parsed) return parsed.response;
  const { version, fileName, byteSize, notes } = parsed.data;
  let storage;
  try {
    storage = getStorage();
  } catch {
    return jsonError(c, 503, "STORAGE_NOT_CONFIGURED", "Object storage is not configured for this API.");
  }
  if (storage.mode !== "neon-s3") return jsonError(c, 409, "STORAGE_NOT_CONFIGURED", "APK uploads need object storage (set MEDIA_STORAGE=neon-s3).");
  const id = randomUUID13();
  const objectKey = `releases/${id}.apk`;
  const plan = await storage.uploadPlan(objectKey, APK_MIME, byteSize, new URL(c.req.url).origin, id);
  await getDb()`INSERT INTO app_releases (id,version,file_name,object_key,byte_size,notes,uploaded_by)
    VALUES (${id}::uuid,${version},${fileName},${objectKey},${byteSize},${notes || null},${c.get("user").id}::uuid)`;
  await auditAdmin(c.get("user").id, "app_release.upload_started", "app_release", id, void 0, { version, byteSize });
  return c.json({ release: { id }, upload: { url: plan.url, method: plan.method, headers: plan.headers, expiresInSeconds: plan.expiresInSeconds } }, 201);
});
releaseAdminRoutes.post("/:id/complete", async (c) => {
  const id = c.req.param("id");
  if (!isUuid(id)) return jsonError(c, 404, "NOT_FOUND", "Release not found.");
  const body = await c.req.json().catch(() => ({}));
  const activate = body.activate !== false;
  const rows = await getDb()`SELECT id,object_key,byte_size,version FROM app_releases WHERE id=${id}::uuid AND status='pending' LIMIT 1`;
  const row = rows[0];
  if (!row) return jsonError(c, 404, "NOT_FOUND", "No pending upload with that id.");
  const storage = getStorage();
  let check2;
  try {
    check2 = await storage.checkObject?.(row.object_key);
  } catch {
    check2 = void 0;
  }
  const zipMagic = !!check2 && check2.prefix[0] === 80 && check2.prefix[1] === 75 && check2.prefix[2] === 3 && check2.prefix[3] === 4;
  if (!check2 || check2.byteSize !== Number(row.byte_size) || !zipMagic) {
    try {
      await storage.deleteObject(row.object_key);
    } catch {
    }
    await getDb()`DELETE FROM app_releases WHERE id=${id}::uuid`;
    return jsonError(c, 422, "APK_INVALID", "The uploaded file was missing, the wrong size, or is not a valid APK. Please upload it again.");
  }
  await getDb()`UPDATE app_releases SET status='ready' WHERE id=${id}::uuid`;
  if (activate) await activateRelease(id);
  await auditAdmin(c.get("user").id, "app_release.uploaded", "app_release", id, void 0, { version: row.version, published: activate });
  return c.json({ status: "ready", active: activate });
});
releaseAdminRoutes.post("/:id/activate", async (c) => {
  const id = c.req.param("id");
  if (!isUuid(id)) return jsonError(c, 404, "NOT_FOUND", "Release not found.");
  if (!await activateRelease(id)) return jsonError(c, 404, "NOT_FOUND", "Only fully uploaded releases can be published.");
  await auditAdmin(c.get("user").id, "app_release.published", "app_release", id);
  return c.json({ status: "active" });
});
releaseAdminRoutes.post("/:id/deactivate", async (c) => {
  const id = c.req.param("id");
  if (!isUuid(id)) return jsonError(c, 404, "NOT_FOUND", "Release not found.");
  await getDb()`UPDATE app_releases SET is_active=false WHERE id=${id}::uuid`;
  await auditAdmin(c.get("user").id, "app_release.unpublished", "app_release", id);
  return c.json({ status: "inactive" });
});
releaseAdminRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isUuid(id)) return jsonError(c, 404, "NOT_FOUND", "Release not found.");
  const rows = await getDb()`SELECT object_key,version FROM app_releases WHERE id=${id}::uuid LIMIT 1`;
  const row = rows[0];
  if (!row) return jsonError(c, 404, "NOT_FOUND", "Release not found.");
  try {
    await getStorage().deleteObject(row.object_key);
  } catch {
  }
  await getDb()`DELETE FROM app_releases WHERE id=${id}::uuid`;
  await auditAdmin(c.get("user").id, "app_release.deleted", "app_release", id, void 0, { version: row.version });
  return c.json({ status: "deleted" });
});
var appPublicRoutes = new Hono10();
async function activeRelease() {
  if (!dbReady()) return null;
  await ensureReleaseTable();
  const rows = await getDb()`SELECT id,version,file_name,object_key,byte_size,notes,activated_at FROM app_releases
    WHERE platform='android' AND is_active AND status='ready' ORDER BY activated_at DESC NULLS LAST LIMIT 1`;
  return rows[0] ?? null;
}
appPublicRoutes.get("/latest", async (c) => {
  try {
    const release = await activeRelease();
    if (!release) return c.json({ available: false });
    c.header("Cache-Control", "public, max-age=60");
    return c.json({ available: true, platform: "android", version: release.version, fileName: release.file_name, byteSize: Number(release.byte_size), notes: release.notes, publishedAt: release.activated_at, downloadPath: "/v1/app/download" });
  } catch {
    return c.json({ available: false });
  }
});
appPublicRoutes.get("/download", async (c) => {
  try {
    const release = await activeRelease();
    if (!release) return jsonError(c, 404, "APP_NOT_AVAILABLE", "The Android app is not available for download yet.");
    const link = await getStorage().downloadUrl(release.object_key, new URL(c.req.url).origin, { fileName: `HaikuMessenger-${release.version}.apk`, contentType: APK_MIME });
    try {
      await getDb()`UPDATE app_releases SET download_count=download_count+1 WHERE id=${release.id}::uuid`;
    } catch {
    }
    c.header("Cache-Control", "no-store");
    return c.redirect(link.url, 302);
  } catch {
    return jsonError(c, 503, "DOWNLOAD_UNAVAILABLE", "The download is temporarily unavailable.");
  }
});

// src/services/vercel-blob.ts
import { put } from "@vercel/blob";
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import path2 from "node:path";
var localReleasesDir = path2.resolve(process.cwd(), "../../.haiku-releases");
var latestConfigPath = path2.join(localReleasesDir, "latest.json");
var inMemoryLatest = {
  version: "1.0.0",
  versionCode: 1,
  downloadUrl: "https://github.com/musabj1917-oss/shh/releases/latest",
  fileName: "haiku-messenger.apk",
  fileSize: 285e5,
  releaseNotes: "Initial production build with Stitch UI, Left Rail navigation, and Neon Lakebase storage.",
  uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
};
async function getLatestApkRelease() {
  try {
    const raw = await readFile2(latestConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.downloadUrl) {
      inMemoryLatest = parsed;
      return parsed;
    }
  } catch {
  }
  return inMemoryLatest;
}
async function setLatestApkRelease(release) {
  inMemoryLatest = release;
  try {
    await mkdir2(localReleasesDir, { recursive: true });
    await writeFile2(latestConfigPath, JSON.stringify(release, null, 2), "utf8");
  } catch (err) {
    console.warn("[VercelBlob] Could not persist latest.json locally:", err);
  }
  return inMemoryLatest;
}
async function uploadApkToVercelBlob(fileName, buffer, metadata) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  let downloadUrl = "";
  if (token) {
    const blob = await put(`apks/${fileName}`, buffer, {
      access: "public",
      token,
      contentType: "application/vnd.android.package-archive"
    });
    downloadUrl = blob.url;
  } else {
    await mkdir2(localReleasesDir, { recursive: true });
    const localFilePath = path2.join(localReleasesDir, fileName);
    await writeFile2(localFilePath, buffer);
    downloadUrl = `/v1/releases/download/${encodeURIComponent(fileName)}`;
  }
  const release = {
    version: metadata.version || "1.0.0",
    versionCode: metadata.versionCode || 1,
    downloadUrl,
    fileName,
    fileSize: buffer.byteLength,
    releaseNotes: metadata.releaseNotes || "New Haiku Messenger Android Release.",
    uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await setLatestApkRelease(release);
  return release;
}

// src/routes/admin.ts
var adminRoutes = new Hono11();
adminRoutes.use("*", requireUser, requireAdmin);
var pageArgs = (c) => ({ page: Math.max(1, Number.parseInt(c.req.query("page") || "1", 10) || 1), limit: Math.min(100, Math.max(1, Number.parseInt(c.req.query("limit") || "25", 10) || 25)) });
var check = (c, permission) => hasAdminPermission(c, permission);
adminRoutes.route("/app-releases", releaseAdminRoutes);
adminRoutes.get("/me", async (c) => {
  const user = c.get("user"), admin = c.get("admin");
  return c.json({ admin: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: admin.role, permissions: admin.permissions } });
});
adminRoutes.get("/dashboard", async (c) => {
  if (!check(c, "users.read") && !check(c, "reports.read")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have dashboard permission.");
  const rows = await getDb()`SELECT
    (SELECT count(*)::int FROM users WHERE status='active' AND deleted_at IS NULL) AS active_users,
    (SELECT count(*)::int FROM users WHERE created_at>now()-interval '7 days' AND deleted_at IS NULL) AS new_users_7d,
    (SELECT count(*)::int FROM reports WHERE status IN ('open','reviewing')) AS open_reports,
    (SELECT count(*)::int FROM haiku_groups WHERE suspended_at IS NULL) AS active_groups,
    (SELECT count(*)::int FROM stories WHERE deleted_at IS NULL AND expires_at>now()) AS live_stories,
    (SELECT count(*)::int FROM messages WHERE deleted_at IS NULL AND (expires_at IS NULL OR expires_at>now()) AND created_at>now()-interval '24 hours') AS messages_24h`;
  await auditAdmin(c.get("user").id, "dashboard.read", "dashboard", null, void 0, {});
  return c.json({ summary: rows[0] || {} });
});
adminRoutes.get("/users", async (c) => {
  if (!check(c, "users.read")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to search users.");
  const { page, limit } = pageArgs(c), offset = (page - 1) * limit, q = (c.req.query("q") || "").trim().slice(0, 80);
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await getDb()`SELECT u.id,u.email,u.status,u.email_verified_at,u.created_at,u.updated_at,p.username,p.display_name,p.location,
      (SELECT count(*)::int FROM friendships f WHERE f.user_low=u.id OR f.user_high=u.id) AS friend_count
    FROM users u JOIN user_profiles p ON p.user_id=u.id
    WHERE u.deleted_at IS NULL AND (${q}='' OR u.email ILIKE ${like} ESCAPE '\\' OR p.username ILIKE ${like} ESCAPE '\\' OR p.display_name ILIKE ${like} ESCAPE '\\')
    ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const count = await getDb()`SELECT count(*)::int AS total FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.deleted_at IS NULL
    AND (${q}='' OR u.email ILIKE ${like} ESCAPE '\\' OR p.username ILIKE ${like} ESCAPE '\\' OR p.display_name ILIKE ${like} ESCAPE '\\')`;
  await auditAdmin(c.get("user").id, "users.search", "users", null, void 0, { queryLength: q.length, page });
  return c.json({ users: rows, pagination: { page, limit, total: Number(count[0]?.total || 0) } });
});
adminRoutes.get("/users/:userId", async (c) => {
  if (!check(c, "users.read")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to view user details.");
  const id = c.req.param("userId");
  const rows = await getDb()`SELECT u.id,u.email,u.status,u.email_verified_at,u.created_at,u.updated_at,p.username,p.display_name,p.bio,p.location,p.birthday_month,p.birthday_day
    FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=${id} LIMIT 1`;
  if (!rows.length) return jsonError(c, 404, "USER_NOT_FOUND", "User not found.");
  await auditAdmin(c.get("user").id, "user.read", "user", id, void 0, {});
  return c.json({ user: rows[0] });
});
adminRoutes.get("/users/:userId/conversations", async (c) => {
  if (c.get("admin").role !== "owner") return jsonError(c, 403, "OWNER_REQUIRED", "Only the designated owner can review private conversation content.");
  const actor = c.get("user"), userId = c.req.param("userId");
  const rows = await getDb()`SELECT c.id,c.kind,g.name AS group_name,
      (SELECT p.display_name FROM conversation_members other JOIN user_profiles p ON p.user_id=other.user_id WHERE other.conversation_id=c.id AND other.user_id<>${userId} AND other.left_at IS NULL LIMIT 1) AS direct_name,
      (SELECT count(*)::int FROM messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())) AS active_message_count,
      (SELECT max(m.created_at) FROM messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())) AS last_message_at
    FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=${userId}
    LEFT JOIN haiku_groups g ON g.conversation_id=c.id ORDER BY last_message_at DESC NULLS LAST LIMIT 100`;
  await auditAdmin(actor.id, "user.conversations.read", "user", userId, "Owner access to conversation metadata", { rowCount: rows.length });
  return c.json({ conversations: rows, notice: "This list contains conversation metadata only. Message content is available to the owner and is audited separately." });
});
adminRoutes.post("/users/:userId/suspend", async (c) => {
  if (!check(c, "users.manage")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to suspend users.");
  const user = c.get("user"), id = c.req.param("userId");
  const parsed = await parseJson(c, z9.object({ reason: z9.string().trim().min(5).max(500) }).strict());
  if ("response" in parsed) return parsed.response;
  if (id === user.id) return jsonError(c, 409, "SELF_SUSPENSION", "You cannot suspend your own administrator account.");
  const rows = await getDb()`UPDATE users SET status='suspended',updated_at=now() WHERE id=${id} AND status='active' AND deleted_at IS NULL RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "USER_NOT_ACTIVE", "Active user not found.");
  await getDb()`UPDATE sessions SET revoked_at=now() WHERE user_id=${id} AND revoked_at IS NULL`;
  await auditAdmin(user.id, "user.suspend", "user", id, parsed.data.reason, {});
  return c.json({ status: "suspended" });
});
adminRoutes.post("/users/:userId/restore", async (c) => {
  if (!check(c, "users.manage")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to restore users.");
  const actor = c.get("user"), id = c.req.param("userId");
  const rows = await getDb()`UPDATE users SET status='active',updated_at=now() WHERE id=${id} AND status='suspended' AND deleted_at IS NULL RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "USER_NOT_SUSPENDED", "Suspended user not found.");
  await auditAdmin(actor.id, "user.restore", "user", id, void 0, {});
  return c.json({ status: "active" });
});
adminRoutes.delete("/users/:userId", async (c) => {
  if (!check(c, "users.manage")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to delete users.");
  const actor = c.get("user"), id = c.req.param("userId");
  const parsed = await parseJson(c, z9.object({ confirmation: z9.literal("DELETE"), reason: z9.string().trim().min(5).max(500) }).strict());
  if ("response" in parsed) return parsed.response;
  if (id === actor.id) return jsonError(c, 409, "SELF_DELETE", "You cannot delete your own administrator account.");
  const exists = await getDb()`SELECT 1 FROM users WHERE id=${id} AND deleted_at IS NULL LIMIT 1`;
  if (!exists.length) return jsonError(c, 404, "USER_NOT_FOUND", "User not found.");
  try {
    await getDb().transaction([
      getDb()`UPDATE messages SET body=NULL,attachment_id=NULL,deleted_at=now(),deletion_kind='account' WHERE sender_id=${id} AND deleted_at IS NULL`,
      getDb()`UPDATE attachments SET expires_at=now() WHERE owner_id=${id}`,
      getDb()`UPDATE stories SET deleted_at=now() WHERE user_id=${id} AND deleted_at IS NULL`,
      getDb()`UPDATE conversation_members SET left_at=now() WHERE user_id=${id} AND left_at IS NULL`,
      getDb()`WITH candidates AS (
          SELECT g.id,(SELECT gm.user_id FROM group_members gm JOIN users u ON u.id=gm.user_id
            WHERE gm.group_id=g.id AND gm.user_id<>${id} AND gm.left_at IS NULL AND u.status='active' AND u.deleted_at IS NULL
            ORDER BY CASE gm.role WHEN 'admin' THEN 0 ELSE 1 END,gm.joined_at LIMIT 1) AS successor
          FROM haiku_groups g WHERE g.owner_id=${id}
        ) UPDATE haiku_groups g SET owner_id=COALESCE(c.successor,g.owner_id),
          suspended_at=CASE WHEN c.successor IS NULL THEN COALESCE(g.suspended_at,now()) ELSE g.suspended_at END,
          suspension_reason=CASE WHEN c.successor IS NULL THEN 'Owner account deleted; admin review required' ELSE g.suspension_reason END,
          updated_at=now() FROM candidates c WHERE g.id=c.id`,
      getDb()`UPDATE group_members gm SET role='owner' FROM haiku_groups g WHERE gm.group_id=g.id AND g.owner_id=gm.user_id AND gm.left_at IS NULL AND g.owner_id<>${id}`,
      getDb()`UPDATE group_members SET left_at=now() WHERE user_id=${id} AND left_at IS NULL`,
      getDb()`DELETE FROM friendships WHERE user_low=${id} OR user_high=${id}`,
      getDb()`DELETE FROM blocks WHERE blocker_id=${id} OR blocked_id=${id}`,
      getDb()`UPDATE friend_requests SET status='canceled',responded_at=now() WHERE status='pending' AND (sender_id=${id} OR recipient_id=${id})`,
      getDb()`UPDATE sessions SET revoked_at=now() WHERE user_id=${id} AND revoked_at IS NULL`,
      getDb()`UPDATE admin_members SET revoked_at=now() WHERE user_id=${id} AND revoked_at IS NULL`,
      getDb()`UPDATE users SET email=${`deleted+${id}@invalid.local`},password_hash=NULL,email_verified_at=NULL,status='deleted',deleted_at=now(),updated_at=now(),date_of_birth=DATE '1900-01-01' WHERE id=${id}`,
      getDb()`UPDATE user_profiles SET username=${`deleted_${id.replace(/-/g, "").slice(0, 16)}`},display_name='Deleted account',bio=NULL,location=NULL,birthday_month=NULL,birthday_day=NULL,avatar_object_key=NULL,updated_at=now() WHERE user_id=${id}`
    ]);
  } catch {
    return jsonError(c, 503, "USER_DELETE_FAILED", "Account deletion could not be completed.");
  }
  await auditAdmin(actor.id, "user.delete", "user", id, parsed.data.reason, {});
  return c.json({ status: "deleted" });
});
adminRoutes.get("/reports", async (c) => {
  if (!check(c, "reports.read")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to review reports.");
  const { page, limit } = pageArgs(c), offset = (page - 1) * limit, status = c.req.query("status") || "open";
  const allowed = ["open", "reviewing", "resolved", "dismissed", "all"];
  if (!allowed.includes(status)) return jsonError(c, 422, "FILTER_INVALID", "Unsupported report filter.");
  const rows = await getDb()`SELECT r.id,r.category,r.reason,r.status,r.created_at,r.admin_notes,r.target_user_id,r.group_id,r.message_id,r.evidence_attachment_id,
      reporter.username AS reporter_username,reporter.display_name AS reporter_name,target.username AS target_username,target.display_name AS target_name,
      g.name AS group_name,m.body AS reported_message,m.created_at AS message_created_at
    FROM reports r LEFT JOIN user_profiles reporter ON reporter.user_id=r.reporter_user_id
    LEFT JOIN user_profiles target ON target.user_id=r.target_user_id LEFT JOIN haiku_groups g ON g.id=r.group_id
    LEFT JOIN messages m ON m.id=r.message_id AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
    WHERE (${status}='all' OR r.status=${status}) AND r.created_at>now()-interval '365 days'
    ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,r.created_at ASC LIMIT ${limit} OFFSET ${offset}`;
  await auditAdmin(c.get("user").id, "reports.read", "reports", null, void 0, { status, page });
  return c.json({ reports: rows, pagination: { page, limit } });
});
adminRoutes.patch("/reports/:reportId", async (c) => {
  if (!check(c, "reports.resolve")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to update reports.");
  const actor = c.get("user");
  const parsed = await parseJson(c, z9.object({ status: z9.enum(["reviewing", "resolved", "dismissed"]), notes: z9.string().trim().max(2e3).optional() }).strict());
  if ("response" in parsed) return parsed.response;
  const rows = await getDb()`UPDATE reports SET status=${parsed.data.status},admin_notes=${parsed.data.notes ?? null},reviewed_by=${actor.id},reviewed_at=now()
    WHERE id=${c.req.param("reportId")} AND status IN ('open','reviewing') RETURNING id,status`;
  if (!rows.length) return jsonError(c, 404, "REPORT_NOT_OPEN", "Report not found or already closed.");
  await auditAdmin(actor.id, "report.update", "report", c.req.param("reportId"), parsed.data.notes, { status: parsed.data.status });
  return c.json({ report: rows[0] });
});
adminRoutes.post("/messages/:messageId/remove", async (c) => {
  if (!check(c, "messages.moderate")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to remove messages.");
  const actor = c.get("user");
  const parsed = await parseJson(c, z9.object({ reason: z9.string().trim().min(5).max(500) }).strict());
  if ("response" in parsed) return parsed.response;
  const rows = await getDb()`WITH target AS (
      SELECT id,conversation_id,attachment_id FROM messages
      WHERE id=${c.req.param("messageId")} AND deleted_at IS NULL LIMIT 1
    ), removed AS (
      UPDATE messages m SET body=NULL,attachment_id=NULL,deleted_at=now(),deletion_kind='moderator'
      FROM target WHERE m.id=target.id
      RETURNING m.id,m.conversation_id,target.attachment_id
    ) SELECT id,conversation_id,attachment_id FROM removed`;
  if (!rows.length) return jsonError(c, 404, "MESSAGE_NOT_FOUND", "Active message not found. Expired or deleted content cannot be removed again.");
  const item = rows[0];
  if (item.attachment_id) await getDb()`UPDATE attachments SET expires_at=now() WHERE id=${item.attachment_id}`;
  await auditAdmin(actor.id, "message.remove", "message", item.id, parsed.data.reason, { conversationId: item.conversation_id });
  try {
    await publishMessageCreated(item.conversation_id, item.id);
  } catch {
  }
  return c.json({ status: "removed", messageId: item.id });
});
adminRoutes.get("/groups", async (c) => {
  if (!check(c, "groups.read")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to view groups.");
  const { page, limit } = pageArgs(c), offset = (page - 1) * limit, q = (c.req.query("q") || "").trim().slice(0, 80), like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await getDb()`SELECT g.id,g.name,g.owner_id,g.created_at,g.updated_at,g.suspended_at,g.suspension_reason,
      (SELECT count(*)::int FROM group_members gm WHERE gm.group_id=g.id AND gm.left_at IS NULL) AS member_count,
      p.username AS owner_username,p.display_name AS owner_name
    FROM haiku_groups g LEFT JOIN user_profiles p ON p.user_id=g.owner_id
    WHERE (${q}='' OR g.name ILIKE ${like} ESCAPE '\\') ORDER BY g.updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
  await auditAdmin(c.get("user").id, "groups.read", "groups", null, void 0, { page, qLength: q.length });
  return c.json({ groups: rows, pagination: { page, limit } });
});
adminRoutes.post("/groups/:groupId/suspend", async (c) => {
  if (!check(c, "groups.manage")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to moderate groups.");
  const actor = c.get("user");
  const parsed = await parseJson(c, z9.object({ reason: z9.string().trim().min(5).max(500) }).strict());
  if ("response" in parsed) return parsed.response;
  const rows = await getDb()`UPDATE haiku_groups SET suspended_at=now(),suspension_reason=${parsed.data.reason},updated_at=now()
    WHERE id=${c.req.param("groupId")} AND suspended_at IS NULL RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "GROUP_NOT_FOUND", "Active group not found.");
  await getDb()`UPDATE group_invite_links SET revoked_at=now() WHERE group_id=${c.req.param("groupId")} AND revoked_at IS NULL`;
  await auditAdmin(actor.id, "group.suspend", "group", c.req.param("groupId"), parsed.data.reason, {});
  return c.json({ status: "suspended" });
});
adminRoutes.post("/groups/:groupId/restore", async (c) => {
  if (!check(c, "groups.manage")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to restore groups.");
  const actor = c.get("user");
  const rows = await getDb()`UPDATE haiku_groups SET suspended_at=NULL,suspension_reason=NULL,updated_at=now() WHERE id=${c.req.param("groupId")} AND suspended_at IS NOT NULL RETURNING id`;
  if (!rows.length) return jsonError(c, 404, "GROUP_NOT_SUSPENDED", "Suspended group not found.");
  await auditAdmin(actor.id, "group.restore", "group", c.req.param("groupId"), void 0, {});
  return c.json({ status: "active" });
});
adminRoutes.get("/conversations/:conversationId/messages", async (c) => {
  const actor = c.get("user"), admin = c.get("admin");
  if (admin.role !== "owner") return jsonError(c, 403, "OWNER_REQUIRED", "Only the designated owner can view private conversation content.");
  const id = c.req.param("conversationId");
  const rows = await getDb()`SELECT m.id,m.sender_id,m.message_type,m.body,m.attachment_id,m.created_at,m.edited_at,m.expires_at,p.username,p.display_name
    FROM messages m LEFT JOIN user_profiles p ON p.user_id=m.sender_id
    WHERE m.conversation_id=${id} AND m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>now())
    ORDER BY m.created_at DESC LIMIT 100`;
  await auditAdmin(actor.id, "conversation.messages.read", "conversation", id, "Owner access to active content", { rowCount: rows.length });
  return c.json({ messages: rows, retention: "Expired and deleted content is excluded and is not recoverable through this endpoint." });
});
adminRoutes.get("/media/:attachmentId", async (c) => {
  const actor = c.get("user"), admin = c.get("admin");
  if (admin.role !== "owner" && !check(c, "reports.read")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to review evidence.");
  const id = c.req.param("attachmentId");
  const rows = await getDb()`SELECT a.object_key,a.mime_type,a.purpose,a.expires_at,a.status,
      r.id AS report_id,m.id AS message_id,s.id AS story_id
    FROM attachments a LEFT JOIN reports r ON r.evidence_attachment_id=a.id
    LEFT JOIN messages m ON m.attachment_id=a.id LEFT JOIN stories s ON s.attachment_id=a.id
    WHERE a.id=${id} AND a.status='ready' AND (a.expires_at IS NULL OR a.expires_at>now()) LIMIT 1`;
  if (!rows.length) return jsonError(c, 404, "MEDIA_NOT_FOUND", "Evidence is unavailable.");
  const item = rows[0];
  if (admin.role !== "owner" && (item.purpose !== "report" || !item.report_id)) return jsonError(c, 404, "MEDIA_NOT_FOUND", "Evidence is unavailable.");
  await auditAdmin(actor.id, "media.review", "attachment", id, void 0, { purpose: item.purpose, reportId: item.report_id });
  try {
    return c.json(await getStorage().downloadUrl(item.object_key, process.env.API_PUBLIC_URL || new URL(c.req.url).origin));
  } catch {
    return jsonError(c, 503, "MEDIA_UNAVAILABLE", "Media storage is unavailable.");
  }
});
adminRoutes.get("/roles", async (c) => {
  if (c.get("admin").role !== "owner") return jsonError(c, 403, "OWNER_REQUIRED", "Only the owner can manage administrator roles.");
  const rows = await getDb()`SELECT m.user_id,m.role_name,m.granted_at,m.revoked_at,p.username,p.display_name,u.email
    FROM admin_members m JOIN users u ON u.id=m.user_id JOIN user_profiles p ON p.user_id=m.user_id ORDER BY m.granted_at DESC LIMIT 500`;
  await auditAdmin(c.get("user").id, "admins.list", "admin_members", null, void 0, {});
  return c.json({ admins: rows });
});
adminRoutes.post("/roles", async (c) => {
  const actor = c.get("user");
  if (actor && c.get("admin").role !== "owner") return jsonError(c, 403, "OWNER_REQUIRED", "Only the owner can grant administrator access.");
  const parsed = await parseJson(c, z9.object({ userId: z9.string().uuid(), role: z9.enum(["moderator", "support", "analyst"]) }).strict());
  if ("response" in parsed) return parsed.response;
  const target = await getDb()`SELECT id FROM users WHERE id=${parsed.data.userId} AND status='active' AND email_verified_at IS NOT NULL AND deleted_at IS NULL LIMIT 1`;
  if (!target.length) return jsonError(c, 404, "USER_NOT_FOUND", "Choose an active, verified account.");
  await getDb()`INSERT INTO admin_members(user_id,role_name,granted_by,revoked_at) VALUES (${parsed.data.userId},${parsed.data.role},${actor.id},NULL)
    ON CONFLICT(user_id) DO UPDATE SET role_name=${parsed.data.role},granted_by=${actor.id},granted_at=now(),revoked_at=NULL`;
  await auditAdmin(actor.id, "admin.grant", "admin_member", parsed.data.userId, void 0, { role: parsed.data.role });
  return c.json({ status: "granted", userId: parsed.data.userId, role: parsed.data.role }, 201);
});
adminRoutes.delete("/roles/:userId", async (c) => {
  const actor = c.get("user");
  if (c.get("admin").role !== "owner") return jsonError(c, 403, "OWNER_REQUIRED", "Only the owner can revoke administrator access.");
  if (c.req.param("userId") === actor.id) return jsonError(c, 409, "SELF_REVOKE", "Transfer ownership before revoking your own access.");
  const rows = await getDb()`UPDATE admin_members SET revoked_at=now() WHERE user_id=${c.req.param("userId")} AND revoked_at IS NULL RETURNING user_id`;
  if (!rows.length) return jsonError(c, 404, "ADMIN_NOT_FOUND", "Active administrator not found.");
  await auditAdmin(actor.id, "admin.revoke", "admin_member", c.req.param("userId"), void 0, {});
  return c.json({ status: "revoked" });
});
adminRoutes.get("/audit", async (c) => {
  if (!check(c, "audit.read")) return jsonError(c, 403, "PERMISSION_DENIED", "You do not have permission to view audit logs.");
  const { page, limit } = pageArgs(c), offset = (page - 1) * limit;
  const rows = await getDb()`SELECT a.id,a.admin_user_id,a.action,a.entity_type,a.entity_id,a.reason,a.metadata,a.created_at,p.username,p.display_name
    FROM admin_audit_events a LEFT JOIN user_profiles p ON p.user_id=a.admin_user_id ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return c.json({ events: rows, pagination: { page, limit } });
});
adminRoutes.get("/releases", async (c) => {
  const release = await getLatestApkRelease();
  return c.json({ release });
});
adminRoutes.put("/releases", async (c) => {
  const actor = c.get("user");
  if (c.get("admin").role !== "owner") return jsonError(c, 403, "OWNER_REQUIRED", "Only the owner can update release configurations.");
  const body = await c.req.json().catch(() => null);
  if (!body || !body.downloadUrl) {
    return jsonError(c, 400, "INVALID_CONFIG", "A valid downloadUrl is required.");
  }
  const current = await getLatestApkRelease();
  const updated = await setLatestApkRelease({
    ...current,
    version: body.version || current.version,
    versionCode: Number(body.versionCode || current.versionCode),
    downloadUrl: String(body.downloadUrl).trim(),
    releaseNotes: body.releaseNotes !== void 0 ? String(body.releaseNotes) : current.releaseNotes,
    uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  await auditAdmin(actor.id, "releases.update", "apk_release", null, void 0, { version: updated.version, downloadUrl: updated.downloadUrl });
  return c.json({ release: updated, message: "Release configuration updated successfully." });
});

// src/brand-assets.ts
var ICO_B64 = "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";
var PNG_B64 = "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";
var SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <title>Haiku Messenger</title>
  <rect width="512" height="512" rx="112" fill="#FFD60A"/>

  <!-- Two cursive L's joined by a crossbar to form an H -->
  <g transform="translate(26,78)" fill="none" stroke="#000" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
    <!-- left cursive L -->
    <path d="M118,372 C150,360 175,250 205,170 C222,122 235,92 212,88 C188,84 178,130 188,200 C196,262 196,330 215,368 C228,388 252,380 262,366"/>
    <!-- right cursive L -->
    <path d="M288,372 C320,360 345,250 375,170 C392,122 405,92 382,88 C358,84 348,130 358,200 C366,262 366,330 385,368 C398,388 422,380 432,366"/>
    <!-- connecting crossbar -->
    <path d="M190,268 C230,240 290,290 335,258"/>
  </g>

  <!-- Message box on top, with a 5-7-5 haiku inside -->
  <path d="M196,52 H316 Q336,52 336,72 V112 Q336,132 316,132 H282 L256,160 L232,132 H196 Q176,132 176,112 V72 Q176,52 196,52 Z"
        fill="#FFFFFF" stroke="#000" stroke-width="12" stroke-linejoin="round"/>
  <g stroke="#000" stroke-width="8" stroke-linecap="round">
    <line x1="231" y1="77" x2="281" y2="77"/>
    <line x1="221" y1="92" x2="291" y2="92"/>
    <line x1="231" y1="107" x2="281" y2="107"/>
  </g>
</svg>
`;
function toArrayBuffer(b64) {
  const buf = Buffer.from(b64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
var brandAssets = {
  "/favicon.ico": { type: "image/x-icon", body: toArrayBuffer(ICO_B64) },
  "/favicon.svg": { type: "image/svg+xml", body: SVG },
  "/logo.svg": { type: "image/svg+xml", body: SVG },
  "/logo.png": { type: "image/png", body: toArrayBuffer(PNG_B64) },
  "/apple-touch-icon.png": { type: "image/png", body: toArrayBuffer(PNG_B64) }
};

// src/routes/internal.ts
import { randomUUID as randomUUID14, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import { Hono as Hono12 } from "hono";
var internalRoutes = new Hono12();
function validCronSecret(header, expected) {
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const left = Buffer.from(sha256(supplied)), right = Buffer.from(sha256(expected));
  return supplied.length > 0 && timingSafeEqual2(left, right);
}
internalRoutes.post("/cleanup", async (c) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !validCronSecret(c.req.header("authorization") || "", secret)) return c.json({ error: { code: "CRON_UNAUTHORIZED", message: "Not authorized." } }, 401);
  const runId = randomUUID14();
  await getDb()`INSERT INTO cleanup_runs(id,status) VALUES (${runId},'running')`;
  let deletedObjects = 0, deletedAccounts = 0, deletedMessages = 0, partial = false;
  try {
    const cleared = await getDb()`SELECT haiku_clear_expired_text_messages(1000) AS changed`;
    deletedMessages += Number(cleared[0]?.changed || 0);
    const otherExpired = await getDb()`WITH due AS (SELECT id,attachment_id FROM messages WHERE expires_at IS NOT NULL AND expires_at<=now() AND deleted_at IS NULL ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED)
      UPDATE messages m SET body=NULL,attachment_id=NULL,deleted_at=now(),deletion_kind='expired' FROM due WHERE m.id=due.id RETURNING due.attachment_id`;
    deletedMessages += otherExpired.length;
    const expiredAttachments = await getDb()`UPDATE attachments SET expires_at=now() WHERE purpose='story' AND id IN (SELECT attachment_id FROM stories WHERE expires_at<=now() OR deleted_at IS NOT NULL) AND (expires_at IS NULL OR expires_at>now())`;
    void expiredAttachments;
    await getDb()`UPDATE stories SET deleted_at=COALESCE(deleted_at,now()) WHERE expires_at<=now() AND deleted_at IS NULL`;
    const dueAttachments = await getDb()`SELECT id,object_key FROM attachments
      WHERE (expires_at IS NOT NULL AND expires_at<=now()) OR (status IN ('pending','failed') AND created_at<=now()-interval '24 hours')
      ORDER BY created_at LIMIT 100`;
    let storage;
    try {
      storage = getStorage();
    } catch {
      storage = void 0;
      partial = true;
    }
    for (const item of dueAttachments) {
      try {
        if (storage) await storage.deleteObject(item.object_key);
        else {
          partial = true;
          continue;
        }
        await getDb()`DELETE FROM attachments WHERE id=${item.id}`;
        deletedObjects++;
      } catch {
        partial = true;
      }
    }
    const dueAccounts = await getDb()`SELECT user_id,id FROM account_deletion_requests WHERE canceled_at IS NULL AND completed_at IS NULL AND scheduled_for<=now() ORDER BY scheduled_for LIMIT 25`;
    for (const row of dueAccounts) {
      const id = row.user_id;
      try {
        await getDb().transaction([
          getDb()`UPDATE messages SET body=NULL,attachment_id=NULL,deleted_at=COALESCE(deleted_at,now()),deletion_kind='account' WHERE sender_id=${id} AND deleted_at IS NULL`,
          getDb()`UPDATE stories SET deleted_at=COALESCE(deleted_at,now()) WHERE user_id=${id}`,
          getDb()`UPDATE attachments SET expires_at=now() WHERE owner_id=${id}`,
          getDb()`WITH candidates AS (
              SELECT g.id,(SELECT gm.user_id FROM group_members gm JOIN users u ON u.id=gm.user_id
                WHERE gm.group_id=g.id AND gm.user_id<>${id} AND gm.left_at IS NULL AND u.status='active' AND u.deleted_at IS NULL
                ORDER BY CASE gm.role WHEN 'admin' THEN 0 ELSE 1 END,gm.joined_at LIMIT 1) AS successor
              FROM haiku_groups g WHERE g.owner_id=${id}
            ) UPDATE haiku_groups g SET owner_id=COALESCE(c.successor,g.owner_id),
              suspended_at=CASE WHEN c.successor IS NULL THEN COALESCE(g.suspended_at,now()) ELSE g.suspended_at END,
              suspension_reason=CASE WHEN c.successor IS NULL THEN 'Owner account deleted; admin review required' ELSE g.suspension_reason END,
              updated_at=now() FROM candidates c WHERE g.id=c.id`,
          getDb()`UPDATE group_members gm SET role='owner' FROM haiku_groups g WHERE gm.group_id=g.id AND g.owner_id=gm.user_id AND gm.left_at IS NULL AND g.owner_id<>${id}`,
          getDb()`UPDATE group_members SET left_at=now() WHERE user_id=${id} AND left_at IS NULL`,
          getDb()`UPDATE conversation_members SET left_at=now() WHERE user_id=${id} AND left_at IS NULL`,
          getDb()`DELETE FROM friendships WHERE user_low=${id} OR user_high=${id}`,
          getDb()`DELETE FROM blocks WHERE blocker_id=${id} OR blocked_id=${id}`,
          getDb()`UPDATE friend_requests SET status='canceled',responded_at=now() WHERE status='pending' AND (sender_id=${id} OR recipient_id=${id})`,
          getDb()`UPDATE sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=${id}`,
          getDb()`UPDATE users SET email=${`deleted+${id}@invalid.local`},password_hash=NULL,email_verified_at=NULL,status='deleted',deleted_at=COALESCE(deleted_at,now()),updated_at=now(),date_of_birth=DATE '1900-01-01' WHERE id=${id} AND status<>'deleted'`,
          getDb()`UPDATE user_profiles SET username=${`deleted_${id.replace(/-/g, "").slice(0, 16)}`},display_name='Deleted account',bio=NULL,location=NULL,birthday_month=NULL,birthday_day=NULL,avatar_object_key=NULL,updated_at=now() WHERE user_id=${id}`,
          getDb()`UPDATE account_deletion_requests SET completed_at=now() WHERE id=${row.id} AND completed_at IS NULL`
        ]);
        deletedAccounts++;
      } catch {
        partial = true;
      }
    }
    const reportDays = envInt("REPORT_RETENTION_DAYS", 365, 30, 3650);
    await getDb()`UPDATE attachments SET expires_at=now() WHERE id IN (SELECT evidence_attachment_id FROM reports WHERE created_at<now()-(${reportDays}*interval '1 day') AND evidence_attachment_id IS NOT NULL)`;
    await getDb()`DELETE FROM reports WHERE created_at<now()-(${reportDays}*interval '1 day')`;
    await getDb()`DELETE FROM email_verification_tokens WHERE expires_at<=now() OR used_at IS NOT NULL`;
    await getDb()`DELETE FROM password_reset_tokens WHERE expires_at<=now() OR used_at IS NOT NULL`;
    await getDb()`DELETE FROM sessions WHERE expires_at<=now() OR revoked_at<now()-interval '30 days'`;
    await getDb()`DELETE FROM notifications WHERE expires_at<=now()`;
    await getDb()`DELETE FROM rate_limit_buckets WHERE window_started_at<now()-interval '1 day'`;
    await getDb()`DELETE FROM admin_audit_events WHERE created_at<now()-interval '365 days'`;
    const status = partial ? "partial" : "succeeded";
    await getDb()`UPDATE cleanup_runs SET finished_at=now(),status=${status},deleted_objects=${deletedObjects},deleted_accounts=${deletedAccounts},deleted_messages=${deletedMessages},error_code=${partial ? "RETRY_REQUIRED" : null} WHERE id=${runId}`;
    return c.json({ runId, status, deletedMessages, deletedObjects, deletedAccounts });
  } catch {
    await getDb()`UPDATE cleanup_runs SET finished_at=now(),status='failed',deleted_objects=${deletedObjects},deleted_accounts=${deletedAccounts},deleted_messages=${deletedMessages},error_code='CLEANUP_FAILED' WHERE id=${runId}`.catch(() => void 0);
    return c.json({ error: { code: "CLEANUP_FAILED", message: "Cleanup failed and will be retried." } }, 503);
  }
});

// src/routes/releases.ts
import { Hono as Hono13 } from "hono";
import { readFile as readFile3 } from "node:fs/promises";
import path3 from "node:path";
var releaseRoutes = new Hono13();
releaseRoutes.get("/latest-apk", async (c) => {
  const release = await getLatestApkRelease();
  return c.json({ release });
});
releaseRoutes.get("/download/:fileName", async (c) => {
  const fileName = c.req.param("fileName");
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    return jsonError(c, 400, "INVALID_FILENAME", "Invalid file name.");
  }
  const localReleasesDir2 = path3.resolve(process.cwd(), "../../.haiku-releases");
  const filePath = path3.join(localReleasesDir2, fileName);
  try {
    const bytes = await readFile3(filePath);
    return c.body(bytes, 200, {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="${fileName}"`
    });
  } catch {
    return jsonError(c, 404, "RELEASE_NOT_FOUND", "APK release file not found.");
  }
});
releaseRoutes.post("/admin/apk", requireUser, requireAdmin, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];
    const version = body["version"] || "1.0.0";
    const versionCode = Number(body["versionCode"] || 1);
    const releaseNotes = body["releaseNotes"] || "";
    if (file && typeof file === "object" && "arrayBuffer" in file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name || `haiku-messenger-v${version}.apk`;
      const release = await uploadApkToVercelBlob(fileName, buffer, {
        version,
        versionCode,
        releaseNotes
      });
      return c.json({ release, message: "APK uploaded to Vercel Blob successfully." }, 201);
    }
    return jsonError(c, 400, "FILE_MISSING", "APK file must be provided.");
  } catch (err) {
    console.error("[Releases] Upload failed:", err);
    return jsonError(c, 500, "UPLOAD_FAILED", err instanceof Error ? err.message : "Upload failed.");
  }
});
releaseRoutes.put("/admin/config", requireUser, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.downloadUrl) {
    return jsonError(c, 400, "INVALID_CONFIG", "A valid downloadUrl is required.");
  }
  const current = await getLatestApkRelease();
  const updated = await setLatestApkRelease({
    ...current,
    version: body.version || current.version,
    versionCode: Number(body.versionCode || current.versionCode),
    downloadUrl: String(body.downloadUrl).trim(),
    releaseNotes: body.releaseNotes !== void 0 ? String(body.releaseNotes) : current.releaseNotes,
    uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return c.json({ release: updated, message: "APK release configuration updated." });
});

// src/web-ui.ts
import fs from "node:fs";
import path4 from "node:path";
import { fileURLToPath } from "node:url";
var cachedHtml = "";
function getWebUiHtml() {
  if (cachedHtml) return cachedHtml;
  try {
    const __dirname = path4.dirname(fileURLToPath(import.meta.url));
    const htmlPath = path4.resolve(__dirname, "../../web/index.html");
    if (fs.existsSync(htmlPath)) {
      cachedHtml = fs.readFileSync(htmlPath, "utf8");
      return cachedHtml;
    }
  } catch {
  }
  return `<!doctype html><html><head><meta http-equiv="refresh" content="0; url=/v1/health"></head><body>Redirecting to Haiku API...</body></html>`;
}

// src/app.ts
var app = new Hono14();
var allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3002").split(",").map((item) => item.trim()).filter(Boolean);
app.use("*", secureHeaders({
  strictTransportSecurity: process.env.NODE_ENV === "production" ? "max-age=31536000; includeSubDomains" : void 0,
  xFrameOptions: false,
  referrerPolicy: "no-referrer"
}));
app.use("/v1/*", cors({
  origin: (origin) => {
    if (!origin) return "*";
    if (allowedOrigins.includes(origin)) return origin;
    if (origin.endsWith(".vercel.app")) return origin;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
    return origin;
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
  exposeHeaders: ["Retry-After", "X-Request-Id"],
  maxAge: 600
}));
app.use("/v1/*", async (c, next) => {
  const localUpload = process.env.MEDIA_STORAGE === "local" && c.req.method === "PUT" && c.req.path.endsWith("/content");
  return bodyLimit2({ maxSize: localUpload ? 10 * 1024 * 1024 : 256 * 1024 })(c, next);
});
app.get("/", (c) => {
  const accept = c.req.header("Accept") || "";
  if (accept.includes("text/html")) {
    return c.html(getWebUiHtml());
  }
  return c.json({ service: "haiku-api", version: "0.1.0", health: "/v1/health", web: "/app" });
});
app.get("/app", (c) => c.html(getWebUiHtml()));
app.get("/web", (c) => c.html(getWebUiHtml()));
for (const [assetPath, asset] of Object.entries(brandAssets)) {
  app.get(assetPath, (c) => c.body(asset.body, 200, { "Content-Type": asset.type, "Cache-Control": "public, max-age=86400" }));
}
app.get("/v1/health", async (c) => {
  let databaseConnected = false;
  if (dbReady()) {
    try {
      await getDb()`SELECT 1`;
      databaseConnected = true;
    } catch {
      databaseConnected = false;
    }
  }
  return c.json({
    status: "ok",
    databaseConfigured: dbReady(),
    databaseConnected,
    realtimeConfigured: Boolean(process.env.ABLY_API_KEY),
    googleSignInConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
    mediaStorage: process.env.MEDIA_STORAGE || "local"
  });
});
app.get("/v1/health/ready", async (c) => {
  if (!dbReady()) return c.json({ status: "not_ready", reason: "database_not_configured" }, 503);
  try {
    await getDb()`SELECT 1`;
    return c.json({ status: "ready" });
  } catch {
    return c.json({ status: "not_ready", reason: "database_unavailable" }, 503);
  }
});
app.route("/v1/auth", authRoutes);
app.route("/v1/profile", profileRoutes);
app.route("/v1/friends", friendRoutes);
app.route("/v1/conversations", conversationRoutes);
app.route("/v1/media", mediaRoutes);
app.route("/v1/groups", groupRoutes);
app.route("/v1/stories", storyRoutes);
app.route("/v1/reports", reportRoutes);
app.route("/v1/account", accountRoutes);
app.route("/v1/admin", adminRoutes);
app.route("/v1/internal", internalRoutes);
app.route("/v1/app", appPublicRoutes);
app.route("/v1/releases", releaseRoutes);
app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } }, 404));
app.onError((error, c) => {
  console.error("request failed", { path: c.req.path, method: c.req.method, errorName: error instanceof Error ? error.name : "UnknownError" });
  return c.json({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } }, 500);
});
var app_default = app;

// src/index.ts
var index_default = app_default;
export {
  index_default as default
};
