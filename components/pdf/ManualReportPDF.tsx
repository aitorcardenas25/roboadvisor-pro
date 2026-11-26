'use client';
import {
  Document, Page, Text, View, StyleSheet, Font,
  Svg, Path, Line, Circle, Defs, LinearGradient, Stop,
} from '@react-pdf/renderer';
import type { ManualPortfolioInput, ManualAsset } from '@/lib/manualReport';
import { capmReturn, CAPM_ASSUMPTIONS } from '@/lib/navMath';
import { DRAWDOWN_DISCLAIMER, dateLabel, fallLabel, frequencyLabel, recoveryLabel, type FundDrawdowns } from '@/lib/drawdowns';
import { allocationBreakdown, allocationNote, assetTypeLabel, classifyFund, managementLabel } from '@/lib/fundClassification';
import { exposureBreakdown, exposureNote, asOfLabel, REGIONS, SECTORS, SIZES, REGION_LABEL, SECTOR_LABEL, SIZE_LABEL, type ExposureBreakdown } from '@/lib/fundExposure';

const GOAL_HORIZON: Record<string, string> = { curt: 'Curt termini', mitja: 'Mitjà termini', llarg: 'Llarg termini' };

// Desactiva la partició de paraules: text net, sense guions de tall, com en
// un document editorial professional.
Font.registerHyphenationCallback(word => [word]);

// ─── COLORS ───────────────────────────────────────────────────────────────────
// Paleta sòbria FACTOR OTC: verd corporatiu, or (únic accent), negres/grisos
// i neutres càlids. Els verds/vermells "semàntics" són apagats i s'usen
// NOMÉS quan el signe del valor és el missatge. Es mantenen àlies dels noms
// antics apuntant a tons sobris perquè cap referència quedi orfe.
const C = {
  green:      '#14281d', // fons portada (verd profund)
  greenDeep:  '#1a3a2a',
  greenMid:   '#2d4a3a',
  greenLight: '#eef2ee',
  gold:       '#c9a84c', // ÚNIC accent
  goldSoft:   '#f4efe1',
  goldLight:  '#f4efe1',
  white:      '#ffffff',
  paper:      '#ffffff',
  offWhite:   '#f7f6f2',
  paperAlt:   '#f7f6f2',
  grayBg:     '#f3f2ec',
  line:       '#e4e2d8',
  grayLight:  '#e4e2d8',
  lineSoft:   '#efede4',
  ink:        '#1c1c1c',
  dark:       '#1c1c1c',
  gray:       '#6c6c6c',
  muted:      '#6c6c6c',
  mutedLt:    '#9b9a91',
  pos:        '#2f6b4f', // verd apagat — positiu
  neg:        '#9c3b34', // maó apagat — negatiu
  green2:     '#2f6b4f',
  red:        '#9c3b34',
  blue:       '#4c5a63', // pissarra neutra — ús mínim
  amber:      '#8f7636', // llautó apagat — ús mínim
};

// Rampa tonal per a actius: or → verd → gris. Sense arc de Sant Martí.
const ASSET_COLORS = ['#c9a84c', '#2d4a3a', '#8a7a4a', '#4f6b5c', '#b4ad96', '#6f6f67', '#d8c98f', '#324b3e'];

type Tone = 'pos' | 'neg' | 'neutral';

// Sense puntuacions MiFID fixes per perfil: no venien de cap qüestionari real.
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
// Rendiment esperat del benchmark amb el mateix CAPM que la cartera (abans eren xifres
// fixes de 3,2–10,5 % sense font). β ≈ pes de renda variable (renda fixa β ≈ 0).
const BENCHMARK_EQUITY: Record<string, number> = { conservador: 0, moderat: 0.4, dinamic: 0.7, agressiu: 1 };
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
  page:      { backgroundColor: C.white, fontFamily: 'Helvetica', paddingBottom: 54, color: C.ink },
  coverPage: { backgroundColor: C.green, fontFamily: 'Helvetica' },
  header: {
    paddingHorizontal: 48, paddingTop: 24, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 0.5, borderBottomColor: C.line,
  },
  footer: {
    position: 'absolute', bottom: 20, left: 48, right: 48,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 7,
  },
  body:    { paddingHorizontal: 48, paddingTop: 20 },
  tag:     { fontSize: 6.5, color: C.gold, fontFamily: 'Helvetica-Bold', letterSpacing: 1.6, textTransform: 'uppercase' },
  h2:      { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 3, letterSpacing: -0.3 },
  goldRule:{ width: 26, height: 2, backgroundColor: C.gold, marginTop: 7 },
  h3:      { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 5, letterSpacing: 0.2 },
  subTag:  { fontSize: 6.5, color: C.muted, fontFamily: 'Helvetica-Bold', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 7 },
  body1:   { fontSize: 9,  color: C.ink, lineHeight: 1.65, marginBottom: 5 },
  body2:   { fontSize: 8,  color: C.muted, lineHeight: 1.6 },
  bold:    { fontFamily: 'Helvetica-Bold' },
  italic:  { fontFamily: 'Helvetica-Oblique' },
  divider: { height: 0.5, backgroundColor: C.line, marginVertical: 14 },
  row:     { flexDirection: 'row', gap: 8, marginBottom: 8 },
  col:     { flex: 1 },
  metricBox: {
    flex: 1, borderWidth: 0.5, borderColor: C.line,
    padding: 10, backgroundColor: C.white,
  },
  metricLabel: { fontSize: 6.5, color: C.muted, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 5 },
  metricValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.ink, letterSpacing: -0.3 },
  metricSub:   { fontSize: 6.5, color: C.mutedLt, marginTop: 3, lineHeight: 1.4 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 4, marginBottom: 2 },
  tableRow:  { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.lineSoft, paddingVertical: 5, alignItems: 'center' },
  tableAlt:  { backgroundColor: C.offWhite },
  th:    { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.ink, letterSpacing: 0.6, textTransform: 'uppercase' },
  td:    { fontSize: 8, color: C.ink },
  tdGray:{ fontSize: 8, color: C.muted },
  legalBox:  { borderWidth: 0.5, borderColor: C.line, padding: 11, marginTop: 8, backgroundColor: C.offWhite },
  legalText: { fontSize: 6.5, color: C.muted, lineHeight: 1.55 },
  cardGold: {
    borderLeftWidth: 2, borderLeftColor: C.gold,
    borderTopWidth: 0.5, borderTopColor: C.line,
    borderRightWidth: 0.5, borderRightColor: C.line,
    borderBottomWidth: 0.5, borderBottomColor: C.line,
    padding: 13, backgroundColor: C.offWhite,
  },
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
// Import monetari: SEMPRE número complet, format català (milers amb ".", decimals
// amb ","), símbol "€". Cap abreviatura "K" / "M". Ex: 4.120.000 €, 3.250,50 €.
function fEur(n: number, decimals = 0): string {
  if (n == null || !isFinite(n)) return '—';
  // Normalitza el signe menys (Intl usa U+2212, absent a Helvetica) a guió ASCII.
  return n.toLocaleString('ca-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).replace(/\u2212/g, '-');
}
// Percentatge: decimals amb "," i espai abans de "%". Ex: 27,4 %.
function fPct(n: number, plus = false): string {
  if (n == null || !isFinite(n)) return '—';
  const dec = Math.abs(n) >= 100 ? 0 : 1;
  const s = n.toFixed(dec).replace('.', ',');
  return `${plus && n > 0 ? '+' : ''}${s} %`;
}
// Nombre decimal genèric amb coma catalana. Ex: 0,74 · 4,2
function fNum(n: number, dec = 2): string {
  if (n == null || !isFinite(n)) return '—';
  return n.toLocaleString('ca-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/\u2212/g, '-');
}
// Pes enter d'un actiu. Ex: 45 %
function fW(n: number): string { return `${Math.round(n)} %`; }
// TER / costos: sempre 2 decimals per no perdre precisió. Ex: 0,29 %
// TER 0 = no se sap (cap fons cobra 0 %): no s'ensenya com si fos gratuït
function fTer(n: number): string { return n > 0 ? `${fNum(n, 2)} %` : 'sense dada'; }

// Ajust tipogràfic: escala la mida segons la llargada del text perquè un import
// llarg (4.120.000 €) no quedi comprimit ni desbordi la seva targeta.
function fitFont(text: string, base: number, min = 8): number {
  const n = (text ?? '').length;
  if (n <= 9)  return base;
  if (n <= 11) return Math.max(min, base - 1.5);
  if (n <= 13) return Math.max(min, base - 3);
  if (n <= 16) return Math.max(min, base - 4.5);
  return Math.max(min, base - 6);
}

function projection(initial: number, monthly: number, rate: number, years: number): number {
  const r = rate / 100 / 12;
  const n = years * 12;
  const fi = initial * Math.pow(1 + r, n);
  const fm = r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n;
  return fi + fm;
}
function assetReturn(a: ManualAsset): number { return a.expectedReturn ?? a.historicalReturn5Y ?? RISK_RETURN[a.risk] ?? 5; }
function assetVol(a: ManualAsset): number    { return a.historicalVolatility ?? RISK_VOL[a.risk] ?? 8; }
function assetReturnSource(a: ManualAsset): '‡' | '†' | '*' { return a.expectedReturn != null && a.beta != null ? '‡' : a.historicalReturn5Y != null ? '†' : '*'; }

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

function makeLine(vals: number[], xs: number[], minV: number, maxV: number, y0: number, y1: number): string {
  const yr = y1 - y0;
  const vr = maxV - minV || 1;
  return vals.map((v, i) => {
    const y = (y0 + yr * (1 - (v - minV) / vr)).toFixed(1);
    return `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${y}`;
  }).join(' ');
}

// Matriu de correlació: verd seqüencial d'un sol to per a valors positius,
// maó apagat per a negatius. Sense escala multicolor.
function corrColor(r: number): string {
  if (r >= 0.8)  return '#1a3a2a';
  if (r >= 0.6)  return '#2d5a45';
  if (r >= 0.4)  return '#5b8a73';
  if (r >= 0.2)  return '#a9c5b5';
  if (r >= 0)    return '#eef2ee';
  if (r >= -0.2) return '#e7d9d7';
  return '#c19a95';
}
function corrText(r: number): string { return r >= 0.55 ? '#ffffff' : '#1c1c1c'; }
function corrBetween(a: ManualAsset, b: ManualAsset): number {
  if (a.isin === b.isin) return 1.0;
  // Mateixa classificació que compute() (lib/fundClassification.ts).
  const klass = (x: ManualAsset): 'rv' | 'rf' | 'x' => {
    const t = classifyFund(x.isin, x.category, x.name).assetType;
    return t === 'renda_variable' ? 'rv' : t === 'renda_fixa' || t === 'monetari' ? 'rf' : 'x';
  };
  const k1 = klass(a), k2 = klass(b);
  if (k1 === 'rv' && k2 === 'rv') return 0.72;
  if (k1 === 'rf' && k2 === 'rf') return 0.65;
  if ((k1 === 'rv' && k2 === 'rf') || (k1 === 'rf' && k2 === 'rv')) return -0.15;
  if (k1 === 'rv' || k2 === 'rv') return 0.08;
  if (k1 === 'rf' || k2 === 'rf') return 0.22;
  return 0.10;
}

// ─── DERIVED COMPUTE ──────────────────────────────────────────────────────────
function compute(d: ManualPortfolioInput) {
  const wr = d.assets.reduce((s, a) => s + (a.weight / 100) * assetReturn(a), 0);
  const wv = d.assets.reduce((s, a) => s + (a.weight / 100) * assetVol(a), 0);
  const wt = d.assets.reduce((s, a) => s + (a.weight / 100) * a.ter, 0);
  // Si falta el TER d'algun fons, el ponderat és massa baix: a l'informe surt "sense dada"
  const terKnown = d.assets.every(a => !(a.weight > 0) || a.ter > 0);
  const wR = d.assets.reduce((s, a) => s + (a.weight / 100) * a.risk, 0);
  const nr = Math.max(0, wr - wt);

  // ── Estructura de rendes ──────────────────────────────────────────────────
  const estIncome = Math.round(d.monthlyAmount / 0.095);
  const income    = d.monthlyIncome   ?? estIncome;
  const expenses  = d.monthlyExpenses ?? Math.round(income * 0.596);
  const isEst     = !d.monthlyIncome || !d.monthlyExpenses;

  const annualIncome   = income * 12;
  const annualExpenses = expenses * 12;
  const monthlySavings = income - expenses;                 // capacitat d'estalvi (abans d'invertir)
  const annualSavings  = monthlySavings * 12;
  const surplus        = income - expenses - d.monthlyAmount; // marge / excedent després d'invertir
  const annualInvest   = d.monthlyAmount * 12;

  const expenseRatioPct = income > 0 ? (expenses / income) * 100 : 0;
  const savingsRatePct  = income > 0 ? (monthlySavings / income) * 100 : 0;
  const investRatePct   = income > 0 ? (d.monthlyAmount / income) * 100 : 0;

  // ── Balanç patrimonial (camps opcionals) ─────────────────────────────────
  const hasPatrimoni = d.patrimoni != null && d.patrimoni > 0;
  const hasDeutes    = d.deutes != null && d.deutes > 0;
  const hasFons      = d.fondEmergencia != null && d.fondEmergencia > 0;
  const patrimoni    = d.patrimoni ?? 0;
  const deutes       = d.deutes ?? 0;
  const patrimoniNet = patrimoni - deutes;
  const debtRatioPct = hasPatrimoni ? (deutes / patrimoni) * 100 : null;
  const fonsEmergencia   = d.fondEmergencia ?? 0;
  const efundTarget      = expenses * 6;
  const efundMonthsCov   = hasFons && expenses > 0 ? fonsEmergencia / expenses : null;
  const capitalDisponible = d.initialAmount;
  const objectiuAmount    = d.objectiuAmount ?? 0;
  const invertibleWealthPct = hasPatrimoni ? (d.initialAmount / patrimoni) * 100 : null;
  const mesosAutonomia = expenses > 0 ? (hasFons ? fonsEmergencia : d.initialAmount) / expenses : 0;

  // ── Projecció ────────────────────────────────────────────────────────────
  const totalInvested = d.initialAmount + d.monthlyAmount * d.horizon * 12;
  const r10 = Math.max(0.5, nr - wv * 0.35);
  const r90 = nr + wv * 0.35;
  const p10 = projection(d.initialAmount, d.monthlyAmount, r10, d.horizon);
  const p50 = projection(d.initialAmount, d.monthlyAmount, nr,  d.horizon);
  const p90 = projection(d.initialAmount, d.monthlyAmount, r90, d.horizon);
  const wealthMult = p50 / Math.max(1, totalInvested);

  const rf      = 3.5;
  const sharpe  = wv > 0 ? parseFloat(((nr - rf) / wv).toFixed(2)) : 0;
  const var95   = parseFloat((-1.645 * wv).toFixed(1));
  const maxDD   = parseFloat((-0.7 * wv).toFixed(1));
  const benchR  = capmReturn(BENCHMARK_EQUITY[d.investorProfile] ?? 0.4);
  const alpha   = parseFloat((nr - benchR).toFixed(2));
  // Base real del rendiment: CAPM només si tots els actius amb pes tenen beta.
  const marks     = d.assets.filter(a => a.weight > 0).map(assetReturnSource);
  const capmCount = marks.filter(m => m === '‡').length;
  const basisLabel = capmCount === 0 ? 'històric / estimació per SRRI' : capmCount === marks.length ? 'CAPM' : 'CAPM i històric, segons l\'actiu';

  // Repartiment per classe d'actiu i estil de gestió (lib/fundClassification.ts).
  // El monetari compta dins la renda fixa; els mixtos es reparteixen pel seu % d'accions.
  const alloc = allocationBreakdown(d.assets);
  const rvPct = alloc.equity, rfPct = alloc.fixedIncome, cashPct = alloc.other + alloc.unknownAsset;


  const goalRef = objectiuAmount > 0 ? objectiuAmount : p50;

  return {
    wr, wv, wt, wR, nr, terKnown,
    income, expenses, surplus, isEst,
    annualIncome, annualExpenses, monthlySavings, annualSavings, annualInvest,
    expenseRatioPct, savingsRatePct, investRatePct,
    hasPatrimoni, hasDeutes, hasFons, patrimoni, deutes, patrimoniNet, debtRatioPct,
    fonsEmergencia, efundTarget, efundMonthsCov, capitalDisponible,
    objectiuAmount, goalRef, invertibleWealthPct, mesosAutonomia,
    totalInvested, r10, r90, p10, p50, p90, wealthMult,
    sharpe, var95, maxDD, benchR, alpha, basisLabel, allCapm: marks.length > 0 && capmCount === marks.length,
    rvPct, rfPct, cashPct, alloc,
  };
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function SectionTitle({ tag, title, intro }: { tag: string; title: string; intro?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={S.tag}>{tag}</Text>
      <Text style={S.h2}>{title}</Text>
      <View style={S.goldRule} />
      {intro ? <Text style={[S.body2, { marginTop: 9, maxWidth: 440 }]}>{intro}</Text> : null}
    </View>
  );
}

function Header({ section, client }: { section: string; client: string }) {
  return (
    <View style={S.header} fixed>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, letterSpacing: 2 }}>FACTOR</Text>
        <Text style={{ fontSize: 9, color: C.gold, letterSpacing: 2 }}> OTC</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 7, color: C.muted, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8 }}>{client}</Text>
        <Text style={{ fontSize: 7, color: C.line }}>|</Text>
        <Text style={{ fontSize: 7, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>{section}</Text>
      </View>
    </View>
  );
}

function Footer({ label }: { label?: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={{ fontSize: 6.5, color: C.mutedLt, letterSpacing: 0.3 }}>{label ?? 'Factor OTC · Informe de Cartera Personalitzada · Confidencial'}</Text>
      <Text style={{ fontSize: 6.5, color: C.mutedLt }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function MetricBox({ label, value, sub, accent, tone }: {
  label: string; value: string; sub?: string;
  accent?: boolean; tone?: 'pos' | 'neg' | 'neutral';
}) {
  const topColor = accent ? C.gold : tone === 'pos' ? C.pos : tone === 'neg' ? C.neg : C.line;
  const valColor = tone === 'pos' ? C.pos : tone === 'neg' ? C.neg : C.ink;
  return (
    <View style={[S.metricBox, { borderTopWidth: accent || tone ? 2 : 0.5, borderTopColor: topColor }]}>
      <Text style={S.metricLabel}>{label}</Text>
      <Text style={[S.metricValue, { fontSize: fitFont(value, 13), color: valColor }]}>{value}</Text>
      {sub ? <Text style={S.metricSub}>{sub}</Text> : null}
    </View>
  );
}

// Targeta d'estadística autònoma. A diferència de MetricBox —pensat per a files
// amb flex:1 i alçada definida pel contenidor—, StatCard fixa la seva pròpia
// amplada i deixa que l'alçada la determini el contingut. Així es pot col·locar
// dins d'una graella amb ajust de línia (flexWrap) sense que etiqueta, xifra i
// nota se solapin. Estètica idèntica a MetricBox, amb una mica més d'aire.
function StatCard({ label, value, sub, accent, tone, width }: {
  label: string; value: string; sub?: string;
  accent?: boolean; tone?: 'pos' | 'neg' | 'neutral'; width: string | number;
}) {
  const topColor = accent ? C.gold : tone === 'pos' ? C.pos : tone === 'neg' ? C.neg : C.line;
  const valColor = tone === 'pos' ? C.pos : tone === 'neg' ? C.neg : C.ink;
  return (
    <View style={{
      width,
      borderWidth: 0.5, borderColor: C.line,
      borderTopWidth: accent || tone ? 2 : 0.5, borderTopColor: topColor,
      backgroundColor: C.white,
      paddingVertical: 13, paddingHorizontal: 12,
    }}>
      <Text style={S.metricLabel}>{label}</Text>
      <Text style={[S.metricValue, { fontSize: fitFont(value, 14), color: valColor, marginTop: 4 }]}>{value}</Text>
      {sub ? <Text style={[S.metricSub, { marginTop: 6 }]}>{sub}</Text> : null}
    </View>
  );
}

// Fila etiqueta → valor. Gestiona amb elegància les dades no facilitades.
function DataRow({ label, value, missing, strong }: {
  label: string; value?: string; missing?: boolean; strong?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.lineSoft }}>
      <Text style={{ fontSize: 8, color: C.muted }}>{label}</Text>
      {missing
        ? <Text style={{ fontSize: 7.5, color: C.mutedLt, fontFamily: 'Helvetica-Oblique' }}>No facilitat</Text>
        : <Text style={{ fontSize: fitFont(value ?? '', 9.5), color: C.ink, fontFamily: strong ? 'Helvetica-Bold' : 'Helvetica' }}>{value}</Text>}
    </View>
  );
}

// ─── PAGE 1: COVER ────────────────────────────────────────────────────────────
function CoverPage({ d, generatedAt }: { d: ManualPortfolioInput; generatedAt: string }) {
  const c = compute(d);
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;
  const riskLabel    = RISK_LABEL[Math.round(c.wR)] ?? 'Moderat';

  const primary = [
    { label: 'Capital inicial', value: fEur(d.initialAmount) },
    { label: 'Aportació mensual', value: fEur(d.monthlyAmount) },
    { label: 'Horitzó', value: `${d.horizon} anys` },
    { label: 'Projecció base', value: fEur(c.p50) },
  ];
  const secondary = [
    { label: 'Perfil inversor', value: profileLabel },
    { label: 'Rendiment net est.', value: `${fPct(c.nr)} / any` },
    { label: 'Volatilitat est.', value: `${fPct(c.wv)} / any` },
    { label: 'Risc SRRI', value: riskLabel },
  ];

  return (
    <Page size="A4" style={S.coverPage}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: C.gold }} />

      <View style={{ flex: 1, paddingHorizontal: 58, paddingTop: 62, paddingBottom: 46 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 64 }}>
          <Text style={{ fontSize: 17, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 3 }}>FACTOR</Text>
          <Text style={{ fontSize: 17, color: C.gold, letterSpacing: 4, marginLeft: 6 }}>OTC</Text>
        </View>

        <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 3, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 18 }}>
          Informe de Cartera Personalitzada
        </Text>
        <Text style={{ fontSize: 34, fontFamily: 'Helvetica-Bold', color: C.white, lineHeight: 1.15, marginBottom: 10, letterSpacing: -0.5 }}>{d.clientName}</Text>
        {/* Sense subtítol (perfil · objectiu): el perfil ja surt a sota, a «Perfil inversor». */}
        <View style={{ marginBottom: 46 }} />

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
          {primary.map(s => (
            <View key={s.label} style={{ flex: 1 }}>
              <Text style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 }}>{s.label}</Text>
              <Text style={{ fontSize: fitFont(s.value, 14), fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: -0.3 }}>{s.value}</Text>
              <View style={{ height: 2, width: 16, backgroundColor: C.gold, marginTop: 7 }} />
            </View>
          ))}
        </View>

        <View style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 30 }} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {secondary.map(s => (
            <View key={s.label} style={{ flex: 1 }}>
              <Text style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 5 }}>{s.label}</Text>
              <Text style={{ fontSize: fitFont(s.value, 11), color: C.gold, fontFamily: 'Helvetica-Bold' }}>{s.value}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{d.clientEmail}</Text>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Generat el {generatedAt} · Confidencial</Text>
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 2: RESUM EXECUTIU ───────────────────────────────────────────────────
function ExecutivePage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);

  const pillars = [
    { label: 'VIURE', sub: 'Necessitats corrents', value: `${fEur(c.expenses)} / mes`,
      desc: `Despeses habituals cobertes per uns ingressos nets de ${fEur(c.income)} / mes.` },
    { label: 'PROTEGIR', sub: "Fons d'emergència", value: fEur(c.efundTarget),
      desc: `Coixí objectiu equivalent a 6 mesos de despeses. Marge mensual disponible: ${fEur(c.surplus)}.` },
    { label: 'CRÉIXER', sub: 'Inversió sistemàtica', value: `${fEur(d.monthlyAmount)} / mes`,
      desc: `Aportació recurrent durant ${d.horizon} anys. Capital total aportat: ${fEur(c.totalInvested)}.` },
  ];

  const cash = [
    { label: '(+) Ingressos nets mensuals', value: fEur(c.income), tone: 'pos' as Tone, bold: true },
    { label: '(-) Despeses habituals', value: fEur(-c.expenses), tone: 'neutral' as Tone, bold: false },
    { label: '(-) Aportació a inversió', value: fEur(-d.monthlyAmount), tone: 'neutral' as Tone, bold: false },
    { label: '(=) Excedent disponible', value: fEur(Math.abs(c.surplus)), tone: (c.surplus >= 0 ? 'pos' : 'neg') as Tone, bold: true },
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="Resum Executiu" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Resum Executiu"
          title="Visió global del pla financer"
          intro={`Síntesi dels elements clau del pla d'inversió personalitzat per a ${d.clientName}: capacitat d'estalvi, protecció de liquiditat i estratègia de creixement.`}
        />

        {c.isEst ? (
          <View style={{ borderWidth: 0.5, borderColor: C.line, padding: 13, marginBottom: 16 }}>
            <Text style={S.body2}>El client encara no ha facilitat els ingressos i les despeses mensuals. La part de pressupost i fons d&apos;emergència s&apos;afegirà quan els tinguem: no s&apos;estimen.</Text>
          </View>
        ) : (<>
        <Text style={S.subTag}>Els tres pilars del pla</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {pillars.map(f => (
            <View key={f.label} style={{ flex: 1, borderTopWidth: 2, borderTopColor: C.gold, borderWidth: 0.5, borderColor: C.line, padding: 13 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, letterSpacing: 1.8, marginBottom: 2 }}>{f.label}</Text>
              <Text style={{ fontSize: 6.5, color: C.mutedLt, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>{f.sub}</Text>
              <Text style={{ fontSize: fitFont(f.value, 14), fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 7, letterSpacing: -0.3 }}>{f.value}</Text>
              <Text style={{ fontSize: 7.5, color: C.muted, lineHeight: 1.55 }}>{f.desc}</Text>
            </View>
          ))}
        </View>

        <Text style={S.subTag}>Flux de caixa mensual</Text>
        <View style={{ borderWidth: 0.5, borderColor: C.line, padding: 13, marginBottom: 16 }}>
          {cash.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: i < 3 ? 0.5 : 0, borderBottomColor: C.lineSoft }}>
              <Text style={{ fontSize: 8.5, color: C.ink, fontFamily: r.bold ? 'Helvetica-Bold' : 'Helvetica' }}>{r.label}</Text>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: r.tone === 'pos' ? C.pos : r.tone === 'neg' ? C.neg : C.ink }}>{r.value}</Text>
            </View>
          ))}
        </View>
        </>)}

        <View style={S.divider} />

        <Text style={S.subTag}>Projecció a {d.horizon} anys — escenaris de rendiment</Text>
        <View style={S.row}>
          {[
            { label: 'Desfavorable', value: fEur(c.p10), rate: fPct(c.r10), gain: fEur(c.p10 - c.totalInvested), tone: 'neg' as Tone },
            { label: 'Base', value: fEur(c.p50), rate: fPct(c.nr), gain: fEur(c.p50 - c.totalInvested), tone: 'neutral' as Tone, accent: true },
            { label: 'Favorable', value: fEur(c.p90), rate: fPct(c.r90), gain: fEur(c.p90 - c.totalInvested), tone: 'pos' as Tone },
          ].map(sc => (
            <View key={sc.label} style={[S.metricBox, { borderTopWidth: 2, borderTopColor: sc.accent ? C.gold : sc.tone === 'pos' ? C.pos : sc.tone === 'neg' ? C.neg : C.line }]}>
              <Text style={S.metricLabel}>{sc.label}</Text>
              <Text style={[S.metricValue, { fontSize: fitFont(sc.value, 15) }]}>{sc.value}</Text>
              <Text style={S.metricSub}>Rendiment {sc.rate} anual</Text>
              <Text style={S.metricSub}>Guany estimat {sc.gain}</Text>
            </View>
          ))}
        </View>
        <Text style={[S.body2, { marginTop: 4 }]}>Capital aportat total: {fEur(c.totalInvested)}   ·   Capital inicial: {fEur(d.initialAmount)}</Text>
      </View>
    </Page>
  );
}

// ─── PAGE 3: PERFIL FINANCER ──────────────────────────────────────────────────
function FinancialProfilePage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);

  // Distribució de cada 100 € d'ingrés
  const expPct = Math.max(0, Math.min(100, Math.round(c.expenseRatioPct)));
  const invPct = Math.max(0, Math.min(100 - expPct, Math.round(c.investRatePct)));
  const surpPct = Math.max(0, 100 - expPct - invPct);
  const barH = 168;

  const flow = [
    { label: 'INGRESSOS', value: fEur(c.annualIncome), pct: '100 %', sub: 'nets anuals' },
    { label: 'DESPESES', value: fEur(-c.annualExpenses), pct: fPct(c.expenseRatioPct), sub: 'dels ingressos' },
    { label: 'ESTALVI', value: fEur(c.annualSavings), pct: fPct(c.savingsRatePct), sub: "capacitat d'estalvi" },
    { label: 'CAPITAL INVERTIBLE', value: fEur(c.annualInvest), pct: fPct(c.investRatePct), sub: "destinat a inversió" },
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="Perfil Financer" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Perfil Financer"
          title="Situació financera actual"
          intro={`Fotografia de la situació economicofinancera de ${d.clientName} abans de definir l'estratègia d'inversió. Recull l'estructura de rendes, la capacitat d'estalvi i el balanç patrimonial declarat.`}
        />

        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 12 }}>
          {/* Estructura de rendes */}
          <View style={{ flex: 1.25 }}>
            <Text style={S.subTag}>Estructura de rendes</Text>
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 3, marginBottom: 1 }}>
              <Text style={[S.th, { flex: 2 }]}></Text>
              <Text style={[S.th, { flex: 1, textAlign: 'right' }]}>Mensual</Text>
              <Text style={[S.th, { flex: 1, textAlign: 'right' }]}>Anual</Text>
            </View>
            {[
              { k: 'Ingressos nets', m: fEur(c.income), y: fEur(c.annualIncome), tone: C.pos },
              { k: 'Despeses habituals', m: fEur(-c.expenses), y: fEur(-c.annualExpenses), tone: C.ink },
              { k: "Capacitat d'estalvi", m: fEur(c.monthlySavings), y: fEur(c.annualSavings), tone: C.ink, strong: true },
              { k: 'Aportació a inversió', m: fEur(d.monthlyAmount), y: fEur(c.annualInvest), tone: C.gold },
              { k: 'Excedent / marge', m: fEur(c.surplus), y: fEur(c.surplus * 12), tone: c.surplus >= 0 ? C.pos : C.neg, strong: true },
            ].map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 4.5, borderBottomWidth: 0.5, borderBottomColor: C.lineSoft, alignItems: 'baseline' }}>
                <Text style={{ flex: 2, fontSize: 8, color: C.muted }}>{r.k}</Text>
                <Text style={{ flex: 1, fontSize: fitFont(r.m, 8.5), textAlign: 'right', color: r.tone, fontFamily: r.strong ? 'Helvetica-Bold' : 'Helvetica' }}>{r.m}</Text>
                <Text style={{ flex: 1, fontSize: fitFont(r.y, 8.5), textAlign: 'right', color: r.tone, fontFamily: r.strong ? 'Helvetica-Bold' : 'Helvetica' }}>{r.y}</Text>
              </View>
            ))}
            {c.isEst && <Text style={[S.body2, S.italic, { marginTop: 6, fontSize: 7 }]}>Ingressos i/o despeses estimats a partir de l&apos;aportació mensual declarada.</Text>}
          </View>

          {/* Distribució de cada 100 € */}
          <View style={{ width: 150 }}>
            <Text style={S.subTag}>Cada 100 € d&apos;ingrés</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 34, height: barH, borderWidth: 0.5, borderColor: C.line }}>
                <View style={{ height: `${surpPct}%`, backgroundColor: C.gold }} />
                <View style={{ height: `${invPct}%`, backgroundColor: C.greenMid }} />
                <View style={{ height: `${expPct}%`, backgroundColor: '#3a3a3a' }} />
              </View>
              <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 2 }}>
                {[
                  { c: '#3a3a3a', k: 'Despeses', v: fPct(c.expenseRatioPct) },
                  { c: C.greenMid, k: 'Inversió', v: fPct(c.investRatePct) },
                  { c: C.gold, k: 'Excedent', v: fPct(Math.max(0, 100 - c.expenseRatioPct - c.investRatePct)) },
                ].map(l => (
                  <View key={l.k}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 7, height: 7, backgroundColor: l.c }} />
                      <Text style={{ fontSize: 7, color: C.muted }}>{l.k}</Text>
                    </View>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, marginLeft: 11 }}>{l.v}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={S.divider} />

        {/* Flux: ingrés → capital invertible */}
        <Text style={S.subTag}>De l&apos;ingrés al capital invertible (base anual)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 6, marginBottom: 4 }}>
          {flow.map((f, i) => (
            <View key={f.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, borderWidth: 0.5, borderColor: C.line, borderTopWidth: 2, borderTopColor: i === 3 ? C.gold : C.line, padding: 9, minHeight: 74 }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.muted, letterSpacing: 0.8, marginBottom: 5 }}>{f.label}</Text>
                <Text style={{ fontSize: fitFont(f.value, 11), fontFamily: 'Helvetica-Bold', color: i === 3 ? C.gold : C.ink, letterSpacing: -0.3 }}>{f.value}</Text>
                <Text style={{ fontSize: 6.5, color: C.mutedLt, marginTop: 4 }}>{f.pct} · {f.sub}</Text>
              </View>
              {i < flow.length - 1 && (
                <Text style={{ fontSize: 11, color: C.mutedLt, marginHorizontal: 2 }}>›</Text>
              )}
            </View>
          ))}
        </View>

        <View style={S.divider} />

        {/* Balanç patrimonial */}
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <View style={{ flex: 1 }}>
            <Text style={S.subTag}>Balanç patrimonial</Text>
            <DataRow label="Patrimoni brut / actius" value={fEur(c.patrimoni)} missing={!c.hasPatrimoni} />
            <DataRow label="Deutes / passius" value={fEur(-c.deutes)} missing={!c.hasDeutes} />
            <DataRow label="Patrimoni net" value={fEur(c.patrimoniNet)} missing={!c.hasPatrimoni} strong />
            <DataRow label="Liquiditat / capital per invertir" value={fEur(c.capitalDisponible)} strong />
            <DataRow
              label="Fons d'emergència"
              value={c.hasFons ? `${fEur(c.fonsEmergencia)} · ${fNum(c.efundMonthsCov ?? 0, 0)} mesos` : undefined}
              missing={!c.hasFons}
            />
            {!c.hasFons && <Text style={[S.body2, { fontSize: 7, marginTop: 3 }]}>Objectiu recomanat: {fEur(c.efundTarget)} (6 mesos de despeses).</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.subTag}>Objectiu i horitzó</Text>
            <DataRow label="Objectiu financer" value={d.objective} strong />
            <DataRow label="Horitzó temporal" value={`${d.horizon} anys`} />
            <DataRow label="Capital objectiu declarat" value={fEur(c.objectiuAmount)} missing={c.objectiuAmount <= 0} />
            <DataRow label="Projecció base a l'horitzó" value={fEur(c.p50)} strong />
            <DataRow
              label="Proporció de patrimoni invertible"
              value={c.invertibleWealthPct != null ? fPct(c.invertibleWealthPct) : undefined}
              missing={c.invertibleWealthPct == null}
            />
            <DataRow label="Autonomia amb la liquiditat actual" value={`${fNum(c.mesosAutonomia, 0)} mesos de despeses`} />
          </View>
        </View>
        {/* Objectius que el client va escriure (Excel o formulari): són la foto inicial del pla */}
        {d.goals && d.goals.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={S.subTag}>Els teus objectius</Text>
            {d.goals.map((g, i) => (
              <DataRow key={i}
                label={`${GOAL_HORIZON[g.horizon ?? ''] ?? 'Sense termini'} · ${g.description}`}
                value={[g.amount ? fEur(g.amount) : null, g.targetYear ? String(g.targetYear) : null].filter(Boolean).join(' · ') || 'Sense import'} />
            ))}
          </View>
        )}
      </View>
    </Page>
  );
}

// ─── PAGE 4: DIAGNÒSTIC FINANCER ──────────────────────────────────────────────
function DiagnosticsPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);

  const savingsVerdict = c.savingsRatePct >= 20 ? 'sòlida' : c.savingsRatePct >= 10 ? 'adequada' : 'millorable';
  const effortVerdict  = c.expenseRatioPct <= 50 ? 'lleugera' : c.expenseRatioPct <= 65 ? 'moderada' : 'exigent';
  const debtVerdict    = c.debtRatioPct == null ? null : c.debtRatioPct <= 30 ? 'baix' : c.debtRatioPct <= 50 ? 'moderat' : 'elevat';
  const liqVerdict     = c.mesosAutonomia >= 6 ? 'sòlida' : c.mesosAutonomia >= 3 ? 'ajustada' : 'feble';

  const kpis = [
    { label: "Taxa d'estalvi", value: fPct(c.savingsRatePct), sub: 'estalvi / ingressos',
      tone: (c.savingsRatePct >= 15 ? 'pos' : 'neg') as Tone },
    { label: "Ràtio d'esforç", value: fPct(c.expenseRatioPct), sub: 'despeses / ingressos',
      tone: (c.expenseRatioPct <= 65 ? 'pos' : 'neg') as Tone },
    { label: 'Endeutament', value: c.debtRatioPct != null ? fPct(c.debtRatioPct) : 'n/d', sub: 'deutes / patrimoni',
      tone: (c.debtRatioPct == null ? 'neutral' : c.debtRatioPct <= 40 ? 'pos' : 'neg') as Tone },
    { label: 'Autonomia', value: `${fNum(c.mesosAutonomia, 0)} mesos`, sub: 'coberts sense ingressos',
      tone: (c.mesosAutonomia >= 6 ? 'pos' : 'neutral') as Tone },
    { label: "Marge d'inversió", value: `${fEur(c.surplus)} / mes`, sub: "després d'invertir",
      tone: (c.surplus >= 0 ? 'pos' : 'neg') as Tone },
    { label: 'Rendiment net', value: fPct(c.nr), sub: c.terKnown ? 'anual, net de costos' : 'sense descomptar el TER d\'algun fons', accent: true },
    { label: 'Multiplicador', value: `× ${fNum(c.wealthMult, 1)}`, sub: 'projecció base / capital aportat', tone: 'neutral' as Tone },
    { label: 'Dif. vs. bench.', value: fPct(c.alpha, true), sub: `esperat vs. ${BENCHMARK_NAME[d.investorProfile] ?? 'benchmark'}`,
      tone: (c.alpha >= 0 ? 'pos' : 'neg') as Tone },
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="Diagnòstic Financer" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Diagnòstic Financer"
          title="Què signifiquen aquestes dades"
          intro="Lectura dels indicadors de salut financera del client i la seva implicació per a la viabilitat del pla d'inversió."
        />
        {c.isEst && <Text style={[S.body2, S.italic, { marginBottom: 8, marginTop: -4 }]}>Indicadors calculats amb ingressos i despeses estimats.</Text>}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          {kpis.map(k => (
            <StatCard key={k.label} width="31.6%" label={k.label} value={k.value} sub={k.sub} accent={k.accent} tone={k.tone} />
          ))}
        </View>

        <View style={[S.divider, { marginVertical: 10 }]} />

        <Text style={S.subTag}>Interpretació</Text>
        <View style={{ marginBottom: 6 }}>
          <Text style={S.body1}>
            El client destina el <Text style={S.bold}>{fPct(c.expenseRatioPct)}</Text> dels ingressos a despeses habituals —una càrrega <Text style={S.bold}>{effortVerdict}</Text>— i reté una capacitat d&apos;estalvi del <Text style={S.bold}>{fPct(c.savingsRatePct)}</Text> (<Text style={S.bold}>{savingsVerdict}</Text>), de la qual {fEur(d.monthlyAmount)} mensuals ({fPct(c.investRatePct)} dels ingressos) es canalitzen a la inversió sistemàtica.
          </Text>
          <Text style={S.body1}>
            La liquiditat cobreix <Text style={S.bold}>{fNum(c.mesosAutonomia, 0)} mesos</Text> de despeses sense ingressos (posició <Text style={S.bold}>{liqVerdict}</Text>{c.mesosAutonomia < 6 ? `; convé reforçar el coixí fins als ${fEur(c.efundTarget)}` : ''}).
            {debtVerdict
              ? ` L'endeutament sobre patrimoni és del ${fPct(c.debtRatioPct as number)} (${debtVerdict}), amb un patrimoni net de ${fEur(c.patrimoniNet)}. `
              : ' No s\'han facilitat dades de patrimoni ni deutes: el diagnòstic patrimonial queda pendent. '}
            {c.surplus >= 0
              ? `Amb un marge mensual positiu de ${fEur(c.surplus)}, el pla és sostenible i la projecció base assoleix ${fEur(c.p50)} en ${d.horizon} anys (× ${fNum(c.wealthMult, 1)} sobre el capital aportat).`
              : `El marge mensual és negatiu (${fEur(Math.abs(c.surplus))}/mes de dèficit): cal revisar despeses o aportació abans de consolidar el pla.`}
          </Text>
        </View>

        <View style={[S.divider, { marginVertical: 10 }]} />

        <Text style={S.subTag}>Recomanacions operatives</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {[
            [
              ["Fons d'emergència", `Mantenir ${fEur(c.efundTarget)} en compte remunerat o fons monetari (6 mesos de despeses).`],
              ['Coixí de liquiditat', 'No invertir el 100% del patrimoni; conservar un 10–15% accessible en tot moment.'],
              ['Automatització', 'Configurar l\'aportació mensual automàtica per neutralitzar biaixos de comportament (DCA).'],
            ],
            [
              ['Rebalanceig anual', 'Revisar la cartera un cop l\'any o si un actiu desvia més de 10 punts del pes objectiu.'],
              ['Revisió del perfil', 'Actualitzar el qüestionari MiFID II davant de canvis en la situació financera o els objectius.'],
              ['Fiscalitat', 'Planificar el moment de materialitzar guanys i pèrdues per compensar en la declaració.'],
            ],
          ].map((col, ci) => (
            <View key={ci} style={{ flex: 1 }}>
              {col.map(([title, desc], i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 7 }}>
                  <View style={{ width: 13, height: 13, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Text style={{ fontSize: 7, color: C.green, fontFamily: 'Helvetica-Bold' }}>{ci * 3 + i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.body1, S.bold, { marginBottom: 1 }]}>{title}</Text>
                    <Text style={S.body2}>{desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={S.cardGold} wrap={false}>
          <Text style={[S.body1, S.bold, { color: C.green, marginBottom: 3 }]}>
            Diagnòstic: {c.surplus >= 0 ? 'situació financera sanejada' : 'dèficit mensual detectat'}
          </Text>
          <Text style={S.body2}>
            {c.surplus >= 0
              ? `Amb un excedent de ${fEur(c.surplus)}/mes i una taxa d'estalvi del ${fPct(c.savingsRatePct)}, el pla d'inversió és viable en el marc de l'horitzó i el perfil declarats.`
              : `El dèficit de ${fEur(Math.abs(c.surplus))}/mes compromet la sostenibilitat del pla i requereix ajustar despeses o aportació.`}
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 5: PERFIL D'INVERSOR (MiFID II) ─────────────────────────────────────
function InvestorProfilePage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;
  return (
    <Page size="A4" style={S.page}>
      <Header section="Perfil d'Inversor" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Perfil d'Inversor"
          title="Perfil de risc"
          intro="Perfil assignat per l'assessor a partir de la conversa amb el client i de les dades que ha facilitat."
        />

        {/* No s'hi mostra cap puntuació: abans hi sortien valors fixos per perfil
            (p. ex. 76/97) que no venien de cap qüestionari real. */}
        <View style={{ borderWidth: 0.5, borderColor: C.line, padding: 13, marginBottom: 14 }}>
          <Text style={[S.body1, S.bold, { marginBottom: 4 }]}>Perfil {profileLabel}</Text>
          <Text style={S.body2}>Horitzó d&apos;inversió: {d.horizon} anys. Objectiu: {d.objective || 'no indicat'}.</Text>
        </View>

        {d.adminNote ? (
          // Text lliure de l'assessor (fins a 5.000 caràcters): ha de poder continuar a la pàgina següent
          <View style={S.legalBox}>
            <Text style={[S.legalText, S.bold, { marginBottom: 3 }]} minPresenceAhead={20}>Nota de l&apos;assessor</Text>
            <Text style={S.legalText}>{d.adminNote}</Text>
          </View>
        ) : null}

        <View style={S.divider} />

        <Text style={S.subTag}>Paràmetres de risc de la cartera</Text>
        <View style={S.row}>
          <MetricBox label="Rendiment net estimat" value={fPct(c.nr)} sub={c.terKnown ? 'anual, net de TER' : 'sense descomptar el TER d\'algun fons'} accent />
          <MetricBox label="Volatilitat estimada" value={fPct(c.wv)} sub="anual, desviació estàndard" />
          <MetricBox label="TER mitjà ponderat" value={fTer(c.terKnown ? c.wt : 0)} sub="cost anual total" />
          <MetricBox label="Risc SRRI ponderat" value={RISK_LABEL[Math.round(c.wR)] ?? 'Moderat'} sub={`${fNum(c.wR, 1)} / 7`} />
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 6: COMPOSICIÓ DE CARTERA ────────────────────────────────────────────
function PortfolioPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);

  const al = c.alloc;
  const catColors: Record<string, string> = { rv: C.gold, rf: C.greenMid, cash: '#8a8577', alt: '#4f6b5c', nc: C.mutedLt };
  const catMap: Record<string, { pct: number; color: string }> = {
    rv:   { pct: al.equity, color: catColors.rv },
    rf:   { pct: al.fixedIncome - al.moneyMarket, color: catColors.rf },
    cash: { pct: al.moneyMarket, color: catColors.cash },
    alt:  { pct: al.other, color: catColors.alt },
    nc:   { pct: al.unknownAsset, color: catColors.nc },
  };
  const segs = Object.entries(catMap).filter(([, v]) => v.pct > 0.05);
  const styleSegs = [
    { key: 'activa',  label: 'Gestió activa',     pct: al.active,       color: C.greenMid },
    { key: 'passiva', label: 'Gestió passiva',    pct: al.passive,      color: C.gold },
    { key: 'nc',      label: 'Sense classificar', pct: al.unknownStyle, color: C.mutedLt },
  ].filter(x => x.pct > 0.05);

  const cx = 95, cy = 95, R = 80, ri = 54;
  let cumPct = 0;
  const arcs: { path: string; color: string; pct: number; key: string }[] = [];
  for (const [key, { pct, color }] of segs) {
    const start = cumPct * 360;
    const end   = (cumPct + pct / 100) * 360;
    arcs.push({ path: donutArc(cx, cy, R, ri, start, end), color, pct, key });
    cumPct += pct / 100;
  }

  const catLabels: Record<string, string> = { rv: 'Renda variable', rf: 'Renda fixa', cash: 'Monetari (dins la renda fixa)', alt: 'Altres (or, matèries primeres)', nc: 'Sense classificar' };

  return (
    <Page size="A4" style={S.page}>
      <Header section="Composició de Cartera" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Composició de Cartera"
          title="Assignació estratègica d'actius"
          intro="Distribució de la cartera proposada per classe d'actiu, per estil de gestió i per instrument individual."
        />

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <StatCard width="23.5%" label="Renda variable" value={fW(al.equity)} sub="accions" accent />
          <StatCard width="23.5%" label="Renda fixa" value={fW(al.fixedIncome)} sub={al.moneyMarket > 0.05 ? `inclou ${fW(al.moneyMarket)} monetari` : 'bons i deute'} />
          <StatCard width="23.5%" label="Gestió passiva" value={fW(al.passive)} sub="fons indexats i ETF" accent />
          <StatCard width="23.5%" label="Gestió activa" value={fW(al.active)} sub="el gestor tria els valors" />
        </View>

        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 14 }}>
          <View style={{ width: 195, alignItems: 'center' }}>
            <Svg viewBox="0 0 190 190" style={{ width: 190, height: 190 }}>
              <Circle cx={cx} cy={cy} r={(R + ri) / 2} stroke={C.lineSoft} strokeWidth={R - ri} fill="none" />
              {arcs.map(a => (<Path key={a.key} d={a.path} fill={a.color} />))}
              <Circle cx={cx} cy={cy} r={ri - 1} fill={C.white} />
            </Svg>
            <View style={{ alignSelf: 'stretch', marginTop: 4 }}>
              {segs.map(([key, { pct, color }]) => (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <View style={{ width: 8, height: 8, backgroundColor: color, flexShrink: 0 }} />
                  <Text style={[S.body2, { marginLeft: 6, flex: 1 }]}>{catLabels[key] ?? key}</Text>
                  <Text style={[S.body2, S.bold, { color: C.ink }]}>{fW(pct)}</Text>
                </View>
              ))}
              <View style={{ borderTopWidth: 0.5, borderTopColor: C.line, marginTop: 2, paddingTop: 5 }}>
                {styleSegs.map(x => (
                  <View key={x.key} style={{ flexDirection: 'row', marginBottom: 3 }}>
                    <Text style={[S.body2, { flex: 1 }]}>{x.label}</Text>
                    <Text style={[S.body2, S.bold, { color: C.ink }]}>{fW(x.pct)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={{ fontSize: 6.5, color: C.mutedLt, marginTop: 10, lineHeight: 1.5 }}>{allocationNote(al)}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={S.subTag}>Distribució per actiu</Text>
            {d.assets.map((a, i) => (
              <View key={a.isin} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ width: 7, height: 7, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length], flexShrink: 0 }} />
                <Text style={[S.body2, { marginLeft: 5, flex: 1 }]}>{a.name.length > 26 ? a.name.slice(0, 26) + '…' : a.name}</Text>
                <View style={{ width: 70, height: 3.5, backgroundColor: C.lineSoft, marginRight: 6 }}>
                  <View style={{ width: `${a.weight}%`, height: 3.5, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                </View>
                <Text style={[S.body1, S.bold, { width: 34, textAlign: 'right' }]}>{fW(a.weight)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={S.divider} />

        <Text style={S.subTag}>Mètriques de la cartera</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: 'Rendiment brut', value: fPct(c.wr), sub: 'anual ponderat' },
            { label: 'TER mitjà', value: fTer(c.terKnown ? c.wt : 0), sub: 'cost anual ponderat' },
            { label: 'Rendiment net', value: fPct(c.nr), sub: c.terKnown ? 'brut - TER' : 'sense descomptar el TER d\'algun fons', accent: true },
            { label: 'Sharpe Ratio', value: fNum(c.sharpe, 2), sub: '(r - rf) / volatilitat' },
            { label: 'VaR 95% (1A)', value: fPct(c.var95), sub: 'pèrdua màx. estimada', tone: 'neg' as Tone },
          ].map(m => (
            <StatCard key={m.label} width="31.6%" label={m.label} value={m.value} sub={m.sub} accent={m.accent} tone={m.tone} />
          ))}
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 7: DETALL D'ACTIUS ──────────────────────────────────────────────────
function AssetsPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  // Amb molts fons, files i tesis més juntes perquè tot càpiga en una pàgina
  const compact = d.assets.length > 6;
  return (
    <Page size="A4" style={S.page}>
      <Header section="Detall d'Actius" client={d.clientName} />
      {/* Amb molts fons les tesis continuen a la pàgina següent: espai sota la capçalera */}
      <View fixed style={{ height: 14 }} />
      <Footer />
      <View style={[S.body, { paddingTop: 6 }]}>
        <SectionTitle
          tag="Composició Detallada"
          title="Fitxa de cada instrument"
          intro="Paràmetres clau i tesi d'inversió de cada instrument que compon la cartera."
        />

        {/* Cada cel·la va dins d'un <View> propi amb el seu flex: així react-pdf
            reserva l'amplada de columna abans de compondre el text i cap parell
            de columnes (Pes/Categoria, Ret. 5A/Plataforma) se solapa. El
            paddingRight fa de mitjana canal entre columnes. */}
        <View style={[S.tableHead, { paddingBottom: 7, marginBottom: 4 }]}>
          <View style={{ flex: 2.6, paddingRight: 8 }}><Text style={S.th}>Nom / ISIN</Text></View>
          <View style={{ flex: 0.75, paddingRight: 8 }}><Text style={[S.th, { textAlign: 'right' }]}>Pes</Text></View>
          <View style={{ flex: 1.9, paddingRight: 8 }}><Text style={S.th}>Categoria</Text></View>
          <View style={{ flex: 1.55, paddingRight: 8 }}><Text style={S.th}>Classe · Gestió</Text></View>
          <View style={{ flex: 0.8, paddingRight: 8 }}><Text style={[S.th, { textAlign: 'center' }]}>SRRI</Text></View>
          <View style={{ flex: 0.9, paddingRight: 8 }}><Text style={[S.th, { textAlign: 'right' }]}>TER</Text></View>
          <View style={{ flex: 1.15, paddingRight: 8 }}><Text style={[S.th, { textAlign: 'right' }]}>Ret. 5A</Text></View>
          <View style={{ flex: 1.5 }}><Text style={S.th}>Plataforma</Text></View>
        </View>

        {d.assets.map((a, i) => { const cl = classifyFund(a.isin, a.category, a.name); return (
          <View key={a.isin} wrap={false} style={[S.tableRow, { paddingVertical: compact ? 4 : 7 }, i % 2 === 1 ? S.tableAlt : {}]}>
            <View style={{ flex: 2.6, paddingRight: 8 }}>
              <Text style={S.td}>{a.name}</Text>
              <Text style={{ fontSize: 6.5, color: C.mutedLt, marginTop: 1.5 }}>{a.isin}</Text>
            </View>
            <View style={{ flex: 0.75, paddingRight: 8 }}><Text style={[S.td, S.bold, { textAlign: 'right' }]}>{fW(a.weight)}</Text></View>
            <View style={{ flex: 1.9, paddingRight: 8 }}><Text style={S.tdGray}>{a.category}</Text></View>
            <View style={{ flex: 1.55, paddingRight: 8 }}>
              <Text style={S.td}>{assetTypeLabel(cl)}</Text>
              <Text style={{ fontSize: 6.5, color: C.muted, marginTop: 1.5 }}>{managementLabel(cl)}</Text>
            </View>
            <View style={{ flex: 0.8, paddingRight: 8 }}><Text style={[S.td, { textAlign: 'center' }]}>{a.risk}/7</Text></View>
            <View style={{ flex: 0.9, paddingRight: 8 }}><Text style={[S.td, { textAlign: 'right' }]}>{fTer(a.ter)}</Text></View>
            <View style={{ flex: 1.15, paddingRight: 8 }}><Text style={[S.td, { textAlign: 'right' }]}>{fPct(assetReturn(a))}{assetReturnSource(a)}</Text></View>
            <View style={{ flex: 1.5 }}><Text style={S.tdGray}>{a.platform}</Text></View>
          </View>
        ); })}

        <View style={{ flexDirection: 'row', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.ink, marginTop: 3, marginBottom: 10 }}>
          <View style={{ flex: 2.6, paddingRight: 8 }}><Text style={[S.body2, S.bold]}>Totals ponderats</Text></View>
          <View style={{ flex: 0.75, paddingRight: 8 }}><Text style={[S.td, S.bold, { textAlign: 'right' }]}>100 %</Text></View>
          <View style={{ flex: 1.9, paddingRight: 8 }} />
          <View style={{ flex: 1.55, paddingRight: 8 }}>
            <Text style={[S.body2, S.bold, { fontSize: 7 }]}>RV {fW(c.alloc.equity)} · RF {fW(c.alloc.fixedIncome)}</Text>
            <Text style={{ fontSize: 6.5, color: C.muted, marginTop: 1.5 }}>Passiva {fW(c.alloc.passive)} · Activa {fW(c.alloc.active)}</Text>
          </View>
          <View style={{ flex: 0.8, paddingRight: 8 }}><Text style={[S.tdGray, S.bold, { textAlign: 'center' }]}>{fNum(c.wR, 1)}/7</Text></View>
          <View style={{ flex: 0.9, paddingRight: 8 }}><Text style={[S.td, S.bold, { textAlign: 'right' }]}>{fTer(c.terKnown ? c.wt : 0)}</Text></View>
          <View style={{ flex: 1.15, paddingRight: 8 }}><Text style={[S.td, S.bold, { textAlign: 'right' }]}>{fPct(c.nr)}</Text></View>
          <View style={{ flex: 1.5 }} />
        </View>
        <Text style={[S.body2, { fontSize: 6.5, marginBottom: 10 }]}>‡ Rendiment esperat CAPM (beta dels valors liquidatius)  ·  † Dades històriques reals a 5 anys  ·  * Estimació per categoria SRRI</Text>

        <View style={S.divider} />

        <Text style={S.subTag}>Tesi d&apos;inversió per instrument</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? 8 : 10 }}>
          {d.assets.filter(a => a.justification).map((a, i) => (
            <View key={a.isin} wrap={false} style={{ width: '47.5%', marginBottom: compact ? 3 : 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <View style={{ width: 6, height: 6, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length], flexShrink: 0 }} />
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, flex: 1 }}>
                  {a.name.length > 30 ? a.name.slice(0, 30) + '…' : a.name} · {fW(a.weight)}
                </Text>
              </View>
              <Text style={[S.body2, { fontSize: 7, paddingLeft: 11, lineHeight: 1.5 }]}>{a.justification}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}


// ─── DIVERSIFICACIÓ (regió, sector, mida, concentració) ─────────────────────
// Dades de la fitxa oficial de cada fons (lib/fundExposureData.ts). Només la
// part en renda variable. Sense puntuacions: percentatges i el que falta.
function diversificationOf(d: ManualPortfolioInput): ExposureBreakdown {
  return exposureBreakdown(d.assets.map(a => ({ isin: a.isin, weight: a.weight, category: a.category, name: a.name })));
}

function DivBars({ title, rows }: { title: string; rows: { label: string; v: number; missing?: boolean }[] }) {
  return (
    <View style={{ marginBottom: 12 }} wrap={false}>
      <Text style={S.subTag}>{title}</Text>
      {rows.map(r => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3.5 }}>
          <Text style={{ width: 118, fontSize: 7.5, color: r.missing ? C.mutedLt : C.ink }}>{r.label}</Text>
          <View style={{ flex: 1, height: 5, backgroundColor: C.grayBg }}>
            <View style={{ width: `${Math.min(100, Math.max(0, r.v))}%`, height: 5, backgroundColor: r.missing ? C.line : C.gold }} />
          </View>
          <Text style={{ width: 34, fontSize: 7.5, textAlign: 'right', color: C.ink, fontFamily: 'Helvetica-Bold' }}>{fW(r.v)}</Text>
        </View>
      ))}
    </View>
  );
}

function divRows<K extends string>(keys: K[], labels: Record<K, string>, vals: Record<K, number>, missing: number, max = 99) {
  let rows: { label: string; v: number; missing?: boolean }[] = keys.map(k => ({ label: labels[k] as string, v: vals[k] as number })).filter(r => r.v >= 0.5).sort((a, b) => b.v - a.v);
  // «No detallat» sempre al final i mai barrejat amb «Resta de sectors»
  const nd = rows.filter(r => /no detallat/.test(r.label));
  rows = rows.filter(r => !/no detallat/.test(r.label));
  if (rows.length > max) {
    const rest = rows.slice(max - 1);
    rows = [...rows.slice(0, max - 1), { label: 'Resta de sectors', v: rest.reduce((s, r) => s + r.v, 0) }];
  }
  rows = [...rows, ...nd];
  if (missing >= 0.5) rows.push({ label: 'Sense dades', v: missing, missing: true });
  return rows;
}

function DiversificationPage({ d }: { d: ManualPortfolioInput }) {
  const b = diversificationOf(d);
  return (
    <Page size="A4" style={S.page}>
      <Header section="Diversificació" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Diversificació"
          title="On s'inverteix la renda variable"
          intro={`Repartiment per regió, sector i mida d'empresa del ${fW(b.equity)} de la cartera invertit en renda variable, segons la fitxa oficial de cada fons${asOfLabel(b) ? ` (dades ${asOfLabel(b)})` : ''}. Estar més repartit no vol dir rendir més: indica de què depèn la cartera.`}
        />
        <View style={{ flexDirection: 'row', gap: 22 }}>
          <View style={{ flex: 1 }}>
            <DivBars title="Regió" rows={divRows(REGIONS, REGION_LABEL, b.region, b.regionMissing)} />
            <DivBars title="Mida d'empresa" rows={divRows(SIZES, SIZE_LABEL, b.size, b.sizeMissing)} />
          </View>
          <View style={{ flex: 1 }}>
            <DivBars title="Sector" rows={divRows(SECTORS, SECTOR_LABEL, b.sector, b.sectorMissing, 8)} />
          </View>
        </View>

        <View style={S.divider} />
        <Text style={S.subTag}>Concentració</Text>
        <View style={{ flexDirection: 'row', gap: 22 }} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={S.body1}>
              Les 10 primeres posicions de cada fons en pesen, de mitjana, el{' '}
              <Text style={S.bold}>{b.top10 != null ? fW(b.top10) : 'sense dades'}</Text>
              {b.top10 != null && b.top10Covered < 99.5 ? ` (mitjana només dels fons que publiquen el top-10: el ${fW(b.top10Covered)} de la renda variable)` : ''}.
              {' '}Com més alt és aquest percentatge, més depèn el resultat de poques empreses.
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            {b.companies.slice(0, 8).map((c, i) => (
              <View key={c.name} style={[S.tableRow, i % 2 ? S.tableAlt : {}, { paddingVertical: 3 }]}>
                <Text style={[S.td, { flex: 1, fontSize: 7.5 }]}>{c.name}</Text>
                <Text style={[S.td, S.bold, { width: 40, textAlign: 'right', fontSize: 7.5 }]}>{fPct(c.pct)}</Text>
              </View>
            ))}
            {b.companies.length > 0 && <Text style={[S.metricSub, { marginTop: 4 }]}>Empreses amb més pes, en % del total de la cartera. És un mínim: només es compta el top-10 de cada fons.</Text>}
          </View>
        </View>

        <View style={S.legalBox} wrap={false}>
          <Text style={S.legalText}>{`${exposureNote(b)} Les regions agrupen països (Corea, Taiwan, la Xina o l'Índia compten com a emergents). Per als fons indexats, la mida d'empresa surt de la definició de l'índex que repliquen.`}</Text>
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 8: IPS ──────────────────────────────────────────────────────────────
function IPSPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;
  const cn = CONSTRAINTS[d.investorProfile] ?? CONSTRAINTS.moderat;
  const benchName = BENCHMARK_NAME[d.investorProfile] ?? 'MSCI World';

  const sections = [
    { num: '1', title: "Objectius d'inversió",
      body: `Assolir el creixement patrimonial necessari per a l'objectiu "${d.objective}" en un horitzó de ${d.horizon} anys. Capital inicial: ${fEur(d.initialAmount)}. Aportació mensual: ${fEur(d.monthlyAmount)}. Rendiment objectiu net: ${fPct(c.nr)} anual (escenari base).` },
    { num: '2', title: 'Restriccions i limitacions',
      body: `Perfil: ${profileLabel}. Restriccions d'assignació: RV ${cn.rvMin}–${cn.rvMax} %, RF ${cn.rfMin}–${cn.rfMax} %. Cap actiu supera el 50 % de la cartera. TER màxim ponderat: 1,50 % anual. Sense exposició a derivats d'alt palanquejament.` },
    { num: '3', title: "Estratègia d'assignació d'actius",
      body: `Estratègia de compra i manteniment (Buy & Hold) amb rebalanceig anual. Assignació actual: renda variable ${fW(c.rvPct)}, renda fixa ${fW(c.rfPct)}${c.cashPct > 0.05 ? `, altres actius ${fW(c.cashPct)}` : ''}; gestió passiva ${fW(c.alloc.passive)} i activa ${fW(c.alloc.active)}. Diversificació geogràfica global amb exposició principal a mercats desenvolupats.` },
    { num: '4', title: 'Criteris de selecció de productes',
      body: `Prioritat a fons indexats de baix cost (ETF / UCITS). TER < 0,50 % preferible. SRRI adequat al perfil. ISIN registrat a la CNMV o entitat reguladora equivalent. Disponibilitat a la plataforma declarada per l'inversor.` },
    { num: '5', title: 'Política de rebalanceig',
      body: `Rebalanceig mínim anual o quan qualsevol actiu desviï >= 10 punts percentuals del pes objectiu. Mètode: compra selectiva via aportació mensual (eficient fiscalment) i venda parcial quan calgui. Documentar cada rebalanceig.` },
    { num: '6', title: 'Benchmark de referència',
      body: `Índex de referència: ${benchName} (retorn esperat: ${fPct(c.benchR)} anual). Diferència esperada de la cartera, neta de costos: ${fPct(c.alpha, true)}. ${c.allCapm ? 'Tots dos rendiments esperats surten del mateix model CAPM.' : `El benchmark es calcula amb CAPM; la cartera, amb base ${c.basisLabel}.`} Objectiu: superar o igualar el benchmark net de costos en horitzons >= 5 anys.` },
    { num: '7', title: 'Criteris ESG / sostenibilitat',
      body: `Incorporar filtratge negatiu per a sectors controvertits (armament, tabac, combustibles fòssils) quan hi hagi alternatives de cost similar. Preferència per fons Art. 8 SFDR o superior sempre que el cost no excedeixi 0,20 % de TER addicional.` },
    { num: '8', title: 'Govern, revisió i documentació',
      body: `Revisió integral anual del pla. Actualització del qüestionari MiFID II si canvia la situació financera, laboral o els objectius. Custòdia d'aquest IPS a l'expedient del client. Vigència: fins a la propera revisió anual o canvi de perfil.` },
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="IPS — Política d'Inversió" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="IPS — Investment Policy Statement"
          title="Declaració de Política d'Inversió"
          intro="Document formal que recull els objectius, les restriccions i l'estratègia d'inversió del client d'acord amb la Directiva MiFID II (Art. 54 del Reglament Delegat 2017/565)."
        />

        {sections.map((sec, i) => (
          <View key={sec.num} style={{ marginBottom: 9 }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 3 }}>
              <View style={{ width: 15, height: 15, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: 7.5, color: C.gold, fontFamily: 'Helvetica-Bold' }}>{sec.num}</Text>
              </View>
              <Text style={[S.body1, S.bold, { flex: 1 }]}>{sec.title}</Text>
            </View>
            <Text style={[S.body2, { paddingLeft: 23, lineHeight: 1.6 }]}>{sec.body}</Text>
            {i < sections.length - 1 && <View style={{ height: 0.5, backgroundColor: C.lineSoft, marginTop: 8, marginLeft: 23 }} />}
          </View>
        ))}

        <View style={[S.legalBox, { marginTop: 6 }]} wrap={false}>
          <Text style={[S.legalText, S.bold, { marginBottom: 2 }]}>Declaració de conformitat</Text>
          <Text style={S.legalText}>
            Aquest document ha estat elaborat per l&apos;equip assessor de Factor OTC, revisat i acceptat pel client. Constitueix la base de totes les decisions d&apos;inversió posteriors mentre estigui en vigor. Qualsevol canvi substancial en la situació financera del client invalidarà el present IPS i requerirà revisió.
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 9: SUITABILITY MiFID II + FRONTERA EFICIENT ─────────────────────────
function SuitabilityPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;

  const maxVol = Math.max(c.wv + 5, ...d.assets.map(a => assetVol(a))) + 2;
  const maxRet = Math.max(c.nr + 3, ...d.assets.map(a => assetReturn(a))) + 1;
  const W = 460, H = 110;
  const pad = { left: 5, right: 5, top: 5, bot: 5 };
  const toX = (vol: number) => pad.left + (vol / maxVol) * (W - pad.left - pad.right);
  const toY = (ret: number) => H - pad.bot - (ret / maxRet) * (H - pad.top - pad.bot);

  const maxRisk = d.investorProfile === 'conservador' ? 3
    : d.investorProfile === 'moderat' ? 4
    : d.investorProfile === 'dinamic' ? 6 : 7;

  return (
    <Page size="A4" style={S.page}>
      <Header section="Suitability MiFID II" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Suitability — MiFID II"
          title="Adequació dels instruments al perfil"
          intro="Contrast del nivell de risc de cada instrument amb la tolerància del perfil declarat i posició de la cartera en l'espai risc–rendiment."
        />

        <View style={S.tableHead}>
          <Text style={[S.th, { flex: 3 }]}>Instrument</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'center' }]}>SRRI</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'right' }]}>Pes</Text>
          <Text style={[S.th, { flex: 2 }]}>Adequació</Text>
          <Text style={[S.th, { flex: 2 }]}>Observació</Text>
        </View>
        {d.assets.map((a, i) => {
          const suitable = a.risk <= maxRisk;
          return (
            <View key={a.isin} style={[S.tableRow, i % 2 === 1 ? S.tableAlt : {}]}>
              <Text style={[S.td, { flex: 3 }]}>{a.name.length > 30 ? a.name.slice(0, 30) + '…' : a.name}</Text>
              <Text style={[S.td, { flex: 1, textAlign: 'center' }]}>{a.risk}/7</Text>
              <Text style={[S.td, S.bold, { flex: 1, textAlign: 'right' }]}>{fW(a.weight)}</Text>
              <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, backgroundColor: suitable ? C.pos : C.amber }} />
                <Text style={{ fontSize: 7.5, color: suitable ? C.pos : C.amber, fontFamily: 'Helvetica-Bold' }}>{suitable ? 'ADEQUAT' : 'REVISAR'}</Text>
              </View>
              <Text style={[S.tdGray, { flex: 2, fontSize: 7 }]}>{suitable ? `Compatible amb perfil ${profileLabel}` : 'SRRI superior al perfil'}</Text>
            </View>
          );
        })}

        <View style={S.divider} />

        <Text style={S.subTag}>Espai risc–rendiment</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 9, height: 9, backgroundColor: C.gold, borderRadius: 4.5 }} />
            <Text style={S.body2}>Cartera</Text>
          </View>
          {d.assets.slice(0, 5).map((a, i) => (
            <View key={a.isin} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{ width: 6, height: 6, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length], borderRadius: 3 }} />
              <Text style={S.body2}>{a.name.slice(0, 14)}</Text>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.grayBg, borderWidth: 0.5, borderColor: C.line, padding: 4 }}>
          <Svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
            {[0.25, 0.5, 0.75].map(f => (
              <Line key={f} x1={0} y1={toY(maxRet * f).toFixed(1)} x2={W} y2={toY(maxRet * f).toFixed(1)} stroke={C.line} strokeWidth={0.5} />
            ))}
            {d.assets.map((a, i) => (
              <Circle key={a.isin} cx={toX(assetVol(a)).toFixed(1)} cy={toY(assetReturn(a)).toFixed(1)} r={4.5} fill={ASSET_COLORS[i % ASSET_COLORS.length]} fillOpacity={0.8} />
            ))}
            <Circle cx={toX(c.wv).toFixed(1)} cy={toY(c.nr).toFixed(1)} r={7.5} fill={C.gold} />
            <Circle cx={toX(c.wv).toFixed(1)} cy={toY(c.nr).toFixed(1)} r={3.5} fill={C.white} />
          </Svg>
          <Text style={{ fontSize: 6, color: C.mutedLt, textAlign: 'center', marginTop: 2 }}>Eix X: volatilitat (%) · Eix Y: rendiment net esperat (%)</Text>
        </View>

        <View style={S.divider} />

        <View style={S.cardGold} wrap={false}>
          <Text style={[S.body1, S.bold, { color: C.green, marginBottom: 2 }]}>Conclusió de suitability: {profileLabel}</Text>
          <Text style={S.body2}>
            La cartera presenta un SRRI ponderat de {fNum(c.wR, 1)}/7 i és {c.wR <= (d.investorProfile === 'conservador' ? 3 : d.investorProfile === 'moderat' ? 4 : d.investorProfile === 'dinamic' ? 5.5 : 7) ? 'adequada' : 'parcialment adequada'} per al perfil {profileLabel}. Rendiment net esperat: {fPct(c.nr)} · Volatilitat: {fPct(c.wv)} · Sharpe: {fNum(c.sharpe, 2)}.
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 10: CORRELACIÓ D'ACTIUS ─────────────────────────────────────────────
function CorrelationPage({ d }: { d: ManualPortfolioInput }) {
  const assets = d.assets.slice(0, 7);
  const n = assets.length;
  const cellW = Math.min(55, Math.floor(460 / (n + 1)));

  return (
    <Page size="A4" style={S.page}>
      <Header section="Correlació d'Actius" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Matriu de Correlació"
          title="Diversificació entre instruments"
          intro="Correlació estimada a partir de la classe d'actiu. Valors propers a -1 indiquen diversificació màxima; propers a +1, actius que es mouen junts."
        />

        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
          <View style={{ width: cellW + 20 }} />
          {assets.map((a, i) => (
            <View key={a.isin} style={{ width: cellW, alignItems: 'center' }}>
              <Text style={{ fontSize: 6, color: C.ink, fontFamily: 'Helvetica-Bold' }}>#{i + 1}</Text>
            </View>
          ))}
        </View>

        {assets.map((rowA, i) => (
          <View key={rowA.isin} style={{ flexDirection: 'row', marginBottom: 2 }}>
            <View style={{ width: cellW + 20, justifyContent: 'center' }}>
              <Text style={{ fontSize: 6.5, color: C.ink }}>{`#${i + 1} ${rowA.name.slice(0, 14)}`}</Text>
            </View>
            {assets.map((colA, j) => {
              const r = corrBetween(rowA, colA);
              return (
                <View key={colA.isin} style={{ width: cellW, height: 26, backgroundColor: corrColor(r), justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: C.white }}>
                  <Text style={{ fontSize: 7.5, color: corrText(r), fontFamily: i === j ? 'Helvetica-Bold' : 'Helvetica' }}>{fNum(r, 2)}</Text>
                </View>
              );
            })}
          </View>
        ))}

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'center' }}>
          <Text style={[S.body2, { marginRight: 4 }]}>Escala:</Text>
          {[
            { color: '#1a3a2a', label: '>= 0,80' },
            { color: '#2d5a45', label: '0,60' },
            { color: '#5b8a73', label: '0,40' },
            { color: '#a9c5b5', label: '0,20' },
            { color: '#eef2ee', label: '0,00' },
            { color: '#e7d9d7', label: '-0,20' },
            { color: '#c19a95', label: '< -0,20' },
          ].map(l => (
            <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{ width: 13, height: 9, backgroundColor: l.color }} />
              <Text style={{ fontSize: 6.5, color: C.muted }}>{l.label}</Text>
            </View>
          ))}
        </View>

        <View style={S.divider} />

        <Text style={S.subTag}>Interpretació</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
          {[
            ['Alta correlació (> 0,7)', 'Actius del mateix segment que es mouen junts. Menor benefici de diversificació.'],
            ['Correlació neutra (0 – 0,3)', 'Comportament independent. Contribució positiva a la diversificació de la cartera.'],
            ['Correlació negativa (< 0)', 'Actius que es compensen mútuament. Efecte amortidor en caigudes de mercat.'],
          ].map(([title, desc]) => (
            <View key={title as string} style={{ flex: 1, borderTopWidth: 2, borderTopColor: C.gold, borderWidth: 0.5, borderColor: C.line, padding: 10 }}>
              <Text style={[S.body2, S.bold, { marginBottom: 3, color: C.ink }]}>{title}</Text>
              <Text style={[S.body2, { fontSize: 7.5 }]}>{desc}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 11: ANÀLISI GRÀFICA ─────────────────────────────────────────────────
function AnalysisPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  const benchR = c.benchR;
  const nPts = 9;
  const nowY = new Date().getFullYear();

  const times = Array.from({ length: nPts }, (_, i) => i * d.horizon / (nPts - 1));
  const ptfVals = times.map(t => t === 0 ? 100 : 100 * Math.pow(1 + c.nr / 100, t));
  const benchVals = times.map(t => t === 0 ? 100 : 100 * Math.pow(1 + benchR / 100, t));
  const maxV = Math.max(...ptfVals) * 1.03;
  const W = 465, H = 120;
  const xs = Array.from({ length: nPts }, (_, i) => 5 + i * (W - 10) / (nPts - 1));
  const pathPtf = makeLine(ptfVals, xs, 100, maxV, 5, H - 5);
  const pathBench = makeLine(benchVals, xs, 100, maxV, 5, H - 5);
  const areaPath = pathPtf + ` L${xs[nPts - 1].toFixed(1)},${(H - 5).toFixed(1)} L${xs[0].toFixed(1)},${(H - 5).toFixed(1)} Z`;

  const periodReturn = (months: number) => (Math.pow(1 + c.nr / 100, months / 12) - 1) * 100;
  const periods = [
    { label: '1M', ret: periodReturn(1) },
    { label: '3M', ret: periodReturn(3) },
    { label: '6M', ret: periodReturn(6) },
    { label: '1A', ret: periodReturn(12) },
    { label: '3A', ret: periodReturn(36) },
    { label: '5A', ret: periodReturn(60) },
    { label: `${d.horizon}A`, ret: periodReturn(d.horizon * 12) },
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="Anàlisi Gràfica" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Anàlisi Gràfica"
          title="Evolució estimada de la cartera"
          intro={`Projecció de valor indexada a base 100 enfront del benchmark de referència (${BENCHMARK_NAME[d.investorProfile] ?? ''}).`}
        />

        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 18, height: 2, backgroundColor: C.ink }} />
            <Text style={S.body2}>Cartera ({fPct(c.nr)} anual)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 18, height: 2, backgroundColor: C.mutedLt }} />
            <Text style={S.body2}>Benchmark ({fPct(benchR)} anual)</Text>
          </View>
        </View>

        <View style={{ backgroundColor: C.grayBg, borderWidth: 0.5, borderColor: C.line, padding: 4, marginBottom: 8 }}>
          <Svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
            <Defs>
              <LinearGradient id="ev-area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.gold} stopOpacity={0.22} />
                <Stop offset="1" stopColor={C.gold} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {[0.25, 0.5, 0.75].map(f => {
              const gridY = (5 + (H - 10) * (1 - f)).toFixed(1);
              return <Line key={f} x1={0} y1={gridY} x2={W} y2={gridY} stroke={C.line} strokeWidth={0.5} />;
            })}
            <Path d={areaPath} fill="url(#ev-area)" />
            <Path d={pathBench} fill="none" stroke={C.mutedLt} strokeWidth={1.4} strokeDasharray="4,3" />
            <Path d={pathPtf} fill="none" stroke={C.ink} strokeWidth={2} />
          </Svg>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 4, marginBottom: 12 }}>
          {times.filter((_, i) => i % 2 === 0 || i === nPts - 1).map(t => (
            <Text key={t} style={[S.body2, { flex: 1, textAlign: 'center', fontSize: 6.5 }]}>{nowY + Math.round(t)}</Text>
          ))}
        </View>

        <View style={S.divider} />

        <Text style={S.subTag}>Rendiments estimats per període</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, marginBottom: 8 }}>
          {periods.map(p => (
            <View key={p.label} style={[S.metricBox, { borderTopWidth: 2, borderTopColor: p.ret >= 0 ? C.pos : C.neg, padding: 8 }]}>
              <Text style={[S.metricLabel, { textAlign: 'center', marginBottom: 3 }]}>{p.label}</Text>
              <Text style={{ fontSize: fitFont(fPct(p.ret, true), 11), fontFamily: 'Helvetica-Bold', textAlign: 'center', color: p.ret >= 0 ? C.pos : C.neg }}>{fPct(p.ret, true)}</Text>
            </View>
          ))}
        </View>

        <View style={S.divider} />

        <Text style={S.subTag}>Mètriques quantitatives</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {[
            { label: 'Rendiment net', value: fPct(c.nr) },
            { label: 'Volatilitat', value: fPct(c.wv) },
            { label: 'Sharpe Ratio', value: fNum(c.sharpe, 2) },
            { label: 'VaR 95% (1A)', value: fPct(c.var95) },
            { label: 'Dif. vs. benchmark', value: fPct(c.alpha, true) },
            { label: 'Benchmark esperat', value: fPct(c.benchR) },
            { label: 'TER ponderat', value: fTer(c.terKnown ? c.wt : 0) },
            { label: 'Multiplicador', value: `× ${fNum(c.wealthMult, 1)}` },
          ].map(m => (
            <View key={m.label} style={{ width: '31.8%', borderWidth: 0.5, borderColor: C.line, padding: 8 }}>
              <Text style={S.metricLabel}>{m.label}</Text>
              <Text style={[S.metricValue, { fontSize: fitFont(m.value, 12) }]}>{m.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 12: PROJECCIÓ PER ESCENARIS ─────────────────────────────────────────
function ScenarioPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  const nPts = 8;
  const W = 465, H = 130;

  const times = Array.from({ length: nPts }, (_, i) => i * d.horizon / (nPts - 1));
  const xs = Array.from({ length: nPts }, (_, i) => 5 + i * (W - 10) / (nPts - 1));

  const vP50 = times.map(t => t === 0 ? d.initialAmount : projection(d.initialAmount, d.monthlyAmount, c.nr, t));
  const vP10 = times.map(t => t === 0 ? d.initialAmount : projection(d.initialAmount, d.monthlyAmount, c.r10, t));
  const vP90 = times.map(t => t === 0 ? d.initialAmount : projection(d.initialAmount, d.monthlyAmount, c.r90, t));
  const vAp  = times.map(t => d.initialAmount + d.monthlyAmount * t * 12);

  const allVals = [...vP90, ...vP10, ...vAp];
  const minV = Math.min(...allVals) * 0.96;
  const maxV = Math.max(...allVals) * 1.04;

  const pathP50 = makeLine(vP50, xs, minV, maxV, 5, H - 5);
  const pathP10 = makeLine(vP10, xs, minV, maxV, 5, H - 5);
  const pathP90 = makeLine(vP90, xs, minV, maxV, 5, H - 5);
  const pathAp  = makeLine(vAp, xs, minV, maxV, 5, H - 5);

  const toYMC = (v: number) => (5 + (H - 10) * (1 - (v - minV) / (maxV - minV))).toFixed(1);
  const areaTop = vP90.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${toYMC(v)}`).join(' ');
  const areaBtm = vP10.slice().reverse().map((v, i) => `L${xs[nPts - 1 - i].toFixed(1)},${toYMC(v)}`).join(' ');
  const bandPath = areaTop + ' ' + areaBtm + ' Z';
  const nowY = new Date().getFullYear();

  const scenarios = [
    { label: 'Escenari desfavorable', value: c.p10, rate: fPct(c.r10), tone: 'neg' as Tone },
    { label: 'Escenari base', value: c.p50, rate: fPct(c.nr), accent: true },
    { label: 'Escenari favorable', value: c.p90, rate: fPct(c.r90), tone: 'pos' as Tone },
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="Projecció per Escenaris" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Projecció per Escenaris"
          title={`Evolució projectada a ${d.horizon} anys`}
          intro={`Projecció determinista per interès compost. Base = rendiment net esperat (${fPct(c.nr)}, ${c.basisLabel}); desfavorable i favorable = base menys / més 0,35 desviacions estàndard de la volatilitat (${fPct(c.wv)}). No són percentils ni el pitjor cas: el resultat real pot quedar fora d'aquest rang.`}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
          {[
            { label: `Favorable (${fPct(c.r90)})`, color: C.pos },
            { label: `Base (${fPct(c.nr)})`, color: C.ink },
            { label: `Desfavorable (${fPct(c.r10)})`, color: C.neg },
            { label: 'Capital aportat', color: C.mutedLt },
          ].map(l => (
            <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 16, height: 2, backgroundColor: l.color }} />
              <Text style={[S.body2, { fontSize: 7 }]}>{l.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.grayBg, borderWidth: 0.5, borderColor: C.line, padding: 4, marginBottom: 6 }}>
          <Svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
            <Defs>
              <LinearGradient id="mc-band" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.gold} stopOpacity={0.18} />
                <Stop offset="1" stopColor={C.gold} stopOpacity={0.03} />
              </LinearGradient>
            </Defs>
            {[0.25, 0.5, 0.75].map(f => {
              const gy = (5 + (H - 10) * (1 - f)).toFixed(1);
              return <Line key={f} x1={0} y1={gy} x2={W} y2={gy} stroke={C.line} strokeWidth={0.5} />;
            })}
            <Path d={bandPath} fill="url(#mc-band)" />
            <Path d={pathAp} fill="none" stroke={C.mutedLt} strokeWidth={1.4} strokeDasharray="3,3" />
            <Path d={pathP10} fill="none" stroke={C.neg} strokeWidth={1.4} strokeDasharray="4,3" />
            <Path d={pathP90} fill="none" stroke={C.pos} strokeWidth={1.4} strokeDasharray="4,3" />
            <Path d={pathP50} fill="none" stroke={C.ink} strokeWidth={2.4} />
          </Svg>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 4, marginBottom: 12 }}>
          {times.filter((_, i) => i % 2 === 0 || i === nPts - 1).map(t => (
            <Text key={t} style={[S.body2, { flex: 1, textAlign: 'center', fontSize: 6.5 }]}>{nowY + Math.round(t)}</Text>
          ))}
        </View>

        <View style={S.row}>
          {scenarios.map(sc => (
            <View key={sc.label} style={[S.metricBox, { borderTopWidth: 2, borderTopColor: sc.accent ? C.gold : sc.tone === 'pos' ? C.pos : C.neg }]}>
              <Text style={S.metricLabel}>{sc.label}</Text>
              <Text style={[S.metricValue, { fontSize: fitFont(fEur(sc.value), 15), color: sc.tone === 'pos' ? C.pos : sc.tone === 'neg' ? C.neg : C.ink }]}>{fEur(sc.value)}</Text>
              <Text style={S.metricSub}>Rendiment {sc.rate} anual</Text>
              <Text style={S.metricSub}>Guany {fEur(sc.value - c.totalInvested)}</Text>
            </View>
          ))}
        </View>

        <View style={S.divider} />

        <Text style={S.subTag}>Desglossament del capital</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {[
            { label: 'Capital aportat total', value: fEur(c.totalInvested), sub: 'inicial + aportacions' },
            { label: 'Guany escenari base', value: fEur(c.p50 - c.totalInvested), sub: 'projecció central', accent: true },
            { label: 'Guany escenari desfavorable', value: fEur(c.p10 - c.totalInvested), sub: 'escenari advers', tone: 'neg' as Tone },
            { label: 'Guany escenari favorable', value: fEur(c.p90 - c.totalInvested), sub: 'escenari favorable', tone: 'pos' as Tone },
          ].map(m => (
            <StatCard key={m.label} width="23.2%" label={m.label} value={m.value} sub={m.sub} accent={m.accent} tone={m.tone} />
          ))}
        </View>
      </View>
    </Page>
  );
}

// ─── PAGE 13: RISCOS I CONCLUSIÓ ──────────────────────────────────────────────
function ConclusionPage({ d }: { d: ManualPortfolioInput }) {
  const c = compute(d);
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;

  const risks = [
    { category: 'Risc de mercat', level: 'Moderat–Alt', desc: 'Fluctuació de valoracions. Es mitiga amb horitzó llarg i diversificació.' },
    { category: 'Risc de liquiditat', level: 'Baix–Moderat', desc: 'Els ETF UCITS cotitzen diàriament; algunes emissions poden tenir spread ampli.' },
    { category: 'Risc de divisa', level: c.rvPct > 50 ? 'Moderat' : 'Baix', desc: 'Els actius en USD/GBP presenten exposició FX. Cobertura via ETF EUR-hedged si es prefereix.' },
    { category: 'Risc de concentració', level: 'Baix', desc: `${d.assets.length} instruments diversificats. Concentració adequada al perfil.` },
    { category: "Risc de tipus d'interès", level: c.rfPct > 30 ? 'Moderat' : 'Baix', desc: 'La renda fixa és sensible a pujades de tipus. Cal gestionar la duration de la cartera.' },
    { category: 'Risc regulatori', level: 'Baix', desc: 'Canvis en MiFID, SFDR o fiscalitat poden afectar el TER net efectiu de la cartera.' },
  ];

  const monitoring = [
    ['Revisió mensual', 'Verificar l\'aportació automàtica i els ingressos. Actualitzar davant de canvis laborals.'],
    ['Revisió trimestral', 'Controlar la desviació dels pesos objectiu. Actuar si la desviació supera el 5 %.'],
    ['Revisió anual', 'Rebalanceig formal, actualització del qüestionari MiFID II, revisió de l\'IPS i fiscalitat.'],
    ['Revisió extraordinària', 'Canvi laboral, herència, compra d\'immoble o canvi d\'objectiu vital.'],
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="Riscos i Conclusió" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Factors de Risc"
          title="Riscos identificats i pla de seguiment"
          intro="Riscos rellevants per a la cartera proposada, mesures de mitigació i calendari de revisió."
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {risks.map(r => (
            <View key={r.category} style={{ width: '47.5%', borderLeftWidth: 2, borderLeftColor: C.gold, borderWidth: 0.5, borderColor: C.line, padding: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
                <Text style={[S.body2, S.bold, { color: C.ink }]}>{r.category}</Text>
                <View style={{ borderWidth: 0.5, borderColor: C.line, backgroundColor: C.offWhite, padding: '2 5' }}>
                  <Text style={{ fontSize: 6, color: C.muted, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3 }}>{r.level}</Text>
                </View>
              </View>
              <Text style={[S.body2, { fontSize: 7.5, lineHeight: 1.5 }]}>{r.desc}</Text>
            </View>
          ))}
        </View>

        <Text style={S.subTag}>Pla de seguiment</Text>
        <View style={[S.tableHead, { marginTop: 2 }]}>
          <Text style={[S.th, { flex: 1.5 }]}>Freqüència</Text>
          <Text style={[S.th, { flex: 4 }]}>Acció de seguiment</Text>
        </View>
        {monitoring.map(([freq, action], i) => (
          <View key={freq} style={[S.tableRow, i % 2 === 1 ? S.tableAlt : {}]}>
            <Text style={[S.td, S.bold, { flex: 1.5 }]}>{freq}</Text>
            <Text style={[S.td, { flex: 4 }]}>{action}</Text>
          </View>
        ))}

        <View style={S.divider} />

        <View style={S.cardGold} wrap={false}>
          <Text style={[S.body1, S.bold, { color: C.green, marginBottom: 4 }]}>Valoració del pla d&apos;inversió: {profileLabel}</Text>
          <Text style={[S.body1, { marginBottom: 6 }]}>
            La cartera dissenyada per a {d.clientName} és coherent amb el perfil {profileLabel} i l&apos;objectiu &quot;{d.objective}&quot;. Amb un rendiment net estimat del {fPct(c.nr)} anual, la projecció base assoleix {fEur(c.p50)} en {d.horizon} anys sobre un capital aportat de {fEur(c.totalInvested)}.
          </Text>
          <Text style={S.body2}>
            El Sharpe Ratio de {fNum(c.sharpe, 2)} i l&apos;alfa de {fPct(c.alpha, true)} enfront del benchmark indiquen una relació risc–rendiment {c.sharpe >= 0.5 ? 'positiva i competitiva' : 'adequada al perfil'}. Es recomana seguir el pla de seguiment establert a l&apos;IPS i revisar-lo anualment.
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── CAIGUDES HISTÒRIQUES (perfils conservador i moderat) ─────────────────────
// Només amb els valors liquidatius oficials desats (lib/drawdowns.ts). Pot ocupar
// més d'una pàgina: la capçalera i el peu es repeteixen (fixed).
function DrawdownsPage({ d, items }: { d: ManualPortfolioInput; items: FundDrawdowns[] }) {
  const weight = (isin: string) => d.assets.find(a => a.isin === isin)?.weight ?? 0;
  const sorted = [...items].sort((a, b) => weight(b.isin) - weight(a.isin));
  return (
    <Page size="A4" style={S.page} wrap>
      <Header section="Caigudes històriques" client={d.clientName} />
      {/* Espai sota la capçalera a les pàgines de continuació */}
      <View fixed style={{ height: 14 }} />
      <Footer />
      <View style={[S.body, { paddingTop: 6 }]}>
        <SectionTitle
          tag="Risc observat"
          title="Les caigudes més grans de cada fons"
          intro="Per a cada fons proposat: quant ha arribat a baixar des d'un màxim, quan va passar i quant va tardar a recuperar-se. És el que ha passat de veritat amb els preus oficials, no una estimació. Serveix per saber què es pot esperar en un mal moment."
        />
        <View style={[S.legalBox, { marginTop: 0, marginBottom: 10 }]} wrap={false}>
          <Text style={[S.legalText, S.bold, { marginBottom: 3 }]}>Com llegir aquesta pàgina</Text>
          <Text style={S.legalText}>{DRAWDOWN_DISCLAIMER}</Text>
        </View>
        {sorted.map(f => (
          <View key={f.isin} wrap={false} style={{ borderWidth: 0.5, borderColor: C.line, borderLeftWidth: 2, borderLeftColor: C.gold, padding: 9, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[S.body1, S.bold, { marginBottom: 1 }]}>{f.name}</Text>
                <Text style={[S.body2, { fontSize: 7 }]}>
                  {f.isin}{f.windowStart && f.windowEnd ? ` · Dades de ${dateLabel(f.windowStart, f.frequency)} a ${dateLabel(f.windowEnd, f.frequency)} (${fNum(f.years, 1)} anys, ${frequencyLabel(f.frequency)})` : ''}
                </Text>
              </View>
              {f.maxDrawdown !== null && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 6, color: C.muted, letterSpacing: 0.3, textTransform: 'uppercase' }}>Caiguda màxima</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.neg }}>{f.maxDrawdown === 0 ? 'cap' : fPct(f.maxDrawdown)}</Text>
                </View>
              )}
            </View>
            {f.episodes.length > 0 && (
              <View style={{ marginTop: 6 }}>
                <View style={S.tableHead}>
                  <Text style={[S.th, { flex: 0.3 }]}>#</Text>
                  <Text style={[S.th, { flex: 1.1 }]}>Màxim previ</Text>
                  <Text style={[S.th, { flex: 1.1 }]}>Punt més baix</Text>
                  <Text style={[S.th, { flex: 0.9, textAlign: 'right' }]}>Caiguda</Text>
                  <Text style={[S.th, { flex: 1.2, paddingLeft: 8 }]}>Temps caient</Text>
                  <Text style={[S.th, { flex: 2.4 }]}>Temps per recuperar-se</Text>
                </View>
                {f.episodes.map((e, i) => (
                  <View key={e.peakDate} style={[S.tableRow, { paddingVertical: 3 }]}>
                    <Text style={[S.tdGray, { flex: 0.3 }]}>{i + 1}</Text>
                    <Text style={[S.td, { flex: 1.1 }]}>{dateLabel(e.peakDate, f.frequency)}</Text>
                    <Text style={[S.td, { flex: 1.1 }]}>{dateLabel(e.troughDate, f.frequency)}</Text>
                    <Text style={[S.td, S.bold, { flex: 0.9, textAlign: 'right', color: C.neg }]}>{fPct(e.depthPct)}</Text>
                    <Text style={[S.td, { flex: 1.2, paddingLeft: 8 }]}>{fallLabel(e, f.frequency)}</Text>
                    <Text style={[S.td, { flex: 2.4, color: e.recoveryDate ? C.ink : C.amber }]}>{recoveryLabel(e, f.frequency).replace(/−/g, '-')}</Text>
                  </View>
                ))}
              </View>
            )}
            {f.warnings.map(w => <Text key={w} style={[S.body2, { fontSize: 7, color: C.amber, marginTop: 2 }]}>{w}</Text>)}
          </View>
        ))}
      </View>
    </Page>
  );
}

// ─── PAGE 14: METODOLOGIA I AVÍS LEGAL ────────────────────────────────────────
function MethodologyPage({ d, generatedAt }: { d: ManualPortfolioInput; generatedAt: string }) {
  return (
    <Page size="A4" style={S.page}>
      <Header section="Metodologia i Avís Legal" client={d.clientName} />
      <Footer />
      <View style={S.body}>
        <SectionTitle
          tag="Annex"
          title="Metodologia i avís legal"
          intro="Bases de càlcul, fonts de dades i condicions d'ús del present informe."
        />

        <Text style={S.subTag}>Metodologia i fonts de dades</Text>
        <View style={{ gap: 8, marginBottom: 14 }}>
          {[
            ['Rendiments i volatilitat dels actius', `‡ Rendiment esperat amb el CAPM (Sharpe, 1964): ${fNum(CAPM_ASSUMPTIONS.riskFree, 2)} % (tipus de dipòsit del BCE) + beta × ${fNum(CAPM_ASSUMPTIONS.equityPremium, 2)} % (prima de risc de mercat, Damodaran, gener 2025). La beta surt dels rendiments mensuals dels valors liquidatius oficials de cada fons contra el MSCI World (fins a 5 anys). No es projecta la rendibilitat dels últims anys perquè sobreestimaria el futur. ` + '† Dades històriques reals a 5 anys de la base de dades de Factor OTC. * En absència de sèrie històrica, estimació per indicador SRRI: 1: 2 %, 2: 3,5 %, 3: 5 %, 4: 7 %, 5: 9,5 %, 6: 13 %, 7: 17 % de rendiment anual, amb la volatilitat corresponent.'],
            ['Projecció de cartera', 'Interès compost amb aportació mensual constant. Escenari base = rendiment net esperat (CAPM o, si un actiu no té beta, el seu històric; vegeu ‡ † *). Escenaris desfavorable i favorable = base menys / més 0,35 desviacions estàndard (no són percentils ni el pitjor cas possible). Projecció determinista; no és una simulació estocàstica de Monte Carlo.'],
            ['Mètriques de risc', 'Correlació estimada segons la classe d\'actiu. VaR 95 % a un any = -1,645 desviacions estàndard. Taxa lliure de risc: 3,5 % (referència BCE). Benchmark: retorns de referència assignats per perfil inversor.'],
          ].map(([title, body]) => (
            <View key={title} style={{ borderWidth: 0.5, borderColor: C.line, borderLeftWidth: 2, borderLeftColor: C.gold, padding: 10 }}>
              <Text style={[S.body1, S.bold, { marginBottom: 2 }]}>{title}</Text>
              <Text style={[S.body2, { lineHeight: 1.55 }]}>{body}</Text>
            </View>
          ))}
        </View>

        <View style={S.divider} />

        <View style={S.legalBox} wrap={false}>
          <Text style={[S.legalText, S.bold, { marginBottom: 3 }]}>Avís legal · Disclaimer</Text>
          <Text style={S.legalText}>
            Aquest informe ha estat elaborat per Factor OTC amb finalitat exclusivament orientativa i educativa. No constitueix assessorament financer personalitzat regulat (MiFID II) ni oferta o recomanació d&apos;inversió. Factor OTC no és una entitat financera autoritzada per la CNMV o equivalent. Els rendiments estimats es basen en models estadístics i dades històriques que no garanteixen resultats futurs. Invertir implica risc de pèrdua total o parcial del capital. Consulti un assessor financer regulat autoritzat per la CNMV abans de prendre decisions d&apos;inversió.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.line }}>
          <View>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, letterSpacing: 1.5 }}>FACTOR OTC</Text>
            <Text style={{ fontSize: 7, color: C.mutedLt, marginTop: 2 }}>Assessorament patrimonial · Catalunya</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: C.muted }}>Client: {d.clientName}</Text>
            <Text style={{ fontSize: 7, color: C.mutedLt, marginTop: 2 }}>Informe generat el {generatedAt}</Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

// ─── DOCUMENT ─────────────────────────────────────────────────────────────────
interface Props {
  data:        ManualPortfolioInput;
  generatedAt: string;
  /** Caigudes històriques dels fons (només per a perfils conservador i moderat). */
  drawdowns?:  FundDrawdowns[];
}

function hasRealFinances(d: ManualPortfolioInput): boolean {
  return d.monthlyIncome != null && d.monthlyExpenses != null;
}

export function ManualReportPDF({ data, generatedAt, drawdowns }: Props) {
  return (
    <Document
      title={`Factor OTC — Informe ${data.clientName}`}
      author="Factor OTC"
      creator="Factor OTC Admin"
      producer="@react-pdf/renderer v4">
      <CoverPage             d={data} generatedAt={generatedAt} />
      <ExecutivePage         d={data} />
      {/* Sense ingressos i despeses reals no es mostren: abans s'inventaven a partir de l'aportació */}
      {hasRealFinances(data) && <FinancialProfilePage  d={data} />}
      {hasRealFinances(data) && <DiagnosticsPage       d={data} />}
      <InvestorProfilePage   d={data} />
      <PortfolioPage         d={data} />
      <AssetsPage            d={data} />
      {!!drawdowns?.some(f => f.monthlyPoints > 1) && <DrawdownsPage d={data} items={drawdowns} />}
      {diversificationOf(data).equity > 0 && <DiversificationPage d={data} />}
      <IPSPage               d={data} />
      <SuitabilityPage       d={data} />
      <CorrelationPage       d={data} />
      <AnalysisPage          d={data} />
      <ScenarioPage          d={data} />
      <ConclusionPage        d={data} />
      <MethodologyPage       d={data} generatedAt={generatedAt} />
    </Document>
  );
}
