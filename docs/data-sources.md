# Fonts de dades — FACTOR OTC

Registre complet de totes les APIs i serveis externs que utilitza la plataforma.

---

## Resum ràpid

| Font | Categoria | API Key | Ús principal |
|------|-----------|---------|--------------|
| Financial Modeling Prep | Dades de mercat | Sí (`FMP_API_KEY`) | Preu actual d'actius, historials, fonamentals |
| Alpha Vantage | Dades de mercat | Sí (`ALPHA_VANTAGE_API_KEY`) | Historial mensual (fallback FMP) |
| Yahoo Finance | Dades de mercat | No | Preus historials (2n fallback) |
| Banc Central Europeu | Dades de mercat | No | Taxa lliure de risc (€STR) |
| TradingView | Dades de mercat | No | Gràfics interactius |
| Frankfurter | Tipus de canvi | No | Conversió EUR/USD/GBP/CHF |
| Supabase | Persistència | Sí (`SUPABASE_SERVICE_ROLE_KEY`) | BD de carteres, clients, informes |
| Resend | Comunicació | Sí (`RESEND_API_KEY`) | Emails transaccionals |
| Stripe | Pagaments | Sí (`STRIPE_SECRET_KEY`) | Informe inicial, subscripcions |
| FACTOR OTC (intern) | Plataforma | — | Càlculs, PDF, perfilació MiFID II |

---

## Fonts de dades de mercat

### Financial Modeling Prep (FMP)
- **URL**: https://financialmodelingprep.com
- **API Key**: `FMP_API_KEY`
- **Obligatòria**: Recomanada per a producció
- **S'utilitza per**: Preu actual d'actius, historials diaris, quotes d'ETFs
- **Fallback si falla**: Alpha Vantage → Yahoo Finance → Dades simulades
- **Pla gratuït**: 250 req/dia a financialmodelingprep.com

### Alpha Vantage
- **URL**: https://alphavantage.co
- **API Key**: `ALPHA_VANTAGE_API_KEY`
- **Obligatòria**: Opcional (fallback de FMP)
- **S'utilitza per**: Historial mensual de preus si FMP no està disponible
- **Pla gratuït**: 500 req/dia a alphavantage.co/support/#api-key

### Yahoo Finance
- **URL**: https://finance.yahoo.com
- **API Key**: No en cal
- **Obligatòria**: No (s'activa automàticament com a 2n fallback)
- **S'utilitza per**: Preus i historials si FMP i Alpha Vantage fallen
- **Nota**: Font pública. Pot tenir limitacions de rate o bloqueigs temporals.

### Banc Central Europeu (ECB / €STR)
- **URL**: https://data-api.ecb.europa.eu
- **API Key**: No en cal
- **Obligatòria**: No (té fallback hardcoded al 3.0%)
- **S'utilitza per**: Taxa €STR (Euro Short-Term Rate) com a taxa lliure de risc per als càlculs de Sharpe Ratio i CAPM
- **Cache**: 24h (via Next.js `revalidate`)

### TradingView
- **URL**: https://tradingview.com
- **API Key**: No en cal
- **S'utilitza per**: Widgets de gràfics interactius incrustats per a accions, ETFs i fons d'inversió

---

## Tipus de canvi

### Frankfurter
- **URL**: https://api.frankfurter.app
- **API Key**: No en cal
- **Obligatòria**: No
- **S'utilitza per**: Conversió EUR/USD/GBP/CHF per mostrar actius en dòlars en euros
- **Limitació**: Actualitza diàriament (no temps real)
- **Nota**: API gratuïta, sense autenticació, mantenida per Claus Koch.

---

## Persistència

### Supabase
- **URL**: https://supabase.com
- **API Key**: `SUPABASE_SERVICE_ROLE_KEY` (mai exposar al client)
- **URL del projecte**: `SUPABASE_URL`
- **Obligatòria**: Recomanada per a producció
- **S'emmagatzema**: Leads, clients (usuaris), carteres de clients, holdings, transaccions, snapshots, notes d'assessor, informes mensuals, historial d'auditoria
- **Mode dev (sense Supabase)**: Tot funciona en memòria. Les dades es perden en reiniciar.
- **Setup**: Executa `db/schema.sql` al SQL editor de Supabase per crear les taules

---

## Comunicació

### Resend
- **URL**: https://resend.com
- **API Key**: `RESEND_API_KEY` (format: `re_xxxx...`)
- **Obligatòria**: Recomanada per a producció
- **S'utilitza per**:
  - Notificació de lead nou a l'admin
  - Email de benvinguda al client
  - Avís d'informe mensual disponible
  - Confirmació de sol·licitud d'accés
- **Mode dev (sense Resend)**: Els emails es registren per consola però no s'envien
- **Remitent**: Configura `FROM_EMAIL` amb un domini verificat a Resend

---

## Pagaments

### Stripe
- **URL**: https://stripe.com
- **API Key**: `STRIPE_SECRET_KEY` (sk_test_... per dev, sk_live_... per producció)
- **Variables addicionals**: `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_INITIAL_REPORT`, `STRIPE_PRICE_MONTHLY_SUB`
- **Obligatòria**: Opcional (el checkout retorna 503 si no està configurat)
- **S'utilitza per**: Informe inicial (pagament únic), subscripció mensual
- **Webhooks**: Escolta `checkout.session.completed` i `customer.subscription.deleted`

---

## Plataforma interna

### FACTOR OTC (càlculs interns)
- **S'utilitza per**:
  - Càlcul de rendibilitat i P&L de la cartera
  - Distribució per actiu i categoria
  - Generació de PDFs d'informes
  - Model de perfilació inversora (MiFID II)
  - Mètriques de risc: Sharpe Ratio, Sortino, VaR
  - Preu de compra i quantitats introduïts per l'assessor

---

## Cadena de fallback per a preus

```
Petició de preu d'un actiu
    ↓
1. Financial Modeling Prep (FMP)
    ↓ si falla o no té API key
2. Alpha Vantage
    ↓ si falla o no té API key
3. Yahoo Finance (via /api/market-data intern)
    ↓ si falla
4. Dades simulades [AVÍS visible a la UI]
```

**Regla crítica**: Si cap font retorna dades reals, el preu es marca com `pending` (pendent) i es mostra a l'assessor per actualitzar-lo manualment. Mai s'inventa un preu.

---

## Gestió d'errors

| Situació | Comportament |
|----------|--------------|
| FMP no configurat | Preu marcat com `pending`, badge "Pendent" visible |
| Yahoo Finance bloquejat | Fallback a simulació amb avís |
| ECB no respon | Usa taxa hardcoded 3.0%, audit log ho registra |
| Frankfurter no respon | Mostra preu en divisa original sense conversió |
| Supabase no configurat | Mode in-memory, avís a /admin > Integracions |
| Resend no configurat | Emails per consola, sense enviament real |
| Stripe no configurat | Checkout retorna 503 |

---

## Visualització al client

El client pot veure l'origen de cada dada a `/client/cartera` → botó **"Fonts de dades"** a la barra superior.

Cada posició mostra:
- Badge de la font del preu (`FMP`, `OTC` per manual, `Pendent`)
- Temps des de l'última actualització

---

## Verificació de l'estat de les APIs

L'administrador pot veure l'estat de totes les integracions a:
`/admin` → **Integracions**

Mostra: estat en temps real, latència, clau enmascarada, on s'utilitza cadascuna, i instruccions per configurar.

---

## APIs analitzades i descartades

| API | Motiu del descart |
|-----|-------------------|
| Trade Republic | No és API pública. FACTOR OTC no és broker. |
| OpenFIGI | PRODUCT_TICKERS ja cobreix la conversió ISIN→ticker. Útil al futur si s'afegeixen actius arbitraris. |
| CoinGecko | FACTOR OTC és advisor de fons/ETFs europeus, no crypto-first. Opció futura. |
| Finnhub | Redundant amb FMP. |
| SEC EDGAR | Fora de focus: FACTOR OTC gestiona fons europeus. |
| Wikipedia | Útil per descripcions d'actius, però no prioritari per un assessor professional. |
