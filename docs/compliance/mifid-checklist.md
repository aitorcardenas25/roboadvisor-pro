# MiFID II Suitability Checklist — Factor OTC RoboAdvisor

**Referència**: Directiva 2014/65/UE + Reglament Delegat (UE) 2017/565, Art. 54–55

---

## Art. 54(2) — Informació a recollir al client

| Requisit MiFID II | Camp al qüestionari | Implementació |
|-------------------|---------------------|---------------|
| Coneixements i experiència en mercats financers | `investmentKnowledge` (q5) | ✅ 4 nivells (cap / bàsic / mitjà / expert) |
| Experiència amb tipus d'instruments | `tradingExperience` (q6) | ✅ Mapejat a risc |
| Naturalesa, volum i freqüència de transaccions | — | ⚠️ Parcialment (freqüència implícita via perfil) |
| Nivell d'educació i professió | `occupation` (q4) | ✅ 5 categories professionals |
| Situació financera actual | `monthlyIncome`, `liquidityReserve` (q8, q9) | ✅ |
| Capacitat de suportar pèrdues | `riskTolerance` (q12) | ✅ 5 nivells |
| Horitzó temporal d'inversió | `investmentHorizon` (q13) | ✅ 5 bandes (< 1a → > 15a) |
| Objectius financers (ingressos / creixement / ESG) | `investmentGoal`, `esgPreference` (q14, q16) | ✅ |

---

## Art. 54(3) — Idoneïtat del producte

| Requisit | Implementació a `lib/suitability.ts` | Estat |
|----------|--------------------------------------|-------|
| Coherent amb objectius d'inversió | `checkMiFIDSuitability()` → `goal_alignment` | ✅ |
| Capacitat de suportar riscos | Comparar perfil vs. `riskLevel` del producte | ✅ |
| Coneixement suficient per entendre el risc | `investmentKnowledge` vs. complexitat | ✅ |
| Producte adequat per horitzó | `investmentHorizon` vs. `horizon` del producte | ✅ |

---

## Art. 54(4) — Informe d'idoneïtat

> El prestador de serveis d'inversió ha de proporcionar una declaració d'idoneïtat que especifiqui com la recomanació s'adapta a les preferències, objectius i característiques del client.

| Element | On apareix | Estat |
|---------|-----------|-------|
| Perfil del client | Secció 2 de l'informe PDF | ✅ |
| Justificació de la recomanació | Secció 3 + suitability per producte | ✅ |
| Advertències de productes inadequats | `SuitabilityReport.productChecks[].warnings` | ✅ |
| IPS (Investment Policy Statement) | Secció IPS al PDF (8 seccions) | ✅ |
| Disclaimer legal | Peu de l'informe | ✅ |

---

## Art. 54(5) — Actualització del perfil

| Requisit | Estat | Pendent |
|---------|-------|---------|
| Informar al client si el perfil ha canviat | ❌ | Notificació email quan el perfil canvi |
| Periodicitat de revisió | ❌ | Revisar qüestionari cada 12 mesos |

---

## Art. 54(7) — Advertència al client

> Si el producte no és idoni, advertir al client **explícitament** i obtenir confirmació.

- **Implementat**: la UI mostra un banner vermell/groc si hi ha productes inadequats al perfil
- **Pendent**: bloqueig de confirmació explícita (checkbox amb warning acceptat)

---

## Art. 55 — Know Your Customer (KYC)

| Requisit | Implementació | Estat |
|---------|--------------|-------|
| Identificació del client | Nom + email al qüestionari | ⚠️ (no verificació d'identitat formal) |
| Capacitat financera | `monthlyIncome` + `liquidityReserve` | ✅ |
| Categoria de client (minorista/professional) | Sempre `minorista` | ✅ (per defecte conservador) |
| Fonts d'ingressos | `occupation` + `monthlyIncome` | ✅ |

---

## Punts pendents (compliance gaps)

1. **Verificació d'identitat**: no hi ha ID check formal (DNI, passaport). Necessari per a clients reals.
2. **Actualització periòdica**: el sistema no demana revisió del qüestionari cada 12 mesos.
3. **Confirmació de warnings**: quan un producte és inadequat, no es requereix confirmació explícita del client.
4. **RGPD**: el qüestionari recull dades personals sensibles — caldria implementar:
   - Consentiment explícit (checkbox)
   - Política de privadesa accessible
   - Dret d'oblit (eliminació de dades)
5. **PRIIPs / KID**: no es genera document KID per a cada producte recomanat.
6. **Best execution**: no aplicable (el sistema no executa ordres, és informatiu).

---

## Disclaimer operatiu

> **IMPORTANT**: Factor OTC RoboAdvisor és un sistema d'informació i assessorament informatiu. **No gestiona diners reals, no executa ordres de compra/venda i no és un GFIA/SGIIC autoritzat per la CNMV.**
>
> Per operar com a empresa d'assessorament financer regulat a Espanya, s'hauria d'obtenir autorització CNMV com a *Empresa de Assessorament Financer Independent (EAFI)* o *Empresa de Serveis d'Inversió (ESI)*.
>
> Tots els informes generats inclouen el disclaimer: "La informació d'aquest informe té caràcter purament informatiu i no constitueix assessorament financer personalitzat ni oferta d'inversió."
