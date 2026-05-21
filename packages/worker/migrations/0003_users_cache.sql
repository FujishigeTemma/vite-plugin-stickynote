CREATE TABLE users (
  sub        TEXT PRIMARY KEY,
  full_name  TEXT NOT NULL,
  cached_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
