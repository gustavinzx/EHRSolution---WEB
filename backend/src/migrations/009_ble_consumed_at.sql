-- Migration 009
ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS ble_consumed_at TIMESTAMPTZ;
