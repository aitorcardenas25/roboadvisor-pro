'use client';
// Informe inicial del client: la foto del punt de partida (situació, objectius)
// i la cartera que l'assessor va proposar i aprovar. El mateix PDF que rep de l'assessor.
import ClientNav from '@/components/client/ClientNav';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DiagnosisCard from '@/components/finances/DiagnosisCard';
import AllocationSummary from '@/components/AllocationSummary';
import FundDrawdowns from '@/components/FundDrawdowns';
import { showDrawdownsByDefault, type FundDrawdowns as FundDD } from '@/lib/drawdowns';
import { assetTypeLabel, classifyFund, managementLabel } from '@/lib/fundClassification';
import { diagnose } from '@/lib/diagnosis';
import { proposalToReportInput, type ClientProposal, type ProposalStats } from '@/lib/proposalMath';

type Proposal = ClientProposal & { stats: ProposalStats };
interface Data { client: { name: string; email: string }; personal: Record<string, unknown>; proposal: Proposal | null; versions: number; drawdowns?: FundDD[] }
interface Goal { horizon?: string; description: string; amount?: number; targetYear?: number }

const PROFILE: Record<string, string> = { conservador: 'Conservador', moderat: 'Moderat', equilibrat: 'Equilibrat', dinamic: 'Dinàmic', agressiu: 'Agressiu' };
const HORIZON: Record<string, string> = { curt: 'Curt termini (menys d’1 any)', mitja: 'Mitjà termini (1 a 5 anys)', llarg: 'Llarg termini (més de 5 anys)' };
const eur = (n: number) => n.toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
const pct = (n: number) => `${n.toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const fDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const card = 'bg-surface border border-line rounded-lg p-5 sm:p-6';
const safeName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');

export default function InitialReportPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status !== 'authenticated') return;
    fetch('/api/client/initial-report', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'Error'); return d as Data; })
      .then(setData)
      .catch((e: Error) => setError(e.message || 'No s\'ha pogut carregar l\'informe'));
  }, [status, router]);

  const q = useMemo(() => data?.personal ?? {}, [data]);
  const goals: Goal[] = useMemo(() => (Array.isArray(q.goals) ? (q.goals as Goal[]) : []).filter(g => g?.description), [q.goals]);
  const diagnosis = useMemo(() => data ? diagnose({
    monthlyNetIncome: num(q.monthlyNetIncome), monthlyFixedExpenses: num(q.monthlyFixedExpenses),
    monthlyVariableExpenses: num(q.monthlyVariableExpenses), monthlyDebtPayments: num(q.monthlyDebtPayments),
    monthlyExpenses: num(q.monthlyExpenses), currentSavings: num(q.currentSavings),
    employmentType: typeof q.employmentType === 'string' ? q.employmentType : undefined, goals,
  }) : null, [data, q, goals]);

  const downloadPdf = async () => {
    if (!data?.proposal) return;
    setBusy(true);
    try {
      const [{ pdf }, { ManualReportPDF }] = await Promise.all([import('@react-pdf/renderer'), import('@/components/pdf/ManualReportPDF')]);
      const p = data.proposal;
      const input = proposalToReportInput(p, data.client, data.personal);
      const when = new Date(p.approvedAt ?? p.updatedAt).toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric' });
      const dd = showDrawdownsByDefault(p.profile) ? data.drawdowns : undefined;
      const blob = await pdf(<ManualReportPDF data={input} generatedAt={when} drawdowns={dd} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `FACTOR_OTC_informe_inicial_${safeName(data.client.name)}_v${p.version}.pdf`;
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { setError('No s\'ha pogut generar el PDF. Torna-ho a provar.'); }
    finally { setBusy(false); }
  };

  const p = data?.proposal;
  const figures: [string, number | undefined][] = [
    ['Ingressos nets al mes', num(q.monthlyNetIncome)],
    ['Despeses al mes', num(q.monthlyExpenses) ?? ((num(q.monthlyFixedExpenses) ?? 0) + (num(q.monthlyVariableExpenses) ?? 0) || undefined)],
    ['Estalvi disponible', num(q.currentSavings)],
    ['Deutes pendents', num(q.totalDebt)],
    ['Patrimoni net', num(q.netWorth)],
  ];

  return (
    <div className="theme-client min-h-screen bg-canvas">
      <ClientNav />
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {error && <p className="text-negative text-sm" role="alert">{error}</p>}
        {!data && !error && <div className="animate-pulse bg-subtle rounded-lg h-96" />}

        {data && !p && (
          <div className={card}>
            <h1 className="text-ink font-semibold text-lg">El teu informe inicial</h1>
            <p className="text-ink-soft text-sm mt-2">Encara no està llest. Quan l&apos;assessor te l&apos;enviï, aquí veuràs el punt de partida, els teus objectius i la cartera proposada.</p>
          </div>
        )}

        {data && p && (
          <>
            <div className={`${card} flex flex-wrap items-start justify-between gap-4`}>
              <div>
                <h1 className="text-ink font-semibold text-lg">El teu informe inicial</h1>
                <p className="text-ink-soft text-sm mt-1">
                  La foto del punt de partida: la teva situació, els teus objectius i la cartera que et vam proposar.
                </p>
                <p className="text-ink-muted text-xs mt-2">
                  Proposta versió {p.version} · enviada el {fDate(p.sharedAt ?? p.approvedAt)}
                  {data.versions > 1 ? ` · n'hi ha ${data.versions} versions; aquesta és la més recent` : ''}
                </p>
              </div>
              <button type="button" onClick={downloadPdf} disabled={busy}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-ink font-semibold text-sm rounded-lg disabled:opacity-60">
                {busy ? 'Preparant el PDF…' : 'Descarregar l’informe complet (PDF)'}
              </button>
            </div>

            <section className={card}>
              <h2 className="text-ink font-semibold text-sm">Els teus objectius</h2>
              {goals.length === 0 ? (
                <p className="text-ink-muted text-sm mt-3">No hi ha objectius escrits. Els pots afegir a «Les meves finances».</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {goals.map((g, i) => (
                    <li key={i} className="py-3 flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="text-ink text-sm font-medium">{g.description}</p>
                        <p className="text-ink-muted text-xs">{HORIZON[g.horizon ?? ''] ?? 'Sense termini'}</p>
                      </div>
                      <p className="text-ink-soft text-sm whitespace-nowrap">
                        {[g.amount ? eur(g.amount) : null, g.targetYear ? `l'any ${g.targetYear}` : null].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {p.objective && <p className="text-ink-soft text-xs mt-3">Objectiu de la cartera: {p.objective}</p>}
            </section>

            <section className={card}>
              <h2 className="text-ink font-semibold text-sm">La teva situació</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                {figures.map(([label, v]) => (
                  <div key={label} className="rounded-lg bg-subtle px-3 py-2.5">
                    <p className="text-ink-muted text-[11px] leading-tight">{label}</p>
                    <p className="text-ink text-base font-semibold mt-1">{v !== undefined ? eur(v) : '—'}</p>
                  </div>
                ))}
              </div>
              <p className="text-ink-muted text-[11px] mt-3">
                Són les dades que tens ara a «Les meves finances». Si les has canviat després de la proposta, poden no coincidir amb les del PDF del dia que es va fer.
              </p>
            </section>

            {diagnosis && <DiagnosisCard d={diagnosis} audience="client" />}

            <section className={card}>
              <h2 className="text-ink font-semibold text-sm">La cartera proposada</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {([
                  ['Perfil', PROFILE[p.profile] ?? p.profile],
                  ['Horitzó', `${p.horizon} anys`],
                  ['Inversió inicial', eur(p.initialAmount)],
                  ['Aportació mensual', eur(p.monthlyAmount)],
                ] as const).map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-subtle px-3 py-2.5">
                    <p className="text-ink-muted text-[11px]">{l}</p>
                    <p className="text-ink text-base font-semibold mt-1">{v}</p>
                  </div>
                ))}
              </div>
              <AllocationSummary items={p.items} className="mt-4" />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-ink-muted border-b border-line">
                      <th className="text-left font-medium py-2 pr-3">Fons</th>
                      <th className="text-right font-medium py-2 px-2">Pes</th>
                      <th className="hidden sm:table-cell text-right font-medium py-2 px-2">Rendibilitat anual (5 anys)</th>
                      <th className="hidden sm:table-cell text-right font-medium py-2 pl-2">Cost anual (TER)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...p.items].sort((a, b) => b.weight - a.weight).map(x => { const cl = classifyFund(x.isin, x.category, x.name); return (
                      <tr key={x.isin}>
                        <td className="py-2 pr-3">
                          <p className="text-ink">{x.name}</p>
                          <p className="text-ink-soft text-[11px]">{assetTypeLabel(cl)} · {managementLabel(cl)}</p>
                          <p className="text-ink-muted text-[11px]">{x.category} · {x.isin}</p>
                          {x.justification && <p className="text-ink-soft text-[11px] mt-0.5">{x.justification}</p>}
                        </td>
                        <td className="py-2 px-2 text-right text-ink whitespace-nowrap">{pct(x.weight)}</td>
                        <td className="hidden sm:table-cell py-2 px-2 text-right text-ink-soft whitespace-nowrap">{x.historicalReturn5Y !== undefined ? pct(x.historicalReturn5Y) : '—'}</td>
                        <td className="hidden sm:table-cell py-2 pl-2 text-right text-ink-soft whitespace-nowrap">{x.ter > 0 ? `${x.ter.toLocaleString('ca-ES', { maximumFractionDigits: 2 })} %` : '—'}</td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
              {p.adminNote && (
                <div className="mt-4 rounded-lg border border-line px-4 py-3">
                  <p className="text-ink-muted text-[11px]">Comentari de l&apos;assessor</p>
                  <p className="text-ink-soft text-sm mt-1">{p.adminNote}</p>
                </div>
              )}
              <p className="text-ink-muted text-[11px] mt-3">
                Les rendibilitats són dels últims 5 anys amb els valors liquidatius oficials. No garanteixen el que passarà. El PDF té les projeccions i el detall complet.
              </p>
              <p className="text-ink-muted text-[11px] mt-2 leading-relaxed">
                <span className="font-semibold">Avís legal.</span>{' '}Aquest informe l&apos;ha elaborat Factor OTC amb finalitat orientativa i educativa. No és assessorament financer regulat (MiFID II) ni una oferta o recomanació d&apos;inversió, i Factor OTC no és una entitat autoritzada per la CNMV. Les rendibilitats passades i les estimacions no garanteixen resultats futurs. Invertir implica risc de perdre part o tot el capital. Abans de decidir, pots consultar un assessor financer autoritzat per la CNMV.
              </p>
            </section>

            {!!data.drawdowns?.length && (
              <FundDrawdowns items={data.drawdowns} defaultOpen={showDrawdownsByDefault(p.profile)}
                title="Caigudes històriques dels fons proposats"
                intro="Quant ha arribat a baixar cada fons des d’un màxim, quan va passar i quant va tardar a recuperar-se. Serveix per saber què pots esperar en un mal moment." />
            )}
          </>
        )}
      </div>
    </div>
  );
}
