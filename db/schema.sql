-- RoboAdvisor Pro — Esquema de base de dades
-- Executa aquest fitxer a l'editor SQL de Supabase per crear totes les taules.
-- Totes les taules usen TEXT per a IDs (compatibles amb els IDs generats per l'aplicació).

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Carteres (adminPortfolios) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portfolios (
  id                  TEXT        PRIMARY KEY,
  name                TEXT        NOT NULL,
  description         TEXT        NOT NULL DEFAULT '',
  recommended_profile TEXT        NOT NULL CHECK (recommended_profile IN ('conservador', 'moderat', 'dinamic', 'agressiu')),
  horizon             TEXT        NOT NULL DEFAULT '5–10 anys',
  assets              JSONB       NOT NULL DEFAULT '[]',
  total_weight        NUMERIC     NOT NULL DEFAULT 0,
  expected_return     NUMERIC,
  expected_vol        NUMERIC,
  justification       TEXT        NOT NULL DEFAULT '',
  status              TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at          TEXT        NOT NULL,
  updated_at          TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portfolios_status ON portfolios (status);
CREATE INDEX IF NOT EXISTS idx_portfolios_profile ON portfolios (recommended_profile);

-- Seed: carteres model inicials
INSERT INTO portfolios (id, name, description, recommended_profile, horizon, assets, total_weight, expected_return, expected_vol, justification, status, created_at, updated_at)
VALUES
  (
    'port-conservador-model',
    'Cartera Conservadora Model',
    'Cartera de baix risc per a preservació de capital amb rendiment modest.',
    'conservador', '3–5 anys',
    '[{"type":"fund","id":"amundi-monetari-eur","name":"Amundi Euro Liquidity SRI","isin":"FR0010510008","weight":20,"justification":"Component de liquiditat i baix risc"},{"type":"fund","id":"pimco-rf-curta","name":"PIMCO Euro Short-Term","isin":"IE00B11XZ871","weight":25,"justification":"Renda fixa curta durada, risc mínim"},{"type":"etf","id":"ishares-global-agg-bond-etf","name":"iShares Global Agg Bond ETF","isin":"IE00B3F81R35","weight":30,"justification":"Diversificació RF global hedged EUR"},{"type":"fund","id":"nordea-stable-return","name":"Nordea Stable Return","isin":"LU0141799501","weight":15,"justification":"Mixt defensiu amb baixa volatilitat"},{"type":"etf","id":"ishares-core-europe-etf","name":"iShares Core Europe ETF","isin":"IE00B4K48X80","weight":10,"justification":"Component RV Europa mínima"}]',
    100, 3.2, 4.5,
    'Cartera orientada a preservació de capital amb exposició molt limitada a renda variable.',
    'active', '2026-04-01', '2026-04-28'
  ),
  (
    'port-moderat-model',
    'Cartera Moderada Model',
    'Equilibri entre creixement i estabilitat. Base indexada amb component actiu selectiu.',
    'moderat', '5–10 anys',
    '[{"type":"etf","id":"ishares-msci-world-etf","name":"iShares MSCI World ETF","isin":"IE00B4L5Y983","weight":35,"justification":"Core RV global indexat, màxima diversificació"},{"type":"etf","id":"ishares-global-agg-bond-etf","name":"iShares Global Agg Bond","isin":"IE00B3F81R35","weight":25,"justification":"Component defensiu RF global"},{"type":"fund","id":"flossbach-multiple-opp","name":"Flossbach Multiple Opp.","isin":"LU0323578657","weight":20,"justification":"Mixt flexible de referència, gestió activa de qualitat"},{"type":"etf","id":"ishares-msci-em-etf","name":"iShares MSCI EM ETF","isin":"IE00BKM4GZ66","weight":10,"justification":"Component emergents per diversificació global"},{"type":"fund","id":"fidelity-dividend","name":"Fidelity Global Dividend","isin":"LU0605515377","weight":10,"justification":"Income i dividend per estabilitzar retorns"}]',
    100, 7.1, 9.8,
    'Cartera balancejada amb base indexada (60% RV/RF) i complement actiu selectiu.',
    'active', '2026-04-01', '2026-04-28'
  )
ON CONFLICT (id) DO NOTHING;

-- ── Informes (reportRegistry) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id              TEXT        PRIMARY KEY,
  client_name     TEXT        NOT NULL,
  client_email    TEXT        NOT NULL DEFAULT '',
  profile         TEXT        NOT NULL,
  score           NUMERIC     NOT NULL DEFAULT 0,
  monthly_amount  NUMERIC     NOT NULL DEFAULT 0,
  investable      NUMERIC     NOT NULL DEFAULT 0,
  horizon         INTEGER     NOT NULL DEFAULT 10,
  portfolio       JSONB       NOT NULL DEFAULT '[]',
  pdf_generated   BOOLEAN     NOT NULL DEFAULT FALSE,
  email_sent      BOOLEAN     NOT NULL DEFAULT FALSE,
  date            TEXT        NOT NULL,
  created_at      TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_profile    ON reports (profile);

-- ── Subscriptors de newsletter ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id             TEXT     PRIMARY KEY,
  email          TEXT     NOT NULL UNIQUE,
  name           TEXT     NOT NULL DEFAULT '',
  subscribed_at  TEXT     NOT NULL,
  active         BOOLEAN  NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email  ON newsletter_subscribers (email);
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON newsletter_subscribers (active);

-- ── Newsletters ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS newsletters (
  id          TEXT     PRIMARY KEY,
  title       TEXT     NOT NULL,
  subject     TEXT     NOT NULL,
  status      TEXT     NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'validated', 'sent')),
  sections    JSONB    NOT NULL DEFAULT '{}',
  created_at  TEXT     NOT NULL,
  updated_at  TEXT     NOT NULL,
  sent_at     TEXT,
  sent_to     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_newsletters_status     ON newsletters (status);
CREATE INDEX IF NOT EXISTS idx_newsletters_created_at ON newsletters (created_at DESC);

-- ── Usuaris ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id             TEXT     PRIMARY KEY,
  username       TEXT     NOT NULL UNIQUE,
  password_hash  TEXT     NOT NULL,
  name           TEXT     NOT NULL DEFAULT '',
  email          TEXT     NOT NULL DEFAULT '',
  role           TEXT     NOT NULL DEFAULT 'authorized' CHECK (role IN ('admin', 'authorized')),
  active         BOOLEAN  NOT NULL DEFAULT TRUE,
  created_at     TEXT     NOT NULL,
  last_login     TEXT
);

-- ── Audit log ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL  PRIMARY KEY,
  user_id     TEXT,
  action      TEXT       NOT NULL,
  resource    TEXT       NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
