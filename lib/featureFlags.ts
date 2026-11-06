// lib/featureFlags.ts
// Interruptors de funcionalitats sensibles des del punt de vista regulatori.
//
// FACTOR OTC opera sense llicència d'assessorament (ESI/EAF). Qualsevol funció
// que recomani instruments concrets (fons per ISIN, imports, senyals de compra/
// venda, ratings COMPRAR/VENDRE) pot constituir assessorament en matèria
// d'inversió (MiFID II art. 4.1.4) o recomanació d'inversió (MAR art. 3.1.35).
//
// Per defecte TOT està desactivat. Només s'ha d'activar en entorns locals de
// demo/TFG, mai en un desplegament accessible per clients.

/** Recomanacions personalitzades: cartera amb fons concrets, senyals i ratings. */
export const RECOMMENDATIONS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_RECOMMENDATIONS === 'true';
