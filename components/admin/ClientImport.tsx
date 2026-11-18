'use client';

import { useState } from 'react';
import type { ImportResult } from '@/lib/clientImport';

type Preview = ImportResult & {
  context: { hasLead: boolean; existingHoldings: number; existingTransactions: number };
};

const PERSONAL_LABELS: Record<string, string> = {
  age: 'Edat', annualIncome: 'Ingressos anuals', monthlyExpenses: 'Despeses mensuals',
  currentSavings: 'Estalvis', netWorth: 'Patrimoni net', totalDebt: 'Deute',
  monthlyNetIncome: 'Ingressos nets / mes', monthlyFixedExpenses: 'Despeses fixes / mes',
  monthlyVariableExpenses: 'Despeses variables / mes', monthlyDebtPayments: 'Quotes deutes / mes',
  dependents: 'Persones a càrrec', employmentType: 'Situació laboral',
  selfRiskProfile: 'Perfil (segons el client)', selfKnowledge: 'Coneixement',
};
const NOT_MONEY = new Set(['age', 'dependents']);
const HORIZON_LABELS: Record<string, string> = { curt: 'Curt termini', mitja: 'Mitjà termini', llarg: 'Llarg termini' };
// Codis interns de les preguntes amb desplegable → text que va triar el client
const CHOICE_LABELS: Record<string, string> = {
  indefinit: 'Indefinit', temporal: 'Temporal', autonom: 'Autònom', 'sense-feina': 'Sense feina',
  conservador: 'Conservador', equilibrat: 'Equilibrat', dinamic: 'Dinàmic',
  basic: 'Bàsic', mitja: 'Mitjà', alt: 'Alt',
};
const fmtPersonal = (k: string, v: number | string) =>
  typeof v === 'string' ? (CHOICE_LABELS[v] ?? v) : NOT_MONEY.has(k) ? String(v) : eur(v);
const OP_LABELS: Record<string, string> = {
  buy: 'Compra', sell: 'Venda', deposit: 'Aportació', withdrawal: 'Retirada', rebalance: 'Rebalanceig',
};

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

export default function ClientImport({ clientId, onImported }: { clientId: string; onImported: () => void }) {
  const [file, setFile]       = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (mode: 'preview' | 'commit') => {
    if (!file) return;
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.append('file', file); fd.append('mode', mode); fd.append('replace', String(replace));
    try {
      const res  = await fetch(`/api/admin/clients/${clientId}/import`, { method: 'POST', body: fd });
      const data = await res.json();
      if (mode === 'preview') {
        if (!res.ok) setMsg({ ok: false, text: data.error ?? 'Error llegint el fitxer' });
        else setPreview(data);
      } else if (res.ok) {
        setMsg({ ok: true, text: `Importat: ${data.imported.holdings} posicions i ${data.imported.transactions} moviments${data.personalSaved ? ' + dades personals' : ''}.` });
        setPreview(null); setFile(null);
        onImported();
      } else {
        setMsg({ ok: false, text: data.error ?? 'No s\'ha pogut importar' });
        if (data.errors) setPreview(p => p ? { ...p, errors: data.errors } : p);
      }
    } catch { setMsg({ ok: false, text: 'Error de connexió' }); }
    finally { setBusy(false); }
  };

  const card = 'bg-surface border border-line rounded-lg p-5';
  const th   = 'text-left text-ink-muted text-[11px] font-medium font-medium pb-2 pr-3';
  const td   = 'text-ink text-xs py-1.5 pr-3 border-t border-line';

  return (
    <div className="space-y-5">
      {/* Pas 1 i 2 */}
      <div className={card}>
        <h3 className="text-ink-soft text-xs font-medium mb-4">Importar dades des d&apos;Excel</h3>
        <ol className="text-ink-soft text-sm space-y-3 list-decimal list-inside">
          <li>
            Descarrega la plantilla i envia-la al client perquè l&apos;ompli.{' '}
            <a href={`/api/admin/clients/${clientId}/import`}
              className="text-accent hover:underline font-medium">Descarregar plantilla (.xlsx)</a>
          </li>
          <li>
            Puja el fitxer omplert:
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {/* Botó propi: l'input natiu deia "No s'ha triat cap fitxer" fins i tot amb un fitxer triat
                  (es buida després de llegir-lo) */}
              <label className="px-3 py-1.5 rounded-lg bg-subtle-strong text-ink text-xs cursor-pointer hover:bg-subtle">
                Triar fitxer
                <input type="file" className="sr-only" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={async e => {
                    // Es copia a memòria i es buida l'input: així es pot tornar a triar el
                    // mateix fitxer després de corregir-lo i no falla si canvia al disc.
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    setPreview(null); setMsg(null);
                    setFile(f ? new File([await f.arrayBuffer()], f.name, { type: f.type }) : null);
                  }} />
              </label>
              <span className="text-ink-soft text-xs">{file ? file.name : 'Cap fitxer triat'}</span>
              <button disabled={!file || busy} onClick={() => send('preview')}
                className="px-4 py-1.5 rounded-lg bg-subtle-strong text-ink text-xs font-medium disabled:opacity-40 hover:bg-subtle-strong">
                {busy && !preview ? 'Llegint…' : 'Revisar'}
              </button>
            </div>
          </li>
        </ol>
        {msg && (
          <p className={`mt-4 text-sm ${msg.ok ? 'text-positive' : 'text-negative'}`}>{msg.text}</p>
        )}
      </div>

      {preview && (
        <>
          {/* Resum i errors */}
          <div className={card}>
            <div className="flex flex-wrap gap-6 mb-4 text-sm">
              <span className="text-ink-soft"><b className="text-ink">{preview.holdings.length}</b> posicions</span>
              <span className="text-ink-soft"><b className="text-ink">{preview.transactions.length}</b> moviments</span>
              <span className="text-ink-soft"><b className="text-ink">{Object.keys(preview.personal).length}</b> dades personals</span>
              <span className="text-ink-soft"><b className="text-ink">{preview.goals.length}</b> objectius</span>
              <span className={preview.errors.length ? 'text-negative' : 'text-positive'}>
                {preview.errors.length ? `${preview.errors.length} errors` : 'Sense errors'}
              </span>
              {preview.warnings.length > 0 && <span className="text-warning">{preview.warnings.length} avisos</span>}
            </div>
            {[...preview.errors.map(e => ({ ...e, kind: 'error' })), ...preview.warnings.map(w => ({ ...w, kind: 'warn' }))].length > 0 && (
              <ul className="space-y-1 max-h-48 overflow-auto">
                {preview.errors.map((e, i) => (
                  <li key={`e${i}`} className="text-negative text-xs">✕ {e.sheet}{e.row ? `, fila ${e.row}` : ''}: {e.message}</li>
                ))}
                {preview.warnings.map((w, i) => (
                  <li key={`w${i}`} className="text-warning/80 text-xs">! {w.sheet}{w.row ? `, fila ${w.row}` : ''}: {w.message}</li>
                ))}
              </ul>
            )}
            {!preview.context.hasLead && (Object.keys(preview.personal).length > 0 || preview.goals.length > 0) && (
              <p className="text-warning/80 text-xs mt-3">Aquest client encara no té fitxa de dades: en confirmar se&apos;n crearà una i s&apos;hi desaran les dades personals i els objectius.</p>
            )}
          </div>

          {/* Taules */}
          {Object.keys(preview.personal).length > 0 && (
            <div className={card}>
              <h4 className="text-ink-soft text-xs font-medium mb-3">Dades personals</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(preview.personal).map(([k, v]) => (
                  <div key={k}><p className="text-ink-muted text-xs">{PERSONAL_LABELS[k] ?? k}</p>
                    <p className="text-ink text-sm">{fmtPersonal(k, v as number | string)}</p></div>
                ))}
              </div>
            </div>
          )}

          {preview.goals.length > 0 && (
            <div className={card}>
              <h4 className="text-ink-soft text-xs font-medium mb-3">Objectius</h4>
              <ul className="space-y-1.5">
                {preview.goals.map((g, i) => (
                  <li key={i} className="text-ink text-sm">
                    <span className="text-ink-muted text-xs mr-2">{HORIZON_LABELS[g.horizon]}</span>
                    {g.description}{g.amount ? ` · ${eur(g.amount)}` : ''}{g.targetYear ? ` · ${g.targetYear}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.holdings.length > 0 && (
            <div className={`${card} overflow-x-auto`}>
              <h4 className="text-ink-soft text-xs font-medium mb-3">Posicions</h4>
              <table className="w-full">
                <thead><tr>{['ISIN', 'Fons', 'Broker', 'Participacions', 'Preu mitjà', 'Cost'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>{preview.holdings.map(h => (
                  <tr key={h.row}>
                    <td className={`${td} font-mono`}>{h.isin}{!h.recognized && <span className="text-warning ml-1">!</span>}</td>
                    <td className={td}>{h.name}</td><td className={td}>{h.broker}</td>
                    <td className={td}>{h.quantity.toLocaleString('ca-ES')}</td>
                    <td className={td}>{eur(h.avgEntryPrice)}</td>
                    <td className={td}>{eur(h.quantity * h.avgEntryPrice)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}

          {preview.transactions.length > 0 && (
            <div className={`${card} overflow-x-auto`}>
              <h4 className="text-ink-soft text-xs font-medium mb-3">Moviments</h4>
              <table className="w-full">
                <thead><tr>{['Data', 'Tipus', 'ISIN / Nom', 'Import', 'Comissió', 'Broker'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>{preview.transactions.map(t => (
                  <tr key={t.row}>
                    <td className={td}>{new Date(t.date).toLocaleDateString('ca-ES')}</td>
                    <td className={td}>{OP_LABELS[t.operationType]}</td>
                    <td className={td}>{t.name ?? t.isin ?? '—'}</td>
                    <td className={td}>{eur(t.totalEur)}</td>
                    <td className={td}>{eur(t.commission)}</td>
                    <td className={td}>{t.broker || '—'}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}

          {/* Confirmació */}
          <div className={`${card} flex flex-wrap items-center gap-4`}>
            {(preview.context.existingHoldings > 0 || preview.context.existingTransactions > 0) && (
              <label className="flex items-center gap-2 text-ink-soft text-xs">
                <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
                Substituir les {preview.context.existingHoldings} posicions i {preview.context.existingTransactions} moviments actuals
                (si no, s&apos;afegeixen)
              </label>
            )}
            <button disabled={busy || preview.errors.length > 0} onClick={() => send('commit')}
              className="ml-auto px-5 py-2 rounded-lg bg-accent text-accent-ink text-sm font-bold disabled:opacity-40 hover:bg-accent-hover">
              {busy ? 'Important…' : 'Confirmar importació'}
            </button>
          </div>
          <p className="text-ink-muted text-xs">
            Els preus actuals queden com a &quot;pendents&quot; (igual al cost) fins que facis &quot;Refrescar preus de mercat&quot;.
          </p>
        </>
      )}
    </div>
  );
}
