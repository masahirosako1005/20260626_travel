CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  nickname TEXT,
  user_segment TEXT,
  created_at TEXT,
  analytics_consent INTEGER DEFAULT 1,
  nickname_display_consent INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS spots (
  spot_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  area TEXT NOT NULL,
  avg_minutes INTEGER DEFAULT 30,
  description TEXT,
  image_path TEXT
);

CREATE TABLE IF NOT EXISTS rallies (
  rally_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  season_tag TEXT
);

CREATE TABLE IF NOT EXISTS rally_spots (
  rally_id TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  PRIMARY KEY (rally_id, spot_id),
  FOREIGN KEY (rally_id) REFERENCES rallies(rally_id),
  FOREIGN KEY (spot_id) REFERENCES spots(spot_id)
);

CREATE TABLE IF NOT EXISTS benefits (
  benefit_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  spot_id TEXT,
  estimated_value_yen INTEGER DEFAULT 0,
  valid_from TEXT,
  valid_to TEXT,
  FOREIGN KEY (spot_id) REFERENCES spots(spot_id)
);

CREATE TABLE IF NOT EXISTS visits (
  visit_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  visited_at TEXT NOT NULL,
  route_order INTEGER,
  stay_minutes INTEGER DEFAULT 0,
  pass_minutes INTEGER DEFAULT 0,
  event_type TEXT CHECK(event_type IN ('stay','pass')),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (spot_id) REFERENCES spots(spot_id)
);

CREATE TABLE IF NOT EXISTS stamps (
  stamp_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  rally_id TEXT,
  acquired_at TEXT NOT NULL,
  method TEXT DEFAULT 'mock_button',
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (spot_id) REFERENCES spots(spot_id),
  FOREIGN KEY (rally_id) REFERENCES rallies(rally_id)
);

CREATE TABLE IF NOT EXISTS benefit_uses (
  benefit_use_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  benefit_id TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  used_at TEXT NOT NULL,
  estimated_value_yen INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (benefit_id) REFERENCES benefits(benefit_id),
  FOREIGN KEY (spot_id) REFERENCES spots(spot_id)
);

CREATE TABLE IF NOT EXISTS route_usages (
  route_usage_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
  recommendation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  route_type TEXT NOT NULL,
  score REAL NOT NULL,
  reason TEXT,
  generated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
