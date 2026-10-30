ALTER TABLE trucks ADD COLUMN IF NOT EXISTS api_key_hash CHAR(64) NULL;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS api_key_prefix VARCHAR(8) NULL;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ NULL;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS api_key_last_used_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION trg_trucks_hash_api_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.api_key IS NOT NULL THEN
    NEW.api_key_hash := encode(sha256(convert_to(NEW.api_key, 'UTF8')), 'hex');
    NEW.api_key_prefix := left(NEW.api_key, 8);
    NEW.api_key_created_at := NOW();
    NEW.api_key := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trucks_hash_api_key_trg ON trucks;
CREATE TRIGGER trucks_hash_api_key_trg
  BEFORE INSERT OR UPDATE OF api_key ON trucks
  FOR EACH ROW
  EXECUTE FUNCTION trg_trucks_hash_api_key();

UPDATE trucks
SET api_key_hash = encode(sha256(convert_to(api_key, 'UTF8')), 'hex'),
    api_key_prefix = left(api_key, 8),
    api_key_created_at = COALESCE(api_key_created_at, NOW()),
    api_key = NULL
WHERE api_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trucks_api_key_hash_unique
  ON trucks (api_key_hash)
  WHERE api_key_hash IS NOT NULL;
