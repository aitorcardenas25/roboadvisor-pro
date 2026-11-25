// components/admin/FundNavsManager.tsx
// Preus dels fons entrats a mà (beta sense API de dades): entrada d'un preu,
// enganxar-ne molts des d'Excel, pujar un fitxer i veure les mètriques que en surten.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MIN_YEARS_FOR_PROPOSALS, fmtDate, type NavMetrics, type NavPoint } from '@/lib/navMath';
import NavAutoUpdatePanel from './NavAutoUpdatePanel';

interface FundRow { isin: string; name: string; category: string; inList: boolean; currency: string | null; metrics: NavMetrics }
interface Preview {
  ok: boolean; total: number; rows: NavPoint[];
  funds: { isin: string; count: number; from: string; to: string; currency: string }[];
  errors: { line: number; message: string }[]; warnings: { line: number; message: string }[];
}

const card  = 'bg-surface border border-line rounded-lg p-5';
const input = 'bg-subtle border border-line-strong rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/60';
const btn   = 'px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40';
const gold  = `${btn} bg-accent hover:bg-accent-hover text-accent-ink`;
const ghost = `${btn} border border-line-strong text-ink-soft hover:text-ink hover:bg-subtle`;

const pct = (n: number | null) => n === null ? '—' : `${n.toLocaleString('ca-ES', { maximumFractionDigits: 1 })} %`;
const num = (n: number | null) => n === null ? '—' : n.toLocaleString('ca-ES', { maximumFractionDigits: 4 });
const ymLabel = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
const today = () => new Date().toISOString().slice(0, 10);

function status(m: NavMetrics): { label: string; cls: string; hint: string } {
  if (!m.points) return { label: 'Sense preus', cls: 'text-ink-muted', hint: 'Encara no s\'hi ha entrat cap preu' };
  if (m.usable && m.stale) return { label: 'Desactualitzat', cls: 'text-warning', hint: `Es fa servir a les propostes, però l'últim preu és del ${fmtDate(m.lastDate!)}` };
  if (m.usable) return { label: 'A punt', cls: 'text-positive', hint: 'Es fa servir a les propostes' };
  return { label: 'Falten preus', cls: 'text-warning/80', hint: m.reason ?? '' };
}

function downloadTemplate(funds: FundRow[]) {
  const rows = funds.filter(f => f.inList).map(f => `${f.isin};${f.name.replace(/;/g, ',')};;;${f.currency ?? 'EUR'}`);
  const csv = '﻿' + ['ISIN;Nom;Data (dd/mm/aaaa);Valor liquidatiu;Moneda', ...rows].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `FACTOR_OTC_preus_fons_${today()}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FundNavsManager() {
  const [funds, setFunds]     = useState<FundRow[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy]       = useState<string | null>(null);

  // Un preu
  const [one, setOne] = useState({ isin: '', date: today(), nav: '', currency: 'EUR' });
  // Molts preus
  const [text, setText]         = useState('');
  const [bulkIsin, setBulkIsin] = useState('');
  const [preview, setPreview]   = useState<Preview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  // Detall
  const [open, setOpen]     = useState<string | null>(null);
  const [detail, setDetail] = useState<{ points: NavPoint[]; metrics: NavMetrics } | null>(null);

  const load = useCallback(async () => {
    setLoadErr('');
    try {
      const res = await fetch('/api/admin/fund-navs');
      const d = await res.json();
      if (!res.ok) { setLoadErr(d.error ?? 'No s\'han pogut carregar els preus'); return; }
      setFunds(d.funds);
    } catch { setLoadErr('Error de connexió'); }
  }, []);

  const loadDetail = useCallback(async (isin: string) => {
    setDetail(null);
    const res = await fetch(`/api/admin/fund-navs?isin=${isin}`);
    if (res.ok) setDetail(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (open) loadDetail(open); }, [open, loadDetail]);

  const fundName = (isin: string) => funds?.find(f => f.isin === isin)?.name ?? isin;

  async function send(body: { text?: string; isin?: string; currency?: string; mode: 'preview' | 'commit' }, withFile?: File | null): Promise<Preview & { saved?: number; holdingsUpdated?: number; error?: string } | null> {
    try {
      let res: Response;
      if (withFile) {
        const fd = new FormData();
        fd.set('file', withFile); fd.set('mode', body.mode);
        if (body.isin) fd.set('isin', body.isin);
        if (body.currency) fd.set('currency', body.currency);
        res = await fetch('/api/admin/fund-navs', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/admin/fund-navs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      const d = await res.json();
      if (!res.ok && !d.errors) { setMsg({ ok: false, text: d.error ?? 'No s\'ha pogut desar' }); return null; }
      return d;
    } catch { setMsg({ ok: false, text: 'Error de connexió' }); return null; }
  }

  async function afterSave(d: { saved?: number; holdingsUpdated?: number }) {
    const h = d.holdingsUpdated ? ` S'ha actualitzat el preu a ${d.holdingsUpdated} posicions de clients.` : '';
    setMsg({ ok: true, text: `Desats ${d.saved} preus.${h}` });
    await load();
    if (open) await loadDetail(open);
  }

  async function saveOne() {
    setMsg(null);
    if (!one.isin) { setMsg({ ok: false, text: 'Tria el fons' }); return; }
    if (!one.nav.trim()) { setMsg({ ok: false, text: 'Escriu el valor liquidatiu' }); return; }
    setBusy('one');
    const d = await send({ text: `${one.isin}\t${one.date}\t${one.nav.trim()}`, currency: one.currency, mode: 'commit' });
    setBusy(null);
    if (!d) return;
    if (d.errors?.length) { setMsg({ ok: false, text: d.errors.map(e => e.message).join(' · ') }); return; }
    setOne({ ...one, nav: '' });
    await afterSave(d);
  }

  async function review() {
    setMsg(null); setPreview(null);
    if (!file && !text.trim()) { setMsg({ ok: false, text: 'Enganxa els preus o tria un fitxer' }); return; }
    setBusy('preview');
    const d = await send({ text, isin: bulkIsin || undefined, mode: 'preview' }, file);
    setBusy(null);
    if (d) setPreview(d);
  }

  async function commit() {
    setBusy('commit');
    const d = await send({ text, isin: bulkIsin || undefined, mode: 'commit' }, file);
    setBusy(null);
    if (!d) return;
    if (d.errors?.length) { setPreview(d); return; }
    setPreview(null); setText(''); setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    await afterSave(d);
  }

  async function remove(isin: string, date?: string) {
    const q = date ? `Esborrar el preu del ${fmtDate(date)}?` : `Esborrar TOTS els preus de ${fundName(isin)}?`;
    if (!confirm(q)) return;
    const res = await fetch(`/api/admin/fund-navs?isin=${isin}${date ? `&date=${date}` : '&all=true'}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? 'No s\'ha pogut esborrar' }); return; }
    setMsg({ ok: true, text: `Esborrats ${d.deleted} preus.` });
    await load(); await loadDetail(isin);
  }

  if (loadErr) return <div className={`${card} text-negative text-sm`}>{loadErr}</div>;
  if (!funds)  return <p className="text-ink-muted text-sm">Carregant…</p>;

  const ready = funds.filter(f => f.metrics.usable).length;
  const listed = funds.filter(f => f.inList).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-ink text-2xl font-bold">Preus dels fons</h2>
        <p className="text-ink-soft text-sm mt-1 max-w-3xl">
          La majoria de fons s&apos;actualitzen sols cada dia (vegeu «Actualització automàtica»). Per als altres, entra el{' '}
          <b className="text-ink">valor liquidatiu</b>{' '}(el preu d&apos;una participació) tal com surt a la web de la gestora. Amb {MIN_YEARS_FOR_PROPOSALS}{' '}anys de preus mensuals seguits,
          l&apos;app calcula la rendibilitat, la volatilitat i la caiguda màxima i les fa servir a les propostes.
          L&apos;últim preu també actualitza el valor de les carteres dels clients que tenen aquell fons.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className={card}><p className="text-ink-muted text-xs">Fons a punt per a propostes</p><p className="text-ink text-lg font-bold mt-1">{ready} de {funds.length}</p></div>
        <div className={card}><p className="text-ink-muted text-xs">Fons de la teva llista</p><p className="text-ink text-lg font-bold mt-1">{listed}</p></div>
        <div className={card}><p className="text-ink-muted text-xs">Desactualitzats (més de 45 dies)</p><p className="text-ink text-lg font-bold mt-1">{funds.filter(f => f.metrics.stale).length}</p></div>
      </div>

      <NavAutoUpdatePanel onUpdated={load} />

      {msg && <div className={`rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-positive/10 text-positive border border-positive/30' : 'bg-negative/10 text-negative border border-negative/30'}`}>{msg.text}</div>}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Un preu ── */}
        <div className={card}>
          <h3 className="text-ink font-semibold mb-1">Afegir un preu</h3>
          <p className="text-ink-muted text-xs mb-4">Per corregir un preu, torna&apos;l a entrar amb la mateixa data: se substitueix.</p>
          <div className="space-y-3">
            <select value={one.isin} onChange={e => setOne({ ...one, isin: e.target.value, currency: funds.find(f => f.isin === e.target.value)?.currency ?? one.currency })} className={`${input} w-full`}>
              <option value="">Tria el fons…</option>
              {funds.map(f => <option key={f.isin} value={f.isin}>{f.name} · {f.isin}</option>)}
            </select>
            <div className="flex flex-wrap gap-2">
              <label className="text-ink-muted text-xs flex flex-col gap-1">Data
                <input type="date" value={one.date} max={today()} onChange={e => setOne({ ...one, date: e.target.value })} className={input} /></label>
              <label className="text-ink-muted text-xs flex flex-col gap-1">Valor liquidatiu
                <input inputMode="decimal" value={one.nav} onChange={e => setOne({ ...one, nav: e.target.value })} placeholder="p. ex. 123,4567" className={`${input} w-36`} /></label>
              <label className="text-ink-muted text-xs flex flex-col gap-1">Moneda
                <select value={one.currency} onChange={e => setOne({ ...one, currency: e.target.value })} className={input}>
                  {['EUR', 'USD', 'GBP', 'CHF'].map(c => <option key={c}>{c}</option>)}
                </select></label>
            </div>
            <button onClick={saveOne} disabled={busy !== null} className={gold}>{busy === 'one' ? 'Desant…' : 'Desar preu'}</button>
          </div>
        </div>

        {/* ── Molts preus ── */}
        <div className={card}>
          <h3 className="text-ink font-semibold mb-1">Afegir molts preus de cop</h3>
          <p className="text-ink-muted text-xs mb-3">
            Copia les columnes d&apos;un Excel i enganxa-les aquí. Cada fila: <b className="text-ink-soft">ISIN, data, valor liquidatiu</b>{' '}i,
            si vols, moneda. Si tots els preus són d&apos;un sol fons, tria&apos;l i n&apos;hi ha prou amb data i valor.
            També pots pujar el fitxer (.xlsx o .csv).{' '}
            <button onClick={() => downloadTemplate(funds)} className="text-accent hover:underline">Descarregar plantilla amb els teus fons</button>
          </p>
          <div className="space-y-3">
            <select value={bulkIsin} onChange={e => setBulkIsin(e.target.value)} className={`${input} w-full`}>
              <option value="">L&apos;ISIN és a cada fila</option>
              {funds.map(f => <option key={f.isin} value={f.isin}>Tot és de: {f.name} · {f.isin}</option>)}
            </select>
            <textarea value={text} onChange={e => { setText(e.target.value); setPreview(null); }} rows={6} disabled={!!file}
              placeholder={'LU0996182563\t31/10/2026\t412,35\tEUR\nLU0996182563\t30/09/2026\t405,10\tEUR'}
              className={`${input} w-full font-mono text-xs disabled:opacity-40`} />
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt" onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}
                className="text-ink-soft text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-subtle-strong file:text-ink" />
              {file && <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-ink-muted text-xs hover:text-ink">Treure fitxer</button>}
            </div>
            <div className="flex gap-2">
              <button onClick={review} disabled={busy !== null} className={ghost}>{busy === 'preview' ? 'Revisant…' : 'Revisar'}</button>
              {preview?.ok && preview.total > 0 && (
                <button onClick={commit} disabled={busy !== null} className={gold}>{busy === 'commit' ? 'Desant…' : `Desar ${preview.total} preus`}</button>
              )}
            </div>
          </div>

          {preview && (
            <div className="mt-4 space-y-2 text-sm">
              {preview.errors.length > 0 && (
                <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 text-negative text-xs space-y-0.5">
                  <p className="font-semibold">Corregeix això abans de desar:</p>
                  {preview.errors.slice(0, 15).map((e, i) => <p key={i}>{e.line ? `Línia ${e.line}: ` : ''}{e.message}</p>)}
                  {preview.errors.length > 15 && <p>… i {preview.errors.length - 15} més</p>}
                </div>
              )}
              {preview.warnings.length > 0 && (
                <div className="text-warning/80 text-xs space-y-0.5">
                  {preview.warnings.slice(0, 8).map((w, i) => <p key={i}>{w.line ? `Línia ${w.line}: ` : ''}{w.message}</p>)}
                </div>
              )}
              {preview.funds.length > 0 && (
                <table className="w-full text-xs">
                  <thead><tr className="text-ink-muted text-left"><th className="font-normal py-1">Fons</th><th className="font-normal">Preus</th><th className="font-normal">Des de</th><th className="font-normal">Fins a</th></tr></thead>
                  <tbody>
                    {preview.funds.map(f => (
                      <tr key={f.isin} className="border-t border-line text-ink-soft">
                        <td className="py-1">{fundName(f.isin)} <span className="text-ink-muted font-mono">{f.isin}</span></td>
                        <td>{f.count} ({f.currency})</td><td>{fmtDate(f.from)}</td><td>{fmtDate(f.to)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Fons ── */}
      <div className={`${card} overflow-x-auto`}>
        <h3 className="text-ink-soft text-xs font-medium mb-3">Fons i mètriques calculades (últims 5 anys com a màxim)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ink-muted text-xs text-left">
              <th className="py-1 pr-3 font-normal">Fons</th>
              <th className="py-1 px-2 font-normal">Estat</th>
              <th className="py-1 px-2 font-normal text-right">Preus</th>
              <th className="py-1 px-2 font-normal">Últim preu</th>
              <th className="py-1 px-2 font-normal text-right" title="Rendibilitat anualitzada del període">Rend. anual</th>
              <th className="py-1 px-2 font-normal text-right">12 mesos</th>
              <th className="py-1 px-2 font-normal text-right" title="Quant oscil·la el fons: com més alta, més risc">Volatilitat</th>
              <th className="py-1 px-2 font-normal text-right" title="Pitjor caiguda des d'un màxim">Caiguda màx.</th>
            </tr>
          </thead>
          <tbody>
            {funds.map(f => {
              const m = f.metrics, st = status(m);
              return (
                <tr key={f.isin} onClick={() => setOpen(open === f.isin ? null : f.isin)}
                  className={`border-t border-line cursor-pointer hover:bg-subtle ${open === f.isin ? 'bg-subtle' : ''}`}>
                  <td className="py-2 pr-3"><div className="text-ink">{f.name}</div><div className="text-ink-muted text-xs font-mono">{f.isin}{!f.inList && ' · fora de la llista'}</div></td>
                  <td className={`py-2 px-2 text-xs ${st.cls}`} title={st.hint}>{st.label}{!m.usable && m.reason && m.points > 0 && <div className="text-ink-muted">{m.reason}</div>}</td>
                  <td className="py-2 px-2 text-right text-ink-soft">{m.points}</td>
                  <td className="py-2 px-2 text-ink-soft whitespace-nowrap">{m.lastDate ? `${num(m.lastNav)} ${f.currency ?? ''} · ${fmtDate(m.lastDate)}` : '—'}</td>
                  <td className="py-2 px-2 text-right text-ink">{pct(m.annualReturn)}</td>
                  <td className="py-2 px-2 text-right text-ink-soft">{pct(m.return1Y)}</td>
                  <td className="py-2 px-2 text-right text-ink-soft">{pct(m.volatility)}</td>
                  <td className="py-2 px-2 text-right text-negative/80">{pct(m.maxDrawdown)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-ink-muted text-xs mt-3">
          Fes clic en un fons per veure&apos;n els preus. Les classes de distribució (Inc / Dis) perden valor quan paguen dividend:
          la rendibilitat d&apos;aquests fons no inclou el dividend.
        </p>
      </div>

      {open && (
        <div className={card}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div><h3 className="text-ink font-semibold">{fundName(open)}</h3><p className="text-ink-muted text-xs font-mono">{open}</p></div>
            <button onClick={() => setOpen(null)} className="text-ink-muted hover:text-ink text-sm">Tancar</button>
          </div>
          {!detail ? <p className="text-ink-muted text-sm">Carregant…</p> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                {[
                  ['Rendibilitat anual', pct(detail.metrics.annualReturn), detail.metrics.years ? `${detail.metrics.years.toLocaleString('ca-ES')} anys` : ''],
                  ['Últims 12 mesos', pct(detail.metrics.return1Y), ''],
                  ['Volatilitat', pct(detail.metrics.volatility), 'anual'],
                  ['Caiguda màxima', pct(detail.metrics.maxDrawdown), 'des d\'un màxim'],
                  ['Pitjor any', pct(detail.metrics.worst12M), '12 mesos seguits'],
                ].map(([l, v, s]) => (
                  <div key={l}><p className="text-ink-muted text-xs">{l}</p><p className="text-ink font-bold">{v}</p>{s && <p className="text-ink-muted text-[11px]">{s}</p>}</div>
                ))}
              </div>
              {detail.metrics.missingMonths.length > 0 && (
                <p className="text-warning/80 text-xs">Falten preus d&apos;aquests mesos: {detail.metrics.missingMonths.map(ymLabel).join(', ')}</p>
              )}
              {detail.metrics.suspect.length > 0 && (
                <p className="text-negative/90 text-xs">Salts sospitosos (més del 40 % d&apos;un preu al següent): {detail.metrics.suspect.map(j => `${fmtDate(j.date)} (${j.change > 0 ? '+' : ''}${j.change} %)`).join(', ')}. Corregeix el preu o esborra&apos;l.</p>
              )}
              {!detail.metrics.usable && detail.metrics.reason && <p className="text-ink-muted text-xs">No es fa servir a les propostes: {detail.metrics.reason}.</p>}
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-ink-muted text-xs text-left"><th className="font-normal py-1">Data</th><th className="font-normal text-right">Valor liquidatiu</th><th className="font-normal text-right">Variació</th><th /></tr></thead>
                  <tbody>
                    {[...detail.points].reverse().map((p, i, arr) => {
                      const prev = arr[i + 1];
                      const ch = prev ? (p.nav / prev.nav - 1) * 100 : null;
                      return (
                        <tr key={p.date} className="border-t border-line text-ink-soft">
                          <td className="py-1.5">{fmtDate(p.date)}</td>
                          <td className="py-1.5 text-right text-ink">{num(p.nav)} {p.currency}</td>
                          <td className={`py-1.5 text-right ${ch === null ? '' : ch < 0 ? 'text-negative/80' : 'text-positive/80'}`}>{ch === null ? '' : pct(Math.round(ch * 100) / 100)}</td>
                          <td className="py-1.5 text-right whitespace-nowrap">
                            <button onClick={() => { setOne({ isin: p.isin, date: p.date, nav: String(p.nav).replace('.', ','), currency: p.currency }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              className="text-ink-muted hover:text-ink text-xs mr-3">Corregir</button>
                            <button onClick={() => remove(p.isin, p.date)} className="text-negative/60 hover:text-negative text-xs">Esborrar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {detail.points.length > 0 && <button onClick={() => remove(open)} className="text-negative/70 hover:text-negative text-xs">Esborrar tots els preus d&apos;aquest fons</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
