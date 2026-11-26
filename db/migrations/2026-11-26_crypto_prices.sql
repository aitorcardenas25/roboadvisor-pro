-- Migració 2026-11-26: preu diari del bitcoin (BTC/EUR) per valorar el que
-- declaren els clients al seu patrimoni. NO és un actiu recomanable de l'app.
-- Com aplicar-la: Supabase → projecte factor-otc → SQL Editor → enganxa i Run.
-- Es pot executar més d'una vegada sense perill.

CREATE TABLE IF NOT EXISTS crypto_prices (
  symbol      TEXT          NOT NULL CHECK (symbol IN ('BTC')),
  price_date  DATE          NOT NULL,                 -- dia (UTC) del tancament
  close_eur   NUMERIC(18,2) NOT NULL CHECK (close_eur > 0),
  source      TEXT          NOT NULL CHECK (source IN ('kraken','bitstamp','coingecko')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (symbol, price_date)
);

-- Només el servidor (service_role) hi pot accedir; la clau pública no.
ALTER TABLE crypto_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crypto_prices FROM anon, authenticated;
