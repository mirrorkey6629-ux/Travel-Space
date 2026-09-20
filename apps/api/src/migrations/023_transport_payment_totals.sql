ALTER TABLE cities
  RENAME COLUMN transport_in_amount_per_person_rubles TO transport_in_total_amount_rubles;

ALTER TABLE cities
  RENAME COLUMN transport_out_amount_per_person_rubles TO transport_out_total_amount_rubles;
