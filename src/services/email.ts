import nodemailer from 'nodemailer';

function buildVerificationLink(token: string) {
  const base = process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3001';
  return `${base}/v1/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(email: string, token: string) {
  const link = buildVerificationLink(token);
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_EMAIL_ECHO === 'true') {
      console.info(`[dev email] verification for ${email}: ${link}`);
      return { delivered: false, developmentLink: link };
    }
    throw new Error('CONFIG_SMTP_MISSING');
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'Haiku Messenger <no-reply@example.invalid>',
    to: email,
    subject: 'Verify your Haiku Messenger email',
    text: `Verify your email within 30 minutes: ${link}\nIf you did not create this account, ignore this message.`,
  });
  return { delivered: true };
}

export async function sendPasswordResetEmail(email: string, token: string) {
  // Prefer ADMIN_WEB_URL (the Next.js admin frontend). Fall back to
  // the known production admin URL so the reset link never accidentally
  // points at the API server (which has no /reset-password page).
  const base =
    process.env.ADMIN_WEB_URL?.replace(/\/$/, '') ||
    'https://admin-musab12.vercel.app';
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_EMAIL_ECHO === 'true') {
      console.info(`[dev email] password reset for ${email}: ${link}`);
      return { delivered: false, developmentLink: link };
    }
    throw new Error('CONFIG_SMTP_MISSING');
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
  await transport.sendMail({ from: process.env.SMTP_FROM || 'Haiku Messenger <no-reply@example.invalid>', to: email, subject: 'Reset your Haiku Messenger password', text: `Reset your password within 30 minutes: ${link}\nIf you did not request this, ignore this message.` });
  return { delivered: true };
}
