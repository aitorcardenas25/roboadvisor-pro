// lib/portfolio.ts
// Construcció de carteres d'inversió per perfil d'inversor

import { InvestorProfile, FinancialProduct, FINANCIAL_PRODUCTS } from './products';
import { InvestorQuestionnaire } from './scoring';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface PortfolioAllocation {
  productId: string;
  product: FinancialProduct;
  weight: number; // % de la cartera (0-100)
  amount: number; // import en EUR
  rationale: string;
}

export interface Portfolio {
  profile: InvestorProfile;
  name: string;
  description: string;
  allocations: PortfolioAllocation[];
  benchmark: CompositeBenchmark;
  expectedReturn: number;      // % anual estimat
  expectedVolatility: number;  // % anual estimat
  expectedSharpe: number;      // ratio estimat
  maxDrawdownEstimate: number; // % màxim drawdown estimat
  totalTER: number;            // cost total ponderat %
  esgScore: number;            // 0-100
  characteristics: PortfolioCharacteristics;
}

export interface CompositeBenchmark {
  name: string;
  description: string;
  components: BenchmarkComponent[];
  expectedReturn: number;
  expectedVolatility: number;
}

export interface BenchmarkComponent {
  index: string;
  weight: number;
  description: string;
}

export interface PortfolioCharacteristics {
  equityWeight: number;
  fixedIncomeWeight: number;
  alternativesWeight: number;
  cashWeight: number;
  geographicDiversification: string[];
  mainCurrencies: string[];
  avgRisk: number;
  managementStyle: string;
}

// ─── COMPLEXITAT SEGONS IMPORT MENSUAL ────────────────────────────────────────

type ComplexityTier = 'simple' | 'medium' | 'full';

function getComplexityTier(monthlyContribution: number): ComplexityTier {
  if (monthlyContribution < 300) return 'simple'; // 3-4 fons
  if (monthlyContribution < 700) return 'medium'; // 5-7 fons
  return 'full';                                   // 8-12 fons
}

// ─── CARTERES PER PERFIL ──────────────────────────────────────────────────────

export function buildPortfolio(
  profile: InvestorProfile,
  questionnaire: InvestorQuestionnaire
): Portfolio {
  const investableAmount = questionnaire.currentSavings * (questionnaire.percentageToInvest / 100);
  const tier = getComplexityTier(questionnaire.monthlyContribution);

  switch (profile) {
    case 'conservador':
      return buildConservadorPortfolio(investableAmount, questionnaire, tier);
    case 'moderat':
      return buildModeratPortfolio(investableAmount, questionnaire, tier);
    case 'dinamic':
      return buildDinamicPortfolio(investableAmount, questionnaire, tier);
    case 'agressiu':
      return buildAgressiuPortfolio(investableAmount, questionnaire, tier);
  }
}

// ─── CARTERA CONSERVADORA ─────────────────────────────────────────────────────

const CONSERVADOR_SIMPLE = [
  { productId: 'amundi-monetari-eur',   weight: 35, rationale: 'Base monetària: preservació del capital i liquiditat immediata.' },
  { productId: 'pimco-rf-curta',        weight: 40, rationale: 'Renda fixa curta durada: baix risc i rendibilitat superior al monetari.' },
  { productId: 'fidelity-dividend',     weight: 25, rationale: 'Complement de renda variable via dividends estables i defensius.' },
];

const CONSERVADOR_MEDIUM = [
  { productId: 'amundi-monetari-eur',   weight: 20, rationale: 'Preservació del capital i liquiditat immediata.' },
  { productId: 'pimco-rf-curta',        weight: 25, rationale: 'Renda fixa curta durada per reduir sensibilitat als tipus.' },
  { productId: 'vanguard-rf-curta-eur', weight: 20, rationale: 'Component indexat de deute públic europeu de baix cost.' },
  { productId: 'pimco-rf-global',       weight: 20, rationale: 'Diversificació global de renda fixa amb gestió activa.' },
  { productId: 'fidelity-dividend',     weight: 15, rationale: 'Exposició a renda variable via dividends estables.' },
];

const CONSERVADOR_FULL = [
  { productId: 'amundi-monetari-eur',   weight: 20, rationale: 'Preservació del capital i liquiditat immediata.' },
  { productId: 'bnp-monetari-eur',      weight: 10, rationale: 'Diversificació del component monetari entre gestores.' },
  { productId: 'pimco-rf-curta',        weight: 20, rationale: 'Renda fixa curta durada per reduir sensibilitat als tipus.' },
  { productId: 'vanguard-rf-curta-eur', weight: 15, rationale: 'Component indexat de deute públic europeu de baix cost.' },
  { productId: 'pimco-rf-global',       weight: 15, rationale: 'Diversificació global de renda fixa amb gestió activa.' },
  { productId: 'fidelity-dividend',     weight: 10, rationale: 'Exposició mínima a renda variable via dividends estables.' },
  { productId: 'vanguard-global-index', weight:  5, rationale: 'Complement de renda variable global a cost mínim.' },
  { productId: 'cohen-steers-reits',    weight:  5, rationale: 'Diversificació via immobiliari per correlació baixa.' },
];

function buildConservadorPortfolio(
  amount: number,
  q: InvestorQuestionnaire,
  tier: ComplexityTier
): Portfolio {
  const rawAllocations = tier === 'simple' ? CONSERVADOR_SIMPLE
                       : tier === 'medium' ? CONSERVADOR_MEDIUM
                       : CONSERVADOR_FULL;

  const allocations = buildAllocations(rawAllocations, amount);

  return {
    profile: 'conservador',
    name: 'Cartera Estabilitat',
    description: 'Cartera orientada a la preservació del capital i la generació d\'ingressos estables. Predomini de renda fixa de qualitat i component monetari significatiu.',
    allocations,
    benchmark: BENCHMARKS.conservador,
    expectedReturn: 2.5,
    expectedVolatility: 3.5,
    expectedSharpe: 0.45,
    maxDrawdownEstimate: -6.0,
    totalTER: calculateTotalTER(allocations),
    esgScore: calculateESGScore(allocations, q),
    characteristics: {
      equityWeight: 15,
      fixedIncomeWeight: 50,
      alternativesWeight: 5,
      cashWeight: 30,
      geographicDiversification: ['Eurozona', 'Global', 'EUA', 'Europa'],
      mainCurrencies: ['EUR', 'USD'],
      avgRisk: 1.8,
      managementStyle: 'Predomini activa amb component indexat',
    },
  };
}

// ─── CARTERA MODERADA ─────────────────────────────────────────────────────────

function buildModeratPortfolio(
  amount: number,
  q: InvestorQuestionnaire,
  tier: ComplexityTier
): Portfolio {
  const useESG = q.esgPreference === 'important' || q.esgPreference === 'essencial';

  const rawAllocations = tier === 'simple' ? [
    { productId: 'pimco-rf-global',       weight: 20, rationale: 'Renda fixa global activa com a component estabilitzador.' },
    { productId: 'vanguard-global-index', weight: 50, rationale: 'Core de renda variable global indexada, màxima diversificació.' },
    { productId: 'vanguard-usa-index',    weight: 15, rationale: 'Exposició al mercat nord-americà via S&P 500 indexat.' },
    { productId: 'fidelity-dividend',     weight: 15, rationale: 'Generació d\'ingressos i menor volatilitat via dividends.' },
  ] : tier === 'medium' ? [
    { productId: 'vanguard-rf-curta-eur', weight: 10, rationale: 'Estabilitat i reduïda sensibilitat als tipus d\'interès.' },
    { productId: 'pimco-rf-global',       weight: 15, rationale: 'Diversificació de renda fixa global activa.' },
    { productId: 'vanguard-global-index', weight: 30, rationale: 'Core de renda variable global indexada.' },
    { productId: 'vanguard-usa-index',    weight: 15, rationale: 'Exposició al mercat nord-americà indexat.' },
    { productId: 'fidelity-europa',       weight: 15, rationale: 'Exposició activa a empreses europees de qualitat.' },
    { productId: 'fidelity-dividend',     weight: 15, rationale: 'Generació d\'ingressos via dividends.' },
  ] : [
    { productId: 'vanguard-rf-curta-eur',  weight: 10, rationale: 'Estabilitat i reduïda sensibilitat als tipus d\'interès.' },
    { productId: 'pimco-rf-global',         weight: 15, rationale: 'Diversificació de renda fixa global activa.' },
    { productId: 'nordea-rf-europa',        weight:  5, rationale: 'Component d\'alt rendiment europeu com a plus de rendibilitat.' },
    { productId: 'vanguard-global-index',   weight: 25, rationale: 'Core de renda variable global indexada, màxima diversificació.' },
    { productId: 'fidelity-europa',         weight: 10, rationale: 'Exposició activa a empreses europees de qualitat.' },
    { productId: 'vanguard-usa-index',      weight: 10, rationale: 'Exposició al mercat nord-americà via S&P 500 indexat.' },
    { productId: 'fidelity-emergents',      weight:  5, rationale: 'Exposició limitada a mercats emergents per potencial de creixement.' },
    { productId: 'fidelity-dividend',       weight: 10, rationale: 'Generació d\'ingressos i menor volatilitat via dividends.' },
    {
      productId: useESG ? 'pictet-esg-global' : 'cohen-steers-reits',
      weight: 5,
      rationale: useESG
        ? 'Component ESG per alinear la cartera amb criteris de sostenibilitat.'
        : 'Diversificació via immobiliari cotitzat global.',
    },
    { productId: 'amundi-monetari-eur',     weight:  5, rationale: 'Reserva de liquiditat i capital de protecció.' },
  ];

  const allocations = buildAllocations(rawAllocations, amount);

  return {
    profile: 'moderat',
    name: 'Cartera Equilibri',
    description: 'Cartera equilibrada entre creixement i estabilitat. Combina renda fixa diversificada amb renda variable global, europea i americana per assolir una rendibilitat atractiva controlant la volatilitat.',
    allocations,
    benchmark: BENCHMARKS.moderat,
    expectedReturn: 5.0,
    expectedVolatility: 8.0,
    expectedSharpe: 0.50,
    maxDrawdownEstimate: -15.0,
    totalTER: calculateTotalTER(allocations),
    esgScore: calculateESGScore(allocations, q),
    characteristics: {
      equityWeight: 60,
      fixedIncomeWeight: 30,
      alternativesWeight: 5,
      cashWeight: 5,
      geographicDiversification: ['Global', 'EUA', 'Europa', 'Emergents'],
      mainCurrencies: ['EUR', 'USD', 'GBP'],
      avgRisk: 3.0,
      managementStyle: 'Combinació activa i indexada',
    },
  };
}

// ─── CARTERA DINÀMICA ─────────────────────────────────────────────────────────

function buildDinamicPortfolio(
  amount: number,
  q: InvestorQuestionnaire,
  tier: ComplexityTier
): Portfolio {
  const useESG = q.esgPreference === 'important' || q.esgPreference === 'essencial';

  const rawAllocations = tier === 'simple' ? [
    { productId: 'vanguard-global-index', weight: 45, rationale: 'Core global indexat. Base diversificada i de baix cost.' },
    { productId: 'vanguard-usa-index',    weight: 30, rationale: 'Sobreponderació EUA: motor del cicle econòmic global.' },
    { productId: 'gqg-emergents',         weight: 15, rationale: 'Emergents per potencial de creixement a llarg termini.' },
    { productId: 'pimco-rf-global',       weight: 10, rationale: 'Renda fixa residual per amortir volatilitat en caigudes.' },
  ] : tier === 'medium' ? [
    { productId: 'vanguard-global-index',   weight: 30, rationale: 'Core global indexat.' },
    { productId: 'fundsmith-equity',         weight: 15, rationale: 'Gestió activa global de qualitat.' },
    { productId: 'vanguard-usa-index',       weight: 20, rationale: 'Sobreponderació EUA.' },
    { productId: 'fidelity-europa',          weight: 10, rationale: 'Europa valor i diversificació geogràfica.' },
    { productId: 'gqg-emergents',            weight: 10, rationale: 'Emergents per potencial de creixement.' },
    { productId: 'lonvia-small-caps-europa', weight:  5, rationale: 'Small caps europees: prima de risc addicional.' },
    { productId: 'pimco-rf-global',          weight: 10, rationale: 'Renda fixa per amortir volatilitat.' },
  ] : [
    { productId: 'vanguard-global-index',   weight: 25, rationale: 'Core global indexat. Base de la cartera per màxima diversificació.' },
    { productId: 'fundsmith-equity',         weight: 10, rationale: 'Gestió activa global de qualitat. Complement de convicció.' },
    { productId: 'vanguard-usa-index',       weight: 15, rationale: 'Sobreponderar EUA per pes en el cicle econòmic actual.' },
    { productId: 'fidelity-europa',          weight: 10, rationale: 'Europa com a component de valor i diversificació geogràfica.' },
    { productId: 'gqg-emergents',            weight: 10, rationale: 'Emergents per potencial de creixement a llarg termini.' },
    { productId: 'lonvia-small-caps-europa', weight:  5, rationale: 'Small caps europees: prima de risc addicional i diversificació.' },
    { productId: 'hermes-small-caps-global', weight:  5, rationale: 'Small caps globals com a complement de creixement.' },
    { productId: 'polar-capital-healthcare', weight:  5, rationale: 'Sector salut: defensiu, creixement secular i poca correlació.' },
    {
      productId: useESG ? 'nordea-esg-global' : 'janus-henderson-reits',
      weight: 5,
      rationale: useESG
        ? 'ESG temàtic climàtic com a aposta de transformació estructural.'
        : 'Immobiliari global per diversificació d\'actius reals.',
    },
    { productId: 'pimco-rf-global',          weight:  5, rationale: 'Renda fixa residual per amortir volatilitat en caigudes.' },
    { productId: 'vanguard-rf-curta-eur',    weight:  5, rationale: 'Component de renda fixa curta com a estabilitzador.' },
  ];

  const allocations = buildAllocations(rawAllocations, amount);

  return {
    profile: 'dinamic',
    name: 'Cartera Creixement',
    description: 'Cartera orientada al creixement del capital a mig-llarg termini. Predomini de renda variable global diversificada per geografia i estil de gestió, amb exposició a sectors de creixement secular.',
    allocations,
    benchmark: BENCHMARKS.dinamic,
    expectedReturn: 7.5,
    expectedVolatility: 13.0,
    expectedSharpe: 0.48,
    maxDrawdownEstimate: -25.0,
    totalTER: calculateTotalTER(allocations),
    esgScore: calculateESGScore(allocations, q),
    characteristics: {
      equityWeight: 85,
      fixedIncomeWeight: 10,
      alternativesWeight: 5,
      cashWeight: 0,
      geographicDiversification: ['Global', 'EUA', 'Europa', 'Emergents', 'Small Caps'],
      mainCurrencies: ['EUR', 'USD', 'GBP'],
      avgRisk: 4.2,
      managementStyle: 'Combinació indexada i activa de convicció',
    },
  };
}

// ─── CARTERA AGRESSIVA ────────────────────────────────────────────────────────

function buildAgressiuPortfolio(
  amount: number,
  q: InvestorQuestionnaire,
  tier: ComplexityTier
): Portfolio {
  const rawAllocations = tier === 'simple' ? [
    { productId: 'msif-global-opp',      weight: 35, rationale: 'Core de creixement global de qualitat màxima convicció.' },
    { productId: 'baillie-gifford-usa',  weight: 35, rationale: 'Creixement nord-americà transformador a llarg termini.' },
    { productId: 'polar-capital-tech',   weight: 20, rationale: 'Tecnologia global: motor de creixement estructural.' },
    { productId: 'gqg-emergents',        weight: 10, rationale: 'Emergents globals de qualitat amb gran potencial.' },
  ] : tier === 'medium' ? [
    { productId: 'msif-global-opp',          weight: 20, rationale: 'Core de creixement global de qualitat màxima convicció.' },
    { productId: 'baillie-gifford-usa',       weight: 20, rationale: 'Creixement nord-americà transformador a llarg termini.' },
    { productId: 'vanguard-global-index',     weight: 15, rationale: 'Ancoratge indexat global per estabilitzar el core.' },
    { productId: 'gqg-emergents',             weight: 15, rationale: 'Emergents globals de qualitat amb gran potencial.' },
    { productId: 'polar-capital-tech',        weight: 15, rationale: 'Tecnologia global: motor de creixement estructural.' },
    { productId: 'hermes-small-caps-global',  weight: 10, rationale: 'Small caps globals: prima de risc elevada a llarg termini.' },
    { productId: 'polar-capital-healthcare',  weight:  5, rationale: 'Salut/biotech: creixement secular i menor correlació.' },
  ] : [
    { productId: 'msif-global-opp',          weight: 15, rationale: 'Core de creixement global de qualitat màxima convicció.' },
    { productId: 'baillie-gifford-usa',       weight: 15, rationale: 'Creixement nord-americà transformador a llarg termini.' },
    { productId: 'vanguard-global-index',     weight: 10, rationale: 'Ancoratge indexat global per estabilitzar el core.' },
    { productId: 'gqg-emergents',             weight: 10, rationale: 'Emergents globals de qualitat amb gran potencial.' },
    { productId: 'fidelity-emergents',        weight:  5, rationale: 'Diversificació del component emergent entre gestores.' },
    { productId: 'polar-capital-tech',        weight: 10, rationale: 'Tecnologia global: motor de creixement estructural.' },
    { productId: 'bgf-world-technology',      weight:  5, rationale: 'Complement tecnològic via BlackRock per diversificar.' },
    { productId: 'hermes-small-caps-global',  weight: 10, rationale: 'Small caps globals: prima de risc elevada a llarg termini.' },
    { productId: 'lonvia-small-caps-europa',  weight:  5, rationale: 'Small caps europees de qualitat com a diversificació.' },
    { productId: 'polar-capital-healthcare',  weight:  5, rationale: 'Salut/biotech: creixement secular i menor correlació.' },
    { productId: 'bgf-world-energy',          weight:  5, rationale: 'Energia: cobertura inflacionista i diversificació sectorial.' },
    { productId: 'vanguard-rf-curta-eur',     weight:  5, rationale: 'Component residual de renda fixa per gestió de liquiditat.' },
  ];

  const allocations = buildAllocations(rawAllocations, amount);

  return {
    profile: 'agressiu',
    name: 'Cartera Alt Creixement',
    description: 'Cartera de màxima orientació al creixement a llarg termini. Concentrada en renda variable global, sectors de creixement secular i small caps. Accepta alta volatilitat a canvi del màxim potencial de rendibilitat.',
    allocations,
    benchmark: BENCHMARKS.agressiu,
    expectedReturn: 10.0,
    expectedVolatility: 18.0,
    expectedSharpe: 0.45,
    maxDrawdownEstimate: -38.0,
    totalTER: calculateTotalTER(allocations),
    esgScore: calculateESGScore(allocations, q),
    characteristics: {
      equityWeight: 95,
      fixedIncomeWeight: 5,
      alternativesWeight: 0,
      cashWeight: 0,
      geographicDiversification: ['Global', 'EUA', 'Emergents', 'Europa', 'Small Caps', 'Sectorial'],
      mainCurrencies: ['EUR', 'USD', 'GBP', 'CHF'],
      avgRisk: 4.8,
      managementStyle: 'Predomini activa de convicció amb ancoratge indexat',
    },
  };
}

// ─── BENCHMARKS COMPOSTOS ─────────────────────────────────────────────────────

export const BENCHMARKS: Record<InvestorProfile, CompositeBenchmark> = {
  conservador: {
    name: 'Benchmark Conservador Compost',
    description: 'Referència composta de deute europeu, monetari i renda variable global mínima.',
    components: [
      { index: 'Bloomberg Euro Aggregate Bond Index',        weight: 40, description: 'Deute europeu agregat' },
      { index: 'ESTR Capitalization Index',                  weight: 30, description: 'Monetari EUR' },
      { index: 'Bloomberg Global Aggregate Bond Index',      weight: 15, description: 'Renda fixa global' },
      { index: 'MSCI World Index',                           weight: 10, description: 'Renda variable global' },
      { index: 'FTSE EPRA/NAREIT Global Index',              weight:  5, description: 'Immobiliari global' },
    ],
    expectedReturn: 2.0,
    expectedVolatility: 3.0,
  },
  moderat: {
    name: 'Benchmark Moderat Compost',
    description: 'Referència composta 60/40 entre renda variable global i renda fixa diversificada.',
    components: [
      { index: 'MSCI World Index',                           weight: 40, description: 'Renda variable global' },
      { index: 'S&P 500 Index',                              weight: 15, description: 'Renda variable USA' },
      { index: 'MSCI Europe Index',                          weight:  5, description: 'Renda variable Europa' },
      { index: 'Bloomberg Global Aggregate Bond Index',      weight: 25, description: 'Renda fixa global' },
      { index: 'Bloomberg Euro Aggregate Bond Index',        weight: 10, description: 'Renda fixa europea' },
      { index: 'MSCI World High Dividend Yield Index',       weight:  5, description: 'Dividends globals' },
    ],
    expectedReturn: 5.5,
    expectedVolatility: 8.5,
  },
  dinamic: {
    name: 'Benchmark Dinàmic Compost',
    description: 'Referència composta orientada a renda variable global amb diversificació geogràfica i sectorial.',
    components: [
      { index: 'MSCI World Index',                           weight: 35, description: 'Renda variable global' },
      { index: 'S&P 500 Index',                              weight: 20, description: 'Renda variable USA' },
      { index: 'MSCI Europe Index',                          weight: 10, description: 'Renda variable Europa' },
      { index: 'MSCI Emerging Markets Index',                weight: 10, description: 'Mercats emergents' },
      { index: 'MSCI World Small Cap Index',                 weight: 10, description: 'Small caps globals' },
      { index: 'Bloomberg Global Aggregate Bond Index',      weight: 10, description: 'Renda fixa global' },
      { index: 'MSCI World Health Care Index',               weight:  5, description: 'Sector salut' },
    ],
    expectedReturn: 7.0,
    expectedVolatility: 13.5,
  },
  agressiu: {
    name: 'Benchmark Agressiu Compost',
    description: 'Referència composta de màxim creixement: renda variable global, emergents, tecnologia i small caps.',
    components: [
      { index: 'MSCI World Index',                           weight: 25, description: 'Renda variable global' },
      { index: 'S&P 500 Index',                              weight: 20, description: 'Renda variable USA' },
      { index: 'MSCI Emerging Markets Index',                weight: 15, description: 'Mercats emergents' },
      { index: 'MSCI World Small Cap Index',                 weight: 15, description: 'Small caps globals' },
      { index: 'Dow Jones Global Technology Index',          weight: 15, description: 'Tecnologia global' },
      { index: 'MSCI World Health Care Index',               weight:  5, description: 'Sector salut' },
      { index: 'MSCI World Energy Index',                    weight:  5, description: 'Sector energia' },
    ],
    expectedReturn: 9.5,
    expectedVolatility: 19.0,
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildAllocations(
  raw: { productId: string; weight: number; rationale: string }[],
  totalAmount: number
): PortfolioAllocation[] {
  return raw
    .map(({ productId, weight, rationale }) => {
      const product = FINANCIAL_PRODUCTS.find(p => p.id === productId);
      if (!product) return null;
      return {
        productId,
        product,
        weight,
        amount: Math.round((totalAmount * weight) / 100),
        rationale,
      };
    })
    .filter((a): a is PortfolioAllocation => a !== null);
}

function calculateTotalTER(allocations: PortfolioAllocation[]): number {
  const total = allocations.reduce((sum, a) => sum + a.product.ter * a.weight, 0);
  return Math.round((total / 100) * 100) / 100;
}

function calculateESGScore(
  allocations: PortfolioAllocation[],
  q: InvestorQuestionnaire
): number {
  const esgProducts = ['pictet-esg-global', 'nordea-esg-global', 'amundi-monetari-eur'];
  const esgWeight = allocations
    .filter(a => esgProducts.includes(a.productId) || (a.product.tags?.includes('esg')))
    .reduce((sum, a) => sum + a.weight, 0);

  const base = Math.min(100, esgWeight * 2);

  const preference = q.esgPreference;
  if (preference === 'essencial') return Math.min(100, base + 20);
  if (preference === 'important') return Math.min(100, base + 10);
  return base;
}

// ─── PORTFOLIO SUMMARY HELPERS ────────────────────────────────────────────────

export function getProfilePortfolioName(profile: InvestorProfile): string {
  const names: Record<InvestorProfile, string> = {
    conservador: 'Cartera Estabilitat',
    moderat:     'Cartera Equilibri',
    dinamic:     'Cartera Creixement',
    agressiu:    'Cartera Alt Creixement',
  };
  return names[profile];
}

export function getBenchmarkVsPortfolioNote(
  portfolioReturn: number,
  benchmarkReturn: number,
  profile: InvestorProfile
): string {
  const diff = portfolioReturn - benchmarkReturn;

  if (diff >= 0.5) {
    return `La cartera supera el benchmark en ${diff.toFixed(1)}pp. La selecció activa de fons aporta valor afegit respecte a la referència passiva.`;
  }

  if (diff >= -0.5) {
    return `La cartera s\'alinea amb el benchmark. Els costos dels fons d\'inversió es veuen compensats per la gestió activa selectiva.`;
  }

  const reasons: Record<InvestorProfile, string> = {
    conservador: 'La diferència és deguda a la major prudència de la cartera, menor risc i menor volatilitat esperada que el benchmark de referència.',
    moderat:     'La diferència reflecteix el cost dels fons de gestió activa i una composició lleugerament més defensiva que el benchmark ponderat.',
    dinamic:     'La diferència pot ser deguda als costos (TER) dels fons actius. A llarg termini, la selecció de qualitat pot compensar aquesta diferència.',
    agressiu:    'La diferència reflecteix els TERs superiors dels fons d\'alta convicció. La gestió activa pot generar alpha significatiu en horitzons llargs.',
  };

  return reasons[profile];
}