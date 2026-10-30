import { query } from '../db.js';
import { isBlocked } from './safety.js';
import { areFriends } from './messaging.js';
import { logAuditEvent } from './audit.js';

export async function initiateVoiceCall(callerId: string, receiverId: string) {
  if (await isBlocked(callerId, receiverId)) {
    throw new Error('Call unavailable due to blocking.');
  }

  if (!(await areFriends(callerId, receiverId))) {
    throw new Error('Voice calls are only supported between accepted friends.');
  }

  const rows = await query<{ id: string; status: string; started_at: string }>(
    `INSERT INTO voice_calls (caller_id, receiver_id, status)
     VALUES ($1, $2, 'ringing')
     RETURNING id, status, started_at`,
    [callerId, receiverId]
  );

  await logAuditEvent(callerId, 'voice_call.initiated', 'voice_call', rows[0].id, { receiverId });

  return {
    callId: rows[0].id,
    status: rows[0].status,
    startedAt: rows[0].started_at,
    signaling: {
      protocol: 'WebRTC-SIP-Signaling',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } // Free Google STUN server
      ],
      notice: 'Relay TURN traffic requires paid server infrastructure. Direct peer-to-peer WebRTC is used under $0 budget.'
    }
  };
}

export async function updateVoiceCallStatus(userId: string, callId: string, status: 'connected' | 'ended' | 'rejected') {
  const rows = await query<{ caller_id: string; receiver_id: string }>(
    `SELECT caller_id, receiver_id FROM voice_calls WHERE id = $1`,
    [callId]
  );

  if (rows.length === 0) throw new Error('Voice call session not found.');
  const call = rows[0];

  if (call.caller_id !== userId && call.receiver_id !== userId) {
    throw new Error('Unauthorized call update.');
  }

  let endedAt: string | null = null;
  if (status === 'ended' || status === 'rejected') {
    endedAt = new Date().toISOString();
  }

  await query(
    `UPDATE voice_calls SET status = $1, ended_at = COALESCE($2, ended_at) WHERE id = $3`,
    [status, endedAt, callId]
  );

  await logAuditEvent(userId, `voice_call.${status}`, 'voice_call', callId);
}
