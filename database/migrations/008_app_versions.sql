BEGIN;

CREATE TABLE IF NOT EXISTS app_versions (
  platform text CHECK (platform IN ('android', 'ios')),
  latest_version text NOT NULL,
  min_supported_version text NOT NULL,
  download_url text NOT NULL,
  release_notes text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform)
);

INSERT INTO app_versions (platform, latest_version, min_supported_version, download_url, release_notes)
VALUES
  ('android', '0.1.0', '0.1.0', 'https://haikumessenger.vercel.app/download/android', 'Initial release'),
  ('ios', '0.1.0', '0.1.0', 'https://haikumessenger.vercel.app/download/ios', 'Initial release')
ON CONFLICT (platform) DO NOTHING;

COMMIT;
