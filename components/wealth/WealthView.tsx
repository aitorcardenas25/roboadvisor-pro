'use client';

// Patrimoni consolidat: tot el que té el client en una sola pantalla.
// Tot el càlcul és al servidor (lib/wealth.ts); aquí només es mostra i s'edita.
// El fa servir el portal del client i la fitxa del client de l'admin.
import { useCallback, useEffect, useState } from 'react';
import {
  ASSET_KINDS, DEBT_KINDS, isDebtKind,
  type ConsolidatedWealth, type WealthItem, type WealthLine, type WealthGroup,
} from '@/lib/wealth';

interface Payload { wealth: ConsolidatedWealth; items: WealthItem[]; hasPortfolio: boolean }

const card  = 'bg-surface border border-line rounded-lg';
const input = 'w-full bg-subtle border border-line rounded-md px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/60';

const eur = (n: number, dec = 0) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = (n: number, sign = true) => `${sign && n > 0 ? '+' : ''}${n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const fDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const today = () => new Date().toISOString().slice(0, 10);

// Un to per grup (paleta sòbria del portal)
const GROUP_COLOR: Record<WealthGroup, string> = {
  inversions: '#1e4d3f',
  liquiditat: '#6b8f84',
  immobles:   '#8a7a5a',
  altres:     '#b9c2be',
};

const SOURCE_TEXT: Record<WealthLine['source'], string> = {
  'preus-oficials':    'Valor liquidatiu oficial',
  'declarat-client':   'Valor que has entrat',
  'declarat-assessor': 'Valor entrat per l\'assessor',
  'questionari':       'De les teves dades',
};
const SOURCE_TEXT_ADMIN: Record<WealthLine['source'], string> = {
  'preus-oficials':    'VL oficial',
  'declarat-client':   'Entrat pel client',
  'declarat-assessor': 'Entrat per l\'assessor',
  'questionari':       'Qüestionari / Excel',
};

export default function WealthView({ endpoint, audience = 'client' }: {
  /** /api/client/wealth o /api/admin/clients/{id}/wealth */
  endpoint: string;
  audience?: 'client' | 'admin';
}) {
  const [data, setData]       = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [editing, setEditing] = useState<WealthItem | 'new' | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await fetch(endpoint, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status === 401 ? 'Cal iniciar sessió.' : 'No s\'han pogut carregar les dades.');
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No s\'han pogut carregar les dades.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center py-20" role="status" aria-label="Carregant">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !data) return <p className="text-negative text-sm py-10 text-center">{error || 'Dades no disponibles'}</p>;

  const { wealth: w, items } = data;
  const isAdmin = audience === 'admin';
  const empty = w.groups.length === 0 && w.debts.length === 0;
  const itemById = new Map(items.map(i => [i.id, i]));
  const sourceText = isAdmin ? SOURCE_TEXT_ADMIN : SOURCE_TEXT;

  return (
    <div className="space-y-5">
      {/* ── Total ── */}
      <section className={`${card} px-6 py-6 sm:px-8`} aria-labelledby="wealth-total">
        <p id="wealth-total" className="text-ink-muted text-sm">{isAdmin ? 'Patrimoni net del client' : 'El teu patrimoni net'}</p>
        <p className="text-ink font-semibold text-4xl sm:text-5xl tabular-nums tracking-tight mt-1">{eur(w.netWorth)}</p>
        <p className="text-ink-muted text-xs mt-2">
          {eur(w.grossAssets)} en béns{w.totalDebt > 0 ? ` − ${eur(w.totalDebt)} de deutes` : ''} · a {fDate(w.asOf)}
        </p>

        {w.grossAssets > 0 && (
          <div className="mt-6">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-subtle" aria-hidden="true">
              {w.groups.map(g => (
                <div key={g.group} style={{ width: `${g.pct}%`, background: GROUP_COLOR[g.group] }} />
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {w.groups.map(g => (
                <li key={g.group}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: GROUP_COLOR[g.group] }} />
                    <span className="text-ink-soft text-xs">{g.label}</span>
                  </div>
                  <p className="text-ink text-sm font-semibold tabular-nums mt-0.5">{eur(g.value)}</p>
                  <p className="text-ink-muted text-xs tabular-nums">{g.pct.toLocaleString('ca-ES', { maximumFractionDigits: 1 })} %</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {w.warnings.length > 0 && (
        <div className="border border-warning/30 bg-warning/[0.05] rounded-lg px-4 py-3 space-y-1">
          {w.warnings.map((t, i) => <p key={i} className="text-warning text-xs">{t}</p>)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Rendibilitat de les inversions ── */}
        <section className={`${card} p-5 lg:col-span-1`} aria-labelledby="wealth-return">
          <h2 id="wealth-return" className="text-ink font-semibold text-sm">Rendibilitat de les inversions</h2>
          {w.investments ? <ReturnBlock r={w.investments} isAdmin={isAdmin} /> : (
            <p className="text-ink-muted text-xs mt-3 leading-relaxed">
              {isAdmin ? 'El client encara no té cartera activa a la plataforma.' : 'Encara no tens cap cartera seguida a Factor OTC. Quan en tinguis, aquí veuràs quant has guanyat de veritat.'}
            </p>
          )}
        </section>

        {/* ── Per entitat ── */}
        <section className={`${card} p-5 lg:col-span-2`} aria-labelledby="wealth-entities">
          <h2 id="wealth-entities" className="text-ink font-semibold text-sm">On tens els diners</h2>
          {w.byEntity.length === 0 ? (
            <p className="text-ink-muted text-xs mt-3">Encara no hi ha cap bé registrat.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {w.byEntity.map(e => (
                <li key={e.entity}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ink-soft text-sm truncate">{e.entity}</span>
                    <span className="text-ink text-sm tabular-nums flex-shrink-0">{eur(e.value)} <span className="text-ink-muted text-xs">· {e.pct.toLocaleString('ca-ES', { maximumFractionDigits: 1 })} %</span></span>
                  </div>
                  <div className="h-1.5 bg-subtle rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-accent/70 rounded-full" style={{ width: `${e.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Detall ── */}
      <section className={card} aria-labelledby="wealth-detail">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div>
            <h2 id="wealth-detail" className="text-ink font-semibold text-sm">Detall</h2>
            <p className="text-ink-muted text-xs mt-1">
              {isAdmin
                ? 'Els fons de la cartera activa es valoren amb el VL oficial. La resta són valors declarats: afegeix comptes, dipòsits, plans de pensions, immobles o deutes.'
                : 'Els fons que seguim es valoren sols amb el preu oficial. Afegeix la resta (comptes, plans de pensions, pis, hipoteca...) per veure-ho tot junt.'}
            </p>
          </div>
          {editing === null && (
            <button type="button" onClick={() => setEditing('new')}
              className="px-3 py-2 rounded-md bg-accent text-accent-ink text-sm font-medium hover:bg-accent-hover">
              Afegir
            </button>
          )}
        </div>

        {editing !== null && (
          <div className="px-5 pt-4">
            <ItemForm endpoint={endpoint} item={editing === 'new' ? null : editing}
              onDone={async () => { setEditing(null); await load(); }}
              onCancel={() => setEditing(null)} />
          </div>
        )}

        {empty ? (
          <p className="text-ink-muted text-sm px-5 py-8">Encara no hi ha res. Comença afegint el teu compte principal.</p>
        ) : (
          <div className="mt-4">
            {w.groups.map(g => (
              <LineGroup key={g.group} title={g.label} total={g.value} color={GROUP_COLOR[g.group]} lines={g.lines}
                sourceText={sourceText} onEdit={id => { const it = itemById.get(id); if (it) setEditing(it); }} />
            ))}
            {w.debts.length > 0 && (
              <LineGroup title="Deutes" total={-w.totalDebt} color="#b42820" lines={w.debts} negative
                sourceText={sourceText} onEdit={id => { const it = itemById.get(id); if (it) setEditing(it); }} />
            )}
          </div>
        )}
      </section>

      {isAdmin && w.declaredNetWorth !== null && Math.abs(w.declaredNetWorth - w.netWorth) > 1 && (
        <p className="text-ink-muted text-xs">
          A l&apos;Excel el client va declarar un patrimoni net de {eur(w.declaredNetWorth)} (diferència de {eur(w.netWorth - w.declaredNetWorth)} amb el que hi ha registrat aquí).
        </p>
      )}

      <p className="text-ink-muted text-xs leading-relaxed">
        Informació descriptiva amb les dades registrades. Els valors que no són fons seguits són els que s&apos;han entrat a mà i poden no estar al dia. No és una recomanació d&apos;inversió.
      </p>
    </div>
  );
}

function ReturnBlock({ r, isAdmin }: { r: NonNullable<ConsolidatedWealth['investments']>; isAdmin: boolean }) {
  const col = (n: number | null) => (n === null ? undefined : n >= 0 ? 'rgb(var(--c-positive))' : 'rgb(var(--c-negative))');
  return (
    <div className="mt-3">
      <p className="text-3xl font-semibold tabular-nums" style={{ color: col(r.twrPct) }}>{r.twrPct === null ? 'N/D' : pct(r.twrPct)}</p>
      <p className="text-ink-muted text-xs mt-1">
        {r.method === 'navs'
          ? `Des del ${fDate(r.since)}, sense comptar els diners que hi has anat posant.`
          : 'Guany sobre els diners posats (encara no hi ha prou preus oficials per al càlcul mes a mes).'}
      </p>
      <dl className="mt-4 divide-y divide-line border-t border-line">
        <Row label={r.method === 'navs' ? 'Valor (a data de preus oficials)' : 'Valor actual'} value={eur(r.value)} />
        <Row label={isAdmin ? 'Aportat net' : 'Diners que hi has posat'} value={eur(r.netContributed)} />
        <Row label={isAdmin ? 'Guany / pèrdua' : 'Has guanyat'} value={`${r.gainEur > 0 ? '+' : ''}${eur(r.gainEur)}`} color={col(r.gainEur)} />
        {r.annualPct !== null && <Row label="Anualitzada" value={pct(r.annualPct)} color={col(r.annualPct)} />}
        {r.ytdPct !== null && <Row label="Aquest any" value={pct(r.ytdPct)} color={col(r.ytdPct)} />}
      </dl>
      {r.priceDate && <p className="text-ink-muted text-[11px] mt-3">Preus oficials a {fDate(r.priceDate)}.</p>}
      {isAdmin && r.method === 'navs' && (
        <p className="text-ink-muted text-[11px] mt-1">Modified Dietz mensual encadenat (time-weighted).</p>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-ink-muted text-xs">{label}</dt>
      <dd className="text-ink text-sm tabular-nums" style={color ? { color } : undefined}>{value}</dd>
    </div>
  );
}

function LineGroup({ title, total, color, lines, negative, sourceText, onEdit }: {
  title: string; total: number; color: string; lines: WealthLine[]; negative?: boolean;
  sourceText: Record<WealthLine['source'], string>; onEdit: (id: string) => void;
}) {
  return (
    <div className="border-t border-line">
      <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-subtle/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <h3 className="text-ink-soft text-xs font-semibold uppercase tracking-wide">{title}</h3>
        </div>
        <span className={`text-sm font-semibold tabular-nums ${negative ? 'text-negative' : 'text-ink'}`}>{eur(total)}</span>
      </div>
      <ul className="divide-y divide-line">
        {lines.map((l, i) => (
          <li key={l.id ?? `${l.kind}-${i}`} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="text-ink text-sm truncate">{l.name}</p>
              <p className="text-ink-muted text-xs">
                {[l.label, l.entity, sourceText[l.source], l.asOf ? fDate(l.asOf) : null].filter(Boolean).join(' · ')}
                {l.stale && <span className="text-warning"> · cal actualitzar</span>}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`text-sm tabular-nums ${negative ? 'text-negative' : 'text-ink'}`}>{negative ? '−' : ''}{eur(l.value)}</span>
              {l.id && (
                <button type="button" onClick={() => onEdit(l.id!)} className="text-xs text-ink-muted hover:text-accent underline-offset-2 hover:underline">
                  Editar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemForm({ endpoint, item, onDone, onCancel }: {
  endpoint: string; item: WealthItem | null; onDone: () => void | Promise<void>; onCancel: () => void;
}) {
  const [kind, setKind]     = useState<string>(item?.kind ?? 'compte');
  const [name, setName]     = useState(item?.name ?? '');
  const [entity, setEntity] = useState(item?.entity ?? '');
  const [value, setValue]   = useState(item ? String(item.value) : '');
  const [asOf, setAsOf]     = useState(item?.asOf ?? today());
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const debt = isDebtKind(kind);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    // "12.500,50" (format català) o "12500.5"
    const raw = value.trim().replace(/\s|€/g, '');
    // Punts com a separador de milers ("95.000", "1.250.000") o decimals amb coma
    const thousands = /^\d{1,3}(\.\d{3})+$/.test(raw);
    const n = Number(raw.includes(',') || thousands ? raw.replace(/\./g, '').replace(',', '.') : raw);
    if (!name.trim()) { setError('Posa-hi un nom.'); return; }
    if (!Number.isFinite(n) || n < 0) { setError('L\'import ha de ser 0 o més.'); return; }
    setSaving(true);
    try {
      const url = item ? `${endpoint}?id=${encodeURIComponent(item.id)}` : endpoint;
      const r = await fetch(url, {
        method: item ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name: name.trim(), entity: entity.trim(), value: n, asOf }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'No s\'ha pogut desar.');
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s\'ha pogut desar.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item || !confirm(`Esborrar "${item.name}"?`)) return;
    setSaving(true);
    const r = await fetch(`${endpoint}?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.ok) await onDone(); else setError(j.error ?? 'No s\'ha pogut esborrar.');
  }

  return (
    <form onSubmit={submit} className="border border-line rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="block sm:col-span-2"><span className="text-ink-muted text-xs">Què és</span>
        <select className={input} value={kind} onChange={e => setKind(e.target.value)}>
          <optgroup label="Béns">
            {Object.entries(ASSET_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </optgroup>
          <optgroup label="Deutes">
            {Object.entries(DEBT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </optgroup>
        </select></label>
      <label className="block"><span className="text-ink-muted text-xs">Nom</span>
        <input className={input} maxLength={80} value={name} onChange={e => setName(e.target.value)}
          placeholder={debt ? 'Hipoteca del pis' : 'Compte nòmina'} /></label>
      <label className="block"><span className="text-ink-muted text-xs">Entitat (opcional)</span>
        <input className={input} maxLength={60} value={entity} onChange={e => setEntity(e.target.value)} placeholder="CaixaBank, MyInvestor..." /></label>
      <label className="block"><span className="text-ink-muted text-xs">{debt ? 'Import pendent (€)' : 'Valor actual (€)'}</span>
        <input type="text" inputMode="decimal" className={input} value={value} onChange={e => setValue(e.target.value)} placeholder="0" /></label>
      <label className="block"><span className="text-ink-muted text-xs">A data de</span>
        <input type="date" className={input} value={asOf} max={today()} onChange={e => setAsOf(e.target.value)} /></label>
      {error && <p className="text-negative text-xs sm:col-span-2" role="alert">{error}</p>}
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-accent text-accent-ink text-sm font-medium disabled:opacity-50">{saving ? 'Desant…' : 'Desar'}</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-subtle text-ink-soft text-sm hover:bg-subtle-strong">Cancel·lar</button>
        {item && <button type="button" onClick={remove} disabled={saving} className="ml-auto px-4 py-2 rounded-md text-negative text-sm hover:bg-negative/10">Esborrar</button>}
      </div>
    </form>
  );
}
