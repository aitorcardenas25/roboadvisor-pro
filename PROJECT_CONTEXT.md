# PROJECT_CONTEXT.md — RoboAdvisor Pro

## Què és aquest projecte

**RoboAdvisor Pro** és una plataforma d'assessorament financer automatitzat orientada a clients minoristes a Espanya (mercat principal: Catalunya). Combina:

- **Perfilació psicoomètrica de l'inversor** (25+ dimensions, 4 perfils: conservador → agressiu)
- **Construcció de carteres per MPT** (Markowitz Mean-Variance Optimization)
- **Pricing d'actius via CAPM** (rendiments esperats des del beta de mercat)
- **Simulació estocàstica** (Monte Carlo, 1000+ runs, percentils, ajust inflació)
- **Backtesting històric** (atribució per actiu, geografia, estil de gestió)
- **Anàlisi tècnica** (EMA, RSI, MACD, ATR, suport/resistència)
- **Generació d'informes professionals** (HTML 12 pàgines + PDF + email)

**Doble propòsit:**
1. TFG d'Enginyeria Financera / ADE — rigor acadèmic, metodologia formal, validació empírica
2. Producte fintech real — plataforma per a Factor OTC (assessors financers independents, Catalonia)

---

## Mercat i context

- **Client final**: inversor minorista català amb 500€–50.000€ d'estalvis mensuals
- **Intermediari**: Factor OTC (assessors financers independents, Catalonia)
- **Mercat objectiu**: Espanya (CNMV), amb visió d'expansió UE (ESMA)
- **Idioma principal**: català (ca-ES); suport secundari castellà i anglès
- **Competidors directes**: Indexa Capital, inbestMe, MyInvestor

---

## Marc regulatori

| Regulació | Aplicació | Estat |
|-----------|-----------|-------|
| **MiFID II** (Directiva 2014/65/UE) | Suitability assessment, cost disclosure, best execution | Parcial — necessita formalització |
| **MiFID II Delegated Reg. Art. 54** | Investor questionnaire adequacy | Implementat (25+ dimensions) |
| **SFDR** (Reg. 2019/2088) | Classificació sostenibilitat fons (Art. 6/8/9) | Dades presents a `products.ts` |
| **PRIIPs / KID** | Document d'informació clau per productes | Pendent |
| **CNMV Circular 3/2013** | Categoria de client (minorista/professional) | Pendent |
| **RGPD** | Protecció de dades personals del qüestionari | Pendent |

---

## Metodologia financera

### 1. Perfilació de l'inversor
- Qüestionari psicoomètric: demografia, objectius, tolerància al risc, coneixement, experiència, ESG
- Scoring: suma ponderada → 4 perfils (conservador / moderat / dinàmic / agressiu)
- Analyse de viabilitat: pot l'objectiu ser assolit? (alta / moderada / baixa / molt-baixa)

### 2. Construcció de carteres (OBJECTIU: substituir hardcoded per MPT real)
- **Actual**: allocació estàtica per regles heurístiques
- **Objectiu**: Markowitz Mean-Variance Optimization
  - Input: matriu de covariàncies, rendiments esperats (via CAPM), restriccions (pesos mín/màx, liquiditat, cost)
  - Output: carteres óptimes sobre la frontera eficient
- **Avançat (Fase 3)**: Black-Litterman per incorporar views del gestor

### 3. CAPM — Capital Asset Pricing Model
- `E(Ri) = Rf + βi × (E(Rm) - Rf)`
- `Rf`: taxa lliure de risc (ECB deposit rate, actualitzat setmanalment)
- `βi`: beta estimada des de regressió OLS sobre benchmark (MSCI World / IBEX35)
- `E(Rm)`: prima de risc histèrica del mercat (Damodaran database)

### 4. Risk Analytics
- **Sharpe ratio**: `(E(Rp) - Rf) / σp`
- **Sortino ratio**: usa downside deviation en lloc de σ total
- **Calmar ratio**: `CAGR / |max drawdown|`
- **VaR**: Value-at-Risk (95%, 99%) — paramètric i histèric
- **CVaR**: Expected Shortfall (cua de la distribució)
- **Correlació**: matriu Pearson entre actius

### 5. Monte Carlo
- Geometric Brownian Motion: `dS = μS dt + σS dW`
- 1000–5000 runs (configurable)
- Percentils: P10, P25, P50, P75, P90
- Ajust inflació: `real_value = nominal_value / (1 + inflation)^t`
- Probabilitats: P(retorn positiu), P(batre inflació), P(assolir objectiu)

### 6. Backtesting
- Rebalanceig mensual amb aportacions opcionals
- Benchmark compost (MSCI World + Bloomberg Agg)
- Atribució: per classe d'actiu, per geografia, per estil de gestió
- Mètriques: CAGR, volatilitat, Sharpe, Sortino, max drawdown, alpha, beta

---

## Fonts de dades

| Font | Ús | Límit | Prioritat |
|------|-----|-------|-----------|
| **FMP** (Financial Modeling Prep) | Fonamentals, preus histèrics | 250 req/dia (free) | 1r |
| **Alpha Vantage** | ETFs, macro, USA equities | 25 req/dia (free) | 2n |
| **Yahoo Finance** | Fallback general | Rate limit variable | 3r |
| **ECB API** | Tipus d'interès, tipus de canvi | Il·limitat (públic) | Tipus lliure risc |
| **Damodaran** | Prima de risc de mercat per país | Anual (web scrape) | Market risk premium |
| **BD pròpia** | Cache de preus, fonamentals, fons | Sense límit | Cache |

---

## Arquitectura tècnica

```
Frontend (Next.js 16, React 19, TypeScript)
    ↓ API routes (Next.js App Router)
Backend Logic (lib/, services/)
    ↓
Data Layer (PostgreSQL / Supabase)       ← PENDENT implementar
    ↓
External APIs (FMP, Alpha Vantage, Yahoo Finance, ECB)
```

**Stack complet:**
- Framework: Next.js 16.2.4 (App Router)
- UI: React 19, TailwindCSS, Recharts, Framer Motion, Three.js
- Auth: NextAuth 4 (credentials + JWT)
- Reports: @react-pdf/renderer, html-to-image, Resend
- Deploy: Vercel
- Python legacy: FastAPI + MongoDB (pendent integrar o migrar)

---

## Principis de disseny

1. **Rigor > Simplicitat**: si el model és correcte però complex, mantenir-lo correcte
2. **Dades reals > Simulades**: la simulació és fallback, mai primera opció
3. **Auditabilitat**: cada informe ha de ser traçable (ID, data, versió model, fonts de dades)
4. **MiFID II by design**: suitability assessment és part del flux, no un afegit
5. **Català primer**: idioma principal en tot: UI, informes, comentaris de codi
6. **Test-driven finances**: cap funció financera sense test unitari de validació

---

## Estat actual (maig 2026)

### Implementat
- Qüestionari de perfil complet (25+ dimensions)
- Carteres per perfil (heurística, 50+ fons amb ISIN, TER, benchmark)
- Monte Carlo (1000 runs, percentils, inflació)
- Backtest engine (CAGR, alpha/beta, atribució)
- Anàlisi tècnica (EMA/RSI/MACD/ATR, senyals)
- Informe HTML 12 pàgines + PDF + email
- Admin panel (portfolios, fons, notícies, newsletters, reports)
- Autenticació (NextAuth, rols admin/authorized)
- PWA, Three.js, Framer Motion

### Pendent (crític)
- Base de dades real (tot és in-memory ara)
- MPT / Markowitz optimization (carteres hardcoded ara)
- CAPM (rendiments esperats hardcoded ara)
- Tests unitaris i d'integració (zero cobertura ara)
- Rate limiting, audit trail, MiFID II formal
- Python server integration

---

## Glossari

| Terme | Definició |
|-------|-----------|
| **MPT** | Modern Portfolio Theory — Markowitz (1952) |
| **CAPM** | Capital Asset Pricing Model — Sharpe (1964) |
| **TER** | Total Expense Ratio — cost anual d'un fons |
| **Drawdown** | Pèrdua màxima des d'un pic fins a un mínim |
| **Alpha** | Rendiment en excés sobre el benchmark ajustat per beta |
| **Beta** | Sensibilitat del portafoli als moviments del mercat |
| **Sharpe** | Rendiment/risc = (E(R) - Rf) / σ |
| **Sortino** | Com Sharpe però amb downside deviation |
| **VaR** | Pèrdua màxima esperada en un horitzó i confiança |
| **CVaR** | Expected Shortfall — valor esperat de les pèrdues a la cua |
| **IPS** | Investment Policy Statement — document de política d'inversió |
| **Suitability** | MiFID II: idoneïtat del producte per al perfil del client |
| **SFDR** | Sustainable Finance Disclosure Regulation |
| **ISIN** | International Securities Identification Number |
| **Factor OTC** | Empresa d'assessorament financer independent (client d'aquest sistema) |
