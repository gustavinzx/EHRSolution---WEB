-- Migration 015: Casamento de Sessões e Logs de Abastecimento com Catálogo ANP

ALTER TABLE fueling_sessions
  ADD COLUMN IF NOT EXISTS anp_station_id INTEGER REFERENCES anp_stations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS station_match_status VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS station_match_distance_m NUMERIC(8,1) NULL,
  ADD COLUMN IF NOT EXISTS station_match_source VARCHAR(20) NULL;

ALTER TABLE fueling_sessions
  DROP CONSTRAINT IF EXISTS fueling_sessions_station_match_status_check;
ALTER TABLE fueling_sessions
  ADD CONSTRAINT fueling_sessions_station_match_status_check
  CHECK (station_match_status IS NULL OR station_match_status IN ('matched','unrecognized','no_position'));

ALTER TABLE fueling_sessions
  DROP CONSTRAINT IF EXISTS fueling_sessions_station_match_source_check;
ALTER TABLE fueling_sessions
  ADD CONSTRAINT fueling_sessions_station_match_source_check
  CHECK (station_match_source IS NULL OR station_match_source IN ('truck_telemetry','app_gps'));

ALTER TABLE fueling_logs
  ADD COLUMN IF NOT EXISTS anp_station_id INTEGER REFERENCES anp_stations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS station_match_status VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS station_match_distance_m NUMERIC(8,1) NULL,
  ADD COLUMN IF NOT EXISTS station_match_source VARCHAR(20) NULL;

ALTER TABLE fueling_logs
  DROP CONSTRAINT IF EXISTS fueling_logs_station_match_status_check;
ALTER TABLE fueling_logs
  ADD CONSTRAINT fueling_logs_station_match_status_check
  CHECK (station_match_status IS NULL OR station_match_status IN ('matched','unrecognized','no_position'));

ALTER TABLE fueling_logs
  DROP CONSTRAINT IF EXISTS fueling_logs_station_match_source_check;
ALTER TABLE fueling_logs
  ADD CONSTRAINT fueling_logs_station_match_source_check
  CHECK (station_match_source IS NULL OR station_match_source IN ('truck_telemetry','app_gps'));

CREATE INDEX IF NOT EXISTS idx_fueling_logs_anp_station_id ON fueling_logs(anp_station_id);
