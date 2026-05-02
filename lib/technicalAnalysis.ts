// Technical Analysis — port of the audited server.py logic

export interface OHLCV {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  ema20: number[];
  ema50: number[];
  ema200: number[];
  rsi: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  atr: number | null;
  support: number | null;
  resistance: number | null;
  volumeSma: number | null;
}

export interface TradingSignal {
  verdict: 'Comprar' | 'Vendre' | 'Esperar';
  direction: 'long' | 'short' | 'neutral';
  confidence: number;
  entry: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  risk_reward_1: number;
  risk_reward_2: number;
  reasons: string[];
  warnings: string[];
}

export interface FundamentalMetric {
  label: string;
  value: string;
  signal: 'positive' | 'negative' | 'neutral';
}

export interface FundamentalAnalysis {
  verdict: 'Favorable' | 'Débil' | 'Neutral' | 'Datos insuficientes';
  score: number | null;
  summary: string;
  metrics: FundamentalMetric[];
  highlights: string[];
  risks: string[];
}

export interface CombinedVerdict {
  verdict: 'Comprar' | 'Vendre' | 'Esperar';
  score: number;
  summary: string;
}

export interface MarketAnalysis {
  symbol: string;
  asset_type: 'stock' | 'crypto';
  timeframe: string;
  candles: OHLCV[];
  indicators: Indicators;
  signal: TradingSignal;
  fundamental: FundamentalAnalysis;
  combined: CombinedVerdict;
}

// ─── EMA ─────────────────────────────────────────────────────────────────────

export function calcEMA(values: number[], period: number): number[] {
  const result = new Array(values.length).fill(NaN) as number[];
  if (values.length < period) return result;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  result[period - 1] = seed / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

// ─── RSI (Wilder) ─────────────────────────────────────────────────────────────

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss += -d;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// ─── MACD (12/26/9) ──────────────────────────────────────────────────────────

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < 35) return null;
  const e12 = calcEMA(closes, 12);
  const e26 = calcEMA(closes, 26);
  const line: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(e12[i]) && !isNaN(e26[i])) line.push(e12[i] - e26[i]);
  }
  if (line.length < 9) return null;
  const sig = calcEMA(line, 9);
  const lastMacd = line[line.length - 1];
  const lastSig = sig[sig.length - 1];
  if (isNaN(lastSig)) return null;
  return { macd: lastMacd, signal: lastSig, histogram: lastMacd - lastSig };
}

// ─── ATR (14, Wilder) ────────────────────────────────────────────────────────

function calcATR(candles: OHLCV[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i];
    const pc = candles[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - pc), Math.abs(low - pc)));
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

// ─── Support / Resistance (pivot-based) ──────────────────────────────────────

function calcSupportResistance(candles: OHLCV[]): { support: number | null; resistance: number | null } {
  if (candles.length < 5) return { support: null, resistance: null };
  const win = Math.min(60, candles.length);
  const recent = candles.slice(-win);
  const N = 3;
  const highs: number[] = [], lows: number[] = [];
  for (let i = N; i < recent.length - N; i++) {
    if (recent.slice(i - N, i).every(c => c.high <= recent[i].high) &&
        recent.slice(i + 1, i + N + 1).every(c => c.high <= recent[i].high))
      highs.push(recent[i].high);
    if (recent.slice(i - N, i).every(c => c.low >= recent[i].low) &&
        recent.slice(i + 1, i + N + 1).every(c => c.low >= recent[i].low))
      lows.push(recent[i].low);
  }
  const close = candles[candles.length - 1].close;
  const nearLows = lows.filter(v => v <= close).sort((a, b) => b - a);
  const nearHighs = highs.filter(v => v >= close).sort((a, b) => a - b);
  return {
    support: nearLows[0] ?? Math.min(...recent.map(c => c.low)),
    resistance: nearHighs[0] ?? Math.max(...recent.map(c => c.high)),
  };
}

// ─── Volume SMA ──────────────────────────────────────────────────────────────

function calcVolumeSMA(candles: OHLCV[], period = 20): number | null {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  return slice.reduce((s, c) => s + c.volume, 0) / period;
}

// ─── Compute all indicators ──────────────────────────────────────────────────

export function computeIndicators(candles: OHLCV[]): Indicators {
  const closes = candles.map(c => c.close);
  const { support, resistance } = calcSupportResistance(candles);
  return {
    ema20: calcEMA(closes, 20),
    ema50: calcEMA(closes, 50),
    ema200: calcEMA(closes, 200),
    rsi: calcRSI(closes),
    macd: calcMACD(closes),
    atr: calcATR(candles),
    support,
    resistance,
    volumeSma: calcVolumeSMA(candles),
  };
}

// ─── Signal generation ───────────────────────────────────────────────────────

const ATR_MULT: Record<string, number> = { '15m': 1.0, '1h': 1.5, '4h': 2.0, '1d': 2.5 };

export function generateSignal(candles: OHLCV[], ind: Indicators, timeframe: string): TradingSignal {
  const last = candles[candles.length - 1];
  const close = last.close;
  const bullish: string[] = [], bearish: string[] = [], warnings: string[] = [];

  // EMA trend
  const e20 = ind.ema20[ind.ema20.length - 1];
  const e50 = ind.ema50[ind.ema50.length - 1];
  const e200 = ind.ema200[ind.ema200.length - 1];
  const hasEMAs = !isNaN(e20) && !isNaN(e50);

  if (hasEMAs) {
    if (close > e20 && e20 > e50) bullish.push('Precio sobre EMA20/EMA50 alineadas al alza.');
    else if (close < e20 && e20 < e50) bearish.push('Precio bajo EMA20/EMA50 alineadas a la baja.');
    if (!isNaN(e200)) {
      if (close > e200) bullish.push('Precio sobre EMA200: tendencia principal alcista.');
      else bearish.push('Precio bajo EMA200: tendencia principal bajista.');
    }
  }

  // Golden / Death cross
  if (candles.length >= 2 && hasEMAs) {
    const pe20 = ind.ema20[ind.ema20.length - 2];
    const pe50 = ind.ema50[ind.ema50.length - 2];
    if (!isNaN(pe20) && !isNaN(pe50)) {
      if (pe20 <= pe50 && e20 > e50) bullish.push('Golden cross EMA20/EMA50: señal alcista fuerte.');
      else if (pe20 >= pe50 && e20 < e50) bearish.push('Death cross EMA20/EMA50: señal bajista fuerte.');
    }
  }

  // RSI (non-overlapping zones)
  if (ind.rsi !== null) {
    const rsi = ind.rsi;
    if (rsi >= 55 && rsi <= 70) bullish.push('RSI acompaña compra sin sobrecompra extrema.');
    else if (rsi >= 30 && rsi <= 45) bearish.push('RSI débil, favorece presión vendedora.');
    else if (rsi > 72) warnings.push('RSI en sobrecompra: evitar entradas largas tardías.');
    else if (rsi < 28) warnings.push('RSI en sobreventa: cuidado con ventas tardías.');
  }

  // MACD
  if (ind.macd) {
    const { macd, signal, histogram } = ind.macd;
    if (histogram > 0 && macd > signal) bullish.push('MACD positivo y por encima de señal.');
    else if (histogram < 0 && macd < signal) bearish.push('MACD negativo y por debajo de señal.');
    if (Math.abs(histogram) < Math.abs(macd) * 0.1) warnings.push('MACD cerca de cruce: señal débil.');
  }

  // Volume — directional, only to warnings
  if (ind.volumeSma !== null) {
    const ratio = last.volume / ind.volumeSma;
    if (ratio >= 1.05) {
      const dir = last.close >= last.open ? 'alcista' : 'bajista';
      warnings.push(`Volumen ×${ratio.toFixed(1)} con vela ${dir}: confirma movimiento.`);
    }
  }

  // Support/Resistance
  if (ind.support !== null && ind.resistance !== null) {
    const prox = 0.015;
    if (Math.abs(close - ind.support) / close < prox)
      bullish.push('Precio cerca del soporte: zona de potencial rebote.');
    if (Math.abs(close - ind.resistance) / close < prox)
      bearish.push('Precio cerca de resistencia: zona de posible rechazo.');
    const range = ind.resistance - ind.support;
    if (range > 0) {
      const pos = (close - ind.support) / range;
      if (pos < 0.3) bullish.push('Precio en tercio inferior del rango S/R.');
      else if (pos > 0.7) bearish.push('Precio en tercio superior del rango S/R.');
    }
  }

  // Confidence with agreement factor
  const b = bullish.length, be = bearish.length, total = b + be;
  const agreement = total > 0 ? Math.abs(b - be) / total : 0;
  const raw = total > 0 ? Math.max(b, be) / Math.max(total, 5) : 0;
  const confidence = Math.round(Math.min(95, Math.max(10, (raw * 0.7 + agreement * 0.3) * 100)));

  // Verdict
  let verdict: 'Comprar' | 'Vendre' | 'Esperar';
  let direction: 'long' | 'short' | 'neutral';
  const THRESHOLD = 0.6;
  if (b > be && total > 0 && b / total >= THRESHOLD) {
    verdict = 'Comprar'; direction = 'long';
  } else if (be > b && total > 0 && be / total >= THRESHOLD) {
    verdict = 'Vendre'; direction = 'short';
  } else {
    verdict = 'Esperar'; direction = 'neutral';
  }

  // Entry / SL / TP with ATR-adaptive stops
  const atrVal = ind.atr ?? close * 0.02;
  const mult = ATR_MULT[timeframe] ?? 1.5;
  const dist = atrVal * mult;
  const entry = close;
  const isLong = direction !== 'short';
  const stop_loss = isLong ? entry - dist : entry + dist;
  const tp1 = isLong ? entry + dist * 2 : entry - dist * 2;
  const tp2 = isLong ? entry + dist * 3 : entry - dist * 3;

  return {
    verdict, direction, confidence,
    entry: +entry.toFixed(4),
    stop_loss: +stop_loss.toFixed(4),
    take_profit_1: +tp1.toFixed(4),
    take_profit_2: +tp2.toFixed(4),
    risk_reward_1: 2.0,
    risk_reward_2: 3.0,
    reasons: direction === 'long' ? bullish : direction === 'short' ? bearish : [...bullish, ...bearish],
    warnings,
  };
}

// ─── Combined verdict ────────────────────────────────────────────────────────

const TF_WEIGHTS: Record<string, { tech: number; fund: number }> = {
  '15m': { tech: 0.85, fund: 0.15 },
  '1h':  { tech: 0.75, fund: 0.25 },
  '4h':  { tech: 0.55, fund: 0.45 },
  '1d':  { tech: 0.40, fund: 0.60 },
};

export function computeCombined(
  signal: TradingSignal,
  fundamental: FundamentalAnalysis,
  timeframe: string,
): CombinedVerdict {
  const w = TF_WEIGHTS[timeframe] ?? { tech: 0.65, fund: 0.35 };

  const techScore =
    signal.verdict === 'Comprar' ? signal.confidence :
    signal.verdict === 'Vendre' ? -signal.confidence : 0;

  const fundRaw = fundamental.score ?? 50;
  const fundScore = fundamental.verdict === 'Datos insuficientes' ? 0 : (fundRaw - 50) * 2;

  const score = Math.round(techScore * w.tech + fundScore * w.fund);
  const absScore = Math.abs(score);

  let verdict: 'Comprar' | 'Vendre' | 'Esperar';
  if (score >= 30) verdict = 'Comprar';
  else if (score <= -30) verdict = 'Vendre';
  else verdict = 'Esperar';

  const summaries: Record<string, string> = {
    Comprar: `Confluència tècnica i fonamental (${absScore}/100). Condicions favorables per a entrada llarga.`,
    Vendre:  `Pressió tècnica i fonamental (${absScore}/100). Condicions favorables per a sortida o curt.`,
    Esperar: `Senyal mixt (${absScore}/100). Esperar confirmació abans d'operar.`,
  };

  return { verdict, score, summary: summaries[verdict] };
}
