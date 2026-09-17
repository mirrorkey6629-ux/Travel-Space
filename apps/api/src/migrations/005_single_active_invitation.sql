CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_one_active_per_trip
  ON invitations(trip_id)
  WHERE revoked_at IS NULL;
