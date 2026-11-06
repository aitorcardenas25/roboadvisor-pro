// scripts/generate-sample-pdfs.ts
//
// Script independent que genera UNA MOSTRA de cada tipus d'informe/PDF que
// l'aplicació pot produir, amb un client fictici i dades sintètiques però
// realistes. No modifica cap codi de l'app ni crida cap API externa — tota
// la generació passa per les mateixes funcions de lib/ i components/pdf/
// que fa servir l'aplicació real.
//
// Ús:  npx tsx scripts/generate-sample-pdfs.ts
//
// Sortida: /samples-pdf/*.pdf (vegeu samples-pdf/README.md per al detall
// de cada fitxer, què el genera i què li falta).

import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToFile } from '@react-pdf/renderer';

// Els components retornen <Document>, però el tipus de React.createElement no ho reflecteix.
type PdfElement = Parameters<typeof renderToFile>[0];
import { chromium } from '@playwright/test';

import { FactorOTCReport } from '../components/pdf/FactorOTCReport';
import { ManualReportPDF } from '../components/pdf/ManualReportPDF';
import { generateManualReport, type ManualPortfolioInput, type ManualAsset } from '../lib/manualReport';
import { generateStockReport, type StockReportData } from '../lib/stockReport';
import { generateReport } from '../lib/report';
import { buildPortfolio } from '../lib/portfolio';
import { calculateScore, type InvestorQuestionnaire } from '../lib/scoring';
import { calculatePortfolioMetrics, generateSimulatedHistoricalData } from '../lib/metrics';
import { runMonteCarlo } from '../lib/monteCarlo';
import { generateMonthlyReportData, type MonthlyReportData } from '../lib/portfolioReport';
import type { ClientPortfolio, ClientHolding, ClientTransaction } from '../lib/clientPortfolios';

const OUT_DIR = path.resolve(__dirname, '../samples-pdf');
fs.mkdirSync(OUT_DIR, { recursive: true });

function log(msg: string) {
  console.log(`▸ ${msg}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. CLIENT FICTICI I CARTERA COMPARTIDA (9 posicions)
// ═══════════════════════════════════════════════════════════════════════════

const CLIENT = {
  name:  'Marta Solà Puig',
  email: 'marta.sola.demo@example.com',
};

// Qüestionari de perfilació — dades pensades perquè no disparin cap warning
// de validateQuestionnaire() i produeixin un perfil coherent (dinàmic/moderat
// segons l'scoring real de l'app).
const questionnaire: InvestorQuestionnaire = {
  clientName:  CLIENT.name,
  clientEmail: CLIENT.email,

  age:             41,
  annualIncome:    68000,
  monthlyExpenses: 2600,
  currentSavings:  145000,
  netWorth:        210000,
  totalDebt:       85000, // hipoteca

  financialGoal:       'creixement-alt',
  investmentHorizon:   15,
  targetAmount:        350000,
  initialInvestment:   40000,
  monthlyContribution: 750,
  percentageToInvest:  55,

  financialKnowledge:   'avançat',
  investmentExperience: '3-5-anys',

  lossTolerance:       'fins-20',
  reactionToDrops:     'no-fer-res',
  worstAcceptableLoss: 18,

  esgPreference: 'preferible',
  liquidityNeed: 'potser-3-anys',

  incomeStability:  'estable',
  crisisExperience: 'vaig-aguantar',
};

// Cartera manual de 9 posicions: accions IBEX + internacionals, ETFs UCITS
// i un fons actiu, amb 3 posicions en USD (AAPL, MSFT, fons Fidelity A-USD).
// Pesos sumen 100.
const PORTFOLIO_ASSETS: ManualAsset[] = [
  {
    name: 'Inditex, S.A.',
    isin: 'ES0148396007',
    ticker: 'ITX.MC',
    weight: 12,
    category: 'Renda Variable — Accions Espanya (IBEX 35)',
    risk: 5,
    ter: 0,
    platform: 'Trade Republic',
    justification: 'Líder global en moda ràpida amb marges rècord i posició de caixa neta positiva; exposició internacional creixent fora d\'Espanya.',
    historicalReturn5Y: 14.2,
    historicalVolatility: 24.5,
  },
  {
    name: 'Iberdrola, S.A.',
    isin: 'ES0144580Y14',
    ticker: 'IBE.MC',
    weight: 9,
    category: 'Renda Variable — Accions Espanya (IBEX 35)',
    risk: 4,
    ter: 0,
    platform: 'Trade Republic',
    justification: 'Exposició a la transició energètica amb ingressos regulats que aporten estabilitat i dividend recurrent.',
    historicalReturn5Y: 9.8,
    historicalVolatility: 19.0,
  },
  {
    name: 'Apple Inc. (USD)',
    isin: 'US0378331005',
    ticker: 'AAPL',
    weight: 14,
    category: 'Renda Variable — Accions EUA',
    risk: 5,
    ter: 0,
    platform: 'Trade Republic',
    justification: 'Ecosistema de productes i serveis amb alta fidelització de client i generació de flux de caixa lliure molt elevada.',
    historicalReturn5Y: 18.6,
    historicalVolatility: 27.3,
  },
  {
    name: 'Microsoft Corporation (USD)',
    isin: 'US5949181045',
    ticker: 'MSFT',
    weight: 13,
    category: 'Renda Variable — Accions EUA',
    risk: 4,
    ter: 0,
    platform: 'Trade Republic',
    justification: 'Posicionament dominant en cloud (Azure) i intel·ligència artificial empresarial, amb ingressos recurrents per subscripció.',
    historicalReturn5Y: 20.1,
    historicalVolatility: 25.8,
  },
  {
    name: 'ASML Holding N.V.',
    isin: 'NL0010273215',
    ticker: 'ASML',
    weight: 8,
    category: 'Renda Variable — Accions Europa',
    risk: 5,
    ter: 0,
    platform: 'MyInvestor',
    justification: 'Monopoli de facto en litografia EUV, component crític i insubstituïble de la cadena de subministrament de semiconductors.',
    historicalReturn5Y: 16.4,
    historicalVolatility: 31.2,
  },
  {
    name: 'iShares Core MSCI World UCITS ETF (Acc)',
    isin: 'IE00B4L5Y983',
    ticker: 'IWDA',
    weight: 16,
    category: 'ETF UCITS — Renda Variable Global',
    risk: 4,
    ter: 0.20,
    platform: 'MyInvestor',
    justification: 'Nucli diversificat de més de 1.400 accions de mercats desenvolupats; baix cost i rèplica física completa.',
    historicalReturn5Y: 12.9,
    historicalVolatility: 15.8,
  },
  {
    name: 'Vanguard FTSE All-World UCITS ETF (Acc)',
    isin: 'IE00BK5BQT80',
    ticker: 'VWCE',
    weight: 12,
    category: 'ETF UCITS — Renda Variable Global',
    risk: 4,
    ter: 0.22,
    platform: 'MyInvestor',
    justification: 'Amplia la diversificació del nucli global incorporant mercats emergents amb un únic instrument de baix cost.',
    historicalReturn5Y: 12.1,
    historicalVolatility: 16.4,
  },
  {
    name: 'iShares MSCI EM UCITS ETF',
    isin: 'IE00BKM4GZ66',
    ticker: 'EIMI',
    weight: 8,
    category: 'ETF UCITS — Renda Variable Emergents',
    risk: 5,
    ter: 0.18,
    platform: 'MyInvestor',
    justification: 'Sobreponderació tàctica a mercats emergents per capturar creixement demogràfic i valoracions relatives més atractives.',
    historicalReturn5Y: 6.8,
    historicalVolatility: 20.6,
  },
  {
    name: 'Fidelity Funds — Global Technology Fund A-USD',
    isin: 'LU0261948904',
    ticker: 'FID-GLTEC',
    weight: 8,
    category: 'Fons Actiu — Renda Variable Tecnologia (USD)',
    risk: 6,
    ter: 1.85,
    platform: 'MyInvestor',
    justification: 'Gestió activa especialitzada en tecnologia amb selecció bottom-up de guanyadors estructurals en IA, semiconductors i software.',
    historicalReturn5Y: 17.5,
    historicalVolatility: 26.9,
  },
];

const totalWeight = PORTFOLIO_ASSETS.reduce((s, a) => s + a.weight, 0);
if (totalWeight !== 100) throw new Error(`Els pesos de la cartera sumen ${totalWeight}, no 100.`);

const ADMIN_NOTE =
  'Cartera dissenyada per a un perfil agressiu amb horitzó llarg (15 anys) i alta tolerància a la ' +
  'volatilitat de curt termini. Revisió de rebalanceig recomanada anualment o si algun actiu supera ' +
  '±10 punts percentuals del pes objectiu.';

const manualPortfolioInput: ManualPortfolioInput = {
  clientName:      CLIENT.name,
  clientEmail:     CLIENT.email,
  investorProfile: 'agressiu', // coincideix amb el perfil que calculateScore() dona per a `questionnaire` (vegeu genFactorOTCReport)
  objective:       'Creixement a llarg termini',
  horizon:         15,
  initialAmount:   40000,
  monthlyAmount:   750,
  assets:          PORTFOLIO_ASSETS,
  adminNote:       ADMIN_NOTE,
  monthlyIncome:   5667,
  monthlyExpenses: 2600,
  deutes:          85000,
  patrimoni:       210000,
  fondEmergencia:  18000,
  objectiuAmount:  350000,
};

const generatedAtLabel = new Date().toLocaleDateString('ca-ES', {
  day: '2-digit', month: 'long', year: 'numeric',
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. HISTÒRIC SINTÈTIC DE 3 ANYS (preus mensuals + aportacions) — reutilitzat
//    per a l'Informe Manual (valors de referència) i per a l'Informe Mensual
//    de Cartera (holdings + transaccions reals de la cartera del client).
// ═══════════════════════════════════════════════════════════════════════════

const MONTHS = 36; // 3 anys d'aportacions mensuals

function boxMuller(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Camí de mercat compartit: uns primers mesos alcistes suaus, una correcció
// clara entre els mesos 14-16 (~-18% acumulat per als actius més sensibles)
// i una recuperació + nou impuls fins al final — per tenir "pujades i
// baixades realistes" en lloc d'un simple random walk sense forma.
const MARKET_SHOCK: number[] = Array.from({ length: MONTHS }, (_, m) => {
  if (m >= 14 && m <= 16) return -1.6;
  if (m >= 17 && m <= 25) return 0.35;
  if (m >= 30) return 0.5;
  return 0;
});

const START_PRICE: Record<string, number> = {
  'ITX.MC':    32.00,
  'IBE.MC':    10.50,
  'AAPL':      148.00,
  'MSFT':      285.00,
  'ASML':      560.00,
  'IWDA':      74.50,
  'VWCE':      96.00,
  'EIMI':      27.80,
  'FID-GLTEC': 44.50,
};

const USD_TICKERS = new Set(['AAPL', 'MSFT', 'FID-GLTEC']);

/** Genera l'índex de preu mensual (mes 0..36) d'un actiu a partir del seu
 * retorn/volatilitat anual estimats i del xoc de mercat compartit. */
function buildAssetPriceSeries(asset: ManualAsset): number[] {
  const annualReturn = (asset.historicalReturn5Y ?? 6) / 100;
  const annualVol    = (asset.historicalVolatility ?? 15) / 100;
  const monthlyDrift = annualReturn / 12;
  const monthlyVol   = annualVol / Math.sqrt(12);
  const beta         = Math.min(1.6, Math.max(0.5, annualVol / 0.18));

  const startPrice = START_PRICE[asset.ticker] ?? 50;
  const prices: number[] = [startPrice];
  for (let m = 0; m < MONTHS; m++) {
    const shock  = (MARKET_SHOCK[m] / 15) * beta;
    const noise  = monthlyVol * boxMuller();
    const monthlyReturn = monthlyDrift + shock + noise;
    prices.push(Math.max(0.5, prices[prices.length - 1] * (1 + monthlyReturn)));
  }
  return prices; // longitud 37 (mesos 0..36)
}

interface AssetHistory {
  asset: ManualAsset;
  priceSeries: number[];  // longitud 37
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  totalInvested: number;
}

const ASSET_HISTORIES: AssetHistory[] = PORTFOLIO_ASSETS.map(asset => {
  const priceSeries = buildAssetPriceSeries(asset);
  const weightFrac  = asset.weight / 100;

  // Aportació inicial (mes 0) + 36 aportacions mensuals (DCA), repartides
  // segons el pes de l'actiu a la cartera.
  let totalQty = 0;
  let totalCost = 0;
  const initialAmount = manualPortfolioInput.initialAmount * weightFrac;
  const monthlyAmount = manualPortfolioInput.monthlyAmount * weightFrac;

  totalQty  += initialAmount / priceSeries[0];
  totalCost += initialAmount;
  for (let m = 1; m <= MONTHS; m++) {
    totalQty  += monthlyAmount / priceSeries[m];
    totalCost += monthlyAmount;
  }

  return {
    asset,
    priceSeries,
    quantity:      totalQty,
    avgEntryPrice: totalCost / totalQty,
    currentPrice:  priceSeries[MONTHS],
    totalInvested: totalCost,
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. GENERADORS — un bloc per tipus d'informe
// ═══════════════════════════════════════════════════════════════════════════

async function genFactorOTCReport() {
  log('Informe Financer Personalitzat (react-pdf)…');

  const scoring    = calculateScore(questionnaire);
  const portfolio  = buildPortfolio(scoring.profile, questionnaire);
  const metrics    = calculatePortfolioMetrics(portfolio); // sense dades reals → mètriques estimades
  const historical = generateSimulatedHistoricalData(portfolio, 5);
  const monteCarlo = runMonteCarlo(
    {
      initialInvestment:   questionnaire.initialInvestment,
      monthlyContribution: questionnaire.monthlyContribution,
      investmentHorizon:   questionnaire.investmentHorizon,
      annualReturn:        portfolio.expectedReturn,
      annualVolatility:    portfolio.expectedVolatility,
    },
    questionnaire.targetAmount,
  );
  const report = generateReport(questionnaire, scoring, portfolio, metrics, monteCarlo);

  const outPath = path.join(OUT_DIR, '01-informe-financer-personalitzat.pdf');
  await renderToFile(
    React.createElement(FactorOTCReport, {
      questionnaire, scoring, portfolio, metrics, monteCarlo, report,
      charts: {}, // sense captura de gràfics (requereix DOM/navegador real, vegeu README)
      historical,
    }) as unknown as PdfElement,
    outPath,
  );
  log(`  ✓ ${path.relative(process.cwd(), outPath)}`);
}

async function genManualReportPDF() {
  log('Informe Manual (admin) — versió react-pdf…');
  const outPath = path.join(OUT_DIR, '02-informe-manual-admin-reactpdf.pdf');
  await renderToFile(
    React.createElement(ManualReportPDF, { data: manualPortfolioInput, generatedAt: generatedAtLabel }) as unknown as PdfElement,
    outPath,
  );
  log(`  ✓ ${path.relative(process.cwd(), outPath)}`);
}

async function genManualReportHTML(browser: import('@playwright/test').Browser) {
  log('Informe Manual (admin) — versió HTML…');
  const html = generateManualReport(manualPortfolioInput);
  const outPath = path.join(OUT_DIR, '03-informe-manual-admin-html.pdf');
  await htmlToPdf(browser, html, outPath);
  log(`  ✓ ${path.relative(process.cwd(), outPath)}`);
}

async function genStockReport(browser: import('@playwright/test').Browser) {
  log('Informe Bursàtil (acció) — dades 100% sintètiques, sense trucada a Yahoo…');

  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const lastEarnings = new Date(now); lastEarnings.setDate(now.getDate() - 55);
  const nextEarnings = new Date(now); nextEarnings.setDate(now.getDate() + 40);

  const data: StockReportData = {
    ticker: 'ITX.MC',
    name: 'Industria de Diseño Textil, S.A. (Inditex)',
    description: 'Grup multinacional de distribució tèxtil amb seu a Arteixo (Galícia, Espanya), propietari de marques ' +
      'com Zara, Massimo Dutti, Bershka, Pull&Bear, Stradivarius, Oysho i Uterqüe. Opera més de 5.500 botigues en 96 ' +
      'mercats i una plataforma de venda online integrada amb tota la xarxa física.',
    sector: 'Consumer Cyclical',
    industry: 'Apparel Retail',
    website: 'https://www.inditex.com',
    country: 'Spain',

    price: 48.65,
    change: 0.42,
    changePercent: 0.87,
    currency: 'EUR',
    exchange: 'BME',

    marketCap: 151_000_000_000,
    volume: 3_250_000,
    avgVolume: 3_800_000,
    week52High: 53.10,
    week52Low: 36.20,

    pe: 23.4,
    forwardPE: 21.1,
    eps: 2.08,
    revenue: 36_100_000_000,
    revenueGrowth: 0.076,
    profitMargin: 0.162,
    roe: 0.283,
    debtToEquity: 0.12,
    beta: 0.85,
    dividendYield: 0.031,

    lastEarningsDate: fmt(lastEarnings),
    nextEarningsDate: fmt(nextEarnings),

    epsLastQActual:   0.53,
    epsLastQEstimate: 0.50,
    epsLastQSurprise: 6.0,
    epsLastQDate:     fmt(lastEarnings),
    epsNextQEstimate: 0.58,
    epsNextQDate:     fmt(nextEarnings),
    revenueNextQEst:  9_400_000_000,

    generatedAt: now.toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    source: 'partial',
  };

  const html = generateStockReport(data);
  const outPath = path.join(OUT_DIR, '04-informe-bursatil-accio.pdf');
  await htmlToPdf(browser, html, outPath);
  log(`  ✓ ${path.relative(process.cwd(), outPath)}`);
}

async function genMonthlyReport(browser: import('@playwright/test').Browser) {
  log('Informe Mensual de Cartera — sense plantilla pròpia, reconstrucció HTML…');

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const startedAt   = new Date(now); startedAt.setMonth(startedAt.getMonth() - MONTHS);

  const holdings: ClientHolding[] = ASSET_HISTORIES.map((h, i) => ({
    id:               `h-demo-${i}`,
    portfolioId:      'cport-demo-marta-sola',
    assetIsin:        h.asset.isin,
    assetName:        h.asset.name,
    assetSymbol:      h.asset.ticker,
    assetCategory:    h.asset.category,
    broker:           h.asset.platform,
    quantity:         Math.round(h.quantity * 10000) / 10000,
    avgEntryPrice:    Math.round(h.avgEntryPrice * 100) / 100,
    currentPrice:     Math.round(h.currentPrice * 100) / 100,
    priceLastUpdated: now.toISOString().split('T')[0],
    priceSource:      'manual',
    currency:         USD_TICKERS.has(h.asset.ticker) ? 'USD' : 'EUR',
    createdAt:        startedAt.toISOString(),
  }));

  const transactions: ClientTransaction[] = [];
  transactions.push({
    id: 'tx-demo-0', portfolioId: 'cport-demo-marta-sola', operationType: 'deposit',
    date: startedAt.toISOString().split('T')[0], quantity: 0,
    priceEur: 0, totalEur: manualPortfolioInput.initialAmount, commission: 0,
    broker: 'Transferència', notes: 'Aportació inicial', createdAt: startedAt.toISOString(),
  });
  for (let m = 1; m <= MONTHS; m++) {
    const d = new Date(startedAt); d.setMonth(d.getMonth() + m);
    transactions.push({
      id: `tx-demo-${m}`, portfolioId: 'cport-demo-marta-sola', operationType: 'deposit',
      date: d.toISOString().split('T')[0], quantity: 0,
      priceEur: 0, totalEur: manualPortfolioInput.monthlyAmount, commission: 0,
      broker: 'Transferència periòdica', notes: 'Aportació mensual programada', createdAt: d.toISOString(),
    });
  }

  const clientPortfolio: ClientPortfolio = {
    id:          'cport-demo-marta-sola',
    clientId:    'marta.sola',
    clientName:  CLIENT.name,
    name:        'Cartera Creixement Global',
    description: 'Cartera d\'accions IBEX i internacionals, ETFs UCITS i un fons actiu de tecnologia, construïda per DCA mensual durant 3 anys.',
    recommendations: 'Mantenir l\'estratègia d\'aportacions mensuals de 750 € i revisar el rebalanceig si algun actiu ' +
      'supera ±10 punts percentuals del pes objectiu. Valorar incorporar renda fixa a mesura que s\'acosti l\'horitzó ' +
      '(a partir de l\'any 10).',
    nextFollowup: new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString().split('T')[0],
    holdings, transactions,
    advisorNotes: [], snapshots: [],
    createdAt: startedAt.toISOString(),
    updatedAt: now.toISOString(),
  };

  const advisorComments =
    'Trimestre marcat per la resiliència del mercat nord-americà: Apple i Microsoft continuen liderant la ' +
    'contribució positiva a la cartera. La correcció que vam viure als mercats globals fa uns mesos ja ha quedat ' +
    'íntegrament recuperada gràcies a la disciplina d\'aportació mensual (DCA), que ha permès promitjar preus ' +
    'd\'entrada més baixos als ETFs globals durant aquell període. Mantenim la sobreponderació tàctica a tecnologia ' +
    'i recomanem revisar el pes d\'Inditex si continua superant el 12-13% de la cartera.';

  const reportData = generateMonthlyReportData(
    clientPortfolio,
    advisorComments,
    periodStart.toISOString().split('T')[0],
    periodEnd.toISOString().split('T')[0],
  );

  const html = renderMonthlyReportHtml(reportData);
  const outPath = path.join(OUT_DIR, '05-informe-mensual-cartera.pdf');
  await htmlToPdf(browser, html, outPath, { format: 'A4' });
  log(`  ✓ ${path.relative(process.cwd(), outPath)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function htmlToPdf(
  browser: import('@playwright/test').Browser,
  html: string,
  outPath: string,
  opts: { format?: 'A4' } = {},
) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  if (opts.format === 'A4') {
    await page.pdf({ path: outPath, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  } else {
    // Les plantilles HTML de l'app defineixen .page{width:880px;min-height:1180px}
    // amb page-break-after:always — reproduïm aquestes mateixes dimensions
    // perquè cada div .page es correspongui amb una pàgina física del PDF.
    await page.pdf({ path: outPath, width: '880px', height: '1180px', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  }
  await page.close();
}

const eur = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** Reconstrucció HTML del "Informe Mensual de Cartera": l'app no té cap
 * plantilla/funció que retorni HTML o PDF per a aquest informe — es genera
 * a partir del component React de components/admin/MonthlyReportGenerator.tsx
 * via window.print() del navegador. Aquesta funció replica visualment la
 * variant "print:" (fons blanc/text negre) d'aquell component per obtenir
 * una mostra representativa. Vegeu samples-pdf/README.md. */
function renderMonthlyReportHtml(r: MonthlyReportData): string {
  const pnlColor = r.metrics.pnlEur >= 0 ? '#059669' : '#dc2626';
  const holdingsHtml = r.topHoldings.map(h => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
        <span style="color:#374151">${h.name}</span>
        <span style="display:flex;gap:14px">
          <span style="color:#6b7280">${h.value.toFixed(0)} €</span>
          <span style="color:${h.pnlPct >= 0 ? '#059669' : '#dc2626'};font-family:monospace">${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(2)}%</span>
          <span style="color:#9ca3af;width:40px;display:inline-block;text-align:right">${h.weight.toFixed(1)}%</span>
        </span>
      </div>
      <div style="height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${Math.min(h.weight, 100)}%;background:#c9a84c"></div>
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="ca"><head><meta charset="UTF-8">
<title>Informe Mensual — ${r.clientName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827;background:#fff;padding:56px 60px;font-size:14px}
  .brand{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  .brand-mark{width:22px;height:22px;background:#0d1f1a;border-radius:5px;display:flex;align-items:center;justify-content:center;color:#c9a84c;font-weight:900;font-size:11px}
  .brand-name{font-weight:900;letter-spacing:2px;font-size:12px;color:#0d1f1a}
  h1{font-size:24px;margin-bottom:4px}
  .sub{color:#6b7280;font-size:13px}
  .head-row{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e5e7eb;padding-bottom:22px;margin-bottom:26px}
  .right{text-align:right;font-size:12px;color:#6b7280}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:30px}
  .kpi{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px}
  .kpi .l{font-size:11px;color:#6b7280;margin-bottom:4px}
  .kpi .v{font-size:17px;font-weight:700}
  section{margin-bottom:26px}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#111827;margin-bottom:12px}
  .comments{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;font-size:13px;line-height:1.6;color:#374151;white-space:pre-wrap}
  .disclaimer{margin-top:30px;padding-top:18px;border-top:1px solid #e5e7eb;font-size:10.5px;color:#9ca3af;line-height:1.5}
</style></head>
<body>
  <div class="head-row">
    <div>
      <div class="brand"><div class="brand-mark">F</div><div class="brand-name">FACTOR OTC</div></div>
      <h1>Informe Mensual de Cartera</h1>
      <p class="sub">${r.clientName} · ${r.portfolioName}</p>
    </div>
    <div class="right">
      <p>ID: ${r.reportId}</p>
      <p>${new Date(r.periodStart).toLocaleDateString('ca-ES')} – ${new Date(r.periodEnd).toLocaleDateString('ca-ES')}</p>
      <p>Generat: ${new Date(r.generatedAt).toLocaleString('ca-ES')}</p>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="l">Valor actual</div><div class="v">${r.metrics.currentValue.toFixed(2)} €</div></div>
    <div class="kpi"><div class="l">Aportació neta</div><div class="v">${r.metrics.netContributions.toFixed(2)} €</div></div>
    <div class="kpi"><div class="l">Rendiment (€)</div><div class="v" style="color:${pnlColor}">${r.metrics.pnlEur >= 0 ? '+' : ''}${r.metrics.pnlEur.toFixed(2)} €</div></div>
    <div class="kpi"><div class="l">Rendiment (%)</div><div class="v" style="color:${pnlColor}">${r.metrics.pnlPct >= 0 ? '+' : ''}${r.metrics.pnlPct.toFixed(2)}%</div></div>
  </div>

  <section>
    <h2>Principals posicions</h2>
    ${holdingsHtml}
  </section>

  <section>
    <h2>Comentaris de l'assessor</h2>
    <div class="comments">${r.advisorComments}</div>
  </section>

  <div class="disclaimer">
    Aquest informe és una eina de suport a la decisió i no constitueix assessorament financer regulat.
    Les dades de rendiment passades no garanteixen rendiments futurs. Factor OTC no executa operacions reals.
  </div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`Generant mostres de PDF a ${path.relative(process.cwd(), OUT_DIR)}/ ...\n`);

  await genFactorOTCReport();
  await genManualReportPDF();

  const browser = await chromium.launch();
  try {
    await genManualReportHTML(browser);
    await genStockReport(browser);
    await genMonthlyReport(browser);
  } finally {
    await browser.close();
  }

  console.log('\nFet.');
}

main().catch(err => {
  console.error('Error generant les mostres:', err);
  process.exitCode = 1;
});
