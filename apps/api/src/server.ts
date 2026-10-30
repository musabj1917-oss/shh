import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';
import { env } from './config.js';
import { validateBody, requireAuth, requireAdmin } from './middleware/auth.js';
import { registerSchema, loginSchema, googleLinkSchema } from './validation.js';
import { logAuditEvent } from './services/audit.js';
import { verifyDecoyLogin, setupDecoyPassword, getDecoyConversations } from './services/decoy.js';
import { getUserProfile, updateProfile, getDiscoverPeople } from './services/profile.js';
import { blockUser, unblockUser, submitReport } from './services/safety.js';
import { sendPrivateMessage, editMessage, deleteMessage } from './services/messaging.js';
import { createGroup, createGroupInviteLink, requestJoinViaLink, handleJoinRequest, removeGroupMember } from './services/groups.js';
import { createStory, getStoriesFeed, replyToStory, deleteStory } from './services/stories.js';
import { initiateVoiceCall, updateVoiceCallStatus } from './services/calls.js';
import {
  getAdminActiveMessages,
  getAdminUsersList,
  setAdminUserStatus,
  getAdminReportsList,
  resolveAdminReport,
  getAdminGroupsList,
  getAdminAuditLogs,
  getAdminSystemMetrics
} from './services/admin.js';

const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Serve Static Admin Dashboard Frontend
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please slow down.' }
});

app.use('/api/auth', authLimiter);

// 1. Registration
app.post('/api/auth/register', validateBody(registerSchema), async (req, res) => {
  const { email, password, firstName, lastName, dateOfBirth } = req.body;

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query<{ id: string; email: string; first_name: string; last_name: string; is_admin: boolean }>(
      `INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, is_admin`,
      [email, passwordHash, firstName, lastName, dateOfBirth]
    );

    const user = result[0];
    await logAuditEvent(user.id, 'user.registered', 'user', user.id, { provider: 'email' });

    const token = jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.is_admin
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to register user.' });
  }
});

// 2. Login (with Decoy credential check)
app.post('/api/auth/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    // First check if it matches decoy password
    const decoyResult = await verifyDecoyLogin(email, password);
    if (decoyResult) {
      return res.status(200).json(decoyResult);
    }

    const users = await query<{ id: string; email: string; password_hash: string | null; first_name: string; last_name: string; is_admin: boolean }>(
      'SELECT id, email, password_hash, first_name, last_name, is_admin FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (users.length === 0 || !users[0].password_hash) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = users[0];
    const valid = user.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    await logAuditEvent(user.id, 'user.login', 'user', user.id, { provider: 'email' });
    const token = jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.is_admin
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// 3. Google Auth
app.post('/api/auth/google', validateBody(googleLinkSchema), async (req, res) => {
  const { googleUserId, email, firstName, lastName, dateOfBirth } = req.body;

  try {
    const existingProvider = await query<{ user_id: string }>(
      'SELECT user_id FROM auth_providers WHERE provider = $1 AND provider_user_id = $2',
      ['google', googleUserId]
    );

    let userId: string;

    if (existingProvider.length > 0) {
      userId = existingProvider[0].user_id;
    } else {
      const existingUser = await query<{ id: string }>(
        'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
        [email]
      );

      if (existingUser.length > 0) {
        userId = existingUser[0].id;
      } else {
        if (!dateOfBirth) {
          return res.status(400).json({ error: 'Date of birth is required for new registration.' });
        }

        const newUser = await query<{ id: string }>(
          `INSERT INTO users (email, first_name, last_name, date_of_birth, is_verified)
           VALUES ($1, $2, $3, $4, TRUE)
           RETURNING id`,
          [email, firstName || 'Google', lastName || 'User', dateOfBirth]
        );
        userId = newUser[0].id;
      }

      await query(
        `INSERT INTO auth_providers (user_id, provider, provider_user_id, email)
         VALUES ($1, 'google', $2, $3)
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [userId, googleUserId, email]
      );
    }

    await logAuditEvent(userId, 'user.google_auth', 'user', userId, { googleUserId });
    const token = jwt.sign({ sub: userId, email }, env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      token,
      user: { id: userId, email }
    });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ error: 'Google authentication failed.' });
  }
});

// Admin Dashboard Protected Endpoints
app.get('/api/admin/messages', requireAdmin, async (_req, res) => {
  try {
    const messages = await getAdminActiveMessages();
    return res.status(200).json({ messages });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch active messages.' });
  }
});

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    const users = await getAdminUsersList();
    return res.status(200).json({ users });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user list.' });
  }
});

app.post('/api/admin/users/status', requireAdmin, async (req, res) => {
  const { targetUserId, isActive } = req.body;
  try {
    await setAdminUserStatus(req.user!.id, targetUserId, isActive);
    return res.status(200).json({ message: 'User status updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update user status.' });
  }
});

app.get('/api/admin/reports', requireAdmin, async (_req, res) => {
  try {
    const reports = await getAdminReportsList();
    return res.status(200).json({ reports });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch report list.' });
  }
});

app.post('/api/admin/reports/resolve', requireAdmin, async (req, res) => {
  const { reportId, status, notes } = req.body;
  try {
    await resolveAdminReport(req.user!.id, reportId, status, notes);
    return res.status(200).json({ message: 'Report resolved.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resolve report.' });
  }
});

app.get('/api/admin/groups', requireAdmin, async (_req, res) => {
  try {
    const groups = await getAdminGroupsList();
    return res.status(200).json({ groups });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch groups.' });
  }
});

app.get('/api/admin/audit-logs', requireAdmin, async (_req, res) => {
  try {
    const logs = await getAdminAuditLogs();
    return res.status(200).json({ logs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

app.get('/api/admin/metrics', requireAdmin, async (_req, res) => {
  try {
    const metrics = await getAdminSystemMetrics();
    return res.status(200).json({ metrics });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch system metrics.' });
  }
});

// Decoy Conversations endpoint
app.get('/api/decoy/conversations', requireAuth, (_req, res) => {
  return res.status(200).json({ conversations: getDecoyConversations() });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'haiiku-api' });
});

export default app;
