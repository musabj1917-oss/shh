# Haiku Messenger (SHH) — Developer Handover & System Status

**Date:** November 1, 2026  
**Repository:** [musabj1917-oss/shh](https://github.com/musabj1917-oss/shh)  
**Branch:** `master` (up to date with `origin/master`)

---

## 1. Executive Summary & Live Services

| Service | Live URL | Deployment Project | Status |
|---|---|---|---|
| **Web Client** | [web-gray-psi-ofbju794yf.vercel.app](https://web-gray-psi-ofbju794yf.vercel.app) | `apps/web` | **Active & Verified** (Stitch UI, Favicon & SVG Logo working) |
| **Admin Dashboard** | [admin-theta-six-75.vercel.app](https://admin-theta-six-75.vercel.app) | `apps/admin` | **Active & Configured** (`HAIKU_API_URL` envvar wired) |
| **API Backend** | [shh-jet-five.vercel.app](https://shh-jet-five.vercel.app) | `apps/api` (`prj_aiSZeEP0iFNQPOOzSZ01OZrit2nB`) | Deployed (Promoted; see Section 5 for runtime note) |
| **Mobile App** | `apps/mobile` | React Native (Expo) | Firebase client configured |

---

## 2. Infrastructure & Connected Cloud Providers

### A. Neon Lakebase Postgres & Object Storage
- **Neon Project:** `haiku-messenger` (`raspy-sky-76566996`)
- **Active Branch:** `main` (`br-long-cherry-b7a8fgwg`)
- **Neon Object Storage (Messaging Media):**
  - **Bucket:** `haiku-private` (Private, strictly for messaging attachments, voice notes, photos)
  - **S3 Endpoint:** `https://br-long-cherry-b7a8fgwg.storage.c-13.us-east-1.aws.neon.tech`
  - **Region:** `us-east-1`
  - **Access Key ID:** `nak_live_e3912dd58b1343d2918073f974250612`
  - **Secret Key:** `nsk_live_c33a1e8ab9f3dd345b98f10db0cde65aca47d82ec90849201acfac7b68e11ac3`
  - *Status:* Verified with Put, Presigned Get, and Delete tests in `@aws-sdk/client-s3`.

### B. Vercel Blob Storage (APK Distribution Only)
- Dedicated exclusively to Android APK updates and downloadable releases.
- Managed via `apps/api/src/services/vercel-blob.ts` with fallback to local/GitHub releases when `BLOB_READ_WRITE_TOKEN` is pending token issuance.

### C. Firebase Authentication
- **Project ID:** `haiku-f758f`
- **Web API Key:** `AIzaSyBkXKSIaIF-5zVBBLMBQYJhq_6dZeq5_gU`
- **Auth Domain:** `haiku-f758f.firebaseapp.com`
- **Storage Bucket:** `haiku-f758f.firebasestorage.app`
- **App ID:** `1:279052480304:web:0087ad4e0e3aefffaae2f5`
- **Messaging Sender ID:** `279052480304`
- *Wired Locations:*
  - Backend API: `GET /v1/auth/firebase/config` and `apps/api/src/services/firebase.ts`
  - Web Client: Injected into `window.FIREBASE_CONFIG` in `apps/web/index.html`
  - Mobile App: Configured in `apps/mobile/src/firebase.config.ts`

---

## 3. Work Completed in This Session

### 1. Web Client Favicon & Logo Resolution
- **Issue:** In the web version, `/favicon.svg` and `/logo.svg` were returning 404 or raw HTML instead of images. In contrast, the admin panel rendered icons properly.
- **Root Cause:** In `apps/web/vercel.json`, a catch-all rewrite rule `{ "source": "/(.*)", "destination": "/index.html" }` lacked a negative lookahead, causing Vercel to intercept static asset requests and return `index.html` with MIME type `text/html`.
- **Fix Applied:**
  - Updated `apps/web/vercel.json` with regex exclusion:
    ```json
    { "source": "/((?!.*\\.(?:ico|png|svg|jpg|jpeg|gif|webp|apk|css|js|json|webmanifest|map)).*)", "destination": "/index.html" }
    ```
  - Populated `apps/web/public/` with `favicon.ico`, `favicon.svg`, `logo.svg`, and `logo.png`.
  - Tested live: `curl -I "https://web-gray-psi-ofbju794yf.vercel.app/logo.svg"` returns HTTP 200 with `Content-Type: image/svg+xml`.

### 2. Admin Environment Variables on Vercel
- **Issue:** The admin project on Vercel was missing backend connection variables.
- **Fix Applied:** Added the following environment variables via Composio Vercel API for `team_5fawPWey79FBQo49BpmMlZYr`:
  - On project `admin` (`prj_2A9CSQaFP8RmXmUVr3f8Cni4TtCV`):
    - `HAIKU_API_URL` = `https://shh-jet-five.vercel.app/v1` (for `production`, `preview`, `development`)
  - On project `shh` (`prj_aiSZeEP0iFNQPOOzSZ01OZrit2nB`):
    - `ADMIN_WEB_URL` = `https://admin-theta-six-75.vercel.app`
    - `ALLOWED_ORIGINS` = `https://admin-theta-six-75.vercel.app,https://web-gray-psi-ofbju794yf.vercel.app,https://shh-jet-five.vercel.app,http://localhost:3000,http://localhost:3002,http://localhost:8081`

### 3. API Self-Contained Bundling & Contract Isolation
- **Issue:** In the monorepo, `apps/api/src/contracts.ts` was importing from `../../../packages/contracts/src/index.js`. When deployed inside Vercel's serverless sandbox (`/var/task`), attempting to traverse up three parent directories causes Node to escape the task root and throw `ERR_MODULE_NOT_FOUND`.
- **Fix Applied:**
  - Embedded shared contracts and Zod schemas directly into `apps/api/src/contracts.ts`.
  - Moved `nodemailer` and `@hono/node-server` from `devDependencies` into `dependencies` to avoid missing runtime packages in production.
  - Configured `esbuild` build step in `apps/api/package.json`:
    ```json
    "build": "esbuild src/index.ts --bundle --platform=node --format=esm --target=node22 --outfile=index.js"
    ```
  - Built universal entrypoint supporting both Node.js `(req, res)` via `@hono/node-server` and WHATWG `Request` / Hono `fetch`.
  - Tested compiled `index.js` locally with native Node.js — boots all 151 routes and responds to `/v1/health` with HTTP 200 in 20ms.

---

## 4. Key Configuration Files

- [`apps/web/vercel.json`](file:///data/data/com.termux/files/home/shh/apps/web/vercel.json): Static rewrite rules protecting image extensions.
- [`apps/api/package.json`](file:///data/data/com.termux/files/home/shh/apps/api/package.json): Standalone dependencies, `esbuild` script, and main entrypoint.
- [`apps/api/src/index.ts`](file:///data/data/com.termux/files/home/shh/apps/api/src/index.ts): TypeScript universal entrypoint.
- [`apps/api/index.js`](file:///data/data/com.termux/files/home/shh/apps/api/index.js): Self-contained compiled bundle for Vercel deployment.
- [`apps/api/src/contracts.ts`](file:///data/data/com.termux/files/home/shh/apps/api/src/contracts.ts): Self-contained Zod schemas and user-friendly error mapper.
- [`apps/api/src/services/storage.ts`](file:///data/data/com.termux/files/home/shh/apps/api/src/services/storage.ts): Neon S3 adapter implementation.
- [`apps/api/src/services/vercel-blob.ts`](file:///data/data/com.termux/files/home/shh/apps/api/src/services/vercel-blob.ts): APK distribution storage service.

---

## 5. Next Steps for Next Session

1. **Vercel API Invocation Diagnostic (`shh-jet-five.vercel.app`)**:
   - The deployment is promoted and marked `READY`, but requests return `FUNCTION_INVOCATION_FAILED`.
   - In the Vercel dashboard for project `shh` (`https://vercel.com/musab12/shh`):
     - Check the **Functions / Runtime Logs** tab for the latest incoming request ID to view the exact Node runtime stack trace.
     - Review the **Framework Preset** in Project Settings. If it is currently set to `Hono`, try changing it to `Other` or `Node.js` so Vercel treats `index.js` as a direct serverless function rather than running the Hono framework builder.
2. **End-to-End Auth Testing**:
   - Test sign-up and sign-in flow on the web client (`https://web-gray-psi-ofbju794yf.vercel.app`) connecting to Firebase and the Neon backend.
3. **Admin APK Upload**:
   - Test uploading an Android `.apk` via the Admin panel (`https://admin-theta-six-75.vercel.app`) and downloading it from the Web landing page.
