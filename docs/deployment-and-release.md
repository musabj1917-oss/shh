# Deployment & Release Readiness Guide ($0 Budget)

## Workspace Architecture
- `apps/api`: Express TypeScript server compatible with Vercel Serverless Functions.
- `apps/mobile`: React Native bare workflow app.

## $0 Budget & Service Quota Matrix
1. **Neon PostgreSQL**:
   - Storage Limit: 1GB free storage.
   - Mitigation: 10-minute media auto-expiry and 5MB/15MB/10MB upload caps prevent database storage exhaustion.
2. **Vercel Web API**:
   - Free Hobby Plan for API serverless execution and static Web Admin Dashboard hosting (`/admin`).
3. **WebRTC Voice Signaling**:
   - Direct peer-to-peer WebRTC signaling utilizing Google's free STUN server (`stun:stun.l.google.com:19302`).
   - TURN relay servers require paid bandwidth and remain disabled under $0 budget.

## Public Release Checklist & Gatekeepers
- Developer Accounts: Google Play Console ($25 one-time fee) and Apple Developer Program ($99/year) require paid registration for public store listings. Under strict $0 budget, private tester builds (.apk / TestFlight) serve as local/tester release paths.
