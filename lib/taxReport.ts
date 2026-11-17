// lib/taxReport.ts — part pura: informe fiscal (IRPF) de les vendes de fons d'un client.
//
// Normativa aplicada (Espanya, persona física resident):
//  · Guany o pèrdua patrimonial = valor de transmissió − valor d'adquisició, amb
//    les comissions incloses (art. 35 LIRPF).
//  · Participacions homogènies: es consideren venudes les comprades primer, FIFO
//    (art. 37.2 LIRPF).
//  · Traspàs entre fons (art. 94.1.a LIRPF): no tributa; el fons de destí hereta
//    el valor i la data d'adquisició de les participacions venudes. No s'aplica als
//    ETF (cotitzen en borsa): una venda d'ETF sempre tributa.
//  · Pèrdua amb recompra del mateix fons en el termini d'un any abans o després:
//    es pot haver de diferir (art. 33.5 LIRPF). Aquí només s'avisa.
//  · Base de l'estalvi (art. 66 i 76 LIRPF, escala vigent des del 2025):
//    19 % fins a 6.000 €, 21 % fins a 50.000 €, 23 % fins a 200.000 €,
//    27 % fins a 300.000 € i 30 % a partir d'aquí. L'estimació és orientativa:
//    no compta altres rendiments ni pèrdues d'anys anteriors.
//
// Els traspassos es marquen a les operacions amb TRANSFER_TAG al començament de
// les notes (les taules no tenen cap camp propi; quan es toqui l'esquema de
// Supabase es pot passar a una columna).

export const TRANSFER_TAG = '[traspàs]';
export const isTransferNote = (notes?: string) => !!notes?.trimStart().startsWith(TRANSFER_TAG);
export const isEtf = (name: string) => /\bETFs?\b/i.test(name);

export const SAVINGS_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 6_000, rate: 19 }, { upTo: 50_000, rate: 21 }, { upTo: 200_000, rate: 23 },
  { upTo: 300_000, rate: 27 }, { upTo: Infinity, rate: 30 },
];

export interface TaxTx {
  isin: string; name: string; type: 'buy' | 'sell'; date: string;
  quantity: number; amount: number; commission: number; transfer: boolean;
}

interface Lot { qty: number; cost: number; date: string }

export interface RealizedSale {
  date: string; isin: string; name: string; quantity: number;
  transmissionValue: number;     // import − comissió
  acquisitionValue: number;      // cost FIFO de les participacions venudes
  gain: number;
  acquiredFrom: string;          // data de la compra més antiga venuda
  acquiredTo: string;            // data de la més recent
  partialTransfer?: boolean;     // part d'un traspàs que no s'ha reinvertit
  washSale?: boolean;            // pèrdua amb recompra del mateix fons ±1 any
}

export interface TransferEvent {
  date: string;
  from: { name: string; isin: string; value: number; cost: number }[];
  to:   { name: string; isin: string; value: number; inheritedCost: number }[];
  deferredGain: number;          // guany que no tributa ara (passa al fons de destí)
}

export interface TaxYear {
  year: number; gains: number; losses: number; net: number;
  estimatedTax: number;          // orientatiu, només si net > 0
  sales: RealizedSale[]; transfers: TransferEvent[];
}

export interface OpenLot { isin: string; name: string; quantity: number; cost: number; date: string }

export interface TaxReport { years: TaxYear[]; open: OpenLot[]; warnings: string[] }

const r2 = (n: number) => Math.round(n * 100) / 100;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

export function savingsTax(base: number): number {
  let tax = 0, prev = 0;
  for (const b of SAVINGS_BRACKETS) {
    if (base <= prev) break;
    tax += (Math.min(base, b.upTo) - prev) * b.rate / 100;
    prev = b.upTo;
  }
  return r2(tax);
}

/** Treu `qty` participacions dels lots FIFO; retorna els trossos consumits. */
function consume(lots: Lot[], qty: number): { taken: Lot[]; short: number } {
  const taken: Lot[] = [];
  let left = qty;
  while (left > 1e-9 && lots.length) {
    const l = lots[0];
    const q = Math.min(l.qty, left);
    const c = l.cost * q / l.qty;
    taken.push({ qty: q, cost: c, date: l.date });
    l.qty = r6(l.qty - q); l.cost -= c; left = r6(left - q);
    if (l.qty <= 1e-9) lots.shift();
  }
  return { taken, short: left };
}

export function buildTaxReport(input: TaxTx[]): TaxReport {
  const warnings: string[] = [];
  // Per data; dins del mateix dia, primer les vendes (un traspàs és venda + compra).
  const txs = [...input].map(t => ({ ...t, isin: t.isin.toUpperCase(), date: t.date.slice(0, 10) }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.type === b.type ? 0 : a.type === 'sell' ? -1 : 1));
  for (const t of txs) {
    if (t.transfer && isEtf(t.name)) {
      t.transfer = false;
      warnings.push(`${t.name} (${t.date}): és un ETF i no es pot traspassar sense tributar; es compta com a ${t.type === 'sell' ? 'venda' : 'compra'}.`);
    }
  }

  const lots = new Map<string, Lot[]>();
  const names = new Map<string, string>();
  const sales: RealizedSale[] = [];
  const transfers: TransferEvent[] = [];

  const byDate = new Map<string, typeof txs>();
  for (const t of txs) { names.set(t.isin, t.name); byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]); }

  for (const [date, group] of byDate) {
    const pool: { lot: Lot; value: number; isin: string }[] = [];
    const from: TransferEvent['from'] = [];
    for (const t of group.filter(x => x.type === 'sell')) {
      const own = lots.get(t.isin) ?? [];
      const { taken, short } = consume(own, t.quantity);
      if (short > 1e-6) warnings.push(`${t.name} (${date}): es venen ${t.quantity} participacions però només n'hi havia ${r6(t.quantity - short)} registrades. Falten compres anteriors.`);
      const value = t.amount - (t.commission || 0);
      const cost = taken.reduce((s, l) => s + l.cost, 0);
      const soldQty = taken.reduce((s, l) => s + l.qty, 0);
      if (t.transfer) {
        // El valor de cada tros, proporcional a les participacions
        for (const l of taken) pool.push({ lot: l, value: soldQty > 0 ? value * l.qty / soldQty : 0, isin: t.isin });
        from.push({ name: t.name, isin: t.isin, value: r2(value), cost: r2(cost) });
      } else {
        sales.push(sale(t.isin, t.name, date, soldQty, value, taken));
      }
    }

    const tBuys = group.filter(x => x.type === 'buy' && x.transfer);
    const poolValue = pool.reduce((s, p) => s + p.value, 0);
    const buyTotal = tBuys.reduce((s, b) => s + b.amount + (b.commission || 0), 0);
    const to: TransferEvent['to'] = [];
    // Part del traspàs reinvertida (≤ 1) i part de les compres pagada amb el traspàs (≤ 1)
    const reinvested = poolValue > 0 ? Math.min(1, buyTotal / poolValue) : 0;
    const funded = buyTotal > 0 ? Math.min(1, poolValue / buyTotal) : 0;
    if (pool.length && reinvested < 1 - 1e-9) {
      // Diners del traspàs que no es reinverteixen: aquesta part tributa com una venda.
      const byIsin = new Map<string, { qty: number; value: number; taken: Lot[] }>();
      for (const p of pool) {
        const e = byIsin.get(p.isin) ?? { qty: 0, value: 0, taken: [] };
        const f = 1 - reinvested;
        e.qty += p.lot.qty * f; e.value += p.value * f; e.taken.push({ qty: p.lot.qty * f, cost: p.lot.cost * f, date: p.lot.date });
        byIsin.set(p.isin, e);
      }
      for (const [isin, e] of byIsin) sales.push({ ...sale(isin, names.get(isin)!, date, e.qty, e.value, e.taken), partialTransfer: true });
    }
    for (const t of group.filter(x => x.type === 'buy')) {
      const own = lots.get(t.isin) ?? [];
      const total = t.amount + (t.commission || 0);
      if (t.transfer && pool.length) {
        const share = buyTotal > 0 ? total / buyTotal : 0;    // part d'aquesta compra dins les compres del traspàs
        // Hereta un tros de cada lot venut (cost i data), proporcional al valor
        let inherited = 0;
        for (const p of pool) {
          const f = reinvested * share;
          const qty = t.quantity * funded * (poolValue > 0 ? p.value / poolValue : 0);
          own.push({ qty: r6(qty), cost: p.lot.cost * f, date: p.lot.date });
          inherited += p.lot.cost * f;
        }
        const fresh = 1 - funded;
        if (fresh > 1e-9) own.push({ qty: r6(t.quantity * fresh), cost: total * fresh, date });
        to.push({ name: t.name, isin: t.isin, value: r2(total), inheritedCost: r2(inherited) });
      } else {
        own.push({ qty: t.quantity, cost: total, date });
      }
      own.sort((a, b) => a.date.localeCompare(b.date));   // FIFO per data d'adquisició (també l'heretada)
      lots.set(t.isin, own);
    }
    if (from.length) {
      const fromValue = from.reduce((s, f) => s + f.value, 0), fromCost = from.reduce((s, f) => s + f.cost, 0);
      transfers.push({ date, from, to, deferredGain: r2((fromValue - fromCost) * reinvested) });
    }
  }

  // Pèrdues amb recompra del mateix fons dins d'un any abans o després
  for (const s of sales) {
    if (s.gain >= 0) continue;
    s.washSale = txs.some(t => t.type === 'buy' && t.isin === s.isin && t.date >= addDays(s.date, -365) && t.date <= addDays(s.date, 365) && t.date !== s.date);
  }

  const years = [...new Set([...sales.map(s => s.date), ...transfers.map(t => t.date)].map(d => Number(d.slice(0, 4))))].sort();
  return {
    years: years.map(year => {
      const ys = sales.filter(s => Number(s.date.slice(0, 4)) === year);
      const gains = r2(ys.filter(s => s.gain > 0).reduce((a, s) => a + s.gain, 0));
      const losses = r2(ys.filter(s => s.gain < 0).reduce((a, s) => a + s.gain, 0));
      const net = r2(gains + losses);
      return { year, gains, losses, net, estimatedTax: net > 0 ? savingsTax(net) : 0, sales: ys, transfers: transfers.filter(t => Number(t.date.slice(0, 4)) === year) };
    }),
    open: [...lots].flatMap(([isin, ls]) => ls.filter(l => l.qty > 1e-6).map(l => ({ isin, name: names.get(isin) ?? isin, quantity: r6(l.qty), cost: r2(l.cost), date: l.date }))),
    warnings,
  };
}

function sale(isin: string, name: string, date: string, qty: number, value: number, taken: Lot[]): RealizedSale {
  const cost = taken.reduce((s, l) => s + l.cost, 0);
  const dates = taken.map(l => l.date).sort();
  return {
    date, isin, name, quantity: r6(qty), transmissionValue: r2(value), acquisitionValue: r2(cost), gain: r2(value - cost),
    acquiredFrom: dates[0] ?? date, acquiredTo: dates.at(-1) ?? date,
  };
}
