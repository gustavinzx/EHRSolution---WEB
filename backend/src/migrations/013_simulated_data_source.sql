-- 013_simulated_data_source.sql
-- Adiciona 'simulated' aos valores permitidos de data_source em fueling_logs e fueling_sessions

ALTER TABLE fueling_logs DROP CONSTRAINT IF EXISTS fueling_logs_data_source_check;
ALTER TABLE fueling_logs ADD CONSTRAINT fueling_logs_data_source_check 
  CHECK (data_source IS NULL OR data_source IN ('hardware','manager','unverified','legacy','simulated'));

ALTER TABLE fueling_sessions DROP CONSTRAINT IF EXISTS fueling_sessions_data_source_check;
ALTER TABLE fueling_sessions ADD CONSTRAINT fueling_sessions_data_source_check 
  CHECK (data_source IS NULL OR data_source IN ('hardware','manager','unverified','legacy','simulated'));
