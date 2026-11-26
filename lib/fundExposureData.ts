// lib/fundExposureData.ts — diversificació de cada fons segons la seva fitxa oficial.
//
// Com actualitzar-ho (cada trimestre; l'admin avisa quan una fitxa té més de
// 120 dies, vegeu staleExposures a lib/fundExposure.ts):
// 1. Obre la fitxa mensual / trimestral oficial del fons (web de la gestora).
// 2. Copia els països, els sectors i el top-10 tal com surten (en % del fons).
// 3. Canvia `asOf` per la data de les dades de la fitxa i `source` pel document.
// Si la fitxa d'un fons indexat no es pot llegir, es pot fer servir la d'un
// altre fons que repliqui EXACTAMENT el mateix índex (es diu a `source`).
// Mai s'inventa cap xifra: si no hi ha dada, el camp es deixa buit.
//
// Camps:
// - countries:      país o regió → % (com a la fitxa). El que falta fins a 100
//                   (o fins a basis) es mostra com «no detallat».
// - basis:          % del fons invertit en accions, quan la fitxa dona països i
//                   sectors sobre el total del fons (fons actius amb liquiditat).
// - sectors:        sector (GICS, ICB o Morningstar, en anglès o castellà) → %.
//                   Si la fitxa només en dona uns quants, la resta surt com a
//                   «no detallat»; mai es reparteix.
// - size:           { gran, petita } en %. Fons indexats: segons l'índex.
// - top10:          10 primeres posicions (% del fons); top10Total: el total.

export interface FundExposure {
  fund:            string;
  asOf:            string;                        // AAAA-MM-DD (data de les dades)
  source:          string;                        // document i data
  countries?:      Record<string, number>;
  basis?:          number;
  sectors?:        Record<string, number>;
  size?:           { gran?: number; petita?: number };
  sizeSource?:     string;
  top10?:          { name: string; pct: number }[];
  top10Total?:     number;
}

const t10 = (s: string) => s.split(';').map(x => {
  const i = x.lastIndexOf('=');
  return { name: x.slice(0, i).trim(), pct: Number(x.slice(i + 1)) };
});
const kv = (s: string) => Object.fromEntries(s.split(';').map(x => {
  const i = x.lastIndexOf('=');
  return [x.slice(0, i).trim(), Number(x.slice(i + 1))];
}));

const LARGE_MID = (index: string) => ({ size: { gran: 100 }, sizeSource: `Definició de l'índex ${index}: empreses grans i mitjanes` });
const SMALL = (index: string) => ({ size: { petita: 100 }, sizeSource: `Definició de l'índex ${index}: empreses petites` });

// ─── Índexs (per als fons indexats que repliquen el mateix índex) ───────────

const MSCI_WORLD_2610: Omit<FundExposure, 'fund' | 'source'> = {
  asOf: '2026-10-30',
  countries: kv('United States=73.03;Japan=5.68;United Kingdom=3.45;Canada=3.44;Switzerland=2.29;France=2.19;Germany=2.08;Australia=1.57;Netherlands=1.34;Spain=0.90;Sweden=0.82;Italy=0.74'),
  sectors: kv('Energy=4.45;Materials=3.14;Industrials=10.75;Consumer Discretionary=8.60;Consumer Staples=5.21;Health Care=9.95;Financials=16.03;Information Technology=30.72;Communication Services=7.12;Utilities=2.45;Real Estate=1.57'),
  ...LARGE_MID('MSCI World'),
  top10: t10('Apple=5.63;NVIDIA=5.40;Microsoft=4.11;Amazon.com=2.59;Alphabet=3.28;Broadcom=1.71;Meta Platforms=1.51;Tesla=1.27;Eli Lilly=1.21'),
  top10Total: 26.72,
};
const MSCI_WORLD_SRC = 'Índex MSCI World segons la fitxa mensual d\'Amundi Index MSCI World (31/10/2026)';

const SP500_2610: Omit<FundExposure, 'fund' | 'source'> = {
  asOf: '2026-10-31',
  countries: kv('United States=100'),
  sectors: kv('Information Technology=37.4;Financials=12.2;Health Care=10.3;Consumer Discretionary=9.0;Communication Services=8.4;Industrials=8.1;Consumer Staples=5.0;Energy=3.9;Utilities=2.1;Real Estate=1.8;Materials=1.7'),
  size: { gran: 100 }, sizeSource: 'Definició de l\'índex S&P 500: empreses grans dels EUA',
  top10: t10('Apple=7.7;NVIDIA=7.6;Microsoft=5.9;Alphabet=4.5;Amazon.com=3.6;Broadcom=2.4;Meta Platforms=2.1;Eli Lilly=1.7;Tesla=1.7;Berkshire Hathaway=1.5'),
  top10Total: 38.9,
};

const MSCI_EM_2610: Omit<FundExposure, 'fund' | 'source'> = {
  asOf: '2026-10-30',
  countries: kv('Taiwan=29.13;Korea=20.13;China=19.55;India=11.48;Brazil=3.90;South Africa=3.11;Saudi Arabia=2.35;Mexico=1.75;United Arab Emirates=1.26;Poland=1.25;Thailand=0.96;Malaysia=0.92;Greece=0.61;Kuwait=0.56'),
  sectors: kv('Energy=3.63;Materials=5.83;Industrials=6.05;Consumer Discretionary=7.53;Consumer Staples=2.75;Health Care=2.75;Financials=20.19;Information Technology=42.51;Communication Services=5.87;Utilities=1.90;Real Estate=1.00'),
  ...LARGE_MID('MSCI Emerging Markets'),
  top10: t10('Taiwan Semiconductor Manufacturing=15.91;Samsung Electronics=8.04;SK hynix=5.50;Tencent=2.57;Alibaba=1.79;MediaTek=1.56;China Construction Bank=0.95;Hon Hai Precision Industry=0.81;Delta Electronics=0.77'),
  top10Total: 37.90,
};
const MSCI_EM_SRC = 'Índex MSCI Emerging Markets segons la fitxa mensual d\'Amundi Core MSCI Emerging Markets (31/10/2026)';

const MSCI_EUROPE_2609: Omit<FundExposure, 'fund' | 'source'> = {
    asOf: '2026-09-30',
        countries: kv('United Kingdom=22.6;France=14.8;Switzerland=14.2;Germany=13.6;Netherlands=9.5;Spain=6.3;Sweden=5.3;Italy=5.1;Denmark=2.4;Finland=1.9'),
    sectors: kv('Financials=25.6;Industrials=18.6;Health Care=12.7;Information Technology=9.8;Consumer Staples=8.2;Consumer Discretionary=6.0;Materials=5.4;Energy=5.4;Utilities=4.8;Communication Services=3.0;Real Estate=0.5'),
    ...LARGE_MID('MSCI Europe'),
    top10: t10('ASML Holding NV=5.2;HSBC Holdings plc=2.5;Roche Holding AG=2.2;Shell plc=2.0;Novartis AG=1.9;AstraZeneca plc=1.8;Nestle SA=1.7;Siemens AG=1.6;SAP SE=1.6;Banco Santander SA=1.5'),
    top10Total: 22.0,
};
const MSCI_EUROPE_SRC = 'Índex MSCI Europe segons la fitxa de Vanguard European Stock Index Fund (30/09/2026)';

// ─── Fitxes per fons ─────────────────────────────────────────────────────────

export const FUND_EXPOSURE: Record<string, FundExposure> = {
  // Vanguard (fitxes de fund-docs.vanguard.com; mateixa cartera per a totes les classes)
  IE00B03HD191: {
    fund: 'Vanguard Global Stock Index Fund', asOf: '2026-10-31',
    source: 'Vanguard, fitxa 31/10/2026 (classe EUR Hedged, mateixa cartera)',
    countries: kv('United States=72.8;Japan=5.7;United Kingdom=3.5;Canada=3.4;Switzerland=2.3;France=2.2;Germany=2.1;Australia=1.6;Netherlands=1.3;Spain=0.9'),
    sectors: kv('Information Technology=29.8;Financials=16.2;Industrials=10.8;Health Care=10.2;Consumer Discretionary=8.7;Communication Services=7.2;Consumer Staples=5.4;Energy=4.6;Materials=3.1;Utilities=2.5;Real Estate=1.6'),
    ...LARGE_MID('MSCI World'),
    top10: t10('Apple Inc.=5.7;NVIDIA Corp.=5.3;Microsoft Corp.=4.1;Alphabet Inc.=3.3;Amazon.com Inc.=2.6;Broadcom Inc.=1.6;Meta Platforms Inc.=1.5;Tesla Inc.=1.3;Eli Lilly & Co.=1.3;Micron Technology Inc.=1.1'),
    top10Total: 27.7,
  },
  IE0031786696: {
    fund: 'Vanguard Emerging Markets Stock Index Fund', asOf: '2026-10-31',
    source: 'Vanguard, fitxa 31/10/2026',
    countries: kv('Taiwan=29.1;Korea=19.8;China=19.2;India=11.8;Brazil=3.9;South Africa=3.1;Saudi Arabia=2.4;Mexico=1.8;United Arab Emirates=1.3;Poland=1.2'),
    sectors: kv('Information Technology=41.9;Financials=20.4;Consumer Discretionary=7.7;Communication Services=6.1;Industrials=5.9;Materials=5.7;Energy=3.7;Health Care=2.8;Consumer Staples=2.8;Utilities=1.9;Real Estate=1.0'),
    ...LARGE_MID('MSCI Emerging Markets'),
    top10: t10('Taiwan Semiconductor Manufacturing Co. Ltd.=16.0;Samsung Electronics Co. Ltd.=8.0;SK hynix Inc.=5.3;Tencent Holdings Ltd.=2.7;Alibaba Group Holding Ltd.=1.9;MediaTek Inc.=1.5;China Construction Bank Corp.=1.0;Hon Hai Precision Industry Co. Ltd.=0.8;Petroleo Brasileiro SA - Petrobras=0.8;HDFC Bank Ltd.=0.7'),
    top10Total: 38.7,
  },
  IE0032126645: { fund: 'Vanguard U.S. 500 Stock Index Fund', source: 'Vanguard, fitxa 31/10/2026 (classe Institutional Plus EUR, mateixa cartera)', ...SP500_2610 },
  IE00BK5BQT80: {
    fund: 'Vanguard FTSE All-World UCITS ETF', asOf: '2026-10-31',
    source: 'Vanguard, fitxa 31/10/2026',
    countries: kv('United States=62.8;Japan=5.9;Taiwan=3.3;United Kingdom=3.2;Canada=3.1;China=2.3;Korea=2.3;Switzerland=2.1;France=1.9;Germany=1.8'),
    sectors: kv('Technology=33.5;Financials=15.1;Industrials=12.2;Consumer Discretionary=10.9;Health Care=8.8;Energy=4.6;Consumer Staples=4.2;Telecommunications=3.2;Basic Materials=3.1;Utilities=2.7;Real Estate=1.7'),
    ...LARGE_MID('FTSE All-World'),
    top10: t10('Apple Inc.=4.8;NVIDIA Corp.=4.6;Microsoft Corp.=3.7;Alphabet Inc.=2.8;Amazon.com Inc.=2.3;Taiwan Semiconductor Manufacturing Co. Ltd.=1.7;Broadcom Inc.=1.5;Meta Platforms Inc.=1.3;Tesla Inc.=1.1;Eli Lilly & Co.=1.1'),
    top10Total: 24.9,
  },
  IE0007987708: { fund: 'Vanguard European Stock Index Fund', source: 'Vanguard, fitxa 30/09/2026 (classe Institutional Plus USD, mateixa cartera)', ...MSCI_EUROPE_2609 },
  IE0008248803: {
    fund: 'Vanguard Eurozone Stock Index Fund', asOf: '2026-09-30',
    source: 'Vanguard, fitxa 30/09/2026 (classe USD, mateixa cartera)',
    countries: kv('France=27.1;Germany=25.0;Netherlands=17.3;Spain=11.6;Italy=9.4;Finland=3.4;Belgium=3.2;Ireland=1.2;Austria=1.1;Portugal=0.6'),
    sectors: kv('Financials=27.0;Industrials=19.6;Information Technology=16.7;Consumer Discretionary=7.5;Utilities=6.6;Health Care=5.8;Consumer Staples=5.3;Energy=4.0;Materials=4.0;Communication Services=3.0;Real Estate=0.5'),
    ...LARGE_MID('MSCI EMU'),
    top10: t10('ASML Holding NV=9.4;Siemens AG=3.0;SAP SE=2.9;Banco Santander SA=2.7;Schneider Electric SE=2.4;Allianz SE=2.4;TotalEnergies SE=2.2;Banco Bilbao Vizcaya Argentaria SA=2.1;Iberdrola SA=2.0;Safran SA=1.8'),
    top10Total: 30.9,
  },
  IE00B42W4L06: {
    fund: 'Vanguard Global Small-Cap Index Fund', asOf: '2026-10-31',
    source: 'Vanguard, fitxa 31/10/2026 (classe GBP Dist, mateixa cartera)',
    countries: kv('United States=62.0;Japan=12.6;United Kingdom=4.4;Canada=4.1;Australia=3.6;Sweden=1.8;Switzerland=1.5;Israel=1.4;Germany=1.3;France=1.2'),
    sectors: kv('Industrials=19.0;Financials=14.5;Information Technology=12.5;Health Care=12.0;Consumer Discretionary=10.6;Real Estate=8.0;Materials=8.0;Energy=5.4;Consumer Staples=4.2;Communication Services=3.2;Utilities=2.7'),
    ...SMALL('MSCI World Small Cap'),
    top10: t10('Moderna Inc.=0.7;Tenet Healthcare Corp.=0.2;US Foods Holding Corp.=0.2;Viatris Inc.=0.2;Guardant Health Inc.=0.2;Roku Inc.=0.2;Ovintiv Inc.=0.2;Rubrik Inc.=0.2;Royal Gold Inc.=0.2;Permian Resources Corp.=0.2'),
    top10Total: 2.6,
  },

  // Amundi (fitxa mensual amundi.lu; Amundi publica el repartiment de l'índex que replica)
  LU0996182563: { fund: 'Amundi Index MSCI World', source: 'Amundi, fitxa mensual 31/10/2026 (repartiment de l\'índex)', ...MSCI_WORLD_2610 },
  LU0996177134: { fund: 'Amundi Core MSCI Emerging Markets', source: 'Amundi, fitxa mensual 31/10/2026 (repartiment de l\'índex)', ...MSCI_EM_2610 },
  LU0389811885: { fund: 'Amundi Core MSCI Europe', source: MSCI_EUROPE_SRC + '. L\'última fitxa d\'Amundi llegible era de febrer de 2026', ...MSCI_EUROPE_2609 },

  // Fons indexats que repliquen el mateix índex que una fitxa ja llegida
  IE00B4L5Y983: { fund: 'iShares Core MSCI World UCITS ETF', source: MSCI_WORLD_SRC, ...MSCI_WORLD_2610 },
  IE00BD0NCM55: { fund: 'iShares Developed World Index Fund', source: MSCI_WORLD_SRC, ...MSCI_WORLD_2610 },
  IE00B5BMR087: { fund: 'iShares Core S&P 500 UCITS ETF', source: 'Índex S&P 500 segons la fitxa de Vanguard U.S. 500 Stock Index Fund (31/10/2026)', ...SP500_2610 },
  IE00B4K48X80: { fund: 'iShares Core MSCI Europe UCITS ETF', source: MSCI_EUROPE_SRC, ...MSCI_EUROPE_2609 },
  IE00BKM4GZ66: {
    fund: 'iShares Core MSCI EM IMI UCITS ETF', asOf: '2026-11-24',
    source: 'iShares, web del fons (ishares.com/ch) a 24/11/2026',
    countries: kv('Taiwan=26.84;China=18.68;Korea South=17.34;India=15.16;Brazil=3.23;South Africa=3.14;Saudi Arabia=2.43;Mexico=1.81;United Arab Emirates=1.52;Poland=1.30;Thailand=1.20;Malaysia=1.17;Other=5.51'),
    basis: 99.33,
    sectors: kv('Information Technology=36.56;Financials=21.03;Consumer Discretionary=8.33;Industrials=7.39;Materials=6.04;Communication=5.73;Health Care=3.76;Energy=3.37;Consumer Staples=3.35;Utilities=2.08;Real Estate=1.69'),
    // MSCI EM IMI inclou grans, mitjanes i petites; la fitxa no en dona el repartiment
    top10: t10('Taiwan Semiconductor Manufacturing=13.78;Samsung Electronics=6.20;SK hynix=3.94;Tencent=2.21;MediaTek=1.48;Alibaba=1.45;China Construction Bank=0.91;HDFC Bank=0.83;ICICI Bank=0.75'),
    top10Total: 31.55,
  },
  IE00BYWYCC39: { fund: 'iShares Emerging Markets Index Fund', source: MSCI_EM_SRC, ...MSCI_EM_2610 },

  // Gestió activa (dades de la gestora; normalment semestrals o trimestrals)
  ES0112611001: {
    fund: 'Azvalor Internacional FI', asOf: '2026-06-30',
    source: 'Azvalor, informe semestral 1S2026 (cartera a 30/06/2026)',
    basis: 94.78,
    countries: kv('United States=36;United Kingdom=22.8;Canada=10.6'),
    sectors: kv('Energy=47.6;Materials=16.2'),
    top10: t10('Schlumberger=5.53;PrairieSky Royalty=5.03;Glencore=4.95;Transocean=4.67;Borr Drilling=4.08;TGS=3.82;NOV=3.67;Noble=3.15;Whitehaven Coal=3.07;Yellow Cake=2.99'),
    top10Total: 40.96,
  },
  IE00BM95B621: {
    fund: 'Polar Capital Global Technology Fund', asOf: '2026-09-30',
    source: 'Fidelity UK, fitxa del fons (dades Morningstar, cartera a 30/09/2026; classe I GBP, mateixa cartera)',
    sectors: kv('Technology=87.84;Communication Services=7.33;Industrials=4.36;Consumer Cyclical=0.88;Financial Services=0.50'),
    top10: t10('NVIDIA Corp=9.56;Taiwan Semiconductor Manufacturing Co Ltd=5.10;Advanced Micro Devices Inc=4.96;Opció sobre Apple Inc=3.94;Meta Platforms Inc Class A=3.47;Micron Technology Inc=3.38;Microsoft Corp=3.31;Opció sobre Nasdaq 100=3.23;SanDisk Corp=3.18;Seagate Technology Holdings PLC=3.01'),
    top10Total: 43.13,
  },
  ES0119199000: {
    fund: 'Cobas Internacional FI', asOf: '2026-11-24',
    source: 'Cobas AM, web del fons consultada el 24/11/2026 (repartiment geogràfic)',
    basis: 97.4,
    countries: kv('Rest of Europe=36.4;Eurozone=27.9;United States=18.6'),   // «Àsia» 15,6 % i «altres» 1,5 % no es poden assignar a una regió
  },
};

/** Altres classes del mateix fons → classe amb fitxa (mateixa cartera). */
export const EXPOSURE_ALIASES: Record<string, string> = {
  IE00B03HCZ61: 'IE00B03HD191',   // Vanguard Global Stock Investor
  IE00B42W3S00: 'IE00B42W4L06',   // Vanguard Global Small-Cap Investor
  LU0714179727: 'LU0329202252',   // JPM Global Dividend (div)
  DE0009848119: 'DE000DWS1U90',   // DWS Top Dividende LD
  IE00B4468526: 'IE00BM95B621',   // Polar Global Technology Dist
  IE00BF0GL329: 'IE00BF0GL436',   // Polar AI USD
  LU0326422176: 'LU0252963896', LU0408222247: 'LU0252963896', LU0171301533: 'LU0252963896', // BGF World Energy
};
