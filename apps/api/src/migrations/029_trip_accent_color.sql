ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#4D4FAB';

ALTER TABLE trips
  DROP CONSTRAINT IF EXISTS trips_accent_color_format;

ALTER TABLE trips
  ADD CONSTRAINT trips_accent_color_format CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$');
