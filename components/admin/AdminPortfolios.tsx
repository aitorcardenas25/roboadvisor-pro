'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AdminPortfolio, PortfolioAsset, AssetType, PortfolioStatus } from '@/lib/adminPortfolios';
import { HORIZON_OPTIONS } from '@/lib/adminPortfolios';
import type { InvestorProfile } from '@/lib/products';

const PROFILES: InvestorProfile[] = ['conservador', 'moderat', 'dinamic', 'agressiu'];
const STATUSES: PortfolioStatus[]  = ['draft', 'active', 'archived'];
const STATUS_LABELS: Record<PortfolioStatus, { label: string; color: string }> = {
  draft:    { label: 'Esborrany', color: 'text-ink-soft bg-subtle-strong' },
  active:   { label: 'Activa',    color: 'text-positive bg-positive/10' },
  archived: { label: 'Arxivada',  color: 'text-ink-muted bg-subtle' },
};
const PROFILE_COLORS: Record<InvestorProfile, string> = {
  conservador: '#10b981', moderat: '#3b82f6', dinamic: '#f59e0b', agressiu: '#ef4444',
};
const PIE_COLORS = ['rgb(var(--c-accent))','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899'];

interface FundResult { id: string; name: string; isin: string; manager: string; }

type View = 'list' | 'create' | 'edit' | 'detail';

interface FormState {
  name: string; description: string; recommendedProfile: InvestorProfile;
  horizon: string; justification: string; status: PortfolioStatus;
  assets: PortfolioAsset[];
}

const EMPTY_FORM: FormState = {
  name: '', description: '', recommendedProfile: 'moderat',
  horizon: '5–10 anys', justification: '', status: 'draft', assets: [],
};

export default function AdminPortfolios() {
  const [portfolios, setPortfolios] = useState<AdminPortfolio[]>([]);
  const [view, setView]             = useState<View>('list');
  const [editing, setEditing]       = useState<AdminPortfolio | null>(null);
  const [detail, setDetail]         = useState<AdminPortfolio | null>(null);
  const [form, setForm]             = useState<FormState>({ ...EMPTY_FORM });
  const [loading, setLoading]       = useState(false);
  const [feedback, setFeedback]     = useState('');

  // Fund search
  const [fundQuery, setFundQuery]   = useState('');
  const [fundResults, setFundResults] = useState<FundResult[]>([]);
  const [assetType, setAssetType]   = useState<AssetType>('fund');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPortfolios = useCallback(async () => {
    const res = await fetch('/api/admin/portfolios');
    if (res.ok) setPortfolios((await res.json()).portfolios);
  }, []);

  useEffect(() => { fetchPortfolios(); }, [fetchPortfolios]);

  // Debounced fund search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (fundQuery.length < 2) { setFundResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/fons/search?q=${encodeURIComponent(fundQuery)}`);
      if (res.ok) setFundResults((await res.json()).results);
    }, 300);
  }, [fundQuery]);

  const notify = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(''), 3000); };

  const totalWeight = form.assets.reduce((s, a) => s + a.weight, 0);
  const weightOk    = Math.abs(totalWeight - 100) < 0.01;

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setView('create'); };
  const openEdit   = (p: AdminPortfolio) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description, recommendedProfile: p.recommendedProfile,
      horizon: p.horizon, justification: p.justification, status: p.status, assets: [...p.assets] });
    setView('edit');
  };

  const addAsset = (fund: FundResult) => {
    if (form.assets.some(a => a.id === fund.id)) return;
    const remaining = Math.max(0, 100 - totalWeight);
    const weight    = Math.round(remaining / (form.assets.length + 1)) || 0;
    setForm(prev => ({
      ...prev,
      assets: [...prev.assets, {
        type: assetType, id: fund.id, name: fund.name,
        isin: fund.isin, weight, justification: '',
      }],
    }));
    setFundQuery(''); setFundResults([]);
  };

  const removeAsset = (idx: number) =>
    setForm(prev => ({ ...prev, assets: prev.assets.filter((_, i) => i !== idx) }));

  const updateAssetWeight = (idx: number, weight: number) =>
    setForm(prev => ({ ...prev, assets: prev.assets.map((a, i) => i === idx ? { ...a, weight } : a) }));

  const updateAssetNote = (idx: number, justification: string) =>
    setForm(prev => ({ ...prev, assets: prev.assets.map((a, i) => i === idx ? { ...a, justification } : a) }));

  const distributeEvenly = () => {
    if (!form.assets.length) return;
    const w = Math.round((100 / form.assets.length) * 10) / 10;
    setForm(prev => ({ ...prev, assets: prev.assets.map((a, i) =>
      ({ ...a, weight: i === prev.assets.length - 1 ? Math.round((100 - w * (prev.assets.length - 1)) * 10) / 10 : w })
    )}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightOk && form.assets.length > 0) { notify('Els pesos han de sumar 100%.'); return; }
    setLoading(true);
    const url    = editing ? `/api/admin/portfolios/${editing.id}` : '/api/admin/portfolios';
    const method = editing ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) { notify(editing ? 'Cartera actualitzada.' : 'Cartera creada.'); setView('list'); fetchPortfolios(); }
    else        { notify((await res.json()).error ?? 'Error.'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar aquesta cartera?')) return;
    const res = await fetch(`/api/admin/portfolios/${id}`, { method: 'DELETE' });
    if (res.ok) { notify('Eliminada.'); fetchPortfolios(); }
  };

  const handleStatus = async (id: string, status: PortfolioStatus) => {
    const res = await fetch(`/api/admin/portfolios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { notify(`Estat: ${STATUS_LABELS[status].label}`); fetchPortfolios(); }
  };

  const inp = 'w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50';

  // ── LIST ──────────────────────────────────────────────────────────────────

  if (view === 'list') return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-ink font-bold text-xl">Carteres Model</h2>
          <p className="text-ink-muted text-sm">{portfolios.filter(p => p.status === 'active').length} actives · {portfolios.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          {feedback && <span className="text-accent text-sm">{feedback}</span>}
          <button onClick={openCreate} className="bg-accent hover:bg-accent-hover text-accent-ink font-bold text-sm px-4 py-2 rounded-lg transition-colors">
            + Nova cartera
          </button>
        </div>
      </div>

      {portfolios.length === 0 && <p className="text-ink-muted text-sm text-center py-10">Cap cartera. Clica "+ Nova cartera".</p>}

      <div className="space-y-4">
        {portfolios.map(p => {
          const s  = STATUS_LABELS[p.status];
          const pc = PROFILE_COLORS[p.recommendedProfile];
          return (
            <div key={p.id} className="bg-subtle border border-line rounded-lg p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ color: pc, backgroundColor: pc + '20' }}>
                      {p.recommendedProfile.charAt(0).toUpperCase() + p.recommendedProfile.slice(1)}
                    </span>
                    <span className="text-ink-muted text-xs">{p.horizon}</span>
                  </div>
                  <h3 className="text-ink font-semibold text-base">{p.name}</h3>
                  <p className="text-ink-muted text-xs mt-0.5">{p.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-ink-muted">
                    <span>{p.assets.length} actius</span>
                    {p.expectedReturn && <span className="text-positive">+{p.expectedReturn}% retorn est.</span>}
                    {p.expectedVol    && <span className="text-warning">{p.expectedVol}% vol est.</span>}
                    <span className={Math.abs(p.totalWeight - 100) < 0.01 ? 'text-positive' : 'text-negative'}>
                      Σ {p.totalWeight.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
                  <button onClick={() => { setDetail(p); setView('detail'); }} className="text-xs px-3 py-1.5 bg-subtle-strong hover:bg-subtle-strong text-ink rounded-lg transition-colors">Veure</button>
                  <button onClick={() => openEdit(p)} className="text-xs px-3 py-1.5 bg-subtle-strong hover:bg-subtle-strong text-ink rounded-lg transition-colors">Editar</button>
                  {p.status === 'draft'  && <button onClick={() => handleStatus(p.id, 'active')}   className="text-xs px-3 py-1.5 bg-positive/20 hover:bg-positive/30 text-positive rounded-lg transition-colors">Activar</button>}
                  {p.status === 'active' && <button onClick={() => handleStatus(p.id, 'archived')} className="text-xs px-3 py-1.5 bg-subtle-strong hover:bg-subtle-strong text-ink-soft rounded-lg transition-colors">Arxivar</button>}
                  <button onClick={() => handleDelete(p.id)} className="text-xs px-3 py-1.5 bg-negative/20 hover:bg-negative/30 text-negative rounded-lg transition-colors">Eliminar</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── DETAIL ────────────────────────────────────────────────────────────────

  if (view === 'detail' && detail) return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-ink-muted hover:text-ink text-sm transition-colors">← Tornar</button>
        <h2 className="text-ink font-bold text-xl">{detail.name}</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[detail.status].color}`}>{STATUS_LABELS[detail.status].label}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          ['Perfil', detail.recommendedProfile],
          ['Horitzó', detail.horizon],
          ['Retorn est.', detail.expectedReturn ? `+${detail.expectedReturn}%` : '—'],
          ['Volatilitat est.', detail.expectedVol ? `${detail.expectedVol}%` : '—'],
          ['Total pesos', `${detail.totalWeight.toFixed(1)}%`],
          ['Actualitzat', detail.updatedAt],
        ].map(([l, v]) => (
          <div key={l} className="bg-subtle rounded-lg p-3">
            <p className="text-ink-muted text-xs font-medium mb-0.5">{l}</p>
            <p className="text-ink font-semibold text-sm">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="bg-subtle border border-line rounded-lg p-5">
          <p className="text-ink-muted text-xs font-medium mb-4">Distribució</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={detail.assets.map(a => ({ name: a.name.slice(0, 22), value: a.weight }))}
                dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={75}
                label={({ value }) => `${value}%`} labelLine>
                {detail.assets.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ background: 'rgb(var(--c-surface))', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 11 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Asset list */}
        <div className="bg-subtle border border-line rounded-lg p-5">
          <p className="text-ink-muted text-xs font-medium mb-4">Actius ({detail.assets.length})</p>
          <div className="space-y-2">
            {detail.assets.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-ink text-xs truncate">{a.name}</span>
                </div>
                <span className="text-accent text-xs font-mono font-bold flex-shrink-0">{a.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {detail.justification && (
        <div className="bg-subtle border border-line rounded-lg p-5">
          <p className="text-ink-muted text-xs font-medium mb-2">Justificació</p>
          <p className="text-ink-soft text-sm leading-relaxed">{detail.justification}</p>
        </div>
      )}

      {detail.assets.some(a => a.justification) && (
        <div className="space-y-2">
          <p className="text-ink-muted text-xs font-medium">Notes per actiu</p>
          {detail.assets.filter(a => a.justification).map((a, i) => (
            <div key={i} className="bg-subtle rounded-lg p-4">
              <p className="text-ink text-xs font-medium mb-1">{a.name} — <span className="font-mono text-accent">{a.weight}%</span></p>
              <p className="text-ink-soft text-xs leading-relaxed">{a.justification}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── CREATE / EDIT FORM ────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setView('list')} className="text-ink-muted hover:text-ink text-sm transition-colors">← Tornar</button>
        <h2 className="text-ink font-bold text-xl">{editing ? `Editar: ${editing.name}` : 'Nova cartera model'}</h2>
        {feedback && <span className="text-accent text-sm ml-auto">{feedback}</span>}
      </div>

      {/* Metadata */}
      <div className="bg-subtle border border-line rounded-lg p-5 space-y-4">
        <p className="text-ink-muted text-xs font-medium">Informació general</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-ink-soft text-xs font-medium mb-1">Nom *</label>
            <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-ink-soft text-xs font-medium mb-1">Descripció</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className="block text-ink-soft text-xs font-medium mb-1">Perfil recomanat *</label>
            <select value={form.recommendedProfile} onChange={e => setForm(p => ({ ...p, recommendedProfile: e.target.value as InvestorProfile }))}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50">
              {PROFILES.map(pr => <option key={pr} value={pr}>{pr.charAt(0).toUpperCase() + pr.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-ink-soft text-xs font-medium mb-1">Horitzó temporal</label>
            <select value={form.horizon} onChange={e => setForm(p => ({ ...p, horizon: e.target.value }))}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50">
              {HORIZON_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-ink-soft text-xs font-medium mb-1">Estat</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as PortfolioStatus }))}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50">
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s].label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-ink-soft text-xs font-medium mb-1">Justificació general</label>
          <textarea rows={3} value={form.justification} onChange={e => setForm(p => ({ ...p, justification: e.target.value }))}
            className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50 resize-y" />
        </div>
      </div>

      {/* Asset builder */}
      <div className="bg-subtle border border-line rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-ink-muted text-xs font-medium">
            Actius — Σ <span className={weightOk || form.assets.length === 0 ? 'text-positive' : 'text-negative'}>{totalWeight.toFixed(1)}%</span>
          </p>
          {form.assets.length > 1 && (
            <button type="button" onClick={distributeEvenly} className="text-xs px-3 py-1 bg-subtle-strong hover:bg-subtle-strong text-ink-soft rounded-lg transition-colors">
              Distribuir uniformement
            </button>
          )}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <select value={assetType} onChange={e => setAssetType(e.target.value as AssetType)}
            className="bg-surface border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none shrink-0">
            <option value="fund">Fons</option>
            <option value="etf">ETF</option>
            <option value="stock">Acció</option>
          </select>
          <div className="relative flex-1">
            <input value={fundQuery} onChange={e => setFundQuery(e.target.value)}
              placeholder="Cerca per nom, ISIN o gestora..."
              className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50" />
            {fundResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-surface border border-line-strong rounded-lg shadow-xl z-10 overflow-hidden">
                {fundResults.map(f => (
                  <button key={f.id} type="button" onClick={() => addAsset(f)}
                    disabled={form.assets.some(a => a.id === f.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-subtle transition-colors border-b border-line last:border-0 disabled:opacity-40">
                    <p className="text-ink text-sm font-medium">{f.name}</p>
                    <p className="text-ink-muted text-xs">{f.isin} · {f.manager}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Asset rows */}
        {form.assets.length === 0 && (
          <p className="text-ink-muted text-sm text-center py-4">Cerca i afegeix actius a la cartera.</p>
        )}
        <div className="space-y-3">
          {form.assets.map((a, i) => (
            <div key={i} className="bg-subtle rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <p className="text-ink text-sm font-medium truncate">{a.name}</p>
                    <span className="text-ink-muted text-xs flex-shrink-0">{a.isin}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input type="number" min={0} max={100} step={0.5}
                    value={a.weight}
                    onChange={e => updateAssetWeight(i, parseFloat(e.target.value) || 0)}
                    className="w-16 bg-subtle-strong border border-line rounded-lg px-2 py-1 text-ink text-sm text-center focus:outline-none focus:border-accent/50" />
                  <span className="text-ink-muted text-sm">%</span>
                  <button type="button" onClick={() => removeAsset(i)} className="text-negative/60 hover:text-negative text-lg leading-none transition-colors">×</button>
                </div>
              </div>
              <input value={a.justification} onChange={e => updateAssetNote(i, e.target.value)}
                placeholder="Justificació per a aquest actiu (opcional)..."
                className="w-full bg-subtle border border-line rounded-lg px-3 py-1.5 text-ink-soft text-xs focus:outline-none focus:border-accent/30" />
            </div>
          ))}
        </div>

        {!weightOk && form.assets.length > 0 && (
          <p className="text-negative text-xs">⚠ Els pesos sumen {totalWeight.toFixed(1)}%. Han de sumar exactament 100%.</p>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => setView('list')} className="px-4 py-2 bg-subtle-strong hover:bg-subtle-strong text-ink text-sm rounded-lg transition-colors">Cancel·lar</button>
        <button type="submit" disabled={loading} className="px-6 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-ink font-bold text-sm rounded-lg transition-colors">
          {loading ? 'Desant...' : editing ? 'Desar canvis' : 'Crear cartera'}
        </button>
      </div>
    </form>
  );
}
