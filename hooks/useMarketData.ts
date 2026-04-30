'use client';
// hooks/useMarketData.ts
// Hook per obtenir dades de mercat en temps real

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MarketDataPoint } from '@/types';

export interface MarketDataState {
  prices:   MarketDataPoint[];
  loading:  boolean;
  error:    string | null;
  source:   string;
  lastFetch: number | null;
}

export function useMarketData(
  ticker:   string | null,
  period:   '1y' | '2y' | '5y' | '10y' = '5y',
  enabled:  boolean = true
) {
  const [state, setState] = useState<MarketDataState>({
    prices:    [],
    loading:   false,
    error:     null,
    source:    '',
    lastFetch: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!ticker || !enabled) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const res = await fetch(
        `/api/market-data?ticker=${encodeURIComponent(ticker)}&period=${period}`,
        { signal: abortRef.current.signal }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setState({
        prices:    data.prices ?? [],
        loading:   false,
        error:     data.error ?? null,
        source:    data.source ?? 'unknown',
        lastFetch: Date.now(),
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState(s => ({
        ...s,
        loading: false,
        error:   err instanceof Error ? err.message : 'Error carregant dades',
      }));
    }
  }, [ticker, period, enabled]);

  useEffect(() => {
    fetchData();
    return () => { abortRef.current?.abort(); };
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

export function useMultiMarketData(
  tickers: string[],
  period:  '1y' | '2y' | '5y' | '10y' = '5y'
) {
  const [dataMap, setDataMap]   = useState<Map<string, MarketDataPoint[]>>(new Map());
  const [loading, setLoading]   = useState(false);
  const [errors,  setErrors]    = useState<Record<string, string>>({});

  useEffect(() => {
    if (tickers.length === 0) return;
    setLoading(true);

    const aborts = tickers.map(ticker => {
      const ctrl = new AbortController();
      fetch(`/api/market-data?ticker=${encodeURIComponent(ticker)}&period=${period}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(data => {
          setDataMap(prev => {
            const next = new Map(prev);
            next.set(ticker, data.prices ?? []);
            return next;
          });
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            setErrors(prev => ({ ...prev, [ticker]: err.message }));
          }
        })
        .finally(() => setLoading(false));
      return ctrl;
    });

    return () => { aborts.forEach(c => c.abort()); };
  }, [tickers.join(','), period]); // eslint-disable-line

  return { dataMap, loading, errors };
}
