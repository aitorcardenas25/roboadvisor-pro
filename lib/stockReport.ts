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

  generatedAt:  string;
  source:       'yahoo' | 'partial' | 'minimal';
}

// ─── Number formatters ────────────────────────────────────────────────────────

function fPrice(n: number | null, cur = '$'): string {
  if (n == null || !isFinite(n)) return '—';
  if (n >= 1000) return `${cur}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return `${cur}${n.toFixed(2)}`;
}
function fPct(n: number | null): string {
  if (n == null || !isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
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

// ─── Sector templates ─────────────────────────────────────────────────────────

interface SectorText { competitive: string; potential: string }

const SECTOR_ANALYSIS: Record<string, SectorText> = {
  Technology: {
    competitive:
      `El sector tecnològic presenta una estructura oligopolista on les economies d'escala, ` +
      `les plataformes amb efectes de xarxa i la propietat intel·lectual constitueixen les ` +
      `principals barreres d'entrada. Les empreses líders es beneficien de marges operatius ` +
      `estructuralment superiors a la mitjana de mercat, alt poder de fixació de preus i ` +
      `capacitat de reinversió contínua en R+D. La competència s'intensifica especialment ` +
      `en segments de cloud, IA i maquinari especialitzat.`,
    potential:
      `La convergència de la intel·ligència artificial, la computació edge i la transformació ` +
      `digital empresarial genera un mercat adreçable en expansió contínua. Les projeccions ` +
      `sectorials apunten a un creixement anual compost (CAGR) del 10–15% en segments com ` +
      `cloud computing, ciberseguretat i IA generativa fins a 2030. Els riscos regulatoris ` +
      `(antimonopoli, GDPR, AI Act) representen el principal vector d'incertesa per a les ` +
      `grans capitalitzacions.`,
  },
  'Communication Services': {
    competitive:
      `Les empreses de comunicació i entreteniment digital operen en entorns on el contingut ` +
      `exclusiu i les bases d'usuaris captius creen avantatges competitius duradors. Les ` +
      `plataformes socials i de streaming gaudeixen d'alts costos de canvi per als usuaris ` +
      `i beneficis creixents de les dades comportamentals. La pressió competitiva prové ` +
      `de noves plataformes i de la fragmentació de l'audiència.`,
    potential:
      `La publicitat digital continua desplaçant l'offline, amb una quota de mercat creixent ` +
      `en TV connectada i vídeo de format curt. L'expansió cap a mercats emergents i la ` +
      `monetització de la IA en la recomanació de continguts representen catalitzadors de ` +
      `creixement. Es preveu un CAGR del 8–12% en publicitat digital fins a 2028.`,
  },
  'Consumer Cyclical': {
    competitive:
      `El consum discrecional es caracteritza per cicles econòmics pronunciats que amplien ` +
      `la volatilitat dels resultats. Les empreses amb marques premium, canals directes ` +
      `al consumidor i programes de fidelització presenten resiliència superior. ` +
      `L'e-commerce ha reduït les barreres d'entrada, intensificant la pressió en preus ` +
      `i marges per als actors tradicionals.`,
    potential:
      `La recuperació de la demanda post-restrictiva, el creixement de la classe mitjana en ` +
      `mercats emergents i la digitalització del comerç minorista configuren un panorama ` +
      `de creixement moderat. La personalització via IA i els models de subscripció ` +
      `representen oportunitats de millora del marge recurrent.`,
  },
  'Consumer Defensive': {
    competitive:
      `Les empreses de consum bàsic disposen de marques consolidades, xarxes de distribució ` +
      `globals i fidelitat dels consumidors com a principals fossats competitius. L'elevada ` +
      `intensitat de capital en la cadena de subministrament i els acords estratègics amb ` +
      `distribuïdors dificulten l'entrada de nous competidors a escala.`,
    potential:
      `El creixement orgànic és limitat en mercats madurs (1–4% CAGR), però la premiumització ` +
      `de productes, l'expansió en mercats emergents i la innovació en categories de salut ` +
      `i sostenibilitat ofereixen vectors de creació de valor. L'eficiència operativa via ` +
      `automatització és clau per mantenir marges davant de la inflació de costos.`,
  },
  Healthcare: {
    competitive:
      `El sector salut presenta barreres d'entrada excepcionals: patents, aprovacions ` +
      `regulatòries (FDA/EMA), dades clíniques acumulades i relacions establertes amb ` +
      `proveïdors de salut. Les empreses farmacèutiques i biotecnològiques operen amb ` +
      `pipelines que determinen el seu valor intrínsec a llarg termini. El poder de ` +
      `negociació dels PBM i asseguradores limita el poder de fixació de preus.`,
    potential:
      `L'envelliment demogràfic, la prevalença creixent de malalties cròniques i la irrupció ` +
      `de la medicina de precisió i l'IA diagnòstica configuren un mercat en expansió ` +
      `sostenida (CAGR 6–9% fins a 2030). Les teràpies gèniques i els anticossos monoclonals ` +
      `representen fronts d'innovació amb potencial de disrupció terapèutica.`,
  },
  'Financial Services': {
    competitive:
      `Les entitats financeres operen en un entorn regulat on l'escala, la qualitat del ` +
      `balanç i la diversificació de fonts d'ingressos defineixen la posició competitiva. ` +
      `La digitalització ha reduït les barreres d'entrada per a fintechs, però la ` +
      `confiança institucional i les xarxes de distribució físiques continuen sent ` +
      `avantatges dels actors consolidats.`,
    potential:
      `La normalització de tipus d'interès millora els marges d'intermediació. La integració ` +
      `de serveis financers en plataformes digitals (open banking, embedded finance) ` +
      `i l'adopció d'actius digitals representen oportunitats d'expansió. Es preveu ` +
      `una consolidació sectorial que afavorirà els actors amb millor eficiència operativa.`,
  },
  Energy: {
    competitive:
      `El sector energètic es caracteritza per una alta intensitat de capital, cicles ` +
      `llargs d'inversió i sensibilitat als preus globals de les matèries primeres. ` +
      `Les empreses integrades verticalment (upstream-midstream-downstream) ` +
      `presenten major estabilitat de fluxos de caixa. La transició energètica ` +
      `és el principal factor estructural que reconfigura la competitivitat sectorial.`,
    potential:
      `La demanda global d'energia continua creixent, especialment en economies emergents. ` +
      `Simultàniament, les renovables (solar, eòlica, emmagatzematge) acaparen la major ` +
      `part de la nova capacitat instal·lada. Les empreses amb estratègies de transició ` +
      `energètica creïbles i balanços sòlids estan millor posicionades per a la creació ` +
      `de valor a llarg termini.`,
  },
  Industrials: {
    competitive:
      `Les empreses industrials competeixen en base a l'excel·lència operativa, relacions ` +
      `contractuals a llarg termini i capacitats tecnològiques específiques. Les economies ` +
      `d'escala en fabricació i la integració en cadenes de subministrament dels clients ` +
      `creen costos de canvi elevats. La presència global i la diversificació geogràfica ` +
      `mitiguen riscos de concentració.`,
    potential:
      `La inversió en infraestructures, la reshoring de capacitats productives i ` +
      `l'automatització industrial (robòtica, IoT industrial) representen catalitzadors ` +
      `de demanda a mig termini. Els programes de reindustrialització d'Europa i EUA ` +
      `afavorixen els proveïdors d'equipaments i serveis especialitzats.`,
  },
};

function getSectorText(sector: string): SectorText {
  return SECTOR_ANALYSIS[sector] ?? {
    competitive:
      `${sector ? `L'empresa opera en el sector ${sector}, ` : `L'empresa `}on la posició competitiva ` +
      `es determina per la diferenciació del producte, l'eficiència de costos i la ` +
      `capacitat d'innovació. La qualitat del management i l'assignació disciplinada de ` +
      `capital representen factors diferenciadors clau en entorns competitius madurs.`,
    potential:
      `Les perspectives de creixement estan lligades a la dinàmica macroeconòmica global, ` +
      `l'evolució tecnològica del sector i la capacitat de l'empresa per capturar quota ` +
      `de mercat. La gestió eficient del capital circulant i la generació de lliure flux ` +
      `de caixa seran indicadors clau de la qualitat del negoci a mig termini.`,
  };
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateStockReport(d: StockReportData): string {
  const cur = d.currency === 'EUR' ? '€' : d.currency === 'GBP' ? '£' : '$';
  const isUp = d.changePercent >= 0;
  const changeColor = isUp ? '#10b981' : '#ef4444';
  const dist52High = d.week52High && d.week52High > 0
    ? ((d.price - d.week52High) / d.week52High) * 100 : null;
  const dist52Low  = d.week52Low  && d.week52Low  > 0
    ? ((d.price - d.week52Low)  / d.week52Low)  * 100 : null;
  const sectorText = getSectorText(d.sector);

  const statsCards = [
    { label: 'Preu actual',     value: fPrice(d.price, cur),       color: '#c9a84c' },
    { label: 'Variació dia',    value: fPct(d.changePercent),       color: changeColor },
    { label: 'Market Cap',      value: fLarge(d.marketCap, cur),    color: '#fff' },
    { label: '52w Màxim',       value: fPrice(d.week52High, cur),   color: '#fff' },
    { label: '52w Mínim',       value: fPrice(d.week52Low,  cur),   color: '#fff' },
    { label: 'Dist. vs Màxim',  value: dist52High != null ? fPct(dist52High) : '—',
      color: dist52High != null && dist52High < -20 ? '#f59e0b' : '#fff' },
  ].map(c => `
    <div class="stat-card">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value" style="color:${c.color}">${c.value}</div>
    </div>`).join('');

  const fundamentalRows = [
    ['P/E Trailing',    fRatio(d.pe)],
    ['P/E Forward',     fRatio(d.forwardPE)],
    ['EPS (TTM)',       fPrice(d.eps, cur)],
    ['Ingressos (TTM)', fLarge(d.revenue, cur)],
    ['Creix. Ingressos',fPct(d.revenueGrowth != null ? d.revenueGrowth * 100 : null)],
    ['Marge Net',       fPct(d.profitMargin   != null ? d.profitMargin * 100  : null)],
    ['ROE',             fPct(d.roe            != null ? d.roe * 100           : null)],
    ['Debt/Equity',     fRatio(d.debtToEquity, '')],
    ['Beta',            fRatio(d.beta, '')],
    ['Dividend Yield',  fPct(d.dividendYield  != null ? d.dividendYield * 100 : null)],
  ].map(([label, value]) => `
    <tr>
      <td class="td-label">${label}</td>
      <td class="td-value">${value}</td>
    </tr>`).join('');

  const technicalSummary = (() => {
    const rows: string[] = [];
    if (dist52High != null) {
      const sentiment = dist52High > -5 ? 'Proper al màxim anual, zona de resistència clau.' :
                        dist52High > -20 ? 'En zona intermèdia. Consolidació o impuls possible.' :
                        'Distancia del màxim > 20%. Potencial de recuperació si el negoci és sòlid.';
      rows.push(`<li><strong>Posició respecte 52w màxim:</strong> ${fPct(dist52High)} — ${sentiment}</li>`);
    }
    if (dist52Low != null) {
      const sentiment = dist52Low < 15 ? 'Proper als mínims anuals. Vigilar suport crític.' :
                        dist52Low > 50 ? 'Molt allunyat del mínim. Tendència alcista confirmada.' : '';
      rows.push(`<li><strong>Posició respecte 52w mínim:</strong> ${fPct(dist52Low)}${sentiment ? ` — ${sentiment}` : ''}</li>`);
    }
    if (d.beta != null) {
      const vol = d.beta < 0.8 ? 'Acció defensiva (beta baixa), menor volatilitat que el mercat.' :
                  d.beta > 1.3 ? `Acció d'alta beta, amplifica moviments del mercat.` :
                  'Volatilitat propera a la del mercat (beta neutra).';
      rows.push(`<li><strong>Beta:</strong> ${fRatio(d.beta, '')} — ${vol}</li>`);
    }
    if (d.volume && d.avgVolume && d.avgVolume > 0) {
      const volRatio = d.volume / d.avgVolume;
      if (volRatio > 1.5) rows.push(`<li><strong>Volum:</strong> ${(volRatio).toFixed(1)}x sobre la mitjana — activitat inusual, pot indicar notícies rellevants.</li>`);
    }
    if (rows.length === 0) rows.push('<li>Dades tècniques bàsiques no disponibles en aquest moment.</li>');
    return rows.join('');
  })();

  const tvSymbol = d.ticker.replace('.', ':').toUpperCase();
  const tvUrl    = `https://www.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=W&hide_side_toolbar=0&allow_symbol_change=0&save_image=0&theme=dark&style=1&timezone=exchange&hide_top_toolbar=0&withdateranges=1`;

  return `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Factor OTC — Informe ${d.ticker} — ${d.generatedAt}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--gold:#c9a84c;--gold-lt:#e8d5a3;--green:#1a3a2a;--green-mid:#2d6a4f;--bg:#080e0b;--bg2:#0d1a14;--bg3:#111c18;--text:#f5f5f0;--muted:rgba(245,245,240,.45)}
html{scroll-behavior:smooth}
body{font-family:Georgia,'Times New Roman',serif;background:var(--bg);color:var(--text);line-height:1.6;font-size:15px}
a{color:var(--gold);text-decoration:none}
/* Header */
.header{background:linear-gradient(135deg,var(--green) 0%,#0f2218 50%,var(--bg) 100%);border-bottom:1px solid rgba(45,106,79,.4);padding:20px 48px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.logo-wrap{display:flex;align-items:center;gap:10px}
.logo-box{width:36px;height:36px;background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.4);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:var(--gold);font-family:Arial,sans-serif}
.logo-name{font-family:Arial,sans-serif;font-weight:900;font-size:16px;letter-spacing:2px;color:#fff}
.logo-sub{font-family:Arial,sans-serif;font-weight:300;font-size:14px;letter-spacing:4px;color:var(--green-mid);margin-left:4px}
.header-meta{text-align:right;font-family:Arial,sans-serif}
.header-date{font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase}
.header-type{font-size:11px;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-top:2px}
/* Hero */
.hero{background:linear-gradient(180deg,rgba(26,58,42,.4) 0%,transparent 100%);padding:48px 48px 32px;border-bottom:1px solid rgba(45,106,79,.2)}
.hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:32px}
.hero-ticker{font-family:Arial,sans-serif;font-size:56px;font-weight:900;color:#fff;letter-spacing:-2px;line-height:1}
.hero-name{font-size:16px;color:var(--muted);margin-top:6px;font-family:Arial,sans-serif}
.hero-badge{display:inline-block;padding:4px 12px;border:1px solid rgba(201,168,76,.3);border-radius:999px;font-family:Arial,sans-serif;font-size:11px;color:var(--gold);background:rgba(201,168,76,.07);margin-top:8px;letter-spacing:1px}
.price-block{text-align:right}
.price-main{font-family:'Courier New',monospace;font-size:42px;font-weight:700;color:var(--gold);line-height:1}
.price-change{font-family:'Courier New',monospace;font-size:18px;margin-top:4px}
/* Stat cards */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.stat-card{background:rgba(255,255,255,.03);border:1px solid rgba(45,106,79,.25);border-radius:10px;padding:16px;transition:.2s}
.stat-label{font-family:Arial,sans-serif;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px}
.stat-value{font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#fff}
/* Sections */
.container{max-width:960px;margin:0 auto;padding:0 48px}
.section{padding:40px 0;border-bottom:1px solid rgba(45,106,79,.15)}
.section:last-child{border-bottom:none}
.section-label{font-family:Arial,sans-serif;font-size:9px;color:var(--green-mid);text-transform:uppercase;letter-spacing:3px;margin-bottom:8px}
.section-title{font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:20px}
.section-text{color:rgba(245,245,240,.75);line-height:1.8;max-width:800px}
.section-text p+p{margin-top:12px}
/* Fundamentals table */
.fund-table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif}
.fund-table tr{border-bottom:1px solid rgba(255,255,255,.06)}
.fund-table tr:hover{background:rgba(255,255,255,.02)}
.td-label{padding:10px 0;font-size:12px;color:var(--muted);width:180px;text-transform:uppercase;letter-spacing:.5px}
.td-value{padding:10px 0;font-family:'Courier New',monospace;font-size:14px;color:#fff;font-weight:600}
/* Technical list */
.tech-list{list-style:none;space-y:8px}
.tech-list li{padding:10px 14px;background:rgba(255,255,255,.025);border-left:3px solid var(--green-mid);border-radius:0 6px 6px 0;font-size:13px;color:rgba(245,245,240,.8);margin-bottom:8px;font-family:Arial,sans-serif;line-height:1.5}
/* Chart */
.chart-wrap{border:1px solid rgba(45,106,79,.3);border-radius:12px;overflow:hidden;background:#131722}
.chart-wrap iframe{display:block;width:100%;height:500px;border:none}
/* Earnings row */
.earnings-row{display:flex;gap:24px;flex-wrap:wrap;margin-top:16px}
.earnings-card{flex:1;min-width:200px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2);border-radius:10px;padding:16px}
.earnings-label{font-family:Arial,sans-serif;font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px}
.earnings-value{font-family:'Courier New',monospace;font-size:16px;color:#fff;font-weight:700}
/* Footer */
.footer{background:var(--green);border-top:1px solid rgba(45,106,79,.5);padding:32px 48px;margin-top:0}
.footer-inner{max-width:960px;margin:0 auto;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap}
.footer-brand{font-family:Arial,sans-serif}
.footer-brand .name{font-weight:900;font-size:14px;letter-spacing:2px;color:#fff}
.footer-brand .sub{font-weight:300;font-size:12px;color:var(--gold);letter-spacing:3px}
.footer-disclaimer{font-family:Arial,sans-serif;font-size:10px;color:rgba(255,255,255,.3);max-width:540px;line-height:1.6}
.source-badge{display:inline-block;margin-top:8px;padding:3px 8px;border-radius:4px;font-size:9px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.4);letter-spacing:1px;text-transform:uppercase}
@media(max-width:640px){
.header,.hero,.footer,.container{padding-left:20px;padding-right:20px}
.hero-ticker{font-size:36px}
.price-main{font-size:28px}
}
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="logo-wrap">
    <div class="logo-box">F</div>
    <div>
      <span class="logo-name">FACTOR</span><span class="logo-sub">OTC</span>
      <div style="font-family:Arial,sans-serif;font-size:9px;color:rgba(255,255,255,.25);letter-spacing:1px;margin-top:2px">INFORME BURSÀTIL PROFESSIONAL</div>
    </div>
  </div>
  <div class="header-meta">
    <div class="header-date">${d.generatedAt}</div>
    <div class="header-type">Anàlisi fonamental &amp; tècnica</div>
  </div>
</div>

<!-- Hero -->
<div class="hero">
  <div class="container" style="padding:0">
    <div class="hero-top">
      <div>
        <div class="hero-ticker">${d.ticker}</div>
        <div class="hero-name">${d.name || '—'}</div>
        ${d.sector ? `<div class="hero-badge">${d.sector}${d.industry ? ' · ' + d.industry : ''}</div>` : ''}
        ${d.exchange ? `<div style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,.25);margin-top:6px">${d.exchange} · ${d.currency}</div>` : ''}
      </div>
      <div class="price-block">
        <div class="price-main">${fPrice(d.price, cur)}</div>
        <div class="price-change" style="color:${changeColor}">${isUp ? '▲' : '▼'} ${fPct(d.changePercent)}</div>
        <div style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,.25);margin-top:4px">Variació session anterior</div>
      </div>
    </div>
    <div class="stats-grid">${statsCards}</div>
  </div>
</div>

<div class="container">

  <!-- A. Descripció empresa -->
  <div class="section">
    <div class="section-label">Secció A</div>
    <div class="section-title">A què es dedica l'empresa</div>
    <div class="section-text">
      ${d.description
        ? `<p>${d.description.slice(0, 800)}${d.description.length > 800 ? '…' : ''}</p>`
        : `<p>Descripció corporativa no disponible. Pots consultar la pàgina corporativa de l'empresa per obtenir informació detallada sobre el seu model de negoci i activitat principal.</p>`}
      ${d.website ? `<p style="margin-top:12px"><a href="${d.website}" style="font-family:Arial,sans-serif;font-size:12px">${d.website}</a></p>` : ''}
    </div>
  </div>

  <!-- B. Posició competitiva -->
  <div class="section">
    <div class="section-label">Secció B</div>
    <div class="section-title">Posició competitiva</div>
    <div class="section-text">
      <p>${sectorText.competitive}</p>
      ${d.sector ? `<p style="margin-top:12px;font-size:13px;color:rgba(245,245,240,.5);font-family:Arial,sans-serif">Sector: <strong style="color:var(--gold)">${d.sector}</strong>${d.industry ? ' · ' + d.industry : ''}${d.country ? ' · ' + d.country : ''}</p>` : ''}
    </div>
  </div>

  <!-- C. Potencial sector -->
  <div class="section">
    <div class="section-label">Secció C</div>
    <div class="section-title">Potencial del sector</div>
    <div class="section-text">
      <p>${sectorText.potential}</p>
    </div>
  </div>

  <!-- D. Dades fonamentals -->
  <div class="section">
    <div class="section-label">Secció D</div>
    <div class="section-title">Dades fonamentals</div>
    <table class="fund-table">
      <tbody>${fundamentalRows}</tbody>
    </table>
    ${(d.lastEarningsDate || d.nextEarningsDate) ? `
    <div class="earnings-row">
      ${d.lastEarningsDate ? `<div class="earnings-card"><div class="earnings-label">Últims resultats</div><div class="earnings-value">${d.lastEarningsDate}</div></div>` : ''}
      ${d.nextEarningsDate ? `<div class="earnings-card"><div class="earnings-label">Propers resultats</div><div class="earnings-value">${d.nextEarningsDate}</div></div>` : ''}
    </div>` : ''}
  </div>

  <!-- E. Anàlisi tècnica -->
  <div class="section">
    <div class="section-label">Secció E</div>
    <div class="section-title">Anàlisi tècnica bàsica</div>
    <ul class="tech-list">${technicalSummary}</ul>
    <p style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,.25);margin-top:16px">
      Per a un anàlisi tècnic complet amb indicadors avançats (RSI, MACD, Bollinger, EMA), utilitza l'eina d'Anàlisi de Mercats de l'aplicació Factor OTC.
    </p>
  </div>

  <!-- F. Gràfic TradingView -->
  <div class="section">
    <div class="section-label">Secció F</div>
    <div class="section-title">Gràfic interactiu (TradingView)</div>
    <div class="chart-wrap">
      <iframe src="${tvUrl}" allowtransparency="true" allow="clipboard-write"></iframe>
    </div>
    <p style="font-family:Arial,sans-serif;font-size:10px;color:rgba(255,255,255,.2);margin-top:8px">
      Gràfic setmanal. Font: TradingView. Requereix connexió a internet.
    </p>
  </div>

</div>

<!-- Footer -->
<div class="footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <div class="name">FACTOR<span class="sub" style="margin-left:6px">OTC</span></div>
      <div style="font-family:Arial,sans-serif;font-size:10px;color:rgba(255,255,255,.3);margin-top:6px">Informe generat: ${d.generatedAt}</div>
      <div class="source-badge">Font: ${d.source === 'yahoo' ? 'Yahoo Finance' : d.source === 'partial' ? 'Yahoo Finance (parcial)' : 'Dades mínimes'} · TradingView</div>
    </div>
    <div class="footer-disclaimer">
      <strong style="color:rgba(255,255,255,.5)">Avís legal:</strong> Aquest informe és una eina de suport a la decisió
      d'inversió amb finalitat orientativa i educativa. No constitueix assessorament financer personalitzat ni
      regulat. Factor OTC no és una entitat financera regulada. Els rendiments passats no garanteixen rendiments
      futurs. Invertir en valors cotitzats comporta risc de pèrdua de capital. Consulta sempre un assessor
      financer autoritzat abans de prendre decisions d'inversió.
    </div>
  </div>
</div>

</body>
</html>`;
}
