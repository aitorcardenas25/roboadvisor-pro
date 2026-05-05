<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AGENTS.md — Arquitectura d'Agents RoboAdvisor Pro

Cada agent té un domini clar, fitxers propis i responsabilitats no solapades.
Llegir `PROJECT_CONTEXT.md` i `SKILLS.md` abans de treballar en qualsevol agent.

---

## Agent 1 — Quant / Investment Engine

**Domini**: Model financer, teoria de carteres, pricing d'actius

### Responsabilitats
- Implementar **Markowitz Mean-Variance Optimization** (frontera eficient real)
- **CAPM**: `E(Ri) = Rf + βi × (E(Rm) - Rf)` amb dades reals
- Calcular matriu de covariàncies des de sèries temporals de preus
- Optimitzar pesos de cartera respectant restriccions (mín/màx per actiu, liquiditat, TER)
- **Black-Litterman** (Fase 3): incorporar views del gestor sobre actius
- **Factor models** (Fase 3): Fama-French 3 factors
- Validar matemàticament: Sharpe, Sortino, Calmar, VaR, CVaR, alpha, beta
- Substituir les carteres hardcoded de `lib/portfolio.ts` per carteres calculades

### Fitxers propis
- `lib/portfolio.ts` — constructor de carteres (migrar a MPT)
- `lib/metrics.ts` — càlcul de mètriques de risc/rendiment
- `lib/monteCarlo.ts` — simulació estocàstica
- `lib/backtest.ts` — backtesting històric
- `lib/capm.ts` — CAPM (nou fitxer a crear)
- `lib/optimization.ts` — Markowitz optimizer (nou fitxer a crear)

### Regles
- **Cap rendiment esperat hardcoded**: sempre derivat de CAPM o sèrie temporal real
- **Cap cartera estàtica**: pesos calculats per l'optimizer, no per regles heurístiques
- **Cada mètrica financera ha de tenir un test unitari** a `__tests__/quant/`
- Citar la font matemàtica en el comentari de cada funció nova (ex: "Sharpe (1966)")

### Interaccions
- Crida **Data Agent** per obtenir preus, fonamentals, taxa lliure de risc
- Rep constraints del **Profiling Agent** (perfil, horitzó, liquiditat)
- Lliura resultats al **Report Engine** i al **Frontend Agent**

---

## Agent 2 — Investor Profiling Agent

**Domini**: Perfilació, suitability, MiFID II compliance

### Responsabilitats
- Manteniment i evolució del qüestionari psicoomètric (`lib/scoring.ts`)
- **Suitability assessment MiFID II** formal (Art. 54 Delegated Regulation 2017/565)
- Generar **Investment Policy Statement (IPS)** per cada client
- Mapejar perfil → constraints per al Quant Engine (no carteres hardcoded)
- Validar que les recomanacions siguin defensables regulatòriament
- Anàlisi de viabilitat: pot l'objectiu ser assolit amb el perfil i l'horitzó del client?

### Fitxers propis
- `lib/scoring.ts` — qüestionari + scoring engine
- `lib/suitability.ts` — MiFID II suitability check (nou fitxer a crear)
- `lib/ips.ts` — Investment Policy Statement generator (nou fitxer a crear)
- `types/index.ts` — InvestorQuestionnaire, ScoringResult, InvestorProfile types

### Regles
- El perfil és **immutable durant la sessió**: no pot canviar per influència del mercat
- **Suitability check és obligatori** abans de qualsevol recomanació de producte
- El qüestionari ha de cobrir mínim: tolerància al risc, coneixement, objectius, horitzó, situació financera
- Les respostes del qüestionari han de ser **xifrades en trànsit i en repòs**

### Interaccions
- Lliura perfil + constraints al **Quant Engine**
- Lliura perfil + IPS al **Report Engine**
- Rep validació de **QA Agent** (cobertura de test del qüestionari, compliance check)

---

## Agent 3 — Data & Market Agent

**Domini**: Ingesta de dades, qualitat, cache, emmagatzemament

### Responsabilitats
- **Pipeline de dades fiable**: FMP (1r) → Alpha Vantage (2n) → Yahoo Finance (3r) → BD cache
- Emmagatzemar sèries temporals de preus a BD (PostgreSQL/Supabase)
- **Fonamentals**: P/E, EPS, revenue, margins, ROE, deute per acció
- **Indicadors macro**: taxa ECB, Fed Funds rate, IPC, corbes de tipus (ECB API)
- **Prima de risc de mercat**: Damodaran database (actualització anual)
- **Validació de qualitat**: detectar outliers, missing data, stock splits, dividends
- Gestionar la cache (TTL per tipus de dada: preus 1h, fonamentals 24h, macro 7d)

### Fitxers propis
- `lib/yahooFinance.ts` — Yahoo Finance adapter
- `lib/marketData.ts` — orquestrador multi-font
- `services/quotes.ts` — quotes service
- `services/financialData.ts` — fundamentals service
- `lib/dataValidation.ts` — validació de qualitat (nou fitxer a crear)
- `lib/ecbApi.ts` — ECB API adapter (nou fitxer a crear)

### Regles
- **Simulated data és últim recurs**: `USE_SIMULATED_DATA=true` només per demos/dev
- **Cada fetch ha de logar la font** (FMP/AlphaVantage/Yahoo/cache) per auditabilitat
- **Rate limiting proactiu**: comptar requests per API i respectar els límits diaris
- **Validació obligatòria**: cap dada arriba al Quant Engine sense passar per `validateTimeseries()`

### Interaccions
- Serveix dades al **Quant Engine** (preus, covariàncies, taxa lliure risc)
- Serveix dades al **Report Engine** (cotitzacions, fonamentals per informes)
- Serveix dades al **Frontend Agent** (quotes en temps real, notícies)

---

## Agent 4 — Report Engine

**Domini**: Generació d'informes professionals, exportació, distribució

### Responsabilitats
- **Informe de perfil inversor**: diagnòstic financer, cartera recomanada, projeccions
- **Informe de renda variable**: fonamentals + tècnica + senyals + dates earnings
- **Informe de cartera**: performance attribution, drawdown, comparació benchmark
- Tots els informes han d'incloure: ID únic, data, versió del model, fonts de dades, disclaimer legal
- Formats: HTML interactiu, PDF (print-quality), JSON (API consumption)
- Distribució: email via Resend, descàrrega directa, arxiu històric

### Fitxers propis
- `lib/report.ts` — informe de perfil inversor
- `lib/stockReport.ts` — informe de renda variable
- `lib/manualReport.ts` — informe manual (admin)
- `components/pdf/` — components PDF (FactorOTCReport, ManualReportPDF, etc.)
- `lib/reportRegistry.ts` — arxiu i historial d'informes

### Regles
- **Cada informe té un `reportId` UUID traçable** — mai dos informes amb el mateix ID
- **Versió del model en cada informe**: quina versió de `lib/metrics.ts` va generar-lo
- **Disclaimer legal sempre present**: al peu de tots els informes
- **Cap dada simulada en informes d'enviament real** (email a client): bloquejar si `source === 'simulated'`

### Interaccions
- Rep resultats del **Quant Engine** (mètriques, carteres, Monte Carlo)
- Rep perfil + IPS del **Profiling Agent**
- Rep dades de mercat del **Data Agent**
- Lliura informes al **Frontend Agent** (renderitzat) i al **Backend Agent** (arxiu, email)

---

## Agent 5 — Frontend / UI Agent

**Domini**: React components, UX flows, visualitzacions

### Responsabilitats
- Multi-step form del flux de perfilació (components/RoboAdvisorApp.tsx)
- Dashboard de cartera (app/cartera/)
- Visualitzacions financeres: frontera eficient, heatmap de correlació, candlestick
- Pàgines client: cartera, accions, informe bursàtil, comparador
- Admin UI: portfolios, fons, notícies, newsletters, reports
- Responsive (mobile-first), accessible (WCAG 2.1 AA)
- PWA: service worker, manifest, offline fallback

### Fitxers propis
- `components/` — tots els components React
- `app/` — totes les pàgines (App Router)
- `hooks/` — custom React hooks
- `utils/formatters.ts` — formatadors de números/moneda (locale ca-ES)
- `app/globals.css` — estils globals

### Regles
- **Client Components marcats explícitament** amb `'use client'` — no assumir
- **Cap lògica financera al frontend**: tota càlcul passa per API routes o `lib/`
- **Loading states obligatoris** per tots els fetches de dades de mercat
- **Error boundaries** per seccions amb dades externes (mercat pot fallar)
- **Dades simulades han de ser visibles** per l'usuari (badge "Demo" o similar)

### Interaccions
- Crida **Backend Agent** via API routes per totes les dades
- Rep informes del **Report Engine** per renderitzar/descarregar
- Rep perfil del **Profiling Agent** per mostrar resultats

---

## Agent 6 — Backend & Security Agent

**Domini**: API routes, autenticació, autorització, seguretat, compliance

### Responsabilitats
- **Base de dades real**: disseny d'esquema, migracions, seed data
- **Autenticació robusta**: NextAuth + JWT amb refresh tokens
- **Autorització**: role-based access control (admin / authorized / public)
- **Rate limiting**: per endpoint, per IP, per usuari
- **Audit trail**: log de totes les accions sensibles (who/what/when)
- **Input validation**: Zod schemas a totes les API routes
- **Seguretat**: HTTPS, CORS restrictiu, CSP headers, SQL injection prevention
- Gestionar `middleware.ts`, `lib/authOptions.ts`, `lib/roles.ts`, `lib/users.ts`

### Fitxers propis
- `app/api/` — totes les API routes
- `middleware.ts` — auth + routing middleware
- `lib/authOptions.ts` — NextAuth configuration
- `lib/roles.ts` — definicions de rols
- `lib/users.ts` — gestió d'usuaris
- `lib/auditLog.ts` — audit trail (nou fitxer a crear)
- `lib/rateLimiter.ts` — rate limiting (nou fitxer a crear)
- `db/` — esquema de BD + migracions (nou directori a crear)

### Regles
- **Zod validation obligatòria** a cada API route que rep un body
- **Audit log obligatori** per: login, generació d'informe, canvi de cartera, enviament email
- **Cap secret en codi**: tot via variables d'entorn; mai `console.log` de secrets
- **Rate limiting a endpoints públics**: màxim 20 req/min per IP
- **Principle of least privilege**: cada rol té accés mínim necessari

### Interaccions
- Protegeix tots els endpoints que criden els altres agents
- Lliura dades d'usuari i sesión al **Frontend Agent**
- Registra totes les accions del **Report Engine** a l'audit log

---

## Agent 7 — QA / Auditor Agent

**Domini**: Testing, validació de models financers, compliance

### Responsabilitats
- **Tests unitaris**: totes les funcions financeres (`__tests__/quant/`)
- **Tests d'integració**: API routes amb dades reals
- **Validació de models**: Monte Carlo vs. solució analítica, backtest vs. dades reals
- **MiFID II compliance checklist**: verificar que el qüestionari cobreix tots els requisits
- **Performance tests**: temps de resposta API < 2s, bundle size < 500KB
- **Security audit**: OWASP Top 10 checkpoints
- Tests E2E (Playwright) per al flux principal de perfilació

### Fitxers propis
- `__tests__/` — tots els tests (nou directori a crear)
- `__tests__/quant/` — tests de models financers
- `__tests__/api/` — tests d'integració d'API
- `__tests__/e2e/` — tests end-to-end
- `docs/compliance/mifid-checklist.md` — checklist MiFID II (nou)

### Regles
- **Cap merge sense tests que passin**: CI bloqueja si tests fallen
- **Validació matemàtica obligatòria**: Monte Carlo P50 ≈ solució de Ito's lemma (±5%)
- **Cobertura mínima**: 80% de `lib/` (excepte fitxers de dades estàtiques)
- **Tests de regresió**: cada bug fix ha d'incloure un test que reprodueixi el bug

### Interaccions
- Audita el **Quant Engine** (validació matemàtica de mètriques)
- Audita el **Profiling Agent** (cobertura MiFID II del qüestionari)
- Audita el **Backend Agent** (seguretat d'endpoints, audit trail)
- Bloqueja deploys si els tests fallen (via CI/CD)

---

## Protocols d'interacció

### Flux principal (perfilació → recomanació → informe)
```
Usuari → Frontend Agent (formulari)
       → Backend Agent (API /api/portfolio, validació Zod)
       → Profiling Agent (scoring, suitability check)
       → Quant Engine (MPT optimization amb constraints del perfil)
       → Data Agent (preus, covariàncies, taxa lliure risc)
       → Report Engine (informe complet)
       → Frontend Agent (renderitzat) + Backend Agent (arxiu + email)
```

### Resolució de conflictes
- **Quant vs. Profiling**: si l'optimitzador suggereix una cartera incompatible amb el perfil (ex: massa risc per a un conservador), **Profiling Agent té precedència** — s'apliquen les constraints del perfil
- **Data vs. Quant**: si les dades no estan disponibles, el Quant Engine **no genera estimats inventats** — retorna error explícit que el Frontend mostra com "Dades no disponibles"
- **Security vs. qualsevol**: si una request no supera validació Zod o auth check, **mai es propaga** als altres agents — retorna 400/401/403 immediatament
