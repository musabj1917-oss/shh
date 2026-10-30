import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config.js';
import { query } from '../db.js';

export interface UserPayload {
  id: string;
  email: string;
  isAdmin?: boolean;
}

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: result.error.flatten()
      });
    }

    req.body = result.data;
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; email: string };
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; email: string };

    // Server-side database validation for is_admin flag
    const rows = await query<{ is_admin: boolean; is_active: boolean }>(
      'SELECT is_admin, is_active FROM users WHERE id = $1 AND deleted_at IS NULL',
      [decoded.sub]
    );

    if (rows.length === 0 || !rows[0].is_active || !rows[0].is_admin) {
      return res.status(403).json({ error: 'Forbidden: Owner-only admin access required.' });
    }

    req.user = { id: decoded.sub, email: decoded.email, isAdmin: true };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
