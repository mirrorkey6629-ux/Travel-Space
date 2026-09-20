ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS hotel_payer_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hotel_total_amount_rubles integer NOT NULL DEFAULT 0 CHECK (hotel_total_amount_rubles >= 0);
