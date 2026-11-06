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
