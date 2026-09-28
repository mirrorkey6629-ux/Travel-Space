CREATE TABLE IF NOT EXISTS trip_change_events (
  id bigserial PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id),
  entity_type text NOT NULL CHECK (entity_type IN ('trip', 'city')),
  entity_id uuid,
  sections text[] NOT NULL DEFAULT '{}',
  city_name text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_trip_change_events_latest
  ON trip_change_events(trip_id, id DESC);
