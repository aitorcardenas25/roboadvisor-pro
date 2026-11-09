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
  id                  TEXT        PRIMARY KEY,
  username            TEXT        NOT NULL UNIQUE,
  password_hash       TEXT        NOT NULL,
  name                TEXT        NOT NULL DEFAULT '',
  email               TEXT        NOT NULL DEFAULT '',
  role                TEXT        NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  active              BOOLEAN     NOT NULL DEFAULT TRUE,
  subscription_plan   TEXT        NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'active', 'premium')),
  subscription_status TEXT        NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'suspended')),
  subscription_since  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at       TIMESTAMPTZ
);

-- ── Audit log ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT        PRIMARY KEY,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action      TEXT        NOT NULL,
  user_id     TEXT,
  user_email  TEXT,
  resource    TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  ip          TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp  ON audit_log (timestamp DESC);

-- ── Notificacions admin ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT        PRIMARY KEY,
  type        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  link        TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_read_at    ON notifications (read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);

-- ── Client Portfolios ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_portfolios (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL UNIQUE,
  client_name     TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  recommendations TEXT NOT NULL DEFAULT '',
  next_followup   TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_portfolios_client ON client_portfolios (client_id);

-- ── Client Holdings ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_holdings (
  id                 TEXT PRIMARY KEY,
  portfolio_id       TEXT NOT NULL REFERENCES client_portfolios(id) ON DELETE CASCADE,
  asset_isin         TEXT NOT NULL DEFAULT '',
  asset_name         TEXT NOT NULL,
  asset_symbol       TEXT,
  asset_category     TEXT NOT NULL DEFAULT '',
  broker             TEXT NOT NULL DEFAULT '',
  quantity           NUMERIC NOT NULL DEFAULT 0,
  avg_entry_price    NUMERIC NOT NULL DEFAULT 0,
  current_price      NUMERIC NOT NULL DEFAULT 0,
  price_last_updated TEXT,
  price_source       TEXT CHECK (price_source IN ('fmp', 'manual', 'pending')),
  currency           TEXT NOT NULL DEFAULT 'EUR',
  notes              TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON client_holdings (portfolio_id);

-- ── Client Transactions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_transactions (
  id             TEXT PRIMARY KEY,
  portfolio_id   TEXT NOT NULL REFERENCES client_portfolios(id) ON DELETE CASCADE,
  holding_id     TEXT,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('buy','sell','deposit','withdrawal','rebalance')),
  ticker         TEXT,
  asset_name     TEXT,
  date           TEXT NOT NULL,
  quantity       NUMERIC NOT NULL DEFAULT 0,
  price_eur      NUMERIC NOT NULL DEFAULT 0,
  total_eur      NUMERIC NOT NULL DEFAULT 0,
  commission     NUMERIC NOT NULL DEFAULT 0,
  broker         TEXT NOT NULL DEFAULT '',
  notes          TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_portfolio ON client_transactions (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date      ON client_transactions (date DESC);

-- ── Portfolio Snapshots (for historical chart) ─────────────────────────────

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES client_portfolios(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  total_value  NUMERIC NOT NULL,
  notes        TEXT,
  created_by   TEXT NOT NULL DEFAULT 'admin',
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_portfolio ON portfolio_snapshots (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date      ON portfolio_snapshots (date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_portfolio_date ON portfolio_snapshots (portfolio_id, date);

-- ── Advisor Notes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS advisor_notes (
  id                   TEXT PRIMARY KEY,
  portfolio_id         TEXT NOT NULL REFERENCES client_portfolios(id) ON DELETE CASCADE,
  text                 TEXT NOT NULL,
  author               TEXT NOT NULL DEFAULT 'Admin Factor OTC',
  is_visible_to_client BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_advisor_notes_portfolio ON advisor_notes (portfolio_id);

-- ── Leads ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  last_name           TEXT,
  email               TEXT NOT NULL,
  phone               TEXT,
  interest            TEXT NOT NULL DEFAULT '',
  profile             TEXT,
  message             TEXT,
  source              TEXT NOT NULL DEFAULT 'landing-form',
  type                TEXT,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','preparing-report','report-sent','converted','discarded')),
  gdpr_consent        BOOLEAN NOT NULL DEFAULT FALSE,
  questionnaire_data  JSONB,
  linked_user_id      TEXT,
  linked_portfolio_id TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email      ON leads (email);

-- ── Informes mensuals ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS monthly_reports (
  id           TEXT        PRIMARY KEY,
  portfolio_id TEXT        NOT NULL,
  client_id    TEXT,
  client_name  TEXT        NOT NULL,
  period_start DATE        NOT NULL,
  period_end   DATE        NOT NULL,
  data         JSONB       NOT NULL,
  sent_at      TIMESTAMPTZ,
  emailed_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_portfolio ON monthly_reports (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_created   ON monthly_reports (created_at DESC);

-- ── Informes borsaris ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_reports (
  id            TEXT PRIMARY KEY,
  ticker        TEXT NOT NULL,
  company       TEXT NOT NULL,
  sector        TEXT NOT NULL DEFAULT '',
  rating        TEXT NOT NULL CHECK (rating IN ('buy','hold','avoid','watch')),
  summary       TEXT NOT NULL DEFAULT '',
  fundamentals  TEXT NOT NULL DEFAULT '',
  technicals    TEXT NOT NULL DEFAULT '',
  risks         TEXT NOT NULL DEFAULT '',
  conclusion    TEXT NOT NULL DEFAULT '',
  target_price  NUMERIC,
  current_price NUMERIC,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  visible_to    TEXT NOT NULL DEFAULT 'clients' CHECK (visible_to IN ('all','clients','premium')),
  published_at  TEXT,
  updated_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_reports_status ON stock_reports (status);
CREATE INDEX IF NOT EXISTS idx_stock_reports_ticker ON stock_reports (ticker);

-- ── Propostes de cartera (cartera recomanada per l'assessor, amb versions) ──

CREATE TABLE IF NOT EXISTS client_proposals (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL,
  version      INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  data         JSONB NOT NULL,          -- perfil, horitzó, imports, nota i fons amb pesos
  approved_at  TEXT,
  approved_by  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (client_id, version)
);
CREATE INDEX IF NOT EXISTS idx_client_proposals_client ON client_proposals (client_id, version DESC);

-- ── Beta privada: consentiment i ús ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_consents (
  id             TEXT        PRIMARY KEY,
  user_id        TEXT        NOT NULL,
  version        TEXT        NOT NULL,           -- versió del text acceptat (lib/betaConsent.ts)
  accepted_at    TIMESTAMPTZ NOT NULL,
  survey_opt_in  BOOLEAN     NOT NULL DEFAULT FALSE,
  ip             TEXT
);
CREATE INDEX IF NOT EXISTS idx_client_consents_user ON client_consents (user_id, version);

CREATE TABLE IF NOT EXISTS client_activity (
  id       BIGSERIAL   PRIMARY KEY,
  user_id  TEXT        NOT NULL,
  event    TEXT        NOT NULL,                 -- login, finances.view, ping... (lib/betaActivity.ts)
  page     TEXT,                                 -- finances | cartera | altres (només per a ping)
  at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE client_activity ADD COLUMN IF NOT EXISTS page TEXT;
CREATE INDEX IF NOT EXISTS idx_client_activity_at   ON client_activity (at DESC);
CREATE INDEX IF NOT EXISTS idx_client_activity_user ON client_activity (user_id, at DESC);

-- ── Seguretat: Row Level Security ──────────────────────────────────────────
-- L'app només accedeix amb la service_role key (servidor), que no està afectada
-- per RLS. Activar RLS sense polítiques impedeix llegir res amb la clau pública
-- (anon), per si mai es filtrés. Supabase avisa si una taula pública no en té.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'portfolios','reports','newsletter_subscribers','newsletters','users','audit_log',
    'notifications','client_portfolios','client_holdings','client_transactions',
    'portfolio_snapshots','advisor_notes','leads','monthly_reports','stock_reports',
    'client_proposals','client_consents','client_activity'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
