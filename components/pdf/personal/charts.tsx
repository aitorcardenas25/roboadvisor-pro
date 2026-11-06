// components/pdf/personal/charts.tsx
// Gràfics del bloc de finances personals, dibuixats amb les primitives SVG
// natives de @react-pdf/renderer (Svg, Rect, Line, Text). Sense cap llibreria
// de gràfics ni imatges rasteritzades.
import { Svg, Rect, Line } from '@react-pdf/renderer';
import { C, statusColor, SvgLabel } from './shared';
import { PersonalBalanceSheet, PersonalCashFlow, RatioStatus } from '@/lib/personalFinance';

const fmtCompact = (n: number) =>
  new Intl.NumberFormat('ca-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: 'compact',
  }).format(n);

// ─── BALANÇ: BARRES APILADES ACTIU / PASSIU + NET ──────────────────────────

export const BalanceBarChart = ({ balance }: { balance: PersonalBalanceSheet }) => {
  const W = 460, H = 220, baseline = 160, barW = 110;
  const maxVal = Math.max(balance.totalAssets, 1);
  const scale  = 130 / maxVal;

  const assetH   = balance.totalAssets * scale;
  const liabH    = balance.totalLiabilities * scale;
  const netH     = Math.max(0, balance.netWorth) * scale;

  const assetX = 90;
  const otherX = 280;
  const labelY = baseline + 14;
  const legendY = H - 16;

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={40} y1={baseline} x2={W - 20} y2={baseline} stroke={C.grayLight} strokeWidth={0.75} />

      {/* Actiu */}
      <Rect x={assetX} y={baseline - assetH} width={barW} height={assetH} fill={C.blue} />
      <SvgLabel x={assetX + barW / 2} y={baseline - assetH - 8} textAnchor="middle"
        fontSize={9} fontFamily="Helvetica-Bold" fill={C.dark}>
        {fmtCompact(balance.totalAssets)}
      </SvgLabel>
      <SvgLabel x={assetX + barW / 2} y={labelY} textAnchor="middle"
        fontSize={7.5} fill={C.gray}>ACTIU</SvgLabel>

      {/* Passiu (base) + Patrimoni net (destacat, a sobre) */}
      <Rect x={otherX} y={baseline - liabH} width={barW} height={liabH} fill={C.red} />
      <Rect x={otherX} y={baseline - liabH - netH} width={barW} height={netH} fill={C.gold} />
      <SvgLabel x={otherX + barW / 2} y={baseline - liabH - netH - 8} textAnchor="middle"
        fontSize={9} fontFamily="Helvetica-Bold" fill={C.dark}>
        {fmtCompact(balance.netWorth)}
      </SvgLabel>
      <SvgLabel x={otherX + barW / 2} y={labelY} textAnchor="middle"
        fontSize={7.5} fill={C.gray}>PASSIU + PATRIMONI NET</SvgLabel>

      {/* Llegenda */}
      <Rect x={40} y={legendY} width={7} height={7} fill={C.gold} />
      <SvgLabel x={51} y={legendY + 6} fontSize={7} fill={C.gray}>Patrimoni net</SvgLabel>
      <Rect x={140} y={legendY} width={7} height={7} fill={C.red} />
      <SvgLabel x={151} y={legendY + 6} fontSize={7} fill={C.gray}>Passiu (deute)</SvgLabel>
      <Rect x={230} y={legendY} width={7} height={7} fill={C.blue} />
      <SvgLabel x={241} y={legendY + 6} fontSize={7} fill={C.gray}>Actiu total</SvgLabel>
    </Svg>
  );
};

// ─── FLUX DE CAIXA: GRÀFIC DE CASCADA ───────────────────────────────────────

export const CashFlowWaterfall = ({ cashFlow }: { cashFlow: PersonalCashFlow }) => {
  const W = 460, H = 200, baseline = 150, barW = 100;
  const maxPositive = Math.max(cashFlow.grossAnnualIncome, cashFlow.annualExpenses, 1);
  const scale = 130 / maxPositive;
  const clampBelow = (h: number) => Math.min(h, 48);

  const incomeH  = cashFlow.grossAnnualIncome * scale;
  const expenseH = cashFlow.annualExpenses * scale;
  const topY     = baseline - incomeH;

  const balanceH   = clampBelow(Math.abs(cashFlow.annualBalance) * scale);
  const balanceY   = cashFlow.isDeficit ? baseline : baseline - balanceH;
  const balanceCol = cashFlow.isDeficit ? C.red : C.gold;

  const x1 = 40, x2 = 190, x3 = 340;

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={20} y1={baseline} x2={W - 20} y2={baseline} stroke={C.grayLight} strokeWidth={0.75} />

      {/* Ingressos */}
      <Rect x={x1} y={topY} width={barW} height={incomeH} fill={C.blue} />
      <SvgLabel x={x1 + barW / 2} y={topY - 8} textAnchor="middle"
        fontSize={9} fontFamily="Helvetica-Bold" fill={C.dark}>
        {fmtCompact(cashFlow.grossAnnualIncome)}
      </SvgLabel>
      <SvgLabel x={x1 + barW / 2} y={baseline + 16} textAnchor="middle"
        fontSize={7.5} fill={C.gray}>INGRESSOS BRUTS</SvgLabel>

      {/* Despeses (barra flotant, des del sostre d'ingressos fins al balanç) */}
      <Rect x={x2} y={topY} width={barW} height={expenseH} fill={C.amber} />
      <SvgLabel x={x2 + barW / 2} y={topY - 8} textAnchor="middle"
        fontSize={9} fontFamily="Helvetica-Bold" fill={C.dark}>
        {`-${fmtCompact(cashFlow.annualExpenses)}`}
      </SvgLabel>
      <SvgLabel x={x2 + barW / 2} y={baseline + 16} textAnchor="middle"
        fontSize={7.5} fill={C.gray}>DESPESES</SvgLabel>

      {/* Balanç final (estalvi, o dèficit si és negatiu) */}
      <Rect x={x3} y={balanceY} width={barW} height={balanceH} fill={balanceCol} />
      <SvgLabel x={x3 + barW / 2} y={(cashFlow.isDeficit ? balanceY + balanceH : balanceY) - 8}
        textAnchor="middle" fontSize={9} fontFamily="Helvetica-Bold" fill={C.dark}>
        {fmtCompact(cashFlow.annualBalance)}
      </SvgLabel>
      <SvgLabel x={x3 + barW / 2} y={baseline + 16} textAnchor="middle"
        fontSize={7.5} fill={C.gray}>
        {cashFlow.isDeficit ? 'DÈFICIT ANUAL' : 'ESTALVI ANUAL'}
      </SvgLabel>
    </Svg>
  );
};

// ─── SEMÀFOR DE RÀTIO ────────────────────────────────────────────────────────

export const StatusChip = ({ status }: { status: RatioStatus }) => (
  <Svg width={9} height={9} viewBox="0 0 9 9">
    <Rect x={0} y={0} width={9} height={9} fill={statusColor(status)} />
  </Svg>
);
