CREATE TABLE IF NOT EXISTS driver_cards (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  card_holder VARCHAR(255) NOT NULL,
  last_four VARCHAR(4) NOT NULL,
  card_brand VARCHAR(50) DEFAULT 'Sicoob Visa Frota',
  bank_name VARCHAR(100) DEFAULT 'Banco Cooperativo Sicoob S.A.',
  expiration_month INTEGER NOT NULL,
  expiration_year INTEGER NOT NULL,
  monthly_limit NUMERIC(10,2) DEFAULT 5000.00,
  is_default BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_cards_driver_id ON driver_cards(driver_id);
