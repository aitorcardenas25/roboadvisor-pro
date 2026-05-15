// components/pdf/FactorOTCReport.tsx
import {
  Document, Page, Text, View, StyleSheet, Image,
} from '@react-pdf/renderer';
import {
  ScoringResult, getProfileLabel, getProfileDescription,
  InvestorQuestionnaire,
} from '@/lib/scoring';
import { Portfolio }        from '@/lib/portfolio';
import { PortfolioMetrics } from '@/lib/metrics';
import { MonteCarloResult, formatMonteCarloValue } from '@/lib/monteCarlo';
import { FinancialReport, InvestmentPolicyStatement, SuitabilityReport } from '@/lib/report';
import { HistoricalChartPoint } from '@/lib/metrics';
import type { SuitabilityStatus } from '@/lib/suitability';

// ─── COLORS ──────────────────────────────────────────────────────────────────
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

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  // Pàgines
  page: {
    backgroundColor: C.white,
    fontFamily:      'Helvetica',
    paddingBottom:   55,
  },
  coverPage: {
    backgroundColor: C.green,
    fontFamily:      'Helvetica',
  },

  // Header fix
  header: {
    paddingHorizontal: 45,
    paddingTop:        28,
    paddingBottom:     14,
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    borderBottomWidth: 0.5,
    borderBottomColor: C.grayLight,
  },
  headerLogo:       { flexDirection: 'row', alignItems: 'center' },
  headerLogoFactor: {
    fontSize: 9, fontFamily: 'Helvetica-Bold',
    color: C.dark, letterSpacing: 1.5,
  },
  headerLogoOTC: {
    fontSize: 9, color: C.gold, letterSpacing: 1.5,
  },
  headerRight: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  headerClient: {
    fontSize: 7, color: C.gray,
    fontFamily: 'Helvetica-Bold', letterSpacing: 1,
  },
  headerDot: {
    fontSize: 7, color: C.grayLight,
  },
  headerSection: {
    fontSize: 7.5, color: C.gray,
    letterSpacing: 1.5,
  },

  // Footer fix
  footer: {
    position:       'absolute',
    bottom:         20,
    left:           45,
    right:          45,
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    borderTopWidth: 0.5,
    borderTopColor: C.grayLight,
    paddingTop:     8,
  },
  footerText: { fontSize: 6.5, color: C.gray },
  footerPage: { fontSize: 6.5, color: C.gray },

  // Cos
  body: { paddingHorizontal: 45, paddingTop: 20 },

  // Seccions
  sectionTag: {
    fontSize: 7, color: C.gold,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2, marginBottom: 3,
  },
  sectionTitle: {
    fontSize: 20, fontFamily: 'Helvetica-Bold',
    color: C.dark, marginBottom: 3,
  },
  sectionDivider: {
    height:          0.5,
    backgroundColor: C.grayLight,
    marginBottom:    16,
    marginTop:       6,
  },

  // Cards
  card: {
    borderWidth:     0.5,
    borderColor:     C.grayLight,
    padding:         14,
    marginBottom:    10,
    backgroundColor: C.white,
  },
  cardGold: {
    borderLeftWidth:   3,
    borderLeftColor:   C.gold,
    borderTopWidth:    0.5,
    borderTopColor:    C.grayLight,
    borderRightWidth:  0.5,
    borderRightColor:  C.grayLight,
    borderBottomWidth: 0.5,
    borderBottomColor: C.grayLight,
    padding:           14,
    marginBottom:      10,
    backgroundColor:   C.goldLight,
  },
  cardGreen: {
    backgroundColor: C.green,
    padding:         18,
    marginBottom:    12,
  },
  cardLabel: {
    fontSize: 6.5, color: C.gray,
    letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 5,
  },
  cardValue: {
    fontSize: 20, fontFamily: 'Helvetica-Bold',
    color: C.dark, marginBottom: 2,
  },
  cardSub: { fontSize: 8, color: C.gray, fontStyle: 'italic' },

  // Row helpers
  row:  { flexDirection: 'row', gap: 10, marginBottom: 10 },
  col:  { flex: 1 },
  col2: { flex: 2 },
  col3: { flex: 3 },

  // Text
  body1: { fontSize: 9, color: C.dark, lineHeight: 1.65, marginBottom: 8 },
  body2: { fontSize: 8.5, color: C.gray, lineHeight: 1.65, marginBottom: 6 },
  bold:  { fontFamily: 'Helvetica-Bold' },

  // Taules
  table:         { marginBottom: 14 },
  tableHead:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.dark, paddingBottom: 5, marginBottom: 3 },
  tableHeadCell: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.dark, letterSpacing: 1, textTransform: 'uppercase' },
  tableRow:      { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.grayLight, paddingVertical: 6 },
  tableRowAlt:   { backgroundColor: C.offWhite },
  tableCell:     { fontSize: 8, color: C.dark },
  tableCellGray: { fontSize: 8, color: C.gray },

  // Mètriques grid
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  metricBox: {
    width: '31.5%', borderWidth: 0.5,
    borderColor: C.grayLight, padding: 10,
    backgroundColor: C.white,
  },
  metricLabel: { fontSize: 6.5, color: C.gray, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  metricValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.dark },
  metricSub:   { fontSize: 6.5, color: C.gray, marginTop: 1 },

  // Barres progrés
  progressRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  progressLabel: { fontSize: 7.5, color: C.dark, width: 130 },
  progressTrack: { flex: 1, height: 4, backgroundColor: C.grayLight, marginHorizontal: 8, borderRadius: 2 },
  progressFill:  { height: 4, backgroundColor: C.gold, borderRadius: 2 },
  progressVal:   { fontSize: 7.5, color: C.gray, width: 35, textAlign: 'right' },

  // Legal
  legalBox: {
    borderWidth: 0.5, borderColor: C.grayLight,
    padding: 12, marginTop: 8, backgroundColor: C.offWhite,
  },
  legalTitle: {
    fontSize: 6.5, fontFamily: 'Helvetica-Bold',
    color: C.gray, letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 5,
  },
  legalText: { fontSize: 6.5, color: C.gray, lineHeight: 1.55 },

  // Imatge gràfic
  chartNote: { fontSize: 7, color: C.gray, fontStyle: 'italic', marginBottom: 10 },
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('ca-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

// ─── COMPONENTS REUTILITZABLES ────────────────────────────────────────────────

const PageHeader = ({
  section,
  clientName,
}: {
  section:     string;
  clientName?: string;
}) => (
  <View style={S.header} fixed>
    <View style={S.headerLogo}>
      <Text style={S.headerLogoFactor}>FACTOR</Text>
      <Text style={S.headerLogoOTC}> OTC</Text>
    </View>
    <View style={S.headerRight}>
      {clientName ? (
        <>
          <Text style={S.headerClient}>{clientName.toUpperCase()}</Text>
          <Text style={S.headerDot}>·</Text>
        </>
      ) : null}
      <Text style={S.headerSection}>{section}</Text>
    </View>
  </View>
);

const PageFooter = () => (
  <View style={S.footer} fixed>
    <Text style={S.footerText}>
      Factor OTC · Eina de suport a la decisió · No constitueix assessorament financer regulat
    </Text>
    <Text style={S.footerPage}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>
);

const SectionHeader = ({ tag, title }: { tag: string; title: string }) => (
  <View>
    <Text style={S.sectionTag}>{tag}</Text>
    <Text style={S.sectionTitle}>{title}</Text>
    <View style={S.sectionDivider} />
  </View>
);

const MetricBox = ({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) => (
  <View style={S.metricBox}>
    <Text style={S.metricLabel}>{label}</Text>
    <Text style={[S.metricValue, color ? { color } : {}]}>{value}</Text>
    {sub && <Text style={S.metricSub}>{sub}</Text>}
  </View>
);

const ProgressBar = ({ label, value, max = 100 }: {
  label: string; value: number; max?: number;
}) => (
  <View style={S.progressRow}>
    <Text style={S.progressLabel}>{label}</Text>
    <View style={S.progressTrack}>
      <View style={[S.progressFill, { width: `${Math.min(100, (value / max) * 100)}%` }]} />
    </View>
    <Text style={S.progressVal}>{value}/{max}</Text>
  </View>
);

const GoldCard = ({ label, value, sub }: {
  label: string; value: string; sub?: string;
}) => (
  <View style={S.cardGold}>
    <Text style={S.cardLabel}>{label}</Text>
    <Text style={[S.cardValue, { color: C.dark }]}>{value}</Text>
    {sub && <Text style={S.cardSub}>{sub}</Text>}
  </View>
);

// ─── PÀGINA 1: PORTADA ────────────────────────────────────────────────────────

const CoverPage = ({
  scoring,
  report,
  questionnaire,
}: {
  scoring:       ScoringResult;
  report:        FinancialReport;
  questionnaire: InvestorQuestionnaire;
}) => (
  <Page size="A4" style={S.coverPage}>
    <View style={{ flex: 1, padding: 50, justifyContent: 'space-between' }}>

      {/* Logo */}
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 20, height: 20,
            borderWidth: 1, borderColor: C.gold,
            transform: 'rotate(45deg)',
            marginRight: 10,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <View style={{ width: 8, height: 8, backgroundColor: C.gold }} />
          </View>
          <Text style={{
            fontSize: 13, fontFamily: 'Helvetica-Bold',
            color: C.white, letterSpacing: 2,
          }}>
            FACTOR
          </Text>
          <Text style={{ fontSize: 13, color: C.gold, letterSpacing: 2, marginLeft: 4 }}>
            OTC
          </Text>
        </View>

        {/* Línia daurada */}
        <View style={{
          height: 0.5, backgroundColor: C.gold,
          marginTop: 14, marginBottom: 50, opacity: 0.5,
        }} />

        {/* Títol */}
        <Text style={{
          fontSize: 50, color: C.white,
          fontFamily: 'Helvetica', lineHeight: 1.0, marginBottom: 6,
        }}>
          Informe Financer
        </Text>
        <Text style={{
          fontSize: 50, color: C.white,
          fontFamily: 'Helvetica-Bold', lineHeight: 1.0,
        }}>
          Personalitzat
        </Text>
      </View>

      {/* Grid decoratiu dreta */}
      <View style={{
        position: 'absolute', right: 0, top: 0,
        bottom: 0, width: 200, opacity: 0.05,
      }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={i} style={{ flexDirection: 'row', flex: 1 }}>
            {Array.from({ length: 4 }).map((_, j) => (
              <View key={j} style={{
                flex: 1, borderWidth: 0.5, borderColor: C.gold,
              }} />
            ))}
          </View>
        ))}
      </View>

      {/* Perfil badge */}
      <View style={{ marginBottom: 30 }}>
        <View style={{
          borderWidth: 0.5, borderColor: `${C.gold}60`,
          padding: 16, backgroundColor: `${C.gold}10`,
          marginBottom: 20,
        }}>
          <Text style={{
            fontSize: 7, color: C.gold,
            letterSpacing: 2, marginBottom: 6,
          }}>
            PERFIL INVERSOR DETERMINAT
          </Text>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Text style={{
              fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.white,
            }}>
              {getProfileLabel(scoring.profile).toUpperCase()}
            </Text>
            <Text style={{
              fontSize: 36, fontFamily: 'Helvetica-Bold', color: C.gold,
            }}>
              {scoring.scorePercentage}%
            </Text>
          </View>
        </View>
      </View>

      {/* Footer portada — AMB NOM DEL CLIENT */}
      <View>
        <View style={{
          height: 0.5, backgroundColor: C.gold,
          opacity: 0.3, marginBottom: 14,
        }} />
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}>
          <View>
            <Text style={{
              fontSize: 9, color: C.gold, opacity: 0.7, marginBottom: 4,
            }}>
              {report.metadata.generatedDate.toUpperCase()}
            </Text>
            {questionnaire.clientName ? (
              <Text style={{
                fontSize: 16, fontFamily: 'Helvetica-Bold',
                color: C.white, letterSpacing: 1.5,
              }}>
                {questionnaire.clientName.toUpperCase()}
              </Text>
            ) : null}
          </View>
          <Text style={{
            fontSize: 9, fontFamily: 'Helvetica-Bold',
            color: C.white, opacity: 0.6, letterSpacing: 1.5,
          }}>
            INFORME FINANCER PERSONALITZAT
          </Text>
        </View>
      </View>
    </View>
  </Page>
);

// ─── PÀGINA 2: RESUM EXECUTIU ─────────────────────────────────────────────────

const ExecutivePage = ({
  questionnaire, scoring, portfolio, monteCarlo,
}: {
  questionnaire: InvestorQuestionnaire;
  scoring:       ScoringResult;
  portfolio:     Portfolio;
  monteCarlo:    MonteCarloResult;
}) => {
  const investable    = questionnaire.currentSavings * questionnaire.percentageToInvest / 100;
  const monthlyIncome = questionnaire.annualIncome / 12;
  const savingsRate   = monthlyIncome > 0
    ? Math.max(0, ((monthlyIncome - questionnaire.monthlyExpenses) / monthlyIncome) * 100)
    : 0;

  return (
    <Page size="A4" style={S.page}>
      <PageHeader section="RESUM EXECUTIU" clientName={questionnaire.clientName} />
      <View style={S.body}>
        <SectionHeader tag="1." title="RESUM EXECUTIU" />

        <Text style={S.body1}>
          A continuació es detalla l'estructuració òptima del pla d'inversió basat en el perfil{' '}
          <Text style={S.bold}>{getProfileLabel(scoring.profile)}</Text> determinat pel
          qüestionari de perfilació i els objectius financers establerts.
        </Text>

        {/* 3 cards principals */}
        <View style={S.row}>
          <View style={[S.card, S.col]}>
            <Text style={S.cardLabel}>Viure • Despeses mensuals</Text>
            <Text style={S.cardValue}>{fmt(questionnaire.monthlyExpenses)}</Text>
            <Text style={S.cardSub}>{savingsRate.toFixed(1)}% del flux mensual</Text>
          </View>
          <View style={[S.card, S.col]}>
            <Text style={S.cardLabel}>Protegir • Reserva</Text>
            <Text style={S.cardValue}>
              {fmt(Math.max(0, questionnaire.currentSavings - investable))}
            </Text>
            <Text style={S.cardSub}>Capital no invertit</Text>
          </View>
          <View style={[S.card, S.col]}>
            <Text style={S.cardLabel}>Créixer • Aportació mensual</Text>
            <Text style={S.cardValue}>{fmt(questionnaire.monthlyContribution)}</Text>
            <Text style={S.cardSub}>Inversió recurrent</Text>
          </View>
        </View>

        {/* Capital total */}
        <GoldCard
          label="CAPITAL TOTAL D'ACUMULACIÓ A INVERTIR"
          value={fmt(investable)}
          sub={`${questionnaire.percentageToInvest}% dels estalvis actuals de ${fmt(questionnaire.currentSavings)}`}
        />

        {/* Taula flux financer */}
        <View style={[S.table, { marginTop: 10 }]}>
          <Text style={[S.sectionTag, { marginBottom: 8 }]}>
            ANÀLISI COMPARATIU DEL FLUX DE CAIXA
          </Text>
          <View style={S.tableHead}>
            <Text style={[S.tableHeadCell, { flex: 3 }]}>CONCEPTE</Text>
            <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>IMPORT</Text>
            <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>% INGRESSOS</Text>
          </View>
          {[
            { label: 'Ingressos mensuals',  value: monthlyIncome,                        pct: 100 },
            { label: 'Despeses mensuals',   value: questionnaire.monthlyExpenses,         pct: (questionnaire.monthlyExpenses / monthlyIncome) * 100 },
            { label: 'Aportació inversió',  value: questionnaire.monthlyContribution,     pct: (questionnaire.monthlyContribution / monthlyIncome) * 100 },
            {
              label: 'Excedent disponible',
              value: Math.max(0, monthlyIncome - questionnaire.monthlyExpenses - questionnaire.monthlyContribution),
              pct:   Math.max(0, ((monthlyIncome - questionnaire.monthlyExpenses - questionnaire.monthlyContribution) / monthlyIncome) * 100),
            },
          ].map((row, i) => (
            <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <Text style={[S.tableCell, { flex: 3 }]}>{row.label}</Text>
              <Text style={[S.tableCell, S.bold, { flex: 2, textAlign: 'right' }]}>
                {fmt(row.value)}
              </Text>
              <Text style={[S.tableCellGray, { flex: 2, textAlign: 'right' }]}>
                {isFinite(row.pct) ? `${row.pct.toFixed(1)}%` : '—'}
              </Text>
            </View>
          ))}
        </View>

        {/* Monte Carlo resum */}
        <Text style={[S.sectionTag, { marginBottom: 8, marginTop: 6 }]}>
          PROJECCIÓ PATRIMONIAL — {questionnaire.investmentHorizon} ANYS
        </Text>
        <View style={S.row}>
          <View style={[S.card, S.col, { borderColor: C.red }]}>
            <Text style={S.cardLabel}>Escenari pessimista (P10)</Text>
            <Text style={[S.cardValue, { color: C.red, fontSize: 16 }]}>
              {formatMonteCarloValue(monteCarlo.percentiles.p10)}
            </Text>
          </View>
          <View style={[S.card, S.col, { borderColor: C.gold }]}>
            <Text style={S.cardLabel}>Escenari central (P50)</Text>
            <Text style={[S.cardValue, { color: C.green, fontSize: 16 }]}>
              {formatMonteCarloValue(monteCarlo.percentiles.p50)}
            </Text>
          </View>
          <View style={[S.card, S.col, { borderColor: C.green2 }]}>
            <Text style={S.cardLabel}>Escenari optimista (P90)</Text>
            <Text style={[S.cardValue, { color: C.green2, fontSize: 16 }]}>
              {formatMonteCarloValue(monteCarlo.percentiles.p90)}
            </Text>
          </View>
        </View>

        <View style={[S.cardGold, { marginTop: 2 }]}>
          <Text style={[S.body1, { fontSize: 8, marginBottom: 0 }]}>
            <Text style={S.bold}>Nota:{' '}</Text>
            L'estructura presentada optimitza la distribució del flux de caixa per maximitzar
            l'acumulació de patrimoni. Els valors projectats són estimacions basades en{' '}
            {(monteCarlo.params.numSimulations ?? 1000).toLocaleString()} simulacions Monte Carlo
            i no garanteixen rendibilitats futures.
          </Text>
        </View>
      </View>
      <PageFooter />
    </Page>
  );
};

// ─── PÀGINA 3: PERFIL INVERSOR ────────────────────────────────────────────────

const ProfilePage = ({
  scoring, report, charts, questionnaire,
}: {
  scoring:       ScoringResult;
  report:        FinancialReport;
  charts:        Record<string, string>;
  questionnaire: InvestorQuestionnaire;
}) => (
  <Page size="A4" style={S.page}>
    <PageHeader section="PERFIL INVERSOR" clientName={questionnaire.clientName} />
    <View style={S.body}>
      <SectionHeader tag="2." title="PERFIL I SCORING DE L'INVERSOR" />

      {/* Perfil banner verd */}
      <View style={S.cardGreen}>
        <Text style={{ fontSize: 7, color: C.gold, letterSpacing: 2, marginBottom: 6 }}>
          PERFIL INVERSOR DETERMINAT
        </Text>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <View>
            <Text style={{
              fontSize: 26, fontFamily: 'Helvetica-Bold', color: C.white,
            }}>
              {getProfileLabel(scoring.profile).toUpperCase()}
            </Text>
            <Text style={{
              fontSize: 8, color: `${C.white}99`, marginTop: 4, maxWidth: 280,
            }}>
              {getProfileDescription(scoring.profile)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{
              fontSize: 42, fontFamily: 'Helvetica-Bold', color: C.gold,
            }}>
              {scoring.scorePercentage}%
            </Text>
            <Text style={{ fontSize: 7.5, color: `${C.white}80` }}>
              {scoring.totalScore} / {scoring.maxScore} punts
            </Text>
          </View>
        </View>
      </View>

      {/* Gràfics radar + scoring */}
      <View style={[S.row, { marginTop: 4 }]}>
        <View style={S.col}>
          <Text style={[S.sectionTag, { marginBottom: 6 }]}>RADAR DE PERFIL</Text>
          {charts['chart-radar'] ? (
            <Image src={charts['chart-radar']} style={{ width: '100%' }} />
          ) : (
            <View style={{
              height: 110, backgroundColor: C.grayBg,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 8, color: C.gray }}>Gràfic no disponible</Text>
            </View>
          )}
        </View>
        <View style={S.col}>
          <Text style={[S.sectionTag, { marginBottom: 6 }]}>PUNTUACIÓ PER DIMENSIÓ</Text>
          {charts['chart-scoring'] ? (
            <Image src={charts['chart-scoring']} style={{ width: '100%' }} />
          ) : null}
        </View>
      </View>

      {/* Desglossament */}
      <Text style={[S.sectionTag, { marginBottom: 8, marginTop: 4 }]}>
        DESGLOSSAMENT DE LA PUNTUACIÓ
      </Text>
      {report.investorProfile.scoreBreakdown.map((item, i) => (
        <ProgressBar key={i} label={item.dimension} value={item.score} max={item.maxScore} />
      ))}

      {/* Punts forts i avisos */}
      <View style={[S.row, { marginTop: 10 }]}>
        {scoring.strengths.length > 0 && (
          <View style={S.col}>
            <Text style={[S.sectionTag, { marginBottom: 6 }]}>PUNTS FORTS</Text>
            {scoring.strengths.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                <Text style={{ fontSize: 7.5, color: C.green2, marginRight: 5 }}>✓</Text>
                <Text style={[S.body2, { marginBottom: 0, flex: 1 }]}>{s}</Text>
              </View>
            ))}
          </View>
        )}
        {scoring.warnings.length > 0 && (
          <View style={S.col}>
            <Text style={[S.sectionTag, { marginBottom: 6 }]}>AVISOS A CONSIDERAR</Text>
            {scoring.warnings.map((w, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                <Text style={{ fontSize: 7.5, color: C.amber, marginRight: 5 }}>⚠</Text>
                <Text style={[S.body2, { marginBottom: 0, flex: 1 }]}>{w}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
    <PageFooter />
  </Page>
);

// ─── PÀGINA 4: DIAGNÒSTIC FINANCER ───────────────────────────────────────────

const DiagnosticsPage = ({
  questionnaire, scoring,
}: {
  questionnaire: InvestorQuestionnaire;
  scoring:       ScoringResult;
}) => {
  const d = scoring.diagnostics;

  return (
    <Page size="A4" style={S.page}>
      <PageHeader section="DIAGNÒSTIC FINANCER" clientName={questionnaire.clientName} />
      <View style={S.body}>
        <SectionHeader tag="3." title="DIAGNÒSTIC FINANCER PERSONAL" />

        <Text style={S.body1}>
          Anàlisi de la situació financera actual de{' '}
          <Text style={S.bold}>{questionnaire.clientName || 'el client'}</Text>{' '}
          basada en les dades facilitades al qüestionari de perfilació.
        </Text>

        {/* KPIs diagnòstic */}
        <View style={S.metricGrid}>
          <MetricBox label="Taxa d'estalvi"
            value={`${d.savingsRate.toFixed(1)}%`}
            sub={d.savingsRate >= 20 ? 'Excel·lent' : d.savingsRate >= 10 ? 'Acceptable' : 'Insuficient'}
            color={d.savingsRate >= 20 ? C.green2 : d.savingsRate >= 10 ? C.amber : C.red} />
          <MetricBox label="Fons d'emergència"
            value={`${d.emergencyFundMonths.toFixed(1)} m`}
            sub={d.emergencyFundMonths >= 6 ? 'Suficient' : d.emergencyFundMonths >= 3 ? 'Acceptable' : 'Insuficient'}
            color={d.emergencyFundMonths >= 6 ? C.green2 : d.emergencyFundMonths >= 3 ? C.amber : C.red} />
          <MetricBox label="Ràtio deute/ingressos"
            value={`${d.debtToIncomeRatio.toFixed(1)}%`}
            sub={d.debtToIncomeRatio <= 15 ? 'Baix' : d.debtToIncomeRatio <= 35 ? 'Moderat' : 'Elevat'}
            color={d.debtToIncomeRatio <= 15 ? C.green2 : d.debtToIncomeRatio <= 35 ? C.amber : C.red} />
          <MetricBox label="Patrimoni / Ingressos"
            value={`${d.netWorthToIncomeRatio.toFixed(1)}x`}
            sub="Ràtio patrimonial" />
          <MetricBox label="Capital a invertir"
            value={fmt(d.investableAmount)}
            sub={`${questionnaire.percentageToInvest}% dels estalvis`} />
          <MetricBox label="Viabilitat objectiu"
            value={`${d.feasibilityScore}/100`}
            sub={d.feasibilityScore >= 70 ? 'Alta' : d.feasibilityScore >= 40 ? 'Moderada' : 'Baixa'}
            color={d.feasibilityScore >= 70 ? C.green2 : d.feasibilityScore >= 40 ? C.amber : C.red} />
        </View>

        {/* Taula diagnòstic detallat */}
        <Text style={[S.sectionTag, { marginBottom: 8 }]}>DIAGNÒSTIC DETALLAT</Text>
        <View style={S.table}>
          <View style={S.tableHead}>
            <Text style={[S.tableHeadCell, { flex: 2 }]}>INDICADOR</Text>
            <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'center' }]}>VALOR</Text>
            <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'center' }]}>ESTAT</Text>
            <Text style={[S.tableHeadCell, { flex: 4 }]}>INTERPRETACIÓ</Text>
          </View>
          {[
            {
              label: 'Taxa d\'estalvi',
              value: `${d.savingsRate.toFixed(1)}%`,
              status: d.savingsRate >= 20 ? 'BON' : d.savingsRate >= 10 ? 'OK' : 'BAIX',
              color:  d.savingsRate >= 20 ? C.green2 : d.savingsRate >= 10 ? C.amber : C.red,
              note:   d.savingsRate >= 20
                ? 'Excel·lent. Tens una bona base per invertir.'
                : d.savingsRate >= 10
                ? 'Acceptable. Considera incrementar-la per accelerar objectius.'
                : 'Insuficient. Prioritza reduir despeses.',
            },
            {
              label: 'Fons d\'emergència',
              value: `${d.emergencyFundMonths.toFixed(1)} mesos`,
              status: d.emergencyFundMonths >= 6 ? 'BON' : d.emergencyFundMonths >= 3 ? 'OK' : 'BAIX',
              color:  d.emergencyFundMonths >= 6 ? C.green2 : d.emergencyFundMonths >= 3 ? C.amber : C.red,
              note:   d.emergencyFundMonths >= 6
                ? 'Suficient. Pots invertir amb tranquil·litat.'
                : d.emergencyFundMonths >= 3
                ? 'Acceptable. Considera reforçar fins a 6 mesos.'
                : 'Insuficient. Crea\'l abans d\'invertir.',
            },
            {
              label: 'Deute / Ingressos',
              value: `${d.debtToIncomeRatio.toFixed(1)}%`,
              status: d.debtToIncomeRatio <= 15 ? 'BON' : d.debtToIncomeRatio <= 35 ? 'OK' : 'ALT',
              color:  d.debtToIncomeRatio <= 15 ? C.green2 : d.debtToIncomeRatio <= 35 ? C.amber : C.red,
              note:   d.debtToIncomeRatio <= 15
                ? 'Nivell de deute molt baix. Situació financera sòlida.'
                : d.debtToIncomeRatio <= 35
                ? 'Deute moderat. Gestiona\'l paral·lelament a la inversió.'
                : 'Deute elevat. Considera prioritzar-ne la reducció.',
            },
            {
              label: 'Viabilitat objectiu',
              value: `${d.feasibilityScore}/100`,
              status: d.feasibilityScore >= 70 ? 'ALTA' : d.feasibilityScore >= 40 ? 'MOD.' : 'BAIXA',
              color:  d.feasibilityScore >= 70 ? C.green2 : d.feasibilityScore >= 40 ? C.amber : C.red,
              note:   d.feasibilityScore >= 70
                ? 'L\'objectiu és molt assolible amb les aportacions planificades.'
                : d.feasibilityScore >= 40
                ? 'L\'objectiu és assolible però requereix disciplina.'
                : 'L\'objectiu és ambiciós. Revisa l\'import o el termini.',
            },
          ].map((row, i) => (
            <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <Text style={[S.tableCell, S.bold, { flex: 2 }]}>{row.label}</Text>
              <Text style={[S.tableCell, { flex: 1, textAlign: 'center' }]}>{row.value}</Text>
              <Text style={[S.tableCell, S.bold, { flex: 1, textAlign: 'center', color: row.color }]}>
                {row.status}
              </Text>
              <Text style={[S.tableCellGray, { flex: 4, fontSize: 7.5 }]}>{row.note}</Text>
            </View>
          ))}
        </View>

        {/* Estratègia de seguretat patrimonial */}
        <Text style={[S.sectionTag, { marginBottom: 8, marginTop: 4 }]}>
          ESTRATÈGIA DE SEGURETAT PATRIMONIAL
        </Text>
        <View style={S.row}>
          <View style={[S.card, S.col]}>
            <Text style={S.cardLabel}>Objectiu fons d'emergència</Text>
            <Text style={[S.cardValue, { fontSize: 16 }]}>
              {fmt(questionnaire.monthlyExpenses * 6)}
            </Text>
            <Text style={S.cardSub}>6 mesos de despeses</Text>
          </View>
          <View style={[S.card, S.col]}>
            <Text style={S.cardLabel}>Capital actual disponible</Text>
            <Text style={[S.cardValue, { fontSize: 16 }]}>
              {fmt(questionnaire.currentSavings)}
            </Text>
            <Text style={S.cardSub}>Estalvis totals declarats</Text>
          </View>
          <View style={[S.card, S.col]}>
            <Text style={S.cardLabel}>Capital a invertir</Text>
            <Text style={[S.cardValue, { fontSize: 16, color: C.green }]}>
              {fmt(d.investableAmount)}
            </Text>
            <Text style={S.cardSub}>{questionnaire.percentageToInvest}% dels estalvis</Text>
          </View>
        </View>

        <View style={S.cardGold}>
          <Text style={[S.body1, { fontSize: 8, marginBottom: 0 }]}>
            <Text style={S.bold}>Recomanació:{' '}</Text>
            Abans de procedir amb la inversió, assegura't de tenir un fons d'emergència
            equivalent a un mínim de 3-6 mesos de despeses ({fmt(questionnaire.monthlyExpenses * 3)} —{' '}
            {fmt(questionnaire.monthlyExpenses * 6)}). Aquesta reserva no ha d'estar invertida
            en actius de risc, sinó en comptes remunertats o dipòsits de alta liquiditat.
          </Text>
        </View>
      </View>
      <PageFooter />
    </Page>
  );
};

// ─── PÀGINA 5: CARTERA ────────────────────────────────────────────────────────

const PortfolioPage = ({
  portfolio, questionnaire, charts,
}: {
  portfolio:     Portfolio;
  questionnaire: InvestorQuestionnaire;
  charts:        Record<string, string>;
}) => {
  const investable = questionnaire.currentSavings * questionnaire.percentageToInvest / 100;

  return (
    <Page size="A4" style={S.page}>
      <PageHeader section="COMPOSICIÓ DE LA CARTERA" clientName={questionnaire.clientName} />
      <View style={S.body}>
        <SectionHeader tag="4." title="COMPOSICIÓ DETALLADA DE LA CARTERA" />

        <Text style={S.body1}>
          Aplicant els principis de diversificació geogràfica i per classe d'actiu,
          s'ha definit la següent estructura de cartera per a{' '}
          <Text style={S.bold}>{fmt(investable)}</Text> d'inversió inicial.
        </Text>

        {/* Asset allocation gràfics */}
        <View style={S.row}>
          <View style={S.col}>
            <Text style={[S.sectionTag, { marginBottom: 6 }]}>
              DISTRIBUCIÓ PER CLASSE D'ACTIU
            </Text>
            {charts['chart-allocation'] ? (
              <Image src={charts['chart-allocation']} style={{ width: '100%' }} />
            ) : (
              <View style={{ height: 110, backgroundColor: C.grayBg }} />
            )}
          </View>
          <View style={S.col}>
            <Text style={[S.sectionTag, { marginBottom: 6 }]}>
              DISTRIBUCIÓ PER FONS (DONUT)
            </Text>
            {charts['chart-risk-donut'] ? (
              <Image src={charts['chart-risk-donut']} style={{ width: '100%' }} />
            ) : (
              <View style={{ height: 110, backgroundColor: C.grayBg }} />
            )}
          </View>
        </View>

        {/* Cards característiques */}
        <View style={S.row}>
          {[
            { label: 'Renda Variable',  value: `${portfolio.characteristics.equityWeight}%` },
            { label: 'Renda Fixa',      value: `${portfolio.characteristics.fixedIncomeWeight}%` },
            { label: 'Monetari/Cash',   value: `${portfolio.characteristics.cashWeight}%` },
            { label: 'TER Total',       value: `${portfolio.totalTER.toFixed(2)}%` },
          ].map((item, i) => (
            <View key={i} style={[S.card, S.col]}>
              <Text style={S.cardLabel}>{item.label}</Text>
              <Text style={[S.cardValue, { fontSize: 18 }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Taula fons */}
        <View style={S.table}>
          <View style={S.tableHead}>
            <Text style={[S.tableHeadCell, { flex: 4 }]}>VEHICLE D'INVERSIÓ</Text>
            <Text style={[S.tableHeadCell, { flex: 1.2, textAlign: 'center' }]}>PONDERACIÓ</Text>
            <Text style={[S.tableHeadCell, { flex: 1.2, textAlign: 'center' }]}>TER</Text>
            <Text style={[S.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>IMPORT</Text>
          </View>
          {portfolio.allocations.map((a, i) => (
            <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <View style={{ flex: 4 }}>
                <Text style={[S.tableCell, S.bold]}>{a.product.name}</Text>
                <Text style={[S.tableCellGray, { fontSize: 7 }]}>
                  {a.product.manager} · ISIN: {a.product.isin}
                </Text>
              </View>
              <Text style={[S.tableCell, S.bold, { flex: 1.2, textAlign: 'center' }]}>
                {a.weight}%
              </Text>
              <View style={{ flex: 1.2, alignItems: 'center' }}>
                <View style={{
                  borderWidth: 0.5, borderColor: C.grayLight,
                  paddingHorizontal: 5, paddingVertical: 1.5,
                }}>
                  <Text style={{ fontSize: 7, color: C.gray }}>
                    TER {a.product.ter.toFixed(2)}%
                  </Text>
                </View>
              </View>
              <Text style={[S.tableCell, S.bold, { flex: 1.5, textAlign: 'right' }]}>
                {fmt(a.amount)}
              </Text>
            </View>
          ))}
        </View>

        <View style={S.cardGold}>
          <Text style={[S.body1, { fontSize: 8, marginBottom: 0 }]}>
            <Text style={S.bold}>Optimització de costos:{' '}</Text>
            TER total ponderat del {portfolio.totalTER.toFixed(2)}%, per sota de la mitjana
            del mercat per a carteres diversificades similars (0,75-1,50%).
            Estil de gestió: {portfolio.characteristics.managementStyle.toLowerCase()}.
          </Text>
        </View>
      </View>
      <PageFooter />
    </Page>
  );
};

// ─── PÀGINA 6: IPS ────────────────────────────────────────────────────────────

const IPSPage = ({
  ips, questionnaire,
}: {
  ips:           InvestmentPolicyStatement;
  questionnaire: InvestorQuestionnaire;
}) => (
  <Page size="A4" style={S.page}>
    <PageHeader section="INVESTMENT POLICY STATEMENT" clientName={questionnaire.clientName} />
    <View style={S.body}>
      <SectionHeader tag="IPS" title="INVESTMENT POLICY STATEMENT" />

      <Text style={S.body2}>
        Document de política d'inversió MiFID II (Art. 54) · Versió {ips.version} · {new Date(ips.generatedAt).toLocaleDateString('ca-ES')}
      </Text>

      {ips.sections.map((section, i) => (
        <View key={i} style={{ marginBottom: 8 }}>
          <Text style={[S.sectionTag, { marginBottom: 3, fontSize: 6.5 }]}>
            {section.title.toUpperCase()}
          </Text>
          <Text style={[S.body2, { marginBottom: 0, fontSize: 8 }]}>
            {section.content}
          </Text>
        </View>
      ))}
    </View>
    <PageFooter />
  </Page>
);

// ─── PÀGINA 7: SUITABILITY MIFID II ──────────────────────────────────────────

const SuitabilityPage = ({
  suitability, questionnaire, charts,
}: {
  suitability:   SuitabilityReport;
  questionnaire: InvestorQuestionnaire;
  charts:        Record<string, string>;
}) => {
  const overallColor = (s: SuitabilityStatus) =>
    s === 'adequate'   ? C.green2 :
    s === 'borderline' ? C.amber  : C.red;

  const overallLabel = (s: SuitabilityStatus) =>
    s === 'adequate'   ? 'ADEQUAT (MiFID II complert)' :
    s === 'borderline' ? 'LÍMIT (Revisió recomanada)'  : 'NO ADEQUAT (Incompliment)';

  return (
    <Page size="A4" style={S.page}>
      <PageHeader section="ADEQUACIÓ MiFID II" clientName={questionnaire.clientName} />
      <View style={S.body}>
        <SectionHeader tag="MIFID II" title="ADEQUACIÓ I SUITABILITY (Art. 54)" />

        {/* Resultat global */}
        <View style={[S.cardGreen, { marginBottom: 12 }]}>
          <Text style={{ fontSize: 7, color: C.gold, letterSpacing: 2, marginBottom: 6 }}>
            RESULTAT GLOBAL SUITABILITY
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.white }}>
              {overallLabel(suitability.overall)}
            </Text>
            <Text style={{
              fontSize: 9, fontFamily: 'Helvetica-Bold',
              color: overallColor(suitability.overall),
            }}>
              {suitability.mifidCompliant ? '✓ COMPLERT' : '✗ NO COMPLERT'}
            </Text>
          </View>
        </View>

        {/* Advertències de cartera */}
        {suitability.warnings.length > 0 && (
          <View style={[S.cardGold, { marginBottom: 12 }]}>
            <Text style={[S.sectionTag, { marginBottom: 6 }]}>ADVERTÈNCIES DE CARTERA</Text>
            {suitability.warnings.map((w, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                <Text style={{ fontSize: 7.5, color: C.amber, marginRight: 5 }}>⚠</Text>
                <Text style={[S.body2, { marginBottom: 0, flex: 1, fontSize: 7.5 }]}>{w}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Taula per producte */}
        <Text style={[S.sectionTag, { marginBottom: 8 }]}>ADEQUACIÓ PER PRODUCTE</Text>
        <View style={S.table}>
          <View style={S.tableHead}>
            <Text style={[S.tableHeadCell, { flex: 4 }]}>PRODUCTE</Text>
            <Text style={[S.tableHeadCell, { flex: 1.5, textAlign: 'center' }]}>ADEQUACIÓ</Text>
            <Text style={[S.tableHeadCell, { flex: 4 }]}>OBSERVACIONS</Text>
          </View>
          {suitability.products.map((p, i) => (
            <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <Text style={[S.tableCell, { flex: 4, fontSize: 7.5 }]}>{p.productName}</Text>
              <Text style={[S.tableCell, S.bold, {
                flex: 1.5, textAlign: 'center', fontSize: 7,
                color: overallColor(p.status),
              }]}>
                {p.status === 'adequate'   ? 'ADEQUAT'  :
                 p.status === 'borderline' ? 'LÍMIT'    : 'NO ADEQUAT'}
              </Text>
              <Text style={[S.tableCellGray, { flex: 4, fontSize: 7 }]}>
                {p.reasons.length === 0 ? 'Cap observació' : p.reasons.join(' · ')}
              </Text>
            </View>
          ))}
        </View>

        {/* Frontera eficient — si s'ha capturat el gràfic */}
        {charts['chart-frontier'] ? (
          <>
            <Text style={[S.sectionTag, { marginBottom: 6, marginTop: 8 }]}>
              FRONTERA EFICIENT (MARKOWITZ MPT)
            </Text>
            <Image src={charts['chart-frontier']} style={{ width: '100%' }} />
            <Text style={S.chartNote}>
              Frontera eficient calculada per Markowitz Mean-Variance Optimization.
              El punt verd és el màxim Sharpe (tangència); el punt blau, la mínima variança.
            </Text>
          </>
        ) : null}

        {/* Heatmap correlació — si s'ha capturat */}
        {charts['chart-heatmap'] ? (
          <>
            <Text style={[S.sectionTag, { marginBottom: 6, marginTop: 8 }]}>
              HEATMAP DE CORRELACIÓ ENTRE ACTIUS
            </Text>
            <Image src={charts['chart-heatmap']} style={{ width: '100%' }} />
            <Text style={S.chartNote}>
              Correlació entre classes d'actiu: vermell = alta correlació, blau = baixa (diversificació).
            </Text>
          </>
        ) : null}

        {/* Nota metodològica */}
        <View style={[S.legalBox, { marginTop: 10 }]}>
          <Text style={S.legalTitle}>NOTA METODOLÒGICA MiFID II</Text>
          <Text style={S.legalText}>
            L'avaluació d'adequació s'ha realitzat conforme a l'Article 54 del Reglament Delegat
            2017/565/UE (MiFID II). S'han verificat: tolerància al risc del client vs. risc del
            producte, coneixement financer, necessitat de liquiditat, i horitzó temporal. Aquesta
            avaluació ha de ser revisada anualment o quan es produeixin canvis en la situació
            financera del client.
          </Text>
        </View>
      </View>
      <PageFooter />
    </Page>
  );
};

// ─── PÀGINA 8: ANÀLISI GRÀFICA ────────────────────────────────────────────────

const AnalysisPage = ({
  portfolio, metrics, charts, questionnaire,
}: {
  portfolio:     Portfolio;
  metrics:       PortfolioMetrics;
  charts:        Record<string, string>;
  questionnaire: InvestorQuestionnaire;
}) => (
  <Page size="A4" style={S.page}>
    <PageHeader section="ANÀLISI GRÀFICA" clientName={questionnaire.clientName} />
    <View style={S.body}>
      <SectionHeader tag="5." title="ANÀLISI GRÀFICA DE LA CARTERA" />

      {/* Evolució */}
      <Text style={[S.sectionTag, { marginBottom: 6 }]}>EVOLUCIÓ SIMULADA (5 ANYS)</Text>
      {charts['chart-historical'] ? (
        <Image src={charts['chart-historical']} style={{ width: '100%' }} />
      ) : (
        <View style={{ height: 158, backgroundColor: C.grayBg }} />
      )}
      <Text style={S.chartNote}>
        ⚠ Evolució simulada amb paràmetres estadístics de mercat. No representa
        rendibilitats reals ni garanteix resultats futurs. Base 100 = inici del període.
      </Text>

      {/* Rendibilitats per període */}
      <Text style={[S.sectionTag, { marginBottom: 6 }]}>
        RENDIBILITATS PER PERÍODE (ESTIMAT)
      </Text>
      {charts['chart-rolling'] ? (
        <Image src={charts['chart-rolling']} style={{ width: '100%' }} />
      ) : (
        <View style={{ height: 158, backgroundColor: C.grayBg }} />
      )}
      <Text style={S.chartNote}>
        Comparativa de rendibilitats estimades de la cartera vs el benchmark compost.
      </Text>

      {/* Mètriques */}
      <Text style={[S.sectionTag, { marginBottom: 8 }]}>INDICADORS CLAU DE RENDIMENT</Text>
      <View style={S.metricGrid}>
        <MetricBox label="Rendibilitat anualitzada"
          value={`${metrics.annualizedReturn.toFixed(2)}%`}
          sub="Estimat"
          color={metrics.annualizedReturn >= 4 ? C.green2 : C.red} />
        <MetricBox label="Volatilitat anualitzada"
          value={`${metrics.annualizedVolatility.toFixed(2)}%`}
          sub="Estimat" />
        <MetricBox label="Ratio de Sharpe"
          value={metrics.sharpeRatio.toFixed(2)}
          sub=">0.5 és bo"
          color={metrics.sharpeRatio >= 0.5 ? C.green2 : C.amber} />
        <MetricBox label="Ratio de Sortino"
          value={metrics.sortinoRatio.toFixed(2)}
          sub=">0.6 és bo" />
        <MetricBox label="Drawdown màxim"
          value={`${metrics.maxDrawdown.toFixed(2)}%`}
          sub="Pitjor caiguda" color={C.red} />
        <MetricBox label="Beta vs benchmark"
          value={metrics.beta.toFixed(2)}
          sub={metrics.beta <= 1 ? 'Menys risc' : 'Més risc'} />
        <MetricBox label="Calmar Ratio"
          value={metrics.calmarRatio.toFixed(2)}
          sub="Rendib./Drawdown" />
        <MetricBox label="Tracking Error"
          value={`${metrics.trackingError.toFixed(2)}%`}
          sub="vs benchmark" />
        <MetricBox label="TER ponderat"
          value={`${portfolio.totalTER.toFixed(2)}%`}
          sub="Cost anual" />
      </View>
    </View>
    <PageFooter />
  </Page>
);

// ─── PÀGINA 7: BENCHMARK ─────────────────────────────────────────────────────

const BenchmarkPage = ({
  portfolio, metrics, questionnaire,
}: {
  portfolio:     Portfolio;
  metrics:       PortfolioMetrics;
  questionnaire: InvestorQuestionnaire;
}) => (
  <Page size="A4" style={S.page}>
    <PageHeader section="BENCHMARK" clientName={questionnaire.clientName} />
    <View style={S.body}>
      <SectionHeader tag="6." title="BENCHMARK COMPOST DE REFERÈNCIA" />

      <Text style={S.body1}>{portfolio.benchmark.description}</Text>

      {/* Components benchmark */}
      <View style={[S.table, { marginBottom: 14 }]}>
        <View style={S.tableHead}>
          <Text style={[S.tableHeadCell, { flex: 4 }]}>ÍNDEX DE REFERÈNCIA</Text>
          <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'right' }]}>PONDERACIÓ</Text>
          <Text style={[S.tableHeadCell, { flex: 3 }]}>DESCRIPCIÓ</Text>
        </View>
        {portfolio.benchmark.components.map((c, i) => (
          <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
            <Text style={[S.tableCell, { flex: 4, fontSize: 7.5 }]}>{c.index}</Text>
            <Text style={[S.tableCell, S.bold, { flex: 1, textAlign: 'right' }]}>
              {c.weight}%
            </Text>
            <Text style={[S.tableCellGray, { flex: 3, fontSize: 7.5 }]}>{c.description}</Text>
          </View>
        ))}
      </View>

      {/* Comparativa cartera vs benchmark */}
      <Text style={[S.sectionTag, { marginBottom: 8 }]}>CARTERA VS BENCHMARK</Text>
      <View style={[S.table, { marginBottom: 14 }]}>
        <View style={S.tableHead}>
          <Text style={[S.tableHeadCell, { flex: 3 }]}>MÈTRICA</Text>
          <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'center' }]}>CARTERA</Text>
          <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'center' }]}>BENCHMARK</Text>
          <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>DIFERÈNCIA</Text>
        </View>
        {[
          {
            label: 'Rendibilitat esperada',
            port:  `${portfolio.expectedReturn}%`,
            bench: `${portfolio.benchmark.expectedReturn}%`,
            diff:  portfolio.expectedReturn - portfolio.benchmark.expectedReturn,
          },
          {
            label: 'Volatilitat esperada',
            port:  `${portfolio.expectedVolatility}%`,
            bench: `${portfolio.benchmark.expectedVolatility}%`,
            diff:  portfolio.benchmark.expectedVolatility - portfolio.expectedVolatility,
          },
          {
            label: 'Sharpe estimat',
            port:  metrics.sharpeRatio.toFixed(2),
            bench: '—',
            diff:  0,
          },
          {
            label: 'Cost (TER)',
            port:  `${portfolio.totalTER.toFixed(2)}%`,
            bench: '0%',
            diff:  0,
          },
        ].map((row, i) => (
          <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
            <Text style={[S.tableCell, { flex: 3 }]}>{row.label}</Text>
            <Text style={[S.tableCell, S.bold, { flex: 2, textAlign: 'center' }]}>
              {row.port}
            </Text>
            <Text style={[S.tableCellGray, { flex: 2, textAlign: 'center' }]}>
              {row.bench}
            </Text>
            <Text style={[S.tableCell, S.bold, {
              flex: 2, textAlign: 'right',
              color: row.diff > 0 ? C.green2 : row.diff < 0 ? C.red : C.gray,
            }]}>
              {row.diff !== 0 ? fmtPct(row.diff) : '—'}
            </Text>
          </View>
        ))}
      </View>

      {/* Nota metodològica benchmark */}
      <Text style={[S.sectionTag, { marginBottom: 8 }]}>NOTA METODOLÒGICA</Text>
      <View style={S.cardGold}>
        <Text style={[S.body1, { fontSize: 8, marginBottom: 6 }]}>
          El benchmark compost s'ha construït per reflectir una cartera passiva equivalent
          al perfil <Text style={S.bold}>{getProfileLabel(portfolio.profile)}</Text>, amb una
          distribució d'actius coherent amb el nivell de risc establert.
        </Text>
        <Text style={[S.body2, { marginBottom: 0, fontSize: 7.5 }]}>
          Rendibilitat esperada benchmark: <Text style={S.bold}>{portfolio.benchmark.expectedReturn}%</Text>{' '}
          · Volatilitat esperada benchmark: <Text style={S.bold}>{portfolio.benchmark.expectedVolatility}%</Text>
        </Text>
      </View>

      {/* Criteris de selecció */}
      <Text style={[S.sectionTag, { marginBottom: 8, marginTop: 8 }]}>
        CRITERIS DE SELECCIÓ DELS FONS D'INVERSIÓ
      </Text>
      {[
        'Diversificació adequada per classe d\'actiu, geografia i estil de gestió',
        'Qualitat i trajectòria contrastada de la gestora',
        'Costos (TER) competitius respecte a la categoria de referència',
        'Coherència del benchmark amb l\'estratègia declarada del fons',
        'Consistència de resultats i tracking error controlat',
        'Liquiditat suficient per al perfil de l\'inversor',
        'Nivell de risc alineat amb el perfil recomanat pel qüestionari',
        'Divisa i cobertura de canvi considerada en la construcció de la cartera',
        'Adequació al perfil inversor determinat pel qüestionari de perfilació',
      ].map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ fontSize: 7.5, color: C.gold, marginRight: 6 }}>✓</Text>
          <Text style={[S.body2, { marginBottom: 0, flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
    <PageFooter />
  </Page>
);

// ─── PÀGINA 8: MONTE CARLO ────────────────────────────────────────────────────

const MonteCarloPage = ({
  portfolio, monteCarlo, questionnaire, charts,
}: {
  portfolio:     Portfolio;
  monteCarlo:    MonteCarloResult;
  questionnaire: InvestorQuestionnaire;
  charts:        Record<string, string>;
}) => (
  <Page size="A4" style={S.page}>
    <PageHeader section="PROJECCIÓ MONTE CARLO" clientName={questionnaire.clientName} />
    <View style={S.body}>
      <SectionHeader tag="7." title="PROJECCIÓ MONTE CARLO" />

      <Text style={S.body1}>
        Simulació de{' '}
        <Text style={S.bold}>
          {(monteCarlo.params.numSimulations ?? 1000).toLocaleString()} escenaris aleatoris
        </Text>{' '}
        per projectar l'evolució patrimonial durant{' '}
        <Text style={S.bold}>{questionnaire.investmentHorizon} anys</Text>.
      </Text>

      {/* Gràfic Monte Carlo */}
      <Text style={[S.sectionTag, { marginBottom: 6 }]}>
        PROJECCIÓ — {(monteCarlo.params.numSimulations ?? 1000).toLocaleString()} SIMULACIONS
      </Text>
      {charts['chart-montecarlo'] ? (
        <Image src={charts['chart-montecarlo']} style={{ width: '100%' }} />
      ) : (
        <View style={{ height: 158, backgroundColor: C.grayBg }} />
      )}
      <Text style={S.chartNote}>
        Les tres línies representen el percentil pessimista (P10), central (P50) i optimista (P90).
        La línia grisa mostra el total aportat acumulat sense rendibilitat.
      </Text>

      {/* P10 P50 P90 */}
      <View style={S.row}>
        <View style={[S.card, S.col, { borderColor: C.red }]}>
          <Text style={S.cardLabel}>Pessimista (P10)</Text>
          <Text style={[S.cardValue, { color: C.red, fontSize: 18 }]}>
            {formatMonteCarloValue(monteCarlo.percentiles.p10)}
          </Text>
          <Text style={S.cardSub}>en {questionnaire.investmentHorizon} anys</Text>
        </View>
        <View style={[S.card, S.col, { borderColor: C.gold, borderWidth: 1.5 }]}>
          <Text style={S.cardLabel}>Central (P50)</Text>
          <Text style={[S.cardValue, { color: C.green, fontSize: 18 }]}>
            {formatMonteCarloValue(monteCarlo.percentiles.p50)}
          </Text>
          <Text style={S.cardSub}>en {questionnaire.investmentHorizon} anys</Text>
        </View>
        <View style={[S.card, S.col, { borderColor: C.green2 }]}>
          <Text style={S.cardLabel}>Optimista (P90)</Text>
          <Text style={[S.cardValue, { color: C.green2, fontSize: 18 }]}>
            {formatMonteCarloValue(monteCarlo.percentiles.p90)}
          </Text>
          <Text style={S.cardSub}>en {questionnaire.investmentHorizon} anys</Text>
        </View>
      </View>

      {/* Probabilitats */}
      <Text style={[S.sectionTag, { marginBottom: 8 }]}>ANÀLISI DE PROBABILITATS</Text>
      <View style={S.metricGrid}>
        <MetricBox label="Prob. retorn positiu"
          value={`${monteCarlo.probabilityAnalysis.probabilityPositiveReturn}%`}
          color={monteCarlo.probabilityAnalysis.probabilityPositiveReturn >= 70 ? C.green2 : C.amber} />
        <MetricBox label="Prob. batre inflació"
          value={`${monteCarlo.probabilityAnalysis.probabilityBeatInflation}%`}
          color={monteCarlo.probabilityAnalysis.probabilityBeatInflation >= 60 ? C.green2 : C.amber} />
        <MetricBox label="Prob. assolir objectiu"
          value={`${monteCarlo.probabilityAnalysis.probabilityReachTarget}%`}
          color={monteCarlo.probabilityAnalysis.probabilityReachTarget >= 50 ? C.green2 : C.amber} />
        <MetricBox label="Total aportat"
          value={fmt(monteCarlo.summary.totalInvested)} />
        <MetricBox label="Guany net mediana"
          value={fmt(monteCarlo.summary.medianGain)}
          color={monteCarlo.summary.medianGain > 0 ? C.green2 : C.red} />
        <MetricBox label="Valor real (P50)"
          value={formatMonteCarloValue(monteCarlo.inflationAdjusted.p50RealValue)} />
        <MetricBox label="Retorn real anual"
          value={`${monteCarlo.inflationAdjusted.realAnnualizedReturn.toFixed(2)}%`}
          color={monteCarlo.inflationAdjusted.realAnnualizedReturn > 0 ? C.green2 : C.red} />
        <MetricBox label="Inflació assumida"
          value={`${monteCarlo.inflationAdjusted.inflationRate}%`} />
        <MetricBox label="Interval confiança 90%"
          value={`${formatMonteCarloValue(monteCarlo.probabilityAnalysis.confidenceInterval90[0])} — ${formatMonteCarloValue(monteCarlo.probabilityAnalysis.confidenceInterval90[1])}`}
          sub="P5 — P95" />
      </View>

      <View style={[S.cardGold, { marginTop: 4 }]}>
        <Text style={[S.body1, { fontSize: 7.5, marginBottom: 0 }]}>
          {monteCarlo.note}
        </Text>
      </View>
    </View>
    <PageFooter />
  </Page>
);

// ─── PÀGINA 9: RISCOS ────────────────────────────────────────────────────────

const RisksPage = ({
  report, metrics, charts, questionnaire,
}: {
  report:        FinancialReport;
  metrics:       PortfolioMetrics;
  charts:        Record<string, string>;
  questionnaire: InvestorQuestionnaire;
}) => (
  <Page size="A4" style={S.page}>
    <PageHeader section="RISCOS I CONTRIBUCIÓ" clientName={questionnaire.clientName} />
    <View style={S.body}>
      <SectionHeader tag="8." title="ANÀLISI DE RISCOS" />

      {/* Gràfic contribució risc */}
      <Text style={[S.sectionTag, { marginBottom: 6 }]}>CONTRIBUCIÓ AL RISC PER FONS</Text>
      {charts['chart-risk'] ? (
        <Image src={charts['chart-risk']} style={{ width: '100%' }} />
      ) : (
        <View style={{ height: 158, backgroundColor: C.grayBg }} />
      )}
      <Text style={S.chartNote}>
        Cada barra representa el percentatge de risc total que aporta cada fons.
        Un fons pot tenir un pes baix però una contribució al risc alta si és molt volàtil.
      </Text>

      {/* Taula riscos */}
      <View style={S.table}>
        <View style={S.tableHead}>
          <Text style={[S.tableHeadCell, { flex: 2 }]}>CATEGORIA DE RISC</Text>
          <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'center' }]}>NIVELL</Text>
          <Text style={[S.tableHeadCell, { flex: 4 }]}>MESURA DE MITIGACIÓ</Text>
        </View>
        {report.risksSection.mainRisks.map((risk, i) => (
          <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
            <Text style={[S.tableCell, S.bold, { flex: 2 }]}>{risk.category}</Text>
            <Text style={[S.tableCell, S.bold, {
              flex: 1, textAlign: 'center',
              color: risk.level === 'baix'    ? C.green2 :
                     risk.level === 'moderat' ? C.amber  :
                     risk.level === 'alt'     ? '#f97316' : C.red,
              fontSize: 7,
            }]}>
              {risk.level.toUpperCase()}
            </Text>
            <Text style={[S.tableCellGray, { flex: 4, fontSize: 7.5 }]}>
              {risk.mitigation}
            </Text>
          </View>
        ))}
      </View>

      {/* Pla de seguiment */}
      <Text style={[S.sectionTag, { marginBottom: 8, marginTop: 4 }]}>
        PLA DE SEGUIMENT RECOMANAT
      </Text>
      {report.risksSection.followUpPlan.map((step, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{
            fontSize: 8, color: C.gold, marginRight: 6,
            fontFamily: 'Helvetica-Bold',
          }}>
            {i + 1}.
          </Text>
          <Text style={[S.body2, { marginBottom: 0, flex: 1 }]}>{step}</Text>
        </View>
      ))}

      {/* Fortaleses */}
      <View style={[S.cardGold, { marginTop: 10 }]}>
        <Text style={[S.sectionTag, { marginBottom: 8 }]}>FORTALESES DE LA CARTERA</Text>
        {report.risksSection.mitigants.slice(0, 4).map((m, i) => (
          <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
            <Text style={{ fontSize: 7.5, color: C.green2, marginRight: 6 }}>•</Text>
            <Text style={[S.body2, { marginBottom: 0, flex: 1 }]}>{m}</Text>
          </View>
        ))}
      </View>
    </View>
    <PageFooter />
  </Page>
);

// ─── PÀGINA 10: CONCLUSIÓ I AVÍS LEGAL ───────────────────────────────────────

const ConclusionPage = ({
  report, portfolio, questionnaire,
}: {
  report:        FinancialReport;
  portfolio:     Portfolio;
  questionnaire: InvestorQuestionnaire;
}) => (
  <Page size="A4" style={S.page}>
    <PageHeader section="CONCLUSIÓ" clientName={questionnaire.clientName} />
    <View style={S.body}>
      <SectionHeader tag="9." title="CONCLUSIÓ I RECOMANACIONS" />

      {/* Resum estructura */}
      <Text style={[S.sectionTag, { marginBottom: 8 }]}>
        RESUM DE L'ESTRUCTURA DEFINITIVA
      </Text>
      <Text style={S.body1}>
        Aplicant els principis de diversificació geogràfica i per capitalització,
        s'ha definit la següent estructura de cartera optimitzada per al perfil{' '}
        <Text style={S.bold}>{getProfileLabel(portfolio.profile)}</Text>{' '}
        de <Text style={S.bold}>{questionnaire.clientName || 'el client'}</Text>.
      </Text>

      {/* Cards diversificació geogràfica */}
      <View style={[S.row, { flexWrap: 'wrap' }]}>
        {portfolio.characteristics.geographicDiversification.slice(0, 4).map((geo, i) => (
          <View key={i} style={[S.card, { flex: 1, minWidth: '22%' }]}>
            <Text style={S.cardLabel}>Diversificació</Text>
            <Text style={[S.cardValue, { fontSize: 11 }]}>{geo}</Text>
          </View>
        ))}
      </View>

      {/* Projecció patrimonial */}
      <Text style={[S.sectionTag, { marginBottom: 8, marginTop: 4 }]}>
        PROJECCIÓ PATRIMONIAL
      </Text>
      <View style={S.row}>
        <View style={[S.card, S.col]}>
          <Text style={S.cardLabel}>Acumulació anual per inversió</Text>
          <Text style={[S.cardValue, { fontSize: 16 }]}>
            {fmt(questionnaire.monthlyContribution * 12)}
          </Text>
          <Text style={S.cardSub}>Sense rendibilitat</Text>
        </View>
        <View style={[S.card, S.col]}>
          <Text style={S.cardLabel}>Horitzó temporal</Text>
          <Text style={[S.cardValue, { fontSize: 16 }]}>
            {questionnaire.investmentHorizon} anys
          </Text>
          <Text style={S.cardSub}>Fins a l'objectiu</Text>
        </View>
        <View style={[S.card, S.col]}>
          <Text style={S.cardLabel}>Objectiu financer</Text>
          <Text style={[S.cardValue, { fontSize: 16 }]}>
            {fmt(questionnaire.targetAmount)}
          </Text>
          <Text style={S.cardSub}>Import objectiu</Text>
        </View>
      </View>

      {/* Conclusió principal */}
      <View style={[S.cardGold, { marginBottom: 12 }]}>
        <Text style={[S.sectionTag, { marginBottom: 6 }]}>CONCLUSIÓ FINAL</Text>
        <Text style={[S.body1, { marginBottom: 0 }]}>
          {report.conclusionSection.summary}
        </Text>
      </View>

      {/* Propers passos */}
      <Text style={[S.sectionTag, { marginBottom: 8 }]}>PROPERS PASSOS RECOMANATS</Text>
      {report.conclusionSection.nextSteps.map((step, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}>
          <View style={{
            width: 16, height: 16, borderRadius: 8,
            borderWidth: 0.5, borderColor: C.gold,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 8, marginTop: 1,
          }}>
            <Text style={{
              fontSize: 7, color: C.gold, fontFamily: 'Helvetica-Bold',
            }}>
              {i + 1}
            </Text>
          </View>
          <Text style={[S.body2, { marginBottom: 0, flex: 1 }]}>{step}</Text>
        </View>
      ))}

      <Text style={[S.body2, { marginTop: 8 }]}>
        📅 Pròxima revisió:{' '}
        <Text style={S.bold}>{report.conclusionSection.reviewDate}</Text> —{' '}
        {report.conclusionSection.reviewFrequency}
      </Text>

      {/* Avís legal */}
      <View style={[S.legalBox, { marginTop: 12 }]}>
        <Text style={S.legalTitle}>⚖ AVÍS LEGAL IMPORTANT</Text>
        <Text style={S.legalText}>
          Aquest informe ha estat generat per Factor OTC, una eina digital de suport
          a la decisió d'inversió amb finalitat educativa i orientativa. No constitueix
          un assessorament financer personalitzat regulat en el sentit de la Directiva
          MiFID II ni de cap altra normativa financera aplicable. Factor OTC no és una
          entitat financera regulada i no executa operacions financeres reals. Els
          rendiments passats no garanteixen rendiments futurs. Les projeccions i
          simulacions es basen en supòsits estadístics i no poden garantir resultats
          reals. Tota inversió comporta risc de pèrdua parcial o total del capital.
          Es recomana consultar un assessor financer independent i regulat (EAFI, IFA
          o entitat financera autoritzada) abans de prendre decisions d'inversió
          significatives.
        </Text>
        <Text style={[S.legalText, { marginTop: 5 }]}>
          © {new Date().getFullYear()} Factor OTC · Eina de suport a la decisió
          d'inversió · {report.metadata.reportId}
        </Text>
      </View>
    </View>
    <PageFooter />
  </Page>
);

// ─── DOCUMENT PRINCIPAL ───────────────────────────────────────────────────────

export interface FactorOTCReportProps {
  questionnaire: InvestorQuestionnaire;
  scoring:       ScoringResult;
  portfolio:     Portfolio;
  metrics:       PortfolioMetrics;
  monteCarlo:    MonteCarloResult;
  report:        FinancialReport;
  charts?:       Record<string, string>;
  historical?:   HistoricalChartPoint[];
}

export function FactorOTCReport({
  questionnaire, scoring, portfolio,
  metrics, monteCarlo, report,
  charts = {}, historical = [],
}: FactorOTCReportProps) {
  return (
    <Document
      title={`Factor OTC — Informe Financer — ${questionnaire.clientName || getProfileLabel(scoring.profile)}`}
      author="Factor OTC RoboAdvisor"
      subject="Informe Financer Personalitzat"
      creator="Factor OTC">

      {/* Pàgina 1: Portada */}
      <CoverPage
        scoring={scoring}
        report={report}
        questionnaire={questionnaire}
      />

      {/* Pàgina 2: Resum executiu */}
      <ExecutivePage
        questionnaire={questionnaire}
        scoring={scoring}
        portfolio={portfolio}
        monteCarlo={monteCarlo}
      />

      {/* Pàgina 3: Perfil inversor */}
      <ProfilePage
        scoring={scoring}
        report={report}
        charts={charts}
        questionnaire={questionnaire}
      />

      {/* Pàgina 4: Diagnòstic financer */}
      <DiagnosticsPage
        questionnaire={questionnaire}
        scoring={scoring}
      />

      {/* Pàgina 5: Composició cartera */}
      <PortfolioPage
        portfolio={portfolio}
        questionnaire={questionnaire}
        charts={charts}
      />

      {/* Pàgina 6: IPS */}
      <IPSPage
        ips={report.ipsSection}
        questionnaire={questionnaire}
      />

      {/* Pàgina 7: Suitability MiFID II */}
      <SuitabilityPage
        suitability={report.suitabilitySection}
        questionnaire={questionnaire}
        charts={charts}
      />

      {/* Pàgina 8: Anàlisi gràfica */}
      <AnalysisPage
        portfolio={portfolio}
        metrics={metrics}
        charts={charts}
        questionnaire={questionnaire}
      />

      {/* Pàgina 7: Benchmark */}
      <BenchmarkPage
        portfolio={portfolio}
        metrics={metrics}
        questionnaire={questionnaire}
      />

      {/* Pàgina 8: Monte Carlo */}
      <MonteCarloPage
        portfolio={portfolio}
        monteCarlo={monteCarlo}
        questionnaire={questionnaire}
        charts={charts}
      />

      {/* Pàgina 9: Riscos */}
      <RisksPage
        report={report}
        metrics={metrics}
        charts={charts}
        questionnaire={questionnaire}
      />

      {/* Pàgina 10: Conclusió */}
      <ConclusionPage
        report={report}
        portfolio={portfolio}
        questionnaire={questionnaire}
      />

    </Document>
  );
}