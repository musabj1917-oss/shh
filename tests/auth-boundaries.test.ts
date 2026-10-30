import { describe, expect, it } from 'vitest';
import { registerSchema } from '../apps/api/src/validation.js';

function birthDateAtAge(age: number): string {
  const today = new Date();
  const dob = new Date(today.getFullYear() - age, today.getMonth(), today.getDate());
  return `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;
}

function validRegistration(dateOfBirth: string) {
  return {
    email: 'student@example.com',
    password: 'password123',
    firstName: 'Haiku',
    lastName: 'User',
    dateOfBirth
  };
}

describe('Authentication boundaries', () => {
  it('rejects users younger than 13', () => {
    expect(registerSchema.safeParse(validRegistration(birthDateAtAge(12))).success).toBe(false);
  });

  it('accepts users who have reached age 13', () => {
    expect(registerSchema.safeParse(validRegistration(birthDateAtAge(13))).success).toBe(true);
  });

  it('rejects invalid email input', () => {
    expect(registerSchema.safeParse({ ...validRegistration(birthDateAtAge(20)), email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects malformed dates', () => {
    expect(registerSchema.safeParse(validRegistration('not-a-date')).success).toBe(false);
  });
});
