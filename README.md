# Haiku Messenger

A calm, mint-inspired social messenger for friends, students, and groups aged 13+.

This repository is an npm-workspaces monorepo containing the React Native app, the Node/TypeScript API, the Next.js administration console, and shared validation contracts.

```
apps/
  api/        Hono + TypeScript API on Node 22 (Vercel serverless entry)
  admin/      Next.js 16 administration console (Vercel)
  mobile/     React Native 0.88 app (Android + iOS)
packages/
  contracts/  Shared Zod schemas and age/username rules
database/
  migrations/ PostgreSQL schema, retention, moderation
tests/        Node test suite for contracts, security, and API smoke checks
docs/         Deployment and audit documentation
```

## Requirements

- Node.js 22.13+ (`.nvmrc` pins 22)
- npm 10+
- PostgreSQL (Neon recommended) for the API
- Android Studio + JDK 17 or Xcode for native builds

## Setup

```bash
npm ci
cp .env.example .env
# edit .env with DATABASE_URL, DATABASE_MIGRATION_URL, and optional services
npm run migrate
npm run dev:api      # http://localhost:3001
npm run dev:admin    # http://localhost:3000
```

The API exposes `GET /v1/health` and `GET /v1/health/ready`. The admin console needs
`HAIKU_API_URL` (server-only) pointing at the API, for example `http://localhost:3001/v1`.

### Mobile

```bash
cd apps/mobile
cp .env.example .env
# HAIKU_API_BASE_URL is public configuration, not a secret.
npm run android      # or: npm run ios
```

`npm run configure` writes `src/config.generated.ts` from `HAIKU_API_BASE_URL`.
Android emulators use `http://10.0.2.2:3001/v1`; iOS simulators use `http://localhost:3001/v1`.

## Checks

```bash
npm run typecheck
npm run lint:mobile
npm test
npm run build:admin
npm run android:debug     # requires Android SDK + JDK
```

CI runs typecheck, mobile lint, API tests, the admin production build, and an Android debug APK.

## Features

Implemented end-to-end:

- Email registration/login, email verification, recovery, session revocation, account export/deletion
- 13+ date-of-birth enforcement, unique usernames, public discovery, blocking
- Friend requests, friends-only direct messaging, groups with owners/admins, invite links
- Text/photo/video messages, replies, editing (15 min), delete for me/everyone, read/delivery receipts
- 1 hour / 24 hours / 7 days message expiry, plus 10-minute expiry for video and voice media
- Stories (photo/video, 24h), views, replies, deletion
- Realtime events and typing/presence via Ably
- In-app notifications and preferences (quiet mode, previews, receipts, typing, presence)
- Reports with optional photo/video evidence and admin moderation, including message removal
- Administration console with role permissions, suspension, deletion, group moderation, audit log

Not yet implemented (see `docs/BRIEFING_VS_REPO.md`):

- Voice note recording/playback in the mobile app (server media type and expiry exist)
- Push notification delivery (FCM/APNs); in-app notifications work
- Google sign-in in the mobile app (API token verification exists)
- Screenshot detection/notification and platform capture protection
- iOS CI/build automation

## Security notes

- Sessions are opaque random tokens, stored as SHA-256 hashes; passwords use scrypt.
- API authorization is enforced server-side. Admin permissions are checked on every request.
- Media is private by default; uploads are size/MIME/magic-byte validated and access is checked per purpose.
- Expired and deleted content is excluded from reads; cleanup is a retryable backstop.
- There is **no end-to-end encryption**. The app does not claim it.

## Deployment

- API: Vercel project rooted at `apps/api`, with the Neon pooled `DATABASE_URL` and a daily cleanup cron (`/v1/internal/cleanup`) authenticated by `CRON_SECRET`.
- Admin: Vercel project rooted at `apps/admin`, with server-only `HAIKU_API_URL`.
- Media: use `MEDIA_STORAGE=neon-s3` in production. Local disk storage is blocked on Vercel.
- Mobile: build with the React Native CLI; the CI workflow publishes a debug APK as a prerelease.

See `docs/SETUP_BACKEND.md` for environment variables and bootstrap steps.
