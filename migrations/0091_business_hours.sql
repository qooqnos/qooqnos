CREATE TABLE business_hours (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  opens TEXT NOT NULL,
  closes TEXT NOT NULL,
  timezone TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','inactive','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(opens) = 5 AND substr(opens,3,1) = ':'),
  CHECK (length(closes) = 5 AND substr(closes,3,1) = ':')
);

CREATE INDEX idx_business_hours_business_day ON business_hours(business_id, day_of_week, status);
CREATE INDEX idx_business_hours_location_day ON business_hours(location_id, day_of_week, status);
