// app/api/market-data/route.ts
// Endpoint llegat per compatibilitat + nova delegació al servei.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/lib/authOptions';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'authorized' && role !== 'admin') {
    return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const ticker  = searchParams.get('ticker');
  const period  = searchParams.get('period') ?? '5y';
  const source  = searchParams.get('source') ?? 'yahoo';

  if (!ticker) return NextResponse.json({ error: 'ticker requerit' }, { status: 400 });
  if (!/^[A-Z0-9.\-^=]{1,20}$/i.test(ticker)) {
    return NextResponse.json({ error: 'ticker no vàlid' }, { status: 400 });
  }

  try {
    // FMP (server-side, amb API key)
    if (source === 'fmp' && process.env.FMP_API_KEY) {
      const months   = period === '1y' ? 12 : period === '2y' ? 24 : 60;
      const toDate   = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - months * 30.5 * 86400000).toISOString().split('T')[0];
      const url      = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?from=${fromDate}&to=${toDate}&apikey=${process.env.FMP_API_KEY}`;
      const res      = await fetch(url, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        const prices = (data.historical ?? []).map((d: Record<string, number | string>) => ({
          date: d.date, open: d.open, high: d.high, low: d.low,
          close: d.close, adjustedClose: d.adjClose ?? d.close, volume: d.volume,
        })).sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
        return NextResponse.json({ prices, source: 'fmp', ticker });
      }
    }

    // Yahoo Finance (sense API key)
    const periodMap: Record<string, string> = { '1y': '1y', '2y': '2y', '5y': '5y', '10y': '10y' };
    const yPeriod = periodMap[period] ?? '5y';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=${yPeriod}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; factorOTC/1.0)' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return NextResponse.json({ error: `Yahoo error: ${res.status}`, prices: [] }, { status: 200 });

    const data    = await res.json();
    const chart   = data?.chart?.result?.[0];
    const timestamps: number[] = chart?.timestamp ?? [];
    const closes: number[]     = chart?.indicators?.adjclose?.[0]?.adjclose ?? chart?.indicators?.quote?.[0]?.close ?? [];
    const opens: number[]      = chart?.indicators?.quote?.[0]?.open  ?? [];
    const highs: number[]      = chart?.indicators?.quote?.[0]?.high  ?? [];
    const lows: number[]       = chart?.indicators?.quote?.[0]?.low   ?? [];

    const prices = timestamps
      .map((ts, i) => ({
        date:          new Date(ts * 1000).toISOString().split('T')[0],
        open:          opens[i]  ?? closes[i] ?? 0,
        high:          highs[i]  ?? closes[i] ?? 0,
        low:           lows[i]   ?? closes[i] ?? 0,
        close:         closes[i] ?? 0,
        adjustedClose: closes[i] ?? 0,
      }))
      .filter(p => p.close > 0);

    return NextResponse.json({ prices, source: 'yahoo', ticker });

  } catch (error) {
    return NextResponse.json({ error: String(error), prices: [] }, { status: 200 });
  }
}
