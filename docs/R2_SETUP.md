# Cloudflare R2 Media Storage Setup

This guide documents configuring Cloudflare R2 object storage for **Haiku Messenger** (e.g., using the `black bricks r2` bucket).

---

## 1. Create the R2 Bucket

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **R2**.
2. Click **Create bucket**.
3. Set the bucket name (for example, `black-bricks-r2` or `haiku-media`).
4. Location: choose **Automatic** (or closest region).
5. Click **Create bucket**.

---

## 2. Generate R2 API Token

1. Under **R2** > **Manage R2 API Tokens**, click **Create API token**.
2. Permissions: select **Object Read & Write**.
3. Specify bucket: select your bucket (e.g., `black-bricks-r2`).
4. TTL: Choose permanent or your team's rotation policy.
5. Click **Create API Token**.
6. Copy the **Access Key ID** and **Secret Access Key** securely.

---

## 3. Host Environment Variables

Set the following environment variables on your backend hosting provider (e.g. Vercel, Railway, Render, or VPS):

```bash
MEDIA_STORAGE=neon-s3
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_BUCKET=black-bricks-r2
S3_REGION=auto
S3_ACCESS_KEY_ID=<YOUR_R2_ACCESS_KEY_ID>
S3_SECRET_ACCESS_KEY=<YOUR_R2_SECRET_ACCESS_KEY>
```

> **Note:** `AWS_ENDPOINT_URL_S3`, `MEDIA_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` are also supported as fallbacks.

---

## 4. Bucket CORS Configuration (for Web Uploads)

In the Cloudflare Dashboard under **R2** > your bucket > **Settings** > **CORS Policy**, add the following JSON policy so web clients (and mobile web) can upload directly via signed PUT URLs:

```json
[
  {
    "AllowedOrigins": [
      "https://haikumessenger.vercel.app",
      "http://localhost:3000",
      "http://localhost:8081"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "Content-Type"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

*(Ensure `AllowedOrigins` includes all domains in your `CORS_ORIGINS` / `ALLOWED_ORIGINS` setting.)*

---

## 5. R2 Lifecycle Rules

To prevent stale partial uploads and temporary files from accumulating in free-tier storage:

1. In your bucket settings, go to **Lifecycle Rules** > **Add rule**.
2. **Rule 1: Incomplete Multipart Uploads**:
   - Action: Abort incomplete multipart uploads.
   - Age: 1 day (7 days if 1 day is not permitted by UI).
3. **Rule 2: Uncompleted Staging Uploads**:
   - Prefix: `u/`
   - Action: Delete objects.
   - Age: 1 day.

---

## 6. Verification: Storage Health Check

Verify storage connectivity using the admin-only storage health check:

```bash
curl -X GET https://api.haikumessenger.com/v1/admin/health/storage \
  -H "Authorization: Bearer <ADMIN_SESSION_TOKEN>"
```

Or hit `/health/storage`:

```bash
curl -X GET https://api.haikumessenger.com/health/storage \
  -H "Authorization: Bearer <ADMIN_SESSION_TOKEN>"
```

Expected response (`200 OK`):
```json
{
  "status": "ok",
  "storage": {
    "ok": true,
    "mode": "neon-s3",
    "bucket": "black-bricks-r2",
    "latencyMs": 84
  }
}
```

This endpoint executes a tiny put/head/delete probe to guarantee full write, read, and delete permissions without leaking secrets in logs or responses.
