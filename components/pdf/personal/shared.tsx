// components/pdf/personal/shared.tsx
// Tokens de disseny i components reutilitzables per al bloc de finances
// personals de l'informe. Es dupliquen aquí (en lloc d'importar-los de
// FactorOTCReport.tsx) perquè aquest fitxer existent no es toca en cap línia.
// Els valors (colors, mides, tipografia) són idèntics als de l'informe base.
import { StyleSheet, Text, View } from '@react-pdf/renderer';

export const C = {
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

export const statusColor = (status: 'verd' | 'ambre' | 'vermell'): string =>
  status === 'verd' ? C.green2 : status === 'ambre' ? C.amber : C.red;

export const S = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    fontFamily:      'Helvetica',
    paddingBottom:   55,
  },
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

  body: { paddingHorizontal: 45, paddingTop: 20 },

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

  row:  { flexDirection: 'row', gap: 10, marginBottom: 10 },
  col:  { flex: 1 },

  body1: { fontSize: 9, color: C.dark, lineHeight: 1.65, marginBottom: 8 },
  body2: { fontSize: 8.5, color: C.gray, lineHeight: 1.65, marginBottom: 6 },
  bold:  { fontFamily: 'Helvetica-Bold' },

  table:         { marginBottom: 14 },
  tableHead:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.dark, paddingBottom: 5, marginBottom: 3 },
  tableHeadCell: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.dark, letterSpacing: 1, textTransform: 'uppercase' },
  tableRow:      { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.grayLight, paddingVertical: 6 },
  tableRowAlt:   { backgroundColor: C.offWhite },
  tableCell:     { fontSize: 8, color: C.dark },
  tableCellGray: { fontSize: 8, color: C.gray },

  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  metricBox: {
    width: '31.5%', borderWidth: 0.5,
    borderColor: C.grayLight, padding: 10,
    backgroundColor: C.white,
  },
  metricLabel: { fontSize: 6.5, color: C.gray, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  metricValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.dark },
  metricSub:   { fontSize: 6.5, color: C.gray, marginTop: 1 },

  chartNote: { fontSize: 7, color: C.gray, fontStyle: 'italic', marginBottom: 10 },

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

  // Recuadre "Què vol dir això"
  explainerBox: {
    borderWidth: 0.5, borderColor: C.grayLight,
    backgroundColor: C.grayBg,
    padding: 10, marginTop: 6, marginBottom: 10,
  },
  explainerTitle: {
    fontSize: 6.5, fontFamily: 'Helvetica-Bold',
    color: C.dark, letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 4,
  },
  explainerText: { fontSize: 8, color: C.dark, lineHeight: 1.55 },
});

export const fmt = (n: number) =>
  new Intl.NumberFormat('ca-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);

export const fmtPct1 = (n: number) => `${n.toFixed(1)}%`;

export const PageHeader = ({
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

export const PageFooter = () => (
  <View style={S.footer} fixed>
    <Text style={S.footerText}>
      Factor OTC · Eina de suport a la decisió · No constitueix assessorament financer regulat
    </Text>
    <Text style={S.footerPage}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>
);

export const SectionHeader = ({ tag, title }: { tag: string; title: string }) => (
  <View>
    <Text style={S.sectionTag}>{tag}</Text>
    <Text style={S.sectionTitle}>{title}</Text>
    <View style={S.sectionDivider} />
  </View>
);

export const MetricBox = ({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) => (
  <View style={S.metricBox}>
    <Text style={S.metricLabel}>{label}</Text>
    <Text style={[S.metricValue, color ? { color } : {}]}>{value}</Text>
    {sub && <Text style={S.metricSub}>{sub}</Text>}
  </View>
);

// @react-pdf/renderer's <Text> supports fontSize/fontFamily when nested
// inside <Svg> (see @react-pdf/render's SVG text renderer), but its own
// SVGTextProps type declaration doesn't list them — hence the single cast,
// isolated here so no other file needs one.
export const SvgLabel = ({
  x, y, fontSize, fontFamily, fill, textAnchor, children,
}: {
  x: number; y: number; fontSize: number; fontFamily?: string; fill: string;
  textAnchor?: 'start' | 'middle' | 'end'; children: React.ReactNode;
}) => (
  <Text {...({ x, y, fontSize, fontFamily, fill, textAnchor } as unknown as { x: number; y: number })}>
    {children}
  </Text>
);

export const Explainer = ({ children }: { children: React.ReactNode }) => (
  <View style={S.explainerBox}>
    <Text style={S.explainerTitle}>Què vol dir això</Text>
    <Text style={S.explainerText}>{children}</Text>
  </View>
);
