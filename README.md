# Factor OTC — RoboAdvisor Pro

Plataforma d'assessorament financer automatitzat per a clients minoristes. Combina perfilació psicoomètrica (MiFID II), optimització de carteres per MPT, simulació Monte Carlo i generació d'informes professionals en PDF.

> **Doble propòsit**: producte fintech per a Factor OTC (Catalonia) + TFG d'Enginyeria Financera.

---

## Arquitectura

```
app/
  api/
    admin/              Endpoints d'administració (auth: admin)
      audit-log/        Audit trail — GET amb filtres
      clients/          Gestió d'usuaris — GET/POST/PATCH/DELETE
      funds/            Gestió de fons
      portfolios/       Gestió de carteres model
    health/             Health check — GET /api/health
    risk-free-rate/     Taxa BCE (cache 24h)
    report-registry/    Historial d'informes
  cartera/              Dashboard de carteres model (auth: authorized)
  admin/                Panell d'administració (auth: admin)
components/
  charts/               Recharts + EfficientFrontier + CorrelationHeatmap
  pdf/                  @react-pdf/renderer — informe 12 pàgines
  admin/                AdminDashboard, ClientsManager, AuditLogViewer, ...
lib/
  portfolioAdapter.ts   MPT optimizer + CAPM + frontera eficient
  metrics.ts            Sharpe, Sortino, VaR, CVaR, drawdown, rolling
  monteCarlo.ts         Simulació GBM (1000 runs, P10/P50/P90)
  scoring.ts            Qüestionari psicoomètric (25 dimensions, 4 perfils)
  suitability.ts        MiFID II suitability check (Art. 54)
  ips.ts                Investment Policy Statement generator (8 seccions)
  ecbApi.ts             Taxa lliure de risc BCE (API oficial)
  auditLog.ts           Audit trail en memòria (últims 1000 events)
  rateLimiter.ts        Rate limiting per IP (sliding window)
  schemas/index.ts      Zod schemas per totes les API routes
middleware.ts           Auth protection + routing (Edge Runtime)
```

---

## Stack tecnològic

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Llenguatge | TypeScript |
| UI | Tailwind CSS + Framer Motion |
| Gràfics | Recharts + Three.js + Lightweight Charts |
| PDF | @react-pdf/renderer |
| Auth | NextAuth.js (JWT, sessions 8h) |
| Validació | Zod 4 |
| Tests unitaris | Vitest 4 + @vitest/coverage-v8 |
| Tests E2E | Playwright |
| BD (opcional) | Supabase (PostgreSQL) — fallback in-memory |
| Email | Resend |
| Deploy | Vercel |

---

## Setup local

### Prerequisits

- Node.js 20+

### Instal·lació

```bash
git clone https://github.com/aitorcardenas25/roboadvisor-pro
cd roboadvisor-pro
npm install
```

### Variables d'entorn

```bash
cp .env.local.example .env.local
# editar .env.local amb els valors reals
```

| Variable | Obligatòria | Descripció |
|----------|-------------|-----------|
| `NEXTAUTH_SECRET` | ✅ | Mínim 32 caràcters. Genera: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | URL base. Ex: `http://localhost:3000` |
| `ADMIN_USERNAME` | ✅ | Usuari admin |
| `ADMIN_PASSWORD` | ✅ | Contrasenya admin |
| `ADMIN_EMAIL` | ✅ | Email admin |
| `FMP_API_KEY` | Recomanada | Financial Modeling Prep — dades de mercat reals |
| `RESEND_API_KEY` | Recomanada | Resend — enviament d'emails |
| `SUPABASE_URL` | Opcional | Supabase — persistència de dades |
| `SUPABASE_ANON_KEY` | Opcional | Supabase — clau anònima |

### Iniciar

```bash
npm run dev        # http://localhost:3000
```

---

## Tests

### Unitaris (Vitest)

```bash
npm test                   # executa tots
npm run test:coverage      # amb coverage HTML
```

> 254 tests, 18 test files, cobertura >80% de `lib/`.

### E2E (Playwright)

```bash
npx playwright install chromium   # una sola vegada
npm run test:e2e                  # headless
npm run test:e2e:ui               # UI mode interactiu
```

### Bundle analysis

```bash
npm run analyze    # obre report HTML del bundle (ANALYZE=true)
```

---

## CI/CD

`.github/workflows/ci.yml` s'executa en cada push/PR a `main`:

1. **Type check** — `tsc --noEmit`
2. **Unit tests** + coverage (Vitest)
3. **Build** — `next build`
4. **E2E tests** (Playwright, Chromium)
5. **Security audit** — `npm audit --audit-level=high`

Deploy automàtic a Vercel en merge a `main`.

---

## Models financers

### MPT — Markowitz Mean-Variance Optimization

```
min σ²p = wᵀΣw
s.t.  wᵀμ = μp,  wᵀ1 = 1,  0.02 ≤ wᵢ ≤ 0.40
```

Implementació: `lib/portfolioAdapter.ts` → `optimizeFromProfile(profile, rf)`

### CAPM — Capital Asset Pricing Model

```
E(Rᵢ) = Rf + βᵢ × (E(Rm) - Rf)
```

- `Rf`: taxa BCE en temps real (ECB API, cache 24h) via `lib/ecbApi.ts`
- `βᵢ`: estimat per classe d'actiu vs. MSCI World
- `ERP`: Damodaran Spain ERP 5.3% (referència 2024)

### Monte Carlo (GBM)

```
dS = μS dt + σS dW_t
```

Solució de Itô: `S(T) = S(0) × exp((μ - σ²/2)T + σW_T)`

Percentils: P10 (pessimista) / P50 (central) / P90 (optimista). 1000 trajectòries.

Documentació matemàtica completa: `docs/models/`

---

## Seguretat

| Mesura | Detall |
|--------|--------|
| Rate limiting | 20 req/min (públic), 5/min (reports), 10/min (auth) |
| CSP | Content-Security-Policy restrictiu |
| Headers | X-Frame-Options DENY, X-Content-Type-Options, HSTS |
| Middleware Edge | Protecció de `/cartera` i `/admin` |
| Zod | Validació de totes les API routes |
| Audit trail | Últims 1000 events (login, reports, canvis de rol) |

---

## Compliance MiFID II

- Suitability check per producte (Art. 54 Del. Reg. 2017/565): `lib/suitability.ts`
- IPS (Investment Policy Statement): `lib/ips.ts`
- Checklist complet: `docs/compliance/mifid-checklist.md`

> El sistema és informatiu. No executa ordres ni gestiona diners reals. Consultar `docs/compliance/` per als gaps regulatoris pendents.

---

## Rols d'usuari

| Rol | Accés |
|-----|-------|
| `public` | Pàgina pública, notícies, comparador |
| `newsletter` | + Rep newsletters |
| `authorized` | + Dashboard carteres, robo-advisor |
| `admin` | + Panell admin complet |
