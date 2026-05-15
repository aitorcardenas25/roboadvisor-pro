'use client';

import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { computeFrontierData, PROFILE_ASSET_LABELS } from '@/lib/portfolioAdapter';
import type { InvestorProfile } from '@/lib/products';

interface Props {
  profile:           InvestorProfile;
  profileColor:      string;
  portfolioReturn:   number;
  portfolioVol:      number;
  portfolioName:     string;
}

interface ChartPoint { vol: number; ret: number; label?: string }

function pct(w: number) { return `${(w * 100).toFixed(0)}%`; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as (ChartPoint & { weights?: number[]; assetIds?: string[] });
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-800 mb-1">{d.label ?? 'Punt frontera'}</p>
      <p className="text-gray-600">Volatilitat: <span className="font-bold">{d.vol}%</span></p>
      <p className="text-gray-600">Retorn esp.: <span className="font-bold">{d.ret}%</span></p>
      {d.weights && d.assetIds && (
        <div className="mt-2 border-t pt-2 space-y-0.5">
          {d.assetIds.map((id, i) => (
            <div key={id} className="flex justify-between gap-3">
              <span className="text-gray-500">{PROFILE_ASSET_LABELS[id] ?? id}</span>
              <span className="font-medium text-gray-800">{pct(d.weights![i])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EfficientFrontier({
  profile, profileColor, portfolioReturn, portfolioVol, portfolioName,
}: Props) {
  const data = useMemo(() => computeFrontierData(profile), [profile]);

  if (data.frontier.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No s'ha pogut calcular la frontera eficient.
      </p>
    );
  }

  const frontierPoints: ChartPoint[] = data.frontier.map(p => ({
    vol: p.vol, ret: p.ret,
  }));

  const tangencyPoint: ChartPoint & { weights: number[]; assetIds: string[] } = {
    vol:      data.tangency.vol,
    ret:      data.tangency.ret,
    label:    'Màxim Sharpe (tangència)',
    weights:  data.tangency.weights,
    assetIds: data.tangency.assetIds,
  };

  const minVarPoint: ChartPoint = {
    vol:   data.minVar.vol,
    ret:   data.minVar.ret,
    label: 'Mínima variança',
  };

  const currentPoint: ChartPoint = {
    vol:   portfolioVol,
    ret:   portfolioReturn,
    label: portfolioName,
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            type="number" dataKey="vol" name="Volatilitat" unit="%"
            domain={['auto', 'auto']}
            label={{ value: 'Volatilitat (%)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8' }}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
          />
          <YAxis
            type="number" dataKey="ret" name="Retorn" unit="%"
            domain={['auto', 'auto']}
            label={{ value: 'Retorn esperat (%)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />

          {/* Frontier curve */}
          <Scatter
            name="Frontera eficient"
            data={frontierPoints}
            fill="#cbd5e1"
            opacity={0.7}
            shape={(props: unknown) => {
              const { cx, cy } = props as { cx: number; cy: number };
              return <circle cx={cx} cy={cy} r={3} fill="#cbd5e1" />;
            }}
          />

          {/* Min variance */}
          <Scatter
            name="Mínima variança"
            data={[minVarPoint]}
            fill="#3b82f6"
            shape={(props: unknown) => {
              const { cx, cy } = props as { cx: number; cy: number };
              return (
                <g>
                  <circle cx={cx} cy={cy} r={8} fill="#3b82f6" opacity={0.15} />
                  <circle cx={cx} cy={cy} r={5} fill="#3b82f6" />
                </g>
              );
            }}
          />

          {/* Tangency (max Sharpe) */}
          <Scatter
            name="Màxim Sharpe"
            data={[tangencyPoint]}
            fill="#10b981"
            shape={(props: unknown) => {
              const { cx, cy } = props as { cx: number; cy: number };
              return (
                <g>
                  <circle cx={cx} cy={cy} r={8} fill="#10b981" opacity={0.15} />
                  <circle cx={cx} cy={cy} r={5} fill="#10b981" />
                </g>
              );
            }}
          />

          {/* Current portfolio */}
          <Scatter
            name={portfolioName}
            data={[currentPoint]}
            fill={profileColor}
            shape={(props: unknown) => {
              const { cx, cy } = props as { cx: number; cy: number };
              return (
                <g>
                  <circle cx={cx} cy={cy} r={10} fill={profileColor} opacity={0.15} />
                  <circle cx={cx} cy={cy} r={6} fill={profileColor} />
                  <circle cx={cx} cy={cy} r={6} fill="none" stroke="white" strokeWidth={1.5} />
                </g>
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend explicatiu */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 justify-center">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#cbd5e1] inline-block" /> Frontera eficient
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Mínima variança
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Màxim Sharpe
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: profileColor }} /> Cartera actual
        </span>
      </div>
    </div>
  );
}
