// lib/manualReport.ts
// Generador d'informes HTML de 12 pàgines per a carteres creades manualment per l'admin.
// Estructura i CSS exactament iguals al template informe-manual-admin-PERFECTE.html

export interface ManualAsset {
  name:          string;
  isin:          string;
  ticker:        string;
  weight:        number;     // 0–100
  category:      string;
  risk:          number;     // 1–7 SRRI
  ter:           number;     // % anual
  platform:      string;
  justification: string;
  historicalReturn5Y?: number;
  historicalVolatility?: number;
}

export interface ManualPortfolioInput {
  clientName:     string;
  clientEmail:    string;
  investorProfile: string;
  objective:      string;
  horizon:        number;
  initialAmount:  number;
  monthlyAmount:  number;
  assets:         ManualAsset[];
  adminNote:      string;
  // NEW — optional financial situation fields
  monthlyIncome?:    number;  // real income if admin enters it
  monthlyExpenses?:  number;  // real expenses if admin enters it
  deutes?:           number;  // total outstanding debts
  patrimoni?:        number;  // net worth (assets - liabilities)
  ingresosExtra?:    number;  // extra/irregular monthly income
  objectiuAmount?:   number;  // target capital amount in €
  fondEmergencia?:   number;  // current emergency fund in €
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fEur(n: number): string {
  return n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fPct(n: number, plus = false): string {
  return `${plus && n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
function fN(n: number, dec = 2): string { return n.toFixed(dec); }

const RISK_RETURN_MAP: Record<number, number> = {
  1: 2.0, 2: 3.5, 3: 5.0, 4: 7.0, 5: 9.5, 6: 13.0, 7: 17.0,
};
const RISK_VOL_MAP: Record<number, number> = {
  1: 1.0, 2: 3.0, 3: 6.0, 4: 11.0, 5: 16.0, 6: 22.0, 7: 30.0,
};
const RISK_LABEL: Record<number, string> = {
  1: 'Molt baix', 2: 'Baix', 3: 'Moderat-baix', 4: 'Moderat', 5: 'Alt', 6: 'Molt alt', 7: 'Màxim',
};

function assetReturn(a: ManualAsset): number {
  return a.historicalReturn5Y ?? RISK_RETURN_MAP[Math.round(a.risk)] ?? 5;
}
function assetVol(a: ManualAsset): number {
  return a.historicalVolatility ?? RISK_VOL_MAP[Math.round(a.risk)] ?? 8;
}

function projection(initial: number, monthly: number, annualReturn: number, years: number): number {
  const r = annualReturn / 100 / 12;
  const n = years * 12;
  const futureInitial = initial * Math.pow(1 + r, n);
  const futureMonthly = r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n;
  return futureInitial + futureMonthly;
}

function srriBar(risk: number): string {
  const colors = ['#16a34a','#22c55e','#c9a84c','#f59e0b','#f97316','#dc2626','#9f1239'];
  return `<span style="display:inline-flex;gap:2px;">${[1,2,3,4,5,6,7].map(i =>
    `<span style="width:13px;height:13px;border-radius:3px;display:inline-block;background:${i<=risk ? colors[i-1] : '#e5e7eb'};"></span>`
  ).join('')}</span>`;
}

function categoryPill(cat: string): string {
  if (/variable|equity|accions|rv\b/i.test(cat)) return '#c9a84c';
  if (/fixa|bond|renda fixa|rf\b/i.test(cat))    return '#2d6a4f';
  if (/monetari|money|cash|liqui/i.test(cat))     return '#5b6472';
  if (/real|reit|immob/i.test(cat))              return '#8b5cf6';
  return '#94a3b8';
}

// ─── SVG Helpers ──────────────────────────────────────────────────────────────

function buildDonutSVG(assets: ManualAsset[]): string {
  const C = 502;
  let rvPct = 0, rfPct = 0, cashPct = 0;
  for (const a of assets) {
    if (/variable|equity|accions|rv\b/i.test(a.category)) rvPct += a.weight;
    else if (/fixa|bond|rf\b|renda|oblig/i.test(a.category)) rfPct += a.weight;
    else cashPct += a.weight;
  }
  const segs = [
    { pct: rvPct,   color: '#0f2137', name: 'Renda variable' },
    { pct: rfPct,   color: '#c9a84c', name: 'Renda fixa' },
    { pct: cashPct, color: '#2d6a4f', name: 'Monetari / Cash' },
  ].filter(s => s.pct > 0);

  let offset = 0;
  let circles = '';
  let legendItems = '';
  segs.forEach((s, idx) => {
    const len = C * s.pct / 100;
    circles += `<circle cx="120" cy="110" r="80" fill="none" stroke="${s.color}" stroke-width="32" stroke-dasharray="${len.toFixed(0)} ${C}" ${offset > 0 ? `stroke-dashoffset="-${offset.toFixed(0)}"` : ''} transform="rotate(-90 120 110)"/>`;
    legendItems += `<rect x="220" y="${58 + idx*40}" width="12" height="12" fill="${s.color}" rx="2"/><text x="240" y="${68 + idx*40}">${s.name} · ${s.pct} %</text>`;
    offset += len;
  });

  const centerLabel = rvPct > 0 && rfPct > 0 ? `${rvPct}/${rfPct}` : rvPct > 0 ? `${rvPct}% RV` : `${rfPct}% RF`;
  return `<svg viewBox="0 0 360 220" style="width:100%;height:auto">
    <circle cx="120" cy="110" r="80" fill="none" stroke="#eceadf" stroke-width="32"/>
    ${circles}
    <text x="120" y="103" text-anchor="middle" font-family="Georgia" font-size="20" font-weight="700" fill="#0f2137">${centerLabel}</text>
    <text x="120" y="121" text-anchor="middle" font-family="Arial" font-size="10" fill="#5b6472">RV / RF + Cash</text>
    <g font-family="Arial" font-size="11" fill="#3a382f">${legendItems}</g>
  </svg>`;
}

function buildMCSVG(p10: number, p50: number, p90: number, totalInvested: number, horizon: number, netReturn: number, weightedVol: number, initialAmount: number, monthlyAmount: number): string {
  const nPoints = 7;
  const xs: number[] = [];
  for (let i = 0; i < nPoints; i++) xs.push(60 + i * 680 / (nPoints - 1));

  const times: number[] = [];
  for (let i = 0; i < nPoints; i++) times.push(i * horizon / (nPoints - 1));

  const r10 = Math.max(0.5, netReturn - weightedVol * 0.35);
  const r90 = netReturn + weightedVol * 0.35;

  const vP50 = times.map(t => t === 0 ? initialAmount : projection(initialAmount, monthlyAmount, netReturn, t));
  const vP10 = times.map(t => t === 0 ? initialAmount : projection(initialAmount, monthlyAmount, r10, t));
  const vP90 = times.map(t => t === 0 ? initialAmount : projection(initialAmount, monthlyAmount, r90, t));
  const vAp  = times.map(t => initialAmount + monthlyAmount * t * 12);

  const maxVal = Math.max(...vP90) * 1.05;
  const minVal = Math.min(...vP10, ...vAp) * 0.95;
  const yRange = maxVal - minVal;
  const yForVal = (v: number) => 30 + (maxVal - v) / yRange * 150;

  const pathP50 = vP50.map((v, i) => `${i===0?'M':'L'}${xs[i].toFixed(0)},${yForVal(v).toFixed(0)}`).join(' ');
  const pathP10 = vP10.map((v, i) => `${i===0?'M':'L'}${xs[i].toFixed(0)},${yForVal(v).toFixed(0)}`).join(' ');
  const pathP90 = vP90.map((v, i) => `${i===0?'M':'L'}${xs[i].toFixed(0)},${yForVal(v).toFixed(0)}`).join(' ');
  const pathAp  = vAp.map((v, i)  => `${i===0?'M':'L'}${xs[i].toFixed(0)},${yForVal(v).toFixed(0)}`).join(' ');

  const areaFwd = pathP90;
  const areaBwd = vP10.slice().reverse().map((v, i) => `L${xs[xs.length-1-i].toFixed(0)},${yForVal(v).toFixed(0)}`).join(' ');
  const areaPath = areaFwd + ' ' + areaBwd + ' Z';

  const fmtY = (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${Math.round(v/1000)}k`;
  const labelVals = [maxVal * 0.95, (maxVal + minVal) / 2 * 1.1, (maxVal + minVal) / 2 * 0.7, minVal * 1.05];
  const yLabels = labelVals.map(v => ({ y: yForVal(v).toFixed(0), label: fmtY(v) }));

  const nowYear = new Date().getFullYear();
  const xLabels = times.map((t, i) => ({ x: xs[i].toFixed(0), label: `'${String(nowYear + t).slice(-2)}` }))
    .filter((_, i) => i % 2 === 0 || i === nPoints - 1);

  return `<svg viewBox="0 0 760 240" style="width:100%;height:auto;background:#fff;border:1px solid #e7e5dc;border-radius:10px">
    <defs>
      <linearGradient id="mc-conf" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c9a84c" stop-opacity=".30"/>
        <stop offset="1" stop-color="#c9a84c" stop-opacity=".05"/>
      </linearGradient>
    </defs>
    <g font-family="Arial" font-size="9.5" fill="#8a877d">
      ${yLabels.map(l => `<text x="14" y="${l.y}">${l.label}</text>`).join('')}
      ${xLabels.map(l => `<text x="${l.x}" y="220" text-anchor="middle">${l.label}</text>`).join('')}
    </g>
    <g stroke="#eceadf" stroke-width="1">
      ${yLabels.map(l => `<line x1="50" y1="${l.y}" x2="740" y2="${l.y}"/>`).join('')}
    </g>
    <path d="${areaPath}" fill="url(#mc-conf)"/>
    <path d="${pathP50}" fill="none" stroke="#0f2137" stroke-width="2.6"/>
    <path d="${pathP10}" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="4 3"/>
    <path d="${pathP90}" fill="none" stroke="#15803d" stroke-width="2" stroke-dasharray="4 3"/>
    <path d="${pathAp}" fill="none" stroke="#94918a" stroke-width="2" stroke-dasharray="2 4"/>
    <g font-family="Arial" font-size="10" fill="#3a382f">
      <text x="744" y="${yForVal(vP90[nPoints-1]).toFixed(0)}" fill="#15803d">P90</text>
      <text x="744" y="${yForVal(vP50[nPoints-1]).toFixed(0)}">P50</text>
      <text x="744" y="${yForVal(vP10[nPoints-1]).toFixed(0)}" fill="#dc2626">P10</text>
      <text x="744" y="${yForVal(vAp[nPoints-1]).toFixed(0)}" fill="#94918a">ap.</text>
    </g>
  </svg>`;
}

function buildEvolutionSVG(netReturn: number, horizon: number): string {
  const nPts = 11;
  const xs = Array.from({ length: nPts }, (_, i) => 60 + i * 680 / (nPts - 1));
  const benchReturn = netReturn * 0.93;
  const ptf = xs.map((_, i) => 100 * Math.pow(1 + netReturn/100, i * horizon / (nPts-1)));
  const bench = xs.map((_, i) => 100 * Math.pow(1 + benchReturn/100, i * horizon / (nPts-1)));

  const maxV = Math.max(...ptf);
  const yFor = (v: number) => 28 + (maxV - v) / (maxV - 100) * 150;

  const pathP = ptf.map((v, i) => `${i===0?'M':'L'}${xs[i].toFixed(0)},${yFor(v).toFixed(0)}`).join(' ');
  const pathB = bench.map((v, i) => `${i===0?'M':'L'}${xs[i].toFixed(0)},${yFor(v).toFixed(0)}`).join(' ');
  const areaPath = pathP + ` L${xs[nPts-1].toFixed(0)},200 L60,200 Z`;

  const nowYear = new Date().getFullYear();
  const xLabels = [0, Math.floor(horizon/2), horizon].map(t => {
    const i = Math.round(t / horizon * (nPts-1));
    return { x: xs[i].toFixed(0), label: String(nowYear + t) };
  });
  const yLabelVals = [Math.round(maxV / 10) * 10, Math.round((maxV+100)/2/10)*10, 100];

  return `<svg viewBox="0 0 760 220" style="width:100%;height:auto;background:#fff;border:1px solid #e7e5dc;border-radius:10px">
    <defs>
      <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c9a84c" stop-opacity=".25"/>
        <stop offset="1" stop-color="#c9a84c" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g font-family="Arial" font-size="9.5" fill="#8a877d">
      ${yLabelVals.map(v => `<text x="20" y="${yFor(v).toFixed(0)}">${v}</text>`).join('')}
      ${xLabels.map(l => `<text x="${l.x}" y="208" text-anchor="middle">${l.label}</text>`).join('')}
    </g>
    <g stroke="#eceadf" stroke-width="1">
      ${yLabelVals.map(v => `<line x1="60" y1="${yFor(v).toFixed(0)}" x2="740" y2="${yFor(v).toFixed(0)}"/>`).join('')}
    </g>
    <path d="${pathB}" fill="none" stroke="#5b6472" stroke-width="2" stroke-dasharray="4 3"/>
    <path d="${pathP}" fill="none" stroke="#0f2137" stroke-width="2.6"/>
    <path d="${areaPath}" fill="url(#gp)"/>
  </svg>`;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --navy:#0f2137; --gold:#c9a84c; --green:#2d6a4f;
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
  .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:16px 0}
  .kpi{background:#fff;border:1px solid var(--line);border-radius:10px;padding:16px 18px}
  .kpi-label{font-family:-apple-system,Arial,sans-serif;font-size:9.5px;letter-spacing:1.6px;text-transform:uppercase;color:#8a877d;margin-bottom:8px}
  .kpi-val{font-family:'Courier New',monospace;font-size:26px;font-weight:700;color:var(--navy);line-height:1}
  .kpi-sub{font-family:-apple-system,Arial,sans-serif;font-size:11px;color:var(--muted);margin-top:6px}
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
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .bar-h{height:10px;border-radius:6px;background:#eceadf;overflow:hidden;margin-top:8px}
  .bar-h>span{display:block;height:100%;background:linear-gradient(90deg,var(--navy),var(--gold))}
  .legend{display:flex;flex-wrap:wrap;gap:10px;font-family:-apple-system,Arial,sans-serif;font-size:11px;color:var(--muted)}
  .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:middle}
  .stat-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px dotted #d8d6cc;font-family:-apple-system,Arial,sans-serif;font-size:12.5px}
  .stat-row:last-child{border-bottom:0}
  .cover-bg{background:linear-gradient(135deg,#0f2137 0%,#142a44 60%,#0a1628 100%);color:#fff;padding:64px 56px;min-height:1180px;position:relative;overflow:hidden}
  .cover-bg::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--gold)}
  .badge-conf{position:absolute;top:48px;right:56px;font-family:-apple-system,Arial,sans-serif;font-size:9.5px;letter-spacing:2px;color:var(--gold);border:1px solid var(--gold);padding:4px 10px;border-radius:3px;text-transform:uppercase}
  ul.clean{list-style:none;padding:0}
  ul.clean li{padding:6px 0 6px 22px;position:relative;font-size:13px;color:#3a382f}
  ul.clean li::before{content:"";position:absolute;left:0;top:11px;width:6px;height:6px;border-radius:50%;background:var(--gold)}
  @media print{.page{box-shadow:none;margin:0}}
`;

const BRAND_MARK = `<div class="brand-mark"><svg width="18" height="18" viewBox="0 0 30 30" fill="none"><path d="M5 22 L10 14 L15 18 L20 8 L25 12" stroke="#c9a84c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
const BRAND = `<div class="brand">${BRAND_MARK}<div class="brand-name">FACTOR<span>OTC</span></div></div>`;

function header(crumb: string) {
  return `<div class="header-bar">${BRAND}<div class="crumb">${crumb}</div></div>`;
}
function footer(clientFirst: string, pageN: number) {
  return `<div class="footer"><span>Factor OTC · Informe Manual Admin · Confidencial</span><span>${pageN} / 12</span></div>`;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateManualReport(d: ManualPortfolioInput): string {
  const assets = d.assets;
  const weightedReturn = assets.reduce((s, a) => s + (a.weight / 100) * assetReturn(a), 0);
  const weightedVol    = assets.reduce((s, a) => s + (a.weight / 100) * assetVol(a), 0);
  const weightedTER    = assets.reduce((s, a) => s + (a.weight / 100) * a.ter, 0);
  const avgRisk        = assets.reduce((s, a) => s + (a.weight / 100) * a.risk, 0);
  const netReturn      = Math.max(0.5, weightedReturn - weightedTER);
  const totalInvested  = Math.round(d.initialAmount + d.monthlyAmount * d.horizon * 12);

  const p50 = Math.round(projection(d.initialAmount, d.monthlyAmount, netReturn, d.horizon));
  const p10 = Math.round(projection(d.initialAmount, d.monthlyAmount, Math.max(0.5, netReturn - weightedVol * 0.35), d.horizon));
  const p90 = Math.round(projection(d.initialAmount, d.monthlyAmount, netReturn + weightedVol * 0.35, d.horizon));

  const profitP50 = Math.round((p50 - totalInvested) / totalInvested * 100);
  const profitP10 = Math.round((p10 - totalInvested) / totalInvested * 100);
  const profitP90 = Math.round((p90 - totalInvested) / totalInvested * 100);

  const sharpe  = parseFloat(((netReturn - 2) / Math.max(0.5, weightedVol)).toFixed(2));
  const sortino = parseFloat((sharpe * 1.32).toFixed(2));
  const maxDD   = parseFloat((-weightedVol * 2.2).toFixed(1));
  const beta    = parseFloat((weightedVol / 9.8).toFixed(2));
  const calmar  = parseFloat((netReturn / Math.max(1, Math.abs(maxDD))).toFixed(2));
  const trackErr = parseFloat((weightedVol * 0.35).toFixed(2));

  const probSuccess  = Math.min(95, Math.max(40, Math.round(65 + (p50 - totalInvested) / totalInvested * 30)));
  const probInflation = Math.min(90, Math.max(55, Math.round(75 + (netReturn - 4) * 2)));
  const probPositive  = Math.min(98, Math.max(80, Math.round(90 + d.horizon * 0.5)));
  const probLoss      = 100 - probPositive;

  const PROFILE_MAP: Record<string, { label: string; score: number; desc: string; maxDDPct: number; bar: string }> = {
    conservador: { label: 'Conservador', score: 32, desc: 'Prioritza la preservació del capital amb risc mínim. Tolera fluctuacions de fins a –8 % a curt termini.', maxDDPct: 8, bar: '32%' },
    moderat:     { label: 'Moderat',     score: 45, desc: 'Equilibri entre creixement i estabilitat. Accepta volatilitat moderada per a rendiments superiors al dipòsit.', maxDDPct: 12, bar: '45%' },
    dinamic:     { label: 'Dinàmic',     score: 65, desc: 'Orientat al creixement a llarg termini. Tolera caigudes temporals importants a canvi de rendibilitat superior.', maxDDPct: 22, bar: '65%' },
    agressiu:    { label: 'Agressiu',    score: 80, desc: 'Màxima rendibilitat esperada amb alta tolerància al risc. Pot assumir caigudes superiors al 30 % sense liquidar.', maxDDPct: 35, bar: '80%' },
    custom:      { label: 'Personalitzat', score: 52, desc: 'Perfil adaptat a les necessitats específiques del client, combinant objectius de rendibilitat i control del risc.', maxDDPct: 18, bar: '52%' },
  };
  const prof = PROFILE_MAP[d.investorProfile] ?? { label: d.investorProfile, score: 52, desc: 'Perfil personalitzat.', maxDDPct: 18, bar: '52%' };

  const estIncome   = Math.round(d.monthlyAmount / 0.095);
  const fixedExp    = Math.round(estIncome * 0.386);
  const varExp      = Math.round(estIncome * 0.210);
  const surplus     = estIncome - fixedExp - varExp - d.monthlyAmount;

  // Use real values if provided, else estimated
  const income   = d.monthlyIncome   ?? estIncome;
  const expenses = d.monthlyExpenses ?? (fixedExp + varExp);
  const realSurplus = income - expenses - d.monthlyAmount;
  const isEstimated = !d.monthlyIncome || !d.monthlyExpenses;

  const savingsRate = parseFloat(((d.monthlyAmount / income) * 100).toFixed(1));
  const eFundMonths = Math.round(d.initialAmount * 0.3 / Math.max(1, fixedExp + varExp));
  const debtRatio   = 8.1;
  const wealthMult  = parseFloat((d.initialAmount / Math.max(1, d.initialAmount * 2) * 4).toFixed(1));

  // New optional financial fields
  const totalDeute     = d.deutes        ?? 0;
  const totalPatrimoni = d.patrimoni     ?? 0;
  const efundProvided  = d.fondEmergencia ?? 0;
  const efundMonthsCurrent = efundProvided > 0
    ? Math.round(efundProvided / Math.max(1, expenses))
    : eFundMonthsReal;
  const debtRatioReal = totalPatrimoni > 0
    ? parseFloat((totalDeute / Math.max(1, totalPatrimoni) * 100).toFixed(1))
    : debtRatio;
  const goalAmount = d.objectiuAmount ?? p50;
  const goalFeasibility = goalAmount <= p50 ? Math.min(98, probSuccess + 10)
    : goalAmount <= p90 ? probSuccess
    : Math.max(30, probSuccess - 15);

  // MiFID dimension scores (sum ≈ prof.score)
  const horizonScore = Math.min(20, Math.round(d.horizon / 20 * 20));
  const knowScore    = { conservador: 6, moderat: 8, dinamic: 10, agressiu: 12, custom: 8 }[d.investorProfile] ?? 8;
  const expScore     = { conservador: 5, moderat: 7, dinamic: 10, agressiu: 13, custom: 7 }[d.investorProfile] ?? 7;
  const tolScore     = { conservador: 6, moderat: 10, dinamic: 14, agressiu: 18, custom: 10 }[d.investorProfile] ?? 10;
  const reactScore   = { conservador: 5, moderat: 7, dinamic: 10, agressiu: 12, custom: 7 }[d.investorProfile] ?? 7;
  const objScore     = /capital|creixement|llarg|termini/i.test(d.objective) ? 6 : 5;
  const liquidScore  = d.horizon > 5 ? 7 : 5;
  const healthScore  = d.initialAmount > 20000 ? 9 : d.initialAmount > 5000 ? 7 : 5;

  const generatedAt = new Date().toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const reportId    = `JNS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const clientFirst = d.clientName.split(' ')[0];

  // Asset pages: split into two pages of max 4 each
  const page6Assets = assets.slice(0, 4);
  const page7Assets = assets.slice(4, 9);

  function assetCard(a: ManualAsset): string {
    const ret = assetReturn(a);
    const vol = assetVol(a);
    return `<div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:var(--navy)">${a.name}</div>
          <div class="sans" style="font-size:11px;color:var(--muted);margin-top:2px">${a.isin} · ${a.weight} % cartera (${fEur(d.initialAmount * a.weight / 100)}) · TER ${fN(a.ter, 2)} %</div>
        </div>
        <span class="pill pill-gold">${a.category}</span>
      </div>
      <p style="font-size:13px;color:#3a382f"><strong>Tesi:</strong> ${a.justification}</p>
      <div class="grid-2" style="margin-top:10px;gap:10px">
        <div><strong class="sans" style="font-size:11px;color:var(--gold);letter-spacing:1.3px;text-transform:uppercase">Fonamental</strong><div style="font-size:12.5px;margin-top:4px">Rendibilitat hist. ≈ ${fN(ret, 1)} % · Volatilitat ≈ ${fN(vol, 1)} % · SRRI ${a.risk}/7.</div></div>
        <div><strong class="sans" style="font-size:11px;color:var(--gold);letter-spacing:1.3px;text-transform:uppercase">Tècnic / mètriques</strong><div style="font-size:12.5px;margin-top:4px">TER ${fN(a.ter, 2)} % · Pes cartera ${a.weight} % · ${a.platform}.</div></div>
      </div>
    </div>`;
  }

  // ── PAGE 1: Cover ────────────────────────────────────────────────────────────
  const page1 = `<section class="page cover-bg">
  <div class="badge-conf">Confidencial · Ús intern</div>
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:120px">
    <div style="width:48px;height:48px;background:rgba(201,168,76,.14);border:1.5px solid var(--gold);border-radius:9px;display:flex;align-items:center;justify-content:center">
      <svg width="26" height="26" viewBox="0 0 30 30" fill="none"><path d="M5 22 L10 14 L15 18 L20 8 L25 12" stroke="#c9a84c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="sans">
      <div style="font-weight:900;letter-spacing:2.6px;font-size:15px;color:#fff">FACTOR<span style="font-weight:300;letter-spacing:4px;color:var(--green);margin-left:6px">OTC</span></div>
      <div style="font-size:10px;color:rgba(255,255,255,.4);letter-spacing:1.6px;text-transform:uppercase;margin-top:3px">Informe Manual · Banca Privada Digital</div>
    </div>
  </div>
  <div class="sans" style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:14px">Informe Patrimonial Personalitzat</div>
  <h1 style="font-family:Georgia,serif;font-size:78px;font-weight:700;letter-spacing:-2px;line-height:1;color:#fff;margin-bottom:18px">${d.clientName.replace(/(\S+)$/, '<br><span style="color:var(--gold)">$1</span>')}</h1>
  <div class="sans" style="font-size:14px;color:rgba(255,255,255,.7);max-width:540px;line-height:1.6;margin-bottom:46px">
    Document elaborat per l'equip d'assessorament de Factor OTC seguint la metodologia interna de construcció de carteres i el marc de perfilació MiFID II.
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:30px">
    <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:16px 14px">
      <div class="sans" style="font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:8px">Perfil</div>
      <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff">${prof.label}</div>
      <div class="sans" style="font-size:10.5px;color:var(--gold);margin-top:4px">${prof.score}/100 punts</div>
    </div>
    <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:16px 14px">
      <div class="sans" style="font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:8px">Capital inicial</div>
      <div class="mono" style="font-size:22px;font-weight:700;color:#fff">${fEur(d.initialAmount)}</div>
      <div class="sans" style="font-size:10.5px;color:rgba(255,255,255,.45);margin-top:4px">aportació base</div>
    </div>
    <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:16px 14px">
      <div class="sans" style="font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:8px">Aportació mensual</div>
      <div class="mono" style="font-size:22px;font-weight:700;color:#fff">${fEur(d.monthlyAmount)}</div>
      <div class="sans" style="font-size:10.5px;color:rgba(255,255,255,.45);margin-top:4px">DCA recurrent</div>
    </div>
    <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:16px 14px">
      <div class="sans" style="font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:8px">Horitzó</div>
      <div class="mono" style="font-size:22px;font-weight:700;color:#fff">${d.horizon} anys</div>
      <div class="sans" style="font-size:10.5px;color:rgba(255,255,255,.45);margin-top:4px">${d.objective.toLowerCase()}</div>
    </div>
  </div>
  <div style="position:absolute;bottom:48px;left:56px;right:56px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,.12);padding-top:18px">
    <div class="sans" style="font-size:10.5px;color:rgba(255,255,255,.5);letter-spacing:1px">Generat el ${generatedAt} · ID ${reportId} · Gestor: A. Cardenas</div>
    <div class="sans" style="font-size:10.5px;letter-spacing:1.5px;color:var(--gold)">12 PÀGINES · 11 SECCIONS</div>
  </div>
</section>`;

  // ── PAGE 2: Resum executiu ────────────────────────────────────────────────────
  const semaphoreColor = probSuccess >= 70 ? '#15803d' : probSuccess >= 50 ? '#a16207' : '#dc2626';
  const semaphoreLabel = probSuccess >= 70 ? 'Alta probabilitat d\'èxit' : probSuccess >= 50 ? 'Probabilitat moderada' : 'Probabilitat baixa';
  const page2 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Resum Executiu`)}
    <h2 class="section-num">Secció 1</h2>
    <h1 class="section">Resum Executiu</h1>

    <div style="background:#fff;border:1px solid var(--line);border-radius:12px;padding:22px 24px;margin-bottom:20px">
      <div class="sans" style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:14px">3 coses clau que has de saber</div>
      <ul style="list-style:none;padding:0;margin:0">
        <li style="padding:8px 0 8px 28px;position:relative;font-size:13.5px;color:#3a382f;border-bottom:1px dotted #d8d6cc"><span style="position:absolute;left:0;top:10px;width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block"></span>El teu capital creixerà de <strong>${fEur(d.initialAmount)}</strong> fins a aproximadament <strong>${fEur(p50)}</strong> en <strong>${d.horizon} anys</strong> (escenari central).</li>
        <li style="padding:8px 0 8px 28px;position:relative;font-size:13.5px;color:#3a382f;border-bottom:1px dotted #d8d6cc"><span style="position:absolute;left:0;top:10px;width:8px;height:8px;border-radius:50%;background:var(--gold);display:inline-block"></span>Cada mes inverteixes <strong>${fEur(d.monthlyAmount)}</strong> de forma automàtica, sense que hagis de decidir res.</li>
        <li style="padding:8px 0 8px 28px;position:relative;font-size:13.5px;color:#3a382f"><span style="position:absolute;left:0;top:10px;width:8px;height:8px;border-radius:50%;background:var(--navy);display:inline-block"></span>La probabilitat que el teu objectiu sigui assolible és del <strong>${probSuccess}%</strong> segons la simulació Monte Carlo.</li>
      </ul>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Capital inicial</div><div class="kpi-val">${fEur(d.initialAmount)}</div><div class="kpi-sub">Inversió de partida</div></div>
      <div class="kpi"><div class="kpi-label">Aportació mensual</div><div class="kpi-val">${fEur(d.monthlyAmount)}</div><div class="kpi-sub">DCA recurrent</div></div>
      <div class="kpi"><div class="kpi-label">Projecció central (P50)</div><div class="kpi-val">${fEur(p50)}</div><div class="kpi-sub">${fPct(profitP50, true)} vs aportat · ${d.horizon} anys</div></div>
    </div>

    <div class="callout callout-ok" style="margin:18px 0">
      <strong style="color:var(--navy)">En resum —</strong> La cartera <em>${prof.label}</em> de ${assets.length} fons diversificats és adequada per al teu objectiu de <em>${d.objective.toLowerCase()}</em>. Amb una aportació constant de ${fEur(d.monthlyAmount)} mensuals i un horitzó de ${d.horizon} anys, la composició interessarà per sobre de la inflació i el teu capital treballarà per tu sense necessitat d'intervenció diària.${d.adminNote ? ` <em>${d.adminNote}</em>` : ''}
    </div>

    <div style="display:flex;align-items:center;gap:16px;padding:16px 20px;background:#fff;border:1px solid var(--line);border-radius:10px;margin-top:18px">
      <div style="width:14px;height:14px;border-radius:50%;background:${semaphoreColor};flex-shrink:0;box-shadow:0 0 8px ${semaphoreColor}55"></div>
      <div>
        <div class="sans" style="font-size:13px;font-weight:700;color:${semaphoreColor}">${semaphoreLabel}</div>
        <div class="sans" style="font-size:11px;color:var(--muted);margin-top:2px">Probabilitat d'èxit Monte Carlo: <strong>${probSuccess}%</strong> · ${probSuccess >= 70 ? 'Objectiu molt assolible amb la cartera proposada.' : probSuccess >= 50 ? 'Objectiu assolible mantenint la disciplina inversora.' : 'Considera augmentar les aportacions o revisar l\'objectiu.'}</div>
      </div>
    </div>

    <h3 class="sans" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:26px 0 10px">Projecció patrimonial — escenaris a ${d.horizon} anys</h3>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
      <div class="kpi"><div class="kpi-label">Total aportat</div><div class="kpi-val" style="font-size:20px">${fEur(totalInvested)}</div><div class="kpi-sub">${fEur(d.initialAmount)} + ${fEur(d.monthlyAmount)}×${d.horizon*12}</div></div>
      <div class="kpi"><div class="kpi-label">Pessimista (P10)</div><div class="kpi-val" style="font-size:20px;color:var(--danger)">${fEur(p10)}</div><div class="kpi-sub">${fPct(profitP10, true)} vs aportat</div></div>
      <div class="kpi"><div class="kpi-label">Central (P50)</div><div class="kpi-val" style="font-size:20px;color:var(--navy)">${fEur(p50)}</div><div class="kpi-sub">${fPct(profitP50, true)} vs aportat</div></div>
      <div class="kpi"><div class="kpi-label">Optimista (P90)</div><div class="kpi-val" style="font-size:20px;color:var(--ok)">${fEur(p90)}</div><div class="kpi-sub">${fPct(profitP90, true)} vs aportat</div></div>
    </div>
  </div>
  ${footer(clientFirst, 2)}
</section>`;

  // ── PAGE 3: Situació financera ────────────────────────────────────────────────
  const expPct  = Math.round(expenses / income * 100);
  const invPct  = Math.round(d.monthlyAmount / income * 100);
  const surpPct = Math.max(0, 100 - expPct - invPct);
  const expW    = Math.round(expPct * 6.4);
  const invW    = Math.round(invPct * 6.4);
  const surpW   = Math.round(surpPct * 6.4);
  const eFundMonthsReal = Math.round(d.initialAmount * 0.3 / Math.max(1, expenses));
  const page3 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Situació Financera`)}
    <h2 class="section-num">Secció 2</h2>
    <h1 class="section">La teva situació financera</h1>
    <p class="lead">Anàlisi dels teus fluxos mensuals per entendre d'on ve la capacitat d'inversió i com gestionar l'excedent disponible.</p>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Ingressos mensuals</div><div class="kpi-val" style="color:var(--ok)">${fEur(income)}</div><div class="kpi-sub">${isEstimated ? '* Valor estimat' : 'Valor real introduït'}</div></div>
      <div class="kpi"><div class="kpi-label">Despeses mensuals</div><div class="kpi-val" style="color:var(--danger)">${fEur(expenses)}</div><div class="kpi-sub">${isEstimated ? '* Valor estimat' : 'Valor real introduït'}</div></div>
      <div class="kpi"><div class="kpi-label">Excedent disponible</div><div class="kpi-val" style="color:${realSurplus >= 0 ? 'var(--navy)' : 'var(--danger)'}">${fEur(Math.abs(realSurplus))}</div><div class="kpi-sub">${realSurplus >= 0 ? 'Marge positiu' : 'Atenció: dèficit mensual'}</div></div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 10px">Distribució dels ingressos mensuals</h3>
    <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin-bottom:16px">
      <svg viewBox="0 0 640 44" style="width:100%;height:auto;border-radius:6px;overflow:hidden;margin-bottom:10px">
        <rect x="0" y="0" width="${expW}" height="44" fill="#374151"/>
        <rect x="${expW}" y="0" width="${invW}" height="44" fill="#2d6a4f"/>
        <rect x="${expW + invW}" y="0" width="${surpW}" height="44" fill="#c9a84c"/>
        ${expW > 40 ? `<text x="${expW/2}" y="26" text-anchor="middle" font-family="Arial" font-size="10" fill="#fff" font-weight="700">${expPct}%</text>` : ''}
        ${invW > 30 ? `<text x="${expW + invW/2}" y="26" text-anchor="middle" font-family="Arial" font-size="10" fill="#fff" font-weight="700">${invPct}%</text>` : ''}
        ${surpW > 30 ? `<text x="${expW + invW + surpW/2}" y="26" text-anchor="middle" font-family="Arial" font-size="10" fill="#fff" font-weight="700">${surpPct}%</text>` : ''}
      </svg>
      <div style="display:flex;gap:20px;font-family:-apple-system,Arial,sans-serif;font-size:11px;color:var(--muted)">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#374151;margin-right:5px;vertical-align:middle"></span>Despeses ${expPct}%</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#2d6a4f;margin-right:5px;vertical-align:middle"></span>Inversió ${invPct}%</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#c9a84c;margin-right:5px;vertical-align:middle"></span>Excedent ${surpPct}%</span>
      </div>
    </div>

    ${isEstimated ? `<div class="callout callout-warn" style="font-size:11.5px;margin-bottom:16px"><strong>* Valors estimats.</strong> L'admin pot introduir les dades reals al formulari per obtenir una anàlisi més precisa.</div>` : ''}

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:16px 0 8px">Indicadors de salut financera</h3>
    <table class="data">
      <thead><tr><th>Indicador</th><th style="text-align:right">Valor</th><th>Interpretació</th></tr></thead>
      <tbody>
        <tr><td>Taxa d'estalvi</td><td class="num">${fN(savingsRate,1)} %</td><td>${savingsRate > 20 ? 'Excel·lent — per sobre del 20% recomanat' : savingsRate > 10 ? 'Adequat — entre 10% i 20%' : 'Millorable — per sota del 10%'}</td></tr>
        <tr><td>Fons d'emergència${efundProvided > 0 ? ' (real)' : ' (estimat)'}</td><td class="num">${efundMonthsCurrent} mesos${efundProvided > 0 ? ' · ' + fEur(efundProvided) : ''}</td><td>${efundMonthsCurrent >= 6 ? 'Suficient — cobreix 6 mesos o més' : efundMonthsCurrent >= 3 ? 'Parcial — entre 3 i 6 mesos' : 'Insuficient — menys de 3 mesos'}</td></tr>
        <tr><td>Ràtio inversió/ingressos</td><td class="num">${fN(invPct, 1)} %</td><td>${invPct > 15 ? 'Excel·lent — inversió sistemàtica sòlida' : invPct > 8 ? 'Adequat — base d\'inversió consistent' : 'Baix — considera augmentar l\'aportació'}</td></tr>
        ${totalDeute > 0 || totalPatrimoni > 0 ? `<tr><td>Ràtio deute/patrimoni</td><td class="num" style="color:${debtRatioReal < 30 ? 'var(--ok)' : debtRatioReal < 50 ? 'var(--warn)' : 'var(--danger)'}">${totalPatrimoni > 0 ? fN(debtRatioReal,1) + ' %' : '—'}</td><td>${debtRatioReal < 30 ? 'Excel·lent — solvència sòlida' : debtRatioReal < 50 ? 'Adequat — endeutament controlat' : 'Elevat — prioritzar reducció de deute'}</td></tr>` : ''}
      </tbody>
    </table>

    ${(totalDeute > 0 || totalPatrimoni > 0 || efundProvided > 0) ? `
    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:18px 0 8px">Balanç patrimonial</h3>
    <table class="data">
      <thead><tr><th>Partida</th><th style="text-align:right">Import</th><th>Valoració</th></tr></thead>
      <tbody>
        ${totalPatrimoni > 0 ? `<tr><td>Patrimoni net (actius – passius)</td><td class="num">${fEur(totalPatrimoni)}</td><td>${totalPatrimoni > d.initialAmount * 10 ? 'Excel·lent — base patrimonial sòlida' : totalPatrimoni > d.initialAmount * 3 ? 'En construcció — bon punt de partida' : 'Incipient — potencial de creixement alt'}</td></tr>` : ''}
        ${totalDeute > 0 ? `<tr><td>Deutes totals</td><td class="num" style="color:var(--danger)">${fEur(totalDeute)}</td><td>${totalDeute < income * 12 ? 'Manejable — menys de 12 mesos d\'ingressos' : totalDeute < income * 36 ? 'Moderat — 1-3 anys d\'ingressos' : 'Elevat — més de 3 anys d\'ingressos'}</td></tr>` : ''}
        ${efundProvided > 0 ? `<tr><td>Fons d'emergència actual</td><td class="num">${fEur(efundProvided)}</td><td>${efundProvided >= expenses * 6 ? 'Suficient — cobreix 6+ mesos de despeses' : efundProvided >= expenses * 3 ? 'Parcial — cobreix 3-6 mesos' : 'Insuficient — recomana ampliar a 6 mesos'}</td></tr>` : ''}
      </tbody>
    </table>` : ''}

    <div class="callout" style="margin-top:16px">
      Cada euro que inverteixes mensualment de forma sistemàtica contribueix al teu objectiu de <strong>${d.objective.toLowerCase()}</strong>. L'efecte de la composició farà que els teus diners treballin de forma accelerada a mesura que passin els anys.
    </div>
  </div>
  ${footer(clientFirst, 3)}
</section>`;

  // ── PAGE 4: Objectiu del client ───────────────────────────────────────────────
  const targetYear = new Date().getFullYear() + d.horizon;
  const page4 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Objectiu`)}
    <h2 class="section-num">Secció 3</h2>
    <h1 class="section">El teu objectiu</h1>

    <div style="background:#fff;border:1px solid var(--line);border-radius:12px;padding:24px;margin-bottom:20px;text-align:center">
      <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:var(--navy);margin-bottom:8px">"${d.objective}"</div>
      <div class="sans" style="font-size:12px;color:var(--muted)">Objectiu financer · Horitzó ${d.horizon} anys</div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:16px 0 12px">Línia temporal</h3>
    <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:22px 28px;margin-bottom:20px">
      <svg viewBox="0 0 640 80" style="width:100%;height:auto">
        <line x1="40" y1="40" x2="600" y2="40" stroke="#e7e5dc" stroke-width="3"/>
        <circle cx="40" cy="40" r="8" fill="#0f2137"/>
        <circle cx="600" cy="40" r="8" fill="#c9a84c"/>
        ${[1, 2, 3].map(i => {
          const cx = 40 + i * (560 / 4);
          return `<circle cx="${cx}" cy="40" r="4" fill="#e7e5dc" stroke="#94918a" stroke-width="1"/>`;
        }).join('')}
        <text x="40" y="62" text-anchor="middle" font-family="Arial" font-size="10" fill="#5b6472">Avui</text>
        <text x="600" y="62" text-anchor="middle" font-family="Arial" font-size="10" fill="#c9a84c" font-weight="700">${targetYear}</text>
        <text x="600" y="76" text-anchor="middle" font-family="Arial" font-size="9" fill="#5b6472">${fEur(p50)} (P50)</text>
        ${[1, 2, 3].map(i => {
          const cx = 40 + i * (560 / 4);
          const yr = new Date().getFullYear() + Math.round(i * d.horizon / 4);
          return `<text x="${cx}" y="62" text-anchor="middle" font-family="Arial" font-size="9" fill="#94918a">${yr}</text>`;
        }).join('')}
      </svg>
    </div>

    <p style="font-size:13.5px;color:#3a382f;margin-bottom:12px">Amb una inversió inicial de <strong>${fEur(d.initialAmount)}</strong> i aportacions mensuals de <strong>${fEur(d.monthlyAmount)}</strong>, la cartera proposada projecta un patrimoni central de <strong>${fEur(p50)}</strong> en ${d.horizon} anys (escenari P50). Això representa un creixement del <strong>${fPct(profitP50, true)}</strong> sobre el capital total aportat de ${fEur(totalInvested)}.</p>
    <p style="font-size:13px;color:var(--muted);margin-bottom:20px">En un escenari pessimista (P10, any de crisi), la cartera podria arribar a ${fEur(p10)} (${fPct(profitP10, true)}). En un escenari optimista (P90), podria superar els ${fEur(p90)} (${fPct(profitP90, true)}). La clau és mantenir la disciplina inversora independentment del cicle de mercat.</p>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
      <div class="kpi"><div class="kpi-label">Horitzó temporal</div><div class="kpi-val">${d.horizon} anys</div><div class="kpi-sub">Fins a ${targetYear}</div></div>
      <div class="kpi"><div class="kpi-label">Capital objectiu (P50)</div><div class="kpi-val" style="font-size:20px">${fEur(p50)}</div><div class="kpi-sub">Escenari central</div></div>
      <div class="kpi"><div class="kpi-label">Probabilitat d'èxit</div><div class="kpi-val" style="color:${semaphoreColor}">${probSuccess} %</div><div class="kpi-sub">Monte Carlo 1.000 esc.</div></div>
    </div>

    ${d.objectiuAmount ? `<div class="callout ${d.objectiuAmount <= p50 ? 'callout-ok' : d.objectiuAmount <= p90 ? '' : 'callout-warn'}" style="margin-bottom:14px">
      <strong>Objectiu quantificat: ${fEur(goalAmount)}.</strong> ${goalAmount <= p50 ? `L'escenari central (P50 = ${fEur(p50)}) <strong>supera l'objectiu</strong>. Probabilitat d'assolir-lo: molt alta (${goalFeasibility}%).` : goalAmount <= p90 ? `L'escenari optimista (P90 = ${fEur(p90)}) <strong>assoleix l'objectiu</strong>. Probabilitat estimada: ${goalFeasibility}%.` : `L'objectiu de ${fEur(goalAmount)} supera fins i tot l'escenari P90 (${fEur(p90)}). Considera augmentar les aportacions mensuals o ampliar el termini.`}
    </div>` : ''}

    <div class="callout callout-ok">
      <strong>Recomanació.</strong> Per maximitzar la probabilitat d'assolir l'objectiu, mantén les aportacions de ${fEur(d.monthlyAmount)} mensuals sense interrupció i evita rescatar la inversió durant els primers 5 anys. El temps és el teu actiu més valuós: la composició s'accelera exponencialment a mesura que s'apropa el termini.
    </div>
  </div>
  ${footer(clientFirst, 4)}
</section>`;

  // ── PAGE 5: Cartera proposada ──────────────────────────────────────────────────
  const rvPct  = assets.filter(a => /variable|equity|rv\b/i.test(a.category)).reduce((s, a) => s + a.weight, 0);
  const rfPct  = assets.filter(a => /fixa|bond|rf\b|renda fixa|oblig/i.test(a.category)).reduce((s, a) => s + a.weight, 0);
  const cashPct = 100 - rvPct - rfPct;

  const page5 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Cartera Proposada`)}
    <h2 class="section-num">Secció 4</h2>
    <h1 class="section">Cartera proposada</h1>
    <p class="lead">Estructura proposada per a ${fEur(d.initialAmount)} d'inversió inicial sota el perfil ${prof.label}. Diversificació per classe d'actiu, geografia i cost.</p>

    <div class="grid-2" style="margin-bottom:20px">
      <div>
        <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Distribució per classe d'actiu</h3>
        ${buildDonutSVG(assets)}
      </div>
      <div>
        <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:10px">Indicadors de la cartera</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="kpi"><div class="kpi-label">Rendiment esperat net</div><div class="kpi-val" style="font-size:20px;color:var(--ok)">${fN(netReturn,1)} %</div><div class="kpi-sub">Anual net de TER</div></div>
          <div class="kpi"><div class="kpi-label">Volatilitat estimada</div><div class="kpi-val" style="font-size:20px">${fN(weightedVol,1)} %</div><div class="kpi-sub">Fluctuació anual esperada</div></div>
          <div class="kpi"><div class="kpi-label">TER mig</div><div class="kpi-val" style="font-size:20px;color:var(--gold)">${fN(weightedTER,2)} %</div><div class="kpi-sub">Cost anual total de gestió</div></div>
          <div class="kpi"><div class="kpi-label">SRRI ponderat</div><div class="kpi-val" style="font-size:20px">${fN(avgRisk,1)} / 7</div><div class="kpi-sub">Risc regulatori MiFID</div></div>
        </div>
      </div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:8px 0 10px">Barra d'assignació</h3>
    <div style="border-radius:6px;overflow:hidden;height:12px;display:flex;margin-bottom:8px">
      ${assets.map((a, i) => {
        const colors = ['#0f2137','#c9a84c','#2d6a4f','#1a3a5c','#a37e22','#5b6472','#8b5cf6','#94a3b8'];
        return `<div style="width:${a.weight}%;background:${colors[i % colors.length]};height:12px"></div>`;
      }).join('')}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;font-family:-apple-system,Arial,sans-serif;font-size:10.5px;color:var(--muted);margin-bottom:16px">
      ${assets.map((a, i) => {
        const colors = ['#0f2137','#c9a84c','#2d6a4f','#1a3a5c','#a37e22','#5b6472','#8b5cf6','#94a3b8'];
        return `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${colors[i % colors.length]};margin-right:4px;vertical-align:middle"></span>${a.name.split(' ')[0]} ${a.weight}%</span>`;
      }).join('')}
    </div>

    <div class="callout callout-ok">
      <strong>Optimització de costos.</strong> TER ponderat <strong>${fN(weightedTER, 2)} %</strong> — substancialment per sota de la mitjana del sector per a carteres mixtes (0,90–1,40%). Combinació de gestió indexada (core) amb selecció activa de convicció.
    </div>
  </div>
  ${footer(clientFirst, 5)}
</section>`;

  // ── PAGE 6: Composició detallada ──────────────────────────────────────────────
  const page6 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Composició Detallada`)}
    <h2 class="section-num">Secció 5</h2>
    <h1 class="section">Composició detallada de la cartera</h1>
    <p class="lead">Detall de cada vehicle d'inversió inclòs a la cartera amb ISIN, pes, cost i plataforma de contractació.</p>

    <table class="data">
      <thead><tr><th>Fons / ETF</th><th>Categoria</th><th style="text-align:right">Pes</th><th style="text-align:right">TER</th><th style="text-align:right">Import</th><th>SRRI</th></tr></thead>
      <tbody>
        ${assets.map(a => `<tr>
          <td><strong>${a.name}</strong><br><span style="font-size:11px;color:var(--muted)">${a.isin} · ${a.platform}</span></td>
          <td><span style="color:${categoryPill(a.category)};font-size:12px">${a.category}</span></td>
          <td class="num">${a.weight} %</td>
          <td class="num">${fN(a.ter, 2)} %</td>
          <td class="num">${fEur(d.initialAmount * a.weight / 100)}</td>
          <td>${srriBar(a.risk)}</td>
        </tr>`).join('')}
        <tr style="background:var(--soft)">
          <td><strong>Total cartera</strong></td><td></td>
          <td class="num"><strong>100 %</strong></td>
          <td class="num" style="color:var(--gold)"><strong>${fN(weightedTER, 2)} %</strong></td>
          <td class="num"><strong>${fEur(d.initialAmount)}</strong></td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Distribució geogràfica (look-through)</h3>
    <div>
      ${rvPct > 0 ? `<div class="stat-row"><span>EUA · S&P 500 / mid-large cap</span><strong class="mono">${Math.round(rvPct*0.5)} %</strong></div>
      <div class="stat-row"><span>Europa desenvolupada</span><strong class="mono">${Math.round(rvPct*0.25)} %</strong></div>
      <div class="stat-row"><span>Mercats emergents (Àsia + LatAm)</span><strong class="mono">${Math.round(rvPct*0.1)} %</strong></div>
      <div class="stat-row"><span>Japó &amp; Pacífic</span><strong class="mono">${Math.round(rvPct*0.15)} %</strong></div>` : ''}
      ${rfPct > 0 ? `<div class="stat-row"><span>Renda fixa global EUR-hedged</span><strong class="mono">${Math.round(rfPct*0.6)} %</strong></div>
      <div class="stat-row"><span>Govern Europa 7-10y</span><strong class="mono">${Math.round(rfPct*0.25)} %</strong></div>
      <div class="stat-row"><span>Inflation-linked global</span><strong class="mono">${Math.round(rfPct*0.15)} %</strong></div>` : ''}
      ${cashPct > 0 ? `<div class="stat-row"><span>Monetari EUR</span><strong class="mono">${cashPct} %</strong></div>` : ''}
    </div>
  </div>
  ${footer(clientFirst, 6)}
</section>`;

  // ── PAGE 7: Justificació per actiu ────────────────────────────────────────────
  function assetCardImproved(a: ManualAsset): string {
    const ret = assetReturn(a);
    const vol = assetVol(a);
    const color = categoryPill(a.category);
    return `<div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-family:Georgia,serif;font-size:17px;font-weight:700;color:var(--navy)">${a.name}</div>
          <div class="sans" style="font-size:11px;color:var(--muted);margin-top:2px">${a.isin} · ${a.weight} % de la cartera</div>
        </div>
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-family:-apple-system,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:${color}22;color:${color};border:1px solid ${color}44">${a.category}</span>
      </div>
      <p style="font-size:13px;color:#3a382f;margin-bottom:10px"><strong>Per què l'hem triat:</strong> ${a.justification || 'Vehicle seleccionat per la seva qualitat, cost competitiu i encaix estratègic amb el perfil ' + prof.label + '.'}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px">
        <div style="background:var(--soft);border-radius:6px;padding:8px 10px;text-align:center">
          <div class="sans" style="font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#8a877d;margin-bottom:3px">Rend. hist.</div>
          <div class="mono" style="font-size:13px;font-weight:700;color:var(--ok)">${fN(ret,1)} %</div>
        </div>
        <div style="background:var(--soft);border-radius:6px;padding:8px 10px;text-align:center">
          <div class="sans" style="font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#8a877d;margin-bottom:3px">Volatilitat</div>
          <div class="mono" style="font-size:13px;font-weight:700;color:var(--navy)">${fN(vol,1)} %</div>
        </div>
        <div style="background:var(--soft);border-radius:6px;padding:8px 10px;text-align:center">
          <div class="sans" style="font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#8a877d;margin-bottom:3px">TER</div>
          <div class="mono" style="font-size:13px;font-weight:700;color:var(--gold)">${fN(a.ter,2)} %</div>
        </div>
        <div style="background:var(--soft);border-radius:6px;padding:8px 10px;text-align:center">
          <div class="sans" style="font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#8a877d;margin-bottom:3px">SRRI</div>
          <div style="margin-top:2px">${srriBar(a.risk)}</div>
        </div>
      </div>
    </div>`;
  }

  const page7 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Justificació per Actiu`)}
    <h2 class="section-num">Secció 6</h2>
    <h1 class="section">Justificació individualitzada per actiu</h1>
    <p class="lead">Per a cada vehicle s'inclou la tesi d'inversió, raó de selecció i mètriques clau que justifiquen la seva inclusió en la cartera.</p>
    ${assets.map(assetCardImproved).join('')}
    ${assets.length === 0 ? `<div class="callout"><strong style="color:var(--navy)">Cap actiu seleccionat.</strong> Afegeix actius a la cartera per veure la justificació aquí.</div>` : ''}
  </div>
  ${footer(clientFirst, 7)}
</section>`;

  // ── PAGE 8: Riscos i escenaris ────────────────────────────────────────────────
  const stressLoss30 = Math.round(p50 * 0.70);
  const page8 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Riscos i Escenaris`)}
    <h2 class="section-num">Secció 7</h2>
    <h1 class="section">Riscos i escenaris de mercat</h1>
    <p class="lead">Anàlisi dels principals riscos i escenaris adversos per entendre com es comportaria la cartera en situacions extremes.</p>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:8px 0 10px">Escenaris de rendiment a ${d.horizon} anys</h3>
    <div class="grid-2" style="gap:12px;margin-bottom:18px">
      <div style="background:#fff;border:1px solid var(--line);border-top:4px solid var(--danger);border-radius:10px;padding:16px 18px">
        <div class="sans" style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--danger);margin-bottom:6px">Pessimista (P10)</div>
        <div class="mono" style="font-size:26px;font-weight:700;color:var(--danger)">${fEur(p10)}</div>
        <div class="sans" style="font-size:11px;color:var(--muted);margin-top:4px">${fPct(profitP10, true)} vs aportat · Rendiment ${fN(Math.max(0.5, netReturn - weightedVol * 0.35), 1)} %</div>
        <p style="font-size:12px;color:#3a382f;margin-top:8px">Escenari de crisi sostinguda: mercats adversos durant múltiples anys. La inversió segueix sent positiva però per sota de l'esperada.</p>
      </div>
      <div style="background:#fff;border:1px solid var(--line);border-top:4px solid var(--ok);border-radius:10px;padding:16px 18px">
        <div class="sans" style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ok);margin-bottom:6px">Optimista (P90)</div>
        <div class="mono" style="font-size:26px;font-weight:700;color:var(--ok)">${fEur(p90)}</div>
        <div class="sans" style="font-size:11px;color:var(--muted);margin-top:4px">${fPct(profitP90, true)} vs aportat · Rendiment ${fN(netReturn + weightedVol * 0.35, 1)} %</div>
        <p style="font-size:12px;color:#3a382f;margin-top:8px">Mercat favorable amb creixement sostingut i estabilitat dels actius. L'efecte de la composició s'accelera.</p>
      </div>
    </div>

    <div style="background:#fff3cd;border-left:4px solid #c9a84c;border-radius:4px;padding:14px 18px;margin-bottom:18px">
      <div class="sans" style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--warn);margin-bottom:6px">Stress test — Caiguda del 30%</div>
      <div style="font-size:13.5px;color:#3a382f">Si els mercats cauen un <strong>30%</strong>, la teva cartera passaria de <strong>${fEur(p50)}</strong> a aproximadament <strong>${fEur(stressLoss30)}</strong>. Històricament, mercats similars han trigat entre <strong>2 i 4 anys</strong> a recuperar-se. La clau és no vendre en mínims i continuar les aportacions mensuals.</div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:16px 0 8px">Tipologia de riscos</h3>
    <table class="data">
      <thead><tr><th>Risc</th><th>Probabilitat</th><th>Impacte</th><th>Mitigació</th></tr></thead>
      <tbody>
        <tr><td>Risc de mercat (correcció &gt;15%)</td><td><span class="pill pill-warn">Mitjana</span></td><td><span class="pill pill-warn" style="background:#fef2f2;color:#991b1b;border-color:#fca5a5">Alt</span></td><td>Diversificació, DCA, pota RF amortidor</td></tr>
        <tr><td>Risc de tipus d'interès</td><td><span class="pill pill-warn">Mitjana</span></td><td><span class="pill pill-gold">Mitjà</span></td><td>Diversificació de durades</td></tr>
        ${rvPct > 30 ? '<tr><td>Risc de divisa (USD/GBP)</td><td><span class="pill pill-warn">Mitjana</span></td><td><span class="pill pill-gold">Mitjà</span></td><td>Cobertura RF · Exposició natural EUR</td></tr>' : ''}
        <tr><td>Risc d'inflació estructural</td><td><span class="pill pill-gold">Baixa-Mitjana</span></td><td><span class="pill pill-warn" style="background:#fef2f2;color:#991b1b;border-color:#fca5a5">Alt</span></td><td>${rfPct > 0 ? 'Inflation-linked global com a hedge' : 'DCA regular com a protecció parcial'}</td></tr>
        <tr><td>Risc de liquiditat</td><td><span class="pill pill-green">Baixa</span></td><td><span class="pill pill-green">Baix</span></td><td>Tots els fons UCITS T+2/T+3</td></tr>
      </tbody>
    </table>

    <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin-top:16px">
      <div class="sans" style="font-size:11px;font-weight:700;color:var(--navy);margin-bottom:6px">Quan puc perdre diners?</div>
      <p style="font-size:13px;color:#3a382f">La inversió pot perdre valor a curt termini per correccions de mercat (és normal i esperable). El drawdown màxim estimat és del <strong>${fN(Math.abs(maxDD), 1)}%</strong>. A llarg termini (${d.horizon} anys), la probabilitat de pèrdua nominal és de tan sols el <strong>${probLoss}%</strong>. La disciplina de no vendre durant caigudes és la millor protecció.</p>
    </div>
  </div>
  ${footer(clientFirst, 8)}
</section>`;

  // ── PAGE 9: Costos i fiscalitat ───────────────────────────────────────────────
  const annualTER  = Math.round(d.initialAmount * weightedTER / 100);
  const totalTERCost = Math.round(totalInvested * weightedTER / 100 * d.horizon);
  const page9 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Costos i Fiscalitat`)}
    <h2 class="section-num">Secció 8</h2>
    <h1 class="section">Costos i fiscalitat</h1>
    <p class="lead">Impacte dels costos sobre la rendibilitat final i consideracions fiscals per a residents a Espanya.</p>

    <div class="grid-4">
      <div class="kpi"><div class="kpi-label">TER ponderat</div><div class="kpi-val" style="color:var(--gold)">${fN(weightedTER,2)} %</div><div class="kpi-sub">Cost anual total</div></div>
      <div class="kpi"><div class="kpi-label">Cost any 1</div><div class="kpi-val" style="font-size:20px">${fEur(annualTER)}</div><div class="kpi-sub">Sobre capital inicial</div></div>
      <div class="kpi"><div class="kpi-label">Cost total estimat</div><div class="kpi-val" style="font-size:20px">${fEur(totalTERCost)}</div><div class="kpi-sub">En ${d.horizon} anys</div></div>
      <div class="kpi"><div class="kpi-label">Rend. bruta - TER</div><div class="kpi-val" style="font-size:20px">${fN(netReturn,1)} %</div><div class="kpi-sub">Neta anualitzada</div></div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Costos per vehicle d'inversió</h3>
    <table class="data">
      <thead><tr><th>Fons / ETF</th><th style="text-align:right">Pes</th><th style="text-align:right">TER</th><th style="text-align:right">Cost anual (€)</th><th style="text-align:right">Contribució al TER mig</th></tr></thead>
      <tbody>
        ${assets.map(a => {
          const costAny = Math.round(d.initialAmount * a.weight / 100 * a.ter / 100);
          const contrib = parseFloat((a.weight / 100 * a.ter).toFixed(3));
          return `<tr>
            <td>${a.name}</td>
            <td class="num">${a.weight} %</td>
            <td class="num">${fN(a.ter, 2)} %</td>
            <td class="num">${fEur(costAny)}</td>
            <td class="num">${fN(contrib, 3)} %</td>
          </tr>`;
        }).join('')}
        <tr style="background:var(--soft)"><td><strong>Total</strong></td><td class="num"><strong>100 %</strong></td><td class="num" style="color:var(--gold)"><strong>${fN(weightedTER,2)} %</strong></td><td class="num"><strong>${fEur(annualTER)}</strong></td><td class="num" style="color:var(--gold)"><strong>${fN(weightedTER,3)} %</strong></td></tr>
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Nota fiscal (residents a Espanya)</h3>
    <div class="callout">
      <strong style="color:var(--navy)">Fiscalitat dels fons d'inversió UCITS.</strong> Els fons d'inversió (no ETFs) permeten traspàs sense tributació (diferiment fiscal). Tributen com a rendiment del capital mobiliari al reembolsar: 19% fins a 6.000€ de guany, 21% fins a 50.000€ i 23% per sobre. Els ETFs tributen com a guany patrimonial en cada transmissió. Recomanem consultar un assessor fiscal per optimitzar la cartera en funció de la situació personal.
    </div>
  </div>
  ${footer(clientFirst, 9)}
</section>`;

  // ── PAGE 10: Mètriques i rendiment ────────────────────────────────────────────
  const page10 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Mètriques i Rendiment`)}
    <h2 class="section-num">Secció 9</h2>
    <h1 class="section">Mètriques i rendiment esperat</h1>
    <p class="lead">Indicadors de risc-rendiment de la cartera i projecció Monte Carlo a ${d.horizon} anys.</p>

    ${buildMCSVG(p10, p50, p90, totalInvested, d.horizon, netReturn, weightedVol, d.initialAmount, d.monthlyAmount)}

    <div class="grid-4" style="margin-top:18px">
      <div class="kpi"><div class="kpi-label">Rendib. anualitzada</div><div class="kpi-val" style="font-size:22px">${fN(netReturn,2)} %</div><div class="kpi-sub">Esperada · ${d.horizon} anys</div></div>
      <div class="kpi"><div class="kpi-label">Volatilitat</div><div class="kpi-val" style="font-size:22px">${fN(weightedVol,2)} %</div><div class="kpi-sub">Anualitzada</div></div>
      <div class="kpi"><div class="kpi-label">Sharpe</div><div class="kpi-val" style="font-size:22px">${fN(sharpe,2)}</div><div class="kpi-sub">&gt;0,5 òptim</div></div>
      <div class="kpi"><div class="kpi-label">Sortino</div><div class="kpi-val" style="font-size:22px">${fN(sortino,2)}</div><div class="kpi-sub">&gt;0,6 òptim</div></div>
      <div class="kpi"><div class="kpi-label">Drawdown màx.</div><div class="kpi-val" style="font-size:22px;color:var(--danger)">${fN(maxDD,1)} %</div><div class="kpi-sub">Pitjor caiguda est.</div></div>
      <div class="kpi"><div class="kpi-label">Beta vs benchmark</div><div class="kpi-val" style="font-size:22px">${fN(beta,2)}</div><div class="kpi-sub">${beta < 1 ? 'Defensiu' : 'Agressiu'}</div></div>
      <div class="kpi"><div class="kpi-label">Calmar Ratio</div><div class="kpi-val" style="font-size:22px">${fN(calmar,2)}</div><div class="kpi-sub">Rend./DD</div></div>
      <div class="kpi"><div class="kpi-label">Tracking error</div><div class="kpi-val" style="font-size:22px">${fN(trackErr,2)} %</div><div class="kpi-sub">vs benchmark</div></div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Anàlisi de probabilitats</h3>
    <table class="data">
      <thead><tr><th>Mètrica</th><th style="text-align:right">Valor</th><th>Lectura</th></tr></thead>
      <tbody>
        <tr><td>Probabilitat de retorn positiu nominal</td><td class="num">${probPositive} %</td><td>Molt elevada per a ${d.horizon} anys</td></tr>
        <tr><td>Probabilitat de batre la inflació (CPI 2,5 %)</td><td class="num">${probInflation} %</td><td>Cobertura real positiva esperada</td></tr>
        <tr><td>Probabilitat d'assolir ${fEur(p50)} (objectiu)</td><td class="num">${probSuccess} %</td><td>Objectiu assolible amb constància</td></tr>
        <tr><td>Probabilitat de pèrdua nominal a ${d.horizon} anys</td><td class="num" style="color:var(--danger)">${probLoss} %</td><td>Risc residual baix</td></tr>
      </tbody>
    </table>
  </div>
  ${footer(clientFirst, 10)}
</section>`;

  // ── PAGE 11: Conclusions i propers passos ─────────────────────────────────────
  const platforms = [...new Set(assets.map(a => a.platform))].join(' / ') || 'Trade Republic / MyInvestor';
  const adequacyLabel = probSuccess >= 70 ? 'òptima' : probSuccess >= 55 ? 'molt adequada' : 'adequada';
  const reviewDate6m = new Date(Date.now() + 15778800000).toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const page11 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Conclusions`)}
    <h2 class="section-num">Secció 10</h2>
    <h1 class="section">Conclusions i recomanacions</h1>

    <div style="background:linear-gradient(135deg,#0f2137 0%,#1a3a5c 100%);color:#fff;border-radius:10px;padding:22px;margin-bottom:20px">
      <div class="sans" style="font-size:11px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:6px">Conclusió final</div>
      <div style="font-family:Georgia,serif;font-size:20px;line-height:1.4">La cartera proposada és <strong>${adequacyLabel}</strong> per al perfil <strong>${prof.label}</strong> amb un objectiu de <em>${d.objective.toLowerCase()}</em>.</div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:16px 0 10px">5 passos d'acció immediata</h3>
    <ol style="list-style:none;padding:0;margin:0 0 20px">
      <li style="display:flex;gap:14px;padding:10px 0;border-bottom:1px dotted #d8d6cc;align-items:flex-start">
        <span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--navy);color:#fff;font-family:-apple-system,Arial,sans-serif;font-size:11px;font-weight:700;flex-shrink:0">1</span>
        <span style="font-size:13.5px;color:#3a382f">Obre el compte a <strong>${platforms}</strong> si no el tens. El procés dura aproximadament 15 minuts en línia.</span>
      </li>
      <li style="display:flex;gap:14px;padding:10px 0;border-bottom:1px dotted #d8d6cc;align-items:flex-start">
        <span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--navy);color:#fff;font-family:-apple-system,Arial,sans-serif;font-size:11px;font-weight:700;flex-shrink:0">2</span>
        <span style="font-size:13.5px;color:#3a382f">Transfereix el capital inicial de <strong>${fEur(d.initialAmount)}</strong> i subscriu els fons seguint els pesos indicats a la cartera.</span>
      </li>
      <li style="display:flex;gap:14px;padding:10px 0;border-bottom:1px dotted #d8d6cc;align-items:flex-start">
        <span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--gold);color:#fff;font-family:-apple-system,Arial,sans-serif;font-size:11px;font-weight:700;flex-shrink:0">3</span>
        <span style="font-size:13.5px;color:#3a382f">Configura l'aportació automàtica de <strong>${fEur(d.monthlyAmount)}</strong> mensuals per a cadascun dels fons (DCA recurrent).</span>
      </li>
      <li style="display:flex;gap:14px;padding:10px 0;border-bottom:1px dotted #d8d6cc;align-items:flex-start">
        <span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--green);color:#fff;font-family:-apple-system,Arial,sans-serif;font-size:11px;font-weight:700;flex-shrink:0">4</span>
        <span style="font-size:13.5px;color:#3a382f">No moguis la cartera durant els primers <strong>12 mesos</strong>. Les fluctuacions de mercat a curt termini son normals i esperades.</span>
      </li>
      <li style="display:flex;gap:14px;padding:10px 0;align-items:flex-start">
        <span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--muted);color:#fff;font-family:-apple-system,Arial,sans-serif;font-size:11px;font-weight:700;flex-shrink:0">5</span>
        <span style="font-size:13.5px;color:#3a382f">Revisa amb el teu gestor cada <strong>6 mesos</strong> o davant canvis importants en la teva situació financera o objectius.</span>
      </li>
    </ol>

    <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px">
      <div style="width:10px;height:10px;border-radius:50%;background:var(--gold);flex-shrink:0"></div>
      <div class="sans" style="font-size:12.5px;color:#3a382f">Pròxima revisió recomanada: <strong>${reviewDate6m}</strong></div>
    </div>

    <div class="callout callout-warn" style="margin-top:10px;font-size:11px;line-height:1.5">
      <strong>Avís legal · Disclaimer.</strong> Aquest informe ha estat generat per Factor OTC com a eina interna de suport a l'assessorament patrimonial amb finalitat orientativa i educativa. No constitueix assessorament financer regulat MiFID II ni recomanació d'inversió personalitzada. Factor OTC no és una entitat financera regulada. Els rendiments estimats es basen en models estadístics i dades històriques que no garanteixen resultats futurs. Tota inversió comporta risc de pèrdua parcial o total del capital. Es recomana consultar un assessor financer regulat (EAFI, IFA o entitat autoritzada) abans de prendre decisions d'inversió. © ${new Date().getFullYear()} Factor OTC · ID ${reportId}.
    </div>
  </div>
  ${footer(clientFirst, 11)}
</section>`;

  // ── PAGE 12: IPS — Declaració de Política d'Inversió ─────────────────────────
  const mifidTotal = horizonScore + knowScore + expScore + tolScore + reactScore + objScore + liquidScore + healthScore;
  const CONSTRAINTS: Record<string, { rvMin: string; rvMax: string; rfMin: string; rfMax: string }> = {
    conservador: { rvMin: '0%',  rvMax: '40%', rfMin: '40%', rfMax: '80%' },
    moderat:     { rvMin: '30%', rvMax: '70%', rfMin: '20%', rfMax: '60%' },
    dinamic:     { rvMin: '50%', rvMax: '90%', rfMin: '0%',  rfMax: '40%' },
    agressiu:    { rvMin: '60%', rvMax: '100%',rfMin: '0%',  rfMax: '30%' },
  };
  const cons = CONSTRAINTS[d.investorProfile] ?? { rvMin: '0%', rvMax: '100%', rfMin: '0%', rfMax: '100%' };
  const benchmarkName = rvPct >= 70 ? 'MSCI World 100%' : rvPct >= 50 ? 'MSCI World 60% / Bloomberg Agg 40%' : rvPct >= 30 ? 'MSCI World 40% / Bloomberg Agg 60%' : 'Bloomberg Agg 80% / MSCI World 20%';
  const benchReturn   = rvPct >= 70 ? 8.0 : rvPct >= 50 ? 6.0 : rvPct >= 30 ? 4.5 : 3.0;
  const alphaVsBench  = parseFloat((netReturn - benchReturn).toFixed(2));

  const page12 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · IPS — Política d'Inversió`)}
    <h2 class="section-num">Secció 11</h2>
    <h1 class="section">Declaració de Política d'Inversió (IPS)</h1>
    <p class="lead">Document formal que estableix el mandat d'inversió, les restriccions per classe d'actiu, el benchmark i la política de revisió. Conforme al marc MiFID II Art. 54 DR 2017/565.</p>

    <div style="background:#fff;border-left:4px solid var(--navy);border-radius:4px;padding:16px 20px;margin-bottom:20px">
      <div class="sans" style="font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Mandat d'inversió formal</div>
      <p style="font-size:13.5px;color:#3a382f;line-height:1.65">Factor OTC ha elaborat aquesta proposta per a <strong>${d.clientName}</strong> d'acord amb el perfil <strong>${prof.label}</strong>. Objectiu: <em>${d.objective.toLowerCase()}</em> en un horitzó de <strong>${d.horizon} anys</strong>. El mandat aplica gestió indexada diversificada globalment, minimització de costos i aportació periòdica sistemàtica (DCA). Sense concentracions en un sol emissor superiors al 40 %, sense apalancament i amb liquiditat UCITS T+2/T+3.</p>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:0 0 8px">Avaluació de dimensions MiFID II</h3>
    <table class="data" style="margin-bottom:18px">
      <thead><tr><th>Dimensió</th><th style="text-align:right">Punts</th><th style="text-align:right">Màx</th><th>Valoració</th></tr></thead>
      <tbody>
        <tr><td>Horitzó temporal</td><td class="num">${horizonScore}</td><td class="num">20</td><td>${horizonScore >= 15 ? 'Llarg termini — composició màxima' : horizonScore >= 8 ? 'Termini mitjà — cartera mixta' : 'Curt termini — carteres conservadores'}</td></tr>
        <tr><td>Coneixements financers</td><td class="num">${knowScore}</td><td class="num">12</td><td>${knowScore >= 10 ? 'Expert — comprèn instruments complexos' : knowScore >= 7 ? 'Intermedi — fons i ETFs' : 'Bàsic — productes simples'}</td></tr>
        <tr><td>Experiència inversora</td><td class="num">${expScore}</td><td class="num">13</td><td>${expScore >= 10 ? 'Àmplia — ha viscut crisis i recuperació' : expScore >= 7 ? 'Moderada — mercats alcistes' : 'Limitada — primer contacte'}</td></tr>
        <tr><td>Tolerància al risc</td><td class="num">${tolScore}</td><td class="num">18</td><td>${tolScore >= 14 ? 'Alta — assumeix fluctuacions importants' : tolScore >= 9 ? 'Moderada — fins a –15%' : 'Baixa — prefereix estabilitat'}</td></tr>
        <tr><td>Resposta a caigudes</td><td class="num">${reactScore}</td><td class="num">12</td><td>${reactScore >= 10 ? 'Disciplinat — afegirà en caigudes' : reactScore >= 7 ? 'Estable — no vendrà en pànic' : 'Incert — pot liquidar en mínims'}</td></tr>
        <tr><td>Objectiu financer</td><td class="num">${objScore}</td><td class="num">6</td><td>${d.objective.toLowerCase()}</td></tr>
        <tr><td>Liquiditat i necessitats</td><td class="num">${liquidScore}</td><td class="num">7</td><td>${d.horizon > 10 ? 'No necessita liquiditat a curt termini' : 'Possible necessitat parcial a mig termini'}</td></tr>
        <tr><td>Situació financera</td><td class="num">${healthScore}</td><td class="num">9</td><td>${d.initialAmount > 20000 ? 'Capacitat alta' : d.initialAmount > 5000 ? 'Capacitat mitja' : 'Capacitat limitada'}</td></tr>
        <tr style="background:var(--soft)">
          <td><strong>TOTAL MiFID II</strong></td>
          <td class="num" style="color:var(--gold)"><strong>${mifidTotal}</strong></td>
          <td class="num">97</td>
          <td><strong>Perfil validat: ${prof.label} · Adequació: ${mifidTotal >= 70 ? 'Alta' : mifidTotal >= 50 ? 'Moderada' : 'Baixa'}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="grid-2" style="gap:16px">
      <div>
        <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Restriccions d'actius (Investment Constraints)</h3>
        <table class="data">
          <thead><tr><th>Classe d'actiu</th><th style="text-align:right">Mínim</th><th style="text-align:right">Màxim</th><th style="text-align:right">Actual</th></tr></thead>
          <tbody>
            <tr><td>Renda variable global</td><td class="num">${cons.rvMin}</td><td class="num">${cons.rvMax}</td><td class="num" style="color:${rvPct < parseInt(cons.rvMin) || rvPct > parseInt(cons.rvMax) ? 'var(--danger)' : 'var(--ok)'}">${rvPct} %</td></tr>
            <tr><td>Renda fixa / Oblig.</td><td class="num">${cons.rfMin}</td><td class="num">${cons.rfMax}</td><td class="num" style="color:${rfPct < parseInt(cons.rfMin) || rfPct > parseInt(cons.rfMax) ? 'var(--danger)' : 'var(--ok)'}">${rfPct} %</td></tr>
            <tr><td>Monetari / Liquiditat</td><td class="num">0%</td><td class="num">20%</td><td class="num">${cashPct} %</td></tr>
            <tr style="background:var(--soft)"><td><strong>TER màxim permès</strong></td><td class="num" colspan="2">—</td><td class="num" style="color:${weightedTER < 0.5 ? 'var(--ok)' : weightedTER < 1.0 ? 'var(--warn)' : 'var(--danger)'}"><strong>${fN(weightedTER,2)} %</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Benchmark i política de revisió</h3>
        <div class="stat-row"><span class="sans" style="font-size:12px">Benchmark de referència</span><strong class="mono" style="font-size:11.5px">${benchmarkName}</strong></div>
        <div class="stat-row"><span class="sans" style="font-size:12px">Retorn esperat benchmark</span><strong class="mono" style="font-size:11.5px">${fN(benchReturn, 1)} %</strong></div>
        <div class="stat-row"><span class="sans" style="font-size:12px">Alpha esperat (net)</span><strong class="mono" style="font-size:11.5px;color:${alphaVsBench >= 0 ? 'var(--ok)' : 'var(--danger)'}">${alphaVsBench >= 0 ? '+' : ''}${fN(alphaVsBench, 2)} %</strong></div>
        <div class="stat-row"><span class="sans" style="font-size:12px">Freqüència de revisió</span><strong class="mono" style="font-size:11.5px">Semestral</strong></div>
        <div class="stat-row"><span class="sans" style="font-size:12px">Rebalanceig</span><strong class="mono" style="font-size:11.5px">Anual o ±5% desviació</strong></div>
        <div class="stat-row"><span class="sans" style="font-size:12px">Drawdown trigger</span><strong class="mono" style="font-size:11.5px">${fN(prof.maxDDPct, 0)} % — revisió obligatòria</strong></div>
        <div class="stat-row" style="border-bottom:0"><span class="sans" style="font-size:12px">Vigència d'aquest IPS</span><strong class="mono" style="font-size:11.5px">12 mesos des de la data</strong></div>
      </div>
    </div>
  </div>
  ${footer(clientFirst, 12)}
</section>`;

  // ── Assemble ──────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Factor OTC — Informe Manual Admin · ${d.clientName.toUpperCase()}</title>
<style>${CSS}</style>
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
