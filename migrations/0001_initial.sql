PRAGMA foreign_keys = ON;

CREATE TABLE user (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX user_email_unique ON user (email);

CREATE TABLE session (
  id TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX session_token_unique ON session (token);
CREATE INDEX session_user_id_idx ON session (user_id);

CREATE TABLE account (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX account_user_id_idx ON account (user_id);
CREATE UNIQUE INDEX account_provider_account_unique ON account (provider_id, account_id);

CREATE TABLE verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX verification_identifier_idx ON verification (identifier);

CREATE TABLE albums (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  slug TEXT NOT NULL CHECK (
    length(slug) BETWEEN 3 AND 40
    AND slug NOT GLOB '*[^a-z0-9-]*'
  ),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  message TEXT NOT NULL DEFAULT '' CHECK (length(message) <= 400),
  event_date TEXT CHECK (event_date IS NULL OR length(event_date) = 10),
  passphrase_salt TEXT NOT NULL,
  passphrase_hash TEXT NOT NULL,
  access_version INTEGER NOT NULL DEFAULT 1 CHECK (access_version >= 1),
  expected_viewers INTEGER NOT NULL DEFAULT 1 CHECK (expected_viewers BETWEEN 1 AND 500),
  allow_downloads INTEGER NOT NULL DEFAULT 1 CHECK (allow_downloads IN (0, 1)),
  allow_contributions INTEGER NOT NULL DEFAULT 0 CHECK (allow_contributions IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX albums_slug_unique ON albums (slug);
CREATE INDEX albums_owner_created_idx ON albums (owner_user_id, created_at);
CREATE INDEX albums_expires_idx ON albums (expires_at);

CREATE TABLE photos (
  id TEXT PRIMARY KEY NOT NULL,
  album_id TEXT NOT NULL REFERENCES albums (id) ON DELETE CASCADE,
  original_key TEXT NOT NULL,
  thumbnail_key TEXT NOT NULL,
  filename TEXT NOT NULL CHECK (length(filename) BETWEEN 1 AND 180),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 20971520),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 100000),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 100000),
  uploaded_by TEXT NOT NULL CHECK (uploaded_by IN ('owner', 'guest')),
  created_at INTEGER NOT NULL
);
CREATE INDEX photos_album_created_idx ON photos (album_id, created_at);
CREATE UNIQUE INDEX photos_original_key_unique ON photos (original_key);
CREATE UNIQUE INDEX photos_thumbnail_key_unique ON photos (thumbnail_key);

CREATE TABLE album_visitors (
  id TEXT PRIMARY KEY NOT NULL,
  album_id TEXT NOT NULL REFERENCES albums (id) ON DELETE CASCADE,
  viewer_hash TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  first_viewed_at INTEGER,
  first_downloaded_at INTEGER
);
CREATE UNIQUE INDEX album_visitors_album_viewer_unique
  ON album_visitors (album_id, viewer_hash);
CREATE INDEX album_visitors_album_idx ON album_visitors (album_id);
