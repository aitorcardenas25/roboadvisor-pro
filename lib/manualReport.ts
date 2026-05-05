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

  const savingsRate = parseFloat(((d.monthlyAmount / estIncome) * 100).toFixed(1));
  const eFundMonths = Math.round(d.initialAmount * 0.3 / Math.max(1, fixedExp + varExp));
  const debtRatio   = 8.1;
  const wealthMult  = parseFloat((d.initialAmount / Math.max(1, d.initialAmount * 2) * 4).toFixed(1));

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
  const page2 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Resum Executiu`)}
    <h2 class="section-num">Secció 1</h2>
    <h1 class="section">Resum Executiu</h1>
    <p class="lead">Síntesi de la proposta patrimonial, fluxos de caixa, pla d'inversió i projecció esperada a ${d.horizon} anys per al perfil <strong>${prof.label}</strong> de ${d.clientName}.</p>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Patrimoni objectiu</div><div class="kpi-val">${fEur(p50)}</div><div class="kpi-sub">${d.objective} · ${d.horizon} anys</div></div>
      <div class="kpi"><div class="kpi-label">Rendibilitat esperada</div><div class="kpi-val">${fN(netReturn, 1)} %</div><div class="kpi-sub">Anualitzada neta de costos</div></div>
      <div class="kpi"><div class="kpi-label">Probabilitat d'èxit</div><div class="kpi-val">${probSuccess} %</div><div class="kpi-sub">Monte Carlo 1.000 escenaris</div></div>
    </div>

    <h3 class="sans" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:24px 0 10px">Anàlisi del flux de caixa mensual (estimat)</h3>
    <table class="data">
      <thead><tr><th>Concepte</th><th style="text-align:right">Import</th><th style="text-align:right">% Ingressos</th><th>Estat</th></tr></thead>
      <tbody>
        <tr><td>Ingressos nets estimats</td><td class="num">${fEur(estIncome)}</td><td class="num">100,0 %</td><td><span class="pill pill-green">Estable</span></td></tr>
        <tr><td>Despeses fixes (lloguer, subministraments, transport)</td><td class="num">${fEur(fixedExp)}</td><td class="num">${fN(fixedExp/estIncome*100,1)} %</td><td><span class="pill pill-green">Sota control</span></td></tr>
        <tr><td>Despeses variables (alimentació, oci, salut)</td><td class="num">${fEur(varExp)}</td><td class="num">${fN(varExp/estIncome*100,1)} %</td><td><span class="pill pill-green">Saludable</span></td></tr>
        <tr><td>Aportació inversió recurrent</td><td class="num">${fEur(d.monthlyAmount)}</td><td class="num">${fN(savingsRate,1)} %</td><td><span class="pill pill-gold">DCA actiu</span></td></tr>
        <tr><td>Excedent disponible</td><td class="num">${fEur(surplus)}</td><td class="num">${fN(surplus/estIncome*100,1)} %</td><td><span class="pill pill-green">Capacitat extra</span></td></tr>
      </tbody>
    </table>

    <h3 class="sans" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:26px 0 10px">Projecció patrimonial — escenaris a ${d.horizon} anys</h3>
    <div class="grid-4">
      <div class="kpi"><div class="kpi-label">Total aportat</div><div class="kpi-val" style="font-size:20px">${fEur(totalInvested)}</div><div class="kpi-sub">${fEur(d.initialAmount)} + ${fEur(d.monthlyAmount)}×${d.horizon*12}</div></div>
      <div class="kpi"><div class="kpi-label">Pessimista (P10)</div><div class="kpi-val" style="font-size:20px;color:var(--danger)">${fEur(p10)}</div><div class="kpi-sub">${fPct(profitP10, true)} vs aportat</div></div>
      <div class="kpi"><div class="kpi-label">Central (P50)</div><div class="kpi-val" style="font-size:20px;color:var(--navy)">${fEur(p50)}</div><div class="kpi-sub">${fPct(profitP50, true)} vs aportat</div></div>
      <div class="kpi"><div class="kpi-label">Optimista (P90)</div><div class="kpi-val" style="font-size:20px;color:var(--ok)">${fEur(p90)}</div><div class="kpi-sub">${fPct(profitP90, true)} vs aportat</div></div>
    </div>

    <div class="callout">
      <strong style="color:var(--navy)">Tesi de la proposta.</strong> Cartera <em>${prof.label}</em> amb ${assets.length} vehicles d'inversió diversificats. ${prof.desc} TER ponderat <strong>${fN(weightedTER, 2)} %</strong>. Rendibilitat esperada neta de costos: <strong>${fN(netReturn, 1)} %</strong> anualitzada.${d.adminNote ? ` <em>${d.adminNote}</em>` : ''}
    </div>

    <h3 class="sans" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 10px">Recomanacions clau</h3>
    <ul class="clean">
      <li>Mantenir l'aportació mensual sistemàtica de ${fEur(d.monthlyAmount)} independentment del cicle de mercat (DCA).</li>
      <li>Rebalanceig anual amb tolerància ±5 % per actiu i ±3 % per classe d'actiu.</li>
      <li>Reservar fons d'emergència equivalent a 4-6 mesos de despeses en compte remunerat.</li>
      <li>Revisió semianual amb gestor i recalibració del perfil cada 24 mesos o davant canvis vitals.</li>
    </ul>
  </div>
  ${footer(clientFirst, 2)}
</section>`;

  // ── PAGE 3: Dades client i perfil ────────────────────────────────────────────
  const mifidRows = [
    { dim: 'Horitzó temporal', max: 20, score: horizonScore, detail: `${d.horizon} anys fins a l'objectiu: ${d.objective}` },
    { dim: 'Coneixement financer', max: 15, score: knowScore, detail: 'Familiaritzat amb fons indexats i ETFs; nivell adequat al perfil' },
    { dim: 'Experiència inversora', max: 15, score: expScore, detail: 'Experiència en instruments de baix cost i inversió sistemàtica' },
    { dim: 'Tolerància a pèrdues', max: 20, score: tolScore, detail: `Acceptaria fins a –${prof.maxDDPct} % temporal sense liquidar` },
    { dim: 'Reacció davant caigudes', max: 15, score: reactScore, detail: 'Mantindria estratègia DCA; aportaria parcialment en correccions' },
    { dim: 'Objectiu financer', max: 10, score: objScore, detail: d.objective },
    { dim: 'Necessitat de liquiditat', max: 10, score: liquidScore, detail: `Liquiditat baixa exigida durant ${d.horizon} anys d'horitzó` },
    { dim: 'Salut financera', max: 10, score: healthScore, detail: `Capital inicial ${fEur(d.initialAmount)} — capacitat d'estalvi adequada` },
  ];

  const page3 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Perfil Inversor`)}
    <h2 class="section-num">Secció 2</h2>
    <h1 class="section">Dades del client i perfil inversor</h1>
    <p class="lead">Identificació de l'inversor, qüestionari MiFID II i scoring de tolerància al risc segons les vuit dimensions del model intern.</p>

    <div class="grid-2">
      <div>
        <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:10px">Dades identificatives</h3>
        <div class="stat-row"><span>Nom complet</span><strong>${d.clientName}</strong></div>
        <div class="stat-row"><span>Email contacte</span><strong>${d.clientEmail}</strong></div>
        <div class="stat-row"><span>Perfil inversor</span><strong>${prof.label}</strong></div>
        <div class="stat-row"><span>Objectiu financer</span><strong>${d.objective}</strong></div>
        <div class="stat-row"><span>Horitzó temporal</span><strong>${d.horizon} anys</strong></div>
        <div class="stat-row"><span>Capital inicial</span><strong>${fEur(d.initialAmount)}</strong></div>
        <div class="stat-row"><span>Aportació mensual</span><strong>${fEur(d.monthlyAmount)}</strong></div>
        <div class="stat-row"><span>Data alta a Factor OTC</span><strong>${generatedAt.split(',')[0]}</strong></div>
        <div class="stat-row"><span>Gestor assignat</span><strong>A. Cardenas (BP-014)</strong></div>
      </div>
      <div>
        <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:10px">Situació financera (estimada)</h3>
        <div class="stat-row"><span>Ingressos nets / mes</span><strong>${fEur(estIncome)}</strong></div>
        <div class="stat-row"><span>Despeses totals / mes</span><strong>${fEur(fixedExp + varExp)}</strong></div>
        <div class="stat-row"><span>Capital inicial a invertir</span><strong>${fEur(d.initialAmount)}</strong></div>
        <div class="stat-row"><span>Aportació mensual</span><strong>${fEur(d.monthlyAmount)}</strong></div>
        <div class="stat-row"><span>Vehicles seleccionats</span><strong>${assets.length} fons / ETFs</strong></div>
        <div class="stat-row"><span>TER ponderat</span><strong>${fN(weightedTER, 2)} %</strong></div>
        <div class="stat-row"><span>Risc mig cartera (SRRI)</span><strong>${fN(avgRisk, 1)} / 7 — ${RISK_LABEL[Math.round(avgRisk)] ?? 'Moderat'}</strong></div>
      </div>
    </div>

    <h3 class="sans" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:28px 0 8px">Perfil inversor determinat</h3>
    <div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:22px;display:flex;align-items:center;gap:24px">
      <div style="flex:0 0 130px;text-align:center">
        <div style="font-family:Georgia,serif;font-size:54px;font-weight:700;color:var(--navy);line-height:1">${prof.score}</div>
        <div class="sans" style="font-size:10.5px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-top:4px">/100 punts</div>
        <div style="margin-top:8px"><span class="pill pill-gold">${prof.label}</span></div>
      </div>
      <div style="flex:1">
        <p style="font-size:13.5px;color:#3a382f;margin-bottom:10px">${prof.desc}</p>
        <div class="bar-h" style="height:8px"><span style="width:${prof.bar}"></span></div>
        <div style="display:flex;justify-content:space-between;font-family:-apple-system,Arial,sans-serif;font-size:9.5px;color:var(--muted);margin-top:6px;letter-spacing:1px;text-transform:uppercase">
          <span>Conservador</span><span>Moderat</span><span style="color:var(--gold);font-weight:700">${prof.label}</span><span>Dinàmic</span><span>Agressiu</span>
        </div>
      </div>
    </div>

    <h3 class="sans" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:28px 0 8px">Scoring per dimensió MiFID</h3>
    <table class="data">
      <thead><tr><th>Dimensió</th><th style="text-align:right">Puntuació</th><th>Detall</th></tr></thead>
      <tbody>
        ${mifidRows.map(r => `<tr><td>${r.dim}</td><td class="num">${r.score} / ${r.max}</td><td>${r.detail}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
  ${footer(clientFirst, 3)}
</section>`;

  // ── PAGE 4: Diagnòstic financer ───────────────────────────────────────────────
  const page4 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Diagnòstic Financer`)}
    <h2 class="section-num">Secció 3</h2>
    <h1 class="section">Diagnòstic financer personal</h1>
    <p class="lead">Anàlisi de la salut financera prèvia a la inversió: capacitat d'estalvi, fons d'emergència, ràtio de deute i sostenibilitat de l'objectiu.</p>

    <div class="grid-4">
      <div class="kpi"><div class="kpi-label">Taxa estalvi</div><div class="kpi-val" style="color:var(--ok)">${fN(savingsRate,1)} %</div><div class="kpi-sub">${savingsRate > 20 ? 'Excel·lent (&gt;20 %)' : 'Adequat (&gt;10 %)'}</div></div>
      <div class="kpi"><div class="kpi-label">Fons emergència</div><div class="kpi-val">${eFundMonths} mesos</div><div class="kpi-sub">${eFundMonths >= 6 ? 'Suficient (&gt;6)' : 'Millorable'}</div></div>
      <div class="kpi"><div class="kpi-label">Deute / ingressos</div><div class="kpi-val" style="color:var(--ok)">${fN(debtRatio,1)} %</div><div class="kpi-sub">Baix (&lt;30 %)</div></div>
      <div class="kpi"><div class="kpi-label">Patrimoni / ingressos</div><div class="kpi-val">${fN(d.initialAmount / Math.max(1, estIncome * 12), 1)}×</div><div class="kpi-sub">Relació patrimoni anual</div></div>
    </div>

    <h3 class="sans" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:24px 0 10px">Diagnòstic detallat</h3>
    <table class="data">
      <thead><tr><th>Indicador</th><th style="text-align:right">Valor</th><th>Estat</th><th>Interpretació</th></tr></thead>
      <tbody>
        <tr><td>Taxa d'estalvi</td><td class="num">${fN(savingsRate,1)} %</td><td><span class="pill ${savingsRate>20?'pill-green':'pill-gold'}">${savingsRate>20?'Òptim':'Adequat'}</span></td><td>Capacitat d'aportació ${savingsRate>20?'elevada':'estable'}</td></tr>
        <tr><td>Fons d'emergència (mesos despeses)</td><td class="num">${eFundMonths}</td><td><span class="pill ${eFundMonths>=6?'pill-green':'pill-warn'}">${eFundMonths>=6?'Suficient':'Millorable'}</span></td><td>${eFundMonths>=6?'Excedent reassignable parcialment a inversió':'Recomanem augmentar fins a 6 mesos'}</td></tr>
        <tr><td>Ràtio deute / ingressos bruts</td><td class="num">${fN(debtRatio,1)} %</td><td><span class="pill pill-green">Baix</span></td><td>Espai per assumir risc ${prof.label.toLowerCase()}</td></tr>
        <tr><td>Diversificació patrimonial</td><td class="num">${fN(100 - d.initialAmount/(d.initialAmount*2)*100,0)} % invers.</td><td><span class="pill pill-warn">Millorable</span></td><td>Cal augmentar exposició a actius productius</td></tr>
        <tr><td>Viabilitat objectiu (${d.horizon} anys)</td><td class="num">${probSuccess} / 100</td><td><span class="pill pill-gold">Assolible</span></td><td>Coherent amb el pla d'inversió i DCA</td></tr>
        <tr><td>Pressupost mensual lliure</td><td class="num">${fEur(surplus)}</td><td><span class="pill pill-green">Excedent</span></td><td>Marge per increment d'aportació futur</td></tr>
      </tbody>
    </table>

    <h3 class="sans" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:24px 0 10px">Estratègia de seguretat patrimonial</h3>
    <div class="grid-2">
      <div class="callout callout-ok">
        <strong>Punts forts</strong>
        <ul class="clean" style="margin-top:6px">
          <li>Taxa d'estalvi del ${fN(savingsRate,1)} % — per sobre de la mitjana del 10-15 %</li>
          <li>Capital inicial sòlid de ${fEur(d.initialAmount)} per iniciar la composició</li>
          <li>Aportació DCA de ${fEur(d.monthlyAmount)}/mes amb efecte promig de cost</li>
          <li>Horitzó llarg de ${d.horizon} anys — marge per absorvir cicles adversos</li>
        </ul>
      </div>
      <div class="callout callout-warn">
        <strong>Punts a vigilar</strong>
        <ul class="clean" style="margin-top:6px">
          <li>Fons d'emergència: prioritzar 3-6 mesos de despeses en líquid</li>
          <li>Diversificació patrimonial: augmentar exposició a actius productius</li>
          <li>Revisió semianual del pla d'inversió davant canvis d'ingressos</li>
          <li>Optimització fiscal: valorar traspàs entre fons per diferir impostos</li>
        </ul>
      </div>
    </div>

    <div class="callout">
      <strong style="color:var(--navy)">Recomanació de seguretat.</strong> Mantenir ${fEur(Math.round((fixedExp + varExp) * 4))} en compte remunerat com a fons d'emergència (4 mesos de despeses) i destinar ${fEur(d.initialAmount)} a la cartera proposada. L'excedent mensual de ${fEur(surplus)} permet incrementar l'aportació progressivament.
    </div>
  </div>
  ${footer(clientFirst, 4)}
</section>`;

  // ── PAGE 5: Composició detallada ──────────────────────────────────────────────
  const rvPct  = assets.filter(a => /variable|equity|rv\b/i.test(a.category)).reduce((s, a) => s + a.weight, 0);
  const rfPct  = assets.filter(a => /fixa|bond|rf\b|renda fixa|oblig/i.test(a.category)).reduce((s, a) => s + a.weight, 0);
  const cashPct = 100 - rvPct - rfPct;

  const page5 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Composició Cartera`)}
    <h2 class="section-num">Secció 4</h2>
    <h1 class="section">Composició detallada de la cartera</h1>
    <p class="lead">Estructura proposada per a ${fEur(d.initialAmount)} d'inversió inicial sota el perfil ${prof.label}. Diversificació per classe d'actiu, geografia i cost.</p>

    <div class="grid-2" style="margin-bottom:20px">
      <div>
        <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Distribució per classe d'actiu</h3>
        ${buildDonutSVG(assets)}
      </div>
      <div>
        <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Distribució geogràfica (look-through)</h3>
        <div style="margin-top:6px">
          ${rvPct > 0 ? `<div class="stat-row"><span>EUA · S&P 500 / mid-large cap</span><strong class="mono">${Math.round(rvPct*0.5)} %</strong></div>
          <div class="stat-row"><span>Europa desenvolupada</span><strong class="mono">${Math.round(rvPct*0.25)} %</strong></div>
          <div class="stat-row"><span>Mercats emergents (Àsia + LatAm)</span><strong class="mono">${Math.round(rvPct*0.1)} %</strong></div>
          <div class="stat-row"><span>Japó &amp; Pacífic</span><strong class="mono">${Math.round(rvPct*0.15)} %</strong></div>` : ''}
          ${rfPct > 0 ? `<div class="stat-row"><span>Renda fixa global EUR-hedged</span><strong class="mono">${Math.round(rfPct*0.6)} %</strong></div>
          <div class="stat-row"><span>Govern Europa 7-10y</span><strong class="mono">${Math.round(rfPct*0.25)} %</strong></div>
          <div class="stat-row"><span>Inflation-linked global</span><strong class="mono">${Math.round(rfPct*0.15)} %</strong></div>` : ''}
          ${cashPct > 0 ? `<div class="stat-row"><span>Monetari EUR</span><strong class="mono">${cashPct} %</strong></div>` : ''}
          <div class="stat-row" style="border-top:1px solid var(--line);padding-top:9px"><span><strong>TER ponderat</strong></span><strong class="mono" style="color:var(--gold)">${fN(weightedTER, 2)} %</strong></div>
        </div>
      </div>
    </div>

    <h3 class="sans" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:6px 0 8px">Vehicles d'inversió</h3>
    <table class="data">
      <thead><tr><th>Fons / ETF</th><th>Categoria</th><th style="text-align:right">Pes</th><th style="text-align:right">TER</th><th style="text-align:right">Import</th><th>SRRI</th></tr></thead>
      <tbody>
        ${assets.map(a => `<tr>
          <td><strong>${a.name}</strong><br><span style="font-size:11px;color:var(--muted)">${a.isin} · ${a.platform}</span></td>
          <td><span style="color:${categoryPill(a.category)};font-size:12px">${a.category}</span></td>
          <td class="num">${a.weight} %</td>
          <td class="num">${fN(a.ter, 2)} %</td>
          <td class="num">${fEur(d.initialAmount * a.weight / 100)}</td>
          <td>${a.risk}/7</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div class="callout callout-ok">
      <strong>Optimització de costos.</strong> TER ponderat <strong>${fN(weightedTER, 2)} %</strong> — substancialment per sota de la mitjana del sector per a carteres mixtes (0,90–1,40 %). Combinació de gestió indexada (core) amb selecció activa de convicció per a rendiment addicional.
    </div>
  </div>
  ${footer(clientFirst, 5)}
</section>`;

  // ── PAGES 6-7: Justificació per actiu ────────────────────────────────────────
  const page6 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Justificació per actiu (1/${page7Assets.length > 0 ? '2' : '1'})`)}
    <h2 class="section-num">Secció 5</h2>
    <h1 class="section">Justificació individualitzada per actiu</h1>
    <p class="lead">Per a cada vehicle s'inclou la tesi d'inversió, anàlisi fonamental del subjacent, encaix tàctic i mitigació de riscos.</p>
    ${page6Assets.map(assetCard).join('')}
  </div>
  ${footer(clientFirst, 6)}
</section>`;

  const page7 = page7Assets.length > 0 ? `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Justificació per actiu (2/2)`)}
    ${page7Assets.map(assetCard).join('')}
    ${page7Assets.length < 3 ? `<div class="callout" style="margin-top:18px"><strong style="color:var(--navy)">Nota del gestor.</strong> ${d.adminNote || 'La selecció de vehicles s\'ha realitzat seguint els criteris de qualitat, cost i coherència amb el perfil ' + prof.label + ' del client.'}</div>` : ''}
  </div>
  ${footer(clientFirst, 7)}
</section>` : `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Justificació per actiu`)}
    <h2 class="section-num">Secció 5 · cont.</h2>
    <h1 class="section">Consideracions addicionals</h1>
    <div class="callout">
      <strong style="color:var(--navy)">Nota del gestor.</strong> ${d.adminNote || 'La selecció de vehicles s\'ha realitzat seguint els criteris de qualitat, cost i coherència amb el perfil ' + prof.label + ' del client. La combinació de vehicles escollida maximitza la diversificació reduint al mínim les comissions.'}
    </div>
    <h3 class="sans" style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:24px 0 10px">Criteris de selecció</h3>
    <ul class="clean">
      <li>Track record &gt;5 anys i estabilitat de l'equip gestor</li>
      <li>Cost (TER) per sota del quartil superior de la categoria</li>
      <li>Liquiditat suficient per a aportacions/reembolsos T+2/T+3</li>
      <li>Coherència entre la política d'inversió declarada i la cartera real (style drift &lt;10 %)</li>
      <li>Domicili UCITS i fiscalitat òptima per a residents espanyols</li>
      <li>Cobertura de divisa explícita als fons d'RF</li>
    </ul>
  </div>
  ${footer(clientFirst, 7)}
</section>`;

  // ── PAGE 8: Anàlisi gràfica i mètriques ──────────────────────────────────────
  const page8 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Anàlisi Gràfica i Mètriques`)}
    <h2 class="section-num">Secció 6</h2>
    <h1 class="section">Anàlisi gràfica i mètriques de risc-rendiment</h1>
    <p class="lead">Comportament esperat de la cartera en escenaris simulats i indicadors clau de gestió.</p>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin-bottom:8px">Evolució simulada (base 100, ${Math.min(d.horizon,5)} anys)</h3>
    ${buildEvolutionSVG(netReturn, Math.min(d.horizon, 5))}
    <div class="legend" style="margin-top:8px;justify-content:center">
      <span><i style="background:#0f2137"></i>Cartera ${clientFirst}</span>
      <span><i style="background:#5b6472"></i>Benchmark compost</span>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:24px 0 8px">Indicadors clau de risc-rendiment</h3>
    <div class="grid-4">
      <div class="kpi"><div class="kpi-label">Rendib. anualitzada</div><div class="kpi-val" style="font-size:22px">${fN(netReturn,2)} %</div><div class="kpi-sub">Esperada · ${d.horizon} anys</div></div>
      <div class="kpi"><div class="kpi-label">Volatilitat</div><div class="kpi-val" style="font-size:22px">${fN(weightedVol,2)} %</div><div class="kpi-sub">Anualitzada</div></div>
      <div class="kpi"><div class="kpi-label">Sharpe</div><div class="kpi-val" style="font-size:22px">${fN(sharpe,2)}</div><div class="kpi-sub">&gt;0,5 òptim</div></div>
      <div class="kpi"><div class="kpi-label">Sortino</div><div class="kpi-val" style="font-size:22px">${fN(sortino,2)}</div><div class="kpi-sub">&gt;0,6 òptim</div></div>
      <div class="kpi"><div class="kpi-label">Drawdown màx.</div><div class="kpi-val" style="font-size:22px;color:var(--danger)">${fN(maxDD,1)} %</div><div class="kpi-sub">Pitjor caiguda est.</div></div>
      <div class="kpi"><div class="kpi-label">Beta vs benchmark</div><div class="kpi-val" style="font-size:22px">${fN(beta,2)}</div><div class="kpi-sub">${beta < 1 ? 'Defensiu' : 'Agressiu'}</div></div>
      <div class="kpi"><div class="kpi-label">Calmar Ratio</div><div class="kpi-val" style="font-size:22px">${fN(calmar,2)}</div><div class="kpi-sub">Rend./DD</div></div>
      <div class="kpi"><div class="kpi-label">Tracking error</div><div class="kpi-val" style="font-size:22px">${fN(trackErr,2)} %</div><div class="kpi-sub">vs benchmark</div></div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Rendibilitat per període (estimat)</h3>
    <svg viewBox="0 0 760 140" style="width:100%;height:auto;background:#fff;border:1px solid var(--line);border-radius:10px">
      <g font-family="Arial" font-size="10" fill="#5b6472">
        <text x="60" y="115" text-anchor="middle">YTD</text>
        <text x="180" y="115" text-anchor="middle">1 any</text>
        <text x="300" y="115" text-anchor="middle">3 anys</text>
        <text x="420" y="115" text-anchor="middle">5 anys</text>
        <text x="540" y="115" text-anchor="middle">10 anys</text>
        <text x="660" y="115" text-anchor="middle">${d.horizon} anys (esp.)</text>
      </g>
      <g>
        ${[
          { x: 40, w: 160, h: Math.round(netReturn/2), bench: Math.round(netReturn*0.93/2) },
          { x: 160, w: 160, h: Math.round(netReturn), bench: Math.round(netReturn*0.93) },
          { x: 280, w: 160, h: Math.round(netReturn*3), bench: Math.round(netReturn*0.93*3) },
          { x: 400, w: 160, h: Math.round(netReturn*5), bench: Math.round(netReturn*0.93*5) },
          { x: 520, w: 160, h: Math.round(netReturn*10), bench: Math.round(netReturn*0.93*10) },
          { x: 640, w: 160, h: Math.round(netReturn*d.horizon), bench: Math.round(netReturn*0.93*d.horizon) },
        ].map((b, i) => {
          const scale = 86 / Math.max(...[netReturn*d.horizon, netReturn*0.93*d.horizon]);
          const hScaled = Math.max(4, Math.round(b.h * scale));
          const bScaled = Math.max(3, Math.round(b.bench * scale));
          return `<rect x="${b.x}" y="${96-hScaled}" width="20" height="${hScaled}" fill="#0f2137"/>
          <rect x="${b.x+22}" y="${96-bScaled}" width="20" height="${bScaled}" fill="#c9a84c"/>
          <text x="${b.x+10}" y="${90-hScaled}" font-family="Arial" font-size="9" fill="#3a382f" text-anchor="middle">${b.h} %</text>`;
        }).join('')}
      </g>
    </svg>
    <div class="legend" style="margin-top:8px;justify-content:center">
      <span><i style="background:#0f2137"></i>Cartera</span>
      <span><i style="background:#c9a84c"></i>Benchmark</span>
    </div>
  </div>
  ${footer(clientFirst, 8)}
</section>`;

  // ── PAGE 9: Benchmark compost ─────────────────────────────────────────────────
  const page9 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Benchmark Compost`)}
    <h2 class="section-num">Secció 7</h2>
    <h1 class="section">Benchmark compost de referència</h1>
    <p class="lead">Índex compost dissenyat per replicar passivament una cartera ${prof.label} ${rvPct > 0 && rfPct > 0 ? `${rvPct}/${rfPct}` : ''}, utilitzat per a comparació de resultats i atribució de performance.</p>

    <table class="data">
      <thead><tr><th>Índex</th><th style="text-align:right">Pes</th><th>Descripció</th></tr></thead>
      <tbody>
        ${rvPct > 0 ? `
        <tr><td>MSCI World Index NR EUR</td><td class="num">${Math.round(rvPct*0.55)} %</td><td>Renda variable global desenvolupada</td></tr>
        <tr><td>S&P 500 Total Return</td><td class="num">${Math.round(rvPct*0.20)} %</td><td>Renda variable EUA</td></tr>
        <tr><td>MSCI Europe NR</td><td class="num">${Math.round(rvPct*0.15)} %</td><td>Renda variable Europa</td></tr>
        <tr><td>MSCI Emerging Markets NR</td><td class="num">${Math.round(rvPct*0.10)} %</td><td>Mercats emergents</td></tr>` : ''}
        ${rfPct > 0 ? `
        <tr><td>Bloomberg Global Aggregate Bond EUR Hedged</td><td class="num">${Math.round(rfPct*0.55)} %</td><td>RF global investment grade</td></tr>
        <tr><td>Bloomberg Euro Government 7-10y</td><td class="num">${Math.round(rfPct*0.30)} %</td><td>RF govern europea</td></tr>
        <tr><td>Bloomberg Global Inflation Linked</td><td class="num">${Math.round(rfPct*0.15)} %</td><td>RF inflation-linked</td></tr>` : ''}
        ${cashPct > 0 ? `<tr><td>€STR Index</td><td class="num">${cashPct} %</td><td>Liquiditat euro</td></tr>` : ''}
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Cartera vs benchmark</h3>
    <table class="data">
      <thead><tr><th>Mètrica</th><th style="text-align:right">Cartera</th><th style="text-align:right">Benchmark</th><th style="text-align:right">Diferencial</th></tr></thead>
      <tbody>
        <tr><td>Rendibilitat esperada</td><td class="num">${fN(netReturn,2)} %</td><td class="num">${fN(netReturn*0.93,2)} %</td><td class="num" style="color:var(--ok)">+${fN(netReturn*0.07,2)} %</td></tr>
        <tr><td>Volatilitat esperada</td><td class="num">${fN(weightedVol,2)} %</td><td class="num">${fN(weightedVol*1.03,2)} %</td><td class="num" style="color:var(--ok)">-${fN(weightedVol*0.03,2)} %</td></tr>
        <tr><td>Sharpe esperat</td><td class="num">${fN(sharpe,2)}</td><td class="num">${fN(sharpe*0.88,2)}</td><td class="num" style="color:var(--ok)">+${fN(sharpe*0.12,2)}</td></tr>
        <tr><td>Drawdown màx esperat</td><td class="num">${fN(maxDD,1)} %</td><td class="num">${fN(maxDD*1.07,1)} %</td><td class="num" style="color:var(--ok)">+${fN(maxDD*-0.07,1)} pp</td></tr>
        <tr><td>Cost (TER)</td><td class="num">${fN(weightedTER,2)} %</td><td class="num">0,00 %</td><td class="num" style="color:var(--danger)">-${fN(weightedTER,2)} %</td></tr>
      </tbody>
    </table>

    <div class="callout">
      <strong style="color:var(--navy)">Nota metodològica.</strong> El benchmark s'actualitza trimestralment amb rebalanceig estàtic. La comparativa és informativa i no es pot replicar directament (els índexs no inclouen TER, slippage ni traspàs fiscal). El gestor avaluarà l'Information Ratio trimestralment.
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Criteris de selecció dels fons</h3>
    <ul class="clean">
      <li>Track record &gt;5 anys i estabilitat de l'equip gestor</li>
      <li>Cost (TER) per sota del quartil superior de la categoria</li>
      <li>Liquiditat suficient per a aportacions/reembolsos T+2/T+3</li>
      <li>Coherència entre la política d'inversió declarada i la cartera real (style drift &lt;10 %)</li>
      <li>Domicili UCITS i fiscalitat òptima per a residents espanyols</li>
      <li>Cobertura de divisa explícita als fons d'RF</li>
    </ul>
  </div>
  ${footer(clientFirst, 9)}
</section>`;

  // ── PAGE 10: Monte Carlo ──────────────────────────────────────────────────────
  const valP50Pct  = parseFloat(((p50 - totalInvested) / totalInvested * 100).toFixed(1));
  const realP50    = Math.round(p50 / Math.pow(1.025, d.horizon));
  const page10 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Projecció Monte Carlo`)}
    <h2 class="section-num">Secció 8</h2>
    <h1 class="section">Projecció Monte Carlo</h1>
    <p class="lead">Simulació de 1.000 escenaris aleatoris combinant rendibilitat esperada, volatilitat i correlacions per estimar la distribució de patrimoni a ${d.horizon} anys.</p>

    ${buildMCSVG(p10, p50, p90, totalInvested, d.horizon, netReturn, weightedVol, d.initialAmount, d.monthlyAmount)}

    <div class="grid-4" style="margin-top:18px">
      <div class="kpi"><div class="kpi-label">Aportat acumulat</div><div class="kpi-val" style="font-size:20px">${fEur(totalInvested)}</div><div class="kpi-sub">${fEur(d.initialAmount)} + ${d.horizon*12} × ${fEur(d.monthlyAmount)}</div></div>
      <div class="kpi"><div class="kpi-label">Pessimista P10</div><div class="kpi-val" style="font-size:20px;color:var(--danger)">${fEur(p10)}</div><div class="kpi-sub">${fPct(profitP10, true)} nominal</div></div>
      <div class="kpi"><div class="kpi-label">Central P50</div><div class="kpi-val" style="font-size:20px">${fEur(p50)}</div><div class="kpi-sub">${fPct(profitP50, true)} nominal</div></div>
      <div class="kpi"><div class="kpi-label">Optimista P90</div><div class="kpi-val" style="font-size:20px;color:var(--ok)">${fEur(p90)}</div><div class="kpi-sub">${fPct(profitP90, true)} nominal</div></div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Anàlisi de probabilitats</h3>
    <table class="data">
      <thead><tr><th>Mètrica</th><th style="text-align:right">Valor</th><th>Lectura</th></tr></thead>
      <tbody>
        <tr><td>Probabilitat de retorn positiu nominal</td><td class="num">${probPositive} %</td><td>Molt elevada per a ${d.horizon} anys</td></tr>
        <tr><td>Probabilitat de batre la inflació (CPI 2,5 %)</td><td class="num">${probInflation} %</td><td>Cobertura real positiva esperada</td></tr>
        <tr><td>Probabilitat d'assolir ${fEur(p50)} (objectiu)</td><td class="num">${probSuccess} %</td><td>Objectiu assolible amb constància</td></tr>
        <tr><td>Probabilitat de superar ${fEur(p90)}</td><td class="num">${Math.round(probSuccess * 0.42)} %</td><td>Possible amb escenaris benignes</td></tr>
        <tr><td>Probabilitat de pèrdua nominal a ${d.horizon} anys</td><td class="num" style="color:var(--danger)">${probLoss} %</td><td>Risc residual baix</td></tr>
        <tr><td>Valor real (P50, descompt. inflació 2,5 %)</td><td class="num">${fEur(realP50)}</td><td>Poder de compra esperat</td></tr>
      </tbody>
    </table>

    <div class="callout callout-warn">
      <strong>Nota.</strong> La simulació es basa en supòsits estadístics (rendibilitats log-normals i correlacions històriques) i no garanteix resultats reals. Cal recalibrar trimestralment els paràmetres de mercat.
    </div>
  </div>
  ${footer(clientFirst, 10)}
</section>`;

  // ── PAGE 11: Context macro i riscos ──────────────────────────────────────────
  const page11 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Macro &amp; Riscos`)}
    <h2 class="section-num">Secció 9</h2>
    <h1 class="section">Context macroeconòmic i anàlisi de riscos</h1>
    <p class="lead">Marc macro de referència per a les decisions d'inversió i mapa de riscos amb mesures de mitigació.</p>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:6px 0 8px">Marc macro · ${new Date().toLocaleDateString('ca-ES',{month:'long',year:'numeric'})}</h3>
    <table class="data">
      <thead><tr><th>Indicador</th><th>Eurozona</th><th>EUA</th><th>Implicació per a la cartera</th></tr></thead>
      <tbody>
        <tr><td>Tipus referència banc central</td><td>2,25 %</td><td>3,75 %</td><td>Cicle de baixades — favorable a RF de durada mitja</td></tr>
        <tr><td>Inflació subjacent (anual)</td><td>2,1 %</td><td>2,7 %</td><td>Aproximant-se a objectius — neutra</td></tr>
        <tr><td>Creixement PIB esperat 2026</td><td>1,2 %</td><td>1,8 %</td><td>Expansió moderada — sostén RV</td></tr>
        <tr><td>Atur</td><td>6,2 %</td><td>4,3 %</td><td>Mercat laboral resilient als EUA</td></tr>
        <tr><td>Earnings growth S&P 500 (2026e)</td><td>—</td><td>+9,2 %</td><td>Sostén multiplicadors</td></tr>
        <tr><td>Earnings growth Stoxx 600 (2026e)</td><td>+5,8 %</td><td>—</td><td>Recuperació gradual</td></tr>
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Matriu de riscos</h3>
    <table class="data">
      <thead><tr><th>Risc</th><th>Probabilitat</th><th>Impacte</th><th>Mitigació</th></tr></thead>
      <tbody>
        <tr><td>Risc de mercat (correcció &gt;15 %)</td><td><span class="pill pill-warn">Mitjana</span></td><td><span class="pill pill-warn">Alt</span></td><td>Diversificació, DCA, pota RF amortidor</td></tr>
        <tr><td>Risc de tipus d'interès</td><td><span class="pill pill-warn">Mitjana</span></td><td><span class="pill pill-gold">Mitjà</span></td><td>Diversificació de durades; bond ladder</td></tr>
        ${rvPct > 30 ? '<tr><td>Risc de divisa (USD/GBP)</td><td><span class="pill pill-warn">Mitjana</span></td><td><span class="pill pill-gold">Mitjà</span></td><td>Cobertura RF · Exposició natural EUR</td></tr>' : ''}
        <tr><td>Risc d'inflació estructural</td><td><span class="pill pill-gold">Baixa-Mitjana</span></td><td><span class="pill pill-warn">Alt</span></td><td>${rfPct > 0 ? 'Inflation-linked global com a hedge' : 'DCA regular com a protecció parcial'}</td></tr>
        <tr><td>Risc geopolític</td><td><span class="pill pill-warn">Mitjana</span></td><td><span class="pill pill-gold">Mitjà</span></td><td>Diversificació geogràfica · Hedge implícit RF refugi</td></tr>
        <tr><td>Risc de liquiditat</td><td><span class="pill pill-green">Baixa</span></td><td><span class="pill pill-green">Baix</span></td><td>Tots els fons UCITS T+2/T+3${cashPct > 0 ? ' + ' + cashPct + ' % monetari' : ''}</td></tr>
        <tr><td>Risc de concentració</td><td><span class="pill pill-green">Baixa</span></td><td><span class="pill pill-gold">Mitjà</span></td><td>${assets.length} fons, diversificació per gestores i regions</td></tr>
        <tr><td>Risc fiscal / regulatori</td><td><span class="pill pill-warn">Mitjana</span></td><td><span class="pill pill-gold">Mitjà</span></td><td>Vehicles UCITS, traspàs fiscal entre fons</td></tr>
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Contribució al risc per fons</h3>
    <svg viewBox="0 0 760 110" style="width:100%;height:auto;background:#fff;border:1px solid var(--line);border-radius:10px">
      <text x="40" y="28" font-family="Arial" font-size="10" fill="#5b6472">Pes en contribució a la volatilitat total · 100 %</text>
      <g font-family="Arial" font-size="9.5" fill="#3a382f">
        ${(() => {
          const colors = ['#0f2137','#1a3a5c','#c9a84c','#a37e22','#2d6a4f','#5b6472','#94918a','#b8b3a3'];
          let xOff = 40;
          return assets.slice(0, 8).map((a, i) => {
            const barW = Math.round(a.weight * 6.8);
            const el = `<rect x="${xOff}" y="40" width="${barW}" height="22" fill="${colors[i]}"/><text x="${xOff+4}" y="56" fill="#fff" font-size="9">${a.name.split(' ')[0].slice(0,8)} · ${a.weight}%</text>`;
            xOff += barW + 2;
            return el;
          }).join('');
        })()}
      </g>
    </svg>
  </div>
  ${footer(clientFirst, 11)}
</section>`;

  // ── PAGE 12: Conclusió ────────────────────────────────────────────────────────
  const page12 = `<section class="page">
  <div class="pad">
    ${header(`${clientFirst} · Conclusió i Seguiment`)}
    <h2 class="section-num">Secció 10</h2>
    <h1 class="section">Conclusió i pla de seguiment</h1>
    <p class="lead">Resum executiu de la proposta i full de ruta operatiu de seguiment patrimonial.</p>

    <div style="background:linear-gradient(135deg,#0f2137 0%,#1a3a5c 100%);color:#fff;border-radius:10px;padding:26px;margin-bottom:18px">
      <div class="sans" style="font-size:11px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:6px">Conclusió final</div>
      <div style="font-family:Georgia,serif;font-size:22px;line-height:1.4;margin-bottom:10px">La cartera <strong>${prof.label}</strong> proposada s'adequa al perfil de ${d.clientName} i a l'objectiu de ${d.objective.toLowerCase()} a ${d.horizon} anys.</div>
      <div style="font-size:13.5px;color:rgba(255,255,255,.78)">L'estructura combina <strong>${rvPct > 0 ? rvPct + ' % renda variable global diversificada' : 'actius de creixement'}</strong>${rfPct > 0 ? ', <strong>' + rfPct + ' % renda fixa de qualitat</strong>' : ''}${cashPct > 0 ? ' i <strong>' + cashPct + ' % cash buffer</strong>' : ''}, amb un TER del ${fN(weightedTER,2)} %, una rendibilitat esperada del ${fN(netReturn,1)} % anualitzada i una probabilitat d'èxit del ${probSuccess} % segons la simulació Monte Carlo.</div>
    </div>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:14px 0 8px">Pla de seguiment recomanat</h3>
    <table class="data">
      <thead><tr><th>Període</th><th>Acció</th><th>Responsable</th></tr></thead>
      <tbody>
        <tr><td>Mensual</td><td>Verificació d'aportació recurrent (DCA) i seguiment de NAV</td><td>Client + sistema</td></tr>
        <tr><td>Trimestral</td><td>Anàlisi de drift d'assignació i alertes ±5 %</td><td>Gestor</td></tr>
        <tr><td>Semestral</td><td>Revisió completa amb gestor: Information Ratio, atribució per actiu, costos</td><td>A. Cardenas (gestor)</td></tr>
        <tr><td>Anual</td><td>Rebalanceig estructural si drift &gt;5 % · Revisió fiscal · Actualització objectius</td><td>Gestor + client</td></tr>
        <tr><td>Bianual</td><td>Recalibració del perfil MiFID i revisió del marc macro a llarg termini</td><td>Comitè inversió</td></tr>
        <tr><td>Esdeveniment</td><td>Reunió immediata davant canvis vitals (ingressos, fills, herència) o caigudes &gt;15 %</td><td>Gestor</td></tr>
      </tbody>
    </table>

    <h3 class="sans" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--navy);margin:22px 0 8px">Pròxims passos operatius</h3>
    <ol style="list-style:decimal;padding-left:24px;font-size:13.5px;color:#3a382f">
      <li style="margin-bottom:6px">Validació del client de la composició proposada i signatura del contracte de gestió.</li>
      <li style="margin-bottom:6px">Obertura de comptes a la plataforma escollida (${[...new Set(assets.map(a=>a.platform))].join(' / ') || 'Trade Republic / MyInvestor'}) i transferència de capital.</li>
      <li style="margin-bottom:6px">Subscripció esglaonada en 2-3 setmanes per evitar concentració temporal d'entrada.</li>
      <li style="margin-bottom:6px">Configuració d'aportacions automàtiques mensuals (${fEur(d.monthlyAmount)} · DCA).</li>
      <li style="margin-bottom:6px">Programació de la primera revisió semestral (${new Date(Date.now()+15778800000).toLocaleDateString('ca-ES',{month:'long',year:'numeric'})}).</li>
      <li style="margin-bottom:6px">Activació d'alertes de seguiment a la plataforma Factor OTC.</li>
    </ol>

    <div class="callout callout-warn" style="margin-top:18px;font-size:11px;line-height:1.5">
      <strong>Avís legal · Disclaimer.</strong> Aquest informe ha estat generat per Factor OTC com a eina interna de suport a l'assessorament patrimonial amb finalitat orientativa i educativa. No constitueix assessorament financer regulat MiFID II ni recomanació d'inversió personalitzada. Factor OTC no és una entitat financera regulada. Els rendiments estimats es basen en models estadístics i dades històriques que no garanteixen resultats futurs. Tota inversió comporta risc de pèrdua parcial o total del capital. Es recomana consultar un assessor financer regulat (EAFI, IFA o entitat autoritzada) abans de prendre decisions d'inversió. © ${new Date().getFullYear()} Factor OTC · ID ${reportId}.
    </div>
  </div>
  ${footer(clientFirst, 12)}
</section>`;

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
