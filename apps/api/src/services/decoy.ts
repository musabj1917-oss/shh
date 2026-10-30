import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { env } from '../config.js';
import { logAuditEvent } from './audit.js';

export async function setupDecoyPassword(userId: string, decoyPassword: string) {
  const hash = await bcrypt.hash(decoyPassword, 10);
  await query(
    `INSERT INTO decoy_credentials (user_id, decoy_password_hash)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET decoy_password_hash = $2`,
    [userId, hash]
  );
  await logAuditEvent(userId, 'user.decoy_password_updated', 'user', userId);
}

export async function verifyDecoyLogin(email: string, password: string) {
  const rows = await query<{ user_id: string; decoy_password_hash: string }>(
    `SELECT dc.user_id, dc.decoy_password_hash
     FROM decoy_credentials dc
     JOIN users u ON u.id = dc.user_id
     WHERE u.email = $1 AND u.deleted_at IS NULL`,
    [email]
  );

  if (rows.length === 0) return null;

  const valid = await bcrypt.compare(password, rows[0].decoy_password_hash);
  if (!valid) return null;

  const userId = rows[0].user_id;
  await logAuditEvent(userId, 'user.decoy_login', 'user', userId);

  const token = jwt.sign({ sub: userId, email, isDecoy: true }, env.JWT_SECRET, { expiresIn: '7d' });

  return {
    isDecoy: true,
    token,
    user: {
      id: `decoy-${userId}`,
      email,
      firstName: 'Alex',
      lastName: 'Taylor'
    }
  };
}

export function getDecoyConversations() {
  return [
    {
      id: 'decoy-conv-1',
      title: 'Book Club Group',
      isGroup: true,
      lastMessage: {
        body: 'Who is finishing Chapter 4 tonight?',
        createdAt: new Date().toISOString()
      }
    },
    {
      id: 'decoy-conv-2',
      title: 'Jordan',
      isGroup: false,
      lastMessage: {
        body: 'Sounds good, see you at 5!',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      }
    }
  ];
}
