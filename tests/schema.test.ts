import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Database migration 001_initial_schema.sql', () => {
  const sqlPath = path.join(__dirname, '../database/migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  it('contains extensions citext and pgcrypto', () => {
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "citext";');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  });

  it('contains all foundational Stage 1 tables', () => {
    const requiredTables = [
      'users',
      'auth_providers',
      'friend_requests',
      'friendships',
      'conversations',
      'conversation_memberships',
      'groups',
      'group_memberships',
      'media_assets',
      'messages',
      'stories',
      'story_replies',
      'blocks',
      'reports',
      'notification_preferences',
      'moderation_actions',
      'audit_logs',
      'account_deletion_requests',
      'deletion_jobs'
    ];

    for (const table of requiredTables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('enforces age check constraint on users date_of_birth', () => {
    expect(sql).toContain("CHECK (date_of_birth <= NOW() - INTERVAL '13 years')");
  });
});
