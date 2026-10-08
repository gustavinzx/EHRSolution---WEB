ALTER TABLE fleet_alerts DROP CONSTRAINT IF EXISTS fleet_alerts_fueling_log_id_fkey;
ALTER TABLE fleet_alerts ADD CONSTRAINT fleet_alerts_fueling_log_id_fkey
  FOREIGN KEY (fueling_log_id) REFERENCES fueling_logs(id) ON DELETE SET NULL;
