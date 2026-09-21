ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS google_maps_url text NOT NULL DEFAULT '';
