'use client';

// Despeses puntuals: el client o l'assessor les entra (escrivint o dictant) i
// l'estalvi, el fons d'emergència i el diagnòstic es recalculen sols.
// Tot el càlcul és a lib/oneOffExpenses.ts.
import { useEffect, useRef, useState } from 'react';
import { EXPENSE_CATEGORIES, parseSpokenExpense, type ExpenseCategory, type OneOffExpense } from '@/lib/oneOffExpenses';

const card  = 'bg-[#0d1f1a] border border-white/10 rounded-xl p-5';
const input = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/60';
const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);

// API de reconeixement de veu del navegador (Chrome, Edge, Safari). No hi ha tipus a TS.
type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
function getRecognition(): Recognition | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

export default function OneOffExpenses({ endpoint, data, onChange, audience = 'client' }: {
  /** /api/client/expenses o /api/admin/clients/{id}/expenses */
  endpoint: string;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  audience?: 'client' | 'admin';
}) {
  const entries = Array.isArray(data.oneOffExpenses) ? (data.oneOffExpenses as OneOffExpense[]) : [];
  const [open, setOpen]               = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount]           = useState('');
  const [category, setCategory]       = useState<ExpenseCategory>('altres');
  const [date, setDate]               = useState(today());
  const [fromSavings, setFromSavings] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [impact, setImpact]           = useState('');
  const [listening, setListening]     = useState(false);
  const [heard, setHeard]             = useState('');
  const [canDictate, setCanDictate]   = useState(false);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => { setCanDictate(getRecognition() !== null); }, []);

  function dictate() {
    if (listening) { recRef.current?.stop(); return; }
    const rec = getRecognition();
    if (!rec) return;
    rec.lang = 'ca-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = e => {
      const text = e.results[0]?.[0]?.transcript ?? '';
      setHeard(text);
      const p = parseSpokenExpense(text);
      if (p) { setAmount(String(p.amount)); setDescription(p.description); setCategory(p.category); setError(''); }
      else setError('No he entès cap import. Prova de dir, per exemple: "mil euros d\'un mòbil".');
      setOpen(true);
    };
    rec.onerror = () => setError('No s\'ha pogut fer servir el micròfon.');
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true); setError(''); setHeard('');
    rec.start();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setImpact('');
    const n = Number(amount.replace(',', '.'));
    if (!description.trim()) { setError('Descriu la despesa.'); return; }
    if (!Number.isFinite(n) || n <= 0) { setError('L\'import ha de ser més gran que 0.'); return; }
    setSaving(true);
    try {
      const r = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim(), amount: n, category, date, affectsSavings: fromSavings }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'No s\'ha pogut desar.');
      onChange(j.data ?? {});
      setImpact(j.impact?.summary ?? 'Despesa registrada.');
      setDescription(''); setAmount(''); setCategory('altres'); setDate(today()); setFromSavings(true); setHeard(''); setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s\'ha pogut desar.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(x: OneOffExpense) {
    if (!confirm(`Esborrar "${x.description}" (${eur(x.amount)})?${x.deducted > 0 ? ` Es tornaran a sumar ${eur(x.deducted)} a l'estalvi.` : ''}`)) return;
    const r = await fetch(`${endpoint}?id=${encodeURIComponent(x.id)}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { onChange(j.data ?? {}); setImpact(''); } else setError(j.error ?? 'No s\'ha pogut esborrar.');
  }

  return (
    <section className={card} aria-labelledby="oneoff-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="oneoff-title" className="text-white/50 text-xs uppercase tracking-widest">Despeses puntuals</h2>
          <p className="text-white/40 text-xs mt-1">
            {audience === 'client' ? 'Un viatge, un mòbil, un cotxe, un mes que has gastat més... Apunta-ho i el pla es reajusta sol.' : 'Entra el que t\'expliqui el client (escrivint o dictant). L\'estalvi i el diagnòstic es recalculen sols.'}
          </p>
        </div>
        <div className="flex gap-2">
          {canDictate && (
            <button type="button" onClick={dictate} aria-pressed={listening}
              className={`px-3 py-2 rounded-lg text-sm ${listening ? 'bg-red-500/80 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}>
              {listening ? '● Escoltant… (toca per parar)' : '🎤 Dictar'}
            </button>
          )}
          {!open && <button type="button" onClick={() => { setOpen(true); setImpact(''); }} className="px-3 py-2 rounded-lg bg-[#c9a84c] text-[#0d1f1a] font-semibold text-sm">+ Afegir</button>}
        </div>
      </div>

      {heard && <p className="text-white/40 text-xs mt-3">He entès: «{heard}». Revisa-ho abans de desar.</p>}

      {open && (
        <form onSubmit={submit} className="mt-4 grid grid-cols-2 sm:grid-cols-[1fr_8rem_12rem_9rem] gap-3 items-end">
          <label className="block col-span-2 sm:col-span-1"><span className="text-white/40 text-xs">Què ha estat</span>
            <input className={input} maxLength={120} value={description} onChange={e => setDescription(e.target.value)} placeholder="Viatge a Roma" /></label>
          <label className="block"><span className="text-white/40 text-xs">Import (€)</span>
            <input type="number" inputMode="decimal" min={0} step="any" className={input} value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <label className="block"><span className="text-white/40 text-xs">Tipus</span>
            <select className={input} value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)}>
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k} className="bg-[#0d1f1a]">{v}</option>)}
            </select></label>
          <label className="block col-span-2 sm:col-span-1"><span className="text-white/40 text-xs">Data</span>
            <input type="date" className={input} value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="col-span-2 sm:col-span-4 flex items-center gap-2 text-white/60 text-sm">
            <input type="checkbox" checked={fromSavings} onChange={e => setFromSavings(e.target.checked)} />
            Ha sortit de l&apos;estalvi (es resta i es recalcula el fons d&apos;emergència)
          </label>
          <div className="col-span-2 sm:col-span-4 flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#0d1f1a] font-semibold text-sm disabled:opacity-50">{saving ? 'Desant…' : 'Desar'}</button>
            <button type="button" onClick={() => { setOpen(false); setError(''); setHeard(''); }} className="px-4 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10">Cancel·lar</button>
          </div>
        </form>
      )}

      {error && <p className="text-red-400 text-sm mt-3" role="alert">{error}</p>}
      {impact && <p className="text-green-300/80 text-sm mt-3" role="status">{impact}</p>}

      {entries.length > 0 && (
        <ul className="mt-4 divide-y divide-white/5">
          {entries.slice(0, 10).map(x => (
            <li key={x.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="text-white truncate">{x.description}</p>
                <p className="text-white/35 text-xs">
                  {new Date(x.date).toLocaleDateString('ca-ES')} · {EXPENSE_CATEGORIES[x.category] ?? x.category}
                  {x.deducted > 0 ? ` · restat de l'estalvi` : ''}{x.addedBy === 'admin' ? ' · entrat per l\'assessor' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-white font-semibold">{eur(x.amount)}</span>
                <button type="button" onClick={() => remove(x)} className="text-white/30 hover:text-red-400 text-xs" aria-label={`Esborrar ${x.description}`}>Esborrar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
