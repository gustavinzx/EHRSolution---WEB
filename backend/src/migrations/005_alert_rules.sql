CREATE TABLE IF NOT EXISTS alert_settings (
  key VARCHAR PRIMARY KEY,
  value_num NUMERIC NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255)
);

INSERT INTO alert_settings (key, value_num, description) VALUES
('divergence_pct', 5, 'Divergência aceitável (%) entre bomba e tanque'),
('divergence_critical_pct', 15, 'Divergência crítica (%) entre bomba e tanque'),
('consumption_deviation_pct', 30, 'Desvio aceitável (%) do consumo médio do caminhão'),
('offhours_start_hour', 22, 'Hora inicial do período restrito (0-23)'),
('offhours_end_hour', 5, 'Hora final do período restrito (0-23)'),
('offhours_enabled', 1, '1 = Habilitado, 0 = Desabilitado')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE fleet_alerts ADD COLUMN IF NOT EXISTS fueling_log_id INTEGER REFERENCES fueling_logs(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_alerts_type_log_id 
ON fleet_alerts(type, fueling_log_id) 
WHERE fueling_log_id IS NOT NULL;
