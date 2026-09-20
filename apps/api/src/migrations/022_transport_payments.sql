ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS transport_in_payment_member_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transport_out_payment_member_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transport_in_amount_per_person_rubles integer NOT NULL DEFAULT 0 CHECK (transport_in_amount_per_person_rubles >= 0),
  ADD COLUMN IF NOT EXISTS transport_out_amount_per_person_rubles integer NOT NULL DEFAULT 0 CHECK (transport_out_amount_per_person_rubles >= 0);
