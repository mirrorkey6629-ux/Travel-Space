CREATE TABLE IF NOT EXISTS trip_day_notes (
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_date date NOT NULL,
  description text NOT NULL DEFAULT '',
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, day_date)
);

CREATE INDEX IF NOT EXISTS idx_trip_day_notes_trip_date ON trip_day_notes(trip_id, day_date);
