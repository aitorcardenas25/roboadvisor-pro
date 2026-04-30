// app/api/market-data/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker  = searchParams.get('ticker');
  const period  = searchParams.get('period') ?? '5y';
  const source  = searchParams.get('source') ?? 'yahoo';

  if (!ticker) {
    return NextResponse.json({ error: 'ticker requerit' }, { status: 400 });
  }

  try {
    if (source === 'yahoo') {
      const periodMap: Record<string, string> = {
        '1y': '1y', '2y': '2y', '5y': '5y', '10y': '10y',
      };
      const yPeriod = periodMap[period] ?? '5y';

      // Yahoo Finance v8 (sense API key, ús educatiu)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=${yPeriod}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 3600 },
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: `Yahoo error: ${res.status}`, prices: [] },
          { status: 200 }
        );
      }

      const data    = await res.json();
      const chart   = data?.chart?.result?.[0];
      const timestamps: number[] = chart?.timestamp ?? [];
      const closes: number[]     = chart?.indicators?.adjclose?.[0]?.adjclose
                                ?? chart?.indicators?.quote?.[0]?.close
                                ?? [];
      const opens: number[]      = chart?.indicators?.quote?.[0]?.open   ?? [];
      const highs: number[]      = chart?.indicators?.quote?.[0]?.high   ?? [];
      const lows: number[]       = chart?.indicators?.quote?.[0]?.low    ?? [];

      const prices = timestamps.map((ts, i) => ({
        date:          new Date(ts * 1000).toISOString().split('T')[0],
        open:          opens[i]  ?? closes[i] ?? 0,
        high:          highs[i]  ?? closes[i] ?? 0,
        low:           lows[i]   ?? closes[i] ?? 0,
        close:         closes[i] ?? 0,
        adjustedClose: closes[i] ?? 0,
      })).filter(p => p.close > 0);

      return NextResponse.json({ prices, source: 'yahoo', ticker });
    }

    return NextResponse.json({ error: 'Font no suportada', prices: [] }, { status: 400 });

  } catch (error) {
    return NextResponse.json(
      { error: String(error), prices: [] },
      { status: 200 } // 200 per no trencar el fallback
    );
  }
}