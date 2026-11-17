// lib/taxReportServer.ts — informe fiscal a partir de les operacions de la cartera.
import type { ClientPortfolio } from './clientPortfolios';
import { buildTaxReport, isTransferNote, type TaxReport, type TaxTx } from './taxReport';

export function taxTxsOf(p: ClientPortfolio): TaxTx[] {
  const byId = new Map(p.holdings.map(h => [h.id, h]));
  return p.transactions
    .filter(t => t.operationType === 'buy' || t.operationType === 'sell')
    .map(t => {
      const h = t.holdingId ? byId.get(t.holdingId) : undefined;
      return {
        isin: (h?.assetIsin || t.ticker || t.assetName || '').toUpperCase(),
        name: h?.assetName || t.assetName || t.ticker || '',
        type: t.operationType as 'buy' | 'sell',
        date: t.date, quantity: t.quantity, amount: t.totalEur, commission: t.commission || 0,
        transfer: isTransferNote(t.notes),
      };
    })
    .filter(t => t.isin);
}

export const taxReportOf = (p: ClientPortfolio): TaxReport => buildTaxReport(taxTxsOf(p));
