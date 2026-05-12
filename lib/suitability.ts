/**
 * MiFID II Suitability Assessment (Art. 54 Delegated Regulation 2017/565)
 *
 * Checks whether each product in a portfolio is suitable for the client's
 * profile, knowledge, objectives, and financial situation.
 */

import type { InvestorProfile } from './products';
import type { PortfolioAllocation } from './portfolio';
import type { InvestorQuestionnaire } from './scoring';

export type SuitabilityStatus = 'adequate' | 'borderline' | 'inadequate';

export interface ProductSuitability {
  productId:   string;
  productName: string;
  status:      SuitabilityStatus;
  reasons:     string[];
}

export interface SuitabilityReport {
  overall:        SuitabilityStatus;
  products:       ProductSuitability[];
  warnings:       string[];
  mifidCompliant: boolean;
}

// MiFID II Art. 54: maximum product risk level per investor profile
const MAX_RISK_PER_PROFILE: Record<InvestorProfile, number> = {
  conservador: 2,
  moderat:     3,
  dinamic:     4,
  agressiu:    5,
};

const KNOWLEDGE_SCORE: Record<string, number> = {
  'basic':    1,
  'intermedi': 2,
  'avançat':  3,
  'expert':   4,
};

/**
 * Runs a MiFID II suitability check on every product in the portfolio.
 * Returns per-product status and portfolio-level warnings.
 */
export function checkMiFIDSuitability(
  profile: InvestorProfile,
  questionnaire: InvestorQuestionnaire,
  allocations: PortfolioAllocation[],
): SuitabilityReport {
  const maxRisk      = MAX_RISK_PER_PROFILE[profile];
  const knowledge    = KNOWLEDGE_SCORE[questionnaire.financialKnowledge] ?? 1;
  const needsLiquidity = questionnaire.liquidityNeed === 'necessito-ja'
                      || questionnaire.liquidityNeed === 'potser-6-mesos';

  const products: ProductSuitability[] = allocations.map(alloc => {
    const { product } = alloc;
    const reasons: string[] = [];

    // Rule 1: product risk vs profile tolerance
    if (product.risk > maxRisk) {
      reasons.push(
        `Risc del producte (${product.risk}/5) supera el màxim per perfil ${profile} (${maxRisk}/5)`,
      );
    }

    // Rule 2: product not in recommendedProfiles
    if (product.recommendedProfiles && !product.recommendedProfiles.includes(profile)) {
      reasons.push(`Producte no recomanat per al perfil ${profile}`);
    }

    // Rule 3: complex product requires minimum knowledge
    if (product.risk >= 4 && knowledge < 2) {
      reasons.push(
        `Producte complex (risc ≥4) requereix coneixement financer mínim "intermedi" — client: "${questionnaire.financialKnowledge}"`,
      );
    }

    // Rule 4: liquidity mismatch
    if (needsLiquidity && product.risk >= 4) {
      reasons.push(
        'Necessitat de liquiditat a curt termini incompatible amb producte d\'alta volatilitat',
      );
    }

    // Rule 5: investment horizon too short for equity
    if (
      questionnaire.investmentHorizon < 3 &&
      product.assetClass.includes('renda-variable')
    ) {
      reasons.push(
        `Horitzó d\'inversió (${questionnaire.investmentHorizon} anys) massa curt per a renda variable`,
      );
    }

    const status: SuitabilityStatus =
      reasons.length === 0                         ? 'adequate'  :
      reasons.length === 1 && product.risk <= maxRisk + 1 ? 'borderline' :
      'inadequate';

    return { productId: product.id, productName: product.name, status, reasons };
  });

  // Portfolio-level warnings
  const warnings: string[] = [];

  const equityPct = allocations
    .filter(a => a.product.assetClass.startsWith('renda-variable'))
    .reduce((s, a) => s + a.weight, 0);

  if (profile === 'conservador' && equityPct > 30) {
    warnings.push(
      `Pes en renda variable (${equityPct}%) elevat per a perfil conservador (MiFID II recomana ≤30%)`,
    );
  }
  if (profile === 'moderat' && equityPct > 75) {
    warnings.push(
      `Pes en renda variable (${equityPct}%) elevat per a perfil moderat (MiFID II recomana ≤75%)`,
    );
  }

  const inadequate = products.filter(p => p.status === 'inadequate').length;
  const borderline = products.filter(p => p.status === 'borderline').length;

  const overall: SuitabilityStatus =
    inadequate > 0          ? 'inadequate' :
    borderline > 2          ? 'borderline' :
    warnings.length > 0     ? 'borderline' :
    'adequate';

  return {
    overall,
    products,
    warnings,
    mifidCompliant: overall !== 'inadequate',
  };
}

export function suitabilityLabel(status: SuitabilityStatus): string {
  return status === 'adequate'    ? 'Adequat'    :
         status === 'borderline'  ? 'Límit'      :
         'No adequat';
}

export function suitabilityColor(status: SuitabilityStatus): string {
  return status === 'adequate'    ? 'bg-emerald-100 text-emerald-700' :
         status === 'borderline'  ? 'bg-amber-100 text-amber-700'    :
         'bg-red-100 text-red-700';
}
