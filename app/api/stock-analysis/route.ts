import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { generateStockReport, type StockReportData } from '@/lib/stockReport';
import { getYahooCrumb } from '@/lib/yahooFinance';
import { getStockDetail } from '@/lib/stocksData';

const TICKER_RE = /^[A-Z0-9.\-\^]{1,15}$/i;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const BASE_H: Record<string, string> = {
  'User-Agent':      UA,
  'Accept':          'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer':         'https://finance.yahoo.com/',
  'Origin':          'https://finance.yahoo.com',
};

async function yahooGet(url: string, crumbData?: { crumb: string; cookie: string } | null): Promise<Response | null> {
  const headers: Record<string, string> = { ...BASE_H };
  if (crumbData?.cookie) headers['Cookie'] = crumbData.cookie;

  // Build URL variants trying: crumb+cookie, no-crumb+cookie, bare — on both query1 and query2
  const withCrumb = (crumbData?.crumb)
    ? `${url}&crumb=${encodeURIComponent(crumbData.crumb)}` : null;
  const urls: string[] = [
    ...(withCrumb ? [withCrumb, withCrumb.replace('query1.', 'query2.')] : []),
    url,
    url.replace('query1.', 'query2.'),
    url.replace('/v7/', '/v8/'),
    url.replace('query1.', 'query2.').replace('/v7/', '/v8/'),
  ];

  for (const u of urls) {
    try {
      const r = await fetch(u, { headers, cache: 'no-store' });
      if (r.ok) return r;
    } catch { continue; }
  }
  return null;
}

function raw(obj: Record<string, unknown> | undefined, key: string): number | null {
  const v = (obj?.[key] as { raw?: number } | null)?.raw ?? null;
  return typeof v === 'number' && isFinite(v) ? v : null;
}

function formatEarningsDate(ts: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function fetchStockData(ticker: string): Promise<StockReportData> {
  const sym   = encodeURIComponent(ticker.toUpperCase());
  const mods  = 'summaryDetail,financialData,defaultKeyStatistics,price,assetProfile,calendarEvents,earningsTrend,earningsHistory';
  const qsUrl = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${sym}?modules=${mods}`;
  const chUrl = `https://query1.finance.yahoo.com/v7/finance/chart/${sym}?interval=1d&range=1y`;

  // Get crumb/cookie first, then fetch in parallel
  const crumbData = await getYahooCrumb();
  const [qsRes, chRes] = await Promise.all([yahooGet(qsUrl, crumbData), yahooGet(chUrl, crumbData)]);

  let base: StockReportData = {
    ticker: ticker.toUpperCase(),
    name: '', description: '', sector: '', industry: '', website: '', country: '',
    price: 0, change: 0, changePercent: 0, currency: 'USD', exchange: '',
    marketCap: null, volume: 0, avgVolume: null,
    week52High: null, week52Low: null,
    pe: null, forwardPE: null, eps: null,
    revenue: null, revenueGrowth: null, profitMargin: null,
    roe: null, debtToEquity: null, beta: null, dividendYield: null,
    lastEarningsDate: null, nextEarningsDate: null,
    epsLastQActual: null, epsLastQEstimate: null, epsLastQSurprise: null, epsLastQDate: null,
    epsNextQEstimate: null, epsNextQDate: null, revenueNextQEst: null,
    generatedAt: new Date().toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    source: 'minimal',
  };

  // Chart data (more reliable — v7 endpoint)
  if (chRes) {
    try {
      const j   = await chRes.json();
      const r   = j?.chart?.result?.[0];
      const meta = r?.meta ?? {};
      if (meta.regularMarketPrice) {
        base.price         = meta.regularMarketPrice;
        base.change        = meta.regularMarketPrice - (meta.chartPreviousClose ?? meta.regularMarketPrice);
        base.changePercent = base.change / (meta.chartPreviousClose ?? base.price) * 100;
        base.currency      = meta.currency ?? 'USD';
        base.exchange      = meta.exchangeName ?? meta.fullExchangeName ?? '';
        base.marketCap     = meta.marketCap ?? null;
        base.volume        = meta.regularMarketVolume ?? 0;
        base.week52High    = meta.fiftyTwoWeekHigh ?? null;
        base.week52Low     = meta.fiftyTwoWeekLow  ?? null;
        base.name          = meta.shortName ?? meta.longName ?? ticker.toUpperCase();
        base.source        = 'partial';
      }
    } catch { /* use base */ }
  }

  // QuoteSummary (fundamentals)
  if (qsRes) {
    try {
      const j   = await qsRes.json();
      const r   = j?.quoteSummary?.result?.[0];
      if (r) {
        const sd  = r.summaryDetail          as Record<string, unknown> ?? {};
        const fd  = r.financialData          as Record<string, unknown> ?? {};
        const ks  = r.defaultKeyStatistics   as Record<string, unknown> ?? {};
        const pr  = r.price                  as Record<string, unknown> ?? {};
        const ap  = r.assetProfile           as Record<string, unknown> ?? {};
        const ce  = r.calendarEvents         as Record<string, unknown> ?? {};
        const et  = r.earningsTrend          as Record<string, unknown> ?? {};
        const eh  = r.earningsHistory        as Record<string, unknown> ?? {};

        base.name          = (pr.longName ?? pr.shortName ?? base.name) as string;
        base.description   = (ap.longBusinessSummary ?? '') as string;
        base.sector        = (ap.sector   ?? '') as string;
        base.industry      = (ap.industry ?? '') as string;
        base.website       = (ap.website  ?? '') as string;
        base.country       = (ap.country  ?? '') as string;

        if (base.price === 0) {
          base.price         = raw(pr as Record<string, unknown>, 'regularMarketPrice') ?? 0;
          base.changePercent = raw(pr as Record<string, unknown>, 'regularMarketChangePercent') ?? 0;
          base.change        = raw(pr as Record<string, unknown>, 'regularMarketChange') ?? 0;
          base.currency      = (pr.currency ?? 'USD') as string;
          base.marketCap     = raw(pr as Record<string, unknown>, 'marketCap');
          base.volume        = raw(pr as Record<string, unknown>, 'regularMarketVolume') ?? 0;
        }

        base.pe            = raw(sd, 'trailingPE')     ?? raw(sd, 'trailingPE');
        base.forwardPE     = raw(sd, 'forwardPE');
        base.beta          = raw(sd, 'beta');
        base.dividendYield = raw(sd, 'dividendYield');
        base.week52High    = base.week52High ?? raw(sd, 'fiftyTwoWeekHigh');
        base.week52Low     = base.week52Low  ?? raw(sd, 'fiftyTwoWeekLow');
        base.avgVolume     = raw(sd, 'averageVolume');

        base.eps           = raw(ks, 'trailingEps');
        base.revenue       = raw(fd, 'totalRevenue');
        base.revenueGrowth = raw(fd, 'revenueGrowth');
        base.profitMargin  = raw(fd, 'profitMargins');
        base.roe           = raw(fd, 'returnOnEquity');
        base.debtToEquity  = raw(fd, 'debtToEquity');

        // Earnings dates — calendarEvents.earnings.earningsDate is an array [next, ...]
        const ceEarnings   = (ce.earnings as Record<string, unknown> | undefined);
        const earningsDates = (ceEarnings?.earningsDate as { raw?: number }[] | undefined) ?? [];
        const now = Date.now() / 1000;
        const pastDates = earningsDates.filter(d => (d.raw ?? 0) < now);
        const futureDates = earningsDates.filter(d => (d.raw ?? 0) >= now);
        base.lastEarningsDate = formatEarningsDate(pastDates[pastDates.length - 1]?.raw ?? null);
        base.nextEarningsDate = formatEarningsDate(futureDates[0]?.raw ?? null);

        // Quarterly EPS from earningsHistory (last reported quarter)
        const ehHistory = (eh.history as Record<string, unknown>[] | undefined) ?? [];
        if (ehHistory.length > 0) {
          const lastQ = ehHistory[0] as Record<string, unknown>;
          base.epsLastQActual   = (lastQ.epsActual   as { raw?: number } | undefined)?.raw ?? null;
          base.epsLastQEstimate = (lastQ.epsEstimate  as { raw?: number } | undefined)?.raw ?? null;
          base.epsLastQSurprise = (lastQ.surprisePercent as { raw?: number } | undefined)?.raw ?? null;
          const qTs = (lastQ.quarter as { raw?: number } | undefined)?.raw ?? null;
          base.epsLastQDate = qTs ? new Date(qTs * 1000).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : null;
        }

        // Next quarter consensus from earningsTrend
        const etTrend = (et.trend as Record<string, unknown>[] | undefined) ?? [];
        const nextQTrend = etTrend.find(t => t.period === '0q' || t.period === '+1q') as Record<string, unknown> | undefined;
        if (nextQTrend) {
          base.epsNextQEstimate = (nextQTrend.earningsEstimate as Record<string, unknown> | undefined)?.['avg']
            ? ((nextQTrend.earningsEstimate as Record<string, { raw?: number }>)?.['avg']?.raw ?? null) : null;
          base.revenueNextQEst  = (nextQTrend.revenueEstimate  as Record<string, unknown> | undefined)?.['avg']
            ? ((nextQTrend.revenueEstimate  as Record<string, { raw?: number }>)?.['avg']?.raw ?? null) : null;
          const endDateTs = (nextQTrend.endDate as { raw?: number } | undefined)?.raw ?? null;
          base.epsNextQDate = endDateTs ? new Date(endDateTs * 1000).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : null;
        }

        base.source = 'yahoo';
      }
    } catch { /* partial data is fine */ }
  }

  // Allow minimal reports (TradingView chart still works even without live data)
  if (base.price === 0) base.source = 'minimal';

  return base;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Accés no autoritzat. Inicia sessió per generar informes.' }, { status: 401 });
  }

  const ticker = (req.nextUrl.searchParams.get('ticker') ?? '').trim().toUpperCase();
  if (!ticker || !TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: 'Ticker invàlid. Usa format: AAPL, MSFT, SAN.MC, ^IBEX' }, { status: 400 });
  }

  try {
    const data = await fetchStockData(ticker);

    // Enrich with curated static data when Yahoo returns nothing useful
    const staticDetail = getStockDetail(ticker);
    if (staticDetail) {
      if (!data.name || data.name === ticker)  data.name        = staticDetail.name;
      if (!data.description)                   data.description = staticDetail.description;
      if (!data.sector)                        data.sector      = staticDetail.sector;
      if (!data.exchange)                      data.exchange    = staticDetail.exchange;
      if (!data.currency)                      data.currency    = staticDetail.currency;
      if (data.price === 0)                  { data.price = staticDetail.refPrice; data.changePercent = staticDetail.refChange; data.change = staticDetail.refPrice * staticDetail.refChange / 100; }
      if (data.pe            == null)          data.pe            = staticDetail.pe;
      if (data.eps           == null)          data.eps           = staticDetail.eps;
      if (data.revenue       == null && staticDetail.revenueB)  data.revenue = staticDetail.revenueB * 1e9;
      if (data.revenueGrowth == null && staticDetail.revenueGrowth != null) data.revenueGrowth = staticDetail.revenueGrowth / 100;
      if (data.profitMargin  == null && staticDetail.margin     != null) data.profitMargin  = staticDetail.margin / 100;
      if (data.roe           == null && staticDetail.roe         != null) data.roe           = staticDetail.roe / 100;
      if (data.beta          == null)          data.beta          = staticDetail.beta;
      if (data.epsLastQActual   == null)       data.epsLastQActual   = staticDetail.lastQEpsAct;
      if (data.epsLastQEstimate == null)       data.epsLastQEstimate = staticDetail.lastQEpsEst;
      if (data.epsLastQDate     == null)       data.epsLastQDate     = staticDetail.lastQDate;
      if (data.epsNextQEstimate == null)       data.epsNextQEstimate = staticDetail.nextQEpsEst;
      if (data.epsNextQDate     == null)       data.epsNextQDate     = staticDetail.nextQDate;
      if (data.source === 'minimal')           data.source = 'partial';
    }

    const html = generateStockReport(data);
    return new NextResponse(html, {
      headers: {
        'Content-Type':        'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="factor-otc-informe-${ticker}.html"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconegut';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
