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
export * from './errorMapper.js';

