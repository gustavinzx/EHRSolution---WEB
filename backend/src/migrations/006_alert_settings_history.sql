CREATE TABLE IF NOT EXISTS alert_settings_history (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) NOT NULL,
  old_value NUMERIC,
  new_value NUMERIC,
  changed_by VARCHAR(255),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
