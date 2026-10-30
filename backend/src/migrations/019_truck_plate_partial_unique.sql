-- Migration 019: Substituir constraint UNIQUE rigida de trucks.plate por indice parcial uq_trucks_plate_active
-- Permite recadastrar uma placa cujo registro anterior foi marcado como status='deleted'
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- 1. Descobrir dinamicamente e remover qualquer constraint UNIQUE na tabela trucks associada a coluna plate
  FOR rec IN (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = cls.oid AND att.attnum = ANY(con.conkey)
    WHERE cls.relname = 'trucks'
      AND con.contype = 'u'
      AND att.attname = 'plate'
  ) LOOP
    EXECUTE 'ALTER TABLE trucks DROP CONSTRAINT IF EXISTS ' || quote_ident(rec.conname);
  END LOOP;

  -- 2. Remover indice unico legado caso tenha permanecido como indice independente
  DROP INDEX IF EXISTS trucks_plate_key;

  -- 3. Criar indice unico parcial para caminhoes ativos (status nao deletado)
  CREATE UNIQUE INDEX IF NOT EXISTS uq_trucks_plate_active 
    ON trucks(plate) 
    WHERE status IS DISTINCT FROM 'deleted';
END $$;
