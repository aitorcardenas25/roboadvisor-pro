import { describe, it, expect } from 'vitest';
import {
  addItem, updateItem, removeItem, listItems, consolidateWealth, investmentReturn,
  WealthItemInputSchema, STALE_DAYS, type TrackedHolding,
} from '@/lib/wealth';
import type { Valuation } from '@/lib/portfolioValuation';

const now = new Date('2026-11-18T10:00:00Z');
const TODAY = '2026-11-18';
const input = (o: Record<string, unknown>) => WealthItemInputSchema.parse(o);

const fund = (o: Partial<TrackedHolding> = {}): TrackedHolding => ({
  assetName: 'Vanguard Global Stock', assetIsin: 'IE00B03HD191', broker: 'MyInvestor',
  quantity: 100, currentPrice: 50, priceLastUpdated: '2026-11-14', priceSource: 'manual', ...o,
});

function withItems(...items: Record<string, unknown>[]) {
  let q: Record<string, unknown> = { riskTolerance: 3 };
  for (const it of items) {
    const r = addItem(q, input(it), 'client', now);
    if ('error' in r) throw new Error(r.error);
    q = r.next;
  }
  return q;
}

describe('elements de patrimoni', () => {
  it('afegeix, actualitza i esborra sense tocar la resta de la fitxa', () => {
    const q = withItems({ kind: 'compte', name: 'Nòmina', entity: 'CaixaBank', value: 3200.456, asOf: '2026-11-01' });
    const [item] = listItems(q);
    expect(item).toMatchObject({ kind: 'compte', value: 3200.46, addedBy: 'client' });
    expect(q.riskTolerance).toBe(3);

    const upd = updateItem(q, item.id, input({ kind: 'compte', name: 'Nòmina', entity: 'CaixaBank', value: 4000, asOf: '2026-11-18' }), now)!;
    expect(listItems(upd)[0]).toMatchObject({ value: 4000, asOf: '2026-11-18', id: item.id });

    expect(listItems(removeItem(upd, item.id)!)).toEqual([]);
    expect(removeItem(upd, 'no-existeix')).toBeNull();
    expect(updateItem(upd, 'no-existeix', input({ kind: 'compte', name: 'x', value: 1, asOf: TODAY }))).toBeNull();
  });

  it('valida el tipus, l\'import i la data', () => {
    expect(WealthItemInputSchema.safeParse({ kind: 'iot', name: 'x', value: 1, asOf: TODAY }).success).toBe(false);
    expect(WealthItemInputSchema.safeParse({ kind: 'compte', name: 'x', value: -1, asOf: TODAY }).success).toBe(false);
    expect(WealthItemInputSchema.safeParse({ kind: 'compte', name: ' ', value: 1, asOf: TODAY }).success).toBe(false);
    expect(WealthItemInputSchema.safeParse({ kind: 'compte', name: 'x', value: 1, asOf: '18/11/2026' }).success).toBe(false);
  });
});

describe('consolidateWealth', () => {
  it('suma fons seguits + béns declarats − deutes i agrupa per tipus i entitat', () => {
    const q = withItems(
      { kind: 'compte',   name: 'Nòmina',     entity: 'CaixaBank', value: 6000,   asOf: '2026-11-01' },
      { kind: 'pensions', name: 'Pla feina',  entity: 'CaixaBank', value: 4000,   asOf: '2026-10-31' },
      { kind: 'immoble',  name: 'Pis Vic',    entity: '',          value: 180000, asOf: '2026-06-01' },
      { kind: 'hipoteca', name: 'Hipoteca',   entity: 'CaixaBank', value: 120000, asOf: '2026-11-01' },
    );
    const w = consolidateWealth({ holdings: [fund()], netContributed: 4000, questionnaire: { ...q, currentSavings: 9999 }, today: TODAY });

    expect(w.grossAssets).toBe(5000 + 6000 + 4000 + 180000);
    expect(w.totalDebt).toBe(120000);
    expect(w.netWorth).toBe(75000);
    // Amb un compte declarat, l'estalvi del qüestionari no es torna a sumar
    expect(w.groups.find(g => g.group === 'liquiditat')!.value).toBe(6000);
    expect(w.groups.map(g => [g.group, g.value])).toEqual([
      ['inversions', 9000], ['liquiditat', 6000], ['immobles', 180000],
    ]);
    expect(w.groups.reduce((s, g) => s + g.pct, 0)).toBeCloseTo(100, 1);
    expect(w.byEntity[0]).toMatchObject({ entity: 'Immobles', value: 180000 });
    expect(w.byEntity.find(e => e.entity === 'CaixaBank')!.value).toBe(10000);
    expect(w.byEntity.find(e => e.entity === 'MyInvestor')!.value).toBe(5000);
    // fons seguits: font oficial
    expect(w.groups[0].lines.find(l => l.name === 'Vanguard Global Stock')!.source).toBe('preus-oficials');
  });

  it('sense comptes declarats, fa servir l\'estalvi i el deute total del qüestionari', () => {
    const w = consolidateWealth({ holdings: [], netContributed: 0, questionnaire: { currentSavings: 8000, totalDebt: 1500, netWorth: 7000 }, today: TODAY });
    expect(w.grossAssets).toBe(8000);
    expect(w.totalDebt).toBe(1500);
    expect(w.netWorth).toBe(6500);
    expect(w.groups[0].lines[0].source).toBe('questionari');
    expect(w.debts[0].source).toBe('questionari');
    expect(w.declaredNetWorth).toBe(7000);
    expect(w.investments).toBeNull();
  });

  it('no compta les posicions pendents ni les venudes i avisa dels valors antics', () => {
    const old = new Date(Date.parse(TODAY) - (STALE_DAYS + 5) * 86_400_000).toISOString().slice(0, 10);
    const q = withItems({ kind: 'diposit', name: 'Dipòsit 12m', value: 10000, asOf: old });
    const w = consolidateWealth({
      holdings: [fund(), fund({ assetName: 'Pendent', priceSource: 'pending', currentPrice: 0, quantity: 0 }), fund({ assetName: 'Venut', quantity: 0 })],
      netContributed: 4000, questionnaire: q, today: TODAY,
    });
    expect(w.grossAssets).toBe(15000);
    expect(w.pendingHoldings).toBe(1);
    expect(w.groups.flatMap(g => g.lines).find(l => l.kind === 'diposit')!.stale).toBe(true);
    expect(w.warnings.join(' ')).toMatch(/fa més de 4 mesos/);
    expect(w.warnings.join(' ')).toMatch(/1 posició pendent/);
  });

  it('client buit: tot a zero, sense dividir per zero', () => {
    const w = consolidateWealth({ holdings: [], netContributed: 0, questionnaire: null, today: TODAY });
    expect(w).toMatchObject({ grossAssets: 0, totalDebt: 0, netWorth: 0, groups: [], byEntity: [], investments: null });
  });
});

describe('investmentReturn (Modified Dietz encadenat)', () => {
  it('descompta les aportacions: posar més diners no és guanyar', () => {
    // Gen: compra 10.000. Febrer: +10 %. Març: aporta 11.000 i el mercat queda pla.
    const val: Valuation = { source: 'navs', missing: [], points: [
      { date: '2026-01-15', value: 10000, invested: 10000 },
      { date: '2026-01-31', value: 10000, invested: 10000 },
      { date: '2026-02-28', value: 11000, invested: 10000 },
      { date: '2026-03-31', value: 22000, invested: 21000 },
    ] };
    const r = investmentReturn(val, { value: 22000, netContributed: 21000 }, '2026-11-18');
    expect(r.method).toBe('navs');
    expect(r.twrPct).toBeCloseTo(10, 2);
    expect(r.ytdPct).toBeCloseTo(10, 2);
    expect(r.gainEur).toBe(1000);
    expect(r.annualPct).toBeNull();     // menys d'un any: no s'anualitza
    expect(r.since).toBe('2026-01-15');
  });

  it('anualitza quan hi ha més d\'un any de dades', () => {
    const val: Valuation = { source: 'navs', missing: [], points: [
      { date: '2024-11-30', value: 10000, invested: 10000 },
      { date: '2025-11-30', value: 11000, invested: 10000 },
      { date: '2026-11-30', value: 12100, invested: 10000 },
    ] };
    const r = investmentReturn(val, { value: 12100, netContributed: 10000 }, '2026-12-01');
    expect(r.twrPct).toBeCloseTo(21, 1);
    expect(r.annualPct!).toBeCloseTo(10, 0);
  });

  it('sense sèrie oficial, guany simple sobre el capital aportat', () => {
    const r = investmentReturn(null, { value: 5000, netContributed: 4000 }, TODAY);
    expect(r).toMatchObject({ method: 'simple', twrPct: 25, gainEur: 1000, ytdPct: null });
    expect(investmentReturn(null, { value: 0, netContributed: 0 }, TODAY).twrPct).toBeNull();
  });
});
