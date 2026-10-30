# Haiku Messenger — Stage 1 & Stage 2 Complete

Haiku Messenger is a public messaging app for users aged 13+. This repository contains the complete Stage 1 & Stage 2 implementations: backend API, React Native mobile application shell, PostgreSQL database migrations, real-time messaging, friend gating, decoy mode, 24-hour stories, groups with join approvals, voice call signaling, and security configurations.

## Visual Identity & Palette
- Primary Palette: Mint (`#BFF7E8`), Teal (`#0E7C86`), White (`#FFFFFF`).
- Accent / Ink: Deep Teal (`#0B5A63`), Slate Ink (`#0F172A`), Soft Gray (`#E2E8F0`).

## Architecture & Workspaces
- `apps/api`: Express + TypeScript API with PostgreSQL connection pooling (`pg`), JWT authentication, bcrypt password hashing, Zod input validation, rate-limiting (`express-rate-limit`), security audit logging, media auto-expiry cleanup jobs, decoy session isolation, friend-gated messaging, group invite link generation, story replies, and 1-to-1 WebRTC STUN voice call signaling.
- `apps/mobile`: React Native + TypeScript app shell using bare/native workflow structure with bottom tab stack navigation, safe area views, and responsive screens for chats, friends, discover, groups, stories, profile, and decoy login.
- `packages/shared`: Shared TypeScript constants and schemas across workspaces.
- `database`: Versioned PostgreSQL migrations (`001_initial_schema.sql`, `002_stage2_schema.sql`) and setup utilities.
- `docs`: Architecture, authentication strategy, Codespaces setup guide, and provider cost/limits analysis.
- `tests`: Automated Vitest test suite for auth age boundaries, database schema integrity, storage interface adapters, media magic number validation, $0 cost upload caps, and decoy session isolation.

## Stage 2 Features Implemented
1. **Core Real-Time Private Messaging**:
   - Private messaging is strictly friend-gated on the backend (requires accepted friendship).
   - Delivery & read receipts (`message_receipts`), voice note / photo / video media indicators, and delivery status icons.
   - Text message editing within a 15-minute window (`edited_at`).
   - Delete for self vs delete for everyone, with platform-admin-only overriding power.
   - 10-minute automatic media expiry for photos, videos, and voice notes with server cleanup.
2. **Profiles & Discover People**:
   - Username customization with 30-day change frequency limit (`username_last_changed_at`).
   - Bio, pronouns, and location settings.
   - Obscured birthday display (shows month and day, hides birth year for COPPA/privacy compliance).
   - Discover People recommendation algorithm combining random & popular users while excluding friends, blocked accounts, and self.
3. **Decoy Mode**:
   - Configurable decoy credential per user account, handled exclusively inside Haiku's email/password authentication flow (never Google OAuth).
   - Decoy session returns isolated synthetic fake chats, contacts, and activity without exposing real user data.
4. **Groups & Invite Links**:
   - Group ownership, admin role assignment, and owner-only member removal.
   - Admin-set invite links with expiration timestamps and max-use limits.
   - Invite links submit a join request (`group_join_requests`) requiring group admin/owner approval before joining.
5. **Stories**:
   - 24-hour expiring stories visible to everyone on Haiku Messenger.
   - Story replies with blocking enforcement. Early story deletion.
6. **Voice Calls & Safety**:
   - 1-to-1 voice call signaling endpoints providing direct STUN WebRTC metadata. TURN relay traffic requires paid infrastructure and is documented under $0 budget constraints.
   - Complete blocking (restricting messaging, requests, stories, profiles) and reporting with audit trail logs.

## Getting Started in GitHub Codespaces

1. **Setup Environment**:
   ```bash
   cp .env.example .env
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Typecheck, Lint, and Automated Tests**:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   ```

4. **Start the API Server**:
   ```bash
   npm --prefix apps/api run dev
   ```

5. **Start the Mobile Application**:
   ```bash
   npm --prefix apps/mobile run start
   ```

## Provider Cost & Limits Summary ($0 Budget Compliance)
- **Neon PostgreSQL**: Official free tier used for database. Media upload limits (5MB image, 15MB video, 10MB audio) and 10-minute media auto-expiry prevent database bloat under free storage quotas.
- **WebRTC STUN / Voice Calls**: Uses Google's free public STUN server (`stun:stun.l.google.com:19302`) for peer-to-peer signaling without paid TURN relays.
- **Zero Paid Services**: No Cloudinary, Cloudflare R2, or credit card dependencies introduced.
