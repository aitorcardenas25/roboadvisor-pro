'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { OHLCV } from '@/lib/technicalAnalysis';

interface Props {
  candles: OHLCV[];
  ema20: number[];
  ema50: number[];
  ema200: number[];
  support: number | null;
  resistance: number | null;
}

export default function CandlestickChart({ candles, ema20, ema50, ema200, support, resistance }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background:  { type: ColorType.Solid, color: 'transparent' },
        textColor:   'rgba(255,255,255,0.5)',
        fontSize:    11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: {
        borderColor:    'rgba(255,255,255,0.1)',
        timeVisible:    true,
        secondsVisible: false,
      },
      width:  containerRef.current.clientWidth,
      height: 340,
    });
    chartRef.current = chart;

    // Candlesticks
    const cs = chart.addSeries(CandlestickSeries, {
      upColor:         '#22c55e',
      downColor:       '#ef4444',
      borderUpColor:   '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor:     '#22c55e',
      wickDownColor:   '#ef4444',
    });
    cs.setData(candles.map(c => ({
      time:  c.time as UTCTimestamp,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    })));

    // EMA helper
    const addLine = (values: number[], color: string) => {
      const s = chart.addSeries(LineSeries, {
        color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      s.setData(
        candles
          .map((c, i) => ({ time: c.time as UTCTimestamp, value: values[i] }))
          .filter(p => !isNaN(p.value))
      );
    };
    addLine(ema20,  '#f59e0b');
    addLine(ema50,  '#3b82f6');
    addLine(ema200, '#a855f7');

    // Support / Resistance
    const addLevel = (price: number, color: string) => {
      const s = chart.addSeries(LineSeries, {
        color, lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: true,
      });
      s.setData([
        { time: candles[0].time as UTCTimestamp, value: price },
        { time: candles[candles.length - 1].time as UTCTimestamp, value: price },
      ]);
    };
    if (support    !== null) addLevel(support,    '#22c55e');
    if (resistance !== null) addLevel(resistance, '#ef4444');

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, ema20, ema50, ema200, support, resistance]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full rounded-xl overflow-hidden" />
      <div className="absolute top-2 left-3 flex gap-3 text-[10px] font-mono pointer-events-none select-none">
        <span className="flex items-center gap-1 text-amber-400/80"><span className="inline-block w-4 h-0.5 bg-amber-400" />EMA20</span>
        <span className="flex items-center gap-1 text-blue-400/80"><span className="inline-block w-4 h-0.5 bg-blue-500" />EMA50</span>
        <span className="flex items-center gap-1 text-purple-400/80"><span className="inline-block w-4 h-0.5 bg-purple-500" />EMA200</span>
      </div>
    </div>
  );
}
