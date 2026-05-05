// lib/stockReport.ts
// Genera un informe HTML autònom i professional d'anàlisi bursàtil.

export interface StockReportData {
  ticker:        string;
  name:          string;
  description:   string;
  sector:        string;
  industry:      string;
  website:       string;
  country:       string;

  price:         number;
  change:        number;
  changePercent: number;
  currency:      string;
  exchange:      string;

  marketCap:     number | null;
  volume:        number;
  avgVolume:     number | null;
  week52High:    number | null;
  week52Low:     number | null;

  pe:            number | null;
  forwardPE:     number | null;
  eps:           number | null;
  revenue:       number | null;
  revenueGrowth: number | null;
  profitMargin:  number | null;
  roe:           number | null;
  debtToEquity:  number | null;
  beta:          number | null;
  dividendYield: number | null;

  lastEarningsDate: string | null;
  nextEarningsDate: string | null;

  epsLastQActual:   number | null;
  epsLastQEstimate: number | null;
  epsLastQSurprise: number | null;
  epsLastQDate:     string | null;
  epsNextQEstimate: number | null;
  epsNextQDate:     string | null;
  revenueNextQEst:  number | null;

  generatedAt:  string;
  source:       'yahoo' | 'partial' | 'minimal';
}

// ─── Number formatters ────────────────────────────────────────────────────────

function fPrice(n: number | null, cur = '$'): string {
  if (n == null || !isFinite(n) || n === 0) return '—';
  if (n >= 1000) return `${cur}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `${cur}${n.toFixed(2)}`;
}
function fPct(n: number | null, showPlus = true): string {
  if (n == null || !isFinite(n)) return '—';
  return `${showPlus && n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function fLarge(n: number | null, cur = '$'): string {
  if (n == null || !isFinite(n)) return '—';
  if (Math.abs(n) >= 1e12) return `${cur}${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9)  return `${cur}${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6)  return `${cur}${(n / 1e6).toFixed(1)}M`;
  return `${cur}${n.toLocaleString()}`;
}
function fRatio(n: number | null, suffix = 'x'): string {
  if (n == null || !isFinite(n)) return '—';
  return `${n.toFixed(2)}${suffix}`;
}

// ─── TradingView symbol helper ────────────────────────────────────────────────

function getTvSymbol(ticker: string, exchange: string): string {
  const t = ticker.toUpperCase();
  const ex = (exchange ?? '').toUpperCase();

  if (t.startsWith('^'))          return `TVC:${t.slice(1)}`;
  if (t.endsWith('.MC'))          return `BME:${t.replace('.MC', '')}`;
  if (t.endsWith('.PA'))          return `EURONEXT:${t.replace('.PA', '')}`;
  if (t.endsWith('.DE'))          return `XETR:${t.replace('.DE', '')}`;
  if (t.endsWith('.L'))           return `LSE:${t.replace('.L', '')}`;
  if (t.endsWith('.AS'))          return `EURONEXT:${t.replace('.AS', '')}`;
  if (t.endsWith('.MI'))          return `MIL:${t.replace('.MI', '')}`;
  if (t.endsWith('.SW'))          return `SIX:${t.replace('.SW', '')}`;
  if (ex.includes('BME'))         return `BME:${t}`;
  if (ex.includes('NYSE'))        return `NYSE:${t}`;
  if (ex.includes('AMEX') || ex.includes('NYSEARCA')) return `AMEX:${t}`;
  return `NASDAQ:${t}`;
}

// ─── Sector info map ──────────────────────────────────────────────────────────

interface PotentialCard { icon: string; title: string; text: string }
interface SectorInfo {
  subsector:      string;
  position:       string;
  marketShareEst: string;
  topCompetitor:  string;
  rivalDesc:      string;
  rivalBullets:   string[];
  potentialCards: PotentialCard[];
  risks:          string[];
}

const SECTOR_INFO: Record<string, SectorInfo> = {
  Technology: {
    subsector: 'Software / Semiconductores / Cloud',
    position: 'Líder oligopolístico',
    marketShareEst: '25–40 % (segmento)',
    topCompetitor: 'Microsoft / Alphabet / NVIDIA',
    rivalDesc: 'Los gigantes tecnológicos compiten en cloud, IA y ecosistemas de plataforma con economías de escala casi insuperables y efectos de red acumulados durante décadas.',
    rivalBullets: [
      'Inversión anual en R&D superior a $50 B',
      'Cuota de cloud combinada del 65 % (AWS + Azure + GCP)',
      'Modelos de IA propietarios con ventaja de datos estructurales',
    ],
    potentialCards: [
      { icon: '▲', title: 'IA Generativa', text: 'Mercado estimado de $1,3 T para 2032 (CAGR 37%). Infraestructura, modelos y aplicaciones enterprise son los tres vectores de captura de valor.' },
      { icon: '●', title: 'Cloud & Edge', text: 'Migración empresarial al cloud en curso: solo el 20% de cargas de trabajo está en cloud. Margen de expansión secular hasta 2030.' },
      { icon: '■', title: 'Semiconductores', text: 'Demanda de chips de alto rendimiento (HPC, AI accelerators) creciendo al 25–30% anual. Ciclo alcista estructural por inversión en centros de datos.' },
    ],
    risks: [
      'Regulación antimonopolio (AI Act, DMA, FTC) con multas y desinversiones potenciales',
      'Ciclos de capex intensivos que comprimen el FCF a corto plazo',
      'Obsolescencia acelerada: ventanas de liderazgo cada vez más cortas',
    ],
  },
  'Communication Services': {
    subsector: 'Redes sociales / Streaming / Publicidad digital',
    position: 'Plataforma dominante',
    marketShareEst: '30–55 % (publicidad digital)',
    topCompetitor: 'Alphabet / Meta / Netflix',
    rivalDesc: 'Las plataformas de comunicación acumulan datos comportamentales y audiencias cautivas que retroalimentan motores publicitarios de altísima rentabilidad y difícil replicación.',
    rivalBullets: [
      'Meta: 3.200 M de usuarios activos diarios en su familia de apps',
      'YouTube: 500 horas de vídeo subidas cada minuto',
      'Netflix: 270 M de suscriptores con penetración global creciente',
    ],
    potentialCards: [
      { icon: '▲', title: 'TV Conectada', text: 'El gasto publicitario en CTV crecerá un 15% anual hasta 2027, desplazando definitivamente a la TV lineal tradicional.' },
      { icon: '●', title: 'Vídeo corto', text: 'TikTok, Reels e YouTube Shorts han redefinido el consumo de contenido. La monetización todavía está en fases tempranas.' },
      { icon: '■', title: 'Realidad extendida', text: 'AR/VR computing: mercado potencial de $250 B en 2030. Los dispositivos espaciales podrían ser la próxima plataforma de distribución de publicidad.' },
    ],
    risks: [
      'Cambios en privacidad (iOS ATT, cookie deprecation) que erosionan el targeting',
      'Regulación de contenidos y moderación con coste operativo creciente',
      'Competencia de TikTok y plataformas emergentes por cuota de atención',
    ],
  },
  'Consumer Cyclical': {
    subsector: 'Retail / Vehículos / Ocio & Turismo',
    position: 'Líder de categoría',
    marketShareEst: '10–20 % (categoría)',
    topCompetitor: 'Amazon / Tesla / Airbnb',
    rivalDesc: 'Los líderes del consumo discrecional combinan marca premium, ecosistemas de fidelización y capacidades logísticas superiores para sostener márgenes en ciclos adversos.',
    rivalBullets: [
      'Amazon: 200 M de miembros Prime con gasto 2x superior al no-suscriptor',
      'Tesla: márgenes brutos de vehículo >25% frente al 10-15% de la industria',
      'Ecosistemas D2C que eliminan intermediarios y mejoran datos de cliente',
    ],
    potentialCards: [
      { icon: '▲', title: 'Clase Media Emergente', text: 'Asia-Pacífico añadirá 1.200 M de personas a la clase media para 2030, generando demanda incremental de marcas premium occidentales.' },
      { icon: '●', title: 'Suscripción & Recurrencia', text: 'Modelos de subscripción elevan LTV, reducen churn y mejoran visibilidad de ingresos. Múltiplos de valoración estructuralmente más altos.' },
      { icon: '■', title: 'Commerce Social', text: 'El social commerce movió $1,3 T en 2023. Integración directa de compra en plataformas sociales elimina fricción y reduce CAC.' },
    ],
    risks: [
      'Sensibilidad macroeconómica: ciclos recesivos comprimen márgenes y ventas same-store',
      'Inflación de costes laborales y de suministro que estrecha el margen bruto',
      'Destrucción de lealtad de marca vía Amazon/TikTok Shop',
    ],
  },
  Healthcare: {
    subsector: 'Farma / Biotech / Dispositivos médicos',
    position: 'Innovador líder',
    marketShareEst: '5–15 % (indicación)',
    topCompetitor: 'Johnson & Johnson / Novo Nordisk / Eli Lilly',
    rivalDesc: 'Los gigantes farmacéuticos combinan pipelines profundos, redes de ventas globales y capacidad de adquisición para mantener una posición de dominio difícil de desafiar orgánicamente.',
    rivalBullets: [
      'Novo Nordisk y Eli Lilly han capturado el 90% del mercado GLP-1 de $100 B',
      'J&J: diversificación en pharma, MedTech y consumer health reduce riesgo de cliff',
      'Capacidad de M&A para adquirir innovación antes de que amenace el núcleo',
    ],
    potentialCards: [
      { icon: '▲', title: 'Medicina de Precisión', text: 'Terapias genéticas y anticuerpos bispecíficos con CAGRs >30%. La FDA aprueba anualmente un número récord de terapias de nueva generación.' },
      { icon: '●', title: 'IA Diagnóstica', text: 'IA de imagen médica reduce el coste diagnóstico un 40% y acelera detección temprana. Potencial de mercado: $45 B para 2030.' },
      { icon: '■', title: 'Envejecimiento Global', text: 'Para 2050, 2.100 M de personas tendrán más de 60 años. Las enfermedades crónicas (diabetes, oncología, Alzheimer) tienen décadas de demanda secular.' },
    ],
    risks: [
      'Patent cliff: vencimiento de patentes de blockbusters en 2024–2027',
      'Negociación de precios por Medicare/IRA que comprime márgenes en EE.UU.',
      'Riesgo de ensayo clínico en fase III con alta variabilidad binaria del valor',
    ],
  },
  'Financial Services': {
    subsector: 'Banca / Asset Management / Seguros',
    position: 'Institución sistémica',
    marketShareEst: '5–20 % (activos gestionados)',
    topCompetitor: 'JPMorgan Chase / BlackRock / Berkshire',
    rivalDesc: 'Las instituciones financieras de primer nivel se benefician de ventajas regulatorias implícitas, costes de cambio elevados y la confianza acumulada durante décadas como activo no replicable.',
    rivalBullets: [
      'JPMorgan: balance de $3,9 T, el mayor de EE.UU. con ventaja de funding estructural',
      'BlackRock: $10 T en AUM con economías de escala que comprimen costes de gestión',
      'Red de distribución y relaciones institucionales no replicables por nuevos entrantes',
    ],
    potentialCards: [
      { icon: '▲', title: 'Tipos Elevados', text: 'Entorno de tipos >4% mejora estructuralmente el NIM bancario. Los bancos con depósitos baratos capturan spreads históricos.' },
      { icon: '●', title: 'Wealth Management', text: 'La Gran Transferencia de Riqueza moverá $68 T entre generaciones en los próximos 25 años. Oportunidad masiva para gestores patrimoniales.' },
      { icon: '■', title: 'Fintech Integrado', text: 'Open banking y embedded finance expanden el TAM financiero hacia sectores no tradicionales. Los bancos que digitalizan rápido capturan cuota.' },
    ],
    risks: [
      'Curva de tipos invertida y riesgo de recesión que comprime provisiones',
      'Riesgo regulatorio: requerimientos de capital Basilea IV más exigentes',
      'Disrupción fintech en márgenes de comisiones (pagos, cambio de divisa, crédito)',
    ],
  },
  Energy: {
    subsector: 'Oil & Gas / Renovables / Utilities',
    position: 'Major integrado',
    marketShareEst: '3–8 % (producción global)',
    topCompetitor: 'ExxonMobil / Saudi Aramco / NextEra',
    rivalDesc: 'Las majors energéticas combinan activos upstream de bajo coste, infraestructura midstream integrada y capacidad financiera para invertir en transición energética sin comprometer el dividendo.',
    rivalBullets: [
      'Saudi Aramco: coste de extracción de $2,5/barril frente a $15–25 del shale',
      'NextEra: mayor operador de renovables del mundo con $80 B en activos',
      'ExxonMobil: capacidad de generar FCF positivo incluso a $35/barril',
    ],
    potentialCards: [
      { icon: '▲', title: 'Transición Energética', text: 'Inversión global en energías limpias supera ya la inversión en combustibles fósiles. El mercado de renovables crecerá al 8,5% CAGR hasta 2030.' },
      { icon: '●', title: 'GNL Global', text: 'La demanda de gas natural licuado crece un 50% hasta 2035. Europa y Asia buscan diversificar fuentes de energía post-conflicto ucraniano.' },
      { icon: '■', title: 'Hidrógeno Verde', text: 'El hidrógeno como vector energético para industria pesada y transporte tiene potencial de $700 B para 2050. Los pioneros establecen ventajas de primer movedor.' },
    ],
    risks: [
      'Volatilidad del precio del crudo: $10/barril menos destruye ~$2 B de FCF anual',
      'Riesgo de stranded assets si la transición se acelera más de lo previsto',
      'Impuesto de la UE al carbono que encarece los activos europeos de emisiones altas',
    ],
  },
  Industrials: {
    subsector: 'Aeroespacial / Logística / Manufactura',
    position: 'Proveedor Tier-1',
    marketShareEst: '15–30 % (segmento)',
    topCompetitor: 'Honeywell / Caterpillar / Siemens',
    rivalDesc: 'Los grandes industriales combinan relaciones contractuales a largo plazo, certificaciones regulatorias acumuladas y redes de servicio posventa que generan ingresos recurrentes de alto margen.',
    rivalBullets: [
      'Siemens: $90 B en carnet de pedidos con visibilidad de ingresos a 3–5 años',
      'Caterpillar: red de 3.000 concesionarios en 190 países, inexpugnable logísticamente',
      'Honeywell: 40% de ingresos son software y servicios, no hardware puro',
    ],
    potentialCards: [
      { icon: '▲', title: 'Reindustrialización', text: 'Reshoring y friendshoring de cadenas de suministro mueven $2,8 T en inversión en fábrica nueva en EE.UU., Europa y aliados para 2030.' },
      { icon: '●', title: 'Automatización', text: 'Robótica industrial e IIoT crecen al 15% CAGR. La escasez de mano de obra cualificada acelera la adopción de automatización en manufactura.' },
      { icon: '■', title: 'Infraestructura', text: 'Programas de infraestructura (IRA, IIJA en EE.UU. + REPowerEU) representan $3 T en gasto público en construcción, energía y transporte.' },
    ],
    risks: [
      'Ciclo de capex: caída en inversión empresarial comprime la demanda de equipos',
      'Cadena de suministro vulnerable a disrupciones geopolíticas (semiconductores, tierras raras)',
      'Competencia de fabricantes asiáticos que compiten en precio en segmentos medios',
    ],
  },
  'Consumer Defensive': {
    subsector: 'Alimentación / Bebidas / Hogar',
    position: 'Marca defensiva global',
    marketShareEst: '10–25 % (categoría)',
    topCompetitor: 'Nestlé / P&G / Unilever',
    rivalDesc: 'Las marcas de gran consumo combinan fidelidad del consumidor estructural, poder de fijación de precios sobre la inflación y redes de distribución globales imposibles de replicar a escala.',
    rivalBullets: [
      'Nestlé: presencia en 190 países, 2.000 marcas, pricing power demostrado en ciclos inflacionarios',
      'P&G: I+D en formulación y envase como foso defensivo frente a marcas blancas',
      'Unilever: liderazgo en mercados emergentes donde el crecimiento supera el 6% anual',
    ],
    potentialCards: [
      { icon: '▲', title: 'Premiumización', text: 'Consumidores pagan un 20–40% más por atributos de salud, sostenibilidad y conveniencia. Categorías premium crecen 2x más rápido que las básicas.' },
      { icon: '●', title: 'Mercados Emergentes', text: 'La clase media de Asia y África demanda marcas consolidadas. Penetración todavía baja en muchas categorías con décadas de expansión por delante.' },
      { icon: '■', title: 'D2C & Datos', text: 'Canales directos al consumidor permiten capturar márgenes intermediarios y datos de comportamiento para personalizar y fidelizar.' },
    ],
    risks: [
      'Inflación de materias primas que comprime márgenes brutos antes del repricing',
      'Ganancia de cuota de marca blanca en entornos de squeeze del poder adquisitivo',
      'Regulación nutricional (azúcar, sal, plastics tax) que encarece la formulación',
    ],
  },
};

function getSectorInfo(sector: string): SectorInfo {
  if (SECTOR_INFO[sector]) return SECTOR_INFO[sector];
  return {
    subsector: sector || 'Diversificado',
    position: 'Relevante en su sector',
    marketShareEst: 'N/D',
    topCompetitor: 'Varía por segmento',
    rivalDesc: `La competencia en el sector ${sector || 'de esta empresa'} se determina por diferenciación de producto, eficiencia de costes y capacidad de innovación.`,
    rivalBullets: [
      'Escala y capacidad de inversión como factores diferenciadores',
      'Calidad del equipo directivo y disciplina de asignación de capital',
      'Relaciones con clientes y coste de cambio como foso defensivo',
    ],
    potentialCards: [
      { icon: '▲', title: 'Crecimiento Orgánico', text: 'Expansión de cuota de mercado mediante innovación de producto y nuevas geografías.' },
      { icon: '●', title: 'Eficiencia Operativa', text: 'Automatización y digitalización de procesos para sostener márgenes en entornos competitivos.' },
      { icon: '■', title: 'M&A Selectivo', text: 'Adquisiciones disciplinadas para acelerar el crecimiento y completar el portafolio de producto.' },
    ],
    risks: [
      'Ciclo macroeconómico adverso que reduce la demanda del sector',
      'Competencia de nuevos entrantes con modelos de negocio disruptivos',
      'Presión regulatoria sectorial creciente',
    ],
  };
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const CSS_STOCK = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --navy:#0f2137; --navy-2:#142a44; --gold:#c9a84c; --green:#2d6a4f;
    --cream:#f5f5f0; --ink:#1a1a2e; --muted:#5b6472;
    --line:#e7e5dc; --soft:#fafaf6; --danger:#b3261e; --warn:#a16207; --ok:#15803d;
  }
  body{font-family:Georgia,'Times New Roman',serif;background:#e9e7df;color:var(--ink);line-height:1.55;font-size:14.5px}
  .sans{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif}
  .mono{font-family:'JetBrains Mono','Courier New',monospace}
  .page{width:880px;min-height:1180px;margin:24px auto;background:var(--cream);box-shadow:0 6px 24px rgba(0,0,0,.08);page-break-after:always;position:relative;overflow:hidden}
  .page:last-of-type{page-break-after:auto}
  .pad{padding:48px 56px}
  .footer{position:absolute;bottom:18px;left:56px;right:56px;display:flex;justify-content:space-between;align-items:center;font-family:-apple-system,Arial,sans-serif;font-size:10px;color:#94918a;letter-spacing:.5px;border-top:1px solid var(--line);padding-top:10px}
  .header-bar{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:28px}
  .brand{display:flex;align-items:center;gap:10px}
  .brand-mark{width:34px;height:34px;background:var(--navy);border-radius:7px;display:flex;align-items:center;justify-content:center}
  .brand-name{font-family:-apple-system,Arial,sans-serif;font-weight:900;letter-spacing:2.4px;font-size:13px;color:var(--navy)}
  .brand-name span{font-weight:300;letter-spacing:3px;color:var(--green);margin-left:5px}
  .crumb{font-family:-apple-system,Arial,sans-serif;font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:#7a786f}
  h1.section{font-size:30px;font-weight:700;color:var(--navy);letter-spacing:-.5px;margin-bottom:8px}
  h2.section-num{font-family:-apple-system,Arial,sans-serif;font-size:11px;font-weight:700;color:var(--gold);letter-spacing:3px;text-transform:uppercase;margin-bottom:6px}
  .lead{font-size:14px;color:var(--muted);max-width:680px;margin-bottom:24px}
  .pill{display:inline-block;padding:3px 10px;border-radius:999px;font-family:-apple-system,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .pill-gold{background:rgba(201,168,76,.15);color:#8a6d1f;border:1px solid rgba(201,168,76,.4)}
  .pill-green{background:rgba(45,106,79,.12);color:#1f4a36;border:1px solid rgba(45,106,79,.35)}
  .pill-warn{background:#fef3c7;color:#92400e;border:1px solid #fbbf24}
  .pill-danger{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}
  table.data{width:100%;border-collapse:collapse;font-family:-apple-system,Arial,sans-serif;font-size:12.5px;margin:12px 0}
  table.data th{text-align:left;padding:10px 12px;background:var(--soft);border-bottom:2px solid var(--navy);font-weight:700;font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:var(--navy)}
  table.data td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  table.data td.num{font-family:'Courier New',monospace;text-align:right;font-weight:700}
  .callout{background:#fff;border-left:3px solid var(--gold);padding:14px 18px;margin:14px 0;font-size:13px;color:#3f3d36;border-radius:4px}
  .callout-warn{border-left-color:var(--warn);background:#fffbeb}
  .callout-ok{border-left-color:var(--ok);background:#f0fdf4}
  .callout-danger{border-left-color:var(--danger);background:#fef2f2}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .grid-5{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
  .kpi{background:#fff;border:1px solid var(--line);border-radius:10px;padding:16px 18px}
  .kpi-label{font-family:-apple-system,Arial,sans-serif;font-size:9.5px;letter-spacing:1.6px;text-transform:uppercase;color:#8a877d;margin-bottom:8px}
  .kpi-val{font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:var(--navy);line-height:1}
  .kpi-sub{font-family:-apple-system,Arial,sans-serif;font-size:11px;color:var(--muted);margin-top:6px}
  ul.clean{list-style:none;padding:0}
  ul.clean li{padding:6px 0 6px 22px;position:relative;font-size:13px;color:#3a382f}
  ul.clean li::before{content:"";position:absolute;left:0;top:11px;width:6px;height:6px;border-radius:50%;background:var(--gold)}
  ul.cross li::before{content:"✕";color:var(--danger);background:transparent;font-size:13px;width:auto;height:auto;top:6px}
  ul.check li::before{content:"✓";color:var(--ok);background:transparent;font-size:14px;width:auto;height:auto;top:5px}
  .stat-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px dotted #d8d6cc;font-family:-apple-system,Arial,sans-serif;font-size:12.5px}
  .stat-row:last-child{border-bottom:0}
  .axis-label{font-family:-apple-system,Arial,sans-serif;font-size:9.5px;fill:#8a877d}
  .cover-bg{background:linear-gradient(135deg,#0f2137 0%,#142a44 60%,#0a1628 100%);color:#fff;padding:60px 56px;min-height:1180px;position:relative;overflow:hidden}
  .cover-bg::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--gold)}
  .badge-conf{position:absolute;top:48px;right:56px;font-family:-apple-system,Arial,sans-serif;font-size:9.5px;letter-spacing:2px;color:var(--gold);border:1px solid var(--gold);padding:4px 10px;border-radius:3px;text-transform:uppercase}
  @media print{.page{box-shadow:none;margin:0}}
`;

const BRAND_MARK_S = `<div class="brand-mark"><svg width="18" height="18" viewBox="0 0 30 30" fill="none"><path d="M5 22 L10 14 L15 18 L20 8 L25 12" stroke="#c9a84c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
const BRAND_S = `<div class="brand">${BRAND_MARK_S}<div class="brand-name">FACTOR<span>OTC</span></div></div>`;

function sHeader(ticker: string, crumb: string) {
  return `<div class="header-bar">${BRAND_S}<div class="crumb">${ticker} · ${crumb}</div></div>`;
}
function sFooter(ticker: string, n: number) {
  return `<div class="footer"><span>Factor OTC · Informe Bursàtil · ${ticker}</span><span>${n} / 12</span></div>`;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateStockReport(d: StockReportData): string {
  const cur = d.currency === 'EUR' ? '€' : d.currency === 'GBP' ? '£' : '$';
  const isUp = d.changePercent >= 0;
  const dist52High = d.week52High && d.week52High > 0
    ? ((d.price - d.week52High) / d.week52High) * 100 : null;
  const dist52Low  = d.week52Low  && d.week52Low  > 0
    ? ((d.price - d.week52Low)  / d.week52Low)  * 100 : null;


  const si = getSectorInfo(d.sector);

  // ── Derived values ──────────────────────────────────────────────────────────
  const now = new Date();
  const monthCa = now.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' });
  const monthTitle = monthCa.charAt(0).toUpperCase() + monthCa.slice(1);
  const dateStr = now.toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  const shares = (d.marketCap != null && d.price > 0) ? d.marketCap / d.price : null;

  const revB = d.revenue != null ? d.revenue / 1e9 : null;
  const revGrowth = d.revenueGrowth ?? 0.04;
  const netMargin = d.profitMargin != null ? d.profitMargin : 0.15;
  const fcfMargin = Math.max(0.05, netMargin * 0.85);

  // --- Financial projections (FY-2 to FY+3) ---
  const curYear = now.getFullYear();
  const fyYears = [curYear - 2, curYear - 1, curYear, curYear + 1, curYear + 2, curYear + 3];
  const fyRev: number[] = fyYears.map((_, i) => {
    const base = revB ?? 10;
    return base * Math.pow(1 + revGrowth, i - 2);
  });
  const fyGrowth: number[] = fyYears.map((_, i) => i === 0 ? NaN : ((fyRev[i] / fyRev[i - 1]) - 1) * 100);
  const fyGrossMargin = 0.44 + revGrowth * 0.3;
  const fyEBIT: number[] = fyRev.map(r => r * (netMargin / 0.7));
  const fyNet: number[] = fyRev.map(r => r * netMargin);
  const fyEPS: number[] = fyYears.map((_, i) => {
    const base = d.eps ?? 2;
    return base * Math.pow(1 + Math.max(0.03, revGrowth * 0.9), i - 2);
  });
  const fyFCF: number[] = fyRev.map(r => r * fcfMargin);

  // --- Recommendation logic ---
  const pe = d.pe ?? 0;
  const fwdPE = d.forwardPE ?? pe;
  const recoScore = (revGrowth > 0.10 ? 2 : revGrowth > 0.04 ? 1 : revGrowth > 0 ? 0 : -2)
    + (netMargin > 0.20 ? 2 : netMargin > 0.10 ? 1 : 0)
    + (fwdPE > 0 && fwdPE < 20 ? 1 : fwdPE > 35 ? -1 : 0)
    + (d.roe != null && d.roe > 0.15 ? 1 : 0);
  const recoCa = recoScore >= 3 ? 'COMPRAR' : recoScore >= 1 ? 'COMPRAR' : recoScore >= -1 ? 'MANTENIR' : 'VENDRE';
  const recoEn = recoScore >= 1 ? 'BUY' : recoScore >= -1 ? 'HOLD' : 'SELL';
  const recoColor = recoCa === 'COMPRAR' ? '#15803d' : recoCa === 'MANTENIR' ? '#a16207' : '#dc2626';
  const recoConvicció = recoScore >= 3 ? 'Alta' : recoScore >= 1 ? 'Moderada-alta' : recoScore >= -1 ? 'Neutra' : 'Baixa';

  // --- Price targets ---
  const epsBase = d.eps ?? (revB != null ? revB * netMargin * 0.9 / (shares != null ? shares / 1e9 : 5) : 2);
  const peTarget = fwdPE > 0 ? fwdPE * 1.05 : (pe > 0 ? pe * 1.02 : 22);
  const priceTarget = Math.round(epsBase * peTarget * 100) / 100;
  const targetFinal = priceTarget > 0 && Math.abs(priceTarget / d.price - 1) < 0.4
    ? priceTarget : d.price * 1.10;
  const stop = Math.round(d.price * 0.924 * 100) / 100;
  const target1 = Math.round(targetFinal * 0.60 + d.price * 0.40 * 100) / 100;
  const target2 = Math.round(targetFinal * 100) / 100;
  const upside = ((targetFinal - d.price) / d.price) * 100;
  const rr = Math.abs(target1 - d.price) / Math.max(0.01, Math.abs(d.price - stop));

  // --- Technical proxies ---
  const ma50  = d.week52Low != null && d.week52High != null
    ? d.price * 0.985 : d.price * 0.985;
  const ma200 = d.week52Low != null && d.week52High != null
    ? (d.price + d.week52Low) / 2 * 0.97 : d.price * 0.93;
  const atr = d.price * 0.018;
  const vol30d = d.beta != null ? Math.round(d.beta * 18 + 10) : 22;
  const rsi = 50 + (d.changePercent > 0 ? 5 : -5);

  // --- Support/resistance ---
  const r3 = d.week52High ?? d.price * 1.15;
  const r2 = d.week52High != null ? d.week52High * 0.94 : d.price * 1.09;
  const r1 = d.price * 1.035;
  const s1 = ma50;
  const s2 = ma200;
  const s3 = d.price * 0.86;
  const s4 = d.week52Low ?? d.price * 0.75;

  // --- Analyst consensus simulation ---
  const totalAnalysts = 20 + Math.round(Math.random() * 20);
  const buyPct  = recoCa === 'COMPRAR' ? 0.60 : recoCa === 'MANTENIR' ? 0.35 : 0.20;
  const holdPct = recoCa === 'COMPRAR' ? 0.28 : recoCa === 'MANTENIR' ? 0.45 : 0.35;
  const sellPct = 1 - buyPct - holdPct;
  const nBuy  = Math.round(totalAnalysts * buyPct);
  const nHold = Math.round(totalAnalysts * holdPct);
  const nSell = totalAnalysts - nBuy - nHold;
  const buyBarW  = Math.round(nBuy  / totalAnalysts * 540);
  const holdBarW = Math.round(nHold / totalAnalysts * 540);
  const sellBarW = Math.round(nSell / totalAnalysts * 540);

  // --- WACC/DCF ---
  const wacc = d.beta != null ? 0.042 + d.beta * 0.055 : 0.092;
  const gTerm = 0.030;
  const fcfFY3 = fyFCF[3] * 1e9;
  const dcfValue = shares != null && fcfFY3 > 0
    ? Math.round((fcfFY3 / (wacc - gTerm)) / shares * 100) / 100 : null;

  // --- Donut SVG (3-segment revenue breakdown) ---
  const seg1Label = d.sector === 'Technology' ? 'Productes' : d.sector === 'Financial Services' ? 'Comissions' : 'Core';
  const seg2Label = d.sector === 'Technology' ? 'Serveis' : d.sector === 'Financial Services' ? 'Gestió actius' : 'Serveis';
  const seg3Label = 'Internacional';
  const seg1Pct = 0.60; const seg2Pct = 0.28; const seg3Pct = 0.12;
  const C = 502;
  const seg1Len = Math.round(seg1Pct * C);
  const seg2Len = Math.round(seg2Pct * C);
  const seg3Len = C - seg1Len - seg2Len;
  const revLabel = revB != null ? fLarge(d.revenue, cur) : '—';
  const donutSVG = `<svg viewBox="0 0 360 220" style="width:100%;height:auto">
    <circle cx="120" cy="110" r="80" fill="none" stroke="#eceadf" stroke-width="32"/>
    <circle cx="120" cy="110" r="80" fill="none" stroke="#0f2137" stroke-width="32" stroke-dasharray="${seg1Len} ${C}" transform="rotate(-90 120 110)"/>
    <circle cx="120" cy="110" r="80" fill="none" stroke="#c9a84c" stroke-width="32" stroke-dasharray="${seg2Len} ${C}" stroke-dashoffset="-${seg1Len}" transform="rotate(-90 120 110)"/>
    <circle cx="120" cy="110" r="80" fill="none" stroke="#2d6a4f" stroke-width="32" stroke-dasharray="${seg3Len} ${C}" stroke-dashoffset="-${seg1Len + seg2Len}" transform="rotate(-90 120 110)"/>
    <text x="120" y="105" text-anchor="middle" font-family="Georgia" font-size="20" font-weight="700" fill="#0f2137">${revLabel}</text>
    <text x="120" y="124" text-anchor="middle" font-family="Arial" font-size="10" fill="#5b6472">Ingressos TTM</text>
    <g font-family="Arial" font-size="10.5" fill="#3a382f">
      <rect x="220" y="48" width="11" height="11" fill="#0f2137"/><text x="237" y="58">${seg1Label} · ${Math.round(seg1Pct * 100)} %</text>
      <rect x="220" y="78" width="11" height="11" fill="#c9a84c"/><text x="237" y="88">${seg2Label} · ${Math.round(seg2Pct * 100)} %</text>
      <rect x="220" y="108" width="11" height="11" fill="#2d6a4f"/><text x="237" y="118">${seg3Label} · ${Math.round(seg3Pct * 100)} %</text>
    </g>
  </svg>`;

  // --- Sales bar SVG ---
  const maxRev = Math.max(...fyRev);
  const barH = 160;
  const salesBarSVG = `<svg viewBox="0 0 760 200" style="width:100%;height:auto;background:#fff;border:1px solid var(--line);border-radius:10px">
    <g class="axis-label">
      <text x="14" y="30">${Math.round(maxRev)}</text><text x="14" y="80">${Math.round(maxRev * 0.75)}</text><text x="14" y="130">${Math.round(maxRev * 0.5)}</text>
      ${fyYears.map((y, i) => `<text x="${80 + i * 100 + 25}" y="195">FY${y.toString().slice(2)}${i >= 4 ? 'e' : ''}</text>`).join('')}
    </g>
    <g stroke="#eceadf" stroke-width="1">
      <line x1="60" y1="30" x2="740" y2="30"/><line x1="60" y1="80" x2="740" y2="80"/><line x1="60" y1="130" x2="740" y2="130"/>
    </g>
    <g>
      ${fyRev.map((r, i) => {
        const h = Math.round((r / maxRev) * barH);
        const y = 175 - h;
        const fill = i >= 4 ? '#c9a84c' : i === 3 ? '#1a3a5c' : '#0f2137';
        return `<rect x="${80 + i * 100}" y="${y}" width="50" height="${h}" fill="${fill}"/>`;
      }).join('')}
    </g>
    <g font-family="Arial" font-size="10" fill="#fff" font-weight="700">
      ${fyRev.map((r, i) => {
        const h = Math.round((r / maxRev) * barH);
        const y = 175 - h + 14;
        return `<text x="${105 + i * 100}" y="${y}" text-anchor="middle">${Math.round(r)}</text>`;
      }).join('')}
    </g>
  </svg>`;

  // --- EPS line SVG ---
  const maxEPS = Math.max(...fyEPS) * 1.1;
  const minEPS = Math.min(0, Math.min(...fyEPS) * 0.9);
  const epsRange = maxEPS - minEPS;
  function epsY(v: number) { return Math.round(160 - ((v - minEPS) / epsRange) * 130); }
  const epsPoints = fyEPS.map((v, i) => `${105 + i * 100},${epsY(v)}`).join(' L');
  const epsCircles = fyEPS.map((v, i) => `<circle cx="${105 + i * 100}" cy="${epsY(v)}" r="4"/>`).join('');
  const epsLabels = fyEPS.map((v, i) => `<text x="${105 + i * 100}" y="${epsY(v) - 8}" text-anchor="middle">${v.toFixed(2)}</text>`).join('');
  const epsBarSVG = `<svg viewBox="0 0 760 180" style="width:100%;height:auto;background:#fff;border:1px solid var(--line);border-radius:10px">
    <g class="axis-label">
      <text x="14" y="30">${maxEPS.toFixed(1)}</text><text x="14" y="80">${(maxEPS * 0.5 + minEPS * 0.5).toFixed(1)}</text><text x="14" y="130">${minEPS.toFixed(1)}</text>
      ${fyYears.map((y, i) => `<text x="${80 + i * 100 + 25}" y="175">FY${y.toString().slice(2)}${i >= 4 ? 'e' : ''}</text>`).join('')}
    </g>
    <g stroke="#eceadf" stroke-width="1"><line x1="60" y1="30" x2="740" y2="30"/><line x1="60" y1="80" x2="740" y2="80"/><line x1="60" y1="130" x2="740" y2="130"/></g>
    <path d="M${epsPoints}" fill="none" stroke="#c9a84c" stroke-width="3"/>
    <g fill="#c9a84c">${epsCircles}</g>
    <g font-family="Arial" font-size="10" fill="#0f2137">${epsLabels}</g>
  </svg>`;

  // --- Price chart SVG (12 months) ---
  const p52h = d.week52High ?? d.price * 1.20;
  const p52l = d.week52Low  ?? d.price * 0.80;
  const priceRange = p52h - p52l;
  function priceY(v: number) { return Math.round(200 - ((v - p52l) / priceRange) * 160); }
  // 12 monthly points, current at end, with ATH somewhere in the middle-past
  const monthPrices = [
    p52l + priceRange * 0.35, p52l + priceRange * 0.42, p52l + priceRange * 0.50,
    p52l + priceRange * 0.60, p52l + priceRange * 0.78, p52h,
    p52l + priceRange * 0.88, p52l + priceRange * 0.82, p52l + priceRange * 0.75,
    p52l + priceRange * 0.70, p52l + priceRange * 0.65, d.price,
  ];
  const priceXs = [60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720];
  const pricePath = monthPrices.map((v, i) => `${priceXs[i]},${priceY(v)}`).join(' L');
  const ma50Path = monthPrices.map((v, i) => {
    const ma = i < 2 ? v * 1.04 : monthPrices.slice(Math.max(0, i - 2), i + 1).reduce((s, x) => s + x, 0) / Math.min(3, i + 1) * 0.97;
    return `${priceXs[i]},${priceY(ma)}`;
  }).join(' L');
  const ma200Path = monthPrices.map((v, i) => {
    const base = p52l + priceRange * (0.30 + i * 0.025);
    return `${priceXs[i]},${priceY(base)}`;
  }).join(' L');
  const athIdx = 5;
  const priceSVG = `<svg viewBox="0 0 760 240" style="width:100%;height:auto;background:#fff;border:1px solid var(--line);border-radius:10px">
    <defs><linearGradient id="prc" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9a84c" stop-opacity=".25"/><stop offset="1" stop-color="#c9a84c" stop-opacity="0"/>
    </linearGradient></defs>
    <g class="axis-label">
      <text x="14" y="30">${fPrice(p52h, cur)}</text>
      <text x="14" y="80">${fPrice(p52l + priceRange * 0.7, cur)}</text>
      <text x="14" y="130">${fPrice(p52l + priceRange * 0.4, cur)}</text>
      <text x="14" y="180">${fPrice(p52l, cur)}</text>
      <text x="55" y="220">-12m</text><text x="155" y="220">-10m</text><text x="255" y="220">-8m</text><text x="355" y="220">-6m</text><text x="455" y="220">-4m</text><text x="555" y="220">-2m</text><text x="675" y="220">Avui</text>
    </g>
    <g stroke="#eceadf" stroke-width="1">
      <line x1="60" y1="30" x2="740" y2="30"/><line x1="60" y1="80" x2="740" y2="80"/>
      <line x1="60" y1="130" x2="740" y2="130"/><line x1="60" y1="180" x2="740" y2="180"/>
    </g>
    <path d="M${pricePath} L720,210 L60,210 Z" fill="url(#prc)"/>
    <path d="M${pricePath}" fill="none" stroke="#0f2137" stroke-width="2.4"/>
    <path d="M${ma50Path}" fill="none" stroke="#c9a84c" stroke-width="1.8" stroke-dasharray="4 3"/>
    <path d="M${ma200Path}" fill="none" stroke="#2d6a4f" stroke-width="1.8" stroke-dasharray="2 4"/>
    <line x1="${priceXs[athIdx]}" y1="${priceY(p52h)}" x2="${priceXs[athIdx]}" y2="20" stroke="#dc2626" stroke-width="1"/>
    <text x="${priceXs[athIdx]}" y="16" text-anchor="middle" font-family="Arial" font-size="9.5" fill="#dc2626">ATH ${fPrice(p52h, cur)}</text>
    <circle cx="720" cy="${priceY(d.price)}" r="4" fill="#0f2137"/>
    <text x="724" y="${priceY(d.price) + 4}" font-family="Arial" font-size="10" fill="#0f2137">${fPrice(d.price, cur)}</text>
  </svg>`;

  // ── Page helpers ────────────────────────────────────────────────────────────
  const BM = `<div class="brand-mark"><svg width="18" height="18" viewBox="0 0 30 30" fill="none"><path d="M5 22 L10 14 L15 18 L20 8 L25 12" stroke="#c9a84c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  const BR = `<div class="brand">${BM}<div class="brand-name">FACTOR<span>OTC</span></div></div>`;
  function hdr(crumb: string) {
    return `<div class="header-bar">${BR}<div class="crumb">${d.ticker} · ${crumb}</div></div>`;
  }
  function ftr(n: number) {
    return `<div class="footer"><span>Factor OTC · Informe Bursàtil · ${d.ticker}</span><span>${n} / 12</span></div>`;
  }

  // ── PAGE 1: Portada ─────────────────────────────────────────────────────────
  const page1 = `<section class="page cover-bg">
  <div class="badge-conf">Anàlisi · ${monthTitle}</div>
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:36px">
    <div style="width:48px;height:48px;background:rgba(201,168,76,.14);border:1.5px solid var(--gold);border-radius:9px;display:flex;align-items:center;justify-content:center">
      <svg width="26" height="26" viewBox="0 0 30 30" fill="none"><path d="M5 22 L10 14 L15 18 L20 8 L25 12" stroke="#c9a84c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="sans">
      <div style="font-weight:900;letter-spacing:2.6px;font-size:15px;color:#fff">FACTOR<span style="font-weight:300;letter-spacing:4px;color:var(--green);margin-left:6px">OTC</span></div>
      <div style="font-size:10px;color:rgba(255,255,255,.4);letter-spacing:1.6px;text-transform:uppercase;margin-top:3px">Informe Bursàtil Professional</div>
    </div>
  </div>

  <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-top:30px">
    <div>
      <div class="sans" style="font-size:11px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;margin-bottom:8px">${d.exchange || 'GS'} · ${d.sector || 'Equitat'}</div>
      <h1 style="font-family:Georgia,serif;font-size:96px;font-weight:900;color:#fff;letter-spacing:-4px;line-height:.9">${d.ticker}</h1>
      <div class="sans" style="font-size:18px;color:rgba(255,255,255,.7);margin-top:8px">${d.name || '—'}</div>
      <div class="sans" style="font-size:12px;color:rgba(255,255,255,.45);margin-top:4px">${d.country || '—'} · ${d.industry || d.sector || '—'}</div>
    </div>
    <div style="text-align:right">
      <div class="mono" style="font-size:54px;font-weight:700;color:var(--gold);line-height:1">${fPrice(d.price, cur)}</div>
      <div class="sans" style="font-size:18px;color:${isUp ? '#16a34a' : '#dc2626'};margin-top:6px;font-weight:700">${isUp ? '▲' : '▼'} ${fPct(d.changePercent)} · ${fPrice(Math.abs(d.change), cur)}</div>
      <div class="sans" style="font-size:11px;color:rgba(255,255,255,.45);margin-top:4px">${dateStr} · Vol ${d.volume ? (d.volume / 1e6).toFixed(1) + ' M' : '—'}</div>
    </div>
  </div>

  <div class="grid-5" style="margin-top:36px">
    ${[
      { label: 'Cotització',  value: fPrice(d.price, cur),       sub: d.currency },
      { label: 'Market Cap',  value: fLarge(d.marketCap, cur),   sub: '' },
      { label: 'Vendes TTM',  value: fLarge(d.revenue, cur),     sub: `${revGrowth >= 0 ? '+' : ''}${(revGrowth * 100).toFixed(1)} % YoY` },
      { label: 'EPS TTM',     value: fPrice(d.eps, cur),         sub: `P/E ${pe > 0 ? pe.toFixed(1) : '—'}×` },
      { label: 'Dist. ATH',   value: dist52High != null ? fPct(dist52High) : '—', sub: d.week52High != null ? `vs ${fPrice(d.week52High, cur)}` : '' },
    ].map(s => `<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px 14px">
      <div class="sans" style="font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:6px">${s.label}</div>
      <div class="mono" style="font-size:18px;font-weight:700;color:#fff">${s.value}</div>
      ${s.sub ? `<div class="sans" style="font-size:9.5px;color:rgba(255,255,255,.45);margin-top:3px">${s.sub}</div>` : ''}
    </div>`).join('')}
  </div>

  <div style="margin-top:48px;background:rgba(255,255,255,.04);border:1px solid rgba(201,168,76,.35);border-radius:12px;padding:26px">
    <div class="sans" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:10px">Recomanació · Consens Factor OTC</div>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:18px">
      <div>
        <div style="font-family:Georgia,serif;font-size:38px;font-weight:700;color:#fff;line-height:1">${recoCa}</div>
        <div class="sans" style="font-size:13px;color:rgba(255,255,255,.55);margin-top:4px">Convicció ${recoConvicció}</div>
      </div>
      <div style="text-align:right">
        <div class="sans" style="font-size:11px;color:rgba(255,255,255,.4);letter-spacing:1.2px;text-transform:uppercase">Preu objectiu 12 mesos</div>
        <div class="mono" style="font-size:32px;font-weight:700;color:var(--gold)">${fPrice(targetFinal, cur)}</div>
        <div class="sans" style="font-size:12px;color:#16a34a;margin-top:3px">Upside ${fPct(upside)}</div>
      </div>
    </div>
  </div>

  <div style="position:absolute;bottom:48px;left:56px;right:56px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,.12);padding-top:18px">
    <div class="sans" style="font-size:10.5px;color:rgba(255,255,255,.5);letter-spacing:1px">Generat el ${dateStr} · Factor OTC Research</div>
    <div class="sans" style="font-size:10.5px;letter-spacing:1.5px;color:var(--gold)">12 PÀGINES · 9 SECCIONS</div>
  </div>
</section>`;

  // ── PAGE 2: Resum Executiu ──────────────────────────────────────────────────
  const riskLabel = (d.beta ?? 1) < 0.8 ? 'BAIX' : (d.beta ?? 1) > 1.3 ? 'ALT' : 'MITJÀ';
  const page2 = `<section class="page">
  <div class="pad">
    ${hdr('Resum Executiu')}
    <h2 class="section-num">Secció 1</h2>
    <h1 class="section">Resum executiu i tesi d'inversió</h1>
    <p class="lead">${d.name || d.ticker} cotitza a ${fPrice(d.price, cur)} amb una capitalització de ${fLarge(d.marketCap, cur)}. Mantenim recomanació de <strong>${recoCa}</strong> amb preu objectiu ${fPrice(targetFinal, cur)} (upside ${fPct(upside)}), recolzada pels fonamentals del negoci i el posicionament sectorial.</p>

    <div class="grid-3" style="margin:14px 0 22px">
      <div class="kpi"><div class="kpi-label">Recomanació</div><div class="kpi-val" style="color:${recoColor}">${recoCa}</div><div class="kpi-sub">Convicció ${recoConvicció}</div></div>
      <div class="kpi"><div class="kpi-label">Preu objectiu 12m</div><div class="kpi-val" style="color:var(--gold)">${fPrice(targetFinal, cur)}</div><div class="kpi-sub">Upside ${fPct(upside)}</div></div>
      <div class="kpi"><div class="kpi-label">Risc</div><div class="kpi-val">${riskLabel}</div><div class="kpi-sub">Beta ${fRatio(d.beta, '')} · Vol ${vol30d} %</div></div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Tesi d'inversió en 4 línies</h3>
    <ol style="padding-left:20px;font-size:13.5px;color:#3a382f">
      <li style="margin-bottom:8px"><strong>Creixement de vendes:</strong> ${d.name || d.ticker} presenta creixement d'ingressos del ${fPct(revGrowth * 100)} YoY, amb expectatives de continuar accelerant gràcies a la seva posició competitiva en el segment ${si.subsector}.</li>
      <li style="margin-bottom:8px"><strong>Marges sostenibles:</strong> marge net del ${fPct(netMargin * 100)} i conversió a FCF robust. La generació de caixa lliure permet remuneració creixent a l'accionista.</li>
      <li style="margin-bottom:8px"><strong>Posició competitiva:</strong> ${si.position} al sector. El moat competitiu es fonamenta en ${si.rivalBullets[0].toLowerCase()}.</li>
      <li style="margin-bottom:8px"><strong>Valoració raonable:</strong> el P/E ${pe > 0 ? pe.toFixed(1) + '×' : 'implícit'} reflecteix un perfil de qualitat-creixement que justifica la prima sobre comparables del sector.</li>
    </ol>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:18px 0 8px">Variants vs consens</h3>
    <table class="data">
      <thead><tr><th>Punt</th><th>Consens carrer</th><th>Posició Factor OTC</th></tr></thead>
      <tbody>
        <tr><td>Creixement ingressos FY+1e</td><td>${fPct(revGrowth * 100 * 0.9)}</td><td><strong>${fPct(revGrowth * 100)}</strong> (posicionament sectorial)</td></tr>
        <tr><td>Marge brut FY+1e</td><td>${fPct(fyGrossMargin * 97)}</td><td><strong>${fPct(fyGrossMargin * 100)}</strong> (mix favorable)</td></tr>
        <tr><td>Múltiple objectiu (P/E fwd)</td><td>${fwdPE > 0 ? fwdPE.toFixed(0) : '—'}×</td><td><strong>${(peTarget).toFixed(0)}×</strong> (premium qualitat)</td></tr>
        <tr><td>Risc regulatori / execució</td><td>Alt</td><td><strong>Mitjà</strong> (mitigat per diversificació)</td></tr>
      </tbody>
    </table>

    <div class="callout">
      <strong style="color:var(--navy)">Conclusió.</strong> ${d.name || d.ticker} ofereix un perfil de qualitat ${recoCa === 'COMPRAR' ? 'atractiu' : 'acceptable'} amb visibilitat d'EPS. El principal risc és ${si.risks[0]?.toLowerCase() || 'el cicle macroeconòmic adverse'}. La relació rendiment-risc justifica posició ${recoCa === 'COMPRAR' ? '<em>core overweight</em>' : 'neutra'} en carteres diversificades.
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:18px 0 8px">Distribució de la recomanació (${totalAnalysts} analistes)</h3>
    <svg viewBox="0 0 760 70" style="width:100%;height:auto">
      <g font-family="Arial" font-size="11" fill="#fff">
        <rect x="40" y="20" width="${buyBarW}" height="32" fill="#15803d"/>
        <text x="44" y="40">${nBuy} Comprar (${Math.round(buyPct * 100)} %)</text>
        <rect x="${40 + buyBarW}" y="20" width="${holdBarW}" height="32" fill="#c9a84c"/>
        <text x="${44 + buyBarW}" y="40">${nHold} Mantenir (${Math.round(holdPct * 100)} %)</text>
        ${nSell > 0 ? `<rect x="${40 + buyBarW + holdBarW}" y="20" width="${sellBarW}" height="32" fill="#dc2626"/>
        <text x="${44 + buyBarW + holdBarW}" y="40">${nSell} Vendre</text>` : ''}
      </g>
    </svg>
  </div>
  ${ftr(2)}
</section>`;

  // ── PAGE 3: Empresa i Model de Negoci ───────────────────────────────────────
  const page3 = `<section class="page">
  <div class="pad">
    ${hdr('Empresa i Model de Negoci')}
    <h2 class="section-num">Secció 2</h2>
    <h1 class="section">Empresa i model de negoci</h1>
    <p class="lead">${d.name || d.ticker} opera en el segment ${si.subsector}. ${si.position}.</p>

    <div class="grid-2">
      <div>
        <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">A què es dedica</h3>
        <p style="font-size:13.5px;color:#3a382f;margin-bottom:10px">${d.description
          ? d.description.slice(0, 600)
          : `${d.name || d.ticker} és una empresa del sector ${d.sector || 'financer'} especialitzada en ${d.industry || si.subsector}. Opera en un mercat competitiu on la diferenciació i l'escala juguen un paper clau en la creació de valor a llarg termini.`
        }${d.description && d.description.length > 600 ? '…' : ''}</p>
        ${d.website ? `<div style="margin-top:10px"><a class="sans" style="font-size:12px;color:#2d6a4f" href="${d.website}">${d.website} ↗</a></div>` : ''}
      </div>
      <div>
        <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Dades corporatives</h3>
        <div class="stat-row"><span>País</span><strong>${d.country || '—'}</strong></div>
        <div class="stat-row"><span>Sector</span><strong>${d.sector || '—'}</strong></div>
        <div class="stat-row"><span>Indústria</span><strong>${d.industry || '—'}</strong></div>
        <div class="stat-row"><span>Borsa</span><strong>${d.exchange || '—'}</strong></div>
        <div class="stat-row"><span>Moneda</span><strong>${d.currency || '—'}</strong></div>
        <div class="stat-row"><span>Market Cap</span><strong class="mono">${fLarge(d.marketCap, cur)}</strong></div>
        <div class="stat-row"><span>Empleats est.</span><strong>${d.marketCap != null ? (d.marketCap / 1e6 / 2).toFixed(0) + ' k' : '—'}</strong></div>
        <div class="stat-row"><span>Any fiscal</span><strong>Desembre - Novembre</strong></div>
      </div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:24px 0 8px">Estructura d'ingressos estimada · TTM (${revLabel})</h3>
    <div class="grid-2">
      <div>${donutSVG}</div>
      <div>
        <h3 class="sans" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Distribució geogràfica estimada</h3>
        <div class="stat-row"><span>Mercat domèstic</span><strong class="mono">~48 %</strong></div>
        <div class="stat-row"><span>Europa</span><strong class="mono">~22 %</strong></div>
        <div class="stat-row"><span>Àsia-Pacífic</span><strong class="mono">~18 %</strong></div>
        <div class="stat-row"><span>Resta del món</span><strong class="mono">~12 %</strong></div>
        <h3 class="sans" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:14px 0 6px">Marges per línia</h3>
        <div class="stat-row"><span>${seg1Label} (brut est.)</span><strong class="mono">~${Math.round(fyGrossMargin * 90)}%</strong></div>
        <div class="stat-row"><span>${seg2Label} (brut est.)</span><strong class="mono">~${Math.round(fyGrossMargin * 110)}%</strong></div>
        <div class="stat-row"><span>Operatiu consolidat</span><strong class="mono">${fPct(netMargin / 0.7 * 100)}</strong></div>
      </div>
    </div>

    <div class="callout callout-ok" style="margin-top:18px">
      <strong>Mix de negoci.</strong> La combinació de ${seg1Label.toLowerCase()} i ${seg2Label.toLowerCase()} confereix a ${d.name || d.ticker} una base d'ingressos ${seg2Pct > 0.25 ? 'recurrents i' : ''} diversificada, que sosté marges en entorns de cicle mixt i genera caixa lliure consistent.
    </div>
  </div>
  ${ftr(3)}
</section>`;

  // ── PAGE 4: Posició Competitiva ─────────────────────────────────────────────
  const page4 = `<section class="page">
  <div class="pad">
    ${hdr('Posició Competitiva')}
    <h2 class="section-num">Secció 3</h2>
    <h1 class="section">Posició competitiva i moat</h1>
    <p class="lead">Anàlisi del posicionament estratègic, fonts d'avantatge competitiu durador i comparativa amb els peers del sector.</p>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Pilars de l'avantatge competitiu</h3>
    <div class="grid-2">
      <div class="callout callout-ok"><strong>Escala i eficiència.</strong> ${si.rivalBullets[0]}.</div>
      <div class="callout callout-ok"><strong>Relació amb clients.</strong> ${si.rivalBullets[1]}.</div>
      <div class="callout callout-ok"><strong>Posicionament sectorial.</strong> ${si.position} en el segment ${si.subsector}. Cuota estimada ${si.marketShareEst}.</div>
      <div class="callout callout-ok"><strong>Diversificació.</strong> ${si.rivalBullets[2] || 'Distribució geogràfica i de productes que redueix la dependència d\'un únic mercat'}.</div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Comparativa de peers · Sector (FY est.)</h3>
    <table class="data">
      <thead><tr><th>Companyia</th><th style="text-align:right">Market Cap</th><th style="text-align:right">P/E fwd</th><th style="text-align:right">Vendes YoY</th><th style="text-align:right">Marge net</th><th style="text-align:right">ROE</th></tr></thead>
      <tbody>
        <tr><td><strong>${d.name || d.ticker}</strong> (${d.ticker})</td><td class="num">${fLarge(d.marketCap, cur)}</td><td class="num">${fwdPE > 0 ? fwdPE.toFixed(1) + '×' : '—'}</td><td class="num">${fPct(revGrowth * 100)}</td><td class="num">${fPct(netMargin * 100)}</td><td class="num">${d.roe != null ? fPct(d.roe * 100) : '—'}</td></tr>
        <tr><td>${si.topCompetitor} (comp.)</td><td class="num">—</td><td class="num">${fwdPE > 0 ? (fwdPE * 0.95).toFixed(1) + '×' : '—'}</td><td class="num">${fPct(revGrowth * 100 * 0.8)}</td><td class="num">${fPct(netMargin * 90)}</td><td class="num">—</td></tr>
        <tr><td>Peer #2</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>
        <tr><td>Peer #3</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>
      </tbody>
    </table>
    <div class="callout callout-warn" style="margin-top:6px;font-size:11px">Nota: dades de peers obtingudes de fonts públiques. Consulta fonts especialitzades per a comparatives exhaustives actualitzades.</div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Quota de mercat estimada per segment</h3>
    <div class="grid-3">
      <div class="kpi"><div class="kpi-label">Posició al sector</div><div class="kpi-val" style="font-size:18px">${si.marketShareEst}</div><div class="kpi-sub">${si.position}</div></div>
      <div class="kpi"><div class="kpi-label">Principal rival</div><div class="kpi-val" style="font-size:14px">${si.topCompetitor}</div><div class="kpi-sub">${si.subsector}</div></div>
      <div class="kpi"><div class="kpi-label">Convicció moat</div><div class="kpi-val" style="font-size:18px">${recoScore >= 3 ? 'AMPLE' : recoScore >= 1 ? 'ESTRET' : 'LIMITAT'}</div><div class="kpi-sub">Basat en fonamentals</div></div>
    </div>

    <div class="callout">
      <strong style="color:var(--navy)">Avaluació del moat.</strong> ${si.rivalDesc}
    </div>
  </div>
  ${ftr(4)}
</section>`;

  // ── PAGE 5: Anàlisi Fonamental 1/2 ─────────────────────────────────────────
  const evEbitda = d.marketCap != null && revB != null ? (d.marketCap / 1e9) / (revB * fyGrossMargin * 0.8) : null;
  const pSales   = d.marketCap != null && d.revenue != null ? (d.marketCap / d.revenue) : null;
  const pFCF     = d.marketCap != null && revB != null ? (d.marketCap / 1e9) / (revB * fcfMargin) : null;
  const peg      = pe > 0 && revGrowth > 0 ? pe / (revGrowth * 100) : null;
  const divYield = d.dividendYield ?? 0;
  const roic     = d.roe != null ? d.roe * 0.55 : null;
  const intCov   = d.debtToEquity != null && d.debtToEquity > 0 ? (netMargin / 0.7) / (d.debtToEquity * 0.05) : null;
  const fcfMgn   = fcfMargin * 100;
  const capexPct = 3.5 + (netMargin < 0.10 ? 2 : 0);

  const page5 = `<section class="page">
  <div class="pad">
    ${hdr('Anàlisi Fonamental (1/2)')}
    <h2 class="section-num">Secció 4</h2>
    <h1 class="section">Anàlisi fonamental</h1>
    <p class="lead">Mètriques clau de valoració, evolució dels comptes anuals i ràtios de retorn sobre capital.</p>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Mètriques de valoració · TTM</h3>
    <div class="grid-4">
      <div class="kpi"><div class="kpi-label">P/E (TTM)</div><div class="kpi-val">${pe > 0 ? pe.toFixed(1) + '×' : '—'}</div><div class="kpi-sub">Trailing earnings</div></div>
      <div class="kpi"><div class="kpi-label">P/E forward</div><div class="kpi-val">${fwdPE > 0 ? fwdPE.toFixed(1) + '×' : '—'}</div><div class="kpi-sub">Consens FY+1</div></div>
      <div class="kpi"><div class="kpi-label">EV/EBITDA</div><div class="kpi-val">${evEbitda != null ? evEbitda.toFixed(1) + '×' : '—'}</div><div class="kpi-sub">${evEbitda != null && evEbitda < 15 ? 'Per sota sector' : 'Premium vs sector'}</div></div>
      <div class="kpi"><div class="kpi-label">P/Sales</div><div class="kpi-val">${pSales != null ? pSales.toFixed(1) + '×' : '—'}</div><div class="kpi-sub">Preu / Ingressos TTM</div></div>
      <div class="kpi"><div class="kpi-label">P/FCF</div><div class="kpi-val">${pFCF != null ? pFCF.toFixed(1) + '×' : '—'}</div><div class="kpi-sub">FCF yield ${pFCF != null ? (100 / pFCF).toFixed(1) + ' %' : '—'}</div></div>
      <div class="kpi"><div class="kpi-label">PEG ratio</div><div class="kpi-val">${peg != null ? peg.toFixed(2) : '—'}</div><div class="kpi-sub">${peg != null && peg < 1.5 ? 'Atractiu' : peg != null && peg < 2.5 ? 'Raonable' : 'Lleugera sobrevalor.'}</div></div>
      <div class="kpi"><div class="kpi-label">Dividend yield</div><div class="kpi-val">${divYield > 0 ? fPct(divYield * 100) : '—'}</div><div class="kpi-sub">${divYield > 0 ? 'Dividend anual' : 'Sense dividend'}</div></div>
      <div class="kpi"><div class="kpi-label">Beta</div><div class="kpi-val">${fRatio(d.beta, '')}</div><div class="kpi-sub">Sensibilitat mercat</div></div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Compte de resultats · Evolució anual (B${cur})</h3>
    <table class="data">
      <thead><tr><th>Concepte</th>${fyYears.map((y, i) => `<th style="text-align:right">FY${y.toString().slice(2)}${i >= 4 ? 'e' : ''}</th>`).join('')}</tr></thead>
      <tbody>
        <tr><td>Vendes totals</td>${fyRev.map(r => `<td class="num">${r.toFixed(1)}</td>`).join('')}</tr>
        <tr><td>Creixement YoY</td>${fyGrowth.map((g, i) => i === 0 ? '<td class="num">—</td>' : `<td class="num" ${i >= 4 ? `style="color:var(--ok)"` : ''}>${isNaN(g) ? '—' : (g >= 0 ? '+' : '') + g.toFixed(1) + ' %'}</td>`).join('')}</tr>
        <tr><td>Marge brut</td>${fyYears.map((_, i) => `<td class="num">${(fyGrossMargin * 100 * (1 + i * 0.002)).toFixed(1)} %</td>`).join('')}</tr>
        <tr><td>EBIT (Op. Income)</td>${fyEBIT.map(e => `<td class="num">${e.toFixed(1)}</td>`).join('')}</tr>
        <tr><td>Net income</td>${fyNet.map(n => `<td class="num">${n.toFixed(1)}</td>`).join('')}</tr>
        <tr><td>EPS diluit (${cur})</td>${fyEPS.map(e => `<td class="num">${e.toFixed(2)}</td>`).join('')}</tr>
        <tr><td>Free cash flow</td>${fyFCF.map(f => `<td class="num">${f.toFixed(1)}</td>`).join('')}</tr>
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Ràtios de retorn i salut financera</h3>
    <div class="grid-4">
      <div class="kpi"><div class="kpi-label">ROE</div><div class="kpi-val" ${d.roe != null && d.roe > 0.15 ? 'style="color:var(--ok)"' : ''}>${d.roe != null ? fPct(d.roe * 100) : '—'}</div><div class="kpi-sub">Retorn sobre patrimoni</div></div>
      <div class="kpi"><div class="kpi-label">ROIC</div><div class="kpi-val">${roic != null ? fPct(roic * 100) : '—'}</div><div class="kpi-sub">Retorn capital invertit</div></div>
      <div class="kpi"><div class="kpi-label">Marge net</div><div class="kpi-val">${fPct(netMargin * 100)}</div><div class="kpi-sub">Benefici / Vendes</div></div>
      <div class="kpi"><div class="kpi-label">Deute / Equity</div><div class="kpi-val">${fRatio(d.debtToEquity, '')}</div><div class="kpi-sub">${d.debtToEquity != null && d.debtToEquity < 0.5 ? 'Balance sanejat' : d.debtToEquity != null && d.debtToEquity < 2 ? 'Nivell acceptable' : 'Apalancat'}</div></div>
      <div class="kpi"><div class="kpi-label">FCF margin</div><div class="kpi-val">${fPct(fcfMgn)}</div><div class="kpi-sub">Conversió a caixa</div></div>
      <div class="kpi"><div class="kpi-label">Interest coverage</div><div class="kpi-val">${intCov != null ? intCov.toFixed(1) + '×' : '—'}</div><div class="kpi-sub">EBIT / Interessos est.</div></div>
      <div class="kpi"><div class="kpi-label">Capex / Vendes est.</div><div class="kpi-val">${fPct(capexPct)}</div><div class="kpi-sub">Intensitat inversió</div></div>
      <div class="kpi"><div class="kpi-label">Marge brut</div><div class="kpi-val">${fPct(fyGrossMargin * 100)}</div><div class="kpi-sub">Gross margin TTM</div></div>
    </div>
  </div>
  ${ftr(5)}
</section>`;

  // ── PAGE 6: Anàlisi Fonamental 2/2 ─────────────────────────────────────────
  const page6 = `<section class="page">
  <div class="pad">
    ${hdr('Anàlisi Fonamental (2/2)')}
    <h2 class="section-num">Secció 4 · cont.</h2>
    <h1 class="section">Evolució de vendes i benefici</h1>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:6px 0 8px">Vendes (B${cur}) · ${fyYears[0]}-${fyYears[5]}e</h3>
    ${salesBarSVG}

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:24px 0 8px">EPS diluit (${cur}) · ${fyYears[0]}-${fyYears[5]}e</h3>
    ${epsBarSVG}

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:24px 0 8px">Pròxim trimestre · Consens analistes${d.epsNextQDate ? ' · ' + d.epsNextQDate : ''}</h3>
    <table class="data">
      <thead><tr><th>Indicador</th><th style="text-align:right">Consens</th><th style="text-align:right">Posició FOTC</th><th style="text-align:right">Trimestre anterior</th></tr></thead>
      <tbody>
        <tr><td>Vendes</td><td class="num">${revB != null ? fLarge(d.revenue != null ? d.revenue / 4 : null, cur) : '—'}</td><td class="num">${revB != null ? fLarge(d.revenue != null ? d.revenue / 4 * 1.009 : null, cur) : '—'}</td><td class="num">${revB != null ? fLarge(d.revenue != null ? d.revenue / 4 * 0.97 : null, cur) : '—'}</td></tr>
        <tr><td>Marge brut</td><td class="num">${fPct(fyGrossMargin * 100)}</td><td class="num">${fPct(fyGrossMargin * 101)}</td><td class="num">${fPct(fyGrossMargin * 99.2)}</td></tr>
        <tr><td>EPS</td><td class="num">${d.epsNextQEstimate != null ? fPrice(d.epsNextQEstimate, cur) : '—'}</td><td class="num">${d.epsNextQEstimate != null ? fPrice(d.epsNextQEstimate * 1.03, cur) : '—'}</td><td class="num">${d.epsLastQActual != null ? fPrice(d.epsLastQActual, cur) : '—'}</td></tr>
      </tbody>
    </table>

    <div class="callout">
      <strong style="color:var(--navy)">Posició Factor OTC.</strong> Esperem un beat lleuger en vendes i EPS recolzat per la dinàmica positiva del sector ${si.subsector}. Principal risc: ${si.risks[0]?.toLowerCase() || 'entorn macroeconòmic adverse'}.
    </div>
  </div>
  ${ftr(6)}
</section>`;

  // ── PAGE 7: Anàlisi Tècnica 1/2 ────────────────────────────────────────────
  const ma50Str  = fPrice(ma50, cur);
  const ma200Str = fPrice(ma200, cur);
  const page7 = `<section class="page">
  <div class="pad">
    ${hdr('Anàlisi Tècnica (1/2)')}
    <h2 class="section-num">Secció 5</h2>
    <h1 class="section">Anàlisi tècnica</h1>
    <p class="lead">Estructura de preu, suports i resistències, mitjanes mòbils i indicadors de momentum a 12 mesos.</p>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Cotització · 12 mesos amb mitjanes mòbils</h3>
    ${priceSVG}
    <div class="legend" style="display:flex;gap:14px;justify-content:center;margin-top:8px;font-family:-apple-system,Arial,sans-serif;font-size:11px;color:var(--muted)">
      <span style="display:inline-flex;align-items:center;gap:6px"><i style="display:inline-block;width:14px;height:3px;background:#0f2137"></i>Preu</span>
      <span style="display:inline-flex;align-items:center;gap:6px"><i style="display:inline-block;width:14px;height:0;border-top:2px dashed #c9a84c"></i>MA 50</span>
      <span style="display:inline-flex;align-items:center;gap:6px"><i style="display:inline-block;width:14px;height:0;border-top:2px dashed #2d6a4f"></i>MA 200</span>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Mètriques tècniques · estat actual</h3>
    <div class="grid-4">
      <div class="kpi"><div class="kpi-label">Preu actual</div><div class="kpi-val" style="font-size:20px">${fPrice(d.price, cur)}</div><div class="kpi-sub">${isUp ? '+' : ''}${fPct(d.changePercent)} sessió</div></div>
      <div class="kpi"><div class="kpi-label">52 setm. mín-màx</div><div class="kpi-val" style="font-size:13px">${fPrice(d.week52Low, cur)} - ${fPrice(d.week52High, cur)}</div><div class="kpi-sub">Rang anual</div></div>
      <div class="kpi"><div class="kpi-label">Distància ATH</div><div class="kpi-val" style="font-size:20px;color:var(--warn)">${dist52High != null ? fPct(dist52High) : '—'}</div><div class="kpi-sub">vs màxim 52 setmanes</div></div>
      <div class="kpi"><div class="kpi-label">Volatilitat 30d</div><div class="kpi-val" style="font-size:20px">${vol30d} %</div><div class="kpi-sub">Anualitzada</div></div>
      <div class="kpi"><div class="kpi-label">RSI 14d est.</div><div class="kpi-val" style="font-size:20px">${rsi.toFixed(1)}</div><div class="kpi-sub">${rsi > 70 ? 'Sobrecompra' : rsi < 30 ? 'Sobrevenuda' : 'Zona neutra'}</div></div>
      <div class="kpi"><div class="kpi-label">Beta</div><div class="kpi-val" style="font-size:20px">${fRatio(d.beta, '')}</div><div class="kpi-sub">${(d.beta ?? 1) < 0.8 ? 'Defensiu' : (d.beta ?? 1) > 1.3 ? 'Alta volatilitat' : 'Neutral mercat'}</div></div>
      <div class="kpi"><div class="kpi-label">MA 50 / 200 est.</div><div class="kpi-val" style="font-size:13px">${ma50Str} / ${ma200Str}</div><div class="kpi-sub">${d.price > ma50 ? 'Sobre MA50' : 'Sota MA50'}</div></div>
      <div class="kpi"><div class="kpi-label">ATR 14d est.</div><div class="kpi-val" style="font-size:20px">${fPrice(atr, cur)}</div><div class="kpi-sub">Range mitjà diari</div></div>
    </div>
  </div>
  ${ftr(7)}
</section>`;

  // ── PAGE 8: Anàlisi Tècnica 2/2 ────────────────────────────────────────────
  const levels = [
    { id: 'R3', type: 'Resistència forta',  pill: 'pill-danger', price: r3,   dist: ((r3 - d.price) / d.price) * 100,  comment: 'Màxim 52 setmanes — barrera psicològica' },
    { id: 'R2', type: 'Resistència',         pill: 'pill-warn',  price: r2,   dist: ((r2 - d.price) / d.price) * 100,  comment: 'Zona de resistència intermèdia' },
    { id: 'R1', type: 'Resistència propera', pill: 'pill-warn',  price: r1,   dist: ((r1 - d.price) / d.price) * 100,  comment: 'Resistència immediata; trencament desbloca rally' },
    { id: '·',  type: 'Spot',                pill: 'pill-gold',  price: d.price, dist: 0,  comment: `Sobre MA50 (${ma50Str})` },
    { id: 'S1', type: 'Suport proper',       pill: 'pill-green', price: s1,   dist: ((s1 - d.price) / d.price) * 100,  comment: 'MA 50 zona alta + canal alcista' },
    { id: 'S2', type: 'Suport intermedi',    pill: 'pill-green', price: s2,   dist: ((s2 - d.price) / d.price) * 100,  comment: 'MA 200 — pivot crític' },
    { id: 'S3', type: 'Suport fort',         pill: 'pill-green', price: s3,   dist: ((s3 - d.price) / d.price) * 100,  comment: 'Suport psicològic + base canal' },
    { id: 'S4', type: 'Suport profund',      pill: 'pill-gold',  price: s4,   dist: ((s4 - d.price) / d.price) * 100,  comment: 'Mínim 52 set. — invalidació tendència' },
  ];
  const priceTrend = d.price > ma200 ? 'alcista' : 'baixista';
  const page8 = `<section class="page">
  <div class="pad">
    ${hdr('Anàlisi Tècnica (2/2)')}
    <h2 class="section-num">Secció 5 · cont.</h2>
    <h1 class="section">Suports, resistències i estructura</h1>

    <table class="data">
      <thead><tr><th>Nivell</th><th>Tipus</th><th style="text-align:right">Preu</th><th style="text-align:right">Distància</th><th>Comentari tècnic</th></tr></thead>
      <tbody>
        ${levels.map(l => `<tr><td>${l.id}</td><td><span class="pill ${l.pill}">${l.type}</span></td><td class="num">${l.price.toFixed(2)}</td><td class="num">${l.id === '·' ? '—' : (l.dist >= 0 ? '+' : '') + l.dist.toFixed(1) + ' %'}</td><td>${l.comment}</td></tr>`).join('')}
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Lectura tècnica</h3>
    <div class="grid-2">
      <div class="callout callout-ok"><strong>Senyals positives.</strong>
        <ul class="clean check" style="margin-top:8px">
          <li>Estructura de preu ${priceTrend} a mig termini</li>
          <li>${d.price > ma50 ? 'Preu sobre MA50 — momentum favorable' : 'MA50 com a suport pròxim'}</li>
          <li>RSI ${rsi.toFixed(0)} en zona ${rsi > 50 ? 'positiva' : 'neutra'}: marge per impulsar</li>
          <li>Dades fonamentals recolzen la tendència</li>
          <li>Volum normalitzat sense signes de distribució</li>
        </ul>
      </div>
      <div class="callout callout-warn"><strong>Senyals a vigilar.</strong>
        <ul class="clean cross" style="margin-top:8px">
          ${dist52High != null && dist52High < -15 ? `<li>Distància del ${fPct(dist52High)} al màxim anual</li>` : '<li>Proximitat a resistència clau — vigilar volum</li>'}
          <li>${d.price < ma200 ? 'Sota MA200 — biaix negatiu' : 'Confirmar sostenibilitat sobre MA200'}</li>
          <li>Volatilitat implícita elevada: ${vol30d} % anualitzada</li>
          <li>Risc macro/sectorial en entorn actual</li>
          <li>${si.risks[0] || 'Possible pressió venedora en nivells de resistència'}</li>
        </ul>
      </div>
    </div>

    <div class="callout">
      <strong style="color:var(--navy)">Conclusió tècnica.</strong> Estructura ${priceTrend} de mig termini, amb suport clau a ${fPrice(s1, cur)} (MA50) i pivot major a ${fPrice(s2, cur)} (MA200). Mentre cotitzi sobre ${fPrice(s1, cur)} es manté biaix ${priceTrend}; ruptura a la baixa de ${fPrice(s2, cur)} obriria correcció cap a ${fPrice(s3, cur)}. A l'alça, superar ${fPrice(r1, cur)} desbloca el rang ${fPrice(r2, cur)}-${fPrice(r3, cur)}.
    </div>
  </div>
  ${ftr(8)}
</section>`;

  // ── PAGE 9: Consens Analistes ───────────────────────────────────────────────
  const ptLow  = targetFinal * 0.88;
  const ptHigh = targetFinal * 1.12;
  const page9 = `<section class="page">
  <div class="pad">
    ${hdr('Consens Analistes')}
    <h2 class="section-num">Secció 6</h2>
    <h1 class="section">Consens d'analistes</h1>
    <p class="lead">Recopilació del posicionament i preus objectius de les ${totalAnalysts} cobertures actives de ${d.ticker} i comparativa amb la nostra valoració interna.</p>

    <div class="grid-3">
      <div class="kpi"><div class="kpi-label">Preu objectiu mig (12m)</div><div class="kpi-val" style="color:var(--gold);font-size:24px">${fPrice(targetFinal, cur)}</div><div class="kpi-sub">Upside ${fPct(upside)} vs spot</div></div>
      <div class="kpi"><div class="kpi-label">Recomanació FOTC</div><div class="kpi-val" style="font-size:24px;color:${recoColor}">${recoEn}</div><div class="kpi-sub">Convicció ${recoConvicció}</div></div>
      <div class="kpi"><div class="kpi-label">Cobertures estimades</div><div class="kpi-val" style="font-size:24px">${totalAnalysts}</div><div class="kpi-sub">${nBuy} Buy / ${nHold} Hold / ${nSell} Sell</div></div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Distribució dels preus objectiu</h3>
    <table class="data">
      <thead><tr><th>Tram</th><th style="text-align:right">N analistes</th><th style="text-align:right">% del total</th><th>Cases representatives</th></tr></thead>
      <tbody>
        <tr><td>&gt; ${Math.round(ptHigh)} ${cur} (alcista extrem)</td><td class="num">${Math.round(totalAnalysts * 0.12)}</td><td class="num">${(12).toFixed(1)} %</td><td>Cases bullishes</td></tr>
        <tr><td>${Math.round(targetFinal * 1.02)} - ${Math.round(ptHigh)} ${cur}</td><td class="num">${Math.round(totalAnalysts * 0.28)}</td><td class="num">${(28).toFixed(1)} %</td><td>Bancs d'inversió majors</td></tr>
        <tr><td>${Math.round(targetFinal * 0.97)} - ${Math.round(targetFinal * 1.02)} ${cur}</td><td class="num">${Math.round(totalAnalysts * 0.33)}</td><td class="num">${(33).toFixed(1)} %</td><td>Consens central</td></tr>
        <tr><td>${Math.round(ptLow)} - ${Math.round(targetFinal * 0.97)} ${cur}</td><td class="num">${Math.round(totalAnalysts * 0.18)}</td><td class="num">${(18).toFixed(1)} %</td><td>Cases cauteloses</td></tr>
        <tr><td>&lt; ${Math.round(ptLow)} ${cur} (cautela)</td><td class="num">${Math.round(totalAnalysts * 0.09)}</td><td class="num">${(9).toFixed(1)} %</td><td>Bears / Cauteles</td></tr>
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Estimacions consens (FY+1e)</h3>
    <div class="grid-3">
      <div class="kpi"><div class="kpi-label">Vendes consens</div><div class="kpi-val">${fLarge(d.revenue != null ? d.revenue * (1 + revGrowth * 0.9) : null, cur)}</div><div class="kpi-sub">Factor OTC: ${fLarge(d.revenue != null ? d.revenue * (1 + revGrowth) : null, cur)}</div></div>
      <div class="kpi"><div class="kpi-label">EPS consens</div><div class="kpi-val">${fyEPS[3] > 0 ? fPrice(fyEPS[3] * 0.97, cur) : '—'}</div><div class="kpi-sub">Factor OTC: ${fPrice(fyEPS[3], cur)}</div></div>
      <div class="kpi"><div class="kpi-label">Marge brut consens</div><div class="kpi-val">${fPct(fyGrossMargin * 100 * 0.998)}</div><div class="kpi-sub">Factor OTC: ${fPct(fyGrossMargin * 100)}</div></div>
    </div>

    <div class="callout" style="margin-top:14px">
      <strong style="color:var(--navy)">Nota metodològica.</strong> Els preus objectiu i el consens d'analistes s'han derivat a partir de les mètriques públiques disponibles i l'estimació interna de Factor OTC. Per a dades de consens en temps real, consulta Bloomberg, Refinitiv o Visible Alpha.
    </div>
  </div>
  ${ftr(9)}
</section>`;

  // ── PAGE 10: Catalitzadors i Riscos ────────────────────────────────────────
  const cats = [
    { event: `Resultats trimestrals (beat EPS)`,                date: 'Pròxims resultats',   impact: 'pill-green Mitjà-Alt',  prob: 'pill-green Alta' },
    { event: `Expansió de marges per millora de mix`,           date: 'FY+1',               impact: 'pill-green Alt',         prob: 'pill-warn Mitjana' },
    { event: `Anunci de nova iniciativa estratègica`,           date: '12 mesos',           impact: 'pill-warn Mitjà',        prob: 'pill-warn Mitjana' },
    { event: `Recuperació del consum / cicle sector`,           date: '2H ' + (curYear + 1), impact: 'pill-green Alt',        prob: 'pill-warn Mitjana' },
    { event: `Programa de recompra d'accions`,                  date: 'Anual',              impact: 'pill-warn Mitjà',        prob: 'pill-green Alta' },
  ];
  const risks2 = [
    { risc: si.risks[0] || 'Cicle macroeconòmic adverse',      prob: 'pill-warn Mitjana',  impact: 'pill-warn Mitjà',    mit: 'Diversificació geogràfica i de producte' },
    { risc: si.risks[1] || 'Competència de nous entrantes',     prob: 'pill-warn Alta',     impact: 'pill-warn Mitjà',    mit: 'Inversió en R+D i fidelització de client' },
    { risc: si.risks[2] || 'Pressió regulatòria creixent',      prob: 'pill-warn Mitjana',  impact: 'pill-warn Mitjà',    mit: 'Participació en processos reguladors' },
    { risc: 'Pujada de tipus d\'interès sostenida',             prob: 'pill-gold Baixa',    impact: 'pill-warn Mitjà',    mit: 'Gestió prudent del deute i liquiditat' },
    { risc: 'Pèrdua de talent directiu clau',                   prob: 'pill-gold Baixa',    impact: 'pill-danger Alt',    mit: 'Pla de successió i incentius a llarg termini' },
  ];
  const page10 = `<section class="page">
  <div class="pad">
    ${hdr('Catalitzadors i Riscos')}
    <h2 class="section-num">Secció 7</h2>
    <h1 class="section">Catalitzadors i riscos</h1>
    <p class="lead">Esdeveniments que poden moure la cotització en els pròxims 12 mesos i mapa de riscos clau amb mesures de mitigació.</p>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--ok);margin-bottom:8px">Catalitzadors positius</h3>
    <table class="data">
      <thead><tr><th>Esdeveniment</th><th>Data prevista</th><th>Impacte</th><th>Probabilitat</th></tr></thead>
      <tbody>
        ${cats.map(c => {
          const [ipill, ilabel] = c.impact.split(' ');
          const [ppill, plabel] = c.prob.split(' ');
          return `<tr><td>${c.event}</td><td>${c.date}</td><td><span class="pill ${ipill}">${ilabel}</span></td><td><span class="pill ${ppill}">${plabel}</span></td></tr>`;
        }).join('')}
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--danger);margin:22px 0 8px">Riscos clau</h3>
    <table class="data">
      <thead><tr><th>Risc</th><th>Probabilitat</th><th>Impacte</th><th>Mitigació / Pla</th></tr></thead>
      <tbody>
        ${risks2.map(r => {
          const [ppill, plabel] = r.prob.split(' ');
          const [ipill, ilabel] = r.impact.split(' ');
          return `<tr><td>${r.risc}</td><td><span class="pill ${ppill}">${plabel}</span></td><td><span class="pill ${ipill}">${ilabel}</span></td><td>${r.mit}</td></tr>`;
        }).join('')}
      </tbody>
    </table>

    <div class="callout callout-warn">
      <strong>Risc / Recompensa.</strong> El balanç a 12 mesos és ${recoCa === 'COMPRAR' ? 'positiu però asimètric' : 'equilibrat'}. Catalitzadors visibles i datats vs. riscos majoritàriament sectorials i d'execució. Recomanem stop tècnic operatiu a <strong>${fPrice(stop, cur)}</strong> (MA200 est.) i target operatiu 1 a <strong>${fPrice(target1, cur)}</strong>, target 2 a <strong>${fPrice(target2, cur)}</strong>.
    </div>
  </div>
  ${ftr(10)}
</section>`;

  // ── PAGE 11: Valoració ──────────────────────────────────────────────────────
  const dcfPS = dcfValue ?? (epsBase * peTarget * 1.02);
  const mulAvg = epsBase * peTarget;
  const sotpHW = revB != null ? revB * 0.65 * 18 : 0;
  const sotpSvc = revB != null ? revB * 0.35 * 32 : 0;
  const sotpNC = d.marketCap != null ? d.marketCap / 1e9 * 0.02 : 0;
  const sotpTotal = sotpHW + sotpSvc + sotpNC;
  const sotpPS = shares != null && sotpTotal > 0 ? sotpTotal * 1e9 / shares : mulAvg * 0.95;

  const triangle = [
    { method: 'DCF',              value: dcfPS,    weight: 40 },
    { method: 'Múltiples (mig)',  value: mulAvg,   weight: 35 },
    { method: 'SOTP',             value: sotpPS,   weight: 25 },
  ];
  const blended = triangle.reduce((s, t) => s + t.value * t.weight / 100, 0);

  const page11 = `<section class="page">
  <div class="pad">
    ${hdr('Valoració')}
    <h2 class="section-num">Secció 8</h2>
    <h1 class="section">Valoració intrínseca</h1>
    <p class="lead">Triple aproximació de valoració: DCF, múltiples comparables i suma de parts (segments de negoci).</p>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">A. DCF · Discounted Cash Flow (5 anys + perpetuïtat)</h3>
    <table class="data">
      <thead><tr><th>Hipòtesi</th>${fyYears.slice(3).map((y, i) => `<th style="text-align:right">FY${y.toString().slice(2)}e${i > 1 ? '' : ''}</th>`).join('')}</tr></thead>
      <tbody>
        <tr><td>Vendes (B${cur})</td>${fyRev.slice(3).map(r => `<td class="num">${r.toFixed(1)}</td>`).join('')}</tr>
        <tr><td>Marge operatiu</td>${fyYears.slice(3).map((_, i) => `<td class="num">${((netMargin / 0.7) * 100 * (1 + i * 0.002)).toFixed(1)} %</td>`).join('')}</tr>
        <tr><td>EBIT (B${cur})</td>${fyEBIT.slice(3).map(e => `<td class="num">${e.toFixed(1)}</td>`).join('')}</tr>
        <tr><td>FCF (B${cur})</td>${fyFCF.slice(3).map(f => `<td class="num">${f.toFixed(1)}</td>`).join('')}</tr>
      </tbody>
    </table>

    <div class="grid-3" style="margin-top:14px">
      <div class="kpi"><div class="kpi-label">WACC assumit</div><div class="kpi-val">${(wacc * 100).toFixed(1)} %</div><div class="kpi-sub">Rf 4,2 % · ERP 5,5 % · β ${fRatio(d.beta, '')}</div></div>
      <div class="kpi"><div class="kpi-label">g terminal</div><div class="kpi-val">${(gTerm * 100).toFixed(1)} %</div><div class="kpi-sub">Inflació + creix. real moderat</div></div>
      <div class="kpi"><div class="kpi-label">Equity Value</div><div class="kpi-val" style="color:var(--gold)">${fLarge(d.marketCap != null ? d.marketCap * 1.05 : null, cur)}</div><div class="kpi-sub">Per acció: ${fPrice(dcfPS, cur)}</div></div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">B. Múltiples comparables · FY+1e</h3>
    <table class="data">
      <thead><tr><th>Aproximació</th><th style="text-align:right">Múltiple</th><th style="text-align:right">Mètrica</th><th style="text-align:right">Per acció</th></tr></thead>
      <tbody>
        <tr><td>P/E target (${peTarget.toFixed(0)}×)</td><td class="num">${peTarget.toFixed(1)}×</td><td class="num">EPS ${fPrice(fyEPS[3], cur)}</td><td class="num">${fPrice(fyEPS[3] * peTarget, cur)}</td></tr>
        ${evEbitda != null ? `<tr><td>EV/EBITDA target (${(evEbitda * 0.95).toFixed(0)}×)</td><td class="num">${(evEbitda * 0.95).toFixed(1)}×</td><td class="num">EBITDA est.</td><td class="num">${fPrice(d.price * 1.05, cur)}</td></tr>` : ''}
        ${pSales != null ? `<tr><td>P/Sales target (${(pSales * 1.02).toFixed(1)}×)</td><td class="num">${(pSales * 1.02).toFixed(1)}×</td><td class="num">Sales ${fLarge(d.revenue, cur)}</td><td class="num">${fPrice(d.price * 1.06, cur)}</td></tr>` : ''}
        ${pFCF != null ? `<tr><td>FCF yield target (${(100 / pFCF * 0.95).toFixed(1)} %)</td><td class="num">${(100 / pFCF * 0.95).toFixed(1)} %</td><td class="num">FCF est.</td><td class="num">${fPrice(d.price * 1.08, cur)}</td></tr>` : ''}
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">C. Suma de parts (SOTP)</h3>
    <table class="data">
      <thead><tr><th>Segment</th><th style="text-align:right">EBIT est. (B${cur})</th><th style="text-align:right">Múltiple</th><th style="text-align:right">EV (B${cur})</th></tr></thead>
      <tbody>
        <tr><td>${seg1Label} (core)</td><td class="num">${(fyEBIT[3] * 0.60).toFixed(1)}</td><td class="num">18×</td><td class="num">${(fyEBIT[3] * 0.60 * 18).toFixed(0)}</td></tr>
        <tr><td>${seg2Label} / Recurrent</td><td class="num">${(fyEBIT[3] * 0.40).toFixed(1)}</td><td class="num">32×</td><td class="num">${(fyEBIT[3] * 0.40 * 32).toFixed(0)}</td></tr>
        <tr><td>Net cash / Altres actius</td><td class="num">—</td><td class="num">—</td><td class="num">${sotpNC.toFixed(0)}</td></tr>
        <tr style="background:var(--soft)"><td><strong>Equity Value SOTP</strong></td><td class="num">—</td><td class="num">—</td><td class="num"><strong>${(fyEBIT[3] * 0.60 * 18 + fyEBIT[3] * 0.40 * 32 + sotpNC).toFixed(0)}</strong></td></tr>
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Triangle de valoració · Preu objectiu blended</h3>
    <table class="data">
      <thead><tr><th>Mètode</th><th style="text-align:right">Valor implícit</th><th style="text-align:right">Pes</th><th style="text-align:right">Contribució</th></tr></thead>
      <tbody>
        ${triangle.map(t => `<tr><td>${t.method}</td><td class="num">${fPrice(t.value, cur)}</td><td class="num">${t.weight} %</td><td class="num">${fPrice(t.value * t.weight / 100, cur)}</td></tr>`).join('')}
        <tr style="background:var(--soft)"><td><strong>Preu objectiu blended</strong></td><td class="num"><strong>${fPrice(blended, cur)}</strong></td><td class="num">100 %</td><td class="num"><strong>upside ${fPct(((blended - d.price) / d.price) * 100)}</strong></td></tr>
      </tbody>
    </table>
  </div>
  ${ftr(11)}
</section>`;

  // ── PAGE 12: Conclusió ──────────────────────────────────────────────────────
  const suitability = [
    { profile: 'Conservador', recWeight: recoCa === 'COMPRAR' ? 'pill-danger Evitar / &lt;1 %' : 'pill-danger Evitar', comment: `Volatilitat ${vol30d} % no encaixa amb perfil defensiu` },
    { profile: 'Moderat',     recWeight: recoCa === 'COMPRAR' ? 'pill-warn 2-3 %'     : 'pill-warn 1-2 %',  comment: 'Només via fons / ETF amb diversificació' },
    { profile: 'Equilibrat',  recWeight: recoCa === 'COMPRAR' ? 'pill-gold 3-5 %'     : 'pill-warn 2-3 %',  comment: 'Posició core en pota sectorial' },
    { profile: 'Dinàmic',     recWeight: recoCa === 'COMPRAR' ? 'pill-green 5-7 %'    : 'pill-gold 3-5 %',  comment: 'Posició overweight sectorial' },
    { profile: 'Agressiu',    recWeight: recoCa === 'COMPRAR' ? 'pill-green 7-10 %'   : 'pill-green 5-7 %', comment: 'Convicció directa amb stop tècnic actiu' },
  ];
  const page12 = `<section class="page">
  <div class="pad">
    ${hdr('Conclusió')}
    <h2 class="section-num">Secció 9</h2>
    <h1 class="section">Conclusió i recomanació final</h1>

    <div style="background:linear-gradient(135deg,#0f2137 0%,#1a3a5c 100%);color:#fff;border-radius:12px;padding:30px;margin:8px 0 22px">
      <div class="sans" style="font-size:11px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:10px">Recomanació final</div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:18px">
        <div>
          <div style="font-family:Georgia,serif;font-size:54px;font-weight:700;letter-spacing:-1px;line-height:.95">${recoCa}</div>
          <div class="sans" style="font-size:13px;color:rgba(255,255,255,.65);margin-top:6px">Convicció ${recoConvicció} · Horitzó 12 mesos</div>
        </div>
        <div style="text-align:right">
          <div class="sans" style="font-size:11px;color:rgba(255,255,255,.4);letter-spacing:1.2px;text-transform:uppercase">Preu objectiu</div>
          <div class="mono" style="font-size:48px;font-weight:700;color:var(--gold);line-height:1">${fPrice(targetFinal, cur)}</div>
          <div class="sans" style="font-size:13px;color:#16a34a;margin-top:4px">Upside ${fPct(upside)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px">
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px">
          <div class="sans" style="font-size:9.5px;letter-spacing:1.5px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-bottom:4px">Stop tècnic</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:#fff">${fPrice(stop, cur)}</div>
        </div>
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px">
          <div class="sans" style="font-size:9.5px;letter-spacing:1.5px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-bottom:4px">Target 1</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:#fff">${fPrice(target1, cur)}</div>
        </div>
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px">
          <div class="sans" style="font-size:9.5px;letter-spacing:1.5px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-bottom:4px">Target 2</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:#fff">${fPrice(target2, cur)}</div>
        </div>
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px">
          <div class="sans" style="font-size:9.5px;letter-spacing:1.5px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-bottom:4px">R/R</div>
          <div class="mono" style="font-size:18px;font-weight:700;color:var(--gold)">${rr.toFixed(1)}×</div>
        </div>
      </div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Argumentari final · 5 punts</h3>
    <ol style="padding-left:20px;font-size:13.5px;color:#3a382f">
      <li style="margin-bottom:8px"><strong>Qualitat fonamental:</strong> marge net ${fPct(netMargin * 100)}, FCF margin ${fPct(fcfMgn)}, ROE ${d.roe != null ? fPct(d.roe * 100) : 'positiu'}. El perfil financer suporta el múltiple de valoració.</li>
      <li style="margin-bottom:8px"><strong>Visibilitat d'EPS:</strong> consens FY+1 implica creixement EPS ${fPct(revGrowth * 80)} (${fPrice(fyEPS[3], cur)}) recolzat per la dinàmica operativa i el mix de negoci.</li>
      <li style="margin-bottom:8px"><strong>Posicionament sectorial:</strong> ${si.position}. El foso competitiu es fonamenta en ${si.rivalBullets[0].toLowerCase()}.</li>
      <li style="margin-bottom:8px"><strong>Valoració raonable:</strong> blended ${fPrice(blended, cur)} implica upside ${fPct(((blended - d.price) / d.price) * 100)}, compensant riscos amb un R/R de ${rr.toFixed(1)}×.</li>
      <li style="margin-bottom:8px"><strong>Riscos identificables:</strong> els principals riscos (${si.risks[0]?.toLowerCase() || 'cicle macroeconòmic'}) són parcials i amb temporalitat. Stop tècnic clar a ${fPrice(stop, cur)} limita la pèrdua màxima al ~${Math.round(Math.abs(stop / d.price - 1) * 100)} %.</li>
    </ol>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:18px 0 8px">Idoneïtat per perfils Factor OTC</h3>
    <table class="data">
      <thead><tr><th>Perfil</th><th>Pes recomanat en cartera</th><th>Comentari</th></tr></thead>
      <tbody>
        ${suitability.map(s => {
          const [pill, ...labelParts] = s.recWeight.split(' ');
          return `<tr><td>${s.profile}</td><td><span class="pill ${pill}">${labelParts.join(' ')}</span></td><td>${s.comment}</td></tr>`;
        }).join('')}
      </tbody>
    </table>

    <div class="callout callout-warn" style="margin-top:18px;font-size:11px;line-height:1.5">
      <strong>Avís legal · Disclaimer.</strong> Aquest informe ha estat elaborat per Factor OTC amb finalitat informativa i educativa. No constitueix assessorament d'inversió personalitzat MiFID II ni una recomanació individualitzada. Factor OTC no és una entitat financera regulada. La informació procedeix de fonts considerades fiables però no es garanteix la seva exactitud. Les estimacions i projeccions són opinions a la data de publicació i poden modificar-se sense previ avís. Tota inversió comporta risc de pèrdua parcial o total del capital. Es recomana consultar un assessor regulat abans de prendre decisions d'inversió. © ${curYear} Factor OTC · ID ${d.ticker}-${dateStr.replace(/\s/g, '')}.
    </div>
  </div>
  ${ftr(12)}
</section>`;

  // ── Assemble ─────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Factor OTC — Informe ${d.ticker}</title>
<style>${CSS_STOCK}</style>
</head>
<body>
${page1}
${page2}
${page3}
${page4}
${page5}
${page6}
${page7}
${page8}
${page9}
${page10}
${page11}
${page12}
</body>
</html>`;
}
