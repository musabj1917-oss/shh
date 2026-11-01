-- Android APK releases uploaded from the admin console and downloaded from the website.
CREATE TABLE IF NOT EXISTS app_releases (
  id uuid PRIMARY KEY,
  platform text NOT NULL DEFAULT 'android',
  version text NOT NULL,
  file_name text NOT NULL,
  object_key text NOT NULL UNIQUE,
  byte_size bigint NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/vnd.android.package-archive',
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
  is_active boolean NOT NULL DEFAULT false,
  download_count integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);
CREATE INDEX IF NOT EXISTS app_releases_active_idx ON app_releases (platform, is_active) WHERE is_active;
