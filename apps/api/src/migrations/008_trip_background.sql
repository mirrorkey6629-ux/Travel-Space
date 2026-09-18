ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS background_removed boolean NOT NULL DEFAULT false;
