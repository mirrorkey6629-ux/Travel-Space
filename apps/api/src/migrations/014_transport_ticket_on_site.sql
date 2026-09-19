ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS transport_in_ticket_on_site boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transport_out_ticket_on_site boolean NOT NULL DEFAULT false;
