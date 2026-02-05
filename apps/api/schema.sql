-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- Auth codes (one-time)
CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email);
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_codes(expires_at);

-- Sessions (test runs)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  device_fingerprint TEXT,
  metrics_json TEXT,
  score_json TEXT,
  readiness TEXT,
  integrity REAL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions(user_id, started_at);

-- Baseline stats per metric
CREATE TABLE IF NOT EXISTS baseline_stats (
  user_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  mean REAL NOT NULL,
  std REAL NOT NULL,
  n INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, metric),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Roles (v1: optional; we keep a single default threshold set)
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  thresholds_json TEXT NOT NULL,
  actions_json TEXT NOT NULL
);
