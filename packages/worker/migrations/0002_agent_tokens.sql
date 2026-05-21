CREATE TABLE agent_tokens (
  owner_sub    TEXT PRIMARY KEY,
  owner_name   TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_used_at TEXT
);
