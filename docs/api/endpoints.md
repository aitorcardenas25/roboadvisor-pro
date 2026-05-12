# API Endpoints — Factor OTC RoboAdvisor

Base URL: `https://roboadvisor-pro.vercel.app` (prod) | `http://localhost:3000` (dev)

Autenticació: NextAuth JWT via cookie `next-auth.session-token`. Indica `🔒` si cal sessió activa.

---

## Salut del sistema

### `GET /api/health`

Retorna l'estat del servei i de les dependències externes.

**Resposta 200 / 503**
```json
{
  "status": "ok | degraded | error",
  "timestamp": "2026-05-11T09:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600.5,
  "checks": {
    "ecb":  { "status": "ok", "latencyMs": 120 },
    "db":   { "status": "in-memory" }
  }
}
```

---

## Mercat i dades

### `GET /api/risk-free-rate`

Taxa lliure de risc ECB (ESTR overnight). Cache de 24h.

**Resposta 200**
```json
{ "rate": 3.91, "source": "ecb-api", "fetchedAt": "2026-05-11T06:00:00Z" }
```

---

### `GET /api/fons`

Llista de fons d'inversió registrats.

**Resposta 200**
```json
{ "funds": [...], "stats": { "total": 42, "active": 38, "avgTER": 0.72, "byRisk": [...] } }
```

---

### `GET /api/portfolios`

Carteres model actives. 🔒 Rol: `authorized` o `admin`.

**Resposta 200**
```json
{ "portfolios": [...] }
```

---

### `GET /api/market-data?symbol=MSFT`

Dades de mercat per ticker (preu, variació, volum).

**Query params**
| Param | Descripció |
|-------|-----------|
| `symbol` | Ticker ex: `AAPL`, `SAN.MC` |

---

### `GET /api/analysis?symbol=MSFT`

Anàlisi tècnica completa (EMA, RSI, MACD, ATR, senyals) + fonamentals.

---

## Newsletter

### `POST /api/newsletter/subscribe`

Subscripció a la newsletter. Rate limit: 20 req/min per IP.

**Body**
```json
{ "email": "joan@exemple.com", "name": "Joan Garcia" }
```

**Respostes**
| Codi | Situació |
|------|---------|
| 200 | Subscripció confirmada |
| 409 | Email ja subscrit |
| 422 | Validació Zod fallida |
| 429 | Rate limit superat |

---

## Informes

### `GET /api/report-registry` 🔒 Admin

Historial d'informes generats.

---

### `POST /api/report-registry` 🔒 Authorized

Guardar un informe al registre. Rate limit: 5 req/min per IP.

**Body** (SaveReportSchema)
```json
{
  "clientName":    "Joan Garcia",
  "clientEmail":   "joan@exemple.com",
  "profile":       "moderat",
  "score":         72,
  "monthlyAmount": 500,
  "investable":    10000,
  "horizon":       10,
  "portfolio":     ["iShares MSCI World", "PIMCO"],
  "pdfGenerated":  true,
  "emailSent":     false
}
```

---

### `POST /api/send-report` 🔒 Authorized

Envia l'informe per email via Resend.

---

## Admin — Carteres model

### `GET /api/admin/portfolios` 🔒 Admin

Totes les carteres (actives + draft + arxivades).

### `POST /api/admin/portfolios` 🔒 Admin

Crear nova cartera model. Body: `CreatePortfolioSchema`.

### `PATCH /api/admin/portfolios` 🔒 Admin

Actualitzar cartera. Body: `UpdatePortfolioSchema` + `{ id }`.

### `DELETE /api/admin/portfolios?id=<id>` 🔒 Admin

Eliminar cartera per ID.

---

## Admin — Clients

### `GET /api/admin/clients` 🔒 Admin

Llista de tots els usuaris (contrasenyes censurades: `***`).

**Resposta 200**
```json
{
  "users": [
    { "id": "1", "username": "admin", "name": "Admin", "email": "...", "role": "admin", "active": true, "createdAt": "2024-01-01" }
  ]
}
```

### `POST /api/admin/clients` 🔒 Admin

Crear nou client. Rate limit: 60 req/min.

**Body**
```json
{ "username": "joan", "password": "segur123!", "name": "Joan Garcia", "email": "joan@exemple.com", "role": "authorized" }
```

### `PATCH /api/admin/clients` 🔒 Admin

Canviar rol d'un usuari.

**Body**
```json
{ "id": "user-123", "role": "newsletter" }
```

### `DELETE /api/admin/clients` 🔒 Admin

Desactivar usuari (no elimina permanentment).

**Body**
```json
{ "id": "user-123" }
```

---

## Admin — Audit Trail

### `GET /api/admin/audit-log` 🔒 Admin

**Query params**
| Param | Descripció |
|-------|-----------|
| `limit` | Màx registres (default 100, màx 500) |
| `action` | Filtrar per acció ex: `auth.login`, `report.generated` |
| `userId` | Filtrar per usuari |
| `since` | ISO 8601 — des de data |
| `search` | Cerca de text lliure |

**Resposta 200**
```json
{
  "entries": [
    {
      "id": "aud-xxx",
      "timestamp": "2026-05-11T09:15:00Z",
      "action": "report.generated",
      "userId": "1",
      "userEmail": "admin@factorotc.com",
      "resource": "rep-abc123",
      "metadata": { "profile": "moderat", "clientEmail": "joan@exemple.com" },
      "ip": "192.168.1.1"
    }
  ],
  "stats": {
    "total": 42,
    "byAction": { "auth.login": 15, "report.generated": 8, "client.created": 3 }
  }
}
```

---

## Backtest

### `POST /api/backtest` 🔒 Authorized

Backtest d'una cartera personalitzada. Body: `BacktestSchema`.

---

## Codis d'error comuns

| Codi | Causa |
|------|-------|
| 400 | Body mal format o camps obligatoris absents |
| 401 | No autenticat |
| 403 | Rol insuficient |
| 404 | Recurs no trobat |
| 409 | Conflicte (ex: email ja subscrit) |
| 422 | Validació Zod fallida (inclou detalls dels errors) |
| 429 | Rate limit superat (`Retry-After` header indica quan reintentar) |
| 500 | Error intern del servidor |
| 503 | Servei no disponible (health check degraded) |
