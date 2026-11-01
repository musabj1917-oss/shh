import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

let isInitialized = false;

export function initFirebaseAdmin(): boolean {
  if (isInitialized) return true;
  if (getApps().length > 0) {
    isInitialized = true;
    return true;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      isInitialized = true;
      console.log('[Firebase] Admin SDK initialized successfully.');
      return true;
    } catch (err) {
      console.error('[Firebase] Failed to initialize Firebase Admin SDK:', err);
      return false;
    }
  }

  // Check if GOOGLE_APPLICATION_CREDENTIALS is present
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      initializeApp({
        credential: applicationDefault(),
      });
      isInitialized = true;
      console.log('[Firebase] Admin SDK initialized via applicationDefault().');
      return true;
    } catch (err) {
      console.error('[Firebase] Failed applicationDefault init:', err);
      return false;
    }
  }

  return false;
}

export function isFirebaseConfigured(): boolean {
  return initFirebaseAdmin();
}

export async function verifyFirebaseToken(idToken: string): Promise<{
  uid: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
} | null> {
  if (!initFirebaseAdmin()) {
    console.warn('[Firebase] ID token verification skipped: Firebase credentials not configured in env.');
    return null;
  }

  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified,
      displayName: decoded.name,
    };
  } catch (err) {
    console.error('[Firebase] ID token verification failed:', err);
    return null;
  }
}

export async function sendFcmNotification(
  registrationTokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<{ successCount: number; failureCount: number }> {
  if (!initFirebaseAdmin() || registrationTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens: registrationTokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
    });
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (err) {
    console.error('[Firebase FCM] Push notification dispatch failed:', err);
    return { successCount: 0, failureCount: registrationTokens.length };
  }
}
