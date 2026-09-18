ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS hotel_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_in_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_notes text NOT NULL DEFAULT '';
