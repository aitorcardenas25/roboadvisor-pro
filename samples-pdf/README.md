# Mostres de PDF — RoboAdvisor Pro / Factor OTC

Generades per `scripts/generate-sample-pdfs.ts` (`npx tsx scripts/generate-sample-pdfs.ts`).

Totes les mostres fan servir **un sol client fictici**: **Marta Solà Puig**
(`marta.sola.demo@example.com`), 41 anys, perfil **Agressiu** (73% — calculat
pel motor de scoring real de l'app a partir d'un qüestionari fictici, no
assignat a mà), amb una cartera de **9 posicions**: 2 accions IBEX 35
(Inditex, Iberdrola), 3 accions internacionals (Apple, Microsoft, ASML), 3
ETFs UCITS (iShares Core MSCI World, Vanguard FTSE All-World, iShares MSCI
EM) i 1 fons actiu (Fidelity Global Technology, classe A-USD). 3 de les 9
posicions estan denominades en USD. Els pesos sumen 100%. Cap dada prové de
cap API externa — tot és sintètic.

No s'ha modificat cap fitxer de l'aplicació. El script només **importa**
les funcions/components reals de `lib/` i `components/pdf/` i els alimenta
amb aquestes dades fictícies.

---

## 01 — Informe Financer Personalitzat
**Fitxer:** `components/pdf/FactorOTCReport.tsx` + `lib/report.ts` (react-pdf)
**Estat:** ✅ Complet — 13 pàgines

L'informe principal que es genera al final del qüestionari de perfilació:
perfil MiFID, diagnòstic financer, cartera recomanada (via `buildPortfolio()`,
que selecciona fons de `lib/products.ts` segons el perfil — **no** la cartera
de 9 actius manual), IPS, suitability, mètriques i Monte Carlo (1.000
simulacions).

**Què li falta / és provisional:**
- **Els gràfics no s'han capturat.** A l'app, els 10 gràfics (allocation,
  radar, evolució, Monte Carlo, frontera eficient, heatmap...) es capturen
  amb `html-to-image` sobre components Recharts reals renderitzats al DOM
  (`components/pdf/HiddenCharts.tsx` + `ChartCapture.tsx`). Un script Node
  pur no té aquest DOM, així que s'ha passat `charts={}` — el component ja
  preveu aquest cas nativament i mostra una caixa "Gràfic no disponible" en
  lloc de trencar-se. Per obtenir els gràfics caldria fer-ho des d'un
  navegador real (p. ex. Playwright navegant l'app en marxa amb sessió
  autenticada), fora de l'abast d'aquest script.
- La cartera d'aquest informe és la **recomanada pel motor** (Markowitz/
  perfil), diferent de la cartera manual de 9 actius usada als informes 02,
  03 i 05 — són conceptualment coses diferents ("què et proposaria l'app"
  vs. "cartera que ja té el client").

---

## 02 — Informe Manual (admin) — versió react-pdf
**Fitxer:** `components/pdf/ManualReportPDF.tsx`
**Estat:** ✅ Complet — 13 pàgines

Mateix tipus de contingut que el 01 però amb la cartera manual construïda
per l'admin (els 9 actius). Tots els gràfics són SVG generats en codi
(donut, radar, frontera eficient, corbes) — no depenen de cap captura de
DOM, per això surt complet i sense cap element "no disponible". Peu de
pàgina amb numeració dinàmica ("N / 13") calculada per react-pdf, sense
sorpreses.

---

## 03 — Informe Manual (admin) — versió HTML
**Fitxer:** `lib/manualReport.ts` (`generateManualReport()`) → HTML+CSS,
convertit a PDF amb Playwright/Chromium des del script (l'app mai fa
aquesta conversió; serveix l'HTML tal qual via `app/api/admin/manual-report/route.ts`
perquè l'usuari l'obri/imprimeixi al navegador).
**Estat:** ✅ Complet — 13 pàgines físiques (dissenyat per a 11)

Mateixes dades que el 02 (`ManualPortfolioInput`), però és **una plantilla
completament diferent i duplicada**: mateix contingut conceptual, disseny
visual diferent (l'HTML fa servir SVGs propis per al donut/Monte Carlo/
evolució en lloc dels de `ManualReportPDF.tsx`). Es genera en paral·lel des
del mateix formulari (`ManualReportBuilder.tsx`), però **el botó que prem
l'usuari només descarrega la versió 02**; aquesta es desa a l'arxiu via
`saveReport()` i mai s'ha vist convertida a PDF binari dins l'app.

**Observació detectada (no és un bug introduït per aquest script):** el peu
de pàgina de la plantilla HTML porta el total de pàgines **fix** al codi
(`` `${pageN} / 11` ``), en comptes de calcular-lo dinàmicament. Amb 9 actius
a la cartera (en lloc dels 4-5 amb què segurament es va dissenyar), dues
seccions ("Composició detallada" i "Justificació per actiu") desborden el
seu bloc de 1180px i s'escampen a una pàgina física addicional cada una —
per això el PDF té 13 pàgines reals però el peu segueix dient "／11" i, a
les pàgines desbordades, el número de pàgina mostrat deixa de coincidir amb
la posició real. És un comportament de la plantilla mateixa (passaria igual
imprimint des del navegador amb aquesta quantitat d'actius), no de la
conversió amb Playwright.

---

## 04 — Informe Bursàtil (anàlisi d'acció)
**Fitxer:** `lib/stockReport.ts` (`generateStockReport()`) → HTML+CSS,
convertit a PDF amb Playwright/Chromium des del script (l'app serveix
l'HTML tal qual via `app/api/stock-analysis/route.ts`).
**Estat:** ✅ Complet — 16 pàgines físiques (dissenyat per a 13)

Fitxa d'anàlisi bursàtil per a **ITX.MC (Inditex)** — es reutilitza el
mateix ticker que ja forma part de la cartera de 9 actius, per mantenir
l'univers fictici coherent. **Totes les dades (preu, fonamentals, EPS,
earnings, consens d'analistes...) són sintètiques i fabricades a mà**; el
script no ha trucat mai a Yahoo Finance. Igual que a l'informe 03, algunes
seccions ("Anàlisi Fonamental" i "Valoració") desborden el seu bloc de
1180px i generen pàgines físiques addicionals amb el mateix desajust de
numeració al peu.

**Observació sobre el propi càlcul de l'app (no del script):** la valoració
per suma de parts (SOTP) de la Secció 8 dona un valor implícit molt per
sobre del preu de mercat (~€267 vs. preu real ~€49) per a aquest ticker. La
fórmula de `lib/stockReport.ts` aplica múltiples EBIT genèrics (18×/32×)
pensats per a negocis de programari/marges alts; per a un ticker de retail
com Inditex (marges més ajustats) el resultat surt clarament esbiaixat a
l'alça. És una limitació del model heurístic de l'app per a sectors no
tecnològics, visible amb qualsevol ticker real d'aquest tipus — es reporta
aquí perquè s'ha observat generant la mostra, no és un error del script.

També cal tenir en compte que la còpia de `app/informe-bursatil/page.tsx`
promet un "gràfic TradingView interactiu": el HTML generat per
`generateStockReport()` **no inclou cap `<iframe>` de TradingView** (hi ha
una funció `getTvSymbol()` definida però mai usada al document), així que
aquest PDF no en té ni li'n falta cap — és fidel al que realment genera la
funció.

---

## 05 — Informe Mensual de Cartera
**Font de dades:** `lib/portfolioReport.ts` (`generateMonthlyReportData()`)
sobre la mateixa cartera manual de 9 actius, amb 3 anys d'històric sintètic
de preus i 37 aportacions (1 inicial + 36 mensuals de 750€) generades pel
script.
**Estat:** ⚠️ A mitges com a "PDF" — reconstrucció aproximada, 1 pàgina

Aquest és l'únic informe de l'app **sense cap fitxer de plantilla ni funció
que retorni HTML o PDF**. A `components/admin/MonthlyReportGenerator.tsx`
es genera com a JSX+Tailwind en viu, i l'usuari l'obté prement "Imprimir /
PDF", que crida `window.print()` del navegador (la variant `print:` de les
classes Tailwind hi és pensada exactament per a això).

Com que no hi ha cap funció per cridar des d'un script Node, **aquest PDF és
una reconstrucció feta a mà dins del propi script** (`renderMonthlyReportHtml()`
a `scripts/generate-sample-pdfs.ts`), no una crida a codi de l'app. Replica
l'estructura visual de la variant impresa (capçalera, 4 KPIs, llista de
posicions principals amb barra de pes i P&L, comentaris de l'assessor,
disclaimer) però amb CSS propi, no amb les classes Tailwind reals — els
espaiats, tipografies exactes i colors poden variar lleugerament respecte
al que veuria un usuari fent print des del navegador. Les xifres (valor
actual, aportació neta, rendiment, posicions) sí que provenen de la funció
real `generateMonthlyReportData()` + `computeMetrics()`.

**3 anys de rendiment simulat:** la cartera va patir una correcció del
mercat simulada als mesos 14-16 (de 36) i una recuperació posterior — es
pot veure a les xifres de P&L per posició, que no són totes iguals de
positives (p. ex. el fons Fidelity Global Technology surt en negatiu,
Iberdrola gairebé pla) tot i que el conjunt de la cartera acaba en
rendiment positiu net.

**No trobat / fora d'abast:** "Stock Reports" (`lib/stockReports.ts` +
`components/admin/StockReportsManager.tsx`) és un CRUD de fitxes curtes de
rating (compra/mantenir/evitar) a base de dades — no genera cap HTML ni PDF
enlloc de l'app, per això no se n'ha generat cap mostra.

---

## Resum ràpid

| # | Informe | Font | Estat | Pàgines |
|---|---|---|---|---|
| 01 | Informe Financer Personalitzat | `components/pdf/FactorOTCReport.tsx` | ✅ complet (sense gràfics capturats) | 13 |
| 02 | Informe Manual — react-pdf | `components/pdf/ManualReportPDF.tsx` | ✅ complet | 13 |
| 03 | Informe Manual — HTML | `lib/manualReport.ts` | ✅ complet (plantilla duplicada de la 02) | 13 (disseny: 11) |
| 04 | Informe Bursàtil | `lib/stockReport.ts` | ✅ complet (dades 100% sintètiques) | 16 (disseny: 13) |
| 05 | Informe Mensual de Cartera | `lib/portfolioReport.ts` + reconstrucció pròpia | ⚠️ aproximat (sense plantilla a l'app) | 1 |
