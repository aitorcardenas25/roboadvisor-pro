// components/pdf/personal/CashFlowPage.tsx
// Pàgina B del bloc de finances personals: flux de caixa anual, des dels
// ingressos bruts fins a la capacitat d'estalvi (o dèficit) final.
import { Page, Text, View } from '@react-pdf/renderer';
import { InvestorQuestionnaire } from '@/lib/scoring';
import { PersonalFinanceAnalysis } from '@/lib/personalFinance';
import {
  S, C, fmt, PageHeader, PageFooter, SectionHeader, Explainer,
} from './shared';
import { CashFlowWaterfall } from './charts';

export const CashFlowPage = ({
  questionnaire, analysis,
}: {
  questionnaire: InvestorQuestionnaire;
  analysis:      PersonalFinanceAnalysis;
}) => {
  const cf = analysis.cashFlow;

  return (
    <Page size="A4" style={S.page}>
      <PageHeader section="FINANCES PERSONALS · FLUX DE CAIXA" clientName={questionnaire.clientName} />
      <View style={S.body}>
        <SectionHeader tag="B." title="FLUX DE CAIXA ANUAL" />

        <Text style={S.body1}>
          Recorregut des dels ingressos anuals bruts fins a la capacitat d&apos;estalvi
          {cf.isDeficit ? ', que en aquest cas resulta negativa' : ' final'}, a partir de les
          dades declarades pel client.
        </Text>

        <CashFlowWaterfall cashFlow={cf} />

        <View style={[S.cardGold, { alignItems: 'center', marginTop: 6 }]}>
          <Text style={S.cardLabel}>
            {cf.isDeficit ? 'Dèficit anual sobre els ingressos' : 'Capacitat d\'estalvi anual'}
          </Text>
          <Text style={[S.cardValue, { fontSize: 30, color: cf.isDeficit ? C.red : C.dark }]}>
            {cf.savingsRateSigned.toFixed(1)}%
          </Text>
          <Text style={S.cardSub}>{fmt(cf.annualBalance)} l&apos;any</Text>
        </View>

        <Explainer>
          {cf.isDeficit
            ? 'Les despeses anuals declarades superen els ingressos anuals bruts declarats: el balanç és negatiu.'
            : 'Aquest percentatge indica quina part dels ingressos anuals queda disponible un cop pagades totes les despeses.'}
          {' '}Com més gran, més marge per estalviar o invertir.
        </Explainer>

        <Text style={S.body2}>
          Nota: el qüestionari captura els ingressos anuals com a bruts i les despeses mensuals
          com un únic import agregat. No es disposa d&apos;ingressos nets ni del desglossament
          entre despeses fixes i variables, per això el recorregut es mostra en tres trams.
        </Text>
      </View>
      <PageFooter />
    </Page>
  );
};
