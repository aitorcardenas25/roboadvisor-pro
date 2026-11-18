// lib/featureFlags.ts
// Interruptors de funcionalitats sensibles des del punt de vista regulatori.
//
// FACTOR OTC opera sense llicència d'assessorament (ESI/EAF). Qualsevol funció
// que recomani instruments concrets (fons per ISIN, imports, senyals de compra/
// venda, ratings COMPRAR/VENDRE) pot constituir assessorament en matèria
// d'inversió (MiFID II art. 4.1.4) o recomanació d'inversió (MAR art. 3.1.35).
//
// Decisió 2026-11-06: per prioritzar el producte, les recomanacions estan
// ACTIVADES per defecte. Abans d'obrir l'app a clients fora del cercle de
// confiança (o de cobrar), cal revisar-ho amb l'advocat i, si cal, desactivar-les
// amb NEXT_PUBLIC_ENABLE_RECOMMENDATIONS=false (un sol canvi a Vercel).

/** Recomanacions personalitzades: cartera amb fons concrets, senyals i ratings. */
export const RECOMMENDATIONS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_RECOMMENDATIONS !== 'false';

// ── Beta tancada (decisió 2026-11-18) ─────────────────────────────────────────
// Durant la beta només es veu el flux principal: Excel del client → proposta →
// cartera amb preus oficials → informes. La resta (notícies, newsletter, accions,
// informes borsaris, carteres model, comparador, qüestionari públic amb pagament)
// queda amagada. El codi NO s'esborra: amb
// NEXT_PUBLIC_SHOW_NON_BETA_FEATURES=true torna a aparèixer tot.

/** Mostra les funcionalitats que no formen part de la beta tancada. */
export const SHOW_NON_BETA_FEATURES =
  process.env.NEXT_PUBLIC_SHOW_NON_BETA_FEATURES === 'true';

/**
 * Informe fiscal (IRPF) al portal del client. Decisió d'Aitor 2026-11-18: es
 * mostra als clients, amb l'avís que és orientatiu i no revisat per un expert.
 * Es pot amagar amb NEXT_PUBLIC_ENABLE_CLIENT_TAX_REPORT=false.
 */
export const CLIENT_TAX_REPORT_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_CLIENT_TAX_REPORT !== 'false';

/** Pàgines que no formen part de la beta tancada (prefixos de ruta). */
export const NON_BETA_PAGES = [
  '/client/roboadvisor',
  '/client/carteres-model',
  '/client/seguiment-accions',
  '/comparador',
  '/informe-bursatil',
  '/noticies',
  '/accions',
  '/checkout',
] as const;

/** true si la ruta és d'una pàgina amagada durant la beta. */
export function isNonBetaPage(pathname: string): boolean {
  return NON_BETA_PAGES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}
