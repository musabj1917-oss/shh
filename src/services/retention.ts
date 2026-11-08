import { getDb } from '../db.js';
import { getStorage } from './storage.js';

let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60 * 1000; // Rate limit passive sweeps to once per 60 seconds

export async function purgeExpiredMediaAndMessages(): Promise<{ deletedObjects: number; deletedMessages: number }> {
  let deletedObjects = 0;
  let deletedMessages = 0;

  try {
    // 1. Mark expired text messages as deleted
    try {
      const cleared = await getDb()`SELECT haiku_clear_expired_text_messages(1000) AS changed`;
      deletedMessages += Number((cleared[0] as { changed: number } | undefined)?.changed || 0);
    } catch {
      // function may not exist in minimal environments
    }

    // 2. Mark expired media messages as deleted and queue attachments for immediate object deletion
    const expiredMessages = await getDb()`
      WITH due AS (
        SELECT id, attachment_id FROM messages
        WHERE expires_at IS NOT NULL AND expires_at <= now() AND deleted_at IS NULL
        ORDER BY expires_at ASC LIMIT 1000
        FOR UPDATE SKIP LOCKED
      )
      UPDATE messages m
      SET body = NULL, attachment_id = NULL, deleted_at = now(), deletion_kind = 'expired'
      FROM due WHERE m.id = due.id
      RETURNING due.attachment_id;
    ` as Array<{ attachment_id: string | null }>;

    deletedMessages += expiredMessages.length;

    const attachmentIdsToExpire = expiredMessages.map((r) => r.attachment_id).filter(Boolean);
    if (attachmentIdsToExpire.length > 0) {
      await getDb()`
        UPDATE attachments
        SET expires_at = LEAST(COALESCE(expires_at, now()), now())
        WHERE id = ANY(${attachmentIdsToExpire});
      `;
    }

    // 3. Mark expired stories and queue their attachments for deletion
    await getDb()`
      UPDATE attachments SET expires_at = now()
      WHERE purpose = 'story'
        AND id IN (SELECT attachment_id FROM stories WHERE expires_at <= now() OR deleted_at IS NOT NULL)
        AND (expires_at IS NULL OR expires_at > now());
    `;
    await getDb()`
      UPDATE stories SET deleted_at = COALESCE(deleted_at, now())
      WHERE expires_at <= now() AND deleted_at IS NULL;
    `;

    // 4. Find attachments whose time is up or that are stale pending/failed uploads
    const dueAttachments = await getDb()`
      SELECT id, object_key FROM attachments
      WHERE (expires_at IS NOT NULL AND expires_at <= now())
         OR (status IN ('pending', 'failed') AND created_at <= now() - interval '2 hours')
      ORDER BY created_at ASC
      LIMIT 100;
    ` as Array<{ id: string; object_key: string }>;

    let storage;
    try {
      storage = getStorage();
    } catch {
      storage = undefined;
    }

    for (const item of dueAttachments) {
      try {
        if (storage) {
          await storage.deleteObject(item.object_key);
        }
        await getDb()`DELETE FROM attachments WHERE id = ${item.id}`;
        deletedObjects++;
      } catch {
        // Idempotent: leave row to retry on next cycle
      }
    }
  } catch {
    // Non-fatal fallback
  }

  return { deletedObjects, deletedMessages };
}

export function triggerPassiveRetentionSweep(): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  void purgeExpiredMediaAndMessages().catch(() => {});
}
