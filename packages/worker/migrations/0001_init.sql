CREATE TABLE threads (
  id              TEXT PRIMARY KEY,
  route           TEXT NOT NULL,
  url             TEXT NOT NULL,
  commit_hash     TEXT NOT NULL,
  dirty_build     INTEGER NOT NULL DEFAULT 0,
  x_ratio         REAL NOT NULL,
  y_ratio         REAL NOT NULL,
  viewport_w      INTEGER NOT NULL,
  viewport_h      INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',
  created_by      TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_threads_route ON threads(route);
CREATE INDEX idx_threads_status ON threads(status);

CREATE TABLE components (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL,
  path          TEXT NOT NULL,
  line          INTEGER NOT NULL,
  v_for_index   INTEGER NOT NULL,
  name          TEXT NOT NULL,
  UNIQUE (thread_id, display_order)
);

CREATE INDEX idx_components_thread ON components(thread_id, display_order);

CREATE TABLE comments (
  id              TEXT PRIMARY KEY,
  thread_id       TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at      TEXT
);

CREATE INDEX idx_comments_thread ON comments(thread_id, created_at);
