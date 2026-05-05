# ROADMAP.md — RoboAdvisor Pro

Ordre exacte d'implementació: de l'estat actual a una plataforma fintech professional.
Llegir `PROJECT_CONTEXT.md` per context complet.

**Estat actual**: prototip avançat (UI sòlida, report engine, models financers heurístics, zero BD, zero tests)
**Objectiu**: plataforma fintech + TFG acadèmic d'alt nivell

---

## Fase 0 — Foundations (estimat: 1–2 setmanes)
> Sense una base sòlida, tot el que es construeixi a sobre serà fràgil.
> Cap d'aquestes tasques és visible per l'usuari final, però desbloquegen tot el rest.

### 0.1 Documentació i context (ara)
- [x] `PROJECT_CONTEXT.md` — context del projecte, metodologia, regulació
- [x] `AGENTS.md` — arquitectura d'agents
- [x] `SKILLS.md` — catàleg de skills
- [x] `ROADMAP.md` — aquest fitxer

### 0.2 Base de dades real
**Prioritat màxima** — tot és in-memory ara, les dades es perden al reiniciar.
- [ ] Escollir: **Supabase** (PostgreSQL hosted, SDK TypeScript, ideal per Vercel) o PostgreSQL propi
- [ ] Dissenyar esquema inicial:
  ```sql
  users (id, email, role, created_at, last_login)
  portfolios (id, name, profile, allocations, created_by, created_at, active)
  reports (id, type, client_name, profile, generated_by, generated_at, html, pdf_url)
  audit_log (id, user_id, action, resource, metadata, created_at)
  newsletter_subscribers (id, email, subscribed_at, active)
  funds (id, isin, name, category, ter, risk_level, metadata)
  ```
- [ ] Crear `db/schema.sql` + `db/migrations/001_initial.sql`
- [ ] Migrar in-memory stores → BD:
  - `lib/adminPortfolios.ts` → taula `portfolios`
  - `lib/reportRegistry.ts` → taula `reports`
  - `lib/newsletter.ts` (subscribers) → taula `newsletter_subscribers`

### 0.3 Validació d'inputs (Zod)
- [ ] Instal·lar `zod` si no és present
- [ ] Crear `lib/schemas/` amb schemas Zod per:
  - `InvestorQuestionnaire`
  - `Portfolio` (create/update)
  - `ReportRequest`
  - `NewsletterSubscribe`
- [ ] Aplicar validació a totes les API routes que reben body

### 0.4 Variables d'entorn i secrets
- [ ] Revisar `.env.local.example` — completar amb totes les variables necessàries
- [ ] Documentar quines variables són obligatòries vs. opcionals
- [ ] Afegir `SUPABASE_URL` i `SUPABASE_ANON_KEY` (o `DATABASE_URL`)
- [ ] Verificar que `NEXTAUTH_SECRET` és suficientment llarg (32+ chars)

### 0.5 Setup de testing
- [ ] Instal·lar Vitest + @testing-library/react
- [ ] Crear `vitest.config.ts`
- [ ] Crear `__tests__/` amb estructura per agent
- [ ] Primer test: `score_questionnaire` amb perfil conegut → resultat esperat

### 0.6 TypeScript strict mode
- [ ] Revisar `tsconfig.json` — activar `"strict": true` si no ho és
- [ ] Corregir errors de tipus que apareguin
- [ ] Afegir tipus a totes les respostes d'API que ara retornen `any`

**Criteri de sortida Fase 0**: BD funcional, Zod en totes les routes, primer test passant, variables d'entorn documentades.

---

## Fase 1 — Quant Core (estimat: 2–3 setmanes)
> Aquí és on el TFG guanya rigor acadèmic real. Substituir heurística per teoria financera formal.

### 1.1 Taxa lliure de risc real (ECB API)
- [ ] Crear `lib/ecbApi.ts`
- [ ] Fetch: `https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.MM.ESTRXXX.WT.ST`
- [ ] Cache a BD: TTL 7 dies (taxa canvia rarament)
- [ ] Substituir hardcoded `RISK_FREE_RATE=3.0` per valor real
- [ ] Test: `fetch_risk_free_rate()` retorna número entre 0 i 10

### 1.2 Beta i CAPM
- [ ] Crear `lib/capm.ts`
- [ ] Implementar `capm_expected_return()`:
  - Fetch sèrie de preus mensuals (últims 5 anys) del ticker i del benchmark
  - Regressió OLS: `Ri = α + β × Rm + ε`
  - Aplicar CAPM: `E(R) = Rf + β × (ERP)`
  - `ERP` (Equity Risk Premium): usar Damodaran Spain ERP (5.3% referència 2024)
- [ ] Test: beta MSCI World ≈ 1.0 (±0.1)
- [ ] Test: E(R) d'un actiu defensiu < E(R) d'un actiu agressiu

### 1.3 Validació de sèries temporals
- [ ] Crear `lib/dataValidation.ts`
- [ ] Implementar `validate_timeseries()`:
  - Detectar outliers (retorn > 5σ → flag)
  - Detectar gaps (dies borsaris sense dades)
  - Detectar splits (caiguda >40% en un dia → split candidate)
  - Ajustar per dividends si les dades no ho fan
- [ ] Integrar a `lib/marketData.ts` com a pas obligatori

### 1.4 Markowitz Mean-Variance Optimization
**Tasca central del TFG.**
- [ ] Crear `lib/optimization.ts`
- [ ] Implementar `portfolio_optimize()`:
  - Input: llista d'actius, matriu de covariàncies, rendiments esperats (CAPM), constraints
  - Algoritme: Sequential Quadratic Programming o gradient descent
  - Estratègies: `min-variance`, `max-sharpe`, `risk-parity`
  - Constraints: pesos entre [0.02, 0.40], suma = 1, TER màxim per perfil
- [ ] Implementar `compute_efficient_frontier()`:
  - 50 punts sobre la frontera
  - Per cada punt: retorn esperat, volatilitat, sharpe, pesos
- [ ] Substituir les carteres hardcoded de `lib/portfolio.ts` per carteres calculades
- [ ] Tests: pesos sumen 1.0, sharpe màxim > sharpe mínim, frontera és convexa

### 1.5 VaR i CVaR
- [ ] Ampliar `lib/metrics.ts` amb `var_cvar()`:
  - Mètode paramètric: `VaR = μ - z × σ` (z=1.645 per 95%, z=2.326 per 99%)
  - Mètode histèric: percentil de la distribució de retorns reals
- [ ] Test: VaR 99% > VaR 95% (en valor absolut), CVaR > VaR sempre

### 1.6 Validació del motor Monte Carlo
- [ ] Test de convergència: P50 simulat vs. solució analítica GBM
  - `analyticalP50 = S0 × exp((μ - σ²/2) × T)`
  - Tolerància: ±5%
- [ ] Afegir seed per reproducibilitat en tests

### 1.7 Pipeline de dades fiable
- [ ] Afegir cache de preus a BD (taula `price_history`)
- [ ] Implementar stratègia de refresc: diari a les 18:00 CET per tots els tickers seguits
- [ ] Logar font en cada fetch (`source: 'FMP' | 'AlphaVantage' | 'Yahoo' | 'cache'`)
- [ ] Alertes quan FMP arriba al 80% del limit diari (250 req)

**Criteri de sortida Fase 1**: CAPM funcional, optimizer MPT amb tests passant, BD de preus, VaR/CVaR calculat.

---

## Fase 2 — Platform Layer (estimat: 2–3 setmanes)
> Producte usable per clients reals. Dades reals, experiència professional.

### 2.1 Dashboard de cartera amb dades reals
- [ ] Substituir dades simulades del dashboard per dades reals de BD
- [ ] Performance attribution real: per classe d'actiu, per geografia
- [ ] Gràfic de rendiment vs. benchmark (MSCI World, IBEX35)
- [ ] KPIs en temps real: NAV, rendiment YTD, Sharpe actual

### 2.2 Visualització de la frontera eficient
- [ ] Component nou: `components/charts/EfficientFrontier.tsx`
- [ ] Scatter plot: volatilitat (X) vs. retorn esperat (Y)
- [ ] Destacar: cartera mínima variança, màxim Sharpe, cartera actual del client
- [ ] Interactiu: hover mostra pesos de cartera per cada punt

### 2.3 Heatmap de correlació
- [ ] Component nou: `components/charts/CorrelationHeatmap.tsx`
- [ ] Color coding: vermell (alta correlació) → blau (baixa/negativa)
- [ ] Integrar a l'informe de cartera

### 2.4 Informe de perfil inversor millorat
- [ ] Afegir IPS (Investment Policy Statement) com a secció
- [ ] Afegir suitability assessment formal per cada producte recomanat
- [ ] Afegir secció de costos: desglossament TER per fons, impacte a 10 anys
- [ ] Versió de l'informe en el header (per auditoria)

### 2.5 Gestió de clients (admin)
- [ ] Admin: llistat de clients (usuaris autoritzats)
- [ ] Per client: historial d'informes, cartera assignada, últim login
- [ ] Crear client nou desde admin → genera credencials → envia email d'invitació

### 2.6 Sistema de notificacions de preus
- [ ] Stock tracker: alertes quan un ticker supera/baixa d'un preu
- [ ] Alertes d'earnings: notificació 2 dies abans de la data
- [ ] Enviament per email (Resend) o push (PWA notifications)

### 2.7 Integrar el servidor Python
- [ ] Opció A: migrar `server_trading_fixed.py` a TypeScript (recomanat, elimina dependència)
- [ ] Opció B: desplegar FastAPI separat i cridar-lo des de Next.js API routes
- [ ] Validar que els senyals tècnics coincideixen entre Python i TypeScript

**Criteri de sortida Fase 2**: dashboard amb dades reals, frontera eficient visible, gestió de clients funcional, informes amb IPS.

---

## Fase 3 — Production Ready (estimat: 2–3 setmanes)
> Fintech real necessita seguretat, compliance i observabilitat.

### 3.1 Seguretat
- [ ] Rate limiting: `lib/rateLimiter.ts` + aplicar a totes les routes públiques
- [ ] CSP headers: `next.config.ts` → `Content-Security-Policy`
- [ ] CORS restrictiu: només dominis autoritzats
- [ ] Input sanitization: cap HTML user-controlled sense sanititzar
- [ ] Dependency audit: `npm audit` + corregir vulnerabilitats crítiques/altes
- [ ] Security review complet (OWASP Top 10)

### 3.2 Audit Trail
- [ ] Crear `lib/auditLog.ts` + taula `audit_log` a BD
- [ ] Logar: login, logout, generació d'informe, enviament d'email, canvi de cartera, canvi de perfil
- [ ] Admin UI: pàgina d'audit log amb filtres per usuari/acció/data

### 3.3 MiFID II Compliance formal
- [ ] Crear `docs/compliance/mifid-checklist.md`
- [ ] Checklist: Art. 54 Delegated Reg. → quines preguntes del qüestionari cobreixen cada requisit
- [ ] Implementar `lib/suitability.ts` → `check_mifid_suitability()`
- [ ] Bloquejar recomanació de productes inadequats per al perfil (suitability check obligatori)
- [ ] Disclaimer legal revisat per advocat especialitzat (CNMV)

### 3.4 Monitoring i observabilitat
- [ ] Sentry: error tracking (frontend + backend)
- [ ] Vercel Analytics: temps de resposta, tràfic
- [ ] Alertes: quan un API route falla >5% de les requests → notificació
- [ ] Health check endpoint: `GET /api/health` → estat BD, APIs externes, cache

### 3.5 Performance
- [ ] Bundle analysis: `next build && next analyze`
- [ ] Objectiu: bundle < 500KB (gzip)
- [ ] API response time: < 2s per a totes les routes (< 5s per a backtest)
- [ ] Lazy loading per Three.js (és gran, no cal en totes les pàgines)

### 3.6 Tests E2E
- [ ] Instal·lar Playwright
- [ ] Test E2E del flux principal: landing → qüestionari → perfil → cartera → informe → PDF
- [ ] Test E2E admin: login → crear cartera → assignar a client → enviar informe
- [ ] CI/CD: GitHub Actions → tests passen → deploy a Vercel

### 3.7 Documentació tècnica
- [ ] `README.md` real (substituir boilerplate): arquitectura, setup, deploy, tests
- [ ] `docs/api/` — documentació d'endpoints (OpenAPI / Swagger)
- [ ] `docs/models/` — documentació matemàtica (MPT, CAPM, Monte Carlo)

**Criteri de sortida Fase 3**: zero vulnerabilitats OWASP crítiques, audit trail complet, MiFID II checklist coberta, tests E2E passant en CI.

---

## Fase TFG — Entregables acadèmics
> Paral·lel a les fases anteriors. El TFG documenta el que es construeix.

### T.1 Capítol: Fonaments teòrics
- Revisió literatura: MPT (Markowitz 1952), CAPM (Sharpe 1964), Black-Litterman (1990)
- Formalització matemàtica:
  - Frontera eficient: `min σ²p = wᵀΣw` subjecte a `wᵀμ = μp`, `wᵀ1 = 1`
  - CAPM: `E(Ri) = Rf + βi(E(Rm) - Rf)`, demostració derivació del beta
  - GBM Monte Carlo: `dS = μS dt + σS dW`, solució de Ito's lemma
- MiFID II: estructura regulatòria, requisits de suitability, implicacions per al disseny

### T.2 Capítol: Disseny del sistema
- Arquitectura de 3 capes: TFG Core / Product Layer / Infrastructure Layer
- Diagrama de flux: perfilació → optimització → informe
- Decisions de disseny: per què MPT sobre altres mètodes? Per què Next.js?

### T.3 Capítol: Validació empírica
- **Backtest 2019–2024**: 4 carteres (una per perfil) vs. benchmark
  - Dades reals: Yahoo Finance / FMP (5 anys de preus mensuals)
  - Mètriques: CAGR, Sharpe, max drawdown, alpha
- **Validació Monte Carlo**: P50 simulat vs. analític per 10 configs
- **Comparació MPT vs. heurística**: Sharpe de la cartera optimitzada vs. cartera actual
- Taules de resultats, gràfics, anàlisi estadística

### T.4 Capítol: Compliance i ètica
- Anàlisi MiFID II: com el sistema satisfà Art. 54 i requisits de suitability
- Limitacions: el sistema és informatiu, no és assessorament financer regulat
- Riscos: model risk, data quality risk, overfitting en backtests
- Reflexió RGPD: protecció de dades del qüestionari

### T.5 Annex: Demo live
- URL pública de la plataforma (Vercel)
- Manual d'usuari: flux pas a pas amb captures de pantalla
- Codi font disponible (GitHub, potser privat)

---

## Dependències entre fases

```
Fase 0 (Foundations)
  ↓ desbloqueja
Fase 1 (Quant Core)       ← TFG T.1 i T.3 depenen d'aquesta
  ↓ desbloqueja
Fase 2 (Platform)         ← TFG T.2 depèn d'aquesta
  ↓ desbloqueja
Fase 3 (Production)       ← TFG T.4 depèn d'aquesta

TFG T.5 (Demo) depèn de Fase 2 completada
```

## Tasca immediata recomanada

**Fase 0.2** — Base de dades real.

És el desbloqueig crític. Fins que no hi hagi BD, cap millora del model quant és sostenible (les carteres optimitzades cal guardar-les), cap audit trail és possible, i cap client real pot tenir persistència de dades.

Recomanació: **Supabase** — PostgreSQL hosted, SDK TypeScript natiu, integra amb NextAuth, gratuït fins a 500MB, un sol `npm install @supabase/supabase-js`.
