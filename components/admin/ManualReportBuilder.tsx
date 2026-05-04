'use client';

import { useState, useMemo } from 'react';
import { pdf } from '@react-pdf/renderer';
import { ManualReportPDF } from '@/components/pdf/ManualReportPDF';
import { FINANCIAL_PRODUCTS, type FinancialProduct } from '@/lib/products';
import type { ManualAsset, ManualPortfolioInput } from '@/lib/manualReport';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssetRow extends ManualAsset {
  _key: string;
}

type Step = 1 | 2 | 3;

const PROFILES = ['conservador', 'moderat', 'dinamic', 'agressiu'] as const;
const OBJECTIVES = [
  'Preservació de capital',
  'Creixement moderat',
  'Creixement a llarg termini',
  'Màxima rendibilitat',
  'Renda passiva',
  'Estalvi per a jubilació',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function totalWeight(assets: AssetRow[]): number {
  return assets.reduce((s, a) => s + (a.weight || 0), 0);
}

function productToAsset(p: FinancialProduct, weight: number): AssetRow {
  return {
    _key:               p.id,
    name:               p.name,
    isin:               p.isin,
    ticker:             p.id,
    weight,
    category:           p.category,
    risk:               p.mifidRiskIndicator ?? p.risk * 1.2,
    ter:                p.ter,
    platform:           'Trade Republic / MyInvestor',
    justification:      p.justification,
    historicalReturn5Y: p.historicalReturn5Y,
    historicalVolatility: p.historicalVolatility,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WeightBar({ pct, warn }: { pct: number; warn: boolean }) {
  const color = warn ? '#dc2626' : pct === 100 ? '#16a34a' : '#c9a84c';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
        <div style={{ width: `${Math.min(pct, 100)}%`, background: color, transition: 'width 0.3s' }} className="h-full rounded-full" />
      </div>
      <span style={{ color }} className="font-mono text-sm w-12 text-right font-bold">{pct.toFixed(0)}%</span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-white/50 text-xs uppercase tracking-widest mb-1.5 font-sans">{children}</label>;
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-sans focus:outline-none focus:border-[#c9a84c]/50 placeholder-white/20"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-[#0d1f1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-sans focus:outline-none focus:border-[#c9a84c]/50">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── Step 1: Client data ───────────────────────────────────────────────────────

interface ClientForm {
  clientName: string; clientEmail: string;
  investorProfile: string; objective: string;
  horizon: number; initialAmount: number; monthlyAmount: number;
  adminNote: string;
}

function StepClientData({ form, setForm }: { form: ClientForm; setForm: (f: ClientForm) => void }) {
  const set = (k: keyof ClientForm) => (v: string) =>
    setForm({ ...form, [k]: k === 'horizon' || k === 'initialAmount' || k === 'monthlyAmount' ? Number(v) : v });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nom del client</Label>
          <Input value={form.clientName} onChange={set('clientName')} placeholder="Joan Garcia" />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.clientEmail} onChange={set('clientEmail')} placeholder="joan@exemple.cat" type="email" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Perfil d&apos;inversor</Label>
          <Select value={form.investorProfile} onChange={set('investorProfile')} options={PROFILES as unknown as string[]} />
        </div>
        <div>
          <Label>Objectiu</Label>
          <Select value={form.objective} onChange={set('objective')} options={OBJECTIVES} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Horitzó (anys)</Label>
          <Input value={form.horizon} onChange={set('horizon')} type="number" placeholder="10" />
        </div>
        <div>
          <Label>Capital inicial (€)</Label>
          <Input value={form.initialAmount} onChange={set('initialAmount')} type="number" placeholder="10000" />
        </div>
        <div>
          <Label>Aportació mensual (€)</Label>
          <Input value={form.monthlyAmount} onChange={set('monthlyAmount')} type="number" placeholder="200" />
        </div>
      </div>
      <div>
        <Label>Notes internes (admin)</Label>
        <textarea
          value={form.adminNote}
          onChange={e => set('adminNote')(e.target.value)}
          rows={3}
          placeholder="Context addicional per a l&apos;informe..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-sans focus:outline-none focus:border-[#c9a84c]/50 placeholder-white/20 resize-none" />
      </div>
    </div>
  );
}

// ── Step 2: Asset builder ─────────────────────────────────────────────────────

function StepAssets({ assets, setAssets }: { assets: AssetRow[]; setAssets: (a: AssetRow[]) => void }) {
  const [search, setSearch]         = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [custom, setCustom]         = useState<Partial<AssetRow>>({});

  const results = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return FINANCIAL_PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.isin.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search]);

  const addProduct = (p: FinancialProduct) => {
    if (assets.some(a => a.isin === p.isin)) return;
    const remaining = Math.max(0, 100 - totalWeight(assets));
    setAssets([...assets, productToAsset(p, remaining > 0 ? remaining : 5)]);
    setSearch('');
  };

  const addCustom = () => {
    if (!custom.name || !custom.isin) return;
    const row: AssetRow = {
      _key:          custom.isin!,
      name:          custom.name!,
      isin:          custom.isin!,
      ticker:        custom.ticker ?? '',
      weight:        custom.weight ?? 5,
      category:      custom.category ?? 'Personalitzat',
      risk:          custom.risk ?? 3,
      ter:           custom.ter ?? 0,
      platform:      custom.platform ?? '',
      justification: custom.justification ?? '',
    };
    if (assets.some(a => a.isin === row.isin)) return;
    setAssets([...assets, row]);
    setCustom({});
    setCustomMode(false);
  };

  const updateWeight = (key: string, w: number) =>
    setAssets(assets.map(a => a._key === key ? { ...a, weight: w } : a));

  const updateField = (key: string, field: keyof AssetRow, val: string) =>
    setAssets(assets.map(a => a._key === key ? { ...a, [field]: val } : a));

  const remove = (key: string) => setAssets(assets.filter(a => a._key !== key));

  const total = totalWeight(assets);
  const warn  = total > 100;

  return (
    <div className="space-y-5">

      {/* Search */}
      <div>
        <Label>Cerca producte (nom / ISIN / ticker)</Label>
        <div className="relative">
          <Input value={search} onChange={setSearch} placeholder="VWCE, IE00B3RBWM25, Vanguard..." />
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1f1a] border border-white/10 rounded-lg overflow-hidden z-10 shadow-xl">
              {results.map(p => (
                <button key={p.id} onClick={() => addProduct(p)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                  <div>
                    <div className="text-white text-sm font-medium">{p.name}</div>
                    <div className="text-white/40 text-xs font-mono">{p.isin} · {p.category} · TER {p.ter}%</div>
                  </div>
                  <span className="text-[#c9a84c] text-xs ml-3">+ Afegir</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom toggle */}
      <button onClick={() => setCustomMode(!customMode)}
        className="text-xs text-[#c9a84c]/70 hover:text-[#c9a84c] transition-colors font-sans">
        {customMode ? '▼ Tancar actiu personalitzat' : '+ Afegir actiu personalitzat'}
      </button>

      {customMode && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nom</Label>
              <Input value={custom.name ?? ''} onChange={v => setCustom({ ...custom, name: v })} placeholder="Nom del fons" />
            </div>
            <div>
              <Label>ISIN</Label>
              <Input value={custom.isin ?? ''} onChange={v => setCustom({ ...custom, isin: v })} placeholder="IE00XXXXXX" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Categoria</Label>
              <Input value={custom.category ?? ''} onChange={v => setCustom({ ...custom, category: v })} placeholder="RV Global" />
            </div>
            <div>
              <Label>TER (%)</Label>
              <Input value={custom.ter ?? ''} onChange={v => setCustom({ ...custom, ter: Number(v) })} type="number" placeholder="0.20" />
            </div>
            <div>
              <Label>Risc (1-7)</Label>
              <Input value={custom.risk ?? ''} onChange={v => setCustom({ ...custom, risk: Number(v) })} type="number" placeholder="4" />
            </div>
          </div>
          <div>
            <Label>Justificació</Label>
            <Input value={custom.justification ?? ''} onChange={v => setCustom({ ...custom, justification: v })} placeholder="Per què s'inclou aquest actiu..." />
          </div>
          <div>
            <Label>Plataforma</Label>
            <Input value={custom.platform ?? ''} onChange={v => setCustom({ ...custom, platform: v })} placeholder="Trade Republic / IBKR" />
          </div>
          <button onClick={addCustom}
            className="px-4 py-2 bg-[#1a3a2a] border border-[#2d6a4f]/40 text-[#c9a84c] text-sm font-semibold rounded-lg hover:bg-[#1f4432] transition-colors">
            Afegir actiu
          </button>
        </div>
      )}

      {/* Weight bar */}
      {assets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/40 text-xs font-sans">Pes total assignat</span>
            {warn && <span className="text-red-400 text-xs">Supera el 100%</span>}
            {!warn && total === 100 && <span className="text-green-400 text-xs">Perfecte</span>}
          </div>
          <WeightBar pct={total} warn={warn} />
        </div>
      )}

      {/* Asset table */}
      {assets.length > 0 && (
        <div className="space-y-2">
          {assets.map(a => (
            <div key={a._key} className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-white text-sm font-semibold">{a.name}</div>
                  <div className="text-white/35 text-xs font-mono">{a.isin} · {a.category} · TER {a.ter}%</div>
                </div>
                <button onClick={() => remove(a._key)}
                  className="text-white/20 hover:text-red-400 transition-colors text-xs">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Pes (%)</Label>
                  <input
                    type="number" min={0} max={100}
                    value={a.weight}
                    onChange={e => updateWeight(a._key, Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[#c9a84c] text-sm font-mono font-bold focus:outline-none focus:border-[#c9a84c]/50"
                  />
                </div>
                <div>
                  <Label>Plataforma</Label>
                  <Input value={a.platform} onChange={v => updateField(a._key, 'platform', v)} placeholder="Trade Republic" />
                </div>
              </div>
              <div className="mt-3">
                <Label>Justificació</Label>
                <Input value={a.justification} onChange={v => updateField(a._key, 'justification', v)} placeholder="Raó d'inclusió en la cartera..." />
              </div>
            </div>
          ))}
        </div>
      )}

      {assets.length === 0 && (
        <div className="text-center py-10 text-white/20 text-sm font-sans">
          Cerca i afegeix actius a la cartera
        </div>
      )}
    </div>
  );
}

// ── Step 3: Preview + generate ────────────────────────────────────────────────

function StepPreview({ form, assets, onGenerate, loading }: {
  form: ClientForm; assets: AssetRow[]; onGenerate: () => void; loading: boolean;
}) {
  const total = totalWeight(assets);
  const avgTER = assets.length > 0
    ? assets.reduce((s, a) => s + a.ter * a.weight / 100, 0)
    : 0;

  const COLORS = ['#c9a84c', '#16a34a', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444'];

  return (
    <div className="space-y-6">

      {/* Client summary */}
      <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-xl p-5">
        <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4 font-sans">Client</h3>
        <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-sm">
          {[
            ['Nom',             form.clientName],
            ['Email',           form.clientEmail],
            ['Perfil',          form.investorProfile],
            ['Objectiu',        form.objective],
            ['Horitzó',         `${form.horizon} anys`],
            ['Capital inicial', `${Number(form.initialAmount).toLocaleString('ca-ES')} €`],
            ['Aportació/mes',   `${Number(form.monthlyAmount).toLocaleString('ca-ES')} €`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2">
              <span className="text-white/35 font-sans w-28 flex-shrink-0">{k}</span>
              <span className="text-white font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Allocation bar */}
      {assets.length > 0 && (
        <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-xl p-5">
          <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4 font-sans">Assignació</h3>
          <div className="flex rounded-full overflow-hidden h-3 mb-3">
            {assets.map((a, i) => (
              <div key={a._key} style={{ width: `${a.weight}%`, background: COLORS[i % COLORS.length] }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {assets.map((a, i) => (
              <div key={a._key} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-white/45 text-xs font-sans truncate">{a.name}</span>
                <span className="text-white/70 text-xs font-mono ml-auto">{a.weight}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 flex justify-between text-xs">
            <span className="text-white/30 font-sans">TER mig ponderat</span>
            <span className="text-[#c9a84c] font-mono font-bold">{avgTER.toFixed(2)}%</span>
          </div>
          {total !== 100 && (
            <div className="mt-2 text-xs text-amber-400 font-sans">
              Atenció: el pes total és {total.toFixed(0)}% (ha de ser 100%)
            </div>
          )}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={loading || total !== 100 || assets.length === 0 || !form.clientName}
        className="w-full py-3 bg-[#1a3a2a] border border-[#2d6a4f]/60 text-[#c9a84c] font-bold text-sm rounded-xl hover:bg-[#1f4432] transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-sans">
        {loading ? 'Generant PDF...' : 'Descarregar informe PDF'}
      </button>

      {total !== 100 && assets.length > 0 && (
        <p className="text-white/25 text-xs text-center font-sans">
          Ajusta els pesos fins arribar al 100% per generar l&apos;informe
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Dades client'  },
  { n: 2, label: 'Actius'        },
  { n: 3, label: 'Previsualitza' },
];

export default function ManualReportBuilder() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [form, setForm] = useState<ClientForm>({
    clientName: '', clientEmail: '', investorProfile: 'moderat',
    objective: OBJECTIVES[0], horizon: 10, initialAmount: 10000,
    monthlyAmount: 200, adminNote: '',
  });
  const [assets, setAssets] = useState<AssetRow[]>([]);

  const canNext = useMemo(() => {
    if (step === 1) return !!form.clientName && !!form.clientEmail && form.horizon > 0 && form.initialAmount > 0;
    if (step === 2) return assets.length > 0;
    return true;
  }, [step, form, assets]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: ManualPortfolioInput = {
        ...form,
        assets: assets.map(({ _key: _, ...rest }) => rest),
      };

      const generatedAt = new Date().toLocaleDateString('ca-ES', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      // Generate PDF client-side with @react-pdf/renderer
      const blob = await pdf(
        <ManualReportPDF data={payload} generatedAt={generatedAt} />
      ).toBlob();

      // Download PDF
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.download = `Factor_OTC_Manual_${payload.clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      // Save to registry in background (fire-and-forget)
      fetch('/api/admin/manual-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});

    } catch (err) {
      console.error('Error generant PDF:', err);
      setError('Error generant el PDF. Torna-ho a intentar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] mb-1 font-sans">Admin — Exclusiu</p>
        <h2 className="text-white font-black text-3xl tracking-tight">Informe Manual</h2>
        <p className="text-white/35 text-sm mt-1 font-sans">Crea una cartera personalitzada i genera un informe professional.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <button
              onClick={() => s.n < step && setStep(s.n)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all font-sans ${
                step === s.n
                  ? 'bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30'
                  : s.n < step
                    ? 'text-white/50 hover:text-white/80 cursor-pointer'
                    : 'text-white/20 cursor-default'
              }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                step === s.n ? 'bg-[#c9a84c] text-[#0a0f0d]' : s.n < step ? 'bg-white/20 text-white' : 'bg-white/5 text-white/20'
              }`}>{s.n}</span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white/[0.02] border border-[#1a3a2a]/60 rounded-2xl p-6 mb-6">
        {step === 1 && <StepClientData form={form} setForm={setForm} />}
        {step === 2 && <StepAssets assets={assets} setAssets={setAssets} />}
        {step === 3 && <StepPreview form={form} assets={assets} onGenerate={generate} loading={loading} />}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm font-sans">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1) as Step)}
          disabled={step === 1}
          className="px-5 py-2 text-white/40 hover:text-white transition-colors text-sm disabled:opacity-0 font-sans">
          ← Anterior
        </button>
        {step < 3 && (
          <button
            onClick={() => setStep(s => Math.min(3, s + 1) as Step)}
            disabled={!canNext}
            className="px-6 py-2 bg-[#1a3a2a] border border-[#2d6a4f]/50 text-[#c9a84c] text-sm font-semibold rounded-lg hover:bg-[#1f4432] transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-sans">
            Següent →
          </button>
        )}
      </div>
    </div>
  );
}
