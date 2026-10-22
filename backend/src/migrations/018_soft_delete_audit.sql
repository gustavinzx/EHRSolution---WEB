-- 018_soft_delete_audit.sql
-- Preserva rastreabilidade e auditoria antifraude na exclusao/anonimizacao de motoristas e caminhoes

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE trucks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_trucks_status ON trucks(status);
