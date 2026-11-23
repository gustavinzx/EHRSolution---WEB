CREATE TABLE IF NOT EXISTS hardware_audit_entries (
  id BIGSERIAL PRIMARY KEY,
  truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  lat NUMERIC(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng NUMERIC(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  event VARCHAR(20) NOT NULL,
  result VARCHAR(20) NOT NULL,
  seq INTEGER,
  line_hash CHAR(64) NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_hardware_audit_truck_line UNIQUE (truck_id, line_hash)
);

-- Consulta por caminhão com paginação por cursor (occurred_at, id)
CREATE INDEX IF NOT EXISTS idx_hardware_audit_truck_cursor
  ON hardware_audit_entries (truck_id, occurred_at DESC, id DESC);

-- RLS: a API conecta como dono da tabela (ignora RLS); acesso direto por
-- outros papéis fica negado por padrão, pois nenhuma policy é criada.
ALTER TABLE hardware_audit_entries ENABLE ROW LEVEL SECURITY;
