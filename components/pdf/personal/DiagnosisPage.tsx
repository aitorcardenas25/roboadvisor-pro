// components/pdf/personal/DiagnosisPage.tsx
// Pàgina D del bloc de finances personals: entre 3 i 5 conclusions,
// ordenades per impacte, derivades mecànicament de les ràtios calculades.
// Bloc descriptiu i diagnòstic: no conté cap recomanació d'inversió ni de
// producte concret.
import { Page, Text, View } from '@react-pdf/renderer';
import { InvestorQuestionnaire } from '@/lib/scoring';
import { PersonalFinanceAnalysis } from '@/lib/personalFinance';
import {
  S, C, statusColor, PageHeader, PageFooter, SectionHeader, Explainer,
} from './shared';
import { StatusChip } from './charts';

export const DiagnosisPage = ({
  questionnaire, analysis,
}: {
  questionnaire: InvestorQuestionnaire;
  analysis:      PersonalFinanceAnalysis;
}) => (
  <Page size="A4" style={S.page}>
    <PageHeader section="FINANCES PERSONALS · DIAGNÒSTIC" clientName={questionnaire.clientName} />
    <View style={S.body}>
      <SectionHeader tag="D." title="DIAGNÒSTIC I PRIORITATS" />

      <Text style={S.body1}>
        Conclusions ordenades per impacte a partir de les ràtios de la pàgina anterior.
        Cada conclusió cita la dada concreta que la sustenta.
      </Text>

      {analysis.diagnosis.map((item, i) => (
        <View key={i} style={{
          flexDirection: 'row', gap: 10,
          borderWidth: 0.5, borderColor: C.grayLight,
          borderLeftWidth: 3, borderLeftColor: statusColor(item.status),
          padding: 12, marginBottom: 10, backgroundColor: C.white,
        }}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: statusColor(item.status) }}>
            {i + 1}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[S.body1, S.bold, { marginBottom: 3 }]}>{item.headline}</Text>
            <Text style={S.body2}>{item.detail}</Text>
          </View>
          <StatusChip status={item.status} />
        </View>
      ))}

      <Explainer>
        Aquest diagnòstic descriu la situació financera actual a partir de les dades
        facilitades; no és una recomanació d&apos;inversió ni de producte concret.
      </Explainer>

      <View style={S.legalBox}>
        <Text style={S.legalTitle}>Nota important</Text>
        <Text style={S.legalText}>
          Les conclusions d&apos;aquesta pàgina són de caràcter descriptiu i diagnòstic,
          generades de forma mecànica a partir de les ràtios financeres calculades. No
          constitueixen assessorament ni recomanació personalitzada d&apos;inversió, en els
          termes de la normativa MiFID II.
        </Text>
      </View>
    </View>
    <PageFooter />
  </Page>
);
