ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS transport_in_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_name text NOT NULL DEFAULT '';
