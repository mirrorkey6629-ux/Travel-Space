ALTER TABLE cities
  RENAME COLUMN transport_in_payment_member_ids TO transport_in_payer_ids;

ALTER TABLE cities
  RENAME COLUMN transport_out_payment_member_ids TO transport_out_payer_ids;
