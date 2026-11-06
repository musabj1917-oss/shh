import { z } from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter date of birth in YYYY-MM-DD format (e.g. 2000-12-01).').refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a real date in YYYY-MM-DD format.');

/** Calendar-date calculation: the year is kept private and never returned in public profiles. */
export function meetsMinimumAge(dateOfBirth: string, now = new Date(), minimumAge = 13): boolean {
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0,10)!==dateOfBirth) return false;
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - minimumAge, now.getUTCMonth(), now.getUTCDate()));
  return birth.getTime() <= cutoff.getTime();
}

export const usernameSchema = z.string().trim().toLowerCase()
  .min(3).max(24).regex(/^[a-z0-9_]+$/, 'Use 3–24 letters, numbers, or underscores.');
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(12).max(128);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(60),
  dateOfBirth: isoDate,
}).strict();

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
export const googleRegisterSchema = z.object({
  idToken: z.string().min(20).max(8192),
  dateOfBirth: isoDate.optional(),
  username: usernameSchema.optional(),
  displayName: z.string().trim().min(1).max(60).optional(),
}).strict();

export const profilePatchSchema = z.object({
  username: usernameSchema.optional(),
  displayName: z.string().trim().min(1).max(60).optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  location: z.string().trim().max(80).nullable().optional(),
  birthdayMonth: z.number().int().min(1).max(12).nullable().optional(),
  birthdayDay: z.number().int().min(1).max(31).nullable().optional(),
  avatarAttachmentId: z.string().uuid().nullable().optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one profile change.')
  .refine((value) => (value.birthdayMonth === undefined) === (value.birthdayDay === undefined), 'Update the birthday month and day together.')
  .refine((value) => {
    if (value.birthdayMonth == null || value.birthdayDay == null) return true;
    const daysInMonth = [31,29,31,30,31,30,31,31,30,31,30,31];
    return value.birthdayDay <= daysInMonth[value.birthdayMonth - 1];
  }, 'That birthday is not a valid calendar date.');

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1).max(4000).optional(),
  attachmentId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
  expiresInHours: z.union([z.literal(1), z.literal(24), z.literal(168)]).nullable().optional(),
}).strict().refine((value) => Boolean(value.text || value.attachmentId), 'A message needs text or an attachment.');

export const groupCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  memberIds: z.array(z.string().uuid()).max(99).default([]),
}).strict();
export const storyCreateSchema = z.object({
  attachmentId: z.string().uuid(),
  caption: z.string().trim().max(280).optional(),
  mediaType: z.enum(['image', 'video']),
}).strict();
export const reportSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  category: z.enum(['harassment', 'spam', 'impersonation', 'unsafe_content', 'other']),
  reason: z.string().trim().max(2000).optional(),
  evidenceAttachmentId: z.string().uuid().optional(),
}).strict().refine((value) => Boolean(value.targetUserId || value.groupId || value.messageId), 'Select something to report.');

export const messageKindSchema = z.enum(['text', 'image', 'video', 'voice']);
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageKind = z.infer<typeof messageKindSchema>;
export interface UserFriendlyError {
  title: string;
  message: string;
  technicalDetails?: string;
}

/**
 * Translates raw technical exceptions, HTTP statuses, and backend codes
 * into calm, reassuring, and actionable user experiences.
 */
export function mapErrorToUserFriendly(err: unknown): UserFriendlyError {
  let rawMessage = '';
  let status: number | undefined;
  let code: string | undefined;

  if (typeof err === 'string') {
    rawMessage = err;
  } else if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    rawMessage = String(anyErr.message || anyErr.error || anyErr.statusText || '');
    if (typeof anyErr.status === 'number') status = anyErr.status;
    if (typeof anyErr.statusCode === 'number') status = anyErr.statusCode;
    if (typeof anyErr.code === 'string') code = anyErr.code;
    if (anyErr.error && typeof anyErr.error === 'object') {
      const sub = anyErr.error as Record<string, unknown>;
      if (typeof sub.message === 'string') rawMessage = sub.message;
      if (typeof sub.code === 'string') code = sub.code;
    }
  }

  const normalized = (rawMessage + ' ' + (code || '')).toLowerCase();
  const techDetails = (code ? `[Code: ${code}] ` : '') + (status ? `[HTTP ${status}] ` : '') + (rawMessage || (typeof err === 'string' ? err : JSON.stringify(err)));

  // 1. Storage & Buckets
  if (normalized.includes('storage') || normalized.includes('bucket') || normalized.includes('s3') || normalized.includes('neon-s3')) {
    return {
      title: 'File Service Temporarily Unavailable',
      message: "We can't connect to file storage at the moment. Your files are safe, but uploads and downloads are paused.",
      technicalDetails: techDetails,
    };
  }

  // 2. Connectivity & Offline
  if (
    normalized.includes('networkerror') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('offline') ||
    normalized.includes('network request failed') ||
    normalized.includes('enotfound') ||
    normalized.includes('econnrefused') ||
    normalized.includes('etimedout')
  ) {
    return {
      title: 'Unable to Connect',
      message: 'Check your internet connection and try again.',
      technicalDetails: techDetails,
    };
  }

  // 3. Auth & Session Expiry
  if (
    status === 401 ||
    normalized.includes('401') ||
    normalized.includes('jwt expired') ||
    normalized.includes('token expired') ||
    normalized.includes('unauthorized') ||
    code === 'INVALID_CREDENTIALS' ||
    code === 'UNAUTHORIZED'
  ) {
    return {
      title: 'Session Expired',
      message: 'Please sign in again to continue.',
      technicalDetails: techDetails,
    };
  }

  // 4. Email Unverified
  if (code === 'EMAIL_UNVERIFIED' || normalized.includes('email_unverified') || normalized.includes('verify your email')) {
    return {
      title: 'Email Verification Required',
      message: 'Please verify your email address before signing in. Check your inbox for the confirmation link.',
      technicalDetails: techDetails,
    };
  }

  // 5. Date of Birth Regex Format
  if (normalized.includes('\\d{4}-\\d{2}-\\d{2}') || normalized.includes('yyy-mm-dd') || normalized.includes('iso date')) {
    return {
      title: 'Invalid Date Format',
      message: 'Please enter your date of birth in YYYY-MM-DD format (for example, 2000-12-01).',
      technicalDetails: techDetails,
    };
  }

  // 6. Age Restriction
  if (normalized.includes('at least 13') || normalized.includes('minimum age')) {
    return {
      title: 'Age Requirement',
      message: 'You need to be at least 13 years old to create an account on Haiku Messenger.',
      technicalDetails: techDetails,
    };
  }

  // 7. Password requirements
  if (normalized.includes('password') && (normalized.includes('12') || normalized.includes('character') || normalized.includes('short'))) {
    return {
      title: 'Password Requirements',
      message: 'Your password must be at least 12 characters long.',
      technicalDetails: techDetails,
    };
  }

  // 8. Permissions / 403 Forbidden
  if (status === 403 || normalized.includes('forbidden') || normalized.includes('not allowed')) {
    return {
      title: 'Access Restricted',
      message: "You don't have permission to perform this action.",
      technicalDetails: techDetails,
    };
  }

  // 9. Not Found / 404
  if (status === 404 || normalized.includes('not found') || code === 'USER_NOT_FOUND' || code === 'NOT_FOUND') {
    return {
      title: 'Item Not Found',
      message: 'The requested conversation, user, or resource is no longer available.',
      technicalDetails: techDetails,
    };
  }

  // 10. Rate limiting / 429
  if (status === 429 || normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return {
      title: 'Slow Down a Bit',
      message: 'You have made too many requests in a short time. Please take a breath and try again shortly.',
      technicalDetails: techDetails,
    };
  }

  // 11. Default fallback for unknown 500 / server / uncaught errors
  return {
    title: 'Something Went Wrong',
    message: 'We hit an unexpected snag. Our engineers have been alerted.',
    technicalDetails: techDetails,
  };
}
