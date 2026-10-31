# Haiku Messenger — Briefing vs. Repository

**Audit date:** 2026-10-31
**Repository:** `musabj1917-oss/shh` @ `master` (`05c64db`)
**Scope:** comparison of the project briefing against the checkout, updated after the first parity pass. Product changes made in that pass are listed in section 0.

---

## 0. Parity pass — what changed (2026-10-31)

| Gap | Action |
| --- | --- |
| Message expiry had no UI | Added an Off/1h/24h/7d selector to the chat composer; the value is sent as `expiresInHours`. |
| Admins could not remove messages | Added `POST /v1/admin/messages/:messageId/remove`, the `messages.moderate` permission (owner + moderator), a tombstone deletion kind, audit logging, realtime refresh, and console buttons in reports and message review. |
| Report evidence had no UI | Added optional photo/video evidence upload to the report modal. |
| Invitations were token-only | The API now returns a shareable `invite.url`; `haikumessenger://join/<token>` deep links open a new Join Group screen (Android intent filter + iOS URL type). Token paste still works. |
| Mobile lint failed | Fixed unused imports/bindings and excluded tooling config from ESLint; lint now has zero errors (warnings remain) and runs in CI. |
| Setup docs contradicted the code | Corrected `MEDIA_STORAGE` to `neon-s3`, removed the R2 example, documented invite and owner-bootstrap variables, and added a root README. |

Still blocked on native SDKs, credentials, or device testing: voice recording/playback, push delivery, mobile Google sign-in, screenshot detection. Those are not reproducibly implementable in this environment and are noted again in section 6.

---

## 1. Short answer

The briefing describes a **finished, feature-complete social messenger**. The repository is a **compact, coherent MVP** of that product: about **4,000 lines of first-party source**, a **single commit of history**, three apps plus shared contracts, and a CI pipeline that is currently green.

The architecture is real, not a mock: the mobile screens call the real API, the API queries a normalized PostgreSQL schema, media uploads are validated server-side, and administration is permission-checked in the API. But several capabilities the briefing lists as existing are **not implemented end-to-end**, and two of the briefing's stated build failures are **already fixed and obsolete**.

The biggest single correction: **there is no Express, `helmet`, or `express-rate-limit` anywhere in this repository.** The API is Hono. Those historical TypeScript errors cannot exist in this codebase.

---

## 2. What the briefing gets right

| Briefing claim | Repository reality |
| --- | --- |
| Existing monorepo with mobile, backend, admin dashboard | `apps/mobile`, `apps/api`, `apps/admin`, `packages/contracts` |
| React Native mobile app with native Android and iOS projects | RN 0.88.0 with real `android/` Gradle project and `ios/` Xcode project |
| Not Expo | No Expo dependency; React Native CLI only |
| Node.js + TypeScript backend | Hono 4 + TypeScript 6, Node 22 |
| PostgreSQL on Neon | `@neondatabase/serverless`, pooled + direct URLs, 3 SQL migrations |
| Realtime services | Ably token requests, conversation channels, typing/presence channels |
| Email service | Nodemailer SMTP, verification + reset flows |
| Storage abstraction | `local` disk adapter and `neon-s3` (S3-compatible) adapter, shared interface |
| Next.js admin dashboard on Vercel | Next.js 16.4.3 app with server-side API proxy and httpOnly session cookie |
| Mint visual identity, mobile-first | Mint palette (`#…` tokens in `theme/colors.ts`), custom surface/button/field components |
| No school code required | No school-code concept anywhere |
| Minimum age 13 | Enforced client-side and in the API contract (`meetsMinimumAge`) plus server route |
| Unique usernames | DB unique index + normalization + 30-day change cooldown |
| Friend request must be accepted before private chat | Direct conversation creation requires a `friendships` row |
| Blocking stops messages, requests, story replies, profiles | Enforced in queries for each of those paths |
| 15-minute edit window | Server-side `created_at > now() - interval '15 minutes'` + client menu condition |
| Delete for me / for everyone | `message_hidden` table vs. tombstone update |
| Read/delivery receipts | `message_receipts` + settings-aware status query |
| Typing indicators | Ably ephemeral channel + setting |
| Group owner/admin roles, add members, owner removal authority | Implemented in `routes/groups.ts` |
| Invites: expiry, revocation, max uses, approval | Implemented, including approval queue and notifications |
| Stories: publish, view, reply, delete, no save | Implemented; no download/save affordance |
| Video/voice 10-minute expiry | Server sets `expires_at = now() + 10 minutes` for those message types |
| Reports with category/reason/evidence; limited retention | Schema + API support, 365-day default retention and cleanup job |
| Admin suspension/deletion, roles, audit logs | Implemented and server-enforced |
| Expired content stays deleted | Read queries filter `expires_at`; cleanup is a backstop |
| No false end-to-end-encryption claim | No E2EE claim in code or UI; the UI explicitly disclaims it |
| No Cloudinary / no R2 integration | Neither is used |

---

## 3. Differences that change the plan

### 3.1 “The application has already been developed” — it is an MVP, not a finished release

The whole first-party codebase is **4,061 lines** across TypeScript, TSX, SQL, and scripts. It is a single initial commit. There are:

- 11 Node tests (health/auth smoke, contracts, crypto/media signatures) and 1 mobile Jest test.
- No database integration tests, no route-level tests with a real database, no admin tests, no end-to-end tests.
- No iOS build pipeline; the root README and backend setup documentation now exist.

That does not make it bad — it is unusually disciplined for an MVP — but the briefing’s assumption that most features only need verification is not accurate. A meaningful share of the roadmap is still greenfield.

### 3.2 Backend stack: Hono, not Express

| Briefing | Repository |
| --- | --- |
| Node.js/TypeScript API with `helmet` and `express-rate-limit` import errors | Hono 4.13.14. No `express`, `helmet`, or `express-rate-limit` in `package.json` **or `package-lock.json`** |
| — | Security headers via `hono/secure-headers` (`apps/api/src/app.ts`) |
| — | Rate limiting via a custom PostgreSQL fixed-window limiter (`middleware/rate-limit.ts`) |
| — | CORS allowlist via `hono/cors` |
| — | Request body limits via `hono/body-limit` |

**Conclusion:** the reported helmet/express-rate-limit TypeScript errors are historical from a previous stack and **cannot be reproduced** here.

### 3.3 Android build failure is fixed; CI builds and publishes an APK

The briefing says Android failed with:

> Missing `apps/mobile/node_modules/react-native/ReactAndroid/gradle.properties`

Current state:

- `apps/mobile/android/app/build.gradle` explicitly points at the **hoisted root** `node_modules`: `reactNativeDir`, `codegenDir`, `cliFile`, and `hermesCommand`.
- `apps/mobile/android/settings.gradle` includes the root `@react-native/gradle-plugin`.
- The installed tree contains `node_modules/react-native/ReactAndroid/gradle.properties` and `node_modules/hermes-compiler/hermesc`.
- Latest GitHub Actions run (`41172099279`, master) is **fully green**: “Typecheck, test, build admin” (42s) and “Android debug APK” (3m45s), with an uploaded APK artifact.
- A prerelease `debug-latest` exists with the APK.

This is the workspace fix for monorepo hoisting, not a random Gradle change. **Do not “fix” it again.**

Caveat: this sandbox has no JDK, Android SDK, or Xcode, so I could not rebuild locally. The green CI run is the verification.

### 3.4 Voice notes are not implemented in the app

The **data model** supports `voice`:

- `attachments.media_type` allows `voice`
- `messages.message_type` allows `voice`
- upload intents accept audio MIME types and 10 MB
- message expiration gives voice/video 10 minutes

But the **mobile client cannot record, upload as a voice note, play, or even render one**:

- No audio/recording dependency in `apps/mobile/package.json`
- No recorder UI in `ChatScreen.tsx`
- `ChatScreen` explicitly excludes voice messages from media URL resolution (`item.message_type!=='voice'`)
- No microphone permission in `AndroidManifest.xml` or `Info.plist`

**Classification:** server model implemented; feature missing in the app.

### 3.5 Push notifications are absent

The briefing describes notification settings, sender previews, and quiet mode. The repo has:

- `notifications` table + in-app inbox + Ably user events
- `user_settings` with `quiet_mode` (default true), `notifications_enabled`, `sender_previews`
- `device_push_tokens` table
- `FCM_*` variables in `.env.example`

But there is **no FCM/APNs sending code, no device-token registration endpoint, and no client push SDK**. The mobile screen is honest about it: “Push notifications are not connected yet.”

Quiet mode and sender previews are persisted but **have no delivery path to influence**. This is not a small wiring task; it is a missing subsystem.

### 3.6 Screenshot detection/notification is absent

No code path for screenshot detection, screen-capture listeners, `FLAG_SECURE`, or iOS capture notifications. The only screenshot reference is a privacy disclaimer on the profile screen. The briefing’s “where the operating system supports detection” feature does not exist yet.

### 3.7 Google sign-in exists only on the server

- `POST /v1/auth/google` verifies Google ID tokens, links verified emails, creates accounts, and enforces age.
- The mobile app has **no Google SDK, no Google button, and no flow** in `AuthScreen.tsx`.
- “Account recovery through Google sign-in” also does not exist; recovery is email/SMTP only.

### 3.8 Message expiration now has a composer control

`sendMessageSchema` accepts `1 | 24 | 168` hours, the insert computes expiry, and the composer now exposes an Off/1h/24h/7d selector. The default remains **no expiration** until the sender chooses otherwise.

### 3.9 Admins can now remove messages

The console exposes a **Remove message** action on reports and on active messages in the owner's conversation review. It calls `POST /v1/admin/messages/:messageId/remove`, which requires the `messages.moderate` permission (owner + moderator), tombstones the content (`deletion_kind='moderator'`), expires its attachment, writes an audit event with a reason, and publishes a realtime refresh. Expired/deleted content cannot be targeted again and remains unrecoverable. Migration `004_message_moderation.sql` grants the permission and extends the deletion-kind constraint.

### 3.10 Stories are friend-only, not “other Haiku users”

Story list, story detail, story media access, and story replies all require a **friendship** (or ownership). The briefing’s phrasing suggests broader visibility. Friend-only is defensible for privacy, but it is a difference in product behavior.

### 3.11 Invitation links now work as deep links

The API returns both the token and a shareable `invite.url` (default `haikumessenger://join/<token>`, configurable via `MOBILE_INVITE_BASE_URL`). The mobile app registers the `haikumessenger` scheme on Android and iOS, maps it to a Join Group screen, and keeps the invitation pending across sign-in. The manual token/URL paste path remains.

Runtime verification of the deep link on a device is still pending; the URL type and intent filter are statically configured and typechecked.

### 3.12 Report evidence now has an upload path

The report modal can attach an optional photo or video, upload it with `purpose='report'`, and submit `evidenceAttachmentId`. The API continues to validate ownership, purpose, and expiry; admins can review evidence from the report card.

### 3.13 Notification settings are preferences without a pipeline

`quiet_mode`, `sender_previews`, etc. are stored and displayed. Their descriptions in `ProfileScreen.tsx` explicitly say scheduling/push/previews are not implemented. This is accurate but means the briefing’s notification section is mostly future work.

### 3.14 Admin “active application data” is partial

Implemented: dashboard counters, account directory, conversation metadata/content (owner), media review, groups, reports, audit trail, admin roles.

Not implemented: browsing stories, searching messages globally, content-level moderation, editing profile data, member management from admin.

### 3.15 Documentation contradicts the code

`docs/SETUP_BACKEND.md` previously said to set `MEDIA_STORAGE=s3` in production and mentioned Cloudflare R2, neither of which matched the code. Both are corrected: valid values are `local` and `neon-s3`, and the endpoint guidance now references S3-compatible storage only. `FCM_*` variables remain exported but unused; they are reserved for the push phase and should not be treated as a working feature.

### 3.16 Quality gates are weaker than the briefing implies

- **TypeScript:** passes for contracts, API, admin, mobile.
- **Tests:** 12/12 API/contract/security tests pass; 4/4 mobile tests pass (brand mark + invite parsing).
- **Admin production build:** succeeds.
- **Lint:** zero errors, 368 style warnings (`eslint .` mobile). CI now runs the mobile lint step.
- **iOS:** project exists, but no CI job and no local verification possible here. The new deep-link URL type is configured but not runtime-tested.
- **Database:** no live database in this workspace, so all SQL routes are code-reviewed, not runtime-verified.

### 3.17 Repository hygiene

- `cala.zip` (1.3 MB) is a **stale full snapshot** of the project (missing `.github`, `docs`, `contracts.ts`, etc.), committed to the repo.
- `haiku-group-invite-fixed-files.zip` contains files **identical** to the working tree now; it is a leftover delivery artifact.
- `apps/admin/tsconfig.tsbuildinfo` is committed build output.
- Single commit history; no license or CONTRIBUTING; stale archives remain (see below).
- `.env` files are correctly ignored; `.env.example` files exist.

### 3.18 Design: identity present, polish limited

Mint palette, rounded surfaces, consistent spacing, loading/empty/error states, and a custom brand mark are present. Typography is system default with heavy font weights; primary navigation uses emoji glyphs (`◌ ◉ ♧ ○`). It reads as clean and coherent, but not yet the “polished, modern typography” bar in the briefing. No custom fonts, no icon set, no animation system.

---

## 4. Feature classification

Legend: **Implemented** = end-to-end code exists and is coherent (DB-backed routes not runtime-tested here); **Partial** = some layers exist; **Missing** = no implementation; **Cannot verify** = needs an environment we do not have.

### Accounts and authentication

| Feature | Status | Notes |
| --- | --- | --- |
| Email registration/login | Implemented | scrypt, opaque hashed sessions, email verification required |
| Email verification / resend | Implemented | SMTP or dev echo |
| Google sign-in | Partial | API complete; no mobile UI/SDK |
| DOB + 13+ verification | Implemented | client + shared contract + server |
| Username onboarding / uniqueness | Implemented | unique index, 30-day change cooldown |
| Email account recovery | Implemented | reset token → admin web reset page |
| Google account recovery | Missing | — |
| Session management / revoke devices | Implemented | profile screen + API |
| Account export / deletion grace period | Implemented | cleanup completes deletion |

### Friends and discovery

| Feature | Status | Notes |
| --- | --- | --- |
| Send/receive/accept/reject/cancel requests | Implemented | notifications + UI |
| Private chat requires friendship | Implemented | enforced in conversation creation and reads |
| Search users | Implemented | username/display name, exclusions |
| Popular/random recommendations | Implemented | `/profile/discover`, excludes friends/blocks |
| Block/unblock | Implemented | cascades request/friendship removal |
| Block prevents messages/stories/replies/profiles | Implemented | checked in read paths |

### Messaging

| Feature | Status | Notes |
| --- | --- | --- |
| Realtime updates | Implemented | Ably; event IDs only, content via API |
| Text messages | Implemented | 4,000-char cap, pagination |
| Photo/video sharing | Implemented | image inline; video opens externally |
| Voice notes | Partial | server media type/expiry only; no record/play UI |
| Typing indicators | Implemented | Ably ephemeral, setting-aware |
| Delivery/read receipts | Implemented | per-recipient receipts |
| Edit within 15 min | Implemented | server-enforced |
| Delete for me / everyone | Implemented | hidden table / tombstone |
| User-selected expiry 1h/24h/7d | Implemented | Composer selector; API enforcement; default none |
| 10-min video/voice expiry | Implemented | server; attachments inherit expiry |
| Expired content excluded from reads | Implemented | queries filter `expires_at` |
| Message search | Implemented | per conversation, rate-limited |
| Reply threading | Implemented | visual “↪ Reply” only, no quote text |
| Screenshot protection/notification | Missing | — |

### Groups

| Feature | Status | Notes |
| --- | --- | --- |
| Create group, creator owner | Implemented | UI + API |
| Add members | Implemented | owner/admin |
| Promote/demote admins | Implemented | UI promotes; demote endpoint exists |
| Owner-only removal | Implemented | enforced |
| Transfer ownership | Implemented | API + UI |
| Invite expiry/revocation/max uses/approval | Implemented | UI for creation/share/revoke/review |
| Invite as clickable link | Implemented | `haikumessenger://join/<token>` deep link + Join Group screen; token paste fallback |
| Group photo / rename | Implemented | API; UI partial |
| Suspended group behavior | Implemented | hidden/blocked |

### Stories

| Feature | Status | Notes |
| --- | --- | --- |
| Publish image/video story | Implemented | 24h expiry |
| View stories / view counts | Implemented | friends-only |
| Reply to story | Implemented | notification to author |
| Delete own story | Implemented | attachment invalidated |
| No in-app saving | Implemented by absence | — |
| Story reply inbox UI | Missing | endpoint exists; not surfaced |

### Media and notifications

| Feature | Status | Notes |
| --- | --- | --- |
| Upload intents, signed/local uploads | Implemented | MIME + magic-byte validation |
| Authorized media access | Implemented | per-purpose authorization |
| Expired media cleanup | Implemented | cron job |
| Screenshot notification | Missing | — |
| In-app notifications | Implemented | inbox + read state |
| Push (FCM/APNs) | Missing | tables/env only |
| Quiet mode / previews / scheduling | Partial | preferences only |

### Administration

| Feature | Status | Notes |
| --- | --- | --- |
| Login + httpOnly server session | Implemented | same-origin/CSRF check |
| Role permissions in API | Implemented | owner/moderator/support/analyst |
| User search/detail | Implemented | audit-logged |
| Suspend/restore/delete user | Implemented | deletion redacts + revokes |
| Report queue + notes + status | Implemented | evidence viewer |
| Remove inappropriate messages | Implemented | audited tombstone removal; console actions in reports and message review |
| Group suspend/restore | Implemented | reason stored |
| Private content review | Partial | owner-only, read-only |
| Audit log | Implemented | 365-day retention |
| Grant/revoke admin roles | Implemented | owner-only, one active owner |
| Active data browsing (stories/messages) | Partial | counters + owner conversation review |

---

## 5. Verification log (run in this workspace)

```
npm ci                     → 991 packages installed, success
npm run typecheck          → contracts, API, admin, mobile: PASS
npm test                   → 12 tests, 12 pass, 0 fail
npm run build:admin        → Next.js production build: PASS
npm test -w haiku-mobile   → 2 suites, 4 tests: PASS
npm run lint -w haiku-mobile → PASS (0 errors, warnings only)
gh run list / gh run view  → latest master CI run 41172099279: both jobs SUCCESS
gh release list            → debug-latest prerelease with APK exists
```

Not runnable here: Android Gradle build (no JDK/SDK), iOS build (no macOS/Xcode), live database queries (no `DATABASE_URL`), Vercel deployment, Realtime/SMTP/Ably integration.

---

## 6. What this means for the assignment

1. **Do not rebuild or re-architect.** The monorepo, schema, auth, authorization, media pipeline, and admin model are coherent and worth preserving.
2. **Do not chase the reported build errors.** Both are obsolete: Hono replaced Express, and the Android hoisting paths are fixed and CI-green.
3. **Remaining product gaps** (native SDKs/credentials needed):
   - Voice notes (recording, playback, microphone permissions, expiry UX)
   - Push delivery (device tokens, FCM/APNs, quiet mode/preview semantics)
   - Google sign-in in the mobile app
   - Screenshot detection (platform-limited; Android `FLAG_SECURE` plus an iOS capture event)
4. **Remaining correctness/quality work:**
   - Add DB-backed integration tests for authorization boundaries, including message removal
   - Add an iOS CI job (or document that it is manual)
   - Remove unused `FCM_*` variables or implement them in the push phase
   - Verify the invitation deep link on physical Android and iOS devices
   - Add evidence retention tests and a moderation audit review
5. **Clean the repo:** delete `cala.zip`, the fixed-files zip, and `tsconfig.tsbuildinfo`; keep the root README and setup docs current.

The briefing and the repository describe the same product. The gap is **scope and maturity**, not identity: the repo is a solid, honest MVP with a green pipeline, while the briefing reads like the release checklist.
