import { describe, it, expect } from 'vitest';
import { ADVISOR_FUNDS, isValidIsin } from '@/lib/fundUniverse';
import { FUND_PLATFORMS, PLATFORMS, platformsFor, availableLabel, isExchangeTraded } from '@/lib/fundPlatforms';

describe('fundPlatforms', () => {
  it('only lists valid ISINs that are in the advisor list', () => {
    const advisor = new Set(ADVISOR_FUNDS.map(f => f.isin));
    for (const isin of Object.keys(FUND_PLATFORMS)) {
      expect(isValidIsin(isin), isin).toBe(true);
      expect(advisor.has(isin), isin).toBe(true);
    }
  });

  it('every non-ETF advisor fund has been checked on MyInvestor and Openbank', () => {
    for (const f of ADVISOR_FUNDS.filter(f => !isExchangeTraded(f.name))) {
      expect(FUND_PLATFORMS[f.isin]?.myinvestor, f.isin).toBeDefined();
      expect(FUND_PLATFORMS[f.isin]?.openbank, f.isin).toBeDefined();
    }
  });

  it('splits verified, not found and unchecked platforms', () => {
    const info = platformsFor('IE0031786696', 'Vanguard Emerging Markets Stock Index Fund EUR');
    expect(info.available.map(p => p.id)).toEqual(['myinvestor']);
    expect(info.notFound.map(p => p.id)).toEqual(['openbank']);
    // Trade Republic i DEGIRO només venen ETF: no s'ofereixen per a un fons.
    expect(info.unchecked.map(p => p.id)).toEqual(['renta4']);
  });

  it('ETFs leave every broker as unchecked and never claim availability', () => {
    const info = platformsFor('IE00B4L5Y983', 'iShares Core MSCI World UCITS ETF USD Acc');
    expect(info.available).toEqual([]);
    expect(info.unchecked.map(p => p.id)).toEqual(['myinvestor', 'openbank', 'trade-republic', 'degiro', 'renta4']);
  });

  it('Spanish value funds can be bought directly from the manager', () => {
    expect(availableLabel('ES0114673033', 'Bestinfond FI')).toBe('Directament a la gestora');
    expect(availableLabel('ES0112611001', 'Azvalor Internacional FI')).toBe('MyInvestor, Directament a la gestora');
  });

  it('unknown ISINs have nothing verified', () => {
    expect(platformsFor('LU0000000000').available).toEqual([]);
    expect(PLATFORMS.length).toBeGreaterThan(0);
  });
});
