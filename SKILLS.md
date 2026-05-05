# SKILLS.md — Catàleg de Skills Reutilitzables

Skills organitzades per agent. Cada skill té: signatura, descripció, fitxer d'implementació, agents consumidors, tests associats.

---

## Quant Engine Skills

### `portfolio_optimize`
```typescript
portfolio_optimize(
  assets: Asset[],           // llista d'actius amb tickers i pesos mínims/màxims
  constraints: Constraints,  // perfil, horitzó, liquiditat, TER màxim
  method: 'min-variance' | 'max-sharpe' | 'risk-parity'
) → {
  weights: Record<string, number>,
  expectedReturn: number,
  volatility: number,
  sharpe: number,
  frontier?: FrontierPoint[]
}
```
- **Implementació**: `lib/optimization.ts` (a crear)
- **Consumit per**: Report Engine, Frontend Agent
- **Test**: `__tests__/quant/optimization.test.ts`
- **Notes**: usa numeric.js o implementació pròpia de quadratic programming

---

### `compute_efficient_frontier`
```typescript
compute_efficient_frontier(
  assets: Asset[],
  n_points: number          // default 50
) → FrontierPoint[]         // [{return, volatility, sharpe, weights}]
```
- **Implementació**: `lib/optimization.ts`
- **Consumit per**: Frontend Agent (visualització), Report Engine
- **Test**: `__tests__/quant/frontier.test.ts`

---

### `capm_expected_return`
```typescript
capm_expected_return(
  ticker: string,
  marketReturn: number,     // prima de risc histèrica (Damodaran)
  riskFreeRate: number      // taxa ECB actual
) → {
  expectedReturn: number,
  beta: number,
  rSquared: number,
  dataSource: string        // 'FMP' | 'AlphaVantage' | 'Yahoo'
}
```
- **Implementació**: `lib/capm.ts` (a crear)
- **Consumit per**: Quant Engine (input per optimizer), Report Engine
- **Test**: `__tests__/quant/capm.test.ts`
- **Validació**: beta d'índex (MSCI World) ha de ser ≈ 1.0

---

### `compute_correlation_matrix`
```typescript
compute_correlation_matrix(
  tickers: string[],
  period: '1Y' | '3Y' | '5Y'
) → {
  matrix: number[][],       // Pearson correlation
  labels: string[],
  dataQuality: 'real' | 'estimated'
}
```
- **Implementació**: `lib/metrics.ts`
- **Consumit per**: Quant Engine (optimizer input), Report Engine, Frontend Agent
- **Test**: `__tests__/quant/metrics.test.ts`

---

### `var_cvar`
```typescript
var_cvar(
  portfolio: Portfolio,
  confidence: 0.95 | 0.99,
  horizon: number,          // dies
  method: 'parametric' | 'historical'
) → {
  var: number,              // Value-at-Risk (%)
  cvar: number,             // Conditional VaR / Expected Shortfall (%)
  method: string
}
```
- **Implementació**: `lib/metrics.ts`
- **Consumit per**: Report Engine, Frontend Agent (dashboard de risc)
- **Test**: `__tests__/quant/risk.test.ts`
- **Validació**: VaR 95% < VaR 99% sempre

---

### `run_monte_carlo`
```typescript
run_monte_carlo(
  config: MonteCarloConfig  // initial, monthly, years, return, volatility, inflation
) → MonteCarloResult        // percentils P10-P90, probabilitats, year-by-year
```
- **Implementació**: `lib/monteCarlo.ts` (existent)
- **Consumit per**: Report Engine, Frontend Agent
- **Test**: `__tests__/quant/montecarlo.test.ts`
- **Validació**: P50 ≈ solució analítica de GBM (±5%)

---

### `run_backtest`
```typescript
run_backtest(
  portfolio: Portfolio,
  startDate: string,
  endDate: string,
  initialAmount: number,
  monthlyContribution?: number
) → BacktestResult          // CAGR, Sharpe, drawdown, atribució, per-year
```
- **Implementació**: `lib/backtest.ts` (existent)
- **Consumit per**: Report Engine, Frontend Agent
- **Test**: `__tests__/quant/backtest.test.ts`

---

## Profiling Skills

### `score_questionnaire`
```typescript
score_questionnaire(
  answers: InvestorQuestionnaire
) → {
  profile: InvestorProfile,         // 'conservador' | 'moderat' | 'dinamic' | 'agressiu'
  scoreBreakdown: ScoreBreakdown,   // per dimensió
  feasibility: FeasibilityLevel,    // 'alta' | 'moderada' | 'baixa' | 'molt-baixa'
  warnings: string[]                // alertes (ex: "Deute alt vs estalvi")
}
```
- **Implementació**: `lib/scoring.ts` (existent)
- **Consumit per**: Backend Agent (API /api/profile), Profiling Agent
- **Test**: `__tests__/profiling/scoring.test.ts`

---

### `check_mifid_suitability`
```typescript
check_mifid_suitability(
  profile: ScoringResult,
  product: FinancialProduct
) → {
  suitable: boolean,
  reasons: string[],
  mifidArticle: string      // ex: "Art. 54(2)(a) - risk tolerance"
}
```
- **Implementació**: `lib/suitability.ts` (a crear)
- **Consumit per**: Report Engine (disclaimer), Backend Agent (validació pre-recomanació)
- **Test**: `__tests__/profiling/suitability.test.ts`
- **Notes**: blocant — si `suitable === false`, no es pot recomanar el producte

---

### `generate_ips`
```typescript
generate_ips(
  client: ClientInfo,
  profile: ScoringResult,
  portfolio: Portfolio
) → InvestmentPolicyStatement
```
- **Implementació**: `lib/ips.ts` (a crear)
- **Consumit per**: Report Engine (inclòs en l'informe complet)
- **Test**: `__tests__/profiling/ips.test.ts`

---

### `feasibility_analysis`
```typescript
feasibility_analysis(
  goal: FinancialGoal,       // target, horitzó, inflació
  savings: SavingsProfile,   // estalvi mensual, capital inicial
  profile: InvestorProfile
) → {
  feasible: FeasibilityLevel,
  requiredReturn: number,    // % anual necessari
  achievableReturn: number,  // % anual esperat per perfil
  gap: number,               // diferència
  suggestions: string[]
}
```
- **Implementació**: `lib/scoring.ts` (existent, millorar)
- **Consumit per**: Report Engine, Frontend Agent (resultats del qüestionari)
- **Test**: `__tests__/profiling/feasibility.test.ts`

---

## Data Skills

### `fetch_ohlcv`
```typescript
fetch_ohlcv(
  ticker: string,
  period: '1Y' | '2Y' | '5Y' | '10Y',
  frequency: 'daily' | 'monthly'
) → {
  data: OHLCVPoint[],
  source: 'FMP' | 'AlphaVantage' | 'Yahoo' | 'cache' | 'simulated',
  quality: DataQuality
}
```
- **Implementació**: `lib/marketData.ts` (existent, refactoritzar)
- **Consumit per**: Quant Engine, Report Engine
- **Test**: `__tests__/data/fetchOhlcv.test.ts`

---

### `fetch_fundamentals`
```typescript
fetch_fundamentals(ticker: string) → {
  pe: number | null,
  eps: number | null,
  revenue: number | null,
  profitMargin: number | null,
  roe: number | null,
  debtToEquity: number | null,
  beta: number | null,
  dividendYield: number | null,
  source: string,
  asOf: string              // ISO date
}
```
- **Implementació**: `services/financialData.ts` (existent, millorar)
- **Consumit per**: Report Engine (informe bursàtil), Frontend Agent
- **Test**: `__tests__/data/fundamentals.test.ts`

---

### `fetch_risk_free_rate`
```typescript
fetch_risk_free_rate(
  currency: 'EUR' | 'USD'
) → {
  rate: number,             // % anual
  source: 'ECB' | 'Fed' | 'fallback',
  asOf: string
}
```
- **Implementació**: `lib/ecbApi.ts` (a crear)
- **Consumit per**: Quant Engine (CAPM input), Metrics (Sharpe denominator)
- **Test**: `__tests__/data/riskFreeRate.test.ts`
- **Cache TTL**: 7 dies (taxa canvia rarament)

---

### `validate_timeseries`
```typescript
validate_timeseries(
  data: OHLCVPoint[]
) → {
  cleaned: OHLCVPoint[],
  outliers: number,         // punts eliminats
  gaps: DateGap[],          // forats en la sèrie
  splits: StockSplit[],     // splits detectats
  quality: 'high' | 'medium' | 'low'
}
```
- **Implementació**: `lib/dataValidation.ts` (a crear)
- **Consumit per**: Data Agent (pas obligatori), Quant Engine
- **Test**: `__tests__/data/validation.test.ts`

---

### `compute_returns`
```typescript
compute_returns(
  prices: number[],
  frequency: 'daily' | 'monthly' | 'annual'
) → {
  returns: number[],
  annualizedReturn: number,
  annualizedVolatility: number
}
```
- **Implementació**: `utils/calculations.ts` (existent, ampliar)
- **Consumit per**: Quant Engine, Backtest Engine
- **Test**: `__tests__/quant/returns.test.ts`

---

## Report Skills

### `build_report_section`
```typescript
build_report_section(
  type: ReportSectionType,  // 'executive' | 'profile' | 'portfolio' | 'montecarlo' | ...
  data: SectionData,
  language: 'ca' | 'es' | 'en'
) → {
  html: string,
  json: object
}
```
- **Implementació**: `lib/report.ts` (existent, modularitzar)
- **Consumit per**: Report Engine, ManualReportBuilder
- **Test**: `__tests__/reports/sections.test.ts`

---

### `render_chart_to_image`
```typescript
render_chart_to_image(
  chartConfig: ChartConfig    // type, data, dimensions, colors
) → {
  base64: string,             // PNG base64
  width: number,
  height: number
}
```
- **Implementació**: `components/pdf/ChartCapture.tsx` (existent, extreure lògica)
- **Consumit per**: Report Engine (PDF charts)
- **Test**: manual (visual regression)

---

### `export_pdf`
```typescript
export_pdf(
  reportHtml: string,
  metadata: ReportMetadata
) → Buffer                    // PDF binary
```
- **Implementació**: `components/pdf/FactorOTCReport.tsx` (existent)
- **Consumit per**: Frontend Agent (descàrrega), Backend Agent (email attachment)
- **Test**: `__tests__/reports/pdf.test.ts` (mida, pàgines, contingut)

---

### `send_report_email`
```typescript
send_report_email(
  report: GeneratedReport,
  recipient: EmailRecipient
) → {
  success: boolean,
  messageId: string,
  timestamp: string
}
```
- **Implementació**: `app/api/send-report/route.ts` (existent)
- **Consumit per**: Frontend Agent (botó "Enviar per email")
- **Test**: `__tests__/reports/email.test.ts` (mock Resend)
- **Audit**: tota enviament es registra a `audit_log`

---

## Backend / Security Skills

### `validate_request_body`
```typescript
validate_request_body<T>(
  schema: ZodSchema<T>,
  body: unknown
) → { success: true; data: T } | { success: false; errors: ZodError }
```
- **Implementació**: `lib/validation.ts` (a crear — wrapper Zod)
- **Consumit per**: totes les API routes que reben body
- **Test**: `__tests__/backend/validation.test.ts`

---

### `check_auth`
```typescript
check_auth(
  req: NextRequest,
  requiredRole: 'admin' | 'authorized' | 'public'
) → { authorized: true; user: SessionUser } | NextResponse  // 401 | 403
```
- **Implementació**: `middleware.ts` (existent, refactoritzar com helper)
- **Consumit per**: totes les API routes protegides
- **Test**: `__tests__/backend/auth.test.ts`

---

### `rate_limit`
```typescript
rate_limit(
  key: string,              // `ip:${ip}` o `user:${userId}`
  maxRequests: number,
  windowMs: number
) → { allowed: boolean; remaining: number; resetAt: number }
```
- **Implementació**: `lib/rateLimiter.ts` (a crear)
- **Consumit per**: API routes públiques i d'enviament d'email
- **Test**: `__tests__/backend/rateLimiter.test.ts`

---

### `audit_log`
```typescript
audit_log(
  userId: string,
  action: AuditAction,      // 'LOGIN' | 'GENERATE_REPORT' | 'SEND_EMAIL' | 'CHANGE_PORTFOLIO' | ...
  resource: string,
  metadata?: Record<string, unknown>
) → void                    // fire-and-forget, escriu a BD
```
- **Implementació**: `lib/auditLog.ts` (a crear)
- **Consumit per**: Report Engine (generació), Backend Agent (login, canvis)
- **Test**: `__tests__/backend/auditLog.test.ts`

---

## QA Skills

### `test_financial_metric`
Funció de test helper per validar que una mètrica financera retorna valors en rang esperat.
```typescript
// Exemple d'ús en tests:
test_financial_metric(
  () => sharpeRatio(returns, riskFree),
  { min: -2, max: 5 },      // rang raonable per Sharpe
  'Sharpe ratio out of bounds'
)
```
- **Implementació**: `__tests__/helpers/financialAssertions.ts` (a crear)

---

### `monte_carlo_convergence`
Valida que el Monte Carlo convergeix a la solució analítica de GBM.
```typescript
monte_carlo_convergence(
  engine: MonteCarloEngine,
  config: MonteCarloConfig,
  tolerance: number           // ex: 0.05 (5%)
) → { converged: boolean; analyticalP50: number; simulatedP50: number; error: number }
```
- **Implementació**: `__tests__/quant/montecarlo.test.ts`
- **Benchmark**: solució de Ito's lemma: `S0 × exp((μ - σ²/2)×T)`

---

## Índex de Skills per Fitxer

| Fitxer | Skills |
|--------|--------|
| `lib/optimization.ts` (nou) | `portfolio_optimize`, `compute_efficient_frontier` |
| `lib/capm.ts` (nou) | `capm_expected_return` |
| `lib/metrics.ts` | `compute_correlation_matrix`, `var_cvar` |
| `lib/monteCarlo.ts` | `run_monte_carlo` |
| `lib/backtest.ts` | `run_backtest` |
| `lib/scoring.ts` | `score_questionnaire`, `feasibility_analysis` |
| `lib/suitability.ts` (nou) | `check_mifid_suitability` |
| `lib/ips.ts` (nou) | `generate_ips` |
| `lib/marketData.ts` | `fetch_ohlcv` |
| `lib/ecbApi.ts` (nou) | `fetch_risk_free_rate` |
| `lib/dataValidation.ts` (nou) | `validate_timeseries` |
| `services/financialData.ts` | `fetch_fundamentals` |
| `utils/calculations.ts` | `compute_returns` |
| `lib/report.ts` | `build_report_section` |
| `lib/auditLog.ts` (nou) | `audit_log` |
| `lib/rateLimiter.ts` (nou) | `rate_limit` |
| `lib/validation.ts` (nou) | `validate_request_body` |
