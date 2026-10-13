-- Migration 014: Catálogo Nacional de Postos ANP e Histórico de Sincronizações

CREATE TABLE IF NOT EXISTS anp_stations (
  id SERIAL PRIMARY KEY,
  cnpj CHAR(14) UNIQUE NOT NULL,
  codigo_simp VARCHAR(50),
  autorizacao VARCHAR(100),
  data_publicacao VARCHAR(30),
  razao_social TEXT NOT NULL,
  endereco TEXT,
  complemento TEXT,
  bairro VARCHAR(255),
  cep CHAR(8),
  uf CHAR(2) NOT NULL,
  municipio VARCHAR(255),
  bandeira VARCHAR(255),
  data_vinculacao VARCHAR(30),
  lat NUMERIC(10,7) NULL,
  lng NUMERIC(10,7) NULL,
  acuracia_metros NUMERIC(10,2) NULL,
  situacao_sigaf VARCHAR(100) NULL,
  produtos JSONB NULL,
  is_active BOOLEAN DEFAULT true,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anp_sync_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  scope VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL,
  fetched INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  deactivated INTEGER NOT NULL DEFAULT 0,
  error TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_anp_stations_uf_municipio ON anp_stations (uf, municipio);
CREATE INDEX IF NOT EXISTS idx_anp_stations_bandeira ON anp_stations (bandeira);
CREATE INDEX IF NOT EXISTS idx_anp_stations_lat_lng ON anp_stations (lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anp_stations_is_active ON anp_stations (is_active);
