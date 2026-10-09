-- Migration 011: Lowercase emails and unique indexes
DO $$
DECLARE
  dup_users RECORD;
  dup_drivers RECORD;
BEGIN
  -- Detect duplicate emails in users
  SELECT lower(email) as em, count(*) as c 
  INTO dup_users
  FROM users 
  GROUP BY lower(email) 
  HAVING count(*) > 1 
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Existem e-mails duplicados na tabela users: %', dup_users.em;
  END IF;

  -- Detect duplicate emails in drivers
  SELECT lower(email) as em, count(*) as c 
  INTO dup_drivers
  FROM drivers 
  WHERE email IS NOT NULL
  GROUP BY lower(email) 
  HAVING count(*) > 1 
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Existem e-mails duplicados na tabela drivers: %', dup_drivers.em;
  END IF;

  -- Update emails to lowercase
  UPDATE users SET email = lower(email) WHERE email != lower(email);
  UPDATE drivers SET email = lower(email) WHERE email != lower(email) AND email IS NOT NULL;

  -- Drop existing unique constraints
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
  
  -- Create unique indexes on lowercase emails
  CREATE UNIQUE INDEX IF NOT EXISTS users_lower_email_idx ON users (lower(email));
  CREATE UNIQUE INDEX IF NOT EXISTS drivers_lower_email_idx ON drivers (lower(email)) WHERE email IS NOT NULL;
END $$;
