import { NextRequest, NextResponse } from 'next/server';
import { FINANCIAL_PRODUCTS } from '@/lib/products';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = FINANCIAL_PRODUCTS.find(p => p.id === id || p.isin === id);
  if (!product) return NextResponse.json({ error: 'Fons no trobat.' }, { status: 404 });

  // Normalitzem la resposta amb tots els camps del comparador
  return NextResponse.json({
    fund: {
      id:                  product.id,
      name:                product.name,
      isin:                product.isin,
      manager:             product.manager,
      category:            product.category,
      assetClass:          product.assetClass,
      region:              product.region,
      managementType:      product.managementType,
      benchmark:           product.benchmark,
      risk:                product.risk,
      recommendedProfiles: product.recommendedProfiles,
      ter:                 product.ter,
      currency:            product.currency,
      dataStatus:          product.dataStatus,
      justification:       product.justification,
      // Quantitatives
      historicalReturn5Y:  product.historicalReturn5Y  ?? null,
      historicalVolatility:product.historicalVolatility ?? null,
      maxDrawdownEstimate: product.maxDrawdownEstimate  ?? null,
      yieldEstimate:       product.yieldEstimate        ?? null,
      durationYears:       product.durationYears        ?? null,
      inceptionYear:       product.inceptionYear        ?? null,
      aum:                 product.aum                  ?? null,
      // Classificació
      morningstarCategory: product.morningstarCategory  ?? null,
      morningstarRating:   product.morningstarRating    ?? null,
      sfdrArticle:         product.sfdrArticle          ?? null,
      mifidRiskIndicator:  product.mifidRiskIndicator   ?? null,
      // Nota: dades de mercat en temps real s'obtindrien d'APIs externes (FMP/Alpha Vantage)
      realtimeNote: product.dataStatus !== 'validated'
        ? 'Dades estimades. Connecta FMP_API_KEY per dades en temps real.'
        : null,
    },
  });
}
