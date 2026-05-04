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

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateStockReport(d: StockReportData): string {
  const cur = d.currency === 'EUR' ? '€' : d.currency === 'GBP' ? '£' : '$';
  const isUp = d.changePercent >= 0;
  const changeColor = isUp ? '#16a34a' : '#dc2626';
  const dist52High = d.week52High && d.week52High > 0
    ? ((d.price - d.week52High) / d.week52High) * 100 : null;
  const dist52Low  = d.week52Low  && d.week52Low  > 0
    ? ((d.price - d.week52Low)  / d.week52Low)  * 100 : null;

  const si = getSectorInfo(d.sector);
  const tvSym = getTvSymbol(d.ticker, d.exchange);
  const tvUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSym)}&interval=W&theme=light&style=1&locale=es&toolbarbg=F1F3F6&hideideas=1&range=24M&hidetoptoolbar=0&hidesidetoolbar=1&saveimage=0&studies=%5B%5D`;

  // Month/year for hero subtitle
  const now = new Date();
  const monthEs = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const monthTitle = monthEs.charAt(0).toUpperCase() + monthEs.slice(1);

  // 5 hero stat cards
  const epsYoy = d.eps != null && d.eps !== 0 ? fPct(d.eps > 0 ? 12 : -8) : '—'; // placeholder growth
  const revenueYoy = d.revenueGrowth != null ? fPct(d.revenueGrowth * 100) : '—';
  const athDist = dist52High != null ? fPct(dist52High) : '—';
  const heroStats = [
    { label: 'Cotización',    value: fPrice(d.price, cur), sub: d.currency },
    { label: 'Market Cap',    value: fLarge(d.marketCap, cur), sub: '' },
    { label: 'Ventas YoY',    value: revenueYoy, sub: 'crecimiento' },
    { label: 'EPS (TTM)',     value: fPrice(d.eps, cur), sub: 'beneficio por acción' },
    { label: 'Distancia ATH', value: athDist, sub: 'vs. máx. 52 semanas' },
  ];

  // Bullet tech analysis
  const techBullets: string[] = [];
  if (dist52High != null) {
    const label = dist52High > -5 ? 'Cerca del máximo anual — zona de resistencia clave.' :
                  dist52High > -20 ? 'Zona intermedia. Consolidación o impulso posible.' :
                  'Más del 20% bajo máximos — potencial de recuperación si el negocio es sólido.';
    techBullets.push(`<strong>Posición vs. 52w máx.:</strong> ${fPct(dist52High)} — ${label}`);
  }
  if (dist52Low != null) {
    const label = dist52Low < 15 ? 'Cerca de mínimos anuales. Vigilar soporte crítico.' :
                  dist52Low > 60 ? 'Muy alejado del mínimo. Tendencia alcista consolidada.' : '';
    techBullets.push(`<strong>Posición vs. 52w mín.:</strong> ${fPct(dist52Low, false)}${label ? ` — ${label}` : ''}`);
  }
  if (d.beta != null) {
    const label = d.beta < 0.8 ? 'Acción defensiva, menor volatilidad que el mercado.' :
                  d.beta > 1.3 ? 'Alta beta — amplifica los movimientos del índice.' :
                  'Beta neutra — volatilidad alineada con el mercado.';
    techBullets.push(`<strong>Beta:</strong> ${fRatio(d.beta, '')} — ${label}`);
  }
  if (d.volume && d.avgVolume && d.avgVolume > 0) {
    const vr = d.volume / d.avgVolume;
    if (vr > 1.5) techBullets.push(`<strong>Volumen:</strong> ${vr.toFixed(1)}x sobre la media — actividad inusual, posibles catalizadores próximos.`);
  }
  if (techBullets.length === 0) techBullets.push('Datos técnicos básicos no disponibles. Consulta el gráfico interactivo en la sección G.');

  // Fundamentals table rows
  const fundRows1 = [
    ['P/E Trailing',    fRatio(d.pe)],
    ['P/E Forward',     fRatio(d.forwardPE)],
    ['EPS (TTM)',       fPrice(d.eps, cur)],
    ['Margen Neto',     d.profitMargin != null ? fPct(d.profitMargin * 100) : '—'],
    ['ROE',             d.roe != null ? fPct(d.roe * 100) : '—'],
  ];
  const fundRows2 = [
    ['Ingresos TTM',    fLarge(d.revenue, cur)],
    ['Crec. Ingresos',  d.revenueGrowth != null ? fPct(d.revenueGrowth * 100) : '—'],
    ['Deuda/Equity',    fRatio(d.debtToEquity, '')],
    ['Beta',            fRatio(d.beta, '')],
    ['Div. Yield',      d.dividendYield != null ? fPct(d.dividendYield * 100) : '—'],
  ];

  const tableRow = ([label, value]: string[]) => `
    <tr>
      <td style="padding:10px 12px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #f3f4f6;white-space:nowrap">${label}</td>
      <td style="padding:10px 12px;font-family:'Courier New',monospace;font-size:14px;font-weight:700;color:#0f2137;border-bottom:1px solid #f3f4f6;text-align:right">${value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Factor OTC — Informe ${d.ticker}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,'Times New Roman',serif;background:#f5f5f0;color:#1a1a2e;line-height:1.6;font-size:15px}
a{color:#c9a84c;text-decoration:none}
.sans{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
@media(max-width:640px){
  .hero-inner{padding:28px 20px !important}
  .hero-h1{font-size:52px !important}
  .stats-grid{grid-template-columns:1fr 1fr !important}
  .two-col{flex-direction:column !important}
  .three-col{flex-direction:column !important}
  .footer-inner{flex-direction:column !important}
  .section-body{padding:24px 20px !important}
  .fund-grid{flex-direction:column !important}
}
</style>
</head>
<body>

<!-- ═══ HERO ═══════════════════════════════════════════════════════════════ -->
<div style="background:#0f2137;border-left:0;position:relative;overflow:hidden">
  <div style="position:absolute;left:0;top:0;bottom:0;width:5px;background:#c9a84c"></div>

  <div class="hero-inner" style="max-width:900px;margin:0 auto;padding:40px 48px">

    <!-- Logo + meta -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:36px;flex-wrap:wrap;gap:16px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:54px;height:54px;background:rgba(201,168,76,.12);border:1.5px solid rgba(201,168,76,.5);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <path d="M5 22 L10 14 L15 18 L20 8 L25 12" stroke="#c9a84c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <div class="sans" style="font-weight:900;font-size:17px;letter-spacing:2.5px;color:#fff">FACTOR<span style="font-weight:300;letter-spacing:4px;color:#2d6a4f;margin-left:6px">OTC</span></div>
          <div class="sans" style="font-size:10px;color:rgba(255,255,255,.3);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px">Informe Bursátil Profesional</div>
        </div>
      </div>
      <div class="sans" style="text-align:right">
        <div style="font-size:10px;color:rgba(255,255,255,.3);letter-spacing:1px;text-transform:uppercase">${d.generatedAt}</div>
        <div style="font-size:11px;color:#c9a84c;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px">Análisis fundamental &amp; técnico</div>
      </div>
    </div>

    <!-- Ticker + price -->
    <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:20px;margin-bottom:8px">
      <div>
        <h1 class="hero-h1" style="font-family:Georgia,serif;font-size:76px;font-weight:900;color:#fff;letter-spacing:-3px;line-height:1">${d.ticker}</h1>
        <div class="sans" style="font-size:15px;color:rgba(255,255,255,.55);margin-top:6px">${d.name || '—'}</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          ${d.sector ? `<span class="sans" style="display:inline-block;padding:3px 10px;border:1px solid rgba(201,168,76,.35);border-radius:99px;font-size:10px;color:#c9a84c;background:rgba(201,168,76,.08);letter-spacing:.5px">${d.sector}</span>` : ''}
          ${d.exchange ? `<span class="sans" style="display:inline-block;padding:3px 10px;border:1px solid rgba(255,255,255,.12);border-radius:99px;font-size:10px;color:rgba(255,255,255,.4)">${d.exchange} · ${d.currency}</span>` : ''}
        </div>
        <div class="sans" style="font-size:11px;color:rgba(255,255,255,.2);margin-top:8px;letter-spacing:.5px">Análisis fundamental y técnico · ${monthTitle}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:'Courier New',monospace;font-size:46px;font-weight:700;color:#c9a84c;line-height:1">${fPrice(d.price, cur)}</div>
        <div class="sans" style="font-size:18px;color:${changeColor};margin-top:4px;font-weight:600">${isUp ? '▲' : '▼'} ${fPct(d.changePercent)}</div>
        <div class="sans" style="font-size:10px;color:rgba(255,255,255,.25);margin-top:4px">variación sesión anterior</div>
      </div>
    </div>

    <!-- 5 stat cards -->
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:28px">
      ${heroStats.map(s => `
      <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px 12px">
        <div class="sans" style="font-size:9px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">${s.label}</div>
        <div style="font-family:'Courier New',monospace;font-size:16px;font-weight:700;color:#fff">${s.value}</div>
        ${s.sub ? `<div class="sans" style="font-size:9px;color:rgba(255,255,255,.25);margin-top:3px">${s.sub}</div>` : ''}
      </div>`).join('')}
    </div>

  </div>
</div>

${d.source === 'minimal' ? `
<!-- Data warning -->
<div style="background:#fffbeb;border-bottom:2px solid #f59e0b;padding:14px 48px">
  <div style="max-width:900px;margin:0 auto;display:flex;gap:12px;align-items:center">
    <span style="font-size:20px">⚠️</span>
    <div class="sans">
      <span style="font-size:13px;font-weight:700;color:#92400e">Datos de mercado temporalmente no disponibles — </span>
      <span style="font-size:13px;color:#b45309">Yahoo Finance limita peticiones del servidor. El gráfico TradingView (sección G) sigue operativo. Regenera el informe en unos minutos.</span>
    </div>
  </div>
</div>` : ''}

<!-- ═══ SECCIÓN B: ¿A QUÉ SE DEDICA? ══════════════════════════════════════ -->
<div style="background:#fff;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:900px;margin:0 auto;padding:40px 48px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Sección B</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:20px">¿A qué se dedica la empresa?</h2>
    <div style="color:#374151;line-height:1.85;font-size:15px;max-width:780px">
      ${d.description
        ? `<p>${d.description.slice(0, 900).replace(/\b(revenue|growth|market|platform|technology|cloud|AI|software|hardware|services|products)\b/gi, '<strong>$1</strong>')}${d.description.length > 900 ? '…' : ''}</p>`
        : '<p>Descripción corporativa no disponible. Consulta la web oficial de la empresa para obtener información sobre su modelo de negocio y actividad principal.</p>'}
    </div>
    ${d.website ? `<div style="margin-top:16px"><a href="${d.website}" class="sans" style="font-size:12px;color:#2d6a4f">${d.website} ↗</a></div>` : ''}
    ${d.country || d.industry ? `<div class="sans" style="margin-top:16px;display:flex;gap:16px;flex-wrap:wrap">
      ${d.industry ? `<span style="font-size:12px;color:#6b7280">Industria: <strong style="color:#0f2137">${d.industry}</strong></span>` : ''}
      ${d.country ? `<span style="font-size:12px;color:#6b7280">País: <strong style="color:#0f2137">${d.country}</strong></span>` : ''}
    </div>` : ''}
  </div>
</div>

<!-- ═══ SECCIÓN C: POSICIÓN COMPETITIVA ════════════════════════════════════ -->
<div style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:900px;margin:0 auto;padding:40px 48px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Sección C</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:24px">Posición competitiva</h2>
    <div class="two-col" style="display:flex;gap:20px;align-items:flex-start">
      <!-- 4 mini-cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;min-width:0">
        ${[
          ['Subsector', si.subsector],
          ['Posición', si.position],
          ['Cuota estimada', si.marketShareEst],
          ['Competidor clave', si.topCompetitor],
        ].map(([label, value]) => `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px">
          <div class="sans" style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">${label}</div>
          <div class="sans" style="font-size:13px;font-weight:700;color:#0f2137;line-height:1.3">${value}</div>
        </div>`).join('')}
      </div>
      <!-- Rival principal block -->
      <div style="flex:1;min-width:0;background:#0f2137;border-radius:12px;padding:20px">
        <div class="sans" style="font-size:10px;color:#c9a84c;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">Rival principal</div>
        <div class="sans" style="font-size:13px;font-weight:700;color:#fff;margin-bottom:10px">${si.topCompetitor}</div>
        <p class="sans" style="font-size:12px;color:rgba(255,255,255,.55);line-height:1.6;margin-bottom:14px">${si.rivalDesc}</p>
        <ul style="list-style:none;display:flex;flex-direction:column;gap:8px">
          ${si.rivalBullets.map(b => `
          <li class="sans" style="font-size:11px;color:rgba(255,255,255,.6);padding-left:14px;position:relative;line-height:1.5">
            <span style="position:absolute;left:0;color:#c9a84c">›</span>${b}
          </li>`).join('')}
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SECCIÓN D: POTENCIAL FUTURO ════════════════════════════════════════ -->
<div style="background:#fff;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:900px;margin:0 auto;padding:40px 48px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Sección D</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:24px">Potencial futuro del sector</h2>
    <div class="three-col" style="display:flex;gap:16px;margin-bottom:24px">
      ${si.potentialCards.map(c => `
      <div style="flex:1;border:1px solid #e5e7eb;border-radius:12px;padding:20px;border-top:3px solid #c9a84c">
        <div style="font-size:20px;margin-bottom:10px">${c.icon}</div>
        <div class="sans" style="font-size:13px;font-weight:700;color:#0f2137;margin-bottom:8px">${c.title}</div>
        <p class="sans" style="font-size:12px;color:#6b7280;line-height:1.6">${c.text}</p>
      </div>`).join('')}
    </div>
    <!-- Risks -->
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:20px">
      <div class="sans" style="font-size:10px;color:#dc2626;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px">⚠ Riesgos a vigilar</div>
      <ul style="list-style:none;display:flex;flex-direction:column;gap:8px">
        ${si.risks.map(r => `
        <li class="sans" style="font-size:12px;color:#7f1d1d;padding-left:16px;position:relative;line-height:1.5">
          <span style="position:absolute;left:0;color:#dc2626">—</span>${r}
        </li>`).join('')}
      </ul>
    </div>
  </div>
</div>

<!-- ═══ SECCIÓN E: DATOS FUNDAMENTALES ═════════════════════════════════════ -->
<div style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:900px;margin:0 auto;padding:40px 48px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Sección E</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:24px">Datos fundamentales</h2>

    <!-- Large market cap -->
    <div style="background:#0f2137;border-radius:12px;padding:24px;margin-bottom:24px;display:flex;align-items:center;gap:24px;flex-wrap:wrap">
      <div>
        <div class="sans" style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Capitalización de mercado</div>
        <div style="font-family:'Courier New',monospace;font-size:42px;font-weight:700;color:#c9a84c;line-height:1">${fLarge(d.marketCap, cur)}</div>
      </div>
      <div style="width:1px;height:60px;background:rgba(255,255,255,.1)"></div>
      <div style="display:flex;gap:28px;flex-wrap:wrap">
        <div>
          <div class="sans" style="font-size:9px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px">Volumen diario</div>
          <div class="sans" style="font-size:14px;font-weight:600;color:#fff">${d.volume ? d.volume.toLocaleString('en-US') : '—'}</div>
        </div>
        <div>
          <div class="sans" style="font-size:9px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px">52w Máximo</div>
          <div class="sans" style="font-size:14px;font-weight:600;color:#fff">${fPrice(d.week52High, cur)}</div>
        </div>
        <div>
          <div class="sans" style="font-size:9px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px">52w Mínimo</div>
          <div class="sans" style="font-size:14px;font-weight:600;color:#fff">${fPrice(d.week52Low, cur)}</div>
        </div>
      </div>
    </div>

    <!-- Two tables -->
    <div class="fund-grid" style="display:flex;gap:16px">
      <div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
        <div class="sans" style="padding:12px 16px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #f3f4f6">Valoración &amp; Rentabilidad</div>
        <table style="width:100%;border-collapse:collapse">${fundRows1.map(tableRow).join('')}</table>
      </div>
      <div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
        <div class="sans" style="padding:12px 16px;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #f3f4f6">Ingresos &amp; Balance</div>
        <table style="width:100%;border-collapse:collapse">${fundRows2.map(tableRow).join('')}</table>
      </div>
    </div>

    <!-- Quarterly results -->
    <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px">

      <!-- Last quarter reported -->
      <div style="background:#0f2137;border-radius:12px;padding:20px">
        <div class="sans" style="font-size:9px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:2px;margin-bottom:14px">
          Último trimestre reportado${d.epsLastQDate ? ` · ${d.epsLastQDate}` : d.lastEarningsDate ? ` · ${d.lastEarningsDate}` : ''}
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div>
            <div class="sans" style="font-size:9px;color:rgba(255,255,255,.3);letter-spacing:1px;margin-bottom:4px">EPS Real</div>
            <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#c9a84c">
              ${d.epsLastQActual != null ? `${cur}${d.epsLastQActual.toFixed(2)}` : '—'}
            </div>
          </div>
          <div>
            <div class="sans" style="font-size:9px;color:rgba(255,255,255,.3);letter-spacing:1px;margin-bottom:4px">EPS Consenso</div>
            <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:rgba(255,255,255,.6)">
              ${d.epsLastQEstimate != null ? `${cur}${d.epsLastQEstimate.toFixed(2)}` : '—'}
            </div>
          </div>
          ${d.epsLastQSurprise != null ? `
          <div>
            <div class="sans" style="font-size:9px;color:rgba(255,255,255,.3);letter-spacing:1px;margin-bottom:4px">Sorpresa</div>
            <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:${d.epsLastQSurprise >= 0 ? '#16a34a' : '#dc2626'}">
              ${d.epsLastQSurprise >= 0 ? '+' : ''}${(d.epsLastQSurprise * 100).toFixed(1)}%
            </div>
          </div>` : ''}
        </div>
        ${d.revenueGrowth != null ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)">
          <span class="sans" style="font-size:11px;color:rgba(255,255,255,.35)">Crecimiento Ingresos TTM: </span>
          <span style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:${(d.revenueGrowth * 100) >= 0 ? '#16a34a' : '#dc2626'}">
            ${(d.revenueGrowth * 100) >= 0 ? '+' : ''}${(d.revenueGrowth * 100).toFixed(1)}% YoY
          </span>
        </div>` : ''}
      </div>

      <!-- Next quarter consensus -->
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px">
        <div class="sans" style="font-size:9px;color:#0369a1;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px">
          Próximo trimestre — Consenso analistas${d.epsNextQDate ? ` · ${d.epsNextQDate}` : d.nextEarningsDate ? ` · ${d.nextEarningsDate}` : ''}
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div>
            <div class="sans" style="font-size:9px;color:#0369a1;letter-spacing:1px;margin-bottom:4px">EPS Estimado</div>
            <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#0f2137">
              ${d.epsNextQEstimate != null ? `${cur}${d.epsNextQEstimate.toFixed(2)}` : '—'}
            </div>
          </div>
          ${d.revenueNextQEst != null ? `
          <div>
            <div class="sans" style="font-size:9px;color:#0369a1;letter-spacing:1px;margin-bottom:4px">Revenue Estimado</div>
            <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#0f2137">
              ${fLarge(d.revenueNextQEst, cur)}
            </div>
          </div>` : ''}
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #bae6fd">
          <span class="sans" style="font-size:11px;color:#0369a1">Próximos resultados: </span>
          <span class="sans" style="font-size:11px;font-weight:700;color:#0f2137">${d.nextEarningsDate ?? 'N/D'}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SECCIÓN F: ANÁLISIS TÉCNICO ════════════════════════════════════════ -->
<div style="background:#fff;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:900px;margin:0 auto;padding:40px 48px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Sección F</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:24px">Análisis técnico</h2>
    <div class="two-col" style="display:flex;gap:20px;align-items:flex-start">
      <!-- Big distancia ATH block -->
      <div style="background:#0f2137;border-radius:12px;padding:28px;flex-shrink:0;min-width:180px;text-align:center">
        <div class="sans" style="font-size:9px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Dist. vs ATH</div>
        <div style="font-family:Georgia,serif;font-size:72px;font-weight:700;line-height:1;color:${dist52High != null && dist52High > -10 ? '#c9a84c' : dist52High != null && dist52High > -30 ? '#f59e0b' : '#dc2626'}">${dist52High != null ? `${dist52High.toFixed(1)}%` : '—'}</div>
        <div class="sans" style="font-size:10px;color:rgba(255,255,255,.3);margin-top:8px">respecto al máximo anual</div>
      </div>
      <!-- Bullets -->
      <div style="flex:1;display:flex;flex-direction:column;gap:10px">
        ${techBullets.map(b => `
        <div class="sans" style="padding:12px 16px;background:#f9fafb;border-left:3px solid #2d6a4f;border-radius:0 8px 8px 0;font-size:13px;color:#374151;line-height:1.55">${b}</div>`).join('')}
        <p class="sans" style="font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.5">Para análisis técnico avanzado (RSI, MACD, Bollinger, EMA), consulta el gráfico interactivo en la sección G.</p>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SECCIÓN G: GRÁFICO TRADINGVIEW ═════════════════════════════════════ -->
<div style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:900px;margin:0 auto;padding:40px 48px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Sección G</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:20px">Gráfico interactivo</h2>
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff">
      <iframe src="${tvUrl}" style="display:block;width:100%;height:560px;border:none" allowtransparency="true" allow="clipboard-write" loading="lazy"></iframe>
    </div>
    <p class="sans" style="font-size:10px;color:#9ca3af;margin-top:8px">Gráfico semanal · 24 meses · Fuente: TradingView. Requiere conexión a internet.</p>
  </div>
</div>

<!-- ═══ SECCIÓN H: FOOTER ═══════════════════════════════════════════════════ -->
<div style="background:#0f2137;border-top:1px solid rgba(201,168,76,.2);padding:36px 48px">
  <div class="footer-inner" style="max-width:900px;margin:0 auto;display:flex;justify-content:space-between;align-items:flex-start;gap:28px;flex-wrap:wrap">
    <div>
      <div class="sans" style="font-weight:900;font-size:16px;letter-spacing:2.5px;color:#fff">FACTOR<span style="font-weight:300;letter-spacing:4px;color:#2d6a4f;margin-left:6px">OTC</span></div>
      <div class="sans" style="font-size:11px;color:rgba(255,255,255,.3);margin-top:6px">Informe generado: ${d.generatedAt}</div>
      <div class="sans" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <span style="padding:3px 8px;border-radius:4px;font-size:9px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.35);letter-spacing:1px;text-transform:uppercase">
          ${d.source === 'yahoo' ? 'Yahoo Finance' : d.source === 'partial' ? 'Yahoo Finance (parcial)' : 'Datos mínimos'}
        </span>
        <span style="padding:3px 8px;border-radius:4px;font-size:9px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.35);letter-spacing:1px;text-transform:uppercase">TradingView</span>
      </div>
    </div>
    <div class="sans" style="font-size:11px;color:rgba(255,255,255,.3);max-width:500px;line-height:1.7">
      <strong style="color:rgba(255,255,255,.5)">Aviso legal:</strong> Este informe es una herramienta de soporte a la decisión de inversión con finalidad orientativa y educativa. No constituye asesoramiento financiero personalizado ni regulado. Factor OTC no es una entidad financiera regulada. Los rendimientos pasados no garantizan rendimientos futuros. Invertir en valores cotizados conlleva riesgo de pérdida de capital.
    </div>
  </div>
</div>

</body>
</html>`;
}
