// lib/portfolioData.ts — Curated portfolio definitions with ETF/fund holdings.

export interface Fund {
  name:     string;
  ticker:   string;
  isin:     string;
  weight:   number;   // %
  ter:      number;   // % annual
  category: string;
  risk:     number;   // 1-7 SRRI
  justification: string;
}

export interface PortfolioDetail {
  id:          string;
  name:        string;
  subtitle:    string;
  risk:        number;  // 1-5
  returnEst:   string;
  volatility:  string;
  horizon:     string;
  highlight:   string;
  description: string;
  allocations: { label: string; pct: number; color: string }[];
  funds:       Fund[];
  whereToBuy:  { platform: string; note: string; url?: string }[];
  rationale:   string;
}

export const PORTFOLIOS_DETAIL: PortfolioDetail[] = [
  {
    id: 'conservador',
    name: 'Conservador',
    subtitle: 'Preservació de capital',
    risk: 2,
    returnEst: '3–5%',
    volatility: '4–6%',
    horizon: '2–4 anys',
    highlight: '#16a34a',
    description: 'Cartera dissenyada per a inversors amb baixa tolerància al risc o horitzó curt. El pes dominant en renda fixa de qualitat preserva el capital en correccions de mercat. Adequada per a capital que no pot permetre\'s pèrdues significatives.',
    allocations: [
      { label: 'Renda fixa curta',  pct: 30, color: '#16a34a' },
      { label: 'Renda fixa llarga', pct: 25, color: '#22c55e' },
      { label: 'Corporatiu IG',     pct: 25, color: '#86efac' },
      { label: 'Renda variable',    pct: 10, color: '#c9a84c' },
      { label: 'Liquiditat',        pct: 10, color: '#6b7280' },
    ],
    funds: [
      {
        name: 'iShares € Govt Bond 1-3yr UCITS ETF',
        ticker: 'IB13', isin: 'IE00B14X4Q57',
        weight: 30, ter: 0.07, category: 'Renda fixa pública curta EUR', risk: 2,
        justification: 'Protecció contra la inflació a curt termini amb volatilitat molt baixa. Rendiment en línia amb tipus BCE.',
      },
      {
        name: 'Vanguard Euro Government Bond Index EUR Acc',
        ticker: 'VEUR', isin: 'IE00B4WXJJ64',
        weight: 25, ter: 0.07, category: 'Renda fixa pública EUR', risk: 3,
        justification: 'Exposició diversificada a deute sobirà eurozona. TER mínim de Vanguard redueix cost total de la cartera.',
      },
      {
        name: 'iShares € Corporate Bond UCITS ETF',
        ticker: 'IEBC', isin: 'IE00B3F81R35',
        weight: 25, ter: 0.20, category: 'Renda fixa corporativa IG EUR', risk: 3,
        justification: 'Spread addicional sobre deute sobirà sense augmentar el risc significativament. Empreses Investment Grade.',
      },
      {
        name: 'Vanguard FTSE All-World UCITS ETF Acc',
        ticker: 'VWCE', isin: 'IE00BK5BQT80',
        weight: 10, ter: 0.22, category: 'Renda variable global', risk: 4,
        justification: 'Petit component de creixement per superar la inflació a llarg termini. Diversificació global màxima.',
      },
      {
        name: 'Xtrackers EUR Overnight Rate Swap ETF',
        ticker: 'XEON', isin: 'LU0290358497',
        weight: 10, ter: 0.10, category: 'Mercat monetari EUR', risk: 1,
        justification: 'Equivalent a liquiditat amb rendiment del tipus a un dia BCE. Colchó per oportunitats o necessitats de liquiditat.',
      },
    ],
    whereToBuy: [
      { platform: 'Trade Republic', note: 'VWCE, XEON, IEBC disponibles. Comissió €1/operació.' },
      { platform: 'MyInvestor', note: 'VWCE, VEUR disponibles. Fons indexats amb cost 0.' },
      { platform: 'Interactive Brokers', note: 'Tots els ETFs disponibles. Millor per volums >€10.000.' },
      { platform: 'Banc tradicional', note: 'Generalment fons d\'inversió equivalents (cost TER més alt).' },
    ],
    rationale: "Pes 90% renda fixa / 10% variable òptim per a horitzó curt. TER mig ponderat <0.12% — un dels costos més baixos possibles.",
  },
  {
    id: 'moderat',
    name: 'Moderat',
    subtitle: 'Creixement equilibrat',
    risk: 3,
    returnEst: '5–8%',
    volatility: '8–12%',
    horizon: '4–7 anys',
    highlight: '#c9a84c',
    description: "La combinació 45% variable / 35% fixa optimitza la ràtio rendiment/risc a mig termini. Els actius alternatius (REITs) aporten descorrelació. Adequada per a la majoria d'inversors particulars.",
    allocations: [
      { label: 'Renda variable',    pct: 45, color: '#c9a84c' },
      { label: 'Renda fixa global', pct: 25, color: '#16a34a' },
      { label: 'Corporatiu',        pct: 10, color: '#22c55e' },
      { label: 'REITs',             pct: 12, color: '#8b5cf6' },
      { label: 'Liquiditat',        pct: 8,  color: '#6b7280' },
    ],
    funds: [
      {
        name: 'Vanguard FTSE All-World UCITS ETF Acc',
        ticker: 'VWCE', isin: 'IE00BK5BQT80',
        weight: 45, ter: 0.22, category: 'Renda variable global', risk: 4,
        justification: 'Nucli de la cartera. 3.700+ empreses de 47 països. La millor diversificació possible per al preu.',
      },
      {
        name: 'iShares Core Global Aggregate Bond UCITS ETF EUR Hdg',
        ticker: 'AGGH', isin: 'IE00BDBRDM35',
        weight: 25, ter: 0.10, category: 'Renda fixa global coberta EUR', risk: 3,
        justification: 'Renda fixa global amb risc de canvi cobert a EUR. Descorrelació amb la renda variable en mercats baixistes.',
      },
      {
        name: 'iShares € Corporate Bond UCITS ETF',
        ticker: 'IEBC', isin: 'IE00B3F81R35',
        weight: 10, ter: 0.20, category: 'Renda fixa corporativa IG EUR', risk: 3,
        justification: 'Spread corporatiu millora rendibilitat de la part fixa sense risc divisa.',
      },
      {
        name: 'Amundi FTSE EPRA Nareit Global UCITS ETF',
        ticker: 'EPRE', isin: 'LU1681038243',
        weight: 12, ter: 0.24, category: 'REITs Globals', risk: 4,
        justification: 'Immobiliaris cotitzats descorrelats parcialment del mercat. Dividend yield >3% amb component inflacionista.',
      },
      {
        name: 'Xtrackers EUR Overnight Rate Swap ETF',
        ticker: 'XEON', isin: 'LU0290358497',
        weight: 8, ter: 0.10, category: 'Mercat monetari EUR', risk: 1,
        justification: 'Buffer de liquiditat amb rendiment monetari. Permet aprofitar correccions de mercat.',
      },
    ],
    whereToBuy: [
      { platform: 'Trade Republic', note: 'VWCE, AGGH, XEON disponibles. Ideal per aportacions periòdiques.' },
      { platform: 'MyInvestor', note: 'VWCE + fons indexat global de renda fixa. Sense comissió de custòdia.' },
      { platform: 'Interactive Brokers', note: 'Tots disponibles. Millors condicions per a volums >€25.000.' },
      { platform: 'Banc tradicional', note: 'Fons equivalents amb TER 0.5-1.5% (cost superior).' },
    ],
    rationale: 'TER mig ponderat ~0.17%. Rebalanceig semestral recomanat per mantenir pesos objectiu.',
  },
  {
    id: 'dinamic',
    name: 'Dinàmic',
    subtitle: 'Creixement actiu',
    risk: 4,
    returnEst: '8–12%',
    volatility: '12–18%',
    horizon: '7–12 anys',
    highlight: '#f59e0b',
    description: "Exposició majoritària a renda variable global per capturar creixement a llarg termini. La renda fixa d'alt rendiment complementa la rendibilitat. Exigeix capacitat d'absorció de caigudes temporals de fins al 25–30%.",
    allocations: [
      { label: 'RV Global',         pct: 55, color: '#f59e0b' },
      { label: 'RV Emergents',      pct: 15, color: '#fb923c' },
      { label: 'Renda fixa HY',     pct: 15, color: '#c9a84c' },
      { label: 'REITs',             pct: 10, color: '#8b5cf6' },
      { label: 'Liquiditat',        pct: 5,  color: '#6b7280' },
    ],
    funds: [
      {
        name: 'Vanguard FTSE All-World UCITS ETF Acc',
        ticker: 'VWCE', isin: 'IE00BK5BQT80',
        weight: 55, ter: 0.22, category: 'Renda variable global', risk: 4,
        justification: 'Base diversificada del creixement a llarg termini. Inclou DM i EM en una sola posició.',
      },
      {
        name: 'iShares Core MSCI Emerging Markets IMI UCITS ETF',
        ticker: 'EIMI', isin: 'IE00BKM4GZ66',
        weight: 15, ter: 0.18, category: 'Renda variable mercats emergents', risk: 5,
        justification: 'Sobreponderació emergents per capturar creixement de la classe mitjana asiàtica i africana.',
      },
      {
        name: 'iShares Global High Yield Corp Bond UCITS ETF',
        ticker: 'HYLD', isin: 'IE00B74DQ490',
        weight: 15, ter: 0.50, category: 'Renda fixa alt rendiment global', risk: 4,
        justification: "Rendiment 6-8% anual. Parcialment correlat amb renda variable però diversifica el component de creixement.",
      },
      {
        name: 'Amundi FTSE EPRA Nareit Global UCITS ETF',
        ticker: 'EPRE', isin: 'LU1681038243',
        weight: 10, ter: 0.24, category: 'REITs Globals', risk: 4,
        justification: 'Actiu real amb protecció inflacionista i dividend yield recurrent.',
      },
      {
        name: 'Xtrackers EUR Overnight Rate Swap ETF',
        ticker: 'XEON', isin: 'LU0290358497',
        weight: 5, ter: 0.10, category: 'Mercat monetari EUR', risk: 1,
        justification: 'Reserva mínima per gestió de liquiditat i rebalanceig oportunista.',
      },
    ],
    whereToBuy: [
      { platform: 'Trade Republic', note: 'VWCE, EIMI, HYLD disponibles. Plans d\'estalvi automàtic.' },
      { platform: 'Interactive Brokers', note: 'Tots disponibles. Recomanat per a aquesta cartera >€30.000.' },
      { platform: 'MyInvestor', note: 'VWCE + fons indexat emergents. HYLD pot no estar disponible.' },
      { platform: 'Banc tradicional', note: 'Fons equivalents existents però amb cost significativament superior.' },
    ],
    rationale: 'TER mig ponderat ~0.23%. Rebalanceig anual o quan algun actiu desviï >5% del pes objectiu.',
  },
  {
    id: 'agressiu',
    name: 'Agressiu',
    subtitle: 'Màxim creixement',
    risk: 5,
    returnEst: '12–18%',
    volatility: '18–28%',
    horizon: '+12 anys',
    highlight: '#dc2626',
    description: 'Cartera concentrada en renda variable amb biaix cap a creixement (tecnologia, emergents, small cap). Adequada per a inversors joves amb horitzó molt llarg i alta tolerància a la volatilitat. Correccions del 40–50% possibles.',
    allocations: [
      { label: 'RV Global',         pct: 55, color: '#dc2626' },
      { label: 'RV Emergents',      pct: 15, color: '#f87171' },
      { label: 'RV Tecnologia',     pct: 15, color: '#f59e0b' },
      { label: 'Small Cap',         pct: 10, color: '#8b5cf6' },
      { label: 'Liquiditat',        pct: 5,  color: '#6b7280' },
    ],
    funds: [
      {
        name: 'Vanguard FTSE All-World UCITS ETF Acc',
        ticker: 'VWCE', isin: 'IE00BK5BQT80',
        weight: 55, ter: 0.22, category: 'Renda variable global', risk: 4,
        justification: 'Diversificació global com a ancla. Redueix la concentració dels components de creixement.',
      },
      {
        name: 'iShares Core MSCI Emerging Markets IMI UCITS ETF',
        ticker: 'EIMI', isin: 'IE00BKM4GZ66',
        weight: 15, ter: 0.18, category: 'Renda variable mercats emergents', risk: 5,
        justification: 'Exposició a economies de creixement superior: Índia, Taiwan, Corea, Brasil, etc.',
      },
      {
        name: 'Invesco EQQQ NASDAQ-100 UCITS ETF',
        ticker: 'EQQQ', isin: 'IE0032077012',
        weight: 15, ter: 0.20, category: 'Renda variable tecnologia EUA', risk: 6,
        justification: 'Les 100 majors empreses no financeres del NASDAQ. Exposició concentrada a IA, cloud i plataformes digitals.',
      },
      {
        name: 'Xtrackers MSCI World Small Cap UCITS ETF',
        ticker: 'XSMC', isin: 'IE00BFNM3P36',
        weight: 10, ter: 0.35, category: 'Renda variable small cap global', risk: 5,
        justification: 'Factor small cap històricament supera el mercat a llarg termini (Fama-French). Diversifica el biaix mega-cap.',
      },
      {
        name: 'Xtrackers EUR Overnight Rate Swap ETF',
        ticker: 'XEON', isin: 'LU0290358497',
        weight: 5, ter: 0.10, category: 'Mercat monetari EUR', risk: 1,
        justification: 'Reserva mínima. En caigudes >20%, pot rebalancejar-se cap a VWCE o EIMI.',
      },
    ],
    whereToBuy: [
      { platform: 'Trade Republic', note: 'VWCE, EIMI, EQQQ, XEON disponibles. Pla automàtic recomanat.' },
      { platform: 'Interactive Brokers', note: 'Tots disponibles inclòs XSMC. Millors condicions per >€50.000.' },
      { platform: 'MyInvestor', note: 'VWCE + EQQQ disponibles. XSMC pot no estar-hi.' },
      { platform: 'Banc tradicional', note: 'Difícil replicar exactament. Fons indexats equivalents a alt cost.' },
    ],
    rationale: 'TER mig ponderat ~0.22%. Estratègia buy & hold. No intentes fer timing de mercat. Aportacions periòdiques en correccions.',
  },
];

export function getPortfolioDetail(id: string): PortfolioDetail | undefined {
  return PORTFOLIOS_DETAIL.find(p => p.id === id);
}
