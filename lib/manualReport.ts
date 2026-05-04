// lib/manualReport.ts
// Generador d'informes HTML per a carteres creades manualment per l'admin.
// Mateix estil professional que stockReport.ts — light bg, navy/gold accents.

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
  return `${plus && n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
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
const PROFILE_LABEL: Record<string, string> = {
  conservador: 'Conservador', moderat: 'Moderat', dinamic: 'Dinàmic', agressiu: 'Agressiu', custom: 'Personalitzat',
};

function assetReturn(a: ManualAsset): number {
  return a.historicalReturn5Y ?? RISK_RETURN_MAP[a.risk] ?? 5;
}
function assetVol(a: ManualAsset): number {
  return a.historicalVolatility ?? RISK_VOL_MAP[a.risk] ?? 8;
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
    `<span style="width:14px;height:14px;border-radius:3px;display:inline-block;background:${i<=risk ? colors[i-1] : '#e5e7eb'};"></span>`
  ).join('')}</span>`;
}

function categoryColor(cat: string): string {
  if (/variable|equity|accions/i.test(cat)) return '#c9a84c';
  if (/fixa|bond|renda fixa/i.test(cat))    return '#16a34a';
  if (/monetari|money/i.test(cat))           return '#6b7280';
  if (/real|reit|immob/i.test(cat))          return '#8b5cf6';
  if (/alternat/i.test(cat))                 return '#ec4899';
  return '#94a3b8';
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateManualReport(d: ManualPortfolioInput): string {
  const total = d.assets.reduce((s, a) => s + a.weight, 0);
  const weightedReturn = d.assets.reduce((s, a) => s + (a.weight / 100) * assetReturn(a), 0);
  const weightedVol    = d.assets.reduce((s, a) => s + (a.weight / 100) * assetVol(a), 0);
  const weightedTER    = d.assets.reduce((s, a) => s + (a.weight / 100) * a.ter, 0);
  const weightedRisk   = d.assets.reduce((s, a) => s + (a.weight / 100) * a.risk, 0);
  const netReturn      = Math.max(0, weightedReturn - weightedTER);

  const totalInvested  = d.initialAmount + d.monthlyAmount * d.horizon * 12;
  const pBase  = projection(d.initialAmount, d.monthlyAmount, netReturn, d.horizon);
  const pPess  = projection(d.initialAmount, d.monthlyAmount, Math.max(0, netReturn - 2), d.horizon);
  const pOpt   = projection(d.initialAmount, d.monthlyAmount, netReturn + 2, d.horizon);
  const annualTerCost  = d.initialAmount * (weightedTER / 100);
  const tenYearTerCost = totalInvested * (weightedTER / 100) * d.horizon;

  const generatedAt = new Date().toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const reportId    = `MANUAL-${Date.now().toString(36).toUpperCase()}`;

  // Category aggregation for allocation bar
  const catMap: Record<string, number> = {};
  d.assets.forEach(a => { catMap[a.category] = (catMap[a.category] ?? 0) + a.weight; });
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  // Risks
  const highRiskAssets = d.assets.filter(a => a.risk >= 5);
  const maxRiskAsset   = d.assets.reduce((m, a) => a.risk > m.risk ? a : m, d.assets[0]);

  const tableRow = (a: ManualAsset) => `
  <tr style="border-bottom:1px solid #f3f4f6">
    <td style="padding:12px 14px;vertical-align:top">
      <div style="font-family:-apple-system,sans-serif;font-size:13px;font-weight:600;color:#0f2137">${a.name}</div>
      ${a.isin ? `<div style="font-family:'Courier New',monospace;font-size:10px;color:#9ca3af;margin-top:2px">${a.isin}</div>` : ''}
      ${a.ticker ? `<div style="font-family:'Courier New',monospace;font-size:10px;color:#c9a84c">${a.ticker}</div>` : ''}
    </td>
    <td style="padding:12px 14px;text-align:center;vertical-align:middle">
      <span style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:${categoryColor(a.category)}">${fN(a.weight, 1)}%</span>
    </td>
    <td style="padding:12px 14px;vertical-align:middle">
      <span style="font-family:-apple-system,sans-serif;font-size:11px;color:#6b7280;background:#f9fafb;border:1px solid #e5e7eb;padding:2px 8px;border-radius:99px;white-space:nowrap">${a.category}</span>
    </td>
    <td style="padding:12px 14px;text-align:center;vertical-align:middle">${srriBar(a.risk)}</td>
    <td style="padding:12px 14px;text-align:center;vertical-align:middle">
      <span style="font-family:'Courier New',monospace;font-size:12px;font-weight:600;color:#374151">${fN(a.ter, 2)}%</span>
    </td>
    <td style="padding:12px 14px;vertical-align:middle">
      <span style="font-family:-apple-system,sans-serif;font-size:11px;color:#0f2137;font-weight:500">${a.platform}</span>
    </td>
    <td style="padding:12px 14px;vertical-align:top;max-width:220px">
      <p style="font-family:-apple-system,sans-serif;font-size:11px;color:#6b7280;line-height:1.5;margin:0">${a.justification}</p>
    </td>
  </tr>`;

  return `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Factor OTC — Informe Manual ${d.clientName} — ${reportId}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,'Times New Roman',serif;background:#f5f5f0;color:#1a1a2e;line-height:1.6;font-size:15px}
.sans{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
@media print{body{background:#fff}.no-print{display:none}}
@media(max-width:640px){.hero-inner,.section-body,.footer-inner{padding-left:20px!important;padding-right:20px!important}}
</style>
</head>
<body>

<!-- ══ HERO ══════════════════════════════════════════════════════════════════ -->
<div style="background:#0f2137;border-left:0;position:relative">
  <div style="position:absolute;left:0;top:0;bottom:0;width:5px;background:#c9a84c"></div>
  <div class="hero-inner" style="max-width:960px;margin:0 auto;padding:40px 56px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:32px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:54px;height:54px;background:rgba(201,168,76,.12);border:1.5px solid rgba(201,168,76,.5);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M4 21 L9 13 L14 17 L19 7 L24 11" stroke="#c9a84c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <div class="sans" style="font-weight:900;font-size:17px;letter-spacing:2.5px;color:#fff">FACTOR<span style="font-weight:300;letter-spacing:4px;color:#2d6a4f;margin-left:6px">OTC</span></div>
          <div class="sans" style="font-size:10px;color:rgba(255,255,255,.3);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px">Informe de Cartera — Assessor</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="display:inline-block;padding:4px 12px;border:1px solid rgba(201,168,76,.5);border-radius:4px;background:rgba(201,168,76,.1)">
          <span class="sans" style="font-size:10px;color:#c9a84c;letter-spacing:2px;text-transform:uppercase;font-weight:700">Informe Manual Admin</span>
        </div>
        <div class="sans" style="font-size:10px;color:rgba(255,255,255,.3);margin-top:8px">${generatedAt}</div>
        <div class="sans" style="font-size:10px;color:rgba(255,255,255,.2);margin-top:2px">${reportId}</div>
      </div>
    </div>

    <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:24px">
      <div>
        <div class="sans" style="font-size:11px;color:rgba(255,255,255,.3);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Client</div>
        <h1 style="font-family:Georgia,serif;font-size:48px;font-weight:700;color:#fff;letter-spacing:-2px;line-height:1">${d.clientName}</h1>
        ${d.clientEmail ? `<div class="sans" style="font-size:13px;color:rgba(255,255,255,.4);margin-top:6px">${d.clientEmail}</div>` : ''}
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="sans" style="display:inline-block;padding:4px 12px;border:1px solid rgba(201,168,76,.35);border-radius:99px;font-size:10px;color:#c9a84c;background:rgba(201,168,76,.08);letter-spacing:.5px">
            Perfil: ${PROFILE_LABEL[d.investorProfile] ?? d.investorProfile}
          </span>
          <span class="sans" style="display:inline-block;padding:4px 12px;border:1px solid rgba(255,255,255,.15);border-radius:99px;font-size:10px;color:rgba(255,255,255,.5)">
            Horitzó: ${d.horizon} anys
          </span>
        </div>
      </div>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        ${[
          { label: 'Import inicial', value: fEur(d.initialAmount) },
          { label: 'Aportació mensual', value: fEur(d.monthlyAmount) },
          { label: 'Actius seleccionats', value: `${d.assets.length}` },
          { label: 'TER mig ponderat', value: `${fN(weightedTER, 2)}%` },
        ].map(s => `
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px 18px;min-width:130px">
          <div class="sans" style="font-size:9px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">${s.label}</div>
          <div style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#c9a84c">${s.value}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>

<!-- ══ SECCIÓ A: PERFIL CLIENT ═══════════════════════════════════════════════ -->
<div style="background:#fff;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:960px;margin:0 auto;padding:40px 56px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Secció A</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:24px">Perfil del client i objectiu d'inversió</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">
      ${[
        ['Nom', d.clientName],
        ['Email', d.clientEmail || '—'],
        ['Perfil inversor', PROFILE_LABEL[d.investorProfile] ?? d.investorProfile],
        ['Objectiu', d.objective],
        ['Horitzó temporal', `${d.horizon} anys`],
        ['Import inicial', fEur(d.initialAmount)],
        ['Aportació mensual', fEur(d.monthlyAmount)],
        ['Total invertit (estimat)', fEur(d.initialAmount + d.monthlyAmount * d.horizon * 12)],
      ].map(([label, value]) => `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px">
        <div class="sans" style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">${label}</div>
        <div class="sans" style="font-size:14px;font-weight:600;color:#0f2137">${value}</div>
      </div>`).join('')}
    </div>
    ${d.adminNote ? `
    <div style="margin-top:20px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px">
      <div class="sans" style="font-size:9px;color:#92400e;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Nota interna assessor</div>
      <p class="sans" style="font-size:13px;color:#78350f;line-height:1.6">${d.adminNote}</p>
    </div>` : ''}
  </div>
</div>

<!-- ══ SECCIÓ B: DISTRIBUCIÓ ══════════════════════════════════════════════════ -->
<div style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:960px;margin:0 auto;padding:40px 56px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Secció B</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:24px">Distribució d'actius</h2>

    <!-- Stacked bar -->
    <div style="border-radius:8px;overflow:hidden;height:16px;display:flex;margin-bottom:20px;background:#e5e7eb">
      ${catEntries.map(([cat, pct]) =>
        `<div style="width:${pct}%;background:${categoryColor(cat)};height:100%" title="${cat}: ${fN(pct,1)}%"></div>`
      ).join('')}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:28px">
      ${catEntries.map(([cat, pct]) => `
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:12px;height:12px;border-radius:3px;background:${categoryColor(cat)};display:inline-block;flex-shrink:0"></span>
        <span class="sans" style="font-size:12px;color:#374151">${cat}</span>
        <span style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:${categoryColor(cat)}">${fN(pct,1)}%</span>
      </div>`).join('')}
    </div>

    <!-- 4 summary metrics -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
      ${[
        { label: 'Rendibilitat estimada neta',   value: fPct(netReturn, true),         color: '#16a34a', sub: 'anualitzada (neta de TER)' },
        { label: 'Volatilitat estimada',          value: fPct(weightedVol),             color: '#f59e0b', sub: 'desviació estàndard' },
        { label: 'TER mig ponderat',              value: fPct(weightedTER),             color: '#0f2137', sub: 'cost anual estimat' },
        { label: 'Risc mig ponderat (SRRI)',      value: `${fN(weightedRisk,1)} / 7`,   color: '#dc2626', sub: RISK_LABEL[Math.round(weightedRisk)] ?? '' },
      ].map(s => `
      <div style="background:#0f2137;border-radius:12px;padding:20px">
        <div class="sans" style="font-size:9px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">${s.label}</div>
        <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:700;color:${s.color};line-height:1">${s.value}</div>
        <div class="sans" style="font-size:10px;color:rgba(255,255,255,.3);margin-top:6px">${s.sub}</div>
      </div>`).join('')}
    </div>
  </div>
</div>

<!-- ══ SECCIÓ C: TAULA D'ACTIUS ═══════════════════════════════════════════════ -->
<div style="background:#fff;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:960px;margin:0 auto;padding:40px 56px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Secció C</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:20px">Detall de cada actiu</h2>
    <div style="overflow-x:auto;border-radius:12px;border:1px solid #e5e7eb">
      <table style="width:100%;border-collapse:collapse;font-family:-apple-system,sans-serif">
        <thead>
          <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb">
            <th style="padding:12px 14px;text-align:left;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Fons / ETF / Acció</th>
            <th style="padding:12px 14px;text-align:center;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Pes %</th>
            <th style="padding:12px 14px;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Categoria</th>
            <th style="padding:12px 14px;text-align:center;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Risc SRRI</th>
            <th style="padding:12px 14px;text-align:center;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">TER</th>
            <th style="padding:12px 14px;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Plataforma</th>
            <th style="padding:12px 14px;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Justificació</th>
          </tr>
        </thead>
        <tbody>${d.assets.map(tableRow).join('')}</tbody>
        <tfoot>
          <tr style="background:#f9fafb;border-top:2px solid #e5e7eb">
            <td style="padding:12px 14px;font-size:12px;font-weight:700;color:#0f2137">TOTAL</td>
            <td style="padding:12px 14px;text-align:center;font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:${Math.abs(total - 100) < 0.1 ? '#16a34a' : '#dc2626'}">${fN(total, 1)}%</td>
            <td colspan="3"></td>
            <td style="padding:12px 14px;font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#0f2137">TER mig: ${fN(weightedTER, 2)}%</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</div>

<!-- ══ SECCIÓ D: PROJECCIONS ══════════════════════════════════════════════════ -->
<div style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:960px;margin:0 auto;padding:40px 56px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Secció D</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:24px">Projeccions financeres</h2>

    <div style="background:#0f2137;border-radius:14px;padding:28px;margin-bottom:24px">
      <div class="sans" style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:2px;margin-bottom:20px">
        Escenari base — ${d.horizon} anys · Rendibilitat neta estimada: ${fPct(netReturn, true)} anual
      </div>
      <div style="display:flex;gap:32px;flex-wrap:wrap;align-items:flex-end">
        <div>
          <div class="sans" style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:4px">Escenari pessimista</div>
          <div style="font-family:'Courier New',monospace;font-size:28px;font-weight:700;color:#f59e0b">${fEur(pPess)}</div>
          <div class="sans" style="font-size:10px;color:rgba(255,255,255,.25);margin-top:4px">Ret. net ${fPct(Math.max(0, netReturn - 2), true)}/any</div>
        </div>
        <div>
          <div class="sans" style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:4px">Escenari base ★</div>
          <div style="font-family:'Courier New',monospace;font-size:44px;font-weight:700;color:#c9a84c;line-height:1">${fEur(pBase)}</div>
          <div class="sans" style="font-size:10px;color:rgba(255,255,255,.25);margin-top:4px">Ret. net ${fPct(netReturn, true)}/any</div>
        </div>
        <div>
          <div class="sans" style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:4px">Escenari optimista</div>
          <div style="font-family:'Courier New',monospace;font-size:28px;font-weight:700;color:#16a34a">${fEur(pOpt)}</div>
          <div class="sans" style="font-size:10px;color:rgba(255,255,255,.25);margin-top:4px">Ret. net ${fPct(netReturn + 2, true)}/any</div>
        </div>
        <div style="border-left:1px solid rgba(255,255,255,.1);padding-left:28px">
          <div class="sans" style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:4px">Total invertit</div>
          <div style="font-family:'Courier New',monospace;font-size:20px;font-weight:600;color:rgba(255,255,255,.5)">${fEur(totalInvested)}</div>
          <div class="sans" style="font-size:10px;color:rgba(255,255,255,.25);margin-top:4px">Guany base: ${fEur(pBase - totalInvested)}</div>
        </div>
      </div>
    </div>

    <p class="sans" style="font-size:11px;color:#9ca3af;line-height:1.6">
      Projeccions calculades amb rendibilitats estimades basades en dades historials i classificació de risc dels actius seleccionats.
      Rendibilitats passades no garanteixen rendibilitats futures. La inflació no està descomptada.
    </p>
  </div>
</div>

<!-- ══ SECCIÓ E: COSTOS ═══════════════════════════════════════════════════════ -->
<div style="background:#fff;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:960px;margin:0 auto;padding:40px 56px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Secció E</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:24px">Anàlisi de costos</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px">
      ${[
        { label: 'TER mig ponderat', value: fPct(weightedTER), color: '#0f2137' },
        { label: 'Cost anual estimat', value: fEur(annualTerCost), color: '#dc2626' },
        { label: 'Cost total ${d.horizon}a estimat', value: fEur(tenYearTerCost), color: '#dc2626' },
      ].map(s => `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px">
        <div class="sans" style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">${s.label}</div>
        <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:${s.color}">${s.value}</div>
      </div>`).join('')}
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-family:-apple-system,sans-serif;font-size:12px">
        <thead><tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
          <th style="padding:10px 12px;text-align:left;color:#9ca3af;font-weight:500">Actiu</th>
          <th style="padding:10px 12px;text-align:center;color:#9ca3af;font-weight:500">Pes %</th>
          <th style="padding:10px 12px;text-align:center;color:#9ca3af;font-weight:500">TER</th>
          <th style="padding:10px 12px;text-align:center;color:#9ca3af;font-weight:500">Cost ponderat</th>
        </tr></thead>
        <tbody>${d.assets.map(a => `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:10px 12px;color:#374151">${a.name}</td>
          <td style="padding:10px 12px;text-align:center;font-family:'Courier New',monospace;color:#374151">${fN(a.weight,1)}%</td>
          <td style="padding:10px 12px;text-align:center;font-family:'Courier New',monospace;color:#374151">${fN(a.ter,2)}%</td>
          <td style="padding:10px 12px;text-align:center;font-family:'Courier New',monospace;color:#dc2626">${fN((a.weight/100)*a.ter, 3)}%</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
  </div>
</div>

<!-- ══ SECCIÓ F: RISCOS ═══════════════════════════════════════════════════════ -->
<div style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
  <div class="section-body" style="max-width:960px;margin:0 auto;padding:40px 56px">
    <div class="sans" style="font-size:10px;color:#2d6a4f;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px">Secció F</div>
    <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#0f2137;margin-bottom:24px">Riscos principals i recomanacions</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:24px">
        <div class="sans" style="font-size:10px;color:#dc2626;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px">Riscos identificats</div>
        <ul style="list-style:none;display:flex;flex-direction:column;gap:10px">
          ${highRiskAssets.length > 0 ? `<li class="sans" style="font-size:12px;color:#7f1d1d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#dc2626">—</span>${maxRiskAsset.name} (SRRI ${maxRiskAsset.risk}/7) és l'actiu de major risc de la cartera.</li>` : ''}
          ${weightedRisk >= 5 ? `<li class="sans" style="font-size:12px;color:#7f1d1d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#dc2626">—</span>Cartera d'alt risc (SRRI mig ${fN(weightedRisk,1)}). Volatilitat estimada ${fPct(weightedVol)}. Correccions del 25-40% possibles.</li>` : ''}
          ${weightedVol > 12 ? `<li class="sans" style="font-size:12px;color:#7f1d1d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#dc2626">—</span>Alta volatilitat (${fPct(weightedVol)}) requereix capacitat d'aguantar períodes de pèrdues temporals significatives.</li>` : ''}
          <li class="sans" style="font-size:12px;color:#7f1d1d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#dc2626">—</span>Risc de divisa si actius denominats en USD, GBP o altres divises no cobertes.</li>
          <li class="sans" style="font-size:12px;color:#7f1d1d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#dc2626">—</span>Risc de liquiditat en fons amb restriccions de reemborsament o cotització limitada.</li>
          <li class="sans" style="font-size:12px;color:#7f1d1d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#dc2626">—</span>Rendibilitats passades no garanteixen rendibilitats futures. Projeccions orientatives.</li>
        </ul>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px">
        <div class="sans" style="font-size:10px;color:#16a34a;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px">Recomanacions</div>
        <ul style="list-style:none;display:flex;flex-direction:column;gap:10px">
          <li class="sans" style="font-size:12px;color:#14532d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#16a34a">›</span>Revisar la cartera semestralment i rebalancejar quan els pesos desviïn >5% dels objectius.</li>
          <li class="sans" style="font-size:12px;color:#14532d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#16a34a">›</span>Mantenir fons d'emergència de 3-6 mesos fora de la cartera d'inversió.</li>
          <li class="sans" style="font-size:12px;color:#14532d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#16a34a">›</span>Aportació mensual sistemàtica permet aplicar cost-averaging i reduir el risc d'entrada.</li>
          <li class="sans" style="font-size:12px;color:#14532d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#16a34a">›</span>No retirar el capital durant crisis de mercat si l'horitzó temporal ho permet.</li>
          ${d.horizon >= 10 ? `<li class="sans" style="font-size:12px;color:#14532d;padding-left:14px;position:relative;line-height:1.5"><span style="position:absolute;left:0;color:#16a34a">›</span>Horitzó llarg (${d.horizon}a) permet tolerar volatilitat a curt termini. Estratègia buy & hold és adequada.</li>` : ''}
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- ══ FOOTER ══════════════════════════════════════════════════════════════════ -->
<div style="background:#0f2137;padding:36px 56px">
  <div class="footer-inner" style="max-width:960px;margin:0 auto;display:flex;justify-content:space-between;align-items:flex-start;gap:28px;flex-wrap:wrap">
    <div>
      <div class="sans" style="font-weight:900;font-size:16px;letter-spacing:2.5px;color:#fff">FACTOR<span style="font-weight:300;letter-spacing:4px;color:#2d6a4f;margin-left:6px">OTC</span></div>
      <div class="sans" style="font-size:11px;color:rgba(255,255,255,.3);margin-top:6px">Informe generat: ${generatedAt}</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <span class="sans" style="padding:3px 8px;border-radius:4px;font-size:9px;background:rgba(201,168,76,.15);color:#c9a84c;letter-spacing:1px;text-transform:uppercase">Informe Manual Admin</span>
        <span class="sans" style="padding:3px 8px;border-radius:4px;font-size:9px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.35);letter-spacing:1px">${reportId}</span>
      </div>
    </div>
    <div class="sans" style="font-size:11px;color:rgba(255,255,255,.3);max-width:520px;line-height:1.7">
      <strong style="color:rgba(255,255,255,.5)">Avís legal:</strong> Aquest informe ha estat creat manualment per un assessor de Factor OTC i té finalitat orientativa i educativa.
      No constitueix assessorament financer personalitzat ni regulat en el sentit de la Directiva MiFID II.
      Factor OTC no és una entitat financera regulada per la CNMV. Els rendiments passats no garanteixen rendiments futurs.
      Invertir en valors cotitzats i fons d'inversió comporta risc de pèrdua de capital. Consulteu un assessor financer autoritzat.
    </div>
  </div>
</div>

</body>
</html>`;
}
