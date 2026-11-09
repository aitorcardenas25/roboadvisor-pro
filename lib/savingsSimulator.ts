// lib/savingsSimulator.ts
// Simulador d'estalvi: quant tindré si estalvio X €/mes durant Y anys?
// El rendiment és una HIPÒTESI que tria l'usuari (escenari), no una previsió
// ni una dada de mercat: el simulador no recomana cap producte.
//
// Fonts:
// - Valor futur d'una anualitat amb aportacions a final de mes:
//   FV = P·(1+i)^n + A·((1+i)^n − 1)/i   (matemàtica financera clàssica)
// - Taxa mensual equivalent: i = (1+r)^(1/12) − 1
// - Valor real (euros d'avui): FV / (1+π)^anys
// - Inflació de referència per defecte: objectiu del BCE, 2 % (estratègia 2021).

export const ECB_INFLATION_TARGET = 2;          // % anual, BCE (2021)
/** Escenaris hipotètics que l'usuari pot triar; no són rendiments esperats. */
export const RETURN_SCENARIOS = [0, 2, 4, 6] as const;

export interface SimulationInput {
  initial:         number;   // € que ja té
  monthly:         number;   // € que aporta cada mes
  years:           number;   // 1-60
  annualReturnPct: number;   // hipòtesi, % anual
  inflationPct?:   number;   // % anual, per defecte 2
}

export interface SimulationRow { year: number; contributed: number; nominal: number; real: number }

export interface SimulationResult {
  rows:        SimulationRow[];   // un per any
  contributed: number;
  nominal:     number;
  real:        number;
  gain:        number;            // nominal − aportat
}

const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;
const r2 = (n: number) => Math.round(n * 100) / 100;

function futureValue(initial: number, monthly: number, months: number, i: number): number {
  const g = Math.pow(1 + i, months);
  return initial * g + (i === 0 ? monthly * months : monthly * (g - 1) / i);
}

export function simulateSavings(inp: SimulationInput): SimulationResult | null {
  const { initial, monthly, years, annualReturnPct } = inp;
  const infl = inp.inflationPct ?? ECB_INFLATION_TARGET;
  if (![initial, monthly, years, annualReturnPct, infl].every(Number.isFinite)) return null;
  if (initial < 0 || monthly < 0 || years < 1 || years > 60 || !Number.isInteger(years)) return null;
  if (annualReturnPct <= -100 || infl <= -100) return null;

  const i = monthlyRate(annualReturnPct);
  const rows: SimulationRow[] = [];
  for (let y = 1; y <= years; y++) {
    const nominal = futureValue(initial, monthly, y * 12, i);
    rows.push({
      year: y,
      contributed: r2(initial + monthly * 12 * y),
      nominal: r2(nominal),
      real: r2(nominal / Math.pow(1 + infl / 100, y)),
    });
  }
  const last = rows[rows.length - 1];
  return { rows, contributed: last.contributed, nominal: last.nominal, real: last.real, gain: r2(last.nominal - last.contributed) };
}

/**
 * Aportació mensual necessària per arribar a `target` € (nominals) en `months`
 * mesos, partint de `initial`. Retorna 0 si ja s'hi arriba sense aportar.
 */
export function requiredMonthly(target: number, months: number, initial: number, annualReturnPct: number): number | null {
  if (!(target > 0) || !(months >= 1) || initial < 0 || annualReturnPct <= -100) return null;
  const i = monthlyRate(annualReturnPct);
  const g = Math.pow(1 + i, months);
  const remaining = target - initial * g;
  if (remaining <= 0) return 0;
  return r2(i === 0 ? remaining / months : remaining * i / (g - 1));
}
