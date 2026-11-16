-- Migració 2026-11-16: preus dels fons entrats a mà.
-- Com aplicar-la: Supabase → projecte factor-otc → SQL Editor → New query →
-- enganxa tot aquest fitxer → Run. Es pot executar més d'una vegada sense perill.

CREATE TABLE IF NOT EXISTS fund_navs (
  isin        TEXT          NOT NULL CHECK (isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  nav_date    DATE          NOT NULL,
  nav         NUMERIC(18,6) NOT NULL CHECK (nav > 0),
  currency    TEXT          NOT NULL DEFAULT 'EUR',
  fund_name   TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (isin, nav_date)
);

-- Només el servidor (service_role) hi pot accedir; la clau pública no.
ALTER TABLE fund_navs ENABLE ROW LEVEL SECURITY;
