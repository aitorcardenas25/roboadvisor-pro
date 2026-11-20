'use client';

import { PROPOSAL_TEMPLATES, templateItems } from '@/lib/proposalTemplates';
import { CAPM_ASSUMPTIONS } from '@/lib/navMath';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  proposalStats, fundToItem, hasPerformanceData, validateForApproval, proposalToReportInput, checkProposalSuitability, PROFILES,
  verifiedPerformance,
  type ClientProposal, type ProposalItem, type ProposalParams, type ProposalStats, type NavPerformanceMap,
} from '@/lib/proposalMath';
import { isValidIsin } from '@/lib/fundUniverse';
import type { RebalanceLine } from '@/lib/portfolioValuation';

type WithStats = ClientProposal & { stats: ProposalStats };
interface Data {
  client:    { name: string; email: string };
  leadProfile: string | null;
  personal:  Record<string, unknown>;
  proposals: WithStats[];
  funds:     { isin: string; name: string; category: string; source: 'advisor' | 'catalog' }[];
  holdings:  number;
  defaults:  ProposalParams;
  navPerformance?: NavPerformanceMap;
}

const OBJECTIVES = [
  'Preservació de capital', 'Creixement moderat', 'Creixement a llarg termini',
  'Màxima rendibilitat', 'Renda passiva', 'Estalvi per a jubilació',
];
const PROFILE_LABEL: Record<string, string> = { conservador: 'Conservador', moderat: 'Moderat', dinamic: 'Dinàmic', agressiu: 'Agressiu' };

const eur2 = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toLocaleString('ca-ES', { maximumFractionDigits: 6 });
const fdate = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('ca-ES');

interface ApplyPreview { mode: 'first' | 'rebalance'; lines: RebalanceLine[]; currentValue: number; newValue: number }
const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toLocaleString('ca-ES', { maximumFractionDigits: 2 })} %`;
const safeName = (s: string) => s.normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'client';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ClientProposal({ clientId, onApplied }: { clientId: string; onApplied?: () => void }) {
  const [data, setData]       = useState<Data | null>(null);
  const [error, setError]     = useState('');
  const [params, setParams]   = useState<ProposalParams | null>(null);
  const [items, setItems]     = useState<ProposalItem[]>([]);
  const [dirty, setDirty]     = useState(false);
  const [busy, setBusy]       = useState<string | null>(null);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [fundQuery, setFundQuery] = useState('');
  const [openNote, setOpenNote]   = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [applying, setApplying] = useState<{ id: string; date: string; amount: number; broker: string; transfer?: boolean; problems?: string[]; preview?: ApplyPreview } | null>(null);
  const rebalance = (data?.holdings ?? 0) > 0;   // la cartera ja té posicions → reestructuració

  const api = `/api/admin/clients/${clientId}/proposals`;

  const load = useCallback(async (resetEditor = true) => {
    setError('');
    try {
      const res = await fetch(api);
      if (!res.ok) { setError('No s\'ha pogut carregar la proposta'); return; }
      const d = await res.json() as Data;
      setData(d);
      if (resetEditor) {
        const latest = d.proposals[0];
        if (latest) {
          const { profile, objective, horizon, initialAmount, monthlyAmount, adminNote } = latest;
          setParams({ profile, objective, horizon, initialAmount, monthlyAmount, adminNote });
          // Un esborrany agafa els preus entrats a mà des de l'últim desament
          setItems(latest.status === 'draft'
            ? latest.items.map(x => ({ ...x, ...verifiedPerformance(x.isin, d.navPerformance ?? {}) }))
            : latest.items);
        } else {
          setParams(d.defaults);
          setItems([]);
        }
        setDirty(false);
      }
    } catch { setError('Error de connexió'); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const latest = data?.proposals[0];
  const editingApproved = latest?.status === 'approved';
  const stats = useMemo(() => params ? proposalStats({ ...params, items }) : null, [params, items]);
  const suit = useMemo(
    () => params && data ? checkProposalSuitability({ ...params, items }, data.personal, data.leadProfile ?? undefined) : null,
    [params, items, data],
  );
  const needsOverride = suit?.status === 'inadequate' && overrideReason.trim().length < 10;
  const approvalProblem = params ? validateForApproval({ ...params, items }) : 'Carregant';

  if (error) return <p className="text-negative text-sm">{error}</p>;
  if (!data || !params || !stats || !suit) return <p className="text-ink-muted text-sm">Carregant…</p>;

  const setP = (patch: Partial<ProposalParams>) => { setParams({ ...params, ...patch }); setDirty(true); };
  const setItem = (i: number, patch: Partial<ProposalItem>) => {
    setItems(items.map((x, j) => j === i ? { ...x, ...patch } : x)); setDirty(true);
  };
  const removeItem = (i: number) => { setItems(items.filter((_, j) => j !== i)); setDirty(true); };

  const addFund = () => {
    const raw = fundQuery.trim();
    const isin = (raw.match(/[A-Z]{2}[A-Z0-9]{9}\d/i)?.[0] ?? raw).toUpperCase();
    if (items.some(x => x.isin === isin)) { setMsg({ ok: false, text: 'Aquest fons ja és a la proposta' }); return; }
    const known = fundToItem(isin, 0, data.navPerformance ?? {});
    if (known) { setItems([...items, known]); }
    else if (isValidIsin(isin)) {
      setItems([...items, { isin, name: '', category: '', weight: 0, risk: 5, ter: 0, platform: '', justification: '' }]);
      setMsg({ ok: true, text: 'ISIN fora de la llista: omple el nom, el SRRI i el TER a mà.' });
    } else { setMsg({ ok: false, text: 'Tria un fons de la llista o escriu un ISIN vàlid' }); return; }
    setFundQuery(''); setDirty(true);
  };

  const loadTemplate = (id: string) => {
    if (!id) return;
    const t = PROPOSAL_TEMPLATES.find(x => x.id === id);
    const next = templateItems(id, data.navPerformance ?? {});
    if (!t || !next) { setMsg({ ok: false, text: 'No s\'ha pogut carregar la plantilla.' }); return; }
    if (items.length && !confirm('Això substituirà els fons de l\'editor. Continuar?')) return;
    setItems(next); setDirty(true);
    setMsg({ ok: true, text: `Plantilla "${t.label}" (perfil ${PROFILE_LABEL[t.profile]}). És un punt de partida: revisa-la i ajusta-la.` });
  };

  const start = async (action: 'suggest' | 'fromHoldings') => {
    if (items.length && !confirm('Això substituirà els fons de l\'editor. Continuar?')) return;
    setBusy(action); setMsg(null);
    try {
      const res = await fetch(api, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'suggest'
          ? { action, profile: params.profile, initialAmount: params.initialAmount, monthlyAmount: params.monthlyAmount }
          : { action }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? 'Error' }); return; }
      setItems(d.items); setDirty(true);
      setMsg({ ok: true, text: action === 'suggest'
        ? `Punt de partida per a perfil ${PROFILE_LABEL[params.profile]}. Revisa'l i ajusta'l.`
        : 'Carregats els pesos actuals de la cartera del client.' });
    } catch { setMsg({ ok: false, text: 'Error de connexió' }); }
    finally { setBusy(null); }
  };

  const save = async (): Promise<WithStats | null> => {
    const res = await fetch(api, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, items }),
    });
    const d = await res.json();
    if (!res.ok) {
      const issue = d.issues?.[0];
      setMsg({ ok: false, text: issue ? `${d.error}: ${issue.path.join('.')} ${issue.message}` : d.error ?? 'No s\'ha pogut desar' });
      return null;
    }
    return d.proposal as WithStats;
  };

  const onSave = async () => {
    setBusy('save'); setMsg(null);
    try {
      const p = await save();
      if (p) { setMsg({ ok: true, text: `Esborrany desat (versió ${p.version}).` }); await load(); }
    } catch { setMsg({ ok: false, text: 'Error de connexió' }); }
    finally { setBusy(null); }
  };

  const generatePdf = async (p: ClientProposal) => {
    const [{ pdf }, { ManualReportPDF }] = await Promise.all([
      import('@react-pdf/renderer'), import('@/components/pdf/ManualReportPDF'),
    ]);
    const input = proposalToReportInput(p, data.client, data.personal);
    const when = new Date(p.approvedAt ?? p.updatedAt).toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const blob = await pdf(<ManualReportPDF data={input} generatedAt={when} />).toBlob();
    download(blob, `FACTOR_OTC_informe_${safeName(data.client.name)}_v${p.version}.pdf`);
  };

  const downloadExcel = async (p: ClientProposal) => {
    const res = await fetch(`${api}/${p.id}/excel`);
    if (!res.ok) throw new Error('excel');
    download(await res.blob(), `FACTOR_OTC_proposta_${safeName(data.client.name)}_v${p.version}.xlsx`);
  };

  // Envia l'informe inicial al client: fins llavors no el veu (ni el portal sencer)
  const onShare = async (p: ClientProposal) => {
    if (!confirm(`Enviar l'informe inicial (v${p.version}) a ${data.client.name}? A partir d'ara el veurà al seu portal i tindrà accés a tot.`)) return;
    setBusy(`share-${p.id}`); setMsg(null);
    try {
      const res = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share', id: p.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? 'No s\'ha pogut enviar' }); return; }
      setMsg({ ok: true, text: `Informe v${p.version} enviat: ${data.client.name} ja el pot veure al portal.` });
      await load();
      onApplied?.();
    } finally { setBusy(null); }
  };

  const onApprove = async () => {
    if (!confirm('Un cop aprovada, aquesta versió queda congelada i es genera l\'informe. Continuar?')) return;
    setBusy('approve'); setMsg(null);
    try {
      const draft = await save();
      if (!draft) return;
      const res = await fetch(api, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve', id: draft.id, expectedUpdatedAt: draft.updatedAt,
          overrideReason: suit.status === 'inadequate' ? overrideReason : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? 'No s\'ha pogut aprovar' }); await load(false); return; }
      const approved = d.proposal as WithStats;
      setOverrideReason('');
      setBusy('report');
      await generatePdf(approved);
      await downloadExcel(approved).catch(() => setMsg({ ok: false, text: 'Aprovada i PDF generat, però l\'Excel ha fallat. Torna-ho a provar des de l\'historial.' }));
      setMsg(m => m ?? { ok: true, text: `Versió ${approved.version} aprovada. S'han descarregat el PDF i l'Excel. El client encara no la veu: prem «Enviar al client» quan la vulguis ensenyar.` });
      await load();
      onApplied?.();   // refresca els comptadors de la capçalera (informes inicials)
    } catch (err) {
      console.error(err);
      setMsg({ ok: false, text: 'Error generant l\'informe. La proposta pot haver quedat aprovada: revisa l\'historial.' });
      await load(false);
    } finally { setBusy(null); }
  };

  const fromHistory = async (p: ClientProposal, kind: 'pdf' | 'excel') => {
    setBusy(`${kind}-${p.id}`); setMsg(null);
    try { if (kind === 'pdf') await generatePdf(p); else await downloadExcel(p); }
    catch { setMsg({ ok: false, text: 'No s\'ha pogut descarregar' }); }
    finally { setBusy(null); }
  };

  // dryRun = true: calcula les operacions; false: les executa (després de revisar-les).
  const onApply = async (dryRun: boolean) => {
    if (!applying) return;
    const p = data.proposals.find(x => x.id === applying.id);
    if (!p) return;
    if (!dryRun) {
      const pv = applying.preview;
      if (!pv) return;
      const sells = pv.lines.filter(l => l.side === 'sell').length, buys = pv.lines.length - sells;
      const what = pv.mode === 'first'
        ? `Es crearan ${buys} posicions per un total de ${eur(pv.newValue)}`
        : `Es registraran ${sells} vendes i ${buys} compres per passar la cartera a la v${p.version}`;
      if (!confirm(`${what}, al valor liquidatiu oficial del ${fdate(applying.date)} o anterior. Continuar?`)) return;
    }
    setBusy(`apply-${applying.id}`); setMsg(null);
    try {
      const res = await fetch(api, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', id: applying.id, date: applying.date, amount: applying.amount, broker: applying.broker, transfer: rebalance && applying.transfer !== false, dryRun }),
      });
      const d = await res.json();
      if (!res.ok) { setApplying(a => a && { ...a, problems: d.problems ?? [], preview: undefined }); setMsg({ ok: false, text: d.error ?? 'No s\'ha pogut passar a la cartera' }); return; }
      if (dryRun) { setApplying(a => a && { ...a, problems: undefined, preview: d as ApplyPreview }); return; }
      setApplying(null);
      setMsg({ ok: true, text: d.mode === 'first'
        ? `Versió ${p.version} passada a la cartera activa: ${d.lines.length} posicions creades. Les trobaràs a "Cartera activa".`
        : `Cartera reestructurada a la v${p.version}: ${d.lines.length} operacions registrades. Les trobaràs a "Cartera activa" i "Compres".` });
      await load(false);
      onApplied?.();   // la fitxa torna a carregar la cartera
    } catch { setMsg({ ok: false, text: 'Error de connexió' }); }
    finally { setBusy(null); }
  };

  const card  = 'bg-surface border border-line rounded-lg p-5';
  const input = 'bg-subtle border border-line rounded-lg px-2 py-1.5 text-ink text-xs focus:outline-none focus:border-accent/50';
  const th    = 'text-left text-ink-muted text-[11px] font-medium font-medium pb-2 pr-2';

  return (
    <div className="space-y-5">
      {/* Estat */}
      <div className={`${card} flex flex-wrap items-center gap-3 text-sm`}>
        {!latest && <span className="text-ink-soft">Encara no hi ha cap proposta per a aquest client.</span>}
        {latest?.status === 'draft' && <span className="text-ink-soft">Editant l&apos;<b className="text-ink">esborrany v{latest.version}</b>.</span>}
        {editingApproved && (
          <span className="text-ink-soft">
            La <b className="text-ink">v{latest.version}</b> està aprovada. Si canvies alguna cosa i deses, es crearà la <b className="text-ink">v{latest.version + 1}</b> (reestructuració).
          </span>
        )}
        {dirty && <span className="text-warning text-xs">Canvis sense desar</span>}
      </div>

      {/* Paràmetres */}
      <div className={card}>
        <h3 className="text-ink-soft text-xs font-medium mb-4">Paràmetres</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <label className="text-ink-muted text-xs space-y-1">Perfil
            <select value={params.profile} onChange={e => setP({ profile: e.target.value as ProposalParams['profile'] })} className={`${input} w-full`}>
              {PROFILES.map(p => <option key={p} value={p}>{PROFILE_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="text-ink-muted text-xs space-y-1 col-span-2 md:col-span-1">Objectiu
            <input list="proposal-objectives" value={params.objective} onChange={e => setP({ objective: e.target.value })} className={`${input} w-full`} />
            <datalist id="proposal-objectives">{OBJECTIVES.map(o => <option key={o} value={o} />)}</datalist>
          </label>
          <label className="text-ink-muted text-xs space-y-1">Horitzó (anys)
            <input type="number" min={1} max={50} value={params.horizon} onChange={e => setP({ horizon: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className={`${input} w-full`} />
          </label>
          <label className="text-ink-muted text-xs space-y-1">Import inicial (€)
            <input type="number" min={0} value={params.initialAmount} onChange={e => setP({ initialAmount: Math.max(0, Number(e.target.value) || 0) })} className={`${input} w-full`} />
          </label>
          <label className="text-ink-muted text-xs space-y-1">Aportació mensual (€)
            <input type="number" min={0} value={params.monthlyAmount} onChange={e => setP({ monthlyAmount: Math.max(0, Number(e.target.value) || 0) })} className={`${input} w-full`} />
          </label>
        </div>
      </div>

      {/* Fons */}
      <div className={card}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h3 className="text-ink-soft text-xs font-medium mr-auto">Fons de la proposta</h3>
          <button disabled={!!busy} onClick={() => start('suggest')}
            className="px-3 py-1.5 rounded-lg bg-subtle-strong text-ink text-xs hover:bg-subtle-strong disabled:opacity-40">
            {busy === 'suggest' ? 'Calculant…' : 'Suggerir segons perfil'}
          </button>
          <select value="" disabled={!!busy} onChange={e => loadTemplate(e.target.value)} aria-label="Carregar plantilla"
            className="px-2 py-1.5 rounded-lg bg-subtle-strong text-ink text-xs hover:bg-subtle-strong disabled:opacity-40">
            <option value="">Plantilla de les sessions…</option>
            {PROPOSAL_TEMPLATES.map(t => <option key={t.id} value={t.id} title={t.description}>{t.label}</option>)}
          </select>
          {data.holdings > 0 && (
            <button disabled={!!busy} onClick={() => start('fromHoldings')}
              className="px-3 py-1.5 rounded-lg bg-subtle-strong text-ink text-xs hover:bg-subtle-strong disabled:opacity-40">
              Partir de la cartera actual
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <input list="proposal-funds" value={fundQuery} onChange={e => setFundQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addFund(); }}
            placeholder="Cerca un fons pel nom o l'ISIN…" className={`${input} flex-1 min-w-[240px]`} />
          <datalist id="proposal-funds">
            {data.funds.map(f => <option key={f.isin} value={`${f.isin} · ${f.name}`}>{f.source === 'advisor' ? '★ Llista de l\'assessor' : f.category}</option>)}
          </datalist>
          <button onClick={addFund} disabled={!fundQuery.trim()}
            className="px-3 py-1.5 rounded-lg bg-accent-soft text-accent text-xs font-medium hover:bg-accent/30 disabled:opacity-40">Afegir</button>
        </div>

        {items.length === 0 ? (
          <p className="text-ink-muted text-sm">Afegeix fons o fes servir &quot;Suggerir segons perfil&quot; com a punt de partida.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {['ISIN', 'Fons', 'Pes %', 'Import', 'SRRI', 'TER %', 'Plataforma', ''].map(h => <th key={h} className={th}>{h}</th>)}
              </tr></thead>
              <tbody>{items.map((x, i) => (
                <FundRow key={x.isin} x={x} i={i} amount={params.initialAmount * x.weight / 100} input={input}
                  noteOpen={openNote === x.isin} toggleNote={() => setOpenNote(openNote === x.isin ? null : x.isin)}
                  setItem={setItem} removeItem={removeItem} />
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mètriques */}
      <div className={card}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Suma de pesos" value={pct(stats.totalWeight)} tone={stats.weightOk ? 'ok' : 'bad'} />
          <Metric label={stats.returnBasis === 'historic' ? 'Rendiment net (històric)' : 'Rendiment net esperat'} value={stats.complete ? `${pct(stats.netReturn)} / any` : '—'} sub={!stats.complete ? 'Falten dades' : stats.terMissing.length ? `Brut ${pct(stats.grossReturn)} − TER incomplet` : `Brut ${pct(stats.grossReturn)} − TER ${pct(stats.ter)}`} />
          <Metric label="Volatilitat" value={stats.complete ? pct(stats.volatility) : '—'} sub={`SRRI mitjà ${stats.risk.toFixed(1)}`} />
          <Metric label={`Total aportat (${params.horizon} anys)`} value={eur(stats.totalInvested)} />
          <Metric label="Escenari desfavorable" value={stats.complete ? eur(stats.p10) : '—'} />
          <Metric label="Escenari central" value={stats.complete ? eur(stats.p50) : '—'} />
          <Metric label="Escenari favorable" value={stats.complete ? eur(stats.p90) : '—'} />
          <Metric label="Fons" value={String(items.length)} sub={!stats.complete ? `${stats.missing.length} sense dades` : stats.terMissing.length ? `Falta el TER de ${stats.terMissing.length}` : 'Tots amb dades reals'} tone={stats.complete && !stats.terMissing.length ? undefined : 'bad'} />
        </div>
{stats.complete ? (
          <p className="text-ink-muted text-[11px] mt-4">
            {stats.returnBasis === 'historic'
              ? 'Rendibilitat i volatilitat històriques anualitzades de cada fons.'
              : `Rendiment esperat amb el CAPM: ${CAPM_ASSUMPTIONS.riskFree.toLocaleString('ca-ES')} % (tipus de dipòsit del BCE) + beta de cada fons × ${CAPM_ASSUMPTIONS.equityPremium.toLocaleString('ca-ES')} % (prima de risc, Damodaran). Els últims anys la cartera va fer un ${pct(stats.historicReturn)} anual, però no es fa servir per projectar.${stats.returnBasis === 'mixed' ? ' Els fons sense beta fan servir la rendibilitat històrica.' : ''}`}
            {' '}Són les mateixes xifres que sortiran a l&apos;informe.
          </p>
        ) : (
          <p className="text-negative/90 text-xs mt-4">
            Sense projecció: falten rendibilitat i volatilitat reals de {stats.missing.map(m => m.name).join(', ')}.
            Penja la fitxa del fons (Morningstar) per afegir-les. Fins llavors la proposta es pot desar però no aprovar.
          </p>
        )}
      </div>

      {/* Idoneïtat */}
      <div className={`${card} ${suit.status === 'inadequate' ? 'border-negative/40' : suit.status === 'borderline' ? 'border-warning/30' : ''}`}>
        <h3 className="text-ink-soft text-xs font-medium mb-2">Idoneïtat per al client</h3>
        {suit.status === 'adequate' ? (
          <p className="text-positive text-sm">Idònia: encaixa amb el perfil, el coneixement i la liquiditat del client.</p>
        ) : (
          <ul className="space-y-1">
            {suit.issues.map((it, i) => (
              <li key={i} className={`text-xs ${it.level === 'inadequate' ? 'text-negative' : 'text-warning/80'}`}>
                {it.level === 'inadequate' ? '✕' : '!'} {it.message}
              </li>
            ))}
          </ul>
        )}
        {suit.status === 'inadequate' && (
          <label className="block mt-3 text-ink-soft text-xs">
            Per aprovar-la igualment, escriu el motiu (queda registrat):
            <textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} rows={2}
              placeholder="p. ex. el client ho ha demanat explícitament després d'explicar-li el risc"
              className={`${input} w-full mt-1`} />
          </label>
        )}
      </div>

      {/* Nota i accions */}
      <div className={card}>
        <label className="text-ink-muted text-xs block mb-1">Nota de l&apos;assessor (surt a l&apos;informe)</label>
        <textarea value={params.adminNote} onChange={e => setP({ adminNote: e.target.value })} rows={3}
          className={`${input} w-full text-sm`} />
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {msg && <p className={`text-sm mr-auto ${msg.ok ? 'text-positive' : 'text-negative'}`}>{msg.text}</p>}
          <button disabled={!!busy || !dirty} onClick={onSave}
            className="ml-auto px-4 py-2 rounded-lg bg-subtle-strong text-ink text-sm hover:bg-subtle-strong disabled:opacity-40">
            {busy === 'save' ? 'Desant…' : 'Desar esborrany'}
          </button>
          <button disabled={!!busy || !!approvalProblem || needsOverride || (editingApproved && !dirty)} onClick={onApprove}
            title={approvalProblem ?? (needsOverride ? 'La proposta no és idònia: escriu el motiu' : editingApproved && !dirty ? 'Aquesta versió ja està aprovada' : '')}
            className="px-5 py-2 rounded-lg bg-accent text-accent-ink text-sm font-bold hover:bg-accent-hover disabled:opacity-40">
            {busy === 'approve' ? 'Aprovant…' : busy === 'report' ? 'Generant informe…' : 'Aprovar i generar informe'}
          </button>
        </div>
        {approvalProblem && items.length > 0 && <p className="text-warning/70 text-xs mt-2 text-right">{approvalProblem}</p>}
      </div>

      {/* Historial */}
      {data.proposals.length > 0 && (
        <div className={card}>
          <h3 className="text-ink-soft text-xs font-medium mb-3">Versions</h3>
          <ul className="divide-y divide-line">
            {data.proposals.map(p => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2 text-xs">
                <span className="text-ink font-semibold w-8">v{p.version}</span>
                <span className={`px-2 py-0.5 rounded-full ${p.status === 'approved' ? 'bg-positive/15 text-positive' : 'bg-subtle-strong text-ink-soft'}`}>
                  {p.status === 'approved' ? 'Aprovada' : 'Esborrany'}
                </span>
                <span className="text-ink-muted">{new Date(p.approvedAt ?? p.updatedAt).toLocaleDateString('ca-ES')}</span>
                {p.suitabilityOverride && <span className="text-negative" title={p.suitabilityOverride}>No idònia (justificada)</span>}
                <span className="text-ink-soft">{p.items.length} fons · {PROFILE_LABEL[p.profile]} · {p.stats.complete ? `${pct(p.stats.netReturn)} net` : 'dades incompletes'}</span>
                {p.status === 'approved' && (p.sharedAt
                  ? <span className="text-positive/80">Enviat al client el {new Date(p.sharedAt).toLocaleDateString('ca-ES')}</span>
                  : <span className="text-warning">Encara no l&apos;ha vist el client</span>)}
                {p.status === 'approved' && (
                  <span className="ml-auto flex gap-2">
                    {!p.sharedAt && <button disabled={!!busy} onClick={() => onShare(p)}
                      className="px-2 py-0.5 rounded-md bg-accent text-accent-ink font-semibold disabled:opacity-40">
                      {busy === `share-${p.id}` ? 'Enviant…' : 'Enviar al client'}
                    </button>}
                    {p.stats.complete && <button disabled={!!busy} onClick={() => fromHistory(p, 'pdf')} className="text-accent hover:underline disabled:opacity-40">
                      {busy === `pdf-${p.id}` ? 'Generant…' : 'PDF'}
                    </button>}
                    <button disabled={!!busy} onClick={() => fromHistory(p, 'excel')} className="text-accent hover:underline disabled:opacity-40">
                      {busy === `excel-${p.id}` ? 'Descarregant…' : 'Excel'}
                    </button>
                    {p.appliedAt
                      ? <span className="text-positive/80">A la cartera des del {new Date(p.appliedAt).toLocaleDateString('ca-ES')}</span>
                      : <button
                          disabled={!!busy}
                          title={rebalance ? 'Calcula les vendes i compres per passar la cartera actual als pesos d\'aquesta versió' : undefined}
                          onClick={() => setApplying(a => a?.id === p.id ? null : { id: p.id, date: new Date().toISOString().slice(0, 10), amount: rebalance ? 0 : p.initialAmount, broker: '' })}
                          className="text-accent hover:underline disabled:opacity-40">
                          {rebalance ? 'Reestructurar la cartera' : 'Passar a cartera activa'}
                        </button>}
                  </span>
                )}
                {applying?.id === p.id && (
                  <div className="w-full mt-2 p-3 rounded-lg bg-subtle border border-line space-y-3">
                    <p className="text-ink-soft">
                      {rebalance
                        ? 'Es valora la cartera actual amb els valors liquidatius oficials (Preus dels fons) de la data triada, s\'hi suma l\'aportació nova i es calculen les vendes i compres per arribar als pesos d\'aquesta versió. Primer revisa les operacions; després, executa-les.'
                        : 'Es compra cada fons al seu valor liquidatiu oficial (Preus dels fons) de la data triada o de l\'últim dia anterior amb preu.'}
                    </p>
                    <div className="flex flex-wrap gap-3 items-end">
                      <label className="flex flex-col gap-1 text-ink-muted">{rebalance ? 'Data de les operacions' : 'Data de compra'}
                        <input type="date" className={input} value={applying.date} max={new Date().toISOString().slice(0, 10)}
                          onChange={e => setApplying({ ...applying, date: e.target.value, problems: undefined, preview: undefined })} />
                      </label>
                      <label className="flex flex-col gap-1 text-ink-muted">{rebalance ? 'Aportació nova (€)' : 'Import (€)'}
                        <input type="number" min={0} step={100} className={input} value={applying.amount}
                          onChange={e => setApplying({ ...applying, amount: Number(e.target.value), problems: undefined, preview: undefined })} />
                      </label>
                      <label className="flex flex-col gap-1 text-ink-muted">{rebalance ? 'Entitat (fons nous)' : 'Entitat'}
                        <input type="text" className={input} value={applying.broker} placeholder="p. ex. MyInvestor"
                          onChange={e => setApplying({ ...applying, broker: e.target.value })} />
                      </label>
                      {rebalance && (
                        <label className="flex items-center gap-2 text-ink-soft pb-1.5" title="Els traspassos entre fons no tributen (art. 94 LIRPF); el fons nou hereta el cost i la data. Els ETF no es poden traspassar.">
                          <input type="checkbox" checked={applying.transfer !== false}
                            onChange={e => setApplying({ ...applying, transfer: e.target.checked })} />
                          Com a traspassos (no tributen)
                        </label>
                      )}
                      <button disabled={!!busy || !applying.date || (!rebalance && !(applying.amount > 0)) || applying.amount < 0} onClick={() => onApply(true)}
                        className="px-3 py-1.5 rounded-lg bg-subtle-strong text-ink hover:bg-subtle-strong disabled:opacity-40">
                        {busy === `apply-${p.id}` && !applying.preview ? 'Calculant…' : 'Calcular les operacions'}
                      </button>
                    </div>
                    {!!applying.problems?.length && (
                      <ul className="list-disc pl-5 text-negative space-y-0.5">
                        {applying.problems.map(x => <li key={x}>{x}</li>)}
                      </ul>
                    )}
                    {applying.preview && (
                      <div className="space-y-2">
                        {applying.preview.mode === 'rebalance' && (
                          <p className="text-ink-soft">
                            Valor actual {eur2(applying.preview.currentValue)}
                            {applying.amount > 0 && <> + aportació {eur2(applying.amount)}</>} = <span className="text-ink font-semibold">{eur2(applying.preview.newValue)}</span> a repartir segons la v{p.version}.
                          </p>
                        )}
                        {applying.preview.lines.length === 0
                          ? <p className="text-positive/80">La cartera ja té aquests pesos: no cal cap operació.</p>
                          : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[560px]">
                              <thead><tr>
                                <th className={th}>Operació</th><th className={th}>Fons</th>
                                <th className={`${th} text-right`}>Participacions</th><th className={`${th} text-right`}>VL oficial</th>
                                <th className={`${th} text-right`}>Import</th><th className={`${th} text-right`}>Pes objectiu</th>
                              </tr></thead>
                              <tbody className="divide-y divide-line">
                                {applying.preview.lines.map(l => (
                                  <tr key={l.isin}>
                                    <td className={`py-1.5 pr-2 font-semibold ${l.side === 'sell' ? 'text-negative' : 'text-positive'}`}>
                                      {l.side === 'sell' ? (l.targetQty === 0 ? 'Venda total' : 'Venda') : (l.currentQty === 0 ? 'Compra (nou)' : 'Compra')}
                                    </td>
                                    <td className="py-1.5 pr-2 text-ink">{l.name}<span className="text-ink-muted"> · {l.isin}</span></td>
                                    <td className="py-1.5 pr-2 text-right tabular-nums text-ink">{qty(l.quantity)}</td>
                                    <td className="py-1.5 pr-2 text-right tabular-nums text-ink-soft">{eur2(l.nav)} <span className="text-ink-muted">({fdate(l.navDate)})</span></td>
                                    <td className="py-1.5 pr-2 text-right tabular-nums text-ink">{eur2(l.amount)}</td>
                                    <td className="py-1.5 text-right tabular-nums text-ink-soft">{pct(l.weight)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {applying.preview.mode === 'rebalance' && applying.preview.lines.length > 0 && (
                          <p className="text-ink-soft">
                            {applying.transfer !== false
                              ? 'Es registraran com a traspassos entre fons: no tributen i el fons nou hereta el cost i la data d\'adquisició. Si hi ha algun ETF, la seva venda sí que tributa.'
                              : 'Es registraran com a vendes i compres: les vendes amb guany tributen a la renda d\'aquest any.'}
                          </p>
                        )}
                        {applying.preview.lines.length > 0 && (
                          <button disabled={!!busy} onClick={() => onApply(false)}
                            className="px-3 py-1.5 rounded-lg bg-accent text-accent-ink font-semibold disabled:opacity-40">
                            {busy === `apply-${p.id}` ? 'Registrant…' : applying.preview.mode === 'first' ? 'Crear les posicions' : 'Executar la reestructuració'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'bad' }) {
  return (
    <div>
      <p className="text-ink-muted text-xs">{label}</p>
      <p className={`font-bold text-base ${tone === 'bad' ? 'text-negative' : tone === 'ok' ? 'text-positive' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-ink-muted text-[11px]">{sub}</p>}
    </div>
  );
}

function FundRow({ x, i, amount, input, noteOpen, toggleNote, setItem, removeItem }: {
  x: ProposalItem; i: number; amount: number; input: string; noteOpen: boolean; toggleNote: () => void;
  setItem: (i: number, p: Partial<ProposalItem>) => void; removeItem: (i: number) => void;
}) {
  const td = 'py-1.5 pr-2 border-t border-line align-top';
  return (
    <>
      <tr>
        <td className={`${td} font-mono text-ink-soft text-xs pt-3`}>{x.isin}</td>
        <td className={td}>
          <input value={x.name} onChange={e => setItem(i, { name: e.target.value })} placeholder="Nom del fons" className={`${input} w-full min-w-[220px]`} />
          <p className="text-ink-muted text-[11px] mt-0.5">{x.category || 'Sense categoria'}
            {hasPerformanceData(x)
              ? <span title={x.performanceSource}> · {pct(x.historicalReturn5Y!)} anual, volatilitat {pct(x.historicalVolatility!)}</span>
              : <span className="text-negative/80"> · sense dades de rendiment</span>}</p>
        </td>
        <td className={td}><input type="number" min={0} max={100} step={0.5} value={x.weight}
          onChange={e => setItem(i, { weight: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className={`${input} w-16`} /></td>
        <td className={`${td} text-ink-soft text-xs pt-3 whitespace-nowrap`}>{eur(amount)}</td>
        <td className={td}><select value={x.risk} onChange={e => setItem(i, { risk: Number(e.target.value) })} className={input}>
          {[1, 2, 3, 4, 5, 6, 7].map(r => <option key={r} value={r}>{r}</option>)}</select></td>
        <td className={td}><input type="number" min={0} max={10} step={0.01} value={x.ter}
          onChange={e => setItem(i, { ter: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })} className={`${input} w-16`} /></td>
        <td className={td}><input value={x.platform} onChange={e => setItem(i, { platform: e.target.value })} placeholder="MyInvestor…" className={`${input} w-28`} /></td>
        <td className={`${td} whitespace-nowrap pt-2.5`}>
          <button onClick={toggleNote} className="text-ink-muted hover:text-ink text-xs mr-2" title="Justificació">✎</button>
          <button onClick={() => removeItem(i)} className="text-negative/60 hover:text-negative text-xs" title="Treure">✕</button>
        </td>
      </tr>
      {noteOpen && (
        <tr><td />
          <td colSpan={7} className="pb-2 pr-2">
            <textarea value={x.justification} onChange={e => setItem(i, { justification: e.target.value })} rows={2}
              placeholder="Per què aquest fons (surt a l'informe)" className={`${input} w-full`} />
          </td>
        </tr>
      )}
    </>
  );
}
