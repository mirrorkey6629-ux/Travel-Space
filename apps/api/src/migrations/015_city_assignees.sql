ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS ticket_assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hotel_assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_assignee_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cities_ticket_assignee ON cities(ticket_assignee_id);
CREATE INDEX IF NOT EXISTS idx_cities_hotel_assignee ON cities(hotel_assignee_id);
CREATE INDEX IF NOT EXISTS idx_cities_plan_assignee ON cities(plan_assignee_id);
