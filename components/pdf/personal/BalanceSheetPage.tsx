// components/pdf/personal/BalanceSheetPage.tsx
// Pàgina A del bloc de finances personals: balanç patrimonial (actiu, passiu
// i patrimoni net) a partir de les dades declarades pel client.
import { Page, Text, View } from '@react-pdf/renderer';
import { InvestorQuestionnaire } from '@/lib/scoring';
import { PersonalFinanceAnalysis } from '@/lib/personalFinance';
import {
  S, C, fmt, fmtPct1, PageHeader, PageFooter, SectionHeader, Explainer,
} from './shared';
import { BalanceBarChart } from './charts';

export const BalanceSheetPage = ({
  questionnaire, analysis,
}: {
  questionnaire: InvestorQuestionnaire;
  analysis:      PersonalFinanceAnalysis;
}) => {
  const b = analysis.balanceSheet;

  const rows = [
    { label: 'Actiu total', value: b.totalAssets, pct: 100 },
    { label: 'Passiu (deute total)', value: b.totalLiabilities, pct: b.liabilitiesPct },
    { label: 'Patrimoni net', value: b.netWorth, pct: b.netWorthPct },
  ];

  return (
    <Page size="A4" style={S.page}>
      <PageHeader section="FINANCES PERSONALS · BALANÇ" clientName={questionnaire.clientName} />
      <View style={S.body}>
        <SectionHeader tag="A." title="BALANÇ PATRIMONIAL PERSONAL" />

        <Text style={S.body1}>
          Fotografia del que <Text style={S.bold}>{questionnaire.clientName || 'el client'}</Text>{' '}
          té (actiu) i del que deu (passiu) a partir de les dades declarades al qüestionari.
          La diferència entre tots dos és el patrimoni net.
        </Text>

        <BalanceBarChart balance={b} />

        <Explainer>
          El patrimoni net és el que et quedaria si venguessis tot el que tens i pagessis
          tot el que deus. Un patrimoni net positiu i creixent és senyal d&apos;una situació
          financera saludable.
        </Explainer>

        <Text style={[S.sectionTag, { marginBottom: 8, marginTop: 4 }]}>DETALL DEL BALANÇ</Text>
        <View style={S.table}>
          <View style={S.tableHead}>
            <Text style={[S.tableHeadCell, { flex: 3 }]}>PARTIDA</Text>
            <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>IMPORT</Text>
            <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>% SOBRE L&apos;ACTIU</Text>
          </View>
          {rows.map((row, i) => (
            <View key={row.label} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <Text style={[S.tableCell, S.bold, { flex: 3 }]}>{row.label}</Text>
              <Text style={[S.tableCell, { flex: 2, textAlign: 'right' }]}>{fmt(row.value)}</Text>
              <Text style={[S.tableCellGray, { flex: 2, textAlign: 'right' }]}>{fmtPct1(row.pct)}</Text>
            </View>
          ))}
        </View>

        <Text style={S.body2}>
          Nota: el qüestionari de perfilació actual no desglossa l&apos;actiu ni el passiu per
          categories (líquid, financer, immobiliari, hipoteca, préstecs...), per això el balanç
          es mostra de forma agregada, sense inventar cap desglossament no declarat pel client.
        </Text>
      </View>
      <PageFooter />
    </Page>
  );
};
