// lib/marketData.ts
// Connexió amb APIs financeres i TradingView widgets

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type DataSource = 'fmp' | 'alphavantage' | 'yahoo' | 'tradingview' | 'simulated';

export interface MarketDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  adjustedClose?: number;
}

export interface FundDataResult {
  productId: string;
  isin: string;
  ticker?: string;
  name: string;
  currency: string;
  prices: MarketDataPoint[];
  returns: number[];
  latestPrice?: number;
  latestDate?: string;
  source: DataSource;
  status: 'success' | 'partial' | 'fallback' | 'simulated' | 'error';
  errorMessage?: string;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  source: DataSource;
  timestamp: string;
}

export interface BenchmarkData {
  index: string;
  ticker: string;
  description: string;
  prices: MarketDataPoint[];
  returns: number[];
  source: DataSource;
}

// ─── TICKER MAP ───────────────────────────────────────────────────────────────
// Mapeig ISIN / productId → tickers per cada API

export const PRODUCT_TICKERS: Record<string, {
  fmp?: string;
  alphaVantage?: string;
  yahoo?: string;
  tradingView?: string;
  exchange?: string;
}> = {
  'amundi-monetari-eur':    { yahoo: 'FR0010510008.PA', tradingView: 'AMUNDI:FR0010510008' },
  'bnp-monetari-eur':       { yahoo: 'LU0711752370.F',  tradingView: 'BNPPARIBAS:LU0711752370' },
  'pimco-rf-curta':         { yahoo: 'IE00B11XZ871.IR', tradingView: 'PIMCO:IE00B11XZ871' },
  'vanguard-rf-curta-eur':  { yahoo: 'IE00B04GQQ17.IR', tradingView: 'VANGUARD:IE00B04GQQ17' },
  'templeton-rf-global':    { yahoo: 'LU0152980495.F',  tradingView: 'FRANKLIN:LU0152980495' },
  'pimco-rf-global':        { yahoo: 'IE0031488521.IR', tradingView: 'PIMCO:IE0031488521' },
  'nordea-rf-europa':       { yahoo: 'LU0141799501.F',  tradingView: 'NORDEA:LU0141799501' },
  'msif-global-opp':        { yahoo: 'LU0552385295.F',  fmp: 'LU0552385295', tradingView: 'MORGANSTANLEY:LU0552385295' },
  'fundsmith-equity':       { yahoo: 'GB00B41YBW71.L',  tradingView: 'FUNDSMITH:GB00B41YBW71', exchange: 'LSE' },
  'vanguard-global-index':  { yahoo: 'IE00B03HCZ61.IR', tradingView: 'VANGUARD:IE00B03HCZ61' },
  'amundi-msci-world':      { yahoo: 'LU0996182563.F',  tradingView: 'AMUNDI:LU0996182563' },
  'baillie-gifford-usa':    { yahoo: 'GB0005765085.L',  tradingView: 'BAILLIEGIFFORD:GB0005765085', exchange: 'LSE' },
  'vanguard-usa-index':     { yahoo: 'IE0032620787.IR', tradingView: 'VANGUARD:IE0032620787' },
  'fidelity-europa':        { yahoo: 'LU0048578792.F',  tradingView: 'FIDELITY:LU0048578792' },
  'threadneedle-europa':    { yahoo: 'GB0002771169.L',  tradingView: 'COLUMBIA:GB0002771169' },
  'bestinver-bolsa':        { yahoo: 'ES0110407072.MC', tradingView: 'BME:ES0110407072', exchange: 'BME' },
  'cobas-iberia':           { yahoo: 'ES0119459002.MC', tradingView: 'BME:ES0119459002', exchange: 'BME' },
  'gqg-emergents':          { yahoo: 'IE00BD7HRT35.IR', tradingView: 'GQG:IE00BD7HRT35' },
  'fidelity-emergents':     { yahoo: 'LU0048615250.F',  tradingView: 'FIDELITY:LU0048615250' },
  'hermes-small-caps-global':{ yahoo: 'IE00B3NFJB90.IR',tradingView: 'HERMES:IE00B3NFJB90' },
  'lonvia-small-caps-europa':{ yahoo: 'FR0011716477.PA',tradingView: 'LONVIA:FR0011716477' },
  'polar-capital-tech':     { yahoo: 'GB0007021389.L',  tradingView: 'LSE:PCT', exchange: 'LSE' },
  'bgf-world-technology':   { yahoo: 'LU0171310443.F',  tradingView: 'BLACKROCK:LU0171310443' },
  'bgf-world-energy':       { yahoo: 'LU0122376428.F',  tradingView: 'BLACKROCK:LU0122376428' },
  'polar-capital-healthcare':{ yahoo: 'IE00B3MGYV59.IR',tradingView: 'POLARCAPITAL:IE00B3MGYV59' },
  'bellevue-biotech':       { yahoo: 'CH0038389992.SW', tradingView: 'SIX:BION', exchange: 'SIX' },
  'fidelity-dividend':      { yahoo: 'LU0605515377.F',  tradingView: 'FIDELITY:LU0605515377' },
  'threadneedle-dividends': { yahoo: 'GB00B6TQRF09.L',  tradingView: 'COLUMBIA:GB00B6TQRF09' },
  'pictet-esg-global':      { yahoo: 'LU0503631714.F',  tradingView: 'PICTET:LU0503631714' },
  'nordea-esg-global':      { yahoo: 'LU0348926287.F',  tradingView: 'NORDEA:LU0348926287' },
  'cohen-steers-reits':     { yahoo: 'LU0209137388.F',  tradingView: 'COHENSTEERS:LU0209137388' },
  'janus-henderson-reits':  { yahoo: 'LU0088927925.F',  tradingView: 'JANUSHENDERSON:LU0088927925' },
};

// Tickers de benchmarks per TradingView
export const BENCHMARK_TICKERS: Record<string, {
  tradingView: string;
  yahoo?: string;
  description: string;
}> = {
  'MSCI World':              { tradingView: 'MSCI:892400',        yahoo: 'URTH',   description: 'MSCI World Index' },
  'S&P 500':                 { tradingView: 'SP:SPX',             yahoo: '^GSPC',  description: 'S&P 500 Index' },
  'MSCI Europe':             { tradingView: 'MSCI:891800',        yahoo: 'IEUR',   description: 'MSCI Europe Index' },
  'MSCI Emerging Markets':   { tradingView: 'MSCI:891900',        yahoo: 'EEM',    description: 'MSCI EM Index' },
  'MSCI World Small Cap':    { tradingView: 'MSCI:MXWOSC',        yahoo: 'WSML',   description: 'MSCI World Small Cap' },
  'Bloomberg Euro Agg':      { tradingView: 'BLOOMBERG:LEATTREU', yahoo: 'IEAG',   description: 'Bloomberg Euro Aggregate' },
  'Bloomberg Global Agg':    { tradingView: 'BLOOMBERG:LGTRTRUU', yahoo: 'AGGG',   description: 'Bloomberg Global Aggregate' },
  'FTSE EPRA NAREIT':        { tradingView: 'FTSE:EPRANAREIT',    yahoo: 'IWDP',   description: 'FTSE EPRA/NAREIT Global' },
  'ESTR':                    { tradingView: 'ECBESTR:ECBESTRRATE', yahoo: undefined, description: 'EUR Short-Term Rate' },
  'Dow Jones Tech':          { tradingView: 'DJ:DJUSTC',          yahoo: '^DJUSTC', description: 'Dow Jones Global Technology' },
  'MSCI World Health Care':  { tradingView: 'MSCI:MXWOHC',        yahoo: 'WHCS',   description: 'MSCI World Health Care' },
  'MSCI World Energy':       { tradingView: 'MSCI:MXWOEN',        yahoo: 'WNRG',   description: 'MSCI World Energy' },
};

// ─── FINANCIAL MODELING PREP API ─────────────────────────────────────────────

export async function fetchFMPData(
  ticker: string,
  fromDate: string,
  toDate: string
): Promise<MarketDataPoint[]> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) throw new Error('FMP_API_KEY no configurada');

  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?from=${fromDate}&to=${toDate}&apikey=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);

  const data = await res.json();
  if (!data.historical || !Array.isArray(data.historical)) {
    throw new Error('FMP: format de resposta inesperat');
  }

  return data.historical
    .map((d: Record<string, number | string>) => ({
      date:          String(d.date),
      open:          Number(d.open),
      high:          Number(d.high),
      low:           Number(d.low),
      close:         Number(d.close),
      volume:        Number(d.volume),
      adjustedClose: Number(d.adjClose),
    }))
    .sort((a: MarketDataPoint, b: MarketDataPoint) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
}

// ─── ALPHA VANTAGE API ────────────────────────────────────────────────────────

export async function fetchAlphaVantageData(
  symbol: string,
  outputSize: 'compact' | 'full' = 'full'
): Promise<MarketDataPoint[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error('ALPHA_VANTAGE_API_KEY no configurada');

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${symbol}&outputsize=${outputSize}&apikey=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Alpha Vantage error: ${res.status}`);

  const data = await res.json();
  const series = data['Monthly Adjusted Time Series'];
  if (!series) throw new Error('Alpha Vantage: no s\'han trobat dades');

  return Object.entries(series)
    .map(([date, values]) => {
      const v = values as Record<string, string>;
      return {
        date,
        open:          parseFloat(v['1. open']),
        high:          parseFloat(v['2. high']),
        low:           parseFloat(v['3. low']),
        close:         parseFloat(v['4. close']),
        volume:        parseFloat(v['6. volume']),
        adjustedClose: parseFloat(v['5. adjusted close']),
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ─── YAHOO FINANCE FALLBACK (via API Route) ───────────────────────────────────

export async function fetchYahooData(
  ticker: string,
  period: '1y' | '2y' | '5y' | '10y' = '5y'
): Promise<MarketDataPoint[]> {
  // Cridem el nostre endpoint intern (evita CORS)
  const res = await fetch(`/api/market-data?ticker=${encodeURIComponent(ticker)}&period=${period}&source=yahoo`);
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);

  const data = await res.json();
  if (!data.prices || !Array.isArray(data.prices)) {
    throw new Error('Yahoo: format de resposta inesperat');
  }

  return data.prices as MarketDataPoint[];
}

// ─── MAIN DATA FETCHER (amb fallback automàtic) ───────────────────────────────

export async function fetchProductData(
  productId: string,
  isin: string,
  period: '1y' | '2y' | '5y' = '5y'
): Promise<FundDataResult> {
  const tickers = PRODUCT_TICKERS[productId];

  // ── Intent 1: Financial Modeling Prep ─────────────────────────────────────
  if (tickers?.fmp && process.env.FMP_API_KEY) {
    try {
      const toDate   = new Date().toISOString().split('T')[0];
      const fromDate = new Date(
        Date.now() - getPeriodMs(period)
      ).toISOString().split('T')[0];

      const prices  = await fetchFMPData(tickers.fmp, fromDate, toDate);
      const returns = calculateMonthlyReturns(prices);

      return {
        productId, isin,
        ticker:      tickers.fmp,
        name:        productId,
        currency:    'EUR',
        prices,
        returns,
        latestPrice: prices[prices.length - 1]?.close,
        latestDate:  prices[prices.length - 1]?.date,
        source:      'fmp',
        status:      'success',
      };
    } catch {
      // Continua amb el fallback
    }
  }

  // ── Intent 2: Alpha Vantage ────────────────────────────────────────────────
  if (tickers?.alphaVantage && process.env.ALPHA_VANTAGE_API_KEY) {
    try {
      const prices  = await fetchAlphaVantageData(tickers.alphaVantage);
      const returns = calculateMonthlyReturns(prices);

      return {
        productId, isin,
        ticker:      tickers.alphaVantage,
        name:        productId,
        currency:    'EUR',
        prices,
        returns,
        latestPrice: prices[prices.length - 1]?.close,
        latestDate:  prices[prices.length - 1]?.date,
        source:      'alphavantage',
        status:      'success',
      };
    } catch {
      // Continua amb el fallback
    }
  }

  // ── Intent 3: Yahoo Finance ────────────────────────────────────────────────
  if (tickers?.yahoo) {
    try {
      const prices  = await fetchYahooData(tickers.yahoo, period);
      const returns = calculateMonthlyReturns(prices);

      return {
        productId, isin,
        ticker:      tickers.yahoo,
        name:        productId,
        currency:    'EUR',
        prices,
        returns,
        latestPrice: prices[prices.length - 1]?.close,
        latestDate:  prices[prices.length - 1]?.date,
        source:      'yahoo',
        status:      'partial',
      };
    } catch {
      // Continua amb simulació
    }
  }

  // ── Fallback final: dades simulades ───────────────────────────────────────
  return buildSimulatedData(productId, isin, period);
}

// ─── TRADINGVIEW WIDGET CONFIG ────────────────────────────────────────────────

export interface TradingViewWidgetConfig {
  symbol: string;
  interval: '1D' | '1W' | '1M';
  theme: 'light' | 'dark';
  locale: string;
  width: string | number;
  height: string | number;
  style: '1' | '2' | '3';       // 1=Candles, 2=Line, 3=Area
  showVolume: boolean;
  allowSymbolChange: boolean;
  studies?: string[];
}

export function getTradingViewConfig(
  productId: string,
  options?: Partial<TradingViewWidgetConfig>
): TradingViewWidgetConfig | null {
  const tickers = PRODUCT_TICKERS[productId];
  if (!tickers?.tradingView) return null;

  return {
    symbol:            tickers.tradingView,
    interval:          '1M',
    theme:             'light',
    locale:            'ca',
    width:             '100%',
    height:            400,
    style:             '2',       // Línia per a fons d'inversió
    showVolume:        false,     // Els fons no mostren volum
    allowSymbolChange: false,
    studies:           ['RSI@tv-basicstudies'],
    ...options,
  };
}

export function getBenchmarkTradingViewConfig(
  benchmarkName: string,
  options?: Partial<TradingViewWidgetConfig>
): TradingViewWidgetConfig | null {
  const benchmark = BENCHMARK_TICKERS[benchmarkName];
  if (!benchmark?.tradingView) return null;

  return {
    symbol:            benchmark.tradingView,
    interval:          '1M',
    theme:             'light',
    locale:            'ca',
    width:             '100%',
    height:            350,
    style:             '3',       // Area per a benchmarks
    showVolume:        false,
    allowSymbolChange: false,
    ...options,
  };
}

// Widget de comparació múltiple (cartera vs benchmark)
export interface TradingViewCompareConfig {
  mainSymbol: string;
  compareSymbols: string[];
  interval: '1D' | '1W' | '1M';
  theme: 'light' | 'dark';
  height: number;
}

export function getComparisonWidgetConfig(
  productIds: string[],
  benchmarkName: string
): TradingViewCompareConfig | null {
  const symbols = productIds
    .map(id => PRODUCT_TICKERS[id]?.tradingView)
    .filter((s): s is string => !!s);

  const benchmarkSymbol = BENCHMARK_TICKERS[benchmarkName]?.tradingView;
  if (!benchmarkSymbol || symbols.length === 0) return null;

  return {
    mainSymbol:     benchmarkSymbol,
    compareSymbols: symbols.slice(0, 4), // TradingView limita comparació
    interval:       '1M',
    theme:          'light',
    height:         450,
  };
}

// ─── TRADINGVIEW SCRIPT LOADER ────────────────────────────────────────────────
// Usar als components React per carregar el widget

export function buildTradingViewScript(config: TradingViewWidgetConfig): string {
  return JSON.stringify({
    autosize:           true,
    symbol:             config.symbol,
    interval:           config.interval,
    timezone:           'Europe/Madrid',
    theme:              config.theme,
    style:              config.style,
    locale:             config.locale,
    enable_publishing:  false,
    allow_symbol_change: config.allowSymbolChange,
    hide_volume:        !config.showVolume,
    hide_side_toolbar:  true,
    studies:            config.studies ?? [],
    container_id:       `tv_${config.symbol.replace(/[^a-zA-Z0-9]/g, '_')}`,
  });
}

// ─── MARKET QUOTE (preu actual) ───────────────────────────────────────────────

export async function fetchMarketQuote(
  productId: string
): Promise<MarketQuote | null> {
  const tickers = PRODUCT_TICKERS[productId];
  if (!tickers) return null;

  // Intent via FMP
  if (tickers.fmp && process.env.FMP_API_KEY) {
    try {
      const url = `https://financialmodelingprep.com/api/v3/quote/${tickers.fmp}?apikey=${process.env.FMP_API_KEY}`;
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (res.ok) {
        const data = await res.json();
        if (data[0]) {
          return {
            symbol:        tickers.fmp,
            name:          data[0].name,
            price:         data[0].price,
            change:        data[0].change,
            changePercent: data[0].changesPercentage,
            currency:      'USD',
            source:        'fmp',
            timestamp:     new Date().toISOString(),
          };
        }
      }
    } catch { /* continua */ }
  }

  return null;
}

// ─── RETURNS CALCULATION ──────────────────────────────────────────────────────

export function calculateMonthlyReturns(prices: MarketDataPoint[]): number[] {
  if (prices.length < 2) return [];

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1].adjustedClose ?? prices[i - 1].close;
    const curr = prices[i].adjustedClose ?? prices[i].close;
    if (prev > 0) {
      returns.push(Math.round(((curr - prev) / prev) * 10000) / 100);
    }
  }
  return returns;
}

// ─── SIMULATED DATA FALLBACK ──────────────────────────────────────────────────

function buildSimulatedData(
  productId: string,
  isin: string,
  period: '1y' | '2y' | '5y'
): FundDataResult {
  const months        = period === '1y' ? 12 : period === '2y' ? 24 : 60;
  const annualReturn  = estimateReturnByProduct(productId);
  const annualVol     = estimateVolByProduct(productId);
  const monthlyReturn = annualReturn / 12 / 100;
  const monthlyVol    = annualVol / Math.sqrt(12) / 100;

  const prices: MarketDataPoint[] = [];
  const returns: number[]         = [];
  let price                       = 100;
  const startDate                 = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  for (let i = 0; i <= months; i++) {
    const date = new Date(startDate);
    date.setMonth(startDate.getMonth() + i);

    if (i > 0) {
      const r = monthlyReturn + monthlyVol * boxMullerRandom();
      price   = Math.max(1, price * (1 + r));
      returns.push(Math.round(r * 10000) / 100);
    }

    prices.push({
      date:         date.toISOString().split('T')[0],
      open:         price,
      high:         price * 1.005,
      low:          price * 0.995,
      close:        price,
      adjustedClose: price,
    });
  }

  return {
    productId, isin,
    name:        productId,
    currency:    'EUR',
    prices,
    returns,
    latestPrice: price,
    latestDate:  prices[prices.length - 1]?.date,
    source:      'simulated',
    status:      'simulated',
    errorMessage: 'Dades simulades. Configura FMP_API_KEY o ALPHA_VANTAGE_API_KEY per a dades reals.',
  };
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function getPeriodMs(period: '1y' | '2y' | '5y'): number {
  const map = { '1y': 365, '2y': 730, '5y': 1825 };
  return map[period] * 24 * 60 * 60 * 1000;
}

function estimateReturnByProduct(productId: string): number {
  if (productId.includes('monetari'))    return 3.0;
  if (productId.includes('rf-curta'))    return 2.5;
  if (productId.includes('rf-global') || productId.includes('rf-europa')) return 3.5;
  if (productId.includes('emergents'))   return 9.0;
  if (productId.includes('small-caps'))  return 10.0;
  if (productId.includes('tecnologia'))  return 12.0;
  if (productId.includes('energia'))     return 7.0;
  if (productId.includes('salut') || productId.includes('healthcare')) return 8.0;
  if (productId.includes('dividend'))    return 6.0;
  if (productId.includes('esg'))         return 7.5;
  if (productId.includes('reits') || productId.includes('immobiliari')) return 6.5;
  return 8.0; // renda variable global per defecte
}

function estimateVolByProduct(productId: string): number {
  if (productId.includes('monetari'))    return 0.5;
  if (productId.includes('rf-curta'))    return 2.0;
  if (productId.includes('rf-global') || productId.includes('rf-europa')) return 5.0;
  if (productId.includes('emergents'))   return 20.0;
  if (productId.includes('small-caps'))  return 18.0;
  if (productId.includes('tecnologia'))  return 22.0;
  if (productId.includes('energia'))     return 25.0;
  if (productId.includes('salut') || productId.includes('healthcare')) return 14.0;
  if (productId.includes('dividend'))    return 10.0;
  if (productId.includes('esg'))         return 13.0;
  if (productId.includes('reits') || productId.includes('immobiliari')) return 15.0;
  return 15.0;
}

function boxMullerRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── DATA STATUS HELPERS ──────────────────────────────────────────────────────

export function getSourceLabel(source: DataSource): string {
  const labels: Record<DataSource, string> = {
    fmp:          '✅ Financial Modeling Prep',
    alphavantage: '✅ Alpha Vantage',
    yahoo:        '⚠️ Yahoo Finance (fallback)',
    tradingview:  '📊 TradingView',
    simulated:    '🔵 Dades simulades',
  };
  return labels[source];
}

export function getSourceColor(source: DataSource): string {
  const colors: Record<DataSource, string> = {
    fmp:          'bg-green-100 text-green-800',
    alphavantage: 'bg-green-100 text-green-800',
    yahoo:        'bg-yellow-100 text-yellow-800',
    tradingview:  'bg-blue-100 text-blue-800',
    simulated:    'bg-gray-100 text-gray-600',
  };
  return colors[source];
}

export function buildDataDisclaimer(source: DataSource): string {
  if (source === 'simulated') {
    return '⚠️ AVÍS: Les dades mostrades són simulades amb paràmetres de mercat de referència. No representen rendibilitats reals ni garanteixen resultats futurs. Configura les claus API per obtenir dades reals.';
  }
  if (source === 'yahoo') {
    return '⚠️ Dades obtingudes via Yahoo Finance com a font alternativa. Pot haver-hi retards o inexactituds. Verifica amb fonts oficials.';
  }
  return '✅ Dades obtingudes de fonts financeres professionals. Tot i així, els rendiments passats no garanteixen rendiments futurs.';
}