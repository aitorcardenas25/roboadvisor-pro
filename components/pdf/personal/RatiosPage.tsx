// components/pdf/personal/RatiosPage.tsx
// Pàgina C del bloc de finances personals: ràtios de salut financera amb
// semàfor i referència, cadascuna amb la seva explicació d'una línia.
import { Page, Text, View } from '@react-pdf/renderer';
import { InvestorQuestionnaire } from '@/lib/scoring';
import { PersonalFinanceAnalysis } from '@/lib/personalFinance';
import {
  S, C, statusColor, PageHeader, PageFooter, SectionHeader, Explainer,
} from './shared';
import { StatusChip } from './charts';

const ratioStyles = {
  row: {
    borderWidth: 0.5, borderColor: C.grayLight,
    padding: 10, marginBottom: 8, backgroundColor: C.white,
  } as const,
  top:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 4 },
  label: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.dark },
  left:  { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  value: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  ref:   { fontSize: 7, color: C.gray, marginBottom: 3 },
  expl:  { fontSize: 7.5, color: C.gray, lineHeight: 1.5 },
};

export const RatiosPage = ({
  questionnaire, analysis,
}: {
  questionnaire: InvestorQuestionnaire;
  analysis:      PersonalFinanceAnalysis;
}) => (
  <Page size="A4" style={S.page}>
    <PageHeader section="FINANCES PERSONALS · RÀTIOS" clientName={questionnaire.clientName} />
    <View style={S.body}>
      <SectionHeader tag="C." title="RÀTIOS DE SALUT FINANCERA" />

      <Text style={S.body1}>
        Cinc indicadors clau que resumeixen la solidesa financera de{' '}
        <Text style={S.bold}>{questionnaire.clientName || 'el client'}</Text>, cadascun amb
        un semàfor i el rang de referència habitual del sector.
      </Text>

      {analysis.ratios.map(r => (
        <View key={r.key} style={ratioStyles.row}>
          <View style={ratioStyles.top}>
            <View style={ratioStyles.left}>
              <StatusChip status={r.status} />
              <Text style={ratioStyles.label}>{r.label}</Text>
            </View>
            <Text style={[ratioStyles.value, { color: statusColor(r.status) }]}>{r.valueLabel}</Text>
          </View>
          <Text style={ratioStyles.ref}>Referència: {r.reference}</Text>
          <Text style={ratioStyles.expl}>{r.explanation}</Text>
        </View>
      ))}

      <Explainer>
        Verd vol dir que l&apos;indicador està dins del rang saludable; ambre, que convé
        vigilar-lo; vermell, que és un punt a millorar de forma prioritària.
      </Explainer>
    </View>
    <PageFooter />
  </Page>
);
