CREATE TABLE IF NOT EXISTS batches (
  id BIGINT PRIMARY KEY,
  weight NUMERIC NOT NULL,
  purity SMALLINT NOT NULL,
  location TEXT,
  certification TEXT,
  is_public BOOLEAN DEFAULT true,
  added_at TIMESTAMP,
  added_by TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL DEFAULT 0,
  event_type VARCHAR(50) NOT NULL,
  from_address TEXT,
  to_address TEXT,
  amount NUMERIC,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  contract_address TEXT NOT NULL,
  UNIQUE (tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS holders (
  address TEXT PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_cache (
  id BIGSERIAL PRIMARY KEY,
  currency VARCHAR(10) NOT NULL,
  price_per_gram NUMERIC NOT NULL,
  source TEXT NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indexer_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_block ON transactions (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_holders_balance ON holders (balance DESC);
CREATE INDEX IF NOT EXISTS idx_batches_added_at ON batches (added_at DESC);
