ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS transport_in_departure_station text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_in_departure_station_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_in_arrival_station text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_in_arrival_station_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_departure_station text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_departure_station_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_arrival_station text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_out_arrival_station_url text NOT NULL DEFAULT '';

UPDATE cities SET
  transport_in_arrival_station = transport_in_station,
  transport_in_arrival_station_url = transport_in_station_url,
  transport_out_departure_station = transport_out_station,
  transport_out_departure_station_url = transport_out_station_url
WHERE transport_in_station <> '' OR transport_in_station_url <> '' OR transport_out_station <> '' OR transport_out_station_url <> '';
