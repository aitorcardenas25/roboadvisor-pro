// components/admin/FundsManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { AdminFund } from '@/lib/adminFunds';

const EMPTY_FUND: Omit<AdminFund, 'id' | 'createdAt' | 'updatedAt'> = {
  name:           '',
  isin:           '',
  manager:        '',
  category:       '',
  assetClass:     'renda-variable-global',
  region:         '',
  managementType: 'indexada',
  benchmark:      '',
  risk:           3,
  profiles:       ['moderat'],
  ter:            0.20,
  currency:       'EUR',
  expectedReturn: 7.0,
  expectedVol:    12.0,
  dataStatus:     'pending',
  justification:  '',
  active:         true,
};

export default function FundsManager() {
  const [funds, setFunds]         = useState<AdminFund[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingFund, setEditing] = useState<AdminFund | null>(null);
  const [formData, setFormData]   = useState(EMPTY_FUND);
  const [search, setSearch]       = useState('');
  const [filterRisk, setFilterRisk] = useState<number | 'all'>('all');
  const [saving, setSaving]       = useState(false);
  const [message, setMessage]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { loadFunds(); }, []);

  async function loadFunds() {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/funds');
      const data = await res.json();
      setFunds(data.funds ?? []);
    } catch {
      showMessage('error', 'Error carregant els fons');
    }
    setLoading(false);
  }

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function openCreate() {
    setFormData(EMPTY_FUND);
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(fund: AdminFund) {
    setFormData({ ...fund });
    setEditing(fund);
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const method = editingFund ? 'PUT' : 'POST';
      const body   = editingFund
        ? JSON.stringify({ id: editingFund.id, ...formData })
        : JSON.stringify(formData);

      const res = await fetch('/api/admin/funds', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!res.ok) {
        const err = await res.json();
        showMessage('error', err.error ?? 'Error desant el fons');
      } else {
        showMessage('success', editingFund ? 'Fons actualitzat!' : 'Fons creat!');
        setShowForm(false);
        loadFunds();
      }
    } catch {
      showMessage('error', 'Error de connexió');
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminar "${name}"?`)) return;
    const res = await fetch(`/api/admin/funds?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      showMessage('success', 'Fons eliminat');
      loadFunds();
    } else {
      showMessage('error', 'Error eliminant el fons');
    }
  }

  const filtered = funds.filter(f => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase()) ||
                        f.isin.toLowerCase().includes(search.toLowerCase()) ||
                        f.manager.toLowerCase().includes(search.toLowerCase());
    const matchRisk   = filterRisk === 'all' || f.risk === filterRisk;
    return matchSearch && matchRisk;
  });

  const inputCls = "w-full bg-subtle-strong border border-line-strong rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all";
  const labelCls = "block text-ink-soft text-xs font-medium mb-1";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink mb-1">Gestió de Fons</h1>
          <p className="text-ink-muted text-sm">{funds.length} fons a la base de dades</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-ink font-bold px-5 py-2.5 rounded-lg text-sm transition-all">
          <span>+</span> Nou fons
        </button>
      </div>

      {/* Missatge */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-positive/20 border border-positive/30 text-positive'
            : 'bg-negative/20 border border-negative/30 text-negative'
        }`}>
          {message.type === 'success' ? '✅' : ''} {message.text}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Cercar per nom, ISIN o gestora..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-subtle border border-line rounded-lg px-4 py-2.5 text-ink text-sm focus:outline-none focus:border-accent/40 placeholder-ink-muted"
        />
        <select
          value={filterRisk}
          onChange={e => setFilterRisk(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="bg-subtle border border-line rounded-lg px-4 py-2.5 text-ink text-sm focus:outline-none">
          <option value="all">Tots els riscos</option>
          {[1,2,3,4,5].map(r => <option key={r} value={r}>Risc {r}</option>)}
        </select>
      </div>

      {/* Taula */}
      {loading ? (
        <div className="text-center py-12 text-ink-muted">Carregant...</div>
      ) : (
        <div className="bg-subtle border border-line rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted text-xs font-medium">
                <th className="text-left px-4 py-3">Fons</th>
                <th className="text-left px-4 py-3">Gestora</th>
                <th className="text-center px-4 py-3">Risc</th>
                <th className="text-right px-4 py-3">TER</th>
                <th className="text-center px-4 py-3">Estat</th>
                <th className="text-center px-4 py-3">Accions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map(fund => (
                <tr key={fund.id} className="hover:bg-subtle transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-ink font-medium text-xs">{fund.name}</p>
                    <p className="text-ink-muted text-xs">{fund.isin}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft text-xs">{fund.manager}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-ink-soft text-xs">{'⭐'.repeat(fund.risk)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-soft text-xs">{fund.ter.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      fund.dataStatus === 'validated'   ? 'bg-positive/20 text-positive' :
                      fund.dataStatus === 'partial'     ? 'bg-warning/20 text-warning'    :
                      fund.dataStatus === 'pending'     ? 'bg-info/20 text-info'      :
                      'bg-negative/20 text-negative'
                    }`}>
                      {fund.dataStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(fund)}
                        className="text-accent/60 hover:text-accent text-xs px-2 py-1 rounded hover:bg-accent-soft transition-all">
                        Editar
                      </button>
                      <button onClick={() => handleDelete(fund.id, fund.name)}
                        className="text-negative/60 hover:text-negative text-xs px-2 py-1 rounded hover:bg-negative/10 transition-all">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-ink-muted">
                    No s'han trobat fons amb els filtres actuals
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal formulari */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-line-strong rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between p-6 border-b border-line">
              <h2 className="text-ink font-bold text-lg">
                {editingFund ? 'Editar fons' : '+ Nou fons'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-ink-muted hover:text-ink text-xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Nom del fons *</label>
                  <input type="text" value={formData.name} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>ISIN *</label>
                  <input type="text" value={formData.isin} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, isin: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className={labelCls}>Gestora *</label>
                  <input type="text" value={formData.manager} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, manager: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Categoria</label>
                  <input type="text" value={formData.category} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Regió</label>
                  <input type="text" value={formData.region} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, region: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Tipus de gestió</label>
                  <select value={formData.managementType} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, managementType: e.target.value as AdminFund['managementType'] }))}>
                    <option value="indexada">Indexada</option>
                    <option value="passiva">Passiva</option>
                    <option value="activa">Activa</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nivell de risc (1-5)</label>
                  <select value={formData.risk} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, risk: Number(e.target.value) as AdminFund['risk'] }))}>
                    {[1,2,3,4,5].map(r => <option key={r} value={r}>Risc {r} {'⭐'.repeat(r)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>TER (%)</label>
                  <input type="number" step="0.01" min="0" max="5" value={formData.ter} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, ter: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className={labelCls}>Divisa</label>
                  <select value={formData.currency} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))}>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Rendibilitat esperada (%)</label>
                  <input type="number" step="0.1" value={formData.expectedReturn} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, expectedReturn: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className={labelCls}>Volatilitat esperada (%)</label>
                  <input type="number" step="0.1" value={formData.expectedVol} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, expectedVol: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className={labelCls}>Estat de les dades</label>
                  <select value={formData.dataStatus} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, dataStatus: e.target.value as AdminFund['dataStatus'] }))}>
                    <option value="validated">✅ Validat</option>
                    <option value="partial">Parcial</option>
                    <option value="pending">Pendent</option>
                    <option value="unavailable">❌ No disponible</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Benchmark</label>
                  <input type="text" value={formData.benchmark} className={inputCls}
                    onChange={e => setFormData(p => ({ ...p, benchmark: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Justificació professional</label>
                  <textarea rows={3} value={formData.justification} className={`${inputCls} resize-none`}
                    onChange={e => setFormData(p => ({ ...p, justification: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-line">
              <button onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-lg border border-line-strong text-ink-soft hover:text-ink text-sm transition-all">
                Cancel·lar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 rounded-lg bg-accent text-accent-ink font-bold text-sm hover:bg-accent-hover transition-all disabled:opacity-50">
                {saving ? 'Desant...' : editingFund ? 'Actualitzar' : 'Crear fons'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}