# Haiku Messenger API - Backend & Vercel Deployment Setup

This document describes how to deploy the Haiku Messenger API (`apps/api`) to Vercel and configure the required environment variables and Neon database connection.

---

## 1. Vercel Project Settings

When creating or configuring the Vercel project for the API:

- **Framework Preset**: Other
- **Root Directory**: `apps/api`
- **Include Files Outside Root Directory in Build Step**: Enabled (default in modern Vercel monorepo setups). This allows access to root configuration and workspace packages like `packages/contracts`.
- **Install Command**: `cd ../.. && npm install` (configured in `apps/api/vercel.json` or project settings)
- **Build Command**: Leave default or empty (no extra compilation step required; Vercel Serverless Functions execute `index.ts` directly)

---

## 2. Neon Database Connection

The API uses `@neondatabase/serverless` to connect to PostgreSQL over HTTP / WebSocket pools.

- **`DATABASE_URL`**: Must be set to the **pooled connection string** of your Neon database.
  - Format: `postgresql://USER:PASSWORD@ep-PROJECT-pooler.REGION.aws.neon.tech/neondb?sslmode=require`
  - In the Neon console, select your project (`haiku-messenger`) and choose **Pooled connection** under Connection Details.
  - Serverless functions spin up and scale dynamically; using the pooled endpoint ensures connections are multiplexed without exhausting Postgres connection limits.

- **`DATABASE_MIGRATION_URL`** (Direct connection, for CLI migration runs only):
  - Format: `postgresql://USER:PASSWORD@ep-PROJECT.REGION.aws.neon.tech/neondb?sslmode=require`
  - Used with `npm run migrate` or psql when executing schema DDL migrations that require session-level locks.

---

## 3. Environment Variables for Vercel

Configure these variables in your Vercel Project under **Settings > Environment Variables**:

| Variable | Required / Optional | Description & Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Required | Set to `production` in Production deployments. |
| `DATABASE_URL` | Required | **Pooled** Neon PostgreSQL connection string (`postgresql://...-pooler....neon.tech/neondb?sslmode=require`). |
| `CRON_SECRET` | Required | A secure random string used to authenticate cron jobs (e.g. `/v1/internal/cleanup`). |
| `ALLOWED_ORIGINS` | Required | Comma-separated list of allowed web origins for CORS (e.g. `https://admin.haiku.app,http://localhost:3000`). |
| `API_PUBLIC_URL` | Required | Canonical public URL of the deployed API (e.g. `https://api.haiku.app`). Used for generating media links. |
| `API_BASE_URL` | Optional | Base URL for internal routing/email link generation (defaults to `API_PUBLIC_URL` or `http://localhost:3001`). |
| `ADMIN_WEB_URL` | Optional | Web URL for admin dashboard (e.g. `https://admin.haiku.app`). |
| `SESSION_TTL_DAYS` | Optional | Integer number of days for session lifetime (default: `30`). |
| `DEV_EMAIL_ECHO` | **Important** | Must be set to `false` (or removed) before serving real users. When `true`, emails (verification tokens, password resets) are echoed to logs and skipped from sending via SMTP. |
| `SMTP_HOST` | Required in prod | SMTP server hostname for outbound transactional emails. |
| `SMTP_PORT` | Optional | SMTP port (e.g. `587` or `465`, default: `587`). |
| `SMTP_SECURE` | Optional | `true` if port 465 (SSL/TLS), `false` for STARTTLS (default: `false`). |
| `SMTP_USER` | Optional | SMTP authentication username. |
| `SMTP_PASS` | Optional | SMTP authentication password. |
| `SMTP_FROM` | Optional | Sender address (e.g. `Haiku Messenger <no-reply@haiku.app>`). |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID for Google sign-in. |
| `ABLY_API_KEY` | Optional | Ably API key for realtime push events and presence. |
| `MEDIA_STORAGE` | Optional | Storage backend: set to `s3` in production. Note: `local` storage is disallowed in production/Vercel serverless runtime. |
| `MEDIA_BUCKET` | Required if s3 | S3 bucket name for private uploads/media. |
| `AWS_REGION` | Required if s3 | AWS region for the S3 bucket. |
| `AWS_ENDPOINT_URL_S3` | Optional | Custom S3 endpoint if using Cloudflare R2, MinIO, or alternative S3-compatible providers. |
| `AWS_ACCESS_KEY_ID` | Required if s3 | IAM Access Key ID for media storage. |
| `AWS_SECRET_ACCESS_KEY` | Required if s3 | IAM Secret Access Key for media storage. |
| `ACCOUNT_DELETION_GRACE_DAYS` | Optional | Grace period in days before account deletion is finalized (default: `30`). |
| `REPORT_RETENTION_DAYS` | Optional | Retention window in days for abuse reports (default: `365`). |

---

## 4. Database Migrations

Database schema migrations are located in `database/migrations/`:
1. `001_core.sql` - Core application schema (users, profiles, sessions, conversations, messages, groups, attachments, reports, admin roles).
2. `002_retention.sql` - Retention helper function `haiku_clear_expired_text_messages` and `cleanup_runs` table.
3. `003_moderation.sql` - Moderation enhancements (group suspension columns, admin notes on reports).

Migrations are tracked in `public.schema_migrations`.
To run migrations against Neon from the CLI:
```bash
DATABASE_MIGRATION_URL="postgresql://neondb_owner:PASSWORD@ep-PROJECT.REGION.aws.neon.tech/neondb?sslmode=require" npm run migrate
```

---

## 5. Health & Monitoring

The API exposes:
- `GET /v1/health` - Checks liveness and tests active connection to Neon via `SELECT 1`.
- `GET /v1/health/ready` - Readiness check for deployment orchestration.
