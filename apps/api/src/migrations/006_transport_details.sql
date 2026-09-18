ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS transport_in_type text CHECK (transport_in_type IN ('train', 'plane', 'bus', 'ship')),
  ADD COLUMN IF NOT EXISTS transport_out_type text CHECK (transport_out_type IN ('train', 'plane', 'bus', 'ship')),
  ADD COLUMN IF NOT EXISTS transport_in_departure_time text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_in_arrival_time text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_departure_time text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_arrival_time text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_in_station text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_in_station_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_station text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_station_url text NOT NULL DEFAULT '';
