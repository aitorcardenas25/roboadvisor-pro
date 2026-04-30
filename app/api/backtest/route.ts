// app/api/backtest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFMPData,
  fetchAlphaVantageData,
  calculateMonthlyReturns,
  PRODUCT_TICKERS,
} from '@/lib/marketData';
import {
  calculateAnnualizedReturn,
  calculateAnnualizedVolatility,
  calculateMaxDrawdown,
} from '@/lib/metrics';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface BacktestRequest {
  allocations: {
    productId: string;
    isin:      string;
    weight:    number;
  }[];
  startDate:   string; // YYYY-MM-DD
  endDate:     string; // YYYY-MM-DD
  initialAmount: number;
}

interface BacktestResult {
  portfolioSeries:  SeriesPoint[];
  benchmarkSeries:  SeriesPoint[];
  metrics: {
    portfolioReturn:    number;
    benchmarkReturn:    number;
    portfolioVol:       number;
    benchmarkVol:       number;
    portfolioSharpe:    number;
    portfolioMaxDD:     number;
    benchmarkMaxDD:     number;
    excess:             number;
  };
  dataQuality: {
    productsWithData:   number;
    productsSimulated:  number;
    totalProducts:      number;
    note:               string;
  };
  status: 'success' | 'partial' | 'simulated';
}

interface SeriesPoint {
  date:  string;
  value: number;
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as BacktestRequest;
    const { allocations, startDate, endDate, initialAmount } = body;

    // Validació bàsica
    if (!allocations?.length || !startDate || !endDate || !initialAmount) {
      return NextResponse.json(
        { error: 'Paràmetres incomplets: allocations, startDate, endDate i initialAmount són obligatoris.' },
        { status: 400 }
      );
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return NextResponse.json(
        { error: 'startDate ha de ser anterior a endDate.' },
        { status: 400 }
      );
    }

    // ── Obtenir dades de cada producte ────────────────────────────────────────
    const productDataMap = new Map<string, number[]>();
    let productsWithData = 0;
    let productsSimulated = 0;

    for (const alloc of allocations) {
      const tickers = PRODUCT_TICKERS[alloc.productId];
      let returns:   number[] = [];
      let gotData    = false;

      // Intent 1: FMP
      if (tickers?.fmp && process.env.FMP_API_KEY) {
        try {
          const prices = await fetchFMPData(tickers.fmp, startDate, endDate);
          returns      = calculateMonthlyReturns(prices);
          if (returns.length > 0) { gotData = true; productsWithData++; }
        } catch { /* continua */ }
      }

      // Intent 2: Alpha Vantage
      if (!gotData && tickers?.alphaVantage && process.env.ALPHA_VANTAGE_API_KEY) {
        try {
          const prices = await fetchAlphaVantageData(tickers.alphaVantage);
          returns      = filterReturnsByDate(prices.map((_, i) => 0), startDate, endDate);
          returns      = calculateMonthlyReturns(
            (await fetchAlphaVantageData(tickers.alphaVantage))
              .filter(p => p.date >= startDate && p.date <= endDate)
          );
          if (returns.length > 0) { gotData = true; productsWithData++; }
        } catch { /* continua */ }
      }

      // Fallback: simular retorns
      if (!gotData) {
        returns = simulateReturns(alloc.productId, startDate, endDate);
        productsSimulated++;
      }

      productDataMap.set(alloc.productId, returns);
    }

    // ── Construir sèrie de la cartera ─────────────────────────────────────────
    const minLength = Math.min(
      ...Array.from(productDataMap.values()).map(r => r.length)
    );

    if (minLength === 0) {
      return NextResponse.json(
        { error: 'No s\'han pogut obtenir dades suficients per al backtest.' },
        { status: 422 }
      );
    }

    const portfolioReturns: number[] = [];
    for (let i = 0; i < minLength; i++) {
      let periodReturn = 0;
      for (const alloc of allocations) {
        const returns = productDataMap.get(alloc.productId) ?? [];
        periodReturn += (returns[i] ?? 0) * (alloc.weight / 100);
      }
      portfolioReturns.push(periodReturn);
    }

    // ── Construir sèrie temporal ──────────────────────────────────────────────
    const portfolioSeries = buildValueSeries(
      portfolioReturns,
      initialAmount,
      startDate
    );

    // ── Benchmark simulat (MSCI World aproximat) ──────────────────────────────
    const benchmarkReturns = simulateBenchmarkReturns(
      startDate, endDate, 8.0, 15.0 // 8% return, 15% vol
    );
    const benchmarkSeries  = buildValueSeries(
      benchmarkReturns.slice(0, minLength),
      initialAmount,
      startDate
    );

    // ── Mètriques ─────────────────────────────────────────────────────────────
    const riskFreeRate       = 3.0;
    const portfolioReturn    = calculateAnnualizedReturn(portfolioReturns);
    const portfolioVol       = calculateAnnualizedVolatility(portfolioReturns);
    const portfolioSharpe    = portfolioVol > 0
      ? (portfolioReturn - riskFreeRate) / portfolioVol : 0;
    const portfolioMaxDD     = calculateMaxDrawdown(portfolioReturns);
    const benchmarkReturn    = calculateAnnualizedReturn(benchmarkReturns.slice(0, minLength));
    const benchmarkVol       = calculateAnnualizedVolatility(benchmarkReturns.slice(0, minLength));
    const benchmarkMaxDD     = calculateMaxDrawdown(benchmarkReturns.slice(0, minLength));

    const status: BacktestResult['status'] =
      productsSimulated === allocations.length ? 'simulated'
      : productsSimulated > 0                  ? 'partial'
      : 'success';

    const result: BacktestResult = {
      portfolioSeries,
      benchmarkSeries,
      metrics: {
        portfolioReturn:   Math.round(portfolioReturn  * 100) / 100,
        benchmarkReturn:   Math.round(benchmarkReturn  * 100) / 100,
        portfolioVol:      Math.round(portfolioVol     * 100) / 100,
        benchmarkVol:      Math.round(benchmarkVol     * 100) / 100,
        portfolioSharpe:   Math.round(portfolioSharpe  * 100) / 100,
        portfolioMaxDD:    Math.round(portfolioMaxDD   * 100) / 100,
        benchmarkMaxDD:    Math.round(benchmarkMaxDD   * 100) / 100,
        excess:            Math.round((portfolioReturn - benchmarkReturn) * 100) / 100,
      },
      dataQuality: {
        productsWithData,
        productsSimulated,
        totalProducts: allocations.length,
        note: status === 'simulated'
          ? '⚠️ Totes les dades són simulades. Configura FMP_API_KEY per a dades reals.'
          : status === 'partial'
          ? `⚠️ ${productsSimulated} de ${allocations.length} productes utilitzen dades simulades.`
          : '✅ Backtest calculat amb dades reals de mercat.',
      },
      status,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[backtest] Error:', error);
    return NextResponse.json(
      { error: 'Error intern del servidor durant el backtest.' },
      { status: 500 }
    );
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildValueSeries(
  monthlyReturns: number[],
  initialAmount:  number,
  startDate:      string
): SeriesPoint[] {
  const series: SeriesPoint[] = [];
  let value = initialAmount;

  const start = new Date(startDate);

  series.push({
    date:  startDate,
    value: Math.round(value * 100) / 100,
  });

  for (let i = 0; i < monthlyReturns.length; i++) {
    value = value * (1 + monthlyReturns[i] / 100);
    value = Math.max(0, value);

    const date = new Date(start);
    date.setMonth(start.getMonth() + i + 1);

    series.push({
      date:  date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
    });
  }

  return series;
}

function filterReturnsByDate(
  returns:   number[],
  startDate: string,
  endDate:   string
): number[] {
  // Filtre simple: retorna el subconjunt de retorns dins del rang de dates
  const start  = new Date(startDate).getTime();
  const end    = new Date(endDate).getTime();
  const totalMs = end - start;
  const months  = Math.round(totalMs / (30 * 24 * 60 * 60 * 1000));
  return returns.slice(0, Math.min(months, returns.length));
}

function simulateReturns(
  productId: string,
  startDate: string,
  endDate:   string
): number[] {
  const start  = new Date(startDate);
  const end    = new Date(endDate);
  const months = Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );

  const annualReturn = getEstimatedReturn(productId);
  const annualVol    = getEstimatedVol(productId);
  const monthlyR     = annualReturn / 12 / 100;
  const monthlyVol   = annualVol / Math.sqrt(12) / 100;

  return Array.from({ length: months }, () =>
    (monthlyR + monthlyVol * boxMuller()) * 100
  );
}

function simulateBenchmarkReturns(
  startDate:    string,
  endDate:      string,
  annualReturn: number,
  annualVol:    number
): number[] {
  const start  = new Date(startDate);
  const end    = new Date(endDate);
  const months = Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );

  const monthlyR   = annualReturn / 12 / 100;
  const monthlyVol = annualVol / Math.sqrt(12) / 100;

  return Array.from({ length: months }, () =>
    (monthlyR + monthlyVol * boxMuller()) * 100
  );
}

function getEstimatedReturn(productId: string): number {
  if (productId.includes('monetari'))   return 3.0;
  if (productId.includes('rf-curta'))   return 2.5;
  if (productId.includes('rf-'))        return 3.5;
  if (productId.includes('emergents'))  return 9.0;
  if (productId.includes('small-caps')) return 10.0;
  if (productId.includes('tecnologia')) return 12.0;
  if (productId.includes('energia'))    return 7.0;
  if (productId.includes('salut') || productId.includes('healthcare')) return 8.0;
  if (productId.includes('dividend'))   return 6.0;
  if (productId.includes('esg'))        return 7.5;
  if (productId.includes('reits'))      return 6.5;
  return 8.0;
}

function getEstimatedVol(productId: string): number {
  if (productId.includes('monetari'))   return 0.5;
  if (productId.includes('rf-curta'))   return 2.0;
  if (productId.includes('rf-'))        return 5.0;
  if (productId.includes('emergents'))  return 20.0;
  if (productId.includes('small-caps')) return 18.0;
  if (productId.includes('tecnologia')) return 22.0;
  if (productId.includes('energia'))    return 25.0;
  if (productId.includes('salut') || productId.includes('healthcare')) return 14.0;
  if (productId.includes('dividend'))   return 10.0;
  if (productId.includes('esg'))        return 13.0;
  if (productId.includes('reits'))      return 15.0;
  return 15.0;
}

function boxMuller(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}