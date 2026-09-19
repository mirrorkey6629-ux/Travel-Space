CREATE TABLE IF NOT EXISTS trip_view_links (
  trip_id uuid PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

