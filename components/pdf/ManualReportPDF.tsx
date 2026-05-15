'use client';
import {
  Document, Page, Text, View, StyleSheet,
  Svg, Path, Rect, Polygon, Line, Circle, G, Defs, LinearGradient, Stop,
} from '@react-pdf/renderer';
import type { ManualPortfolioInput, ManualAsset } from '@/lib/manualReport';

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  green:      '#1a3a2a',
  greenMid:   '#2d6a4f',
  greenLight: '#e8f5e9',
  gold:       '#c9a84c',
  goldLight:  '#f5f0e8',
  white:      '#ffffff',
  offWhite:   '#f9f8f5',
  gray:       '#6b7280',
  grayLight:  '#e5e7eb',
  grayBg:     '#f3f4f6',
  dark:       '#111827',
  red:        '#ef4444',
  green2:     '#10b981',
  blue:       '#3b82f6',
  amber:      '#f59e0b',
};

const ASSET_COLORS = [C.gold, C.green2, C.blue, '#8b5cf6', '#f97316', '#ec4899', '#06b6d4', C.red];

// ─── MiFID II DATA ─────────────────────────────────────────────────────────────
const MIFID_DIMS = [
  'Tolerància al risc',
  'Coneixement inversions',
  'Experiència inversora',
  'Horitzó temporal',
  'Situació financera',
  'Objectius inversió',
  'Capacitat absorció',
  'Criteris ESG',
];
const MIFID_MAXES = [20, 12, 13, 18, 12, 6, 7, 9];
const PROFILE_SCORES: Record<string, number[]> = {
  conservador: [8,  5,  5,  8,  6, 3, 4, 5],
  moderat:     [12, 7,  7,  11, 8, 4, 5, 6],
  dinamic:     [15, 9,  10, 14, 10,5, 6, 7],
  agressiu:    [19, 11, 12, 17, 11,6, 7, 8],
};
const CONSTRAINTS: Record<string, { rvMin: number; rvMax: number; rfMin: number; rfMax: number }> = {
  conservador: { rvMin: 0,  rvMax: 30,  rfMin: 50, rfMax: 100 },
  moderat:     { rvMin: 20, rvMax: 60,  rfMin: 30, rfMax: 70  },
  dinamic:     { rvMin: 50, rvMax: 85,  rfMin: 10, rfMax: 50  },
  agressiu:    { rvMin: 70, rvMax: 100, rfMin: 0,  rfMax: 30  },
};
const BENCHMARK_NAME: Record<string, string> = {
  conservador: 'Bloomberg Global Aggregate Bond',
  moderat:     'MSCI World 40% / Bloomberg Agg 60%',
  dinamic:     'MSCI World 70% / Bloomberg Agg 30%',
  agressiu:    'MSCI World 100%',
};
const BENCHMARK_RETURN: Record<string, number> = {
  conservador: 3.2, moderat: 5.8, dinamic: 8.1, agressiu: 10.5,
};
const PROFILE_LABEL: Record<string, string> = {
  conservador: 'Conservador', moderat: 'Moderat', dinamic: 'Dinàmic', agressiu: 'Agressiu',
};
const RISK_RETURN: Record<number, number> = { 1: 2, 2: 3.5, 3: 5, 4: 7, 5: 9.5, 6: 13, 7: 17 };
const RISK_VOL:    Record<number, number> = { 1: 1, 2: 3,   3: 6, 4: 11, 5: 16,  6: 22, 7: 30 };
const RISK_LABEL:  Record<number, string> = {
  1: 'Molt baix', 2: 'Baix', 3: 'Moderat-baix', 4: 'Moderat', 5: 'Alt', 6: 'Molt alt', 7: 'Màxim',
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:      { backgroundColor: C.white, fontFamily: 'Helvetica', paddingBottom: 52 },
  coverPage: { backgroundColor: C.green, fontFamily: 'Helvetica' },
  header: {
    paddingHorizontal: 45, paddingTop: 26, paddingBottom: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 0.5, borderBottomColor: C.grayLight,
  },
  footer: {
    position: 'absolute', bottom: 18, left: 45, right: 45,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 0.5, borderTopColor: C.grayLight, paddingTop: 7,
  },
  body:    { paddingHorizontal: 45, paddingTop: 18 },
  tag:     { fontSize: 7, color: C.gold, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 3 },
  h2:      { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 4 },
  h3:      { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 5 },
  body1:   { fontSize: 9,  color: C.dark, lineHeight: 1.6, marginBottom: 5 },
  body2:   { fontSize: 8,  color: C.gray, lineHeight: 1.55 },
  bold:    { fontFamily: 'Helvetica-Bold' },
  italic:  { fontFamily: 'Helvetica-Oblique' },
  divider: { height: 1, backgroundColor: C.grayLight, marginVertical: 11 },
  row:     { flexDirection: 'row', gap: 8, marginBottom: 8 },
  col:     { flex: 1 },
  metricBox: {
    flex: 1, borderWidth: 0.5, borderColor: C.grayLight,
    padding: 9, backgroundColor: C.white,
  },
  metricLabel: { fontSize: 6.5, color: C.gray, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  metricValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.dark },
  metricSub:   { fontSize: 6.5, color: C.gray, marginTop: 1 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.dark, paddingBottom: 4, marginBottom: 2 },
  tableRow:  { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.grayLight, paddingVertical: 5 },
  tableAlt:  { backgroundColor: C.offWhite },
  th:    { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.dark, letterSpacing: 0.8, textTransform: 'uppercase' },
  td:    { fontSize: 8, color: C.dark },
  tdGray:{ fontSize: 8, color: C.gray },
  legalBox:  { borderWidth: 0.5, borderColor: C.grayLight, padding: 10, marginTop: 8, backgroundColor: C.offWhite },
  legalText: { fontSize: 6.5, color: C.gray, lineHeight: 1.5 },
  cardGold: {
    borderLeftWidth: 3, borderLeftColor: C.gold,
    borderTopWidth: 0.5, borderTopColor: C.grayLight,
    borderRightWidth: 0.5, borderRightColor: C.grayLight,
    borderBottomWidth: 0.5, borderBottomColor: C.grayLight,
    padding: 12, marginBottom: 8, backgroundColor: C.goldLight,
  },
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fEur(n: number): string {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M€`;
  if (Math.abs(n) >= 1e3) return `${Math.round(n / 1000).toLocaleString('ca-ES')} K€`;
  return `${Math.round(n).toLocaleString('ca-ES')} €`;
}
function fPct(n: number, plus = false): string {
  return `${plus && n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}
function projection(initial: number, monthly: number, rate: number, years: number): number {
  const r = rate / 100 / 12;
  const n = years * 12;
  const fi = initial * Math.pow(1 + r, n);
  const fm = r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n;
  return fi + fm;
}
function assetReturn(a: ManualAsset): number { return a.historicalReturn5Y ?? RISK_RETURN[a.risk] ?? 5; }
function assetVol(a: ManualAsset): number    { return a.historicalVolatility ?? RISK_VOL[a.risk] ?? 8; }
function assetReturnSource(a: ManualAsset): '†' | '*' { return a.historicalReturn5Y != null ? '†' : '*'; }

// ─── SVG HELPERS ──────────────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function donutArc(cx: number, cy: number, R: number, ri: number, a0deg: number, a1deg: number): string {
  if (Math.abs(a1deg - a0deg) >= 359.9) {
    return `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${(cx - 0.01).toFixed(2)} ${cy - R} Z`;
  }
  const large = (a1deg - a0deg) > 180 ? 1 : 0;
  const [x1o, y1o] = polar(cx, cy, R, a0deg);
  const [x2o, y2o] = polar(cx, cy, R, a1deg);
  const [x1i, y1i] = polar(cx, cy, ri, a1deg);
  const [x2i, y2i] = polar(cx, cy, ri, a0deg);
  return `M ${x1o.toFixed(1)} ${y1o.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x2o.toFixed(1)} ${y2o.toFixed(1)} L ${x1i.toFixed(1)} ${y1i.toFixed(1)} A ${ri} ${ri} 0 ${large} 0 ${x2i.toFixed(1)} ${y2i.toFixed(1)} Z`;
}

function radarPts(scores: number[], maxes: number[], cx: number, cy: number, r: number): string {
  return scores.map((s, i) => {
    const [x, y] = polar(cx, cy, r * Math.min(1, s / maxes[i]), (i * 360) / scores.length);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function gridPts(frac: number, cx: number, cy: number, r: number, n: number): string {
  return Array.from({ length: n }, (_, i) => {
    const [x, y] = polar(cx, cy, r * frac, (i * 360) / n);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function makeLine(vals: number[], xs: number[], minV: number, maxV: number, y0: number, y1: number): string {
  const yr = y1 - y0;
  const vr = maxV - minV || 1;
  return vals.map((v, i) => {
    const y = (y0 + yr * (1 - (v - minV) / vr)).toFixed(1);
    return `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${y}`;
  }).join(' ');
}

function corrColor(r: number): string {
  if (r >= 0.8) return '#1a3a2a';
  if (r >= 0.6) return '#2d6a4f';
  if (r >= 0.4) return '#52b788';
  if (r >= 0.2) return '#d8f3dc';
  if (r >= 0)   return '#f3f4f6';
  if (r >= -0.2) return '#fee2e2';
  return '#ef4444';
}
function corrText(r: number): string { return r >= 0.6 ? '#ffffff' : '#111827'; }
function corrBetween(a: ManualAsset, b: ManualAsset): number {
  if (a.isin === b.isin) return 1.0;
  const rv1 = /variable|equity|accions|rv\b/i.test(a.category);
  const rf1 = /fixa|bond|rf\b|renda|oblig/i.test(a.category);
  const rv2 = /variable|equity|accions|rv\b/i.test(b.category);
  const rf2 = /fixa|bond|rf\b|renda|oblig/i.test(b.category);
  if (rv1 && rv2) return 0.72;
  if (rf1 && rf2) return 0.65;
  if ((rv1 && rf2) || (rf1 && rv2)) return -0.15;
  if (rv1 || rv2) return 0.08;
  if (rf1 || rf2) return 0.22;
  return 0.10;
}

// ─── DERIVED COMPUTE ──────────────────────────────────────────────────────────
function compute(d: ManualPortfolioInput) {
  const wr = d.assets.reduce((s, a) => s + (a.weight / 100) * assetReturn(a), 0);
  const wv = d.assets.reduce((s, a) => s + (a.weight / 100) * assetVol(a), 0);
  const wt = d.assets.reduce((s, a) => s + (a.weight / 100) * a.ter, 0);
  const wR = d.assets.reduce((s, a) => s + (a.weight / 100) * a.risk, 0);
  const nr = Math.max(0, wr - wt);

  const estIncome = Math.round(d.monthlyAmount / 0.095);
  const income    = d.monthlyIncome   ?? estIncome;
  const expenses  = d.monthlyExpenses ?? Math.round(income * 0.596);
  const surplus   = income - expenses - d.monthlyAmount;
  const isEst     = !d.monthlyIncome || !d.monthlyExpenses;

  const totalInvested = d.initialAmount + d.monthlyAmount * d.horizon * 12;
  const r10 = Math.max(0.5, nr - wv * 0.35);
  const r90 = nr + wv * 0.35;
  const p10 = projection(d.initialAmount, d.monthlyAmount, r10, d.horizon);
  const p50 = projection(d.initialAmount, d.monthlyAmount, nr,  d.horizon);
  const p90 = projection(d.initialAmount, d.monthlyAmount, r90, d.horizon);

  const rf      = 3.5;
  const sharpe  = wv > 0 ? parseFloat(((nr - rf) / wv).toFixed(2)) : 0;
  const var95   = parseFloat((-1.645 * wv).toFixed(1));
  const maxDD   = parseFloat((-0.7 * wv).toFixed(1));
  const benchR  = BENCHMARK_RETURN[d.investorProfile] ?? 5.8;
  const alpha   = parseFloat((nr - benchR).toFixed(2));

  let rvPct = 0, rfPct = 0, cashPct = 0;
  for (const a of d.assets) {
    if (/variable|equity|accions|rv\b/i.test(a.category)) rvPct += a.weight;
    else if (/fixa|bond|rf\b|renda|oblig/i.test(a.category)) rfPct += a.weight;
    else cashPct += a.weight;
  }

  const scores     = PROFILE_SCORES[d.investorProfile] ?? PROFILE_SCORES.moderat;
  const totalScore = scores.reduce((s, v) => s + v, 0);
  const efundTarget = expenses * 6;

  return {
    wr, wv, wt, wR, nr,
    income, expenses, surplus, isEst,
    totalInvested, r10, r90, p10, p50, p90,
    sharpe, var95, maxDD, benchR, alpha,
    rvPct, rfPct, cashPct,
    scores, totalScore, efundTarget,
  };
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Header({ section, client }: { section: string; client: string }) {
  return (
    <View style={S.header} fixed>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.dark, letterSpacing: 1.5 }}>FACTOR</Text>
        <Text style={{ fontSize: 9, color: C.gold, letterSpacing: 1.5 }}> OTC</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Text style={{ fontSize: 7, color: C.gray, fontFamily: 'Helvetica-Bold', letterSpacing: 1 }}>{client}</Text>
        <Text style={{ fontSize: 7, color: C.grayLight }}>·</Text>
        <Text style={{ fontSize: 7.5, color: C.gray, letterSpacing: 1.5 }}>{section}</Text>
      </View>
    </View>
  );
}

function Footer({ label }: { label?: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={{ fontSize: 6.5, color: C.gray }}>{label ?? 'Factor OTC · Informe de Cartera · Confidencial'}</Text>
      <Text style={{ fontSize: 6.5, color: C.gray }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function MetricBox({ label, value, sub, topColor }: { label: string; value: string; sub?: string; topColor?: string }) {
  return (
    <View style={[S.metricBox, topColor ? { borderTopWidth: 3, borderTopColor: topColor } : {}]}>
      <Text style={S.metricLabel}>{label}</Text>
      <Text style={[S.metricValue, topColor ? { color: topColor } : {}]}>{value}</Text>
      {sub ? <Text style={S.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function ProgressBar({ label, score, max, color }: { label: string; score: number; max: number; color?: string }) {
  const pct = Math.min(1, score / max);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
      <Text style={{ fontSize: 7.5, color: C.dark, width: 140 }}>{label}</Text>
      <View style={{ flex: 1, height: 4, backgroundColor: C.grayLight, borderRadius: 2, marginHorizontal: 7 }}>
        <View style={{ width: `${(pct * 100).toFixed(0)}%`, height: 4, backgroundColor: color ?? C.gold, borderRadius: 2 }} />
      </View>
      <Text style={{ fontSize: 7.5, color: C.gray, width: 45, textAlign: 'right' }}>{score}/{max}</Text>
    </View>
  );
}

// ─── PAGE 1: COVER ────────────────────────────────────────────────────────────
function CoverPage({ d, generatedAt }: { d: ManualPortfolioInput; generatedAt: string }) {
  const c = compute(d);
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;
  const riskLabel    = RISK_LABEL[Math.round(c.wR)] ?? 'Moderat';

  return (
    <Page size="A4" style={S.coverPage}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: C.gold }} />

      <View style={{ flex: 1, paddingHorizontal: 55, paddingTop: 58 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 56 }}>
          <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 3 }}>FACTOR</Text>
          <Text style={{ fontSize: 18, color: C.gold, letterSpacing: 4, marginLeft: 6 }}>OTC</Text>
        </View>

        <View style={{ backgroundColor: 'rgba(201,168,76,0.15)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)', padding: '5 14', borderRadius: 4, alignSelf: 'flex-start', marginBottom: 22 }}>
          <Text style={{ fontSize: 7, color: C.gold, letterSpacing: 2, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>Informe de Cartera Personalitzada · Confidencial</Text>
        </View>

        <Text style={{ fontSize: 36, fontFamily: 'Helvetica-Bold', color: C.white, lineHeight: 1.15, marginBottom: 8 }}>{d.clientName}</Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 36 }}>{profileLabel} · {d.objective}</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 36 }}>
          {[
            { label: 'Capital inicial', value: fEur(d.initialAmount) },
            { label: 'Aportació/mes',   value: fEur(d.monthlyAmount) },
            { label: 'Horitzó',         value: `${d.horizon} anys` },
            { label: 'Projecció base',  value: fEur(c.p50) },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', padding: 14, borderRadius: 3 }}>
              <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 5 }}>{s.label}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white }}>{s.value}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 36 }}>
          {[
            { label: 'Perfil inversor',    value: profileLabel },
            { label: 'Rendiment net est.', value: fPct(c.nr) + ' / any' },
            { label: 'Volatilitat est.',   value: fPct(c.wv) + ' / any' },
            { label: 'Risc SRRI',          value: riskLabel },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 3 }}>
              <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>{s.label}</Text>
              <Text style={{ fontSize: 11, color: C.gold, fontFamily: 'Helvetica-Bold' }}>{s.value}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{d.clientEmail}</Text>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Generat el {generatedAt}</Text>
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 2: RESUM EXECUTIU ───────────────────────────────────────────────────
function ExecutivePage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);

  return (
    <Page size="A4" style={S.page}>
      <Header section="Resum Executiu" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>RESUM EXECUTIU</Text>
        <Text style={S.h2}>Visió global del pla financer</Text>
        <Text style={[S.body2, { marginBottom: 12 }]}>Síntesi dels elements clau del pla d&apos;inversió personalitzat per a {d.clientName}.</Text>

        {/* 3-framework cards */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'VIURE', sub: 'Necessitats corrents', value: fEur(c.expenses) + '/mes', desc: `Despeses mensuals cobertes per ingressos de ${fEur(c.income)}/mes.`, color: C.blue },
            { label: 'PROTEGIR', sub: 'Fons d\'emergència', value: fEur(c.efundTarget), desc: `Objectiu de coixí = 6 mesos de despeses. Capacitat: ${fEur(c.surplus)}/mes d'excedent.`, color: C.green2 },
            { label: 'CRÉIXER', sub: 'Inversió sistemàtica', value: fEur(d.monthlyAmount) + '/mes', desc: `Aportació mensual durant ${d.horizon} anys. Total invertit: ${fEur(c.totalInvested)}.`, color: C.gold },
          ].map(f => (
            <View key={f.label} style={{ flex: 1, borderTopWidth: 3, borderTopColor: f.color, borderWidth: 0.5, borderColor: C.grayLight, padding: 12 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: f.color, letterSpacing: 1.5, marginBottom: 1 }}>{f.label}</Text>
              <Text style={{ fontSize: 7, color: C.gray, marginBottom: 8 }}>{f.sub}</Text>
              <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 5 }}>{f.value}</Text>
              <Text style={{ fontSize: 7.5, color: C.gray, lineHeight: 1.5 }}>{f.desc}</Text>
            </View>
          ))}
        </View>

        {/* Cash flow table */}
        <View style={{ backgroundColor: C.grayBg, borderWidth: 0.5, borderColor: C.grayLight, padding: 12, marginBottom: 10 }}>
          <Text style={[S.tag, { marginBottom: 6 }]}>FLUX DE CAIXA MENSUAL</Text>
          {c.isEst && <Text style={[S.body2, S.italic, { marginBottom: 6 }]}>* Valors estimats a partir de l&apos;aportació mensual indicada.</Text>}
          {[
            { label: '(+) Ingressos mensuals nets', value: fEur(c.income), color: C.green2, bold: true },
            { label: '(−) Despeses habituals',       value: `− ${fEur(c.expenses)}`, color: C.red,   bold: false },
            { label: '(−) Aportació inversió',       value: `− ${fEur(d.monthlyAmount)}`, color: C.gold, bold: false },
            { label: '(=) Excedent disponible',      value: fEur(Math.abs(c.surplus)), color: c.surplus >= 0 ? C.green2 : C.red, bold: true },
          ].map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: i < 3 ? 0.5 : 0, borderBottomColor: C.grayLight }}>
              <Text style={{ fontSize: 8.5, color: C.dark, fontFamily: row.bold ? 'Helvetica-Bold' : 'Helvetica' }}>{row.label}</Text>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: row.color }}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View style={S.divider} />

        {/* Projection scenarios */}
        <Text style={S.tag}>PROJECCIÓ A {d.horizon} ANYS</Text>
        <Text style={[S.h2, { marginBottom: 6 }]}>Escenaris de rendiment</Text>
        <View style={[S.row, { marginBottom: 4 }]}>
          {[
            { label: 'Pessimista (P10)', value: fEur(c.p10), rate: fPct(c.r10), gain: fEur(c.p10 - c.totalInvested), color: C.red },
            { label: 'Base (P50)',       value: fEur(c.p50), rate: fPct(c.nr),  gain: fEur(c.p50 - c.totalInvested), color: C.gold },
            { label: 'Optimista (P90)',  value: fEur(c.p90), rate: fPct(c.r90), gain: fEur(c.p90 - c.totalInvested), color: C.green2 },
          ].map(sc => (
            <View key={sc.label} style={[S.metricBox, { borderTopWidth: 3, borderTopColor: sc.color }]}>
              <Text style={[S.metricLabel, { color: sc.color }]}>{sc.label}</Text>
              <Text style={[S.metricValue, { color: sc.color, fontSize: 16 }]}>{sc.value}</Text>
              <Text style={S.metricSub}>Rendiment: {sc.rate} anual</Text>
              <Text style={[S.metricSub, { marginTop: 2 }]}>Guany estimat: {sc.gain}</Text>
            </View>
          ))}
        </View>
        <Text style={[S.body2, S.italic]}>Capital invertit total: {fEur(c.totalInvested)} · Capital inicial: {fEur(d.initialAmount)}</Text>
      </View>
    </Page>
  );
}

// ─── PAGE 3: PERFIL D'INVERSOR ────────────────────────────────────────────────
function ProfilePage({ d }: { d: ManualPortfolioInput }) {
  const c          = compute(d);
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;
  const cx = 90, cy = 90, r = 75;
  const n = MIFID_DIMS.length;
  const spokeDeg = (i: number) => (i * 360) / n;

  return (
    <Page size="A4" style={S.page}>
      <Header section="Perfil d'Inversor" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>PERFIL D&apos;INVERSOR · MiFID II</Text>
        <Text style={S.h2}>Scoring i avaluació de risc</Text>

        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
          {/* Radar chart */}
          <View style={{ width: 186, alignItems: 'center' }}>
            <Svg viewBox="0 0 186 186" style={{ width: 186, height: 186 }}>
              {/* Grid at 33%, 66%, 100% */}
              {[0.33, 0.66, 1.0].map(frac => (
                <Polygon key={frac} points={gridPts(frac, cx, cy, r, n)} stroke={C.grayLight} strokeWidth={0.5} fill="none" />
              ))}
              {/* Spokes */}
              {Array.from({ length: n }, (_, i) => {
                const [sx, sy] = polar(cx, cy, r, spokeDeg(i));
                return <Line key={i} x1={cx} y1={cy} x2={sx.toFixed(1)} y2={sy.toFixed(1)} stroke={C.grayLight} strokeWidth={0.5} />;
              })}
              {/* Data polygon */}
              <Polygon
                points={radarPts(c.scores, MIFID_MAXES, cx, cy, r)}
                fill="rgba(201,168,76,0.20)"
                stroke={C.gold}
                strokeWidth={1.5}
              />
              {/* Dots on data polygon */}
              {c.scores.map((score, i) => {
                const frac = Math.min(1, score / MIFID_MAXES[i]);
                const [px, py] = polar(cx, cy, r * frac, spokeDeg(i));
                return <Circle key={i} cx={px.toFixed(1)} cy={py.toFixed(1)} r={3} fill={C.gold} />;
              })}
            </Svg>
            <Text style={{ fontSize: 8, color: C.gray, textAlign: 'center', marginTop: 2 }}>Perfil: {profileLabel} · {c.totalScore}/97</Text>
          </View>

          {/* Dimension bars */}
          <View style={{ flex: 1 }}>
            <Text style={[S.tag, { marginBottom: 8 }]}>PUNTUACIÓ PER DIMENSIÓ</Text>
            {MIFID_DIMS.map((dim, i) => (
              <ProgressBar key={dim} label={dim} score={c.scores[i]} max={MIFID_MAXES[i]} />
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: C.grayLight }}>
              <Text style={[S.body2, S.bold]}>PUNTUACIÓ TOTAL</Text>
              <Text style={[S.body1, S.bold, { color: C.gold }]}>{c.totalScore} / 97</Text>
            </View>
          </View>
        </View>

        <View style={S.divider} />

        {/* Client profile data */}
        <Text style={S.tag}>DADES DEL CLIENT</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {[
            ['Nom',              d.clientName],
            ['Email',            d.clientEmail],
            ['Perfil MiFID II',  profileLabel],
            ['Objectiu',         d.objective],
            ['Horitzó inversió', `${d.horizon} anys`],
            ['Capital inicial',  fEur(d.initialAmount)],
            ['Aportació mensual',fEur(d.monthlyAmount)],
            ['Actius cartera',   `${d.assets.length} instruments`],
          ].map(([k, v]) => (
            <View key={k} style={{ width: '47%', flexDirection: 'row', marginBottom: 3 }}>
              <Text style={[S.body2, { width: 95, flexShrink: 0 }]}>{k}</Text>
              <Text style={[S.body1, S.bold, { flex: 1 }]}>{v}</Text>
            </View>
          ))}
        </View>

        {d.adminNote ? (
          <View style={S.legalBox}>
            <Text style={[S.legalText, S.bold, { marginBottom: 3 }]}>Notes internes de l&apos;assessor:</Text>
            <Text style={S.legalText}>{d.adminNote}</Text>
          </View>
        ) : null}

        <View style={S.divider} />

        {/* 4 key metrics */}
        <View style={S.row}>
          <MetricBox label="Rendiment net estimat" value={fPct(c.nr)} sub="anual ponderat nets TER" topColor={C.green2} />
          <MetricBox label="Volatilitat estimada"   value={fPct(c.wv)} sub="anual, desv. estàndard" />
          <MetricBox label="TER mig ponderat"        value={`${c.wt.toFixed(2)}%`} sub="cost anual total" />
          <MetricBox label="Risc SRRI ponderat"      value={RISK_LABEL[Math.round(c.wR)] ?? 'Moderat'} sub={`${c.wR.toFixed(1)}/7`} />
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 4: DIAGNÒSTIC FINANCER ──────────────────────────────────────────────
function DiagnosticsPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  const savingRate   = c.income > 0 ? parseFloat(((d.monthlyAmount / c.income) * 100).toFixed(1)) : 0;
  const effortRatio  = c.income > 0 ? parseFloat(((c.expenses     / c.income) * 100).toFixed(1)) : 0;
  const efundMonths  = c.expenses > 0 ? parseFloat((c.efundTarget / c.expenses).toFixed(0)) : 6;
  const wealthMult   = c.p50 / Math.max(1, c.totalInvested);

  const kpis = [
    { label: 'Taxa d\'estalvi',    value: `${savingRate}%`,              sub: 'aportació / ingressos', color: savingRate >= 15 ? C.green2 : C.amber },
    { label: 'Ràtio esforç',       value: `${effortRatio}%`,             sub: 'despeses / ingressos',  color: effortRatio <= 65 ? C.green2 : C.red },
    { label: 'Objectiu fons emerg.',value: fEur(c.efundTarget),          sub: `${efundMonths} mesos despeses`, color: C.blue },
    { label: 'Rendiment net',       value: fPct(c.nr),                   sub: 'estimat anual nets costos', color: C.gold },
    { label: 'Ràtio multiplicador', value: `×${wealthMult.toFixed(1)}`,  sub: 'projecció P50 / capital aportat', color: C.greenMid },
    { label: 'Alfa vs benchmark',   value: fPct(c.alpha, true),          sub: `vs. ${BENCHMARK_NAME[d.investorProfile] ?? 'Benchmark'}`, color: c.alpha >= 0 ? C.green2 : C.red },
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="Diagnòstic Financer" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>DIAGNÒSTIC FINANCER</Text>
        <Text style={S.h2}>Indicadors clau de salut financera</Text>
        {c.isEst && <Text style={[S.body2, S.italic, { marginBottom: 8 }]}>* Ingressos i despeses estimats a partir de l&apos;aportació mensual declarada.</Text>}

        {/* 6 KPI cards 3×2 */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
          {kpis.slice(0, 3).map(k => (
            <View key={k.label} style={[S.metricBox, { borderTopWidth: 3, borderTopColor: k.color }]}>
              <Text style={S.metricLabel}>{k.label}</Text>
              <Text style={[S.metricValue, { color: k.color }]}>{k.value}</Text>
              <Text style={S.metricSub}>{k.sub}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {kpis.slice(3).map(k => (
            <View key={k.label} style={[S.metricBox, { borderTopWidth: 3, borderTopColor: k.color }]}>
              <Text style={S.metricLabel}>{k.label}</Text>
              <Text style={[S.metricValue, { color: k.color }]}>{k.value}</Text>
              <Text style={S.metricSub}>{k.sub}</Text>
            </View>
          ))}
        </View>

        <View style={S.divider} />

        {/* Safety strategy */}
        <Text style={S.tag}>ESTRATÈGIA DE PROTECCIÓ</Text>
        <Text style={[S.h3, { marginBottom: 6 }]}>Recomanacions operatives</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            {[
              ['Fons d\'emergència', `Mantenir ${fEur(c.efundTarget)} en compte remunerat o fons monetari (6 mesos de despeses).`],
              ['Coixí de liquiditat', 'No invertir el 100% del patrimoni. Mantenir un 10-15% accessible en tot moment.'],
              ['Automatització',      'Configurar aportació mensual automàtica per evitar biaixos comportamentals (DCA).'],
            ].map(([title, desc], i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                <View style={{ width: 14, height: 14, backgroundColor: C.gold, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Text style={{ fontSize: 7, color: C.green, fontFamily: 'Helvetica-Bold' }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.body1, S.bold, { marginBottom: 1 }]}>{title}</Text>
                  <Text style={S.body2}>{desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {[
              ['Rebalanceig anual',  `Revisar i rebalancejar la cartera 1 cop/any o si algun actiu desvia >10% del pes target.`],
              ['Revisió del perfil', 'Actualitzar qüestionari MiFID II si canvia la situació financera, objectius o horitzó.'],
              ['Fiscalitat',         'Optimitzar el moment de materialitzar guanys i pèrdues per compensar en la declaració.'],
            ].map(([title, desc], i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                <View style={{ width: 14, height: 14, backgroundColor: C.greenMid, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Text style={{ fontSize: 7, color: C.white, fontFamily: 'Helvetica-Bold' }}>{i + 4}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.body1, S.bold, { marginBottom: 1 }]}>{title}</Text>
                  <Text style={S.body2}>{desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={S.divider} />

        {/* Analysis conclusion */}
        <View style={S.cardGold}>
          <Text style={[S.body1, S.bold, { color: C.green, marginBottom: 3 }]}>Diagnòstic: {c.surplus >= 0 ? 'Situació financera sanejada' : 'Atenció: dèficit mensual detectat'}</Text>
          <Text style={S.body2}>
            {c.surplus >= 0
              ? `Amb un excedent de ${fEur(c.surplus)}/mes i una taxa d'estalvi del ${savingRate}%, el pla és viable. La projecció base assoleix ${fEur(c.p50)} en ${d.horizon} anys.`
              : `El dèficit de ${fEur(Math.abs(c.surplus))}/mes requereix revisar les despeses o reduir l'aportació mensual per garantir la sostenibilitat del pla.`
            }
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 5: COMPOSICIÓ DE CARTERA ────────────────────────────────────────────
function PortfolioPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);

  // Build donut segments: by category
  const catMap: Record<string, { pct: number; color: string }> = {};
  const catColors: Record<string, string> = {
    rv: C.gold, rf: C.greenMid, cash: '#5b6472', alt: C.blue,
  };
  for (const a of d.assets) {
    const key = /variable|equity|accions|rv\b/i.test(a.category) ? 'rv'
      : /fixa|bond|rf\b|renda|oblig/i.test(a.category) ? 'rf'
      : /monetari|money|cash|liqui/i.test(a.category) ? 'cash' : 'alt';
    catMap[key] = { pct: (catMap[key]?.pct ?? 0) + a.weight, color: catColors[key] };
  }
  const segs = Object.entries(catMap).filter(([, v]) => v.pct > 0);

  // Build donut arcs
  const cx = 95, cy = 95, R = 80, ri = 52;
  let cumPct = 0;
  const arcs: { path: string; color: string; pct: number; key: string }[] = [];
  for (const [key, { pct, color }] of segs) {
    const start = cumPct * 360;
    const end   = (cumPct + pct / 100) * 360;
    arcs.push({ path: donutArc(cx, cy, R, ri, start, end), color, pct, key });
    cumPct += pct / 100;
  }

  const catLabels: Record<string, string> = { rv: 'Renda Variable', rf: 'Renda Fixa', cash: 'Monetari / Cash', alt: 'Alternatiu' };

  return (
    <Page size="A4" style={S.page}>
      <Header section="Composició de Cartera" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>COMPOSICIÓ DE CARTERA</Text>
        <Text style={S.h2}>Assignació estratègica d&apos;actius</Text>

        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
          {/* Donut SVG */}
          <View style={{ width: 195, alignItems: 'center' }}>
            <Svg viewBox="0 0 190 190" style={{ width: 190, height: 190 }}>
              {/* Background ring */}
              <Circle cx={cx} cy={cy} r={(R + ri) / 2} stroke={C.grayLight} strokeWidth={R - ri} fill="none" />
              {/* Segments */}
              {arcs.map(a => (
                <Path key={a.key} d={a.path} fill={a.color} />
              ))}
              {/* Center hole */}
              <Circle cx={cx} cy={cy} r={ri - 1} fill={C.white} />
            </Svg>
            <Text style={{ fontSize: 8, color: C.gray, textAlign: 'center', marginTop: 2 }}>
              {c.rvPct > 0 ? `RV: ${c.rvPct}%` : ''}{c.rfPct > 0 ? `  RF: ${c.rfPct}%` : ''}{c.cashPct > 0 ? `  Cash: ${c.cashPct}%` : ''}
            </Text>
          </View>

          {/* Legend + allocation */}
          <View style={{ flex: 1 }}>
            <Text style={[S.tag, { marginBottom: 8 }]}>PER CATEGORIA</Text>
            {segs.map(([key, { pct, color }]) => (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ width: 10, height: 10, backgroundColor: color, borderRadius: 2, flexShrink: 0 }} />
                <Text style={[S.body1, { marginLeft: 6, flex: 1 }]}>{catLabels[key] ?? key}</Text>
                <View style={{ width: 80, height: 5, backgroundColor: C.grayLight, borderRadius: 2, marginRight: 8 }}>
                  <View style={{ width: `${pct}%`, height: 5, backgroundColor: color, borderRadius: 2 }} />
                </View>
                <Text style={[S.body1, S.bold, { width: 35, textAlign: 'right' }]}>{pct}%</Text>
              </View>
            ))}

            <View style={S.divider} />

            <Text style={[S.tag, { marginBottom: 8 }]}>DISTRIBUCIÓ PER ACTIU</Text>
            {d.assets.map((a, i) => (
              <View key={a.isin} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length], borderRadius: 2, flexShrink: 0 }} />
                <Text style={[S.body2, { marginLeft: 5, flex: 1 }]}>{a.name.length > 22 ? a.name.slice(0, 22) + '…' : a.name}</Text>
                <View style={{ width: 70, height: 4, backgroundColor: C.grayLight, borderRadius: 2, marginRight: 6 }}>
                  <View style={{ width: `${a.weight}%`, height: 4, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length], borderRadius: 2 }} />
                </View>
                <Text style={[S.body1, S.bold, { width: 30, textAlign: 'right', color: ASSET_COLORS[i % ASSET_COLORS.length] }]}>{a.weight}%</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={S.divider} />

        {/* Portfolio metrics */}
        <Text style={S.tag}>MÈTRIQUES DE LA CARTERA</Text>
        <View style={[S.row, { marginTop: 6 }]}>
          <MetricBox label="Rendiment brut estimat" value={fPct(c.wr)} sub="anual ponderat" />
          <MetricBox label="TER mig ponderat"        value={`${c.wt.toFixed(2)}%`} sub="cost anual" />
          <MetricBox label="Rendiment net estimat"   value={fPct(c.nr)} sub="brut − TER" topColor={C.gold} />
          <MetricBox label="Sharpe Ratio"            value={c.sharpe.toFixed(2)} sub="(r − rf) / vol" />
          <MetricBox label="VaR 95% (1 any)"        value={fPct(c.var95)} sub="pèrdua màxima estimada" topColor={C.red} />
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 6: DETALL D'ACTIUS ──────────────────────────────────────────────────
function AssetsPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  return (
    <Page size="A4" style={S.page}>
      <Header section="Detall d'Actius" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>COMPOSICIÓ DETALLADA</Text>
        <Text style={S.h2}>Fitxa de cada instrument</Text>

        <View style={S.tableHead}>
          <Text style={[S.th, { flex: 3 }]}>Nom / ISIN</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'right' }]}>Pes</Text>
          <Text style={[S.th, { flex: 2 }]}>Categoria</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'center' }]}>SRRI</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'right' }]}>TER</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'right' }]}>Ret.†/*</Text>
          <Text style={[S.th, { flex: 2 }]}>Plataforma</Text>
        </View>

        {d.assets.map((a, i) => (
          <View key={a.isin} style={[S.tableRow, i % 2 === 1 ? S.tableAlt : {}]}>
            <View style={{ flex: 3 }}>
              <Text style={S.td}>{a.name}</Text>
              <Text style={{ fontSize: 6.5, color: C.gray, fontFamily: 'Helvetica' }}>{a.isin}</Text>
            </View>
            <Text style={[S.td, S.bold, { flex: 1, textAlign: 'right', color: ASSET_COLORS[i % ASSET_COLORS.length] }]}>{a.weight}%</Text>
            <Text style={[S.tdGray, { flex: 2 }]}>{a.category}</Text>
            <Text style={[S.td, { flex: 1, textAlign: 'center' }]}>{a.risk}/7</Text>
            <Text style={[S.td, { flex: 1, textAlign: 'right' }]}>{a.ter.toFixed(2)}%</Text>
            <Text style={[S.td, { flex: 1, textAlign: 'right', color: C.green2 }]}>{fPct(assetReturn(a))}{assetReturnSource(a)}</Text>
            <Text style={[S.tdGray, { flex: 2 }]}>{a.platform}</Text>
          </View>
        ))}

        <View style={{ flexDirection: 'row', paddingTop: 6, borderTopWidth: 1, borderTopColor: C.dark, marginTop: 3, marginBottom: 12 }}>
          <Text style={[S.body2, { flex: 3 }]}>Totals ponderats</Text>
          <Text style={[S.td, S.bold, { flex: 1, textAlign: 'right' }]}>100%</Text>
          <Text style={[S.tdGray, { flex: 2 }]}></Text>
          <Text style={[S.tdGray, { flex: 1, textAlign: 'center' }]}>{c.wR.toFixed(1)}/7</Text>
          <Text style={[S.td, S.bold, { flex: 1, textAlign: 'right' }]}>{c.wt.toFixed(2)}%</Text>
          <Text style={[S.td, S.bold, { flex: 1, textAlign: 'right', color: C.green2 }]}>{fPct(c.nr)}</Text>
          <Text style={[S.tdGray, { flex: 2 }]}></Text>
        </View>
        <Text style={[S.body2, { fontSize: 6.5, marginBottom: 10 }]}>† Dades historials reals 5A · * Estimació per categoria SRRI</Text>

        <View style={S.divider} />

        <Text style={[S.tag, { marginBottom: 7 }]}>JUSTIFICACIÓ PER INSTRUMENT</Text>
        {d.assets.filter(a => a.justification).map((a, i) => (
          <View key={a.isin} wrap={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
              <Text style={[S.body1, S.bold]}>{a.name} · {a.weight}% · {a.category}</Text>
            </View>
            <Text style={[S.body2, { paddingLeft: 14 }]}>{a.justification}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
}

// ─── PAGE 7: IPS ──────────────────────────────────────────────────────────────
function IPSPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;
  const cn = CONSTRAINTS[d.investorProfile] ?? CONSTRAINTS.moderat;
  const benchName  = BENCHMARK_NAME[d.investorProfile] ?? 'MSCI World';

  const sections = [
    {
      num: '1', title: 'Objectius d\'inversió',
      body: `Assolir el creixement patrimonial necessari per a l'objectiu "${d.objective}" en un horitzó de ${d.horizon} anys. Capital inicial: ${fEur(d.initialAmount)}. Aportació mensual: ${fEur(d.monthlyAmount)}. Rendiment objectiu net: ${fPct(c.nr)} anual (base).`,
    },
    {
      num: '2', title: 'Restriccions i limitacions',
      body: `Perfil: ${profileLabel}. Restriccions d'assignació: RV ${cn.rvMin}–${cn.rvMax}%, RF ${cn.rfMin}–${cn.rfMax}%. Cap actiu supera el 50% de la cartera. TER màxim ponderat: 1,50% anual. Cap exposició a derivats d'alt apalancament.`,
    },
    {
      num: '3', title: 'Estratègia d\'assignació d\'actius',
      body: `Estratègia de compra i manteniment (Buy & Hold) amb rebalanceig anual. Assignació actual: RV ${c.rvPct}%, RF ${c.rfPct}%, Cash/Monetari ${c.cashPct}%. Diversificació geogràfica global amb exposició principal a mercats desenvolupats.`,
    },
    {
      num: '4', title: 'Criteris de selecció de productes',
      body: `Priority a fons indexats de baix cost (ETF/UCITS). TER < 0,50% preferible. SRRI adequat al perfil. ISIN registrat a CNMV o entitat regulada equivalent. Diponibilitat a la plataforma declarada per l'inversor.`,
    },
    {
      num: '5', title: 'Política de rebalanceig',
      body: `Rebalanceig mínim anual o quan qualsevol actiu desviï ≥10 punts percentuals del pes target. Mètode: compra selectiva via aportació mensual (tax-efficient) i venda parcial quan necessari. Documentar cada rebalanceig.`,
    },
    {
      num: '6', title: 'Benchmark de referència',
      body: `Índex de referència: ${benchName} (retorn esperat: ${fPct(c.benchR)} anual). Alfa estimat de la cartera actual: ${fPct(c.alpha, true)}. Objectiu: superar o igualar el benchmark net de costos en horitzons ≥5 anys.`,
    },
    {
      num: '7', title: 'Criteris ESG / Sostenibilitat',
      body: `Incorporar criteri de filtratge negatiu per a sectors controvertits (armament, tabac, combustibles fòssils) quan estigui disponible en alternatives de cost similar. Preferència per fons Art. 8 SFDR o superior quan el cost no excedeixi 0,20% TER addicional.`,
    },
    {
      num: '8', title: 'Govern, revisió i documentació',
      body: `Revisió integral anual del pla. Actualització del qüestionari MiFID II si canvia la situació financera, laboral o objectius. Custòdia del present IPS a l'expedient del client. Vigència d'aquest document: fins la propera revisió anual o canvi de perfil.`,
    },
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="IPS — Política d'Inversió" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>IPS — INVESTMENT POLICY STATEMENT</Text>
        <Text style={S.h2}>Declaració de Política d&apos;Inversió</Text>
        <Text style={[S.body2, { marginBottom: 10 }]}>
          Document formal que recull els objectius, restriccions i estratègia d&apos;inversió del client d&apos;acord amb la Directiva MiFID II (Art. 54 Reglament Delegat 2017/565).
        </Text>

        {sections.map((sec, i) => (
          <View key={sec.num} style={{ marginBottom: 9 }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 3 }}>
              <View style={{ width: 16, height: 16, backgroundColor: C.green, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: 7.5, color: C.gold, fontFamily: 'Helvetica-Bold' }}>{sec.num}</Text>
              </View>
              <Text style={[S.body1, S.bold, { flex: 1 }]}>{sec.title}</Text>
            </View>
            <Text style={[S.body2, { paddingLeft: 24, lineHeight: 1.6 }]}>{sec.body}</Text>
            {i < sections.length - 1 && <View style={{ height: 0.5, backgroundColor: C.grayLight, marginTop: 8, marginLeft: 24 }} />}
          </View>
        ))}

        <View style={[S.legalBox, { marginTop: 6 }]}>
          <Text style={[S.legalText, S.bold, { marginBottom: 2 }]}>Declaració de conformitat</Text>
          <Text style={S.legalText}>
            Aquest document ha estat elaborat per l&apos;equip assessor de Factor OTC, revisat i acceptat pel client. Constitueix la base de totes les decisions d&apos;inversió posteriors mentre estigui en vigor. Qualsevol canvi substancial en la situació financera del client invalidarà el present IPS i requerirà revisió.
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 8: SUITABILITY MiFID II + FRONTERA EFICIENT ─────────────────────────
function SuitabilityPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;

  // Build efficient frontier scatter data
  const maxVol = Math.max(c.wv + 5, ...d.assets.map(a => assetVol(a))) + 2;
  const maxRet = Math.max(c.nr  + 3, ...d.assets.map(a => assetReturn(a))) + 1;
  const W = 460, H = 110;
  const pad = { left: 5, right: 5, top: 5, bot: 5 };
  const toX = (vol: number) => pad.left + (vol / maxVol) * (W - pad.left - pad.right);
  const toY = (ret: number) => H - pad.bot - (ret / maxRet) * (H - pad.top - pad.bot);

  return (
    <Page size="A4" style={S.page}>
      <Header section="Suitability MiFID II" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>SUITABILITY — MiFID II</Text>
        <Text style={S.h2}>Adequació dels instruments al perfil</Text>

        {/* Suitability table */}
        <View style={S.tableHead}>
          <Text style={[S.th, { flex: 3 }]}>Instrument</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'center' }]}>SRRI</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'right' }]}>Pes</Text>
          <Text style={[S.th, { flex: 2 }]}>Adequació</Text>
          <Text style={[S.th, { flex: 2 }]}>Observació</Text>
        </View>
        {d.assets.map((a, i) => {
          const maxRisk = d.investorProfile === 'conservador' ? 3
            : d.investorProfile === 'moderat' ? 4
            : d.investorProfile === 'dinamic' ? 6 : 7;
          const suitable = a.risk <= maxRisk;
          return (
            <View key={a.isin} style={[S.tableRow, i % 2 === 1 ? S.tableAlt : {}]}>
              <Text style={[S.td, { flex: 3 }]}>{a.name.length > 28 ? a.name.slice(0, 28) + '…' : a.name}</Text>
              <Text style={[S.td, { flex: 1, textAlign: 'center' }]}>{a.risk}/7</Text>
              <Text style={[S.td, S.bold, { flex: 1, textAlign: 'right', color: ASSET_COLORS[i % ASSET_COLORS.length] }]}>{a.weight}%</Text>
              <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: suitable ? C.green2 : C.amber }} />
                <Text style={{ fontSize: 8, color: suitable ? C.green2 : C.amber, fontFamily: 'Helvetica-Bold' }}>{suitable ? 'ADEQUAT' : 'REVISAR'}</Text>
              </View>
              <Text style={[S.tdGray, { flex: 2, fontSize: 7 }]}>{suitable ? `Compatible perfil ${profileLabel}` : 'SRRI superior al perfil'}</Text>
            </View>
          );
        })}

        <View style={S.divider} />

        {/* Efficient Frontier */}
        <Text style={S.tag}>FRONTERA EFICIENT</Text>
        <Text style={[S.h3, { marginBottom: 4 }]}>Espai risc–rendiment dels instruments i la cartera</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ width: 10, height: 10, backgroundColor: C.gold, borderRadius: 5 }} />
          <Text style={[S.body2, { marginLeft: 4, marginRight: 12 }]}>Cartera</Text>
          {d.assets.slice(0, 5).map((a, i) => (
            <View key={a.isin} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
              <View style={{ width: 7, height: 7, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length], borderRadius: 3.5 }} />
              <Text style={[S.body2, { marginLeft: 3 }]}>{a.name.slice(0, 12)}</Text>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.grayBg, borderWidth: 0.5, borderColor: C.grayLight, padding: 4 }}>
          <Svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
            <Defs>
              <LinearGradient id="ef-grad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={C.green2} stopOpacity={0.15} />
                <Stop offset="1" stopColor={C.gold} stopOpacity={0.15} />
              </LinearGradient>
            </Defs>
            {[0.25, 0.5, 0.75].map(f => (
              <Line key={f} x1={0} y1={toY(maxRet * f).toFixed(1)} x2={W} y2={toY(maxRet * f).toFixed(1)} stroke={C.grayLight} strokeWidth={0.5} />
            ))}
            {d.assets.map((a, i) => {
              const vol = assetVol(a);
              const ret = assetReturn(a);
              return <Circle key={a.isin} cx={toX(vol).toFixed(1)} cy={toY(ret).toFixed(1)} r={5} fill={ASSET_COLORS[i % ASSET_COLORS.length]} fillOpacity={0.75} />;
            })}
            <Circle cx={toX(c.wv).toFixed(1)} cy={toY(c.nr).toFixed(1)} r={8} fill={C.gold} />
            <Circle cx={toX(c.wv).toFixed(1)} cy={toY(c.nr).toFixed(1)} r={4} fill={C.white} />
          </Svg>
          <Text style={{ fontSize: 6, color: C.gray, textAlign: 'center', marginTop: 2 }}>Volatilitat (%)</Text>
        </View>

        <View style={S.divider} />

        {/* Suitability summary */}
        <View style={S.cardGold}>
          <Text style={[S.body1, S.bold, { color: C.green, marginBottom: 2 }]}>Conclusió suitability: {profileLabel}</Text>
          <Text style={S.body2}>
            La cartera té un SRRI ponderat de {c.wR.toFixed(1)}/7 i és {c.wR <= (d.investorProfile === 'conservador' ? 3 : d.investorProfile === 'moderat' ? 4 : d.investorProfile === 'dinamic' ? 5.5 : 7) ? 'adequada' : 'parcialment adequada'} per al perfil {profileLabel}.
            Rendiment esperat net: {fPct(c.nr)} · Volatilitat: {fPct(c.wv)} · Sharpe: {c.sharpe.toFixed(2)}.
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 9: CORRELACIÓ D'ACTIUS ──────────────────────────────────────────────
function CorrelationPage({ d }: { d: ManualPortfolioInput }) {
  const assets = d.assets.slice(0, 7);
  const n = assets.length;
  const cellW = Math.min(55, Math.floor(460 / (n + 1)));

  return (
    <Page size="A4" style={S.page}>
      <Header section="Correlació d'Actius" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>MATRIU DE CORRELACIÓ</Text>
        <Text style={S.h2}>Diversificació entre instruments</Text>
        <Text style={[S.body2, { marginBottom: 12 }]}>
          Correlació estimada basada en les categories dels actius. Valors propers a −1 indiquen diversificació màxima; propers a +1, actius molt correlats.
        </Text>

        {/* Header row */}
        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
          <View style={{ width: cellW + 20 }} />
          {assets.map((a, i) => (
            <View key={a.isin} style={{ width: cellW, alignItems: 'center' }}>
              <Text style={{ fontSize: 6, color: C.dark, fontFamily: 'Helvetica-Bold' }}>#{i + 1}</Text>
            </View>
          ))}
        </View>

        {/* Heatmap rows */}
        {assets.map((rowA, i) => (
          <View key={rowA.isin} style={{ flexDirection: 'row', marginBottom: 2 }}>
            <View style={{ width: cellW + 20, justifyContent: 'center' }}>
              <Text style={{ fontSize: 6.5, color: C.dark }}>{`#${i + 1} ${rowA.name.slice(0, 14)}`}</Text>
            </View>
            {assets.map((colA, j) => {
              const r = corrBetween(rowA, colA);
              return (
                <View key={colA.isin} style={{ width: cellW, height: 26, backgroundColor: corrColor(r), justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: C.white }}>
                  <Text style={{ fontSize: 7.5, color: corrText(r), fontFamily: i === j ? 'Helvetica-Bold' : 'Helvetica' }}>
                    {r.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}

        {/* Legend */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'center' }}>
          <Text style={[S.body2, { marginRight: 4 }]}>Escala:</Text>
          {[
            { color: '#1a3a2a', label: '≥0.80' },
            { color: '#2d6a4f', label: '0.60' },
            { color: '#52b788', label: '0.40' },
            { color: '#d8f3dc', label: '0.20' },
            { color: '#f3f4f6', label: '0.00' },
            { color: '#fee2e2', label: '−0.20' },
            { color: '#ef4444', label: '< −0.20' },
          ].map(l => (
            <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{ width: 14, height: 10, backgroundColor: l.color }} />
              <Text style={{ fontSize: 6.5, color: C.gray }}>{l.label}</Text>
            </View>
          ))}
        </View>

        <View style={S.divider} />

        {/* Interpretation */}
        <Text style={S.tag}>INTERPRETACIÓ</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          {[
            ['Alta correlació (>0.7)', 'Actius del mateix segment que es mouen junts. Menor benefici de diversificació.', C.amber],
            ['Correlació neutra (0 – 0.3)', 'Comportament independent. Contribució positiva a la diversificació de la cartera.', C.gold],
            ['Correlació negativa (<0)', 'Actius que es compensen mútuament. Efecte amortidor en moments de caiguda del mercat.', C.green2],
          ].map(([title, desc, color]) => (
            <View key={title as string} style={{ flex: 1, borderTopWidth: 3, borderTopColor: color as string, borderWidth: 0.5, borderColor: C.grayLight, padding: 10 }}>
              <Text style={[S.body2, S.bold, { marginBottom: 3 }]}>{title}</Text>
              <Text style={[S.body2, { fontSize: 7.5 }]}>{desc}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 10: ANÀLISI GRÀFICA ─────────────────────────────────────────────────
function AnalysisPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  const benchR = c.benchR;
  const nPts   = 9;
  const nowY   = new Date().getFullYear();

  // Build evolution data (indexed to 100)
  const times = Array.from({ length: nPts }, (_, i) => i * d.horizon / (nPts - 1));
  const ptfVals  = times.map(t => t === 0 ? 100 : 100 * Math.pow(1 + c.nr  / 100, t));
  const benchVals= times.map(t => t === 0 ? 100 : 100 * Math.pow(1 + benchR / 100, t));
  const maxV = Math.max(...ptfVals) * 1.03;
  const W = 465, H = 120;
  const xs = Array.from({ length: nPts }, (_, i) => 5 + i * (W - 10) / (nPts - 1));
  const pathPtf   = makeLine(ptfVals,   xs, 100, maxV, 5, H - 5);
  const pathBench = makeLine(benchVals, xs, 100, maxV, 5, H - 5);

  // Area under ptf line
  const toY = (v: number) => 5 + (H - 10) * (1 - (v - 100) / (maxV - 100));
  const areaPath = pathPtf + ` L${xs[nPts-1].toFixed(1)},${(H-5).toFixed(1)} L${xs[0].toFixed(1)},${(H-5).toFixed(1)} Z`;

  // Period returns
  const periodReturn = (months: number) => (Math.pow(1 + c.nr / 100, months / 12) - 1) * 100;
  const periods = [
    { label: '1M',  ret: periodReturn(1)   },
    { label: '3M',  ret: periodReturn(3)   },
    { label: '6M',  ret: periodReturn(6)   },
    { label: '1A',  ret: periodReturn(12)  },
    { label: '3A',  ret: periodReturn(36)  },
    { label: '5A',  ret: periodReturn(60)  },
    { label: `${d.horizon}A`, ret: periodReturn(d.horizon * 12) },
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="Anàlisi Gràfica" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>ANÀLISI GRÀFICA</Text>
        <Text style={S.h2}>Evolució estimada de la cartera</Text>
        <Text style={[S.body2, { marginBottom: 6 }]}>Projectat des de base 100. — Cartera · - - Benchmark {BENCHMARK_NAME[d.investorProfile] ?? ''}</Text>

        {/* Legend */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 20, height: 2, backgroundColor: C.dark }} />
            <Text style={S.body2}>Cartera ({fPct(c.nr)} anual)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 20, height: 2, backgroundColor: C.gray }} />
            <Text style={S.body2}>Benchmark ({fPct(benchR)} anual)</Text>
          </View>
        </View>

        {/* Chart */}
        <View style={{ backgroundColor: C.grayBg, borderWidth: 0.5, borderColor: C.grayLight, padding: 4, marginBottom: 8 }}>
          <Svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
            <Defs>
              <LinearGradient id="ev-area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.gold} stopOpacity={0.25} />
                <Stop offset="1" stopColor={C.gold} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {/* Grid */}
            {[0.25, 0.5, 0.75].map(f => {
              const gridY = (5 + (H - 10) * (1 - f)).toFixed(1);
              return <Line key={f} x1={0} y1={gridY} x2={W} y2={gridY} stroke={C.grayLight} strokeWidth={0.5} />;
            })}
            {/* Area */}
            <Path d={areaPath} fill="url(#ev-area)" />
            {/* Benchmark */}
            <Path d={pathBench} fill="none" stroke={C.gray} strokeWidth={1.5} strokeDasharray="4,3" />
            {/* Portfolio */}
            <Path d={pathPtf} fill="none" stroke={C.dark} strokeWidth={2} />
          </Svg>
        </View>

        {/* X-axis labels */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 4, marginBottom: 10 }}>
          {times.filter((_, i) => i % 2 === 0 || i === nPts - 1).map(t => (
            <Text key={t} style={[S.body2, { flex: 1, textAlign: 'center', fontSize: 6.5 }]}>{nowY + Math.round(t)}</Text>
          ))}
        </View>

        <View style={S.divider} />

        {/* Period returns */}
        <Text style={S.tag}>RENDIMENTS ESTIMATS PER PERÍODE</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {periods.map(p => (
            <View key={p.label} style={[S.metricBox, { borderTopWidth: 3, borderTopColor: p.ret >= 0 ? C.green2 : C.red }]}>
              <Text style={[S.metricLabel, { textAlign: 'center' }]}>{p.label}</Text>
              <Text style={[S.metricValue, { fontSize: 12, textAlign: 'center', color: p.ret >= 0 ? C.green2 : C.red }]}>{fPct(p.ret, true)}</Text>
            </View>
          ))}
        </View>

        <View style={S.divider} />

        {/* 9 analytics metrics */}
        <Text style={S.tag}>MÈTRIQUES QUANTITATIVES</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {[
            { label: 'Rendiment net',   value: fPct(c.nr)             },
            { label: 'Volatilitat',     value: fPct(c.wv)             },
            { label: 'Sharpe Ratio',    value: c.sharpe.toFixed(2)    },
            { label: 'VaR 95% (1A)',   value: fPct(c.var95)          },
            { label: 'Max Drawdown est.', value: fPct(c.maxDD)        },
            { label: 'Alfa vs benchmark', value: fPct(c.alpha, true)  },
            { label: 'Benchmark ret.',  value: fPct(c.benchR)         },
            { label: 'TER ponderat',    value: `${c.wt.toFixed(2)}%` },
            { label: 'Ràtio multiplicador', value: `×${(c.p50 / Math.max(1, c.totalInvested)).toFixed(1)}` },
          ].map(m => (
            <View key={m.label} style={{ width: '31.5%', borderWidth: 0.5, borderColor: C.grayLight, padding: 8 }}>
              <Text style={S.metricLabel}>{m.label}</Text>
              <Text style={[S.metricValue, { fontSize: 13 }]}>{m.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 11: MONTE CARLO ─────────────────────────────────────────────────────
function MonteCarloPage({ d }: { d: ManualPortfolioInput }) {
  const c    = compute(d);
  const nPts = 8;
  const W = 465, H = 130;

  const times = Array.from({ length: nPts }, (_, i) => i * d.horizon / (nPts - 1));
  const xs    = Array.from({ length: nPts }, (_, i) => 5 + i * (W - 10) / (nPts - 1));

  const vP50 = times.map(t => t === 0 ? d.initialAmount : projection(d.initialAmount, d.monthlyAmount, c.nr,  t));
  const vP10 = times.map(t => t === 0 ? d.initialAmount : projection(d.initialAmount, d.monthlyAmount, c.r10, t));
  const vP90 = times.map(t => t === 0 ? d.initialAmount : projection(d.initialAmount, d.monthlyAmount, c.r90, t));
  const vAp  = times.map(t => d.initialAmount + d.monthlyAmount * t * 12);

  const allVals = [...vP90, ...vP10, ...vAp];
  const minV = Math.min(...allVals) * 0.96;
  const maxV = Math.max(...allVals) * 1.04;

  const pathP50   = makeLine(vP50, xs, minV, maxV, 5, H - 5);
  const pathP10   = makeLine(vP10, xs, minV, maxV, 5, H - 5);
  const pathP90   = makeLine(vP90, xs, minV, maxV, 5, H - 5);
  const pathAp    = makeLine(vAp,  xs, minV, maxV, 5, H - 5);

  // Area band P10–P90
  const toYMC = (v: number) => (5 + (H - 10) * (1 - (v - minV) / (maxV - minV))).toFixed(1);
  const areaTop = vP90.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${toYMC(v)}`).join(' ');
  const areaBtm = vP10.slice().reverse().map((v, i) => `L${xs[nPts - 1 - i].toFixed(1)},${toYMC(v)}`).join(' ');
  const bandPath = areaTop + ' ' + areaBtm + ' Z';

  const nowY = new Date().getFullYear();

  return (
    <Page size="A4" style={S.page}>
      <Header section="Projecció per Escenaris" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>PROJECCIÓ PER ESCENARIS</Text>
        <Text style={S.h2}>Projecció per escenaris · {d.horizon} anys</Text>
        <Text style={[S.body2, { marginBottom: 6 }]}>
          Projecció determinista per interès compost. P50 = retorn net esperat ({fPct(c.nr)}). P10/P90 = P50 ± 0.35×σ ({fPct(c.wv)}). No és simulació estocàstica.
        </Text>

        {/* Legend */}
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 6 }}>
          {[
            { label: `P90 — Optimista (${fPct(c.r90)})`, color: C.green2, dash: true },
            { label: `P50 — Base (${fPct(c.nr)})`,        color: C.dark,   dash: false },
            { label: `P10 — Pessimista (${fPct(c.r10)})`, color: C.red,    dash: true },
            { label: 'Capital aportat',                     color: C.gray,   dash: true },
          ].map(l => (
            <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 18, height: 2, backgroundColor: l.color, opacity: l.dash ? 0.7 : 1 }} />
              <Text style={[S.body2, { fontSize: 7 }]}>{l.label}</Text>
            </View>
          ))}
        </View>

        {/* Chart */}
        <View style={{ backgroundColor: C.grayBg, borderWidth: 0.5, borderColor: C.grayLight, padding: 4, marginBottom: 6 }}>
          <Svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
            <Defs>
              <LinearGradient id="mc-band" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.gold} stopOpacity={0.20} />
                <Stop offset="1" stopColor={C.gold} stopOpacity={0.04} />
              </LinearGradient>
            </Defs>
            {/* Grid */}
            {[0.25, 0.5, 0.75].map(f => {
              const gy = (5 + (H - 10) * (1 - f)).toFixed(1);
              return <Line key={f} x1={0} y1={gy} x2={W} y2={gy} stroke={C.grayLight} strokeWidth={0.5} />;
            })}
            {/* Band */}
            <Path d={bandPath} fill="url(#mc-band)" />
            {/* Lines */}
            <Path d={pathAp}  fill="none" stroke={C.gray}   strokeWidth={1.5} strokeDasharray="3,3" />
            <Path d={pathP10} fill="none" stroke={C.red}    strokeWidth={1.5} strokeDasharray="4,3" />
            <Path d={pathP90} fill="none" stroke={C.green2} strokeWidth={1.5} strokeDasharray="4,3" />
            <Path d={pathP50} fill="none" stroke={C.dark}   strokeWidth={2.5} />
          </Svg>
        </View>

        {/* X-axis */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 4, marginBottom: 10 }}>
          {times.filter((_, i) => i % 2 === 0 || i === nPts - 1).map(t => (
            <Text key={t} style={[S.body2, { flex: 1, textAlign: 'center', fontSize: 6.5 }]}>{nowY + Math.round(t)}</Text>
          ))}
        </View>

        {/* Scenario cards */}
        <View style={[S.row, { marginBottom: 8 }]}>
          {[
            { label: 'Escenari Pessimista (P10)', value: fEur(c.p10), rate: fPct(c.r10), color: C.red },
            { label: 'Escenari Base (P50)',        value: fEur(c.p50), rate: fPct(c.nr),  color: C.gold },
            { label: 'Escenari Optimista (P90)',   value: fEur(c.p90), rate: fPct(c.r90), color: C.green2 },
          ].map(sc => (
            <View key={sc.label} style={[S.metricBox, { borderTopWidth: 3, borderTopColor: sc.color }]}>
              <Text style={[S.metricLabel, { color: sc.color }]}>{sc.label}</Text>
              <Text style={[S.metricValue, { color: sc.color, fontSize: 16 }]}>{sc.value}</Text>
              <Text style={S.metricSub}>Rendiment: {sc.rate} anual</Text>
              <Text style={[S.metricSub, { marginTop: 2 }]}>Guany: {fEur(sc.value === fEur(c.p10) ? c.p10 - c.totalInvested : sc.value === fEur(c.p50) ? c.p50 - c.totalInvested : c.p90 - c.totalInvested)}</Text>
            </View>
          ))}
        </View>

        {/* Probability metrics */}
        <View style={S.divider} />
        <Text style={S.tag}>ESTADÍSTIQUES DE PROBABILITAT</Text>
        <View style={[S.row, { marginTop: 6 }]}>
          <MetricBox label="Capital aportat total"  value={fEur(c.totalInvested)} sub={`${d.initialAmount > 0 ? fEur(d.initialAmount) : ''} + ${fEur(d.monthlyAmount)}/mes`} />
          <MetricBox label="Guany esperat (P50)"    value={fEur(c.p50 - c.totalInvested)} sub="projecció central" topColor={C.gold} />
          <MetricBox label="Guany mínim (P10)"      value={fEur(c.p10 - c.totalInvested)} sub="escenari advers" topColor={C.red} />
          <MetricBox label="Guany màxim (P90)"      value={fEur(c.p90 - c.totalInvested)} sub="escenari favorable" topColor={C.green2} />
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 12: RISCOS I CONCLUSIÓ ──────────────────────────────────────────────
function ConclusionPage({ d, generatedAt }: { d: ManualPortfolioInput; generatedAt: string }) {
  const c = compute(d);
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;

  const risks = [
    { category: 'Risc de mercat',    level: 'Moderat–Alt', desc: 'Fluctuació de valoracions. Mitiga amb horitzó llarg i diversificació.', color: C.amber },
    { category: 'Risc de liquiditat',level: 'Baix–Moderat', desc: 'ETFs UCITS cotitzen diàriament. Algunes emis. poden tenir spread ampli.', color: C.gold },
    { category: 'Risc de divisa',    level: c.rvPct > 50 ? 'Moderat' : 'Baix', desc: 'Actius en USD/GBP presenten exposició FX. Cobertura via ETF EUR-hedged si es prefereix.', color: C.amber },
    { category: 'Risc de concentració', level: 'Baix', desc: `${d.assets.length} instruments de ${d.assets.length} categories. Diversificació adequada al perfil.`, color: C.green2 },
    { category: 'Risc de tipus d\'interès', level: c.rfPct > 30 ? 'Moderat' : 'Baix', desc: 'Renda fixa sensible a pujades de tipus. Gestionar duration de la cartera RF.', color: c.rfPct > 30 ? C.amber : C.green2 },
    { category: 'Risc regulatori',   level: 'Baix', desc: 'Canvis MiFID, SFDR, fiscalitat podrien afectar el TER net efectiu de la cartera.', color: C.blue },
  ];

  const monitoring = [
    ['Revisió mensual',   'Verificar aportació automàtica i ingressos. Actualitzar si canvia la situació laboral.'],
    ['Revisió trimestral','Controlar desviació dels pesos target. Actuar si >5% desviat.'],
    ['Revisió anual',     'Rebalanceig formal, actualització qüestionari MiFID II, revisió de l\'IPS, fiscalitat.'],
    ['Revisió extraordin.','Canvi laboral, herència, compra immoble, canvi d\'objectiu vital. Actualitzar el pla.'],
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="Riscos i Conclusió" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <Text style={S.tag}>FACTORS DE RISC</Text>
        <Text style={S.h2}>Riscos identificats i mitigació</Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {risks.map(r => (
            <View key={r.category} style={{ width: '47%', borderLeftWidth: 3, borderLeftColor: r.color, borderWidth: 0.5, borderColor: C.grayLight, padding: 10, marginBottom: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={[S.body2, S.bold, { color: C.dark }]}>{r.category}</Text>
                <View style={{ backgroundColor: r.color + '22', borderRadius: 3, padding: '2 6' }}>
                  <Text style={{ fontSize: 6.5, color: r.color, fontFamily: 'Helvetica-Bold' }}>{r.level}</Text>
                </View>
              </View>
              <Text style={[S.body2, { fontSize: 7.5, lineHeight: 1.5 }]}>{r.desc}</Text>
            </View>
          ))}
        </View>

        {/* Monitoring plan */}
        <Text style={S.tag}>PLA DE SEGUIMENT</Text>
        <View style={[S.tableHead, { marginTop: 4 }]}>
          <Text style={[S.th, { flex: 1.5 }]}>Freqüència</Text>
          <Text style={[S.th, { flex: 4 }]}>Acció de seguiment</Text>
        </View>
        {monitoring.map(([freq, action], i) => (
          <View key={freq} style={[S.tableRow, i % 2 === 1 ? S.tableAlt : {}]}>
            <Text style={[S.td, S.bold, { flex: 1.5, color: C.gold }]}>{freq}</Text>
            <Text style={[S.td, { flex: 4 }]}>{action}</Text>
          </View>
        ))}

        <View style={S.divider} />

        {/* Conclusion */}
        <Text style={S.tag}>CONCLUSIÓ</Text>
        <View style={[S.cardGold, { marginTop: 4 }]}>
          <Text style={[S.body1, S.bold, { color: C.green, marginBottom: 4 }]}>Valoració del pla d&apos;inversió: {profileLabel}</Text>
          <Text style={[S.body1, { color: C.dark, marginBottom: 6 }]}>
            La cartera dissenyada per a {d.clientName} és coherent amb el perfil {profileLabel} i l&apos;objectiu &quot;{d.objective}&quot;.
            Amb un rendiment net estimat del {fPct(c.nr)} anual, la projecció base assoleix {fEur(c.p50)} en {d.horizon} anys, sobre un capital aportat de {fEur(c.totalInvested)}.
          </Text>
          <Text style={S.body2}>
            El Sharpe Ratio de {c.sharpe.toFixed(2)} i l&apos;alfa de {fPct(c.alpha, true)} vs. benchmark indiquen una compensació risc–rendiment {c.sharpe >= 0.5 ? 'positiva i competitiva' : 'adequada al perfil'}. Es recomana seguir el pla de seguiment establert a l&apos;IPS i revisar anualment.
          </Text>
        </View>

        <View style={S.divider} />
        <Text style={S.tag}>METODOLOGIA I FONTS DE DADES</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 10 }}>
          <View style={{ flex: 1, borderWidth: 0.5, borderColor: C.grayLight, padding: 8 }}>
            <Text style={[S.body2, S.bold, { color: C.dark, marginBottom: 3 }]}>Rendiments dels actius</Text>
            <Text style={[S.body2, { fontSize: 7, lineHeight: 1.5 }]}>† Dades historials reals 5A de la base de dades. * Estimació per SRRI: 1→2%, 2→3.5%, 3→5%, 4→7%, 5→9.5%, 6→13%, 7→17%. Volatilitat: mateixa font.</Text>
          </View>
          <View style={{ flex: 1, borderWidth: 0.5, borderColor: C.grayLight, padding: 8 }}>
            <Text style={[S.body2, S.bold, { color: C.dark, marginBottom: 3 }]}>Projecció de cartera</Text>
            <Text style={[S.body2, { fontSize: 7, lineHeight: 1.5 }]}>Interès compost + aportació mensual. P50 = retorn net. P10 = P50 − 0.35σ. P90 = P50 + 0.35σ. Projecció determinista, no simulació estocàstica.</Text>
          </View>
          <View style={{ flex: 1, borderWidth: 0.5, borderColor: C.grayLight, padding: 8 }}>
            <Text style={[S.body2, S.bold, { color: C.dark, marginBottom: 3 }]}>Altres models</Text>
            <Text style={[S.body2, { fontSize: 7, lineHeight: 1.5 }]}>Correlació estimada per categoria. VaR 95% = −1.645σ. Max Drawdown = −0.7σ. Taxa lliure de risc: 3.5% (BCE). Benchmark: retorns de referència per perfil.</Text>
          </View>
        </View>

        {/* Legal */}
        <View style={S.legalBox}>
          <Text style={[S.legalText, S.bold, { marginBottom: 3 }]}>Avís legal · Disclaimer · {generatedAt}</Text>
          <Text style={S.legalText}>
            Aquest informe ha estat elaborat per Factor OTC amb finalitat exclusivament orientativa i educativa. No constitueix assessorament financer personalitzat regulat (MiFID II) ni oferta o recomanació d&apos;inversió. Factor OTC no és una entitat financera autoritzada per la CNMV o equivalent. Els rendiments estimats es basen en models estadístics i dades historials que no garanteixen resultats futurs. Invertir implica risc de pèrdua total o parcial del capital. Consulti un assessor financer regulat autoritzat per la CNMV abans de prendre decisions d&apos;inversió. Informe generat: {generatedAt} · Client: {d.clientName} · Factor OTC Admin.
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── DOCUMENT ─────────────────────────────────────────────────────────────────
interface Props {
  data:        ManualPortfolioInput;
  generatedAt: string;
}

export function ManualReportPDF({ data, generatedAt }: Props) {
  return (
    <Document
      title={`Factor OTC — Informe ${data.clientName}`}
      author="Factor OTC"
      creator="Factor OTC Admin"
      producer="@react-pdf/renderer v4">
      <CoverPage        d={data} generatedAt={generatedAt} />
      <ExecutivePage    d={data} />
      <ProfilePage      d={data} />
      <DiagnosticsPage  d={data} />
      <PortfolioPage    d={data} />
      <AssetsPage       d={data} />
      <IPSPage          d={data} />
      <SuitabilityPage  d={data} />
      <CorrelationPage  d={data} />
      <AnalysisPage     d={data} />
      <MonteCarloPage   d={data} />
      <ConclusionPage   d={data} generatedAt={generatedAt} />
    </Document>
  );
}
