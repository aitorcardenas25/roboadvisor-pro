# Documentació de Models Financers — Factor OTC RoboAdvisor

> Document de referència per al TFG d'Enginyeria Financera.
> Cita totes les fonts originals per als models implementats.

---

## 1. Perfilació de l'inversor

### 1.1 Qüestionari psicoomètric

25 dimensions agrupades en 6 categories:

| Categoria | Dimensions | Pes |
|-----------|-----------|-----|
| Tolerància al risc | `riskTolerance`, `lossReaction`, `portfolioDropReaction`, `volatilityComfort`, `riskAffinityLong` | 30% |
| Horitzó i liquiditat | `investmentHorizon`, `liquidityReserve`, `emergencyFund` | 20% |
| Coneixement i experiència | `investmentKnowledge`, `tradingExperience` | 15% |
| Situació financera | `monthlyIncome`, `investable`, `savings`, `debtLevel` | 15% |
| Objectius | `investmentGoal`, `returnExpectation`, `capitalPreservation`, `incomeNeed` | 15% |
| ESG i factors psicogràfics | `esgPreference`, `newsReaction`, `occupation`, `dependents` | 5% |

Scoring: suma ponderada → [0, 100] → mapeig a 4 perfils:

| Rang | Perfil |
|------|--------|
| 0–25 | Conservador |
| 26–50 | Moderat |
| 51–75 | Dinàmic |
| 76–100 | Agressiu |

**Implementació**: `lib/scoring.ts`

---

## 2. CAPM — Capital Asset Pricing Model

> Font: Sharpe, W.F. (1964). "Capital Asset Prices: A Theory of Market Equilibrium under Conditions of Risk". *Journal of Finance*, 19(3), 425–442.

### Fórmula base

```
E(Rᵢ) = Rf + βᵢ × [E(Rm) - Rf]
```

### Paràmetres

| Paràmetre | Valor | Font |
|-----------|-------|------|
| `Rf` | ECB ESTR overnight, actualitzat 24h | ECB Data Portal API |
| `βᵢ` | Estimat per classe d'actiu (taula CAPM_BETAS) | Estimació basada en literatura |
| `E(Rm) - Rf` (ERP) | 5.3% | Damodaran, A. (2024). *Country Risk Premiums*, Spain |

### Betes per classe d'actiu

| Classe d'actiu | β estimada | Justificació |
|---------------|------------|-------------|
| `money-market` | 0.00 | Actiu lliure de risc |
| `gov-bonds-short` | 0.05 | Quasi-rf, sensibilitat tipus interès mínima |
| `gov-bonds-long` | 0.15 | Duration risc |
| `corp-bonds-ig` | 0.25 | Spread crèdit moderat |
| `corp-bonds-hy` | 0.50 | Alt spread crèdit |
| `equity-europe` | 0.90 | MSCI Europe β vs MSCI World ≈ 0.9 |
| `equity-us` | 1.10 | S&P 500 β > 1 en períodes recents |
| `equity-em` | 1.30 | Alta volatilitat, prima de mercat emergent |
| `real-assets` | 0.70 | REITs β ≈ 0.65–0.75 |
| `alternatives` | 0.40 | Hedge funds β baix per disseny |
| `crypto` | 2.50 | Alta correlació amb risc, β empírica |

**Implementació**: `lib/portfolioAdapter.ts` → `capmReturn()`

---

## 3. Markowitz Mean-Variance Optimization (MPT)

> Font: Markowitz, H. (1952). "Portfolio Selection". *Journal of Finance*, 7(1), 77–91.

### Problema d'optimització

```
min  σ²p = wᵀ Σ w
s.t. wᵀ μ = μ_target
     wᵀ 1 = 1
     w_min ≤ wᵢ ≤ w_max  ∀i
```

On:
- `w ∈ ℝⁿ`: vector de pesos de la cartera
- `Σ ∈ ℝⁿˣⁿ`: matriu de covariàncies entre actius
- `μ ∈ ℝⁿ`: vector de rendiments esperats (CAPM)
- Restriccions de pes: `[0.02, 0.40]` per actiu (diversificació mínima)

### Simplificació actual (heurística)

La implementació actual (`lib/portfolioAdapter.ts`) usa una aproximació heurística per perfil en lloc de l'optimitzador quadràtic complet. Els pesos s'ajusten iterativament per maximitzar el Sharpe ratio aproximat.

**Pendent per Fase 4**: optimitzador QP complet via `lib/optimization.ts`.

### Mètriques de cartera

```
μp = Σᵢ wᵢ × E(Rᵢ)              (rendiment esperat)
σ²p = wᵀ Σ w                      (variança)
Sharpe = (μp - Rf) / σp            (Sharpe 1966)
Sortino = (μp - Rf) / σ_downside   (Sortino & van der Meer 1994)
```

### Frontera eficient

50 punts calculats variant `μ_target` entre el mínim retorn possible i el màxim:

```typescript
// lib/portfolioAdapter.ts → computeFrontierData()
for μ_target in [μ_min, μ_max] (50 steps):
  solve MPT → get σ²p
  frontier.push({ return: μ_target, volatility: √σ²p, sharpe })
```

**Implementació**: `lib/portfolioAdapter.ts` → `optimizeFromProfile()`, `computeFrontierData()`

---

## 4. Monte Carlo — Geometric Brownian Motion

> Font: Black, F. & Scholes, M. (1973). "The Pricing of Options and Corporate Liabilities". *Journal of Political Economy*, 81(3), 637–654.
> GBM aplicat a carteres: Merton, R.C. (1969). "Lifetime Portfolio Selection under Uncertainty: The Continuous-Time Case".

### Model

```
dS = μS dt + σS dWt
```

Solució exacta per Lema de Itô:

```
S(T) = S(0) × exp((μ - σ²/2)T + σ√T × Z)
     on Z ~ N(0,1)
```

### Implementació discreta (mensual, T anys)

```typescript
// lib/monteCarlo.ts
for sim in 1..N:
  S[0] = initialInvestment
  for t in 1..T*12:
    Z ~ N(0,1)
    aportacio = monthlyContribution
    S[t] = S[t-1] × exp((μ/12 - σ²/24) + σ/√12 × Z) + aportacio
  store S[T*12]

percentils = [P10, P25, P50, P75, P90](simulations)
```

### Validació analítica

El P50 simulat ha de ser ≈ solució analítica (±5%):

```
P50_analytic = S(0) × exp((μ - σ²/2) × T) + aportació × [(exp(μT) - 1) / μ]
```

Test de convergència: `__tests__/quant/monteCarlo.test.ts`

**Implementació**: `lib/monteCarlo.ts`

---

## 5. Risk Analytics

> Font: Jorion, P. (2006). *Value at Risk: The New Benchmark for Managing Financial Risk* (3rd ed.).

### Ràtio de Sharpe

```
Sharpe = (E(Rp) - Rf) / σp
```

- Sharpe > 1: excel·lent
- Sharpe ≥ 0.5: acceptable
- Sharpe < 0.5: qüestionable

### Value at Risk (VaR)

**Mètode paramètric**:
```
VaR₉₅ = μp - 1.645 × σp
VaR₉₉ = μp - 2.326 × σp
```

**Mètode histèric**: percentil 5 (o 1) de la distribució de retorns reals.

### CVaR — Conditional Value at Risk (Expected Shortfall)

```
CVaR_α = E[Rp | Rp < VaR_α]
```

Sempre CVaR > VaR en valor absolut (cua de la distribució).

### Maximum Drawdown

```
MaxDD = max_{t} [max_{s≤t} P(s) - P(t)] / max_{s≤t} P(s)
```

### Calmar Ratio

```
Calmar = CAGR / |MaxDrawdown|
```

**Implementació**: `lib/metrics.ts`

---

## 6. Matriu de correlació

La correlació de Pearson entre actius `i` i `j`:

```
ρᵢⱼ = Cov(Rᵢ, Rⱼ) / (σᵢ × σⱼ)
```

Valors: ρ ∈ [-1, 1]
- ρ > 0.7: alta correlació (redueix diversificació)
- ρ < 0.2: baixa / diversificació bona
- ρ < 0: correlació negativa (cobertura natural)

La matriu de correlació usada és estàtica per perfil (dades empíriques estimades). En producció s'hauria de calcular des de sèries temporals reals via Supabase.

**Implementació**: `lib/portfolioAdapter.ts` → `getCorrelationData()`

---

## 7. MiFID II Suitability Assessment

> Font: Reglament Delegat (UE) 2017/565, Art. 54–55.

Per cada producte recomanat es comprova:

1. **Coherència amb objectiu**: perfil del client ↔ perfil del producte
2. **Tolerància al risc**: `riskTolerance` del client ≥ `riskLevel` del producte
3. **Horitzó**: `investmentHorizon` del client ≥ `minimumHorizon` del producte
4. **Coneixement**: `investmentKnowledge` del client adequat per a la complexitat del producte

Resultat: `suitable | review_required | not_suitable`

**Implementació**: `lib/suitability.ts` → `checkMiFIDSuitability()`
