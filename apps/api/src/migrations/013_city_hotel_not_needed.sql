ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS hotel_not_needed boolean NOT NULL DEFAULT false;
