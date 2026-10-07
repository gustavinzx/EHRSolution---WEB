-- 003_web_hardening.sql

-- Tarefa 3: Volume confiável
ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS pump_liters NUMERIC(10,2);
ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS tank_liters_delta NUMERIC(10,2);
ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'unverified';

ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS pump_liters NUMERIC(10,2);
ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS tank_liters_delta NUMERIC(10,2);
ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'unverified';

-- Tarefa 6: Biometria Facial Avançada
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS face_enrolled BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS face_template_ref VARCHAR(255);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS face_consent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS facial_attempts (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES fueling_sessions(id) ON DELETE SET NULL,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  truck_id INTEGER REFERENCES trucks(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  score NUMERIC(5,2),
  liveness_passed BOOLEAN,
  provider VARCHAR(50),
  image_ref VARCHAR(255),
  failure_reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
