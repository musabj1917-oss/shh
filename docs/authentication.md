# Authentication

## Requirements supported in Stage 1

- Email/password registration with minimum-age validation (13+)
- Google OAuth entry point with linkage controls
- Protected route checks for app session access
- Safe sign-out and account recovery hooks
- Basic audit structures for auth and admin-sensitive operations

## Clerk compatibility

Clerk's free Hobby plan supports public apps with up to 50,000 Monthly Retained Users and no credit card requirement. MFA and branded UI removal are not included in the free tier. This is acceptable for an MVP prototype, but production readiness should re-check limits before scaling and before enabling business features.

## Security recommendations

- Never accept user-entered Google passwords inside the app.
- Use provider linkage only when ownership is verified.
- Prevent duplicate identities across email and Google accounts.
- Reject duplicate provider records at the database level.
- Store access tokens outside the app and outside the DB if at all possible.
