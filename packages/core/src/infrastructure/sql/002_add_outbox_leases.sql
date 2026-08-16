ALTER TABLE atlas_outbox_events
  ADD COLUMN IF NOT EXISTS lease_owner TEXT NULL,
  ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_atlas_outbox_events_claimable
  ON atlas_outbox_events (created_at, id)
  WHERE published_at IS NULL;