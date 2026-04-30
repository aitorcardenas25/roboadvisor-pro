'use client';

import {
  PieChart, Pie, Cell, BarChart, Bar,
  AreaChart, Area, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LineChart, Line,
} from 'recharts';
import { Portfolio }        from '@/lib/portfolio';
import { PortfolioMetrics } from '@/lib/metrics';
import { MonteCarloResult } from '@/lib/monteCarlo';
import { FinancialReport }  from '@/lib/report';
import { ScoringResult }    from '@/lib/scoring';
import { HistoricalChartPoint } from '@/lib/metrics';

const PROFILE_COLORS: Record<string, string> = {
  conservador: '#10b981', moderat: '#3b82f6',
  dinamic:     '#f59e0b', agressiu: '#ef4444',
};

const ASSET_COLORS = ['#1a3a2a','#c9a84c','#2d6a4f','#e8d5a3','#374151','#6b7280'];

// Dimensions estandaritzades per mantenir proporcions correctes al PDF
// Full-width (700×220): PDF width ~505pt → height = 505 × 220/700 ≈ 159pt
// Half-width (500×220): PDF half-col ~247pt → height = 247 × 220/500 ≈ 109pt
const FW = { w: 700, h: 220 }; // full width
const HW = { w: 500, h: 220 }; // half width

interface Props {
  portfolio:   Portfolio;
  metrics:     PortfolioMetrics;
  monteCarlo:  MonteCarloResult;
  report:      FinancialReport;
  scoring:     ScoringResult;
  historical:  HistoricalChartPoint[];
}

export default function HiddenCharts({
  portfolio, metrics, monteCarlo, report, scoring, historical,
}: Props) {
  const profileColor = PROFILE_COLORS[scoring.profile] ?? '#3b82f6';

  return (
    // Posicionat fora de la pantalla sense opacity:0 perquè html-to-image renderitzi correctament
    <div style={{ position: 'fixed', top: 0, left: -12000, pointerEvents: 'none', zIndex: -9999 }}>

      {/* 1. Asset Allocation Pie */}
      <div id="chart-allocation" style={{ width: HW.w, height: HW.h, background: '#fff', padding: 12 }}>
        <PieChart width={HW.w - 24} height={HW.h - 24}>
          <Pie
            data={report.portfolioSection.assetAllocation}
            dataKey="weight" nameKey="category"
            cx="50%" cy="50%" outerRadius={80}
            label={({ category, weight }) => `${category} ${weight}%`}
            labelLine>
            {report.portfolioSection.assetAllocation.map((_, i) => (
              <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `${v}%`} />
          <Legend iconSize={8} />
        </PieChart>
      </div>

      {/* 2. Radar Perfil */}
      <div id="chart-radar" style={{ width: HW.w, height: HW.h, background: '#fff', padding: 12 }}>
        <RadarChart width={HW.w - 24} height={HW.h - 24} data={report.investorProfile.radarData}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: '#374151' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
          <Radar name="Puntuació" dataKey="value"
            stroke={profileColor} fill={profileColor} fillOpacity={0.25} strokeWidth={2} />
        </RadarChart>
      </div>

      {/* 3. Evolució Històrica */}
      <div id="chart-historical" style={{ width: FW.w, height: FW.h, background: '#fff', padding: 12 }}>
        <AreaChart width={FW.w - 24} height={FW.h - 24} data={historical}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(0, 7)} interval={6} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="portfolio" name="Cartera"
            stroke={profileColor} fill={profileColor} fillOpacity={0.15} strokeWidth={2} />
          <Area type="monotone" dataKey="benchmark" name="Benchmark"
            stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.08}
            strokeWidth={1.5} strokeDasharray="5 5" />
        </AreaChart>
      </div>

      {/* 4. Monte Carlo */}
      <div id="chart-montecarlo" style={{ width: FW.w, height: FW.h, background: '#fff', padding: 12 }}>
        <AreaChart width={FW.w - 24} height={FW.h - 24} data={monteCarlo.projectionData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }}
            label={{ value: 'Anys', position: 'insideBottom', offset: -2 }} />
          <YAxis tick={{ fontSize: 9 }}
            tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M€` : `${(v/1000).toFixed(0)}k€`}
            width={65} />
          <Tooltip
            formatter={(v: number) => [new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v), '']}
            labelFormatter={l => `Any ${l}`} />
          <Legend />
          <Area type="monotone" dataKey="p90" name="P90 Optimista"
            stroke="#10b981" fill="#10b981" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 2" />
          <Area type="monotone" dataKey="p50" name="P50 Central"
            stroke="#1a3a2a" fill="#1a3a2a" fillOpacity={0.12} strokeWidth={2.5} />
          <Area type="monotone" dataKey="p10" name="P10 Pessimista"
            stroke="#ef4444" fill="#ef4444" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="contributions" name="Total aportat"
            stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
        </AreaChart>
      </div>

      {/* 5. Rendibilitats per període */}
      <div id="chart-rolling" style={{ width: FW.w, height: FW.h, background: '#fff', padding: 12 }}>
        <BarChart width={FW.w - 24} height={FW.h - 24} data={metrics.rollingReturns}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '']} />
          <Legend />
          <Bar dataKey="portfolioReturn" name="Cartera" fill="#1a3a2a" radius={[4,4,0,0]} />
          <Bar dataKey="benchmarkReturn" name="Benchmark" fill="#c9a84c" radius={[4,4,0,0]} />
        </BarChart>
      </div>

      {/* 6. Contribució al risc */}
      <div id="chart-risk" style={{ width: FW.w, height: FW.h, background: '#fff', padding: 12 }}>
        <BarChart
          width={FW.w - 24} height={FW.h - 24}
          data={metrics.riskContributions.sort((a, b) => b.riskContribution - a.riskContribution).slice(0, 8)}
          layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
          <YAxis type="category" dataKey="productName" tick={{ fontSize: 7 }} width={120}
            tickFormatter={v => v.length > 18 ? v.slice(0, 18) + '...' : v} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Contribució al risc']} />
          <Bar dataKey="riskContribution" name="Contribució al risc" fill="#ef4444" radius={[0,4,4,0]} />
        </BarChart>
      </div>

      {/* 7. Scoring barres */}
      <div id="chart-scoring" style={{ width: HW.w, height: HW.h, background: '#fff', padding: 12 }}>
        <BarChart
          width={HW.w - 24} height={HW.h - 24}
          data={report.investorProfile.scoreBreakdown}
          layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
          <YAxis type="category" dataKey="dimension" tick={{ fontSize: 7 }} width={130}
            tickFormatter={v => v.length > 20 ? v.slice(0, 20) + '...' : v} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(0)}%`, 'Puntuació']} />
          <Bar dataKey="percentage" name="Puntuació" fill={profileColor} radius={[0,4,4,0]} />
        </BarChart>
      </div>

      {/* 8. Distribució cartera (donut) — llegenda a baix per evitar que retalli l'anell */}
      <div id="chart-risk-donut" style={{ width: HW.w, height: HW.h, background: '#fff', padding: 12 }}>
        <PieChart width={HW.w - 24} height={HW.h - 24}>
          <Pie
            data={portfolio.allocations.map(a => ({
              name:  a.product.name.slice(0, 22),
              value: a.weight,
            }))}
            dataKey="value" nameKey="name"
            cx="50%" cy="42%"
            innerRadius={42} outerRadius={72}>
            {portfolio.allocations.map((_, i) => (
              <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `${v}%`} />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            iconSize={7}
            wrapperStyle={{ fontSize: 7, lineHeight: '1.2' }}
          />
        </PieChart>
      </div>

    </div>
  );
}
