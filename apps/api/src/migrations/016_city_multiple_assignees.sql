ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS ticket_assignee_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hotel_assignee_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS plan_assignee_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE cities SET
  ticket_assignee_ids = CASE WHEN ticket_assignee_id IS NULL THEN '{}' ELSE ARRAY[ticket_assignee_id] END,
  hotel_assignee_ids = CASE WHEN hotel_assignee_id IS NULL THEN '{}' ELSE ARRAY[hotel_assignee_id] END,
  plan_assignee_ids = CASE WHEN plan_assignee_id IS NULL THEN '{}' ELSE ARRAY[plan_assignee_id] END;

DROP INDEX IF EXISTS idx_cities_ticket_assignee;
DROP INDEX IF EXISTS idx_cities_hotel_assignee;
DROP INDEX IF EXISTS idx_cities_plan_assignee;

ALTER TABLE cities
  DROP COLUMN IF EXISTS ticket_assignee_id,
  DROP COLUMN IF EXISTS hotel_assignee_id,
  DROP COLUMN IF EXISTS plan_assignee_id;
