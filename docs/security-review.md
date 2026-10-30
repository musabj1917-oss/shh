# Security & Authorization Review

## Audit Matrix
1. **Authentication & Session Tokens**:
   - JWT tokens signed with `JWT_SECRET` and validated on protected API endpoints.
   - Decoy mode authentication strictly isolated to local email/password login (never accepted on Google OAuth).
2. **Owner Admin Access**:
   - Enforced by server-side `requireAdmin` middleware checking `is_admin = TRUE` in PostgreSQL. UI hiding alone is never relied upon.
3. **Friend-Gated Messaging**:
   - Server-side authorization check (`areFriends`) prevents non-friends from sending private messages even if API calls are forged.
4. **Input & Upload Validation**:
   - Zod schema validation for request bodies.
   - Media file magic number byte signature verification (JPEG `FF D8`, PNG `89 50`).
