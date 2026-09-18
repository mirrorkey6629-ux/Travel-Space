ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS hotel_check_in_time text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hotel_check_out_time text NOT NULL DEFAULT '';
