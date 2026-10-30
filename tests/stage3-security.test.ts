import { describe, expect, it } from 'vitest';
import { requireAdmin } from '../apps/api/src/middleware/auth.js';
import { processAccountDeletionLifecycle } from '../apps/api/src/services/lifecycle.js';

describe('Stage 3 Security & Authorization Controls', () => {
  it('exports requireAdmin middleware for server-side owner authorization', () => {
    expect(typeof requireAdmin).toBe('function');
  });

  it('exports processAccountDeletionLifecycle function for background worker data purging', () => {
    expect(typeof processAccountDeletionLifecycle).toBe('function');
  });
});
