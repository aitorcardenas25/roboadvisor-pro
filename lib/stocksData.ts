// lib/stocksData.ts — Static curated analysis for tracked stocks.
// Prices/changes are reference values updated periodically; TradingView shows live data.

export type StockStatus = 'Oportunitat' | 'Neutral' | 'Vigilància' | 'Risc';

export interface StockDetail {
  ticker:      string;
  name:        string;
  sector:      string;
  exchange:    string;
  currency:    string;
  status:      StockStatus;
  statusColor: string;
  refPrice:    number;
  refChange:   number;   // % session change (reference)
  // Description
  description: string;
  segments:    string[];
  // Competitive
  competitive: string;
  rival:       string;
  rivalNote:   string;
  // Technical (orientatius)
  support1:    number;
  support2:    number;
  resistance1: number;
  resistance2: number;
  beta:        number;
  technicalNote: string;
  // Fundamentals (reference, TTM)
  pe:            number | null;
  eps:           number | null;
  revenueB:      number | null;  // billions USD/EUR
  revenueGrowth: number | null;  // %
  margin:        number | null;  // net margin %
  roe:           number | null;
  // Quarterly reference
  lastQDate:     string;
  lastQEpsAct:   number | null;
  lastQEpsEst:   number | null;
  nextQDate:     string;
  nextQEpsEst:   number | null;
  // Catalysts & risks
  catalysts: string[];
  risks:     string[];
  analysisDate: string;
}

export const STOCKS_DATA: StockDetail[] = [
  {
    ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology',
    exchange: 'NASDAQ', currency: 'USD',
    status: 'Oportunitat', statusColor: '#16a34a',
    refPrice: 189.30, refChange: +1.24,
    description: 'Apple dissenya, fabrica i ven electrònica de consum (iPhone, Mac, iPad, Watch), serveis digitals (App Store, iCloud, Apple Music, Apple TV+) i accessoris. El segment Serveis —el de major marge— supera ja el 20% dels ingressos totals.',
    segments: ['iPhone (50%+ ingressos)', 'Serveis (App Store, iCloud, ApplePay)', 'Mac & iPad', 'Wearables (Watch, AirPods)'],
    competitive: 'Ecosistema tancat amb costos de canvi excepcionals. Premium pricing sostingut per marca i fidelitat. Marges bruts >44% gràcies al mix creixent de serveis d\'alt marge.',
    rival: 'Samsung / Alphabet (Android)',
    rivalNote: 'Samsung lidera unitats globals però amb marges inferiors. Android (Alphabet) és el sistema operatiu dominant però Apple captura el 80%+ del profit pool del sector.',
    support1: 175.00, support2: 162.00, resistance1: 200.00, resistance2: 220.00,
    beta: 1.2, technicalNote: 'En consolidació sobre MA200. Ruptura per sobre de $200 obriria camí cap a nous màxims. Volum declinant en correccions —senyal constructiu.',
    pe: 29.5, eps: 6.42, revenueB: 385, revenueGrowth: 4.9, margin: 24.3, roe: 147,
    lastQDate: 'Feb 2025', lastQEpsAct: 2.40, lastQEpsEst: 2.35,
    nextQDate: 'Maig 2025', nextQEpsEst: 1.62,
    catalysts: ['Cicle de renovació iPhone 17 amb IA integrada', 'Serveis creixent >12% anual, alt marge', 'Recompra d\'accions agressiva (~$90B/any)'],
    risks: ['Regulació antitrust App Store (UE i EUA)', 'Saturació mercat premium smartphones', 'Dependència de la cadena de fabricació a la Xina'],
    analysisDate: '04/05/2025',
  },
  {
    ticker: 'NVDA', name: 'NVIDIA Corp.', sector: 'Semiconductors',
    exchange: 'NASDAQ', currency: 'USD',
    status: 'Oportunitat', statusColor: '#16a34a',
    refPrice: 875.40, refChange: +2.87,
    description: 'NVIDIA dissenya GPUs per a gaming, data centers, IA i vehicles autònoms. El segment Data Center és ja el >80% dels ingressos i creix >200% YoY impulsat per la demanda d\'acceleradors H100/H200 per entrenar models d\'IA.',
    segments: ['Data Center (>80%)', 'Gaming (PC & consola)', 'Professional Visualization', 'Automotive'],
    competitive: 'Monopoli de facto en acceleradors per a IA generativa amb quota >80%. CUDA —el seu ecosistema software— és el foss defensiu clau: migrar a alternatives té un cost prohibitiu per als clients.',
    rival: 'AMD / Intel / Google TPU',
    rivalNote: 'AMD progressa amb MI300X però CUDA crea lock-in profund. Google i Amazon dissenyen chips propis però per ús intern. Cap rival amenaça el lideratge a curt termini.',
    support1: 800.00, support2: 700.00, resistance1: 950.00, resistance2: 1050.00,
    beta: 1.7, technicalNote: 'Tendència alcista primària intacta. Cada correcció a MA50 ha estat una oportunitat de compra. RSI en zona neutra-positiva. Volatilitat alta —posicions amb gestió de risc.',
    pe: 35.0, eps: 25.00, revenueB: 96, revenueGrowth: 265, margin: 55.0, roe: 91,
    lastQDate: 'Feb 2025', lastQEpsAct: 5.16, lastQEpsEst: 4.59,
    nextQDate: 'Maig 2025', nextQEpsEst: 5.57,
    catalysts: ['Blackwell GPU — demanda supera oferta per 12-18 mesos', 'Expansió a inferència (no sols entrenament) dobla el TAM', 'NIM software stack monetitza l\'ecosistema per subscripció'],
    risks: ['Restriccions exportació a la Xina (H20 ban)', 'Valoració exigent: qualsevol decepció en guanys penalitza molt', 'AMD/Google TPU podrien erosionar quotes en segments específics'],
    analysisDate: '04/05/2025',
  },
  {
    ticker: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology',
    exchange: 'NASDAQ', currency: 'USD',
    status: 'Neutral', statusColor: '#c9a84c',
    refPrice: 415.50, refChange: +0.43,
    description: 'Microsoft ofereix sistemes operatius (Windows), aplicacions empresarials (Office 365, Teams, LinkedIn), cloud (Azure —el segon proveïdor mundial—) i gaming (Xbox, Activision Blizzard). Copilot IA s\'integra a tota la suite.',
    segments: ['Intelligent Cloud - Azure (34%)', 'Productivity - Office365 (34%)', 'More Personal Computing (32%)'],
    competitive: 'Duopoli cloud amb AWS. Office365 és pràcticament insuperable en enterprise per dependència sistèmica. Integració Copilot permet monetitzar IA sense substituir el core business.',
    rival: 'Amazon AWS / Alphabet Google Cloud',
    rivalNote: 'AWS manté lideratge en cloud pur (32% quota). Google Cloud creix més ràpid però des de base menor. MSFT destaca en hybrid cloud i integració amb el lloc de treball enterprise.',
    support1: 390.00, support2: 360.00, resistance1: 435.00, resistance2: 468.00,
    beta: 0.9, technicalNote: 'Consolidació en rang $390-$435. MA200 ascendent ofereix suport dinàmic. Ruptura per sobre de $435 amb volum seria senyal alcista. Beta baixa el fa defensiu dins el sector.',
    pe: 34.0, eps: 12.20, revenueB: 236, revenueGrowth: 16.0, margin: 35.9, roe: 38,
    lastQDate: 'Mar 2025', lastQEpsAct: 3.46, lastQEpsEst: 3.22,
    nextQDate: 'Jun 2025', nextQEpsEst: 3.55,
    catalysts: ['Azure creixent >25% — guanya quota vs AWS', 'Copilot per Empresa a $30/usuari/mes multiplica ARPU', 'Activision afegeix escala en gaming cloud'],
    risks: ['Valoració P/E >34x deixa poc marge a l\'error', 'Competència creixent en AI (OpenAI, Anthropic, Google)', 'Capex data centers comprimeix FCF a curt termini'],
    analysisDate: '04/05/2025',
  },
  {
    ticker: 'ASML', name: 'ASML Holding N.V.', sector: 'Industrials',
    exchange: 'AMS', currency: 'EUR',
    status: 'Oportunitat', statusColor: '#16a34a',
    refPrice: 820.10, refChange: -1.15,
    description: 'ASML fabrica les màquines de litografia per ultraviolat extrem (EUV i DUV) indispensables per fabricar els xips avançats de menys de 5nm. És l\'únic proveïdor mundial de EUV, creant un monopoli tecnològic sense precedents en semiconductors.',
    segments: ['EUV Lithography Systems', 'DUV Lithography Systems', 'Installed Base Management (serveis)'],
    competitive: 'Monopoli absolut en EUV. Cap rival pot fabricar màquines EUV —la competència tecnològica és de dues dècades. TSMC, Samsung i Intel no poden produir els xips més avançats sense ASML.',
    rival: 'Canon / Nikon (només DUV)',
    rivalNote: 'Canon i Nikon competeixen en DUV legacy però no poden entrar en EUV. ASML és indispensable per al futur dels semiconductors avançats — impossible de substituir a curt/mig termini.',
    support1: 750.00, support2: 680.00, resistance1: 900.00, resistance2: 1000.00,
    beta: 1.1, technicalNote: 'Correcció des de màxims >40%. Valoració s\'ha normalitzat. MA200 prop dels $750 ofereix suport fort. Cicle d\'inversió en semiconductors s\'accelera — ASML en posició privilegiada.',
    pe: 38.0, eps: 21.50, revenueB: 28, revenueGrowth: 14.0, margin: 27.0, roe: 42,
    lastQDate: 'Mar 2025', lastQEpsAct: 5.74, lastQEpsEst: 5.55,
    nextQDate: 'Jul 2025', nextQEpsEst: 7.12,
    catalysts: ['Next-gen High-NA EUV per a nodes 2nm i inferiors', 'Comandes rècord de TSMC i Samsung per expansió capacitat', 'Cicle inversió semiconductors post-restriccions China'],
    risks: ['Restriccions exportació EUV a la Xina (>15% dels ingressos)', 'Cicle long-lead: comandes es poden cancel·lar en recessió tech', 'Dependència de 2-3 clients (TSMC, Samsung, Intel)'],
    analysisDate: '04/05/2025',
  },
  {
    ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Communication Services',
    exchange: 'NASDAQ', currency: 'USD',
    status: 'Neutral', statusColor: '#c9a84c',
    refPrice: 490.20, refChange: +1.68,
    description: 'Meta opera Facebook, Instagram, WhatsApp i Threads. El 97% dels ingressos prové de publicitat digital. Investeix massivament en IA (Llama), realitat augmentada (Ray-Ban Meta) i computació espacial (Quest VR).',
    segments: ['Family of Apps - Publicitat (97%)', 'Reality Labs - AR/VR (-losses)'],
    competitive: 'Xarxa social amb major temps de pantalla global. 3.2B usuaris actius diaris. Algoritme de recomanació liderat per IA redueix el coste d\'adquisició publicitaria per als anunciants.',
    rival: 'Alphabet (YouTube) / TikTok / Snap',
    rivalNote: 'TikTok és la principal amenaça per a l\'atenció dels joves. YouTube competeix directament en vídeo llarg i curt. Meta manté avantatge en anuncis de resposta directa i ROAS mesurable.',
    support1: 450.00, support2: 410.00, resistance1: 535.00, resistance2: 580.00,
    beta: 1.3, technicalNote: 'Ruptura d\'una base d\'un any el 2024. Momentum positiu sostingut. MA50 per sobre MA200 (Golden Cross). Consolidació saludable en l\'entorn $450-$535 abans de pròxim impuls.',
    pe: 26.0, eps: 18.80, revenueB: 156, revenueGrowth: 21.0, margin: 35.3, roe: 35,
    lastQDate: 'Mar 2025', lastQEpsAct: 6.43, lastQEpsEst: 5.28,
    nextQDate: 'Jun 2025', nextQEpsEst: 5.72,
    catalysts: ['IA millorant ROAS +20-30% per anunciants', 'Monetització Threads i WhatsApp Business en fases inicials', 'Ray-Ban Meta — primer wearable AR amb adopció real'],
    risks: ['Risc regulatori (EU DSA, FTC antitrust)', 'Reality Labs consumeix $18B/any sense retorn clar', 'Possible ban TikTok als EUA podria reduir la pressió competitiva'],
    analysisDate: '04/05/2025',
  },
  {
    ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary',
    exchange: 'NASDAQ', currency: 'USD',
    status: 'Vigilància', statusColor: '#f59e0b',
    refPrice: 185.60, refChange: +0.92,
    description: 'Amazon opera el major marketplace e-commerce del món, AWS (el líder en cloud amb 32% quota), Prime (subscripció 200M membres), Advertising (creixent >25%/any) i Logistics pròpia.',
    segments: ['AWS Cloud (17% ingressos, 70% benefici)', 'North America Retail', 'International Retail', 'Advertising'],
    competitive: 'AWS és el negoci crític: marges 35%+ i creixent >17%. El retail opera amb marges baixos però genera el flywheel de dades i Prime que alimenta Ads i AWS.',
    rival: 'Microsoft Azure / Google Cloud / Walmart',
    rivalNote: 'En cloud, Azure i Google Cloud creixen més ràpid però AWS manté lideratge de mercat. En retail, Walmart i Shein/Temu pressionen en categories específiques.',
    support1: 168.00, support2: 155.00, resistance1: 200.00, resistance2: 220.00,
    beta: 1.2, technicalNote: 'Lateralitzant en rang ampli $168-$200 des de fa 6 mesos. Cal ruptura clara per sobre $200 per confirmar tendència alcista. MA200 ascendent manté biaix positiu a llarg termini.',
    pe: 40.0, eps: 4.65, revenueB: 575, revenueGrowth: 11.0, margin: 8.0, roe: 22,
    lastQDate: 'Mar 2025', lastQEpsAct: 1.59, lastQEpsEst: 1.36,
    nextQDate: 'Jun 2025', nextQEpsEst: 1.26,
    catalysts: ['AWS accelera: IA workloads demanden més cloud', 'Advertising >$55B anual creixent >25%', 'Eficiència logística: cost per unitat decreixent'],
    risks: ['Investigació antimonopoli FTC pot forçar desinversions', 'Capex massiu en IA comprimeix FCF', 'Recessió consumidor impacta retail (45% dels ingressos)'],
    analysisDate: '04/05/2025',
  },
  {
    ticker: 'SAN.MC', name: 'Banco Santander S.A.', sector: 'Financial Services',
    exchange: 'BME', currency: 'EUR',
    status: 'Vigilància', statusColor: '#f59e0b',
    refPrice: 4.82, refChange: -0.33,
    description: 'Banco Santander és el major banc de la zona euro per actius, amb presència a 9 mercats principals: Espanya, Regne Unit, Brasil, Mèxic, EUA, Argentina, Xile, Portugal i Polònia.',
    segments: ['Brasil (30%+ benefici)', 'Espanya', 'Regne Unit', 'EUA & Mèxic', 'SCF (Auto finance)'],
    competitive: 'Diversificació geogràfica única redueix volatilitat cíclica. Brasil i Mèxic aporten creixement estructural. Santander Consumer Finance lidera finançament auto a Europa.',
    rival: 'BBVA / BNP Paribas / JPMorgan',
    rivalNote: 'BBVA competeix directament a Espanya i Mèxic. BNP domina en banca corporativa europea. Santander destaca per escala en retail banking i lideratge a Latam.',
    support1: 4.40, support2: 4.00, resistance1: 5.00, resistance2: 5.50,
    beta: 1.0, technicalNote: 'Correcció des de màxims de l\'any. Zona $4.40-$4.50 és suport crític (MA200). Dividend yield >4% dóna suport fonamental. Tendència a mig termini positiva si els tipus es mantenen.',
    pe: 7.5, eps: 0.64, revenueB: 61, revenueGrowth: 8.0, margin: 27.0, roe: 14,
    lastQDate: 'Mar 2025', lastQEpsAct: 0.17, lastQEpsEst: 0.16,
    nextQDate: 'Jul 2025', nextQEpsEst: 0.17,
    catalysts: ['Tipus d\'interès alts sostenen NIM europeu', 'Brasil i Mèxic creixent +15%/any en benefici', 'Recompra d\'accions activa (5-10% del free float/any)'],
    risks: ['Depreciació BRL/MXN impacta benefici consolidat', 'Revisió a la baixa dels tipus BCE comprima marges europeus', 'Exposició a crèdit al consum en economies amb estrès laboral'],
    analysisDate: '04/05/2025',
  },
  {
    ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary',
    exchange: 'NASDAQ', currency: 'USD',
    status: 'Risc', statusColor: '#dc2626',
    refPrice: 172.80, refChange: -2.14,
    description: 'Tesla fabrica vehicles elèctrics (Model 3/Y/S/X/Cybertruck), bateries Megapack i sistemes de generació solar. Desenvolupa Autopilot/FSD i el robot humanoide Optimus. L\'energia i serveis representen un % creixent d\'ingressos.',
    segments: ['Automotive (85%+ ingressos)', 'Energy Generation & Storage', 'Services & Other'],
    competitive: 'Líder en VE premium als EUA. Supercharger network és avantatge únic. Integració vertical (bateries, software, xarxa) permet marges superiors als rivals tradicionals. Però erosionant.',
    rival: 'BYD / Volkswagen Group / General Motors EV',
    rivalNote: 'BYD supera Tesla en unitats globals i és molt més barat a la Xina. VW i GM inverteixen massivament en plataformes elèctriques. Tesla perd quota en segments mid-market.',
    support1: 152.00, support2: 138.00, resistance1: 200.00, resistance2: 240.00,
    beta: 2.0, technicalNote: 'Tendència bajista des de màxims de $400. Sèrie de màxims i mínims decreixents. Suport crític a $150 (múltiples regressions 2023-24). RSI en zona de sobrevenda en correccions però sense senyal de gir clar.',
    pe: 75.0, eps: 2.30, revenueB: 97, revenueGrowth: -1.0, margin: 7.3, roe: 10,
    lastQDate: 'Mar 2025', lastQEpsAct: 0.27, lastQEpsEst: 0.43,
    nextQDate: 'Jul 2025', nextQEpsEst: 0.40,
    catalysts: ['Model Q (vehicle <$30K) previst H2 2025', 'FSD v13 / Robotaxi — opcionalitat especulativa', 'Optimus robot: potencial a llarg termini si escala'],
    risks: ['Guerra de preus EV comprimeix marges a <10%', 'Elon Musk distret amb DOGE/X, risc execució', 'P/E >70x — valoració baked-in molt creixement que no es materialitza'],
    analysisDate: '04/05/2025',
  },
];

export function getStockDetail(ticker: string): StockDetail | undefined {
  return STOCKS_DATA.find(s => s.ticker.toUpperCase() === ticker.toUpperCase());
}
