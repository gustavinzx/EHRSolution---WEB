CREATE TABLE IF NOT EXISTS facial_attempts (
    id SERIAL PRIMARY KEY
); -- Just a dummy to avoid syntax errors if needed? No, wait. 

ALTER TABLE fueling_sessions
ADD COLUMN IF NOT EXISTS ble_consumed_at TIMESTAMPTZ;
