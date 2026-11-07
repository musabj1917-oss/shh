# Admin API: App Version Control

The Haiku Messenger app version management endpoints allow administrators to publish version metadata, release notes, and enforce minimum supported versions for mobile clients.

## Endpoints

### 1. View App Versions (Admin Only)
```bash
curl -X GET "https://haikumessenger.vercel.app/v1/admin/app-versions" \
  -H "Authorization: Bearer <ADMIN_SESSION_TOKEN>"
```

**Response:**
```json
{
  "versions": [
    {
      "platform": "android",
      "latest_version": "0.1.0",
      "min_supported_version": "0.1.0",
      "download_url": "https://haikumessenger.vercel.app/download/android",
      "release_notes": "Initial release",
      "updated_by": "00000000-0000-0000-0000-000000000000",
      "updated_at": "2026-11-07T12:00:00.000Z"
    }
  ]
}
```

### 2. Update / Publish New Version (Admin Only)
```bash
curl -X PUT "https://haikumessenger.vercel.app/v1/admin/app-versions" \
  -H "Authorization: Bearer <ADMIN_SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "android",
    "latestVersion": "0.10.0",
    "minSupportedVersion": "0.9.0",
    "downloadUrl": "https://haikumessenger.vercel.app/releases/android/haiku-0.10.0.apk",
    "releaseNotes": "• Message flicker fix with persistent media cache\n• Camera-first tabs and stories row\n• First-launch permissions onboarding"
  }'
```

**Validation Rules:**
- `platform`: `'android'` | `'ios'`
- `latestVersion`: valid semver (e.g. `0.10.0`)
- `minSupportedVersion`: valid semver (e.g. `0.9.0`). When a client's installed version is less than `minSupportedVersion`, the mobile client displays a non-dismissible, full-screen blocking modal enforcing the update.
- `downloadUrl`: HTTPS URL
- `releaseNotes`: Max 1000 characters

### 3. Client Version Check (Public, Rate Limited)
```bash
curl -X GET "https://haikumessenger.vercel.app/app/version?platform=android&version=0.9.0"
```

**Response:**
```json
{
  "updateAvailable": true,
  "forceUpdate": false,
  "latestVersion": "0.10.0",
  "minSupportedVersion": "0.9.0",
  "downloadUrl": "https://haikumessenger.vercel.app/releases/android/haiku-0.10.0.apk",
  "releaseNotes": "• Message flicker fix with persistent media cache..."
}
```
