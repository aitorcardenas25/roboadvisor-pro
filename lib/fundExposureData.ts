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
  IE00BF4RFH31: {
    fund: 'iShares MSCI World Small Cap UCITS ETF', asOf: '2026-11-24',
    source: 'iShares, web del fons (ishares.com/ch) a 24/11/2026',
    basis: 99.33,
    countries: kv('United States=62.06;Japan=12.48;United Kingdom=4.32;Canada=3.89;Australia=3.55;Sweden=1.77;Switzerland=1.50;Israel=1.30;Germany=1.23;France=1.21;Other=6.03'),
    sectors: kv('Industrials=18.98;Financials=14.64;Health Care=12.42;Information Technology=11.63;Consumer Discretionary=10.98;Real Estate=8.23;Materials=7.49;Energy=4.68;Consumer Staples=4.44;Communication=3.14;Utilities=2.70'),
    ...SMALL('MSCI World Small Cap'),
    // el top-10 publicat inclou un 0,25 % de liquiditat en USD, que no és cap empresa
    top10: t10('Moderna=0.77;US Foods=0.25;Tenet Healthcare=0.23;Viatris=0.23;Woodward=0.20;Royal Gold=0.20;Guardant Health=0.20;ITT=0.19;Reinsurance Group of America=0.18'),
    top10Total: 2.70,
  },
  IE00B6R51Z18: {
    fund: 'iShares Oil & Gas Exploration & Production UCITS ETF', asOf: '2026-11-24',
    source: 'iShares, web del fons (ishares.com/ch) a 24/11/2026',
    basis: 99.69,
    countries: kv('United States=64.07;Canada=20.05;Australia=8.33;Japan=2.85;Norway=2.67;Other=1.71'),
    sectors: kv('Energy=99.65'),
    top10: t10('EOG Resources=11.23;ConocoPhillips=11.11;Canadian Natural Resources=9.77;Devon Energy=6.66;Woodside Energy=5.45;Diamondback Energy=5.27;EQT=4.52;Expand Energy=2.78;Santos=2.65;Inpex=2.64'),
    top10Total: 62.08,
  },
  IE00BJ5JP105: {
    fund: 'iShares MSCI World Energy Sector UCITS ETF', asOf: '2026-11-24',
    source: 'iShares, web del fons (ishares.com/ch) a 24/11/2026',
    basis: 99.21,
    countries: kv('United States=63.10;Canada=13.47;United Kingdom=10.75;France=4.65;Italy=1.58;Australia=1.56;Japan=1.17;Norway=1.15;Other=1.79'),
    sectors: kv('Energy=99.21'),
    ...LARGE_MID('MSCI World Energy'),
    top10: t10('Exxon Mobil=18.46;Chevron=10.82;Shell=7.59;TotalEnergies=4.65;ConocoPhillips=4.62;BP=3.16;Marathon Petroleum=2.92;Enbridge=2.83;Valero Energy=2.71;Phillips 66=2.67'),
    top10Total: 60.43,
  },
  IE000NFR7C63: {
    fund: 'iShares MSCI China Tech UCITS ETF', asOf: '2026-11-24',
    source: 'iShares, web del fons (ishares.com/ch) a 24/11/2026. La web no dona països: l\'índex només inclou empreses xineses',
    countries: kv('China=100'),
    sectors: kv('Information Technology=40.81;Consumer Discretionary=28.10;Communication=23.45;Industrials=6.50;Financials=0.93'),
    top10: t10('PDD Holdings=9.55;Xiaomi=9.54;NetEase=7.74;Tencent=7.55;Alibaba=6.54;JD.com=5.11;Baidu=3.67;Lenovo=3.59;CATL=1.83;Kuaishou Technology=1.58'),
    top10Total: 56.70,
  },
  LU0292107991: {
    fund: 'Xtrackers MSCI EM Asia Screened Swap UCITS ETF', asOf: '2026-09-30',
    source: 'DWS Xtrackers, web del fons (etf.dws.com): composició de l\'índex a 30/09/2026. És un ETF sintètic (swap): la cistella que té no és l\'exposició real, que és la de l\'índex',
    countries: kv('Taiwan=36.68;Corea del Sur=25.86;China=22.08;India=11.95;Tailandia=1.19;Misceláneas=2.25'),
    ...LARGE_MID('MSCI EM Asia'),
    // DWS només publica les 5 primeres de l'índex
    top10: t10('Taiwan Semiconductor Manufacturing=19.69;Samsung Electronics=9.50;SK hynix=7.35;Tencent=3.54;MediaTek=2.46'),
  },
  IE000F354Q61: {
    fund: 'Xtrackers MSCI World Small Cap UCITS ETF', asOf: '2026-11-24',
    source: 'DWS Xtrackers, web del fons (etf.dws.com) a 24/11/2026. «Misceláneas» inclou un 8,8 % en un altre ETF de petites europees de Xtrackers',
    countries: kv('Estados Unidos=67.52;Japón=12.93;Canadá=4.58;Australia=3.74;Reino Unido=1.96;Misceláneas=9.27'),
    ...SMALL('MSCI World Small Cap'),
  },
  IE00BQQP9G91: {
    fund: 'VanEck Junior Gold Miners UCITS ETF', asOf: '2026-10-31',
    source: 'VanEck, fitxa mensual 31/10/2026. Sector: l\'índex només inclou mineres d\'or i plata (materials)',
    countries: kv('Canadá=46.81;Australia=14.15;Estados Unidos=10.88;Reino Unido=6.75;Burkina Faso=5.05;México=2.99'),
    sectors: kv('Materials=100'),
    size: { gran: 74.9, petita: 24.7 }, sizeSource: 'VanEck: mitjanes (3.000-20.000 M$): grans i mitjanes 74.9 %, petites 24.7 %',
    top10: t10('Alamos Gold=6.49;Equinox Gold=6.09;Coeur Mining=5.87;Endeavour Mining=5.84;IAMGOLD=5.05;Industrias Peñoles=2.61;Hecla Mining=2.25;First Majestic Silver=2.23;Lundin Gold=2.06;B2Gold=1.84'),
    top10Total: 40.32,
  },
  LU0625737910: {
    fund: 'Pictet China Index', asOf: '2026-11-24',
    source: 'Índex MSCI China segons la web d\'iShares MSCI China UCITS ETF (24/11/2026), que replica el mateix índex',
    countries: kv('China=100'),
    sectors: kv('Financials=23.58;Consumer Discretionary=22.77;Communication=16.18;Information Technology=9.74;Health Care=6.07;Industrials=5.60;Materials=4.65;Energy=3.87;Consumer Staples=3.47;Utilities=2.16;Real Estate=1.60'),
    ...LARGE_MID('MSCI China'),
    top10: t10('Tencent=12.49;Alibaba=8.22;China Construction Bank=5.14;ICBC=2.98;Xiaomi=2.70;Bank of China=2.46;PDD Holdings=2.10;Meituan=1.92;Ping An Insurance=1.84;NetEase=1.63'),
    top10Total: 41.48,
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
  ES0159259011: {
    fund: 'Magallanes European Equity FI', asOf: '2026-10-31',
    source: 'Magallanes Value Investors, fitxa mensual (dades a 31/10/2026)',
    basis: 97.1,
    countries: kv('Francia=22.6;Alemania=20.0;Reino Unido=16.4;Suecia=9.7;Suiza=6.4;Países Bajos=5.5;Bélgica=4.6;Italia=4.4;Estados Unidos=3.6;Otros=4.0'),
    sectors: kv('Industrial=49.0;Consumo Cíclico=15.4;Consumo Estable=12.5;Tech/Media/Telecom=6.6;Energía=3.6;Inmobiliario=3.3;Holding=2.8;Financiero=2.2;Servicios=1.7'),
    size: { gran: 75.7 + 19.4, petita: 2.0 },
    sizeSource: 'Fitxa de la gestora: grans (>5.000 M€) 75,7 %, mitjanes (1.000-5.000 M€) 19,4 %, petites (<1.000 M€) 2,0 %',
    // la fitxa només publica les 5 primeres i el pes de les 10 primeres
    top10: t10('SKF=4.8;Evonik=4.7;RS Group=4.7;Syensqo=4.6;Avolta=4.4'),
    top10Total: 43.0,
  },
  ES0159201013: {
    fund: 'Magallanes Iberian Equity FI', asOf: '2026-10-31',
    source: 'Magallanes Value Investors, fitxa mensual (dades a 31/10/2026)',
    basis: 93.5,
    countries: kv('España=65.4;Portugal=14.7;Reino Unido=9.4;Alemania=3.9'),
    sectors: kv('Industrial=35.9;Consumo Cíclico=20.8;Servicios=8.3;Tech/Media/Telecom=7.8;Inmobiliario=5.9;Financiero=5.3;Holding=3.5;Salud=3.0;Consumo Estable=2.9'),
    // Per estàndards internacionals (MSCI), per sota d'uns 3.000 M€ ja és empresa petita
    size: { gran: 34.5, petita: 45.1 + 13.8 },
    sizeSource: 'Fitxa de la gestora: >3.000 M€ 34,5 %, 500-3.000 M€ 45,1 %, <500 M€ 13,8 % (les de 500-3.000 M€ es compten com a petites)',
    top10: t10('Atalaya Mining=5.3;Meliá Hotels=5.1;Acerinox=4.9;Amadeus=4.6;Zegona=4.1'),
    top10Total: 43.0,
  },
  ES0159202011: {
    fund: 'Magallanes Microcaps Europe FI', asOf: '2026-10-31',
    source: 'Magallanes Value Investors, fitxa mensual (dades a 31/10/2026)',
    basis: 92.2,
    countries: kv('Reino Unido=23.2;Italia=20.2;Alemania=15.6;España=10.9;Portugal=8.2;Francia=5.8;Bélgica=2.9;Suecia=2.4;Suiza=2.1;Otros=1.0'),
    sectors: kv('Industrial=43.8;Consumo Cíclico=18.9;Holding=8.4;Consumo Estable=5.8;Servicios=5.2;Tech/Media/Telecom=4.2;Financiero=3.6;Salud=1.9;Inmobiliario=0.4'),
    size: { petita: 100 }, sizeSource: 'Fons de microempreses europees (índex de referència MSCI Europe Micro Cap)',
    top10: t10('Atalaya Mining=6.9;Travis Perkins=5.3;SOL=4.9;CIR=4.6;KSB=4.2'),
    top10Total: 45.5,
  },
  ES0114638036: {
    fund: 'Bestinver Internacional FI', asOf: '2026-10-31', source: 'Bestinver, fitxa mensual (dades a 31/10/2026; posicions principals a 30/09/2026)',
    basis: 96.1,
    countries: kv('Europa=61.8;EEUU=26.9;Resto del mundo=7.4'),
    // «Consumo» i «Com. y Tec.» barregen sectors: surten com a no detallat
    sectors: kv('Industria=38.8;Com. y Tec.=25.7;Consumo=17.8;Finanzas=13.8'),
    top10: t10('Meta Platforms=4.94;Barclays=3.29;Taiwan Semiconductor Manufacturing=3.19;Saint-Gobain=3.16;Philips=3.06'),
  },
  ES0114561006: {
    fund: 'Bestinver Grandes Compañías FI', asOf: '2026-10-31', source: 'Bestinver, fitxa mensual (dades a 31/10/2026; posicions principals a 30/09/2026)',
    basis: 91.3,
    countries: kv('Europa=44.9;EEUU=34.2;Iberia=3.7;Resto del mundo=8.4'),
    sectors: kv('Com. y Tec.=33;Industria=25.8;Consumo=25.3;Finanzas=7.2'),
    top10: t10('Taiwan Semiconductor Manufacturing=4.51;NVIDIA=4.39;Deutsche Börse=3.99;Inditex=3.93;Microsoft=3.90'),
  },
  ES0183793001: {
    fund: 'Bestinver Megatendencias FI', asOf: '2026-10-31', source: 'Bestinver, fitxa mensual (dades a 31/10/2026; posicions principals a 30/09/2026). La fitxa reparteix per temes, no per sectors',
    basis: 96.3,
    countries: kv('Europa=43.1;EEUU=39;Resto del mundo=14.2'),
    // les 3 primeres de cada tema (no necessàriament les 9 primeres del fons)
    top10: t10('NVIDIA=5.28;Greencoat UK Wind=3.68;Taiwan Semiconductor Manufacturing=3.39;Alphabet=3.33;Waters=3.00;EDP=2.69;3i Group=2.63;MercadoLibre=2.55;Kingspan=2.53'),
  },
  ES0147622031: {
    fund: 'Bestinver Bolsa FI', asOf: '2026-10-31', source: 'Bestinver, fitxa mensual (dades a 31/10/2026; posicions principals a 30/09/2026)',
    basis: 92.9,
    countries: kv('España=73.8;Portugal=9.3;Europa=9.8'),
    sectors: kv('Consumo=31;Industria=25.4;Finanzas=18.9;Com. y Tec.=17.5'),
    top10: t10('Banco Santander=7.50;Indra=7.00;BBVA=6.89;Zegona=6.63;Grifols=4.55'),
  },
  ES0112763000: {
    fund: 'Bestinver Norteamérica FI', asOf: '2026-10-31', source: 'Bestinver, fitxa mensual (dades a 31/10/2026; posicions principals a 30/09/2026). La fitxa no dona repartiment geogràfic',
    basis: 95.5,
    sectors: kv('Com. y Tec.=37.3;Consumo=25;Industria=18.3;Finanzas=14.9'),
    top10: t10('NVIDIA=8.70;Microsoft=5.37;Amazon.com=4.89;Alphabet=4.79;Meta Platforms=4.49'),
  },
  ES0146309002: {
    fund: 'Horos Value Internacional FI', asOf: '2026-09-30',
    source: 'Horos AM, informe trimestral (cartera a 30/09/2026)',
    basis: 95.8,
    // «Àsia» (12,8 %) no es pot assignar a una sola regió; queda com a no detallat
    countries: kv('United States=10.1;LATAM=7.4;Norway=4.7;United Kingdom=3.1;Canada=2.9'),
    sectors: kv('Holding=22.5;TMT=16.5;Financials=14.3;Cyclical consumer=11.3;Industrials=9.9;Oil & gas=7.2;Energy=4.8;Defensive consumer=4.4;Real Estate=2.2'),
    top10: t10('Acciona Energía=4.8;TGS=4.7;Naspers=4.6;Pluxee=3.5;Suzano=3.4;Bolloré=3.3;Meliá Hotels=3.2;Exor=3.2;PayPal=3.1;Zigup=3.1'),
    top10Total: 36.9,
  },
  ES0146311008: {
    fund: 'Horos Value Iberia FI', asOf: '2026-09-30',
    source: 'Horos AM, informe trimestral (cartera a 30/09/2026)',
    basis: 87.2,
    countries: kv('Spain=76.1;Portugal=8.4;Other=2.7'),
    sectors: kv('Industrials=20.6;Financials=13.2;Defensive consumer=11.6;Energy=10.3;Cyclical consumer=8.7;Real Estate=5.8;Healthcare=5.7;Other=5.5;Holding=4.6'),
    // el top-10 publicat inclou un 5,5 % en Horos Value Internacional (un altre fons, no una empresa):
    // es treu de la llista d'empreses però es manté al pes total del top-10
    top10: t10('Acciona Energía=8.0;Alantra=7.1;Meliá Hotels=5.3;Gestamp=4.7;Semapa=4.6;DIA=4.5;Amrest=4.3;Miquel y Costas=3.6;Vidrala=3.4'),
    top10Total: 51.0,
  },
  LU0252963896: {
    fund: 'BlackRock Global Funds World Energy Fund', asOf: '2026-10-31',
    source: 'BlackRock, web del fons (blackrock.com/ch, classe D2 EUR) a 31/10/2026. Tots els subsectors són energia',
    basis: 98.72,
    countries: kv('United States=55.81;Canada=15.22;France=10.24;United Kingdom=9.77;Norway=3.62;Spain=2.60;Netherlands=1.22;Other=0.24'),
    sectors: kv('Energy=98.72'),
    size: { gran: 98.72, petita: 0 }, sizeSource: 'BlackRock: grans (>10.000 M$) 93,73 % i mitjanes 4,99 %; petites 0 %: grans i mitjanes 98.72 %, petites 0 %',
    top10: t10('Exxon Mobil=9.78;Chevron=9.78;Shell=9.77;TotalEnergies=8.97;Cheniere Energy=5.07;Canadian Natural Resources=4.88;Suncor Energy=4.83;Targa Resources=4.82;ConocoPhillips=4.56;TC Energy=4.02'),
    top10Total: 66.48,
  },
  IE00B3VXGD32: {
    fund: 'Polar Capital Biotechnology Fund', asOf: '2026-09-30',
    source: 'Fidelity UK, fitxa del fons (dades Morningstar, cartera a 30/09/2026; classe I GBP, mateixa cartera)',
    countries: kv('United States=89.24;United Kingdom=4.29;Canada=2.94;Europe ex Euro=1.86;Eurozone=1.67'),
    sectors: kv('Health Care=100'),
    size: { gran: 31, petita: 68 }, sizeSource: 'Estil Morningstar: grans i mitjanes 31 %, petites 68 %',
    top10: t10('Amgen=5.18;Alnylam Pharmaceuticals=4.64;Madrigal Pharmaceuticals=4.62;argenx=4.45;Arcutis Biotherapeutics=4.34;Insmed=4.34;Rhythm Pharmaceuticals=3.94;Ascendis Pharma=3.67;Revolution Medicines=3.53;Praxis Precision Medicines=3.19'),
    top10Total: 41.89,
  },
  IE00BF0GL436: {
    fund: 'Polar Capital Artificial Intelligence Fund', asOf: '2026-09-30',
    source: 'Fidelity UK, fitxa del fons (dades Morningstar, cartera a 30/09/2026). «Asia - Developed» (Corea, Taiwan, Hong Kong, Singapur) no es pot assignar a una sola regió',
    countries: kv('United States=62.96;Japan=12.08;Eurozone=7.87;Asia - Emerging=1.6;United Kingdom=1.4;Latin America=0.5;Asia - Developed=13.59'),
    sectors: kv('Technology=53.61;Industrials=21.71;Comm services=6.20;Con defensive=5.22;Financial svs=4.72;Con cyclical=4.56;Healthcare=2.62;Energy=1.35'),
    size: { gran: 95, petita: 5 }, sizeSource: 'Estil Morningstar: grans i mitjanes 95 %, petites 5 %',
    top10: t10('NVIDIA=5.33;Advanced Micro Devices=3.70;Intel=2.85;Seagate Technology=2.76;Alphabet=2.55;Comfort Systems USA=2.52;Micron Technology=2.21;Johnson Controls=2.18;SanDisk=2.13;Lam Research=2.04'),
    top10Total: 28.28,
  },
  LU1841614867: {
    fund: 'Fidelity Funds Global Technology Fund', asOf: '2026-09-30',
    source: 'Fidelity UK, fitxa del fons (dades Morningstar, cartera a 30/09/2026)',
    countries: kv('United States=55.9;Asia - Developed=14.71;Eurozone=13.15;Asia - Emerging=8.24;Japan=3.62;United Kingdom=1.84;Europe ex Euro=1.74;Middle East=0.81'),
    sectors: kv('Technology=69.33;Comm services=14.54;Con cyclical=6.67;Industrials=4.22;Real estate=2.73;Basic materials=1.14;Financial svs=0.79;Energy=0.59'),
    size: { gran: 94, petita: 6 }, sizeSource: 'Estil Morningstar: grans i mitjanes 94 %, petites 6 %',
    top10: t10('Taiwan Semiconductor Manufacturing=9.57;Microsoft=7.06;Apple=5.74;Alphabet=4.57;ASML=3.92;Texas Instruments=3.87;Amazon.com=3.69;Meta Platforms=2.61;Samsung Electronics=2.51;Oracle=2.07'),
    top10Total: 45.60,
  },
  LU0353647737: {
    fund: 'Fidelity Funds European Dividend Fund', asOf: '2026-09-30',
    source: 'Fidelity UK, fitxa del fons (dades Morningstar, cartera a 30/09/2026)',
    countries: kv('Eurozone=57.43;United Kingdom=25.74;Europe ex Euro=16.83'),
    sectors: kv('Financial svs=36.41;Industrials=17.81;Con defensive=13.43;Healthcare=10.44;Con cyclical=9.03;Energy=4.77;Utilities=3.33;Basic materials=2.85;Technology=1.45;Comm services=0.47'),
    size: { gran: 100, petita: 0 }, sizeSource: 'Estil Morningstar: grans i mitjanes 100 %, petites 0 %',
    top10: t10('AIB Group=4.91;TotalEnergies=4.60;UniCredit=4.58;Deutsche Börse=4.32;KBC=3.68;Ahold Delhaize=3.59;Reckitt Benckiser=2.99;Coca-Cola Europacific Partners=2.92;Compass Group=2.83;3i Group=2.80'),
    top10Total: 37.21,
  },
  LU2813189938: {
    fund: 'Fidelity Funds Global Defensive Equity Fund', asOf: '2026-09-30',
    source: 'Fidelity UK, fitxa del fons (dades Morningstar, cartera a 30/09/2026; classe W GBP, mateixa cartera)',
    countries: kv('United States=31.95;Eurozone=27.14;United Kingdom=20.42;Europe ex Euro=7.32;Japan=5.83;Asia - Developed=5.7;Asia - Emerging=1.65'),
    sectors: kv('Financial svs=22.15;Industrials=21.85;Con defensive=12.74;Con cyclical=11.34;Basic materials=10.87;Technology=8.91;Healthcare=5.62;Utilities=4.03;Comm services=2.50'),
    size: { gran: 97, petita: 2 }, sizeSource: 'Estil Morningstar: grans i mitjanes 97 %, petites 2 %',
    top10: t10('Tesco=4.93;Taiwan Semiconductor Manufacturing=4.72;Roche=4.56;Deutsche Börse=4.39;Iberdrola=4.00;Linde=3.76;Air Liquide=3.45;Legrand=3.45;CME Group=3.35;Progressive=3.09'),
    top10Total: 39.69,
  },
  LU1627197004: {
    fund: 'Fidelity Funds Global Equity Income ESG Fund', asOf: '2026-09-30',
    source: 'Fidelity UK, fitxa del fons (dades Morningstar, cartera a 30/09/2026)',
    countries: kv('United States=37.12;Eurozone=24.74;United Kingdom=16.14;Europe ex Euro=8.62;Japan=5.94;Asia - Developed=5.64;Asia - Emerging=1.79'),
    sectors: kv('Financial svs=24.31;Industrials=23.17;Basic materials=12.26;Con cyclical=11.91;Technology=10.19;Con defensive=8.88;Healthcare=6.31;Comm services=2.97'),
    size: { gran: 98, petita: 3 }, sizeSource: 'Estil Morningstar: grans i mitjanes 98 %, petites 3 %',
    // el top-10 publicat inclou un 3,67 % en un fons monetari de Fidelity, que no és cap empresa
    top10: t10('Roche=5.14;Taiwan Semiconductor Manufacturing=4.73;Linde=4.59;Deutsche Börse=4.34;Legrand=3.85;Air Liquide=3.71;CME Group=3.68;Texas Instruments=3.46;Unilever=3.30'),
    top10Total: 40.48,
  },
  LU0329202252: {
    fund: 'JPMorgan Investment Funds Global Dividend Fund', asOf: '2026-10-31',
    source: 'Fidelity UK, fitxa del fons (dades Morningstar, cartera a 31/10/2026)',
    countries: kv('United States=60.23;Eurozone=11.69;Asia - Developed=9.31;United Kingdom=7.74;Japan=5.24;Europe ex Euro=3.7;Asia - Emerging=1.39'),
    sectors: kv('Technology=28.82;Financial svs=22.78;Healthcare=12.54;Industrials=9.16;Utilities=5.43;Comm services=5.26;Energy=5.26;Con cyclical=5.16;Basic materials=2.14;Con defensive=1.93;Real estate=1.51'),
    size: { gran: 100, petita: 0 }, sizeSource: 'Estil Morningstar: grans i mitjanes 100 %, petites 0 %',
    top10: t10('Microsoft=7.17;Taiwan Semiconductor Manufacturing=5.31;Mastercard=2.92;NVIDIA=2.60;NextEra Energy=2.56;Shell=2.23;Alphabet=2.12;Safran=2.01;Broadcom=1.91;AbbVie=1.90'),
    top10Total: 30.74,
  },
  IE00B8H6X308: {
    fund: 'Federated Hermes Asia ex-Japan Equity Fund', asOf: '2026-09-30',
    source: 'Fidelity UK, fitxa del fons (dades Morningstar, cartera a 30/09/2026; classe F GBP, mateixa cartera). «Asia - Developed» (Corea, Taiwan, Hong Kong, Singapur) no es pot assignar a una sola regió',
    countries: kv('Asia - Developed=51.34;Asia - Emerging=47.35;Japan=1.31'),
    sectors: kv('Technology=28.06;Financial svs=15.79;Con cyclical=14.33;Con defensive=11.13;Comm services=10.64;Industrials=9.22;Basic materials=6.20;Real estate=3.35;Energy=1.12'),
    size: { gran: 96, petita: 3 }, sizeSource: 'Estil Morningstar: grans i mitjanes 96 %, petites 3 %',
    top10: t10('Taiwan Semiconductor Manufacturing=10.30;Samsung Electronics=10.59;Tencent=7.28;Samsung Fire & Marine Insurance=3.30;AAC Technologies=3.27;CP All=2.93;Samsung Life Insurance=2.57;CATL=2.43'),
    top10Total: 42.66,
  },
  DE000DWS1U90: {
    fund: 'DWS Top Dividende', asOf: '2026-10-30',
    source: 'DWS, web del fons (funds.dws.com) amb cartera a 30/10/2026; només 5 països i 5 posicions',
    countries: kv('USA=33.3;Großbritannien=9.5;Kanada=8.9;Frankreich=7.3;Deutschland=5.9;Sonstiges=21.3'),
    top10: t10('Shell=3.4;Taiwan Semiconductor Manufacturing=3.3;Agnico Eagle Mines=3.2;Johnson & Johnson=3.1;TotalEnergies=2.9'),
  },
  LU0273159177: {
    fund: 'DWS Invest Gold and Precious Metals Equities', asOf: '2026-10-30',
    source: 'DWS, web del fons (funds.dws.com) amb cartera a 30/10/2026. Sector: el fons només inverteix en mineres de metalls preciosos (materials)',
    countries: kv('Kanada=46.0;USA=16.7;Großbritannien=12.8;Australien=10.3;Südafrika=8.4;Sonstiges=4.2'),
    sectors: kv('Materials=100'),
    top10: t10('Newmont=10.1;Agnico Eagle Mines=8.8;AngloGold Ashanti=7.8;Gold Fields=5.7;Northern Star Resources=5.0'),
  },
  ES0114673033: {
    fund: 'Bestinfond FI', asOf: '2026-10-31', source: 'Bestinver, fitxa mensual (dades a 31/10/2026; posicions principals a 30/09/2026)',
    basis: 95.4,
    countries: kv('Europa=55.9;EEUU=24.4;Iberia=8.6;Resto del mundo=6.6'),
    sectors: kv('Industria=35.8;Com. y Tec.=23.1;Consumo=21.6;Finanzas=14.9'),
    top10: t10('Meta Platforms=4.44;Barclays=2.96;Philips=2.92;Taiwan Semiconductor Manufacturing=2.86;Saint-Gobain=2.85'),
  },
  ES0119199000: {
    fund: 'Cobas Internacional FI', asOf: '2026-11-24', source: 'Cobas AM, web del fons consultada el 24/11/2026 (només publica els 6 subsectors principals)',
    basis: 97.4,
    countries: kv('Rest of Europe=36.4;Eurozone=27.9;United States=18.6'),   // «Àsia» 15,6 % i «altres» 1,5 % no es poden assignar a una regió
    sectors: kv('Exploración de petróleo y gas=11.2;Transporte y almacenamiento de petróleo y gas=10.8;Conglomerados industriales=10.6;Venta al por menor=10.4;Farmacéutico y biotecnología=7.6;Automóviles y componentes=7.1'),
  },
  ES0124037005: {
    fund: 'Cobas Selección FI', asOf: '2026-11-24', source: 'Cobas AM, web del fons consultada el 24/11/2026 (només publica els 6 subsectors principals)',
    basis: 97.4,
    countries: kv('Zona Euro=36.5;Resto de Europa=32.5;Estados Unidos=16.2'),   // «Àsia» 13,6 % i «otros» 1,3 % sense regió
    sectors: kv('Conglomerados industriales=10.6;Exploración de petróleo y gas=9.7;Transporte y almacenamiento de petróleo y gas=9.4;Venta al por menor=9.0;Farmacéutico y biotecnología=8.2;Automóviles y componentes=6.2'),
  },
  ES0113728002: {
    fund: 'Cobas Grandes Compañías FI', asOf: '2026-11-24', source: 'Cobas AM, web del fons consultada el 24/11/2026 (només publica els 6 subsectors principals)',
    basis: 97.0,
    countries: kv('Zona Euro=40.9;Estados Unidos=22.8;Resto de Europa=17.9'),   // «Àsia» 18,5 % i «otros» 1,2 % sense regió
    sectors: kv('Farmacéutico y biotecnología=13.2;Automóviles y componentes=13.2;Conglomerados industriales=10.9;Transporte y almacenamiento de petróleo y gas=9.6;Equip. y servicios de salud=8.4;Minería y metales=7.7'),
  },
  ES0119184002: {
    fund: 'Cobas Iberia FI', asOf: '2026-11-24', source: 'Cobas AM, web del fons consultada el 24/11/2026 (només publica els 6 subsectors principals)',
    basis: 97.9,
    countries: kv('España=80.2;Portugal=9.4;Otros=0.4'),
    sectors: kv('Minería y metales=16.5;Equip. y servicios de energía=11.7;Ingeniería y construcción=7.9;Farmacéutico y biotecnología=6.9;Papelero=6.9;Transporte=5.5'),
  },
  ES0112616000: {
    fund: 'Azvalor Iberia FI', asOf: '2026-06-30',
    source: 'Azvalor, informe semestral 1S2026 (cartera a 30/06/2026; només els 3 primers països i sectors)',
    countries: kv('Spain=59.5;Portugal=16.8;United States=5.0'),
    sectors: kv('Energy=25.7;Materials=18.3;Industrials=15.3'),
  },
  ES0112609005: {
    fund: 'Azvalor Blue Chips FI', asOf: '2026-06-30',
    source: 'Azvalor, informe semestral 1S2026 (cartera a 30/06/2026; només els principals països i sectors)',
    countries: kv('United States=41.5;Gran Bretaña=13.4;Canada=12.2'),
    sectors: kv('Energy=52;Materials=18.6'),
  },
  ES0112602000: {
    fund: 'Azvalor Managers FI', asOf: '2026-06-30',
    source: 'Azvalor, informe semestral 1S2026 (cartera a 30/06/2026; només els principals països i sectors)',
    countries: kv('United States=42;Spain=14.8;Gran Bretaña=8.2;Hong Kong=7.4;China=5.7'),
    sectors: kv('Energy=15.5;Materiales básicos=12.4;Industrials=11;Financials=9'),
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
  LU3123374798: 'LU2813189938',   // Fidelity Global Defensive (EUR/USD hedged)
  LU0326422176: 'LU0252963896', LU0408222247: 'LU0252963896', LU0171301533: 'LU0252963896', // BGF World Energy
};
