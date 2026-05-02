'use client';

import type { TradingSignal, FundamentalAnalysis, CombinedVerdict } from '@/lib/technicalAnalysis';

const VERDICT_STYLES = {
  Comprar: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-400' },
  Vendre:  { bg: 'bg-red-500/10',   border: 'border-red-500/30',   text: 'text-red-400',   dot: 'bg-red-400'   },
  Esperar: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400' },
};

function VerdictBadge({ verdict, confidence }: { verdict: string; confidence?: number }) {
  const s = VERDICT_STYLES[verdict as keyof typeof VERDICT_STYLES] ?? VERDICT_STYLES.Esperar;
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${s.bg} ${s.border}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      <span className={`font-black text-xl tracking-tight ${s.text}`}>{verdict}</span>
      {confidence !== undefined && (
        <span className={`text-sm font-mono ${s.text} opacity-70`}>{confidence}%</span>
      )}
    </div>
  );
}

function PriceRow({ label, value, sublabel, color }: { label: string; value: string; sublabel?: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-white/40 text-sm">{label}</span>
      <div className="text-right">
        <span className={`font-mono font-semibold text-sm ${color ?? 'text-white/80'}`}>{value}</span>
        {sublabel && <span className="text-white/30 text-xs ml-2">{sublabel}</span>}
      </div>
    </div>
  );
}

interface Props {
  signal: TradingSignal;
  fundamental: FundamentalAnalysis;
  combined: CombinedVerdict;
  rsi: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  atr: number | null;
  support: number | null;
  resistance: number | null;
}

export default function SignalPanel({ signal, fundamental, combined, rsi, macd, atr, support, resistance }: Props) {
  const fmt = (n: number) => {
    if (n >= 1000) return n.toLocaleString('ca-ES', { maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(4);
    return n.toFixed(6);
  };

  return (
    <div className="space-y-4">
      {/* Combined verdict — main */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Veredicte combinat</p>
        <VerdictBadge verdict={combined.verdict} />
        <p className="text-white/50 text-sm mt-3 leading-relaxed">{combined.summary}</p>
      </div>

      {/* Technical signal */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/40 text-xs uppercase tracking-widest">Senyal tècnic</p>
          <VerdictBadge verdict={signal.verdict} confidence={signal.confidence} />
        </div>

        {/* Entry / SL / TP grid */}
        <div className="space-y-0">
          <PriceRow label="Entrada" value={fmt(signal.entry)} />
          <PriceRow label="Stop Loss" value={fmt(signal.stop_loss)} color="text-red-400" />
          <PriceRow label="TP1 (R:2)" value={fmt(signal.take_profit_1)} color="text-green-400" sublabel="×2" />
          <PriceRow label="TP2 (R:3)" value={fmt(signal.take_profit_2)} color="text-green-400" sublabel="×3" />
        </div>

        {/* Reasons */}
        {signal.reasons.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {signal.reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>{r}
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {signal.warnings.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {signal.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-400/80">
                <span className="flex-shrink-0 mt-0.5">⚠</span>{w}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Indicators */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Indicadors</p>
        <div className="space-y-0">
          {rsi !== null && (
            <PriceRow
              label="RSI (14)"
              value={rsi.toFixed(1)}
              color={rsi > 70 ? 'text-red-400' : rsi < 30 ? 'text-green-400' : 'text-white/80'}
            />
          )}
          {macd && (
            <>
              <PriceRow label="MACD" value={macd.macd.toFixed(4)} color={macd.macd > 0 ? 'text-green-400' : 'text-red-400'} />
              <PriceRow label="MACD histograma" value={macd.histogram.toFixed(4)} color={macd.histogram > 0 ? 'text-green-400' : 'text-red-400'} />
            </>
          )}
          {atr !== null && <PriceRow label="ATR (14)" value={fmt(atr)} />}
          {support !== null && <PriceRow label="Suport" value={fmt(support)} color="text-green-400/70" />}
          {resistance !== null && <PriceRow label="Resistència" value={fmt(resistance)} color="text-red-400/70" />}
        </div>
      </div>

      {/* Fundamental */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/40 text-xs uppercase tracking-widest">Anàlisi fonamental</p>
          {fundamental.score !== null ? (
            <span className="text-[#c9a84c] font-mono font-bold">{fundamental.score}/100</span>
          ) : (
            <span className="text-white/30 text-xs">sense dades</span>
          )}
        </div>

        {fundamental.verdict !== 'Datos insuficientes' ? (
          <>
            <div className="space-y-0 mb-4">
              {fundamental.metrics.map((m, i) => (
                <PriceRow
                  key={i}
                  label={m.label}
                  value={m.value}
                  color={m.signal === 'positive' ? 'text-green-400' : m.signal === 'negative' ? 'text-red-400' : 'text-white/60'}
                />
              ))}
            </div>
            {fundamental.highlights.length > 0 && (
              <div className="space-y-1">
                {fundamental.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-green-400/80">
                    <span className="flex-shrink-0 mt-0.5">+</span>{h}
                  </div>
                ))}
              </div>
            )}
            {fundamental.risks.length > 0 && (
              <div className="mt-2 space-y-1">
                {fundamental.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-400/80">
                    <span className="flex-shrink-0 mt-0.5">−</span>{r}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-white/30 text-sm">{fundamental.summary}</p>
        )}
      </div>
    </div>
  );
}
