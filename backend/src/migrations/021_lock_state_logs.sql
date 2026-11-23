CREATE TABLE IF NOT EXISTS lock_state_logs (
  id BIGSERIAL PRIMARY KEY,
  truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  command VARCHAR(10) CHECK (command IN ('lock', 'unlock')),
  sol1 BOOLEAN NOT NULL,
  sol2 BOOLEAN NOT NULL,
  fc_locked BOOLEAN NOT NULL,
  fc_unlocked BOOLEAN NOT NULL,
  derived_state VARCHAR(10) NOT NULL CHECK (derived_state IN ('locked', 'unlocked', 'moving', 'fault')),
  mismatch BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice composto atende a consulta por caminhão com paginação por cursor (created_at, id)
CREATE INDEX IF NOT EXISTS idx_lock_state_logs_truck_cursor
  ON lock_state_logs (truck_id, created_at DESC, id DESC);

-- RLS: a API conecta como dono da tabela (ignora RLS); o acesso direto por
-- outros papéis fica negado por padrão, pois nenhuma policy é criada.
ALTER TABLE lock_state_logs ENABLE ROW LEVEL SECURITY;
