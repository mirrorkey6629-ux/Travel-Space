ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS transport_in_departure_date text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_in_arrival_date text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_in_departure_time_zone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_in_arrival_time_zone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_departure_date text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_arrival_date text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_departure_time_zone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_arrival_time_zone text NOT NULL DEFAULT '';
