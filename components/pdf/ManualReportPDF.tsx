// components/pdf/ManualReportPDF.tsx
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer';
import type { ManualPortfolioInput, ManualAsset } from '@/lib/manualReport';

// ─── COLORS ──────────────────────────────────────────────────────────────────
const C = {
  navy:       '#0f2137',
  green:      '#1a3a2a',
  greenMid:   '#2d6a4f',
  gold:       '#c9a84c',
  white:      '#ffffff',
  offWhite:   '#f9f8f5',
  gray:       '#6b7280',
  grayLight:  '#e5e7eb',
  grayBg:     '#f3f4f6',
  dark:       '#111827',
  red:        '#ef4444',
  green2:     '#16a34a',
  blue:       '#3b82f6',
};

const ASSET_COLORS = [C.gold, C.green2, C.blue, '#8b5cf6', '#f97316', '#ec4899', '#06b6d4', C.red];

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: { backgroundColor: C.white, fontFamily: 'Helvetica', paddingBottom: 50 },
  coverPage: { backgroundColor: C.green, fontFamily: 'Helvetica' },

  header: {
    paddingHorizontal: 45, paddingTop: 24, paddingBottom: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 0.5, borderBottomColor: C.grayLight,
  },
  headerLogo: { flexDirection: 'row', alignItems: 'center' },
  headerLogoFactor: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.dark, letterSpacing: 1.5 },
  headerLogoOTC: { fontSize: 8, color: C.gold, letterSpacing: 1.5 },
  headerRight: { fontSize: 7, color: C.gray },

  footer: {
    position: 'absolute', bottom: 16, left: 45, right: 45,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 0.5, borderTopColor: C.grayLight, paddingTop: 6,
  },
  footerText: { fontSize: 6, color: C.gray },

  body: { paddingHorizontal: 45, paddingTop: 20 },

  tag:   { fontSize: 7, color: C.gold, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 3 },
  h1:    { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 6 },
  h2:    { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 10 },
  body1: { fontSize: 9, color: C.dark, lineHeight: 1.6, marginBottom: 6 },
  body2: { fontSize: 8, color: C.gray, lineHeight: 1.6 },
  bold:  { fontFamily: 'Helvetica-Bold' },

  divider: { height: 0.5, backgroundColor: C.grayLight, marginVertical: 12 },

  row:  { flexDirection: 'row', gap: 10, marginBottom: 10 },
  col:  { flex: 1 },

  metricBox: {
    flex: 1, borderWidth: 0.5, borderColor: C.grayLight,
    padding: 10, backgroundColor: C.white,
  },
  metricLabel: { fontSize: 6, color: C.gray, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  metricValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.dark },
  metricSub:   { fontSize: 6, color: C.gray, marginTop: 1 },

  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.dark, paddingBottom: 4, marginBottom: 3 },
  tableRow:  { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.grayLight, paddingVertical: 5 },
  tableRowAlt: { backgroundColor: C.offWhite },
  th:        { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.dark, letterSpacing: 0.8, textTransform: 'uppercase' },
  td:        { fontSize: 8, color: C.dark },
  tdGray:    { fontSize: 8, color: C.gray },

  legalBox: {
    borderWidth: 0.5, borderColor: C.grayLight,
    padding: 10, marginTop: 8, backgroundColor: C.offWhite,
  },
  legalText: { fontSize: 6.5, color: C.gray, lineHeight: 1.5 },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fEur(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M€`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} K€`;
  return `${n.toLocaleString('ca-ES')} €`;
}

function projection(initial: number, monthly: number, annualReturn: number, years: number): number {
  const r = annualReturn / 100 / 12;
  const n = years * 12;
  const fi = initial * Math.pow(1 + r, n);
  const fm = r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n;
  return fi + fm;
}

const RISK_RETURN: Record<number, number> = { 1: 2, 2: 3.5, 3: 5, 4: 7, 5: 9.5, 6: 13, 7: 17 };
const RISK_VOL:    Record<number, number> = { 1: 1, 2: 3, 3: 6, 4: 11, 5: 16, 6: 22, 7: 30 };
const RISK_LABEL:  Record<number, string> = { 1: 'Molt baix', 2: 'Baix', 3: 'Moderat-baix', 4: 'Moderat', 5: 'Alt', 6: 'Molt alt', 7: 'Màxim' };
const PROFILE_LABEL: Record<string, string> = { conservador: 'Conservador', moderat: 'Moderat', dinamic: 'Dinàmic', agressiu: 'Agressiu' };

function assetReturn(a: ManualAsset) { return a.historicalReturn5Y ?? RISK_RETURN[a.risk] ?? 5; }
function assetVol(a: ManualAsset)    { return a.historicalVolatility ?? RISK_VOL[a.risk] ?? 8; }

// ─── Header / Footer ─────────────────────────────────────────────────────────

function Header({ section, client }: { section: string; client: string }) {
  return (
    <View style={S.header} fixed>
      <View style={S.headerLogo}>
        <Text style={S.headerLogoFactor}>FACTOR</Text>
        <Text style={S.headerLogoOTC}> OTC</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Text style={S.headerRight}>{client}</Text>
        <Text style={[S.headerRight, { color: C.gray }]}>·</Text>
        <Text style={S.headerRight}>{section}</Text>
      </View>
    </View>
  );
}

function Footer({ label }: { label?: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>{label ?? 'Factor OTC · Informe Manual Admin · Confidencial'}</Text>
      <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

// ─── Page 1: Cover ───────────────────────────────────────────────────────────

function CoverPage({ d, generatedAt }: { d: ManualPortfolioInput; generatedAt: string }) {
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;
  const weightedReturn = d.assets.reduce((s, a) => s + (a.weight / 100) * assetReturn(a), 0);
  const weightedTER    = d.assets.reduce((s, a) => s + (a.weight / 100) * a.ter, 0);
  const netReturn      = Math.max(0, weightedReturn - weightedTER);
  const pBase = projection(d.initialAmount, d.monthlyAmount, netReturn, d.horizon);

  return (
    <Page size="A4" style={S.coverPage}>
      {/* Gold left bar */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: C.gold }} />

      <View style={{ flex: 1, paddingHorizontal: 55, paddingTop: 60 }}>

        {/* Logo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 60 }}>
          <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 3 }}>FACTOR</Text>
          <Text style={{ fontSize: 18, color: C.gold, letterSpacing: 4, marginLeft: 6 }}>OTC</Text>
        </View>

        {/* Badge */}
        <View style={{ backgroundColor: 'rgba(201,168,76,0.15)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)', padding: '5 12', borderRadius: 4, alignSelf: 'flex-start', marginBottom: 24 }}>
          <Text style={{ fontSize: 7, color: C.gold, letterSpacing: 2, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>Informe Manual Admin · Confidencial</Text>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 38, fontFamily: 'Helvetica-Bold', color: C.white, lineHeight: 1.15, marginBottom: 10 }}>
          {d.clientName}
        </Text>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 40 }}>
          {profileLabel} · {d.objective}
        </Text>

        {/* 4 stat cards */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 40 }}>
          {[
            { label: 'Capital inicial',  value: fEur(d.initialAmount) },
            { label: 'Aportació/mes',    value: fEur(d.monthlyAmount) },
            { label: 'Horitzó',          value: `${d.horizon} anys` },
            { label: 'Projecció base',   value: fEur(pBase) },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', padding: 14, borderRadius: 3 }}>
              <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>{s.label}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white }}>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* Horizontal rule */}
        <View style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 16 }} />

        {/* Meta */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{d.clientEmail}</Text>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>Generat el {generatedAt}</Text>
        </View>

      </View>
    </Page>
  );
}

// ─── Page 2: Financial Summary ───────────────────────────────────────────────

function FinancialSummaryPage({ d }: { d: ManualPortfolioInput }) {
  // Estimate income/expenses if not provided
  const estIncome   = Math.round(d.monthlyAmount / 0.095);
  const fixedExp    = Math.round(estIncome * 0.386);
  const varExp      = Math.round(estIncome * 0.210);

  const income      = d.monthlyIncome   ?? estIncome;
  const expenses    = d.monthlyExpenses ?? (fixedExp + varExp);
  const surplus     = income - expenses - d.monthlyAmount;
  const isEstimated = !d.monthlyIncome || !d.monthlyExpenses;

  const weightedReturn = d.assets.reduce((s, a) => s + (a.weight / 100) * assetReturn(a), 0);
  const weightedTER    = d.assets.reduce((s, a) => s + (a.weight / 100) * a.ter, 0);
  const netReturn      = Math.max(0, weightedReturn - weightedTER);
  const totalInvested  = d.initialAmount + d.monthlyAmount * d.horizon * 12;

  const pPess = projection(d.initialAmount, d.monthlyAmount, Math.max(0, netReturn - 2), d.horizon);
  const pBase = projection(d.initialAmount, d.monthlyAmount, netReturn,                   d.horizon);
  const pOpt  = projection(d.initialAmount, d.monthlyAmount, netReturn + 2,               d.horizon);

  const scenarios = [
    { label: 'Pessimista', value: fEur(pPess), rate: `${Math.max(0, netReturn - 2).toFixed(1)}%`, gain: fEur(pPess - totalInvested), color: C.red },
    { label: 'Base',       value: fEur(pBase), rate: `${netReturn.toFixed(1)}%`,                  gain: fEur(pBase - totalInvested), color: C.gold },
    { label: 'Optimista',  value: fEur(pOpt),  rate: `${(netReturn + 2).toFixed(1)}%`,            gain: fEur(pOpt  - totalInvested), color: C.green2 },
  ];

  return (
    <Page size="A4" style={S.page}>
      <Header section="Situació Financera" client={d.clientName} />
      <Footer />

      <View style={S.body}>
        <Text style={S.tag}>SITUACIÓ FINANCERA</Text>
        <Text style={S.h2}>Situació financera del client</Text>
        {isEstimated ? (
          <Text style={[S.body2, { color: C.gray, marginBottom: 10, fontFamily: 'Helvetica-Oblique' }]}>
            * Valors estimats a partir de l&apos;aportació mensual. L&apos;admin pot introduir dades reals al formulari.
          </Text>
        ) : null}

        {/* 3 metric boxes: income / expenses / surplus */}
        <View style={[S.row, { marginBottom: 16 }]}>
          <View style={[S.metricBox, { borderTopWidth: 3, borderTopColor: C.green2 }]}>
            <Text style={S.metricLabel}>Ingressos mensuals nets</Text>
            <Text style={[S.metricValue, { color: C.green2 }]}>{fEur(income)}</Text>
            <Text style={S.metricSub}>{isEstimated ? 'Estimat' : 'Introduït per admin'}</Text>
          </View>
          <View style={[S.metricBox, { borderTopWidth: 3, borderTopColor: C.red }]}>
            <Text style={S.metricLabel}>Despeses mensuals</Text>
            <Text style={[S.metricValue, { color: C.red }]}>{fEur(expenses)}</Text>
            <Text style={S.metricSub}>{isEstimated ? 'Estimat' : 'Introduït per admin'}</Text>
          </View>
          <View style={[S.metricBox, { borderTopWidth: 3, borderTopColor: surplus >= 0 ? C.gold : C.red }]}>
            <Text style={S.metricLabel}>Excedent mensual</Text>
            <Text style={[S.metricValue, { color: surplus >= 0 ? C.gold : C.red }]}>{fEur(Math.abs(surplus))}</Text>
            <Text style={S.metricSub}>{surplus >= 0 ? 'Disponible post-aportació' : 'Dèficit mensual'}</Text>
          </View>
        </View>

        <View style={S.divider} />

        {/* Scenario cards preview */}
        <Text style={S.tag}>PROJECCIÓ A {d.horizon} ANYS · RESUM</Text>
        <Text style={[S.h2, { marginBottom: 8 }]}>Escenaris de rendiment (avanç)</Text>
        <Text style={[S.body2, { marginBottom: 10 }]}>
          Capital inicial {fEur(d.initialAmount)} + {fEur(d.monthlyAmount)}/mes durant {d.horizon} anys. Total aportat: {fEur(totalInvested)}.
        </Text>

        <View style={S.row}>
          {scenarios.map(sc => (
            <View key={sc.label} style={[S.metricBox, { borderTopWidth: 3, borderTopColor: sc.color }]}>
              <Text style={[S.metricLabel, { color: sc.color }]}>{sc.label}</Text>
              <Text style={[S.metricValue, { fontSize: 15, color: sc.color }]}>{sc.value}</Text>
              <Text style={S.metricSub}>Rendiment: {sc.rate} · Guany: {sc.gain}</Text>
            </View>
          ))}
        </View>

        <Text style={[S.body2, { marginTop: 6, color: C.gray, fontFamily: 'Helvetica-Oblique' }]}>
          Veure Secció D per a l&apos;anàlisi completa de projeccions i costos.
        </Text>
      </View>
    </Page>
  );
}

// ─── Page 3: Client profile + Allocation ─────────────────────────────────────

function ProfilePage({ d }: { d: ManualPortfolioInput }) {
  const profileLabel = PROFILE_LABEL[d.investorProfile] ?? d.investorProfile;
  const weightedReturn = d.assets.reduce((s, a) => s + (a.weight / 100) * assetReturn(a), 0);
  const weightedVol    = d.assets.reduce((s, a) => s + (a.weight / 100) * assetVol(a), 0);
  const weightedTER    = d.assets.reduce((s, a) => s + (a.weight / 100) * a.ter, 0);
  const weightedRisk   = d.assets.reduce((s, a) => s + (a.weight / 100) * a.risk, 0);
  const netReturn      = Math.max(0, weightedReturn - weightedTER);
  const riskLabel      = RISK_LABEL[Math.round(weightedRisk)] ?? 'Moderat';

  return (
    <Page size="A4" style={S.page}>
      <Header section="Perfil i Assignació" client={d.clientName} />
      <Footer />

      <View style={S.body}>
        <Text style={S.tag}>SECCIÓ A</Text>
        <Text style={S.h2}>Perfil del client</Text>

        {/* Client data grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {[
            ['Nom',             d.clientName],
            ['Email',           d.clientEmail],
            ['Perfil',          profileLabel],
            ['Objectiu',        d.objective],
            ['Horitzó',         `${d.horizon} anys`],
            ['Capital inicial', fEur(d.initialAmount)],
            ['Aportació/mes',   fEur(d.monthlyAmount)],
            ['Actius seleccionats', `${d.assets.length}`],
          ].map(([k, v]) => (
            <View key={k} style={{ width: '47%', flexDirection: 'row', marginBottom: 4 }}>
              <Text style={[S.body2, { width: 90, flexShrink: 0 }]}>{k}</Text>
              <Text style={[S.body1, { flex: 1 }]}>{v}</Text>
            </View>
          ))}
        </View>

        {d.adminNote ? (
          <View style={[S.legalBox, { marginBottom: 16 }]}>
            <Text style={[S.legalText, { fontFamily: 'Helvetica-Bold', marginBottom: 3 }]}>Notes internes:</Text>
            <Text style={S.legalText}>{d.adminNote}</Text>
          </View>
        ) : null}

        <View style={S.divider} />

        <Text style={S.tag}>SECCIÓ B</Text>
        <Text style={S.h2}>Assignació d&apos;actius</Text>

        {/* Allocation bar (simulated with colored rectangles) */}
        <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 12 }}>
          {d.assets.map((a, i) => (
            <View key={a.isin} style={{ flex: a.weight, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
          ))}
        </View>

        {/* Legend grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {d.assets.map((a, i) => (
            <View key={a.isin} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, width: '30%' }}>
              <View style={{ width: 7, height: 7, borderRadius: 3, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
              <Text style={[S.body2, { flex: 1 }]}>{a.name.length > 20 ? a.name.slice(0, 20) + '…' : a.name}</Text>
              <Text style={[S.body1, S.bold]}>{a.weight}%</Text>
            </View>
          ))}
        </View>

        <View style={S.divider} />

        {/* 4 summary metrics */}
        <View style={S.row}>
          {[
            { label: 'Rendiment estimat net',  value: `${netReturn.toFixed(1)}%`, sub: 'anual ponderat' },
            { label: 'Volatilitat estimada',   value: `${weightedVol.toFixed(1)}%`, sub: 'anual' },
            { label: 'TER mig ponderat',       value: `${weightedTER.toFixed(2)}%`, sub: 'cost anual' },
            { label: 'Risc SRRI ponderat',     value: riskLabel, sub: `${weightedRisk.toFixed(1)}/7` },
          ].map(m => (
            <View key={m.label} style={S.metricBox}>
              <Text style={S.metricLabel}>{m.label}</Text>
              <Text style={S.metricValue}>{m.value}</Text>
              <Text style={S.metricSub}>{m.sub}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

// ─── Page 3: Asset table ──────────────────────────────────────────────────────

function AssetsPage({ d }: { d: ManualPortfolioInput }) {
  const weightedTER = d.assets.reduce((s, a) => s + (a.weight / 100) * a.ter, 0);

  return (
    <Page size="A4" style={S.page}>
      <Header section="Detall d'Actius" client={d.clientName} />
      <Footer />

      <View style={S.body}>
        <Text style={S.tag}>SECCIÓ C</Text>
        <Text style={S.h2}>Composició detallada de la cartera</Text>

        {/* Table header */}
        <View style={S.tableHead}>
          <Text style={[S.th, { flex: 3 }]}>Nom / ISIN</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'right' }]}>Pes</Text>
          <Text style={[S.th, { flex: 2 }]}>Categoria</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'center' }]}>SRRI</Text>
          <Text style={[S.th, { flex: 1, textAlign: 'right' }]}>TER</Text>
          <Text style={[S.th, { flex: 2 }]}>Plataforma</Text>
        </View>

        {d.assets.map((a, i) => (
          <View key={a.isin} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
            <View style={{ flex: 3 }}>
              <Text style={S.td}>{a.name}</Text>
              <Text style={[S.tdGray, { fontSize: 6.5, fontFamily: 'Helvetica' }]}>{a.isin}</Text>
            </View>
            <Text style={[S.td, S.bold, { flex: 1, textAlign: 'right', color: ASSET_COLORS[i % ASSET_COLORS.length] }]}>{a.weight}%</Text>
            <Text style={[S.tdGray, { flex: 2 }]}>{a.category}</Text>
            <Text style={[S.td, { flex: 1, textAlign: 'center' }]}>{a.risk}/7</Text>
            <Text style={[S.td, { flex: 1, textAlign: 'right' }]}>{a.ter.toFixed(2)}%</Text>
            <Text style={[S.tdGray, { flex: 2 }]}>{a.platform}</Text>
          </View>
        ))}

        {/* TER footer */}
        <View style={{ flexDirection: 'row', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.dark, marginTop: 4 }}>
          <Text style={[S.body2, { flex: 3 }]}>TER mig ponderat</Text>
          <Text style={[S.td, S.bold, { textAlign: 'right' }]}>{weightedTER.toFixed(2)}% anual</Text>
        </View>

        <View style={S.divider} />

        {/* Justification block per asset */}
        <Text style={[S.tag, { marginBottom: 8 }]}>JUSTIFICACIÓ PER ACTIU</Text>
        {d.assets.filter(a => a.justification).map((a, i) => (
          <View key={a.isin} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
              <Text style={[S.body1, S.bold]}>{a.name} ({a.weight}%)</Text>
            </View>
            <Text style={S.body2}>{a.justification}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
}

// ─── Page 4: Projections + costs + risks ─────────────────────────────────────

function ProjectionsPage({ d }: { d: ManualPortfolioInput }) {
  const weightedReturn = d.assets.reduce((s, a) => s + (a.weight / 100) * assetReturn(a), 0);
  const weightedTER    = d.assets.reduce((s, a) => s + (a.weight / 100) * a.ter, 0);
  const netReturn      = Math.max(0, weightedReturn - weightedTER);
  const totalInvested  = d.initialAmount + d.monthlyAmount * d.horizon * 12;

  const pPess = projection(d.initialAmount, d.monthlyAmount, Math.max(0, netReturn - 2), d.horizon);
  const pBase = projection(d.initialAmount, d.monthlyAmount, netReturn,                   d.horizon);
  const pOpt  = projection(d.initialAmount, d.monthlyAmount, netReturn + 2,               d.horizon);

  const scenarios = [
    { label: 'Pessimista',  value: fEur(pPess), rate: `${Math.max(0, netReturn - 2).toFixed(1)}%`, gain: fEur(pPess - totalInvested), color: C.red },
    { label: 'Base',        value: fEur(pBase), rate: `${netReturn.toFixed(1)}%`,                  gain: fEur(pBase - totalInvested), color: C.gold },
    { label: 'Optimista',   value: fEur(pOpt),  rate: `${(netReturn + 2).toFixed(1)}%`,            gain: fEur(pOpt  - totalInvested), color: C.green2 },
  ];

  const annualTER = d.initialAmount * (weightedTER / 100);
  const totalTER  = totalInvested * (weightedTER / 100) * d.horizon;

  return (
    <Page size="A4" style={S.page}>
      <Header section="Projeccions i Costos" client={d.clientName} />
      <Footer />

      <View style={S.body}>
        <Text style={S.tag}>SECCIÓ D — PROJECCIÓ A {d.horizon} ANYS</Text>
        <Text style={S.h2}>Escenaris de rendiment</Text>

        <Text style={S.body2}>Capital inicial: {fEur(d.initialAmount)} · Aportació mensual: {fEur(d.monthlyAmount)} · Total invertit: {fEur(totalInvested)}</Text>

        <View style={[S.row, { marginTop: 10 }]}>
          {scenarios.map(sc => (
            <View key={sc.label} style={[S.metricBox, { borderTopWidth: 3, borderTopColor: sc.color }]}>
              <Text style={[S.metricLabel, { color: sc.color }]}>{sc.label}</Text>
              <Text style={[S.metricValue, { fontSize: 16, color: sc.color }]}>{sc.value}</Text>
              <Text style={S.metricSub}>Rendiment anual: {sc.rate}</Text>
              <Text style={[S.metricSub, { marginTop: 3 }]}>Guany estimat: {sc.gain}</Text>
            </View>
          ))}
        </View>

        <Text style={[S.body2, { marginTop: 4 }]}>
          Projecció estimada basada en rendiments ponderats dels actius seleccionats. Rendiments passats no garanteixen rendiments futurs.
        </Text>

        <View style={S.divider} />

        <Text style={S.tag}>SECCIÓ E — ANÀLISI DE COSTOS</Text>
        <Text style={S.h2}>Impacte del TER</Text>

        <View style={S.row}>
          {[
            { label: 'TER mig ponderat', value: `${weightedTER.toFixed(2)}%`, sub: 'cost anual total' },
            { label: 'Cost anual estimat', value: fEur(annualTER), sub: 'sobre capital inicial' },
            { label: 'Cost total estimat', value: fEur(totalTER), sub: `en ${d.horizon} anys` },
          ].map(m => (
            <View key={m.label} style={S.metricBox}>
              <Text style={S.metricLabel}>{m.label}</Text>
              <Text style={S.metricValue}>{m.value}</Text>
              <Text style={S.metricSub}>{m.sub}</Text>
            </View>
          ))}
        </View>

        <View style={S.divider} />

        <Text style={S.tag}>SECCIÓ F — RISCOS I RECOMANACIONS</Text>
        <Text style={S.h2}>Factors de risc</Text>

        {[
          'Risc de mercat: les valoracions poden fluctuar significativament a curt i mig termini.',
          'Risc de divisa: actius en divises estrangeres presenten exposició a variacions del tipus de canvi.',
          'Risc de liquiditat: alguns actius poden tenir menor liquiditat en moments de tensions de mercat.',
          'Risc de concentració: una assignació poc diversificada per sector o geografia amplifica la volatilitat.',
          'Risc regulatori: canvis normatius (MiFID, SFDR, fiscalitat) poden afectar la rendibilitat neta.',
        ].map((risk, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 5 }}>
            <Text style={[S.body2, { color: C.red, fontFamily: 'Helvetica-Bold' }]}>▸</Text>
            <Text style={S.body2}>{risk}</Text>
          </View>
        ))}

        <View style={S.divider} />

        <View style={S.row}>
          <View style={{ flex: 1 }}>
            <Text style={[S.body2, S.bold, { marginBottom: 4 }]}>Recomanacions operatives</Text>
            {[
              'Revisió semestral de la cartera i rebalanceig si cal.',
              "Diversificació geogràfica i sectorial adequada al perfil d'inversor.",
              "Manteniment de liquiditat d'emergència fora de la cartera.",
              'Inversió sistemàtica per aprofitar el cost mitjà (DCA).',
            ].map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 4 }}>
                <Text style={[S.body2, { color: C.green2, fontFamily: 'Helvetica-Bold' }]}>✓</Text>
                <Text style={S.body2}>{r}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={S.legalBox}>
          <Text style={[S.legalText, S.bold]}>Avís legal · Disclaimer</Text>
          <Text style={S.legalText}>
            Aquest informe ha estat creat per l&apos;equip de Factor OTC amb finalitat exclusivament orientativa i educativa. No constitueix assessorament financer personalitzat regulat ni recomanació d&apos;inversió. Factor OTC no és una entitat financera regulada per la CNMV o equivalent. Els rendiments estimats es basen en models estadístics i dades historials que no garanteixen resultats futurs. Inversió implica risc de pèrdua total o parcial del capital invertit. Consulta un assessor financer regulat abans de prendre decisions d&apos;inversió.
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── Document ─────────────────────────────────────────────────────────────────

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
      producer="@react-pdf/renderer">
      <CoverPage d={data} generatedAt={generatedAt} />
      <FinancialSummaryPage d={data} />
      <ProfilePage d={data} />
      <AssetsPage d={data} />
      <ProjectionsPage d={data} />
    </Document>
  );
}
