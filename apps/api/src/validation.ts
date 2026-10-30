import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  dateOfBirth: z.string().refine((value) => {
    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) return false;

    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    const dayDiff = now.getDate() - dob.getDate();

    const hasBirthdayPassed = monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0);
    const actualAge = hasBirthdayPassed ? age : age - 1;

    return actualAge >= 13;
  }, 'You must be at least 13 years old to register on Haiku Messenger.')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.')
});

export const googleLinkSchema = z.object({
  googleUserId: z.string().min(1, 'Google user ID required.'),
  email: z.string().email('Invalid email address.'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional()
});
