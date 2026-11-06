'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  proposalStats, fundToItem, validateForApproval, proposalToReportInput, PROFILES,
  type ClientProposal, type ProposalItem, type ProposalParams, type ProposalStats,
} from '@/lib/proposalMath';
import { isValidIsin } from '@/lib/fundUniverse';

type WithStats = ClientProposal & { stats: ProposalStats };
interface Data {
  client:    { name: string; email: string };
  personal:  Record<string, unknown>;
  proposals: WithStats[];
  funds:     { isin: string; name: string; category: string; source: 'advisor' | 'catalog' }[];
  holdings:  number;
  defaults:  ProposalParams;
}

const OBJECTIVES = [
  'Preservació de capital', 'Creixement moderat', 'Creixement a llarg termini',
  'Màxima rendibilitat', 'Renda passiva', 'Estalvi per a jubilació',
];
const PROFILE_LABEL: Record<string, string> = { conservador: 'Conservador', moderat: 'Moderat', dinamic: 'Dinàmic', agressiu: 'Agressiu' };

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toLocaleString('ca-ES', { maximumFractionDigits: 2 })} %`;
const safeName = (s: string) => s.normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'client';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ClientProposal({ clientId }: { clientId: string }) {
  const [data, setData]       = useState<Data | null>(null);
  const [error, setError]     = useState('');
  const [params, setParams]   = useState<ProposalParams | null>(null);
  const [items, setItems]     = useState<ProposalItem[]>([]);
  const [dirty, setDirty]     = useState(false);
  const [busy, setBusy]       = useState<string | null>(null);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [fundQuery, setFundQuery] = useState('');
  const [openNote, setOpenNote]   = useState<string | null>(null);

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
          setItems(latest.items);
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
  const approvalProblem = params ? validateForApproval({ ...params, items }) : 'Carregant';

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!data || !params || !stats) return <p className="text-white/40 text-sm">Carregant…</p>;

  const setP = (patch: Partial<ProposalParams>) => { setParams({ ...params, ...patch }); setDirty(true); };
  const setItem = (i: number, patch: Partial<ProposalItem>) => {
    setItems(items.map((x, j) => j === i ? { ...x, ...patch } : x)); setDirty(true);
  };
  const removeItem = (i: number) => { setItems(items.filter((_, j) => j !== i)); setDirty(true); };

  const addFund = () => {
    const raw = fundQuery.trim();
    const isin = (raw.match(/[A-Z]{2}[A-Z0-9]{9}\d/i)?.[0] ?? raw).toUpperCase();
    if (items.some(x => x.isin === isin)) { setMsg({ ok: false, text: 'Aquest fons ja és a la proposta' }); return; }
    const known = fundToItem(isin);
    if (known) { setItems([...items, known]); }
    else if (isValidIsin(isin)) {
      setItems([...items, { isin, name: '', category: '', weight: 0, risk: 5, ter: 0, platform: '', justification: '' }]);
      setMsg({ ok: true, text: 'ISIN fora de la llista: omple el nom, el SRRI i el TER a mà.' });
    } else { setMsg({ ok: false, text: 'Tria un fons de la llista o escriu un ISIN vàlid' }); return; }
    setFundQuery(''); setDirty(true);
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

  const onApprove = async () => {
    if (!confirm('Un cop aprovada, aquesta versió queda congelada i es genera l\'informe. Continuar?')) return;
    setBusy('approve'); setMsg(null);
    try {
      const draft = await save();
      if (!draft) return;
      const res = await fetch(api, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', id: draft.id }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? 'No s\'ha pogut aprovar' }); await load(false); return; }
      const approved = d.proposal as WithStats;
      setBusy('report');
      await generatePdf(approved);
      await downloadExcel(approved).catch(() => setMsg({ ok: false, text: 'Aprovada i PDF generat, però l\'Excel ha fallat. Torna-ho a provar des de l\'historial.' }));
      setMsg(m => m ?? { ok: true, text: `Versió ${approved.version} aprovada. S'han descarregat el PDF i l'Excel.` });
      await load();
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

  const card  = 'bg-[#0d1f1a] border border-white/10 rounded-xl p-5';
  const input = 'bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#c9a84c]/50';
  const th    = 'text-left text-white/30 text-[11px] uppercase tracking-wide font-medium pb-2 pr-2';

  return (
    <div className="space-y-5">
      {/* Estat */}
      <div className={`${card} flex flex-wrap items-center gap-3 text-sm`}>
        {!latest && <span className="text-white/60">Encara no hi ha cap proposta per a aquest client.</span>}
        {latest?.status === 'draft' && <span className="text-white/70">Editant l&apos;<b className="text-white">esborrany v{latest.version}</b>.</span>}
        {editingApproved && (
          <span className="text-white/70">
            La <b className="text-white">v{latest.version}</b> està aprovada. Si canvies alguna cosa i deses, es crearà la <b className="text-white">v{latest.version + 1}</b> (reestructuració).
          </span>
        )}
        {dirty && <span className="text-amber-300 text-xs">Canvis sense desar</span>}
      </div>

      {/* Paràmetres */}
      <div className={card}>
        <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Paràmetres</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <label className="text-white/40 text-xs space-y-1">Perfil
            <select value={params.profile} onChange={e => setP({ profile: e.target.value as ProposalParams['profile'] })} className={`${input} w-full`}>
              {PROFILES.map(p => <option key={p} value={p}>{PROFILE_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="text-white/40 text-xs space-y-1 col-span-2 md:col-span-1">Objectiu
            <input list="proposal-objectives" value={params.objective} onChange={e => setP({ objective: e.target.value })} className={`${input} w-full`} />
            <datalist id="proposal-objectives">{OBJECTIVES.map(o => <option key={o} value={o} />)}</datalist>
          </label>
          <label className="text-white/40 text-xs space-y-1">Horitzó (anys)
            <input type="number" min={1} max={50} value={params.horizon} onChange={e => setP({ horizon: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className={`${input} w-full`} />
          </label>
          <label className="text-white/40 text-xs space-y-1">Import inicial (€)
            <input type="number" min={0} value={params.initialAmount} onChange={e => setP({ initialAmount: Math.max(0, Number(e.target.value) || 0) })} className={`${input} w-full`} />
          </label>
          <label className="text-white/40 text-xs space-y-1">Aportació mensual (€)
            <input type="number" min={0} value={params.monthlyAmount} onChange={e => setP({ monthlyAmount: Math.max(0, Number(e.target.value) || 0) })} className={`${input} w-full`} />
          </label>
        </div>
      </div>

      {/* Fons */}
      <div className={card}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h3 className="text-white/50 text-xs uppercase tracking-widest mr-auto">Fons de la proposta</h3>
          <button disabled={!!busy} onClick={() => start('suggest')}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-40">
            {busy === 'suggest' ? 'Calculant…' : 'Suggerir segons perfil'}
          </button>
          {data.holdings > 0 && (
            <button disabled={!!busy} onClick={() => start('fromHoldings')}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 disabled:opacity-40">
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
            className="px-3 py-1.5 rounded-lg bg-[#c9a84c]/20 text-[#c9a84c] text-xs font-medium hover:bg-[#c9a84c]/30 disabled:opacity-40">Afegir</button>
        </div>

        {items.length === 0 ? (
          <p className="text-white/30 text-sm">Afegeix fons o fes servir &quot;Suggerir segons perfil&quot; com a punt de partida.</p>
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
          <Metric label="Rendiment net estimat" value={`${pct(stats.netReturn)} / any`} sub={`Brut ${pct(stats.grossReturn)} − TER ${pct(stats.ter)}`} />
          <Metric label="Volatilitat estimada" value={pct(stats.volatility)} sub={`SRRI mitjà ${stats.risk.toFixed(1)}`} />
          <Metric label={`Total aportat (${params.horizon} anys)`} value={eur(stats.totalInvested)} />
          <Metric label="Escenari desfavorable" value={eur(stats.p10)} />
          <Metric label="Escenari central" value={eur(stats.p50)} />
          <Metric label="Escenari favorable" value={eur(stats.p90)} />
          <Metric label="Fons" value={String(items.length)} sub={stats.estimatedFunds ? `${stats.estimatedFunds} amb rendiment estimat pel SRRI` : 'Tots amb dades del catàleg'} />
        </div>
        <p className="text-white/25 text-[11px] mt-4">
          Estimacions amb dades històriques del catàleg o, si no n&apos;hi ha, segons el SRRI. Són les mateixes xifres que sortiran a l&apos;informe.
        </p>
      </div>

      {/* Nota i accions */}
      <div className={card}>
        <label className="text-white/40 text-xs block mb-1">Nota de l&apos;assessor (surt a l&apos;informe)</label>
        <textarea value={params.adminNote} onChange={e => setP({ adminNote: e.target.value })} rows={3}
          className={`${input} w-full text-sm`} />
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {msg && <p className={`text-sm mr-auto ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
          <button disabled={!!busy || !dirty} onClick={onSave}
            className="ml-auto px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-40">
            {busy === 'save' ? 'Desant…' : 'Desar esborrany'}
          </button>
          <button disabled={!!busy || !!approvalProblem || (editingApproved && !dirty)} onClick={onApprove}
            title={approvalProblem ?? (editingApproved && !dirty ? 'Aquesta versió ja està aprovada' : '')}
            className="px-5 py-2 rounded-lg bg-[#c9a84c] text-[#0d1f1a] text-sm font-bold hover:bg-[#b8963f] disabled:opacity-40">
            {busy === 'approve' ? 'Aprovant…' : busy === 'report' ? 'Generant informe…' : 'Aprovar i generar informe'}
          </button>
        </div>
        {approvalProblem && items.length > 0 && <p className="text-amber-200/70 text-xs mt-2 text-right">{approvalProblem}</p>}
      </div>

      {/* Historial */}
      {data.proposals.length > 0 && (
        <div className={card}>
          <h3 className="text-white/50 text-xs uppercase tracking-widest mb-3">Versions</h3>
          <ul className="divide-y divide-white/5">
            {data.proposals.map(p => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2 text-xs">
                <span className="text-white font-semibold w-8">v{p.version}</span>
                <span className={`px-2 py-0.5 rounded-full ${p.status === 'approved' ? 'bg-green-500/15 text-green-400' : 'bg-white/10 text-white/50'}`}>
                  {p.status === 'approved' ? 'Aprovada' : 'Esborrany'}
                </span>
                <span className="text-white/40">{new Date(p.approvedAt ?? p.updatedAt).toLocaleDateString('ca-ES')}</span>
                <span className="text-white/50">{p.items.length} fons · {PROFILE_LABEL[p.profile]} · {pct(p.stats.netReturn)} net</span>
                {p.status === 'approved' && (
                  <span className="ml-auto flex gap-2">
                    <button disabled={!!busy} onClick={() => fromHistory(p, 'pdf')} className="text-[#c9a84c] hover:underline disabled:opacity-40">
                      {busy === `pdf-${p.id}` ? 'Generant…' : 'PDF'}
                    </button>
                    <button disabled={!!busy} onClick={() => fromHistory(p, 'excel')} className="text-[#c9a84c] hover:underline disabled:opacity-40">
                      {busy === `excel-${p.id}` ? 'Descarregant…' : 'Excel'}
                    </button>
                  </span>
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
      <p className="text-white/35 text-xs">{label}</p>
      <p className={`font-bold text-base ${tone === 'bad' ? 'text-red-400' : tone === 'ok' ? 'text-green-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-white/30 text-[11px]">{sub}</p>}
    </div>
  );
}

function FundRow({ x, i, amount, input, noteOpen, toggleNote, setItem, removeItem }: {
  x: ProposalItem; i: number; amount: number; input: string; noteOpen: boolean; toggleNote: () => void;
  setItem: (i: number, p: Partial<ProposalItem>) => void; removeItem: (i: number) => void;
}) {
  const td = 'py-1.5 pr-2 border-t border-white/5 align-top';
  return (
    <>
      <tr>
        <td className={`${td} font-mono text-white/70 text-xs pt-3`}>{x.isin}</td>
        <td className={td}>
          <input value={x.name} onChange={e => setItem(i, { name: e.target.value })} placeholder="Nom del fons" className={`${input} w-full min-w-[220px]`} />
          <p className="text-white/30 text-[11px] mt-0.5">{x.category || 'Sense categoria'}
            {x.historicalReturn5Y == null && <span className="text-amber-300/70"> · rendiment estimat pel SRRI</span>}</p>
        </td>
        <td className={td}><input type="number" min={0} max={100} step={0.5} value={x.weight}
          onChange={e => setItem(i, { weight: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className={`${input} w-16`} /></td>
        <td className={`${td} text-white/60 text-xs pt-3 whitespace-nowrap`}>{eur(amount)}</td>
        <td className={td}><select value={x.risk} onChange={e => setItem(i, { risk: Number(e.target.value) })} className={input}>
          {[1, 2, 3, 4, 5, 6, 7].map(r => <option key={r} value={r}>{r}</option>)}</select></td>
        <td className={td}><input type="number" min={0} max={10} step={0.01} value={x.ter}
          onChange={e => setItem(i, { ter: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })} className={`${input} w-16`} /></td>
        <td className={td}><input value={x.platform} onChange={e => setItem(i, { platform: e.target.value })} placeholder="MyInvestor…" className={`${input} w-28`} /></td>
        <td className={`${td} whitespace-nowrap pt-2.5`}>
          <button onClick={toggleNote} className="text-white/40 hover:text-white text-xs mr-2" title="Justificació">✎</button>
          <button onClick={() => removeItem(i)} className="text-red-400/60 hover:text-red-400 text-xs" title="Treure">✕</button>
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
