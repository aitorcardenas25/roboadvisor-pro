'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Lead } from '@/lib/leads';

const STATUS_META: Record<Lead['status'], { label: string; color: string; bg: string }> = {
  new:                { label: 'Nou',                 color: '#60a5fa', bg: 'rgba(96,165,250,0.15)'  },
  contacted:          { label: 'Contactat',           color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  'preparing-report': { label: 'Preparant informe',   color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  'report-sent':      { label: 'Informe enviat',      color: '#34d399', bg: 'rgba(52,211,153,0.15)'  },
  converted:          { label: 'Convertit a client',  color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  discarded:          { label: 'Descartat',           color: '#6b7280', bg: 'rgba(107,114,128,0.1)'  },
};

interface ConvertForm {
  username: string;
  password: string;
  name: string;
  portfolioName: string;
}

export default function LeadsManager() {
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Lead['status'] | 'all'>('all');
  const [updating, setUpdating]   = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);

  // Conversió a client
  const [convertLead, setConvertLead]   = useState<Lead | null>(null);
  const [convertForm, setConvertForm]   = useState<ConvertForm>({ username: '', password: '', name: '', portfolioName: '' });
  const [converting, setConverting]     = useState(false);
  const [convertError, setConvertError] = useState('');
  const [convertOk, setConvertOk]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/leads');
      const { leads: data } = await res.json();
      setLeads(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: Lead['status']) {
    setUpdating(id);
    await fetch('/api/admin/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    setUpdating(null);
  }

  async function saveNotes(id: string) {
    const notes = editNotes[id] ?? '';
    setSavingNotes(id);
    await fetch('/api/admin/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes }),
    });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l));
    setSavingNotes(null);
  }

  function openConvert(lead: Lead) {
    const emailPrefix = lead.email.split('@')[0].replace(/[^a-z0-9._-]/gi, '').toLowerCase();
    setConvertForm({
      username:      emailPrefix,
      password:      '',
      name:          lead.name,
      portfolioName: `Cartera de ${lead.name}`,
    });
    setConvertError('');
    setConvertOk('');
    setConvertLead(lead);
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!convertLead) return;
    setConverting(true); setConvertError('');
    try {
      const res = await fetch(`/api/admin/leads/${convertLead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(convertForm),
      });
      const data = await res.json();
      if (!res.ok) { setConvertError(data.error ?? 'Error en la conversió'); return; }
      setConvertOk(`Client creat correctament. Usuari: ${convertForm.username}`);
      setLeads(prev => prev.map(l => l.id === convertLead.id ? { ...l, status: 'converted' } : l));
      setTimeout(() => { setConvertLead(null); setConvertOk(''); }, 2500);
    } catch {
      setConvertError('Error de connexió');
    } finally {
      setConverting(false);
    }
  }

  const visible = filter === 'all' ? leads : leads.filter(l => l.status === filter);
  const counts  = (Object.keys(STATUS_META) as Lead['status'][]).reduce(
    (acc, s) => ({ ...acc, [s]: leads.filter(l => l.status === s).length }), {} as Record<Lead['status'], number>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-xl">Leads captats</h2>
          <p className="text-white/40 text-sm mt-1">{leads.length} lead{leads.length !== 1 ? 's' : ''} totals</p>
        </div>
        <button onClick={load} className="text-white/40 hover:text-white transition-colors text-sm">↻ Actualitzar</button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            filter === 'all' ? 'bg-[#c9a84c] text-[#0d1f1a]' : 'bg-white/5 text-white/50 hover:bg-white/10'
          }`}>
          Tots ({leads.length})
        </button>
        {(Object.keys(STATUS_META) as Lead['status'][]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === s ? 'bg-[#c9a84c] text-[#0d1f1a]' : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}>
            {STATUS_META[s].label} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <div className="text-4xl mb-3">📬</div>
          <p>Encara no hi ha leads{filter !== 'all' ? ` amb estat "${STATUS_META[filter as Lead['status']].label}"` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(lead => {
            const meta = STATUS_META[lead.status];
            const canConvert = lead.status !== 'converted' && lead.status !== 'discarded';
            return (
              <div key={lead.id} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-white font-semibold text-sm">{lead.name}</span>
                      <span
                        className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ color: meta.color, backgroundColor: meta.bg }}>
                        {meta.label}
                      </span>
                      {lead.questionnaireData && (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/15 text-blue-400">
                          📋 Qüestionari
                        </span>
                      )}
                      {lead.linkedUserId && (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/15 text-green-400">
                          ✓ Vinculat
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/40 text-xs">
                      <a href={`mailto:${lead.email}`} className="hover:text-[#c9a84c] transition-colors">{lead.email}</a>
                      {lead.phone && <span>{lead.phone}</span>}
                      <span>Font: {lead.source}</span>
                      <span>{new Date(lead.createdAt).toLocaleDateString('ca-ES')}</span>
                    </div>
                    {lead.interest && (
                      <p className="mt-2 text-white/60 text-sm">
                        <span className="text-white/30 text-xs uppercase tracking-wide mr-1">Interès:</span>
                        {lead.interest}
                      </p>
                    )}
                    {lead.message && (
                      <p className="mt-1 text-white/40 text-xs italic leading-relaxed">{lead.message}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <select
                      value={lead.status}
                      onChange={e => setStatus(lead.id, e.target.value as Lead['status'])}
                      disabled={updating === lead.id}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/70 text-xs focus:outline-none focus:border-[#c9a84c]/40 disabled:opacity-50 cursor-pointer">
                      {(Object.keys(STATUS_META) as Lead['status'][]).map(s => (
                        <option key={s} value={s}>{STATUS_META[s].label}</option>
                      ))}
                    </select>
                    {canConvert && (
                      <button
                        onClick={() => openConvert(lead)}
                        className="px-2.5 py-1.5 bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c] text-xs font-medium rounded-lg hover:bg-[#c9a84c]/20 transition-all whitespace-nowrap">
                        + Convertir a client
                      </button>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <label className="block text-white/30 text-[10px] uppercase tracking-widest mb-1.5">Notes internes</label>
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      placeholder="Afegeix notes sobre aquest lead..."
                      value={editNotes[lead.id] ?? lead.notes ?? ''}
                      onChange={e => setEditNotes(p => ({ ...p, [lead.id]: e.target.value }))}
                      className="flex-1 bg-black/20 border border-white/8 rounded-lg px-3 py-2 text-white/60 text-xs resize-none focus:outline-none focus:border-[#c9a84c]/30 placeholder-white/15"
                    />
                    {(editNotes[lead.id] !== undefined && editNotes[lead.id] !== (lead.notes ?? '')) && (
                      <button
                        onClick={() => saveNotes(lead.id)}
                        disabled={savingNotes === lead.id}
                        className="px-3 py-1.5 bg-[#1a3a2a] border border-[#2d6a4f]/40 text-[#c9a84c] text-xs font-medium rounded-lg hover:bg-[#1f4432] transition-colors disabled:opacity-50 self-end">
                        {savingNotes === lead.id ? '...' : 'Desar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal conversió a client */}
      {convertLead && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1f1a] border border-[#c9a84c]/30 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-white font-bold text-lg mb-1">Convertir lead a client</h3>
            <p className="text-white/40 text-sm mb-5">
              Crea un compte d'accés per a <span className="text-white">{convertLead.name}</span> ({convertLead.email})
            </p>

            {convertOk ? (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm text-center">
                {convertOk}
              </div>
            ) : (
              <form onSubmit={handleConvert} className="space-y-4">
                {convertError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{convertError}</div>
                )}
                <div>
                  <label className="block text-white/40 text-xs uppercase tracking-wide mb-1">Nom complet</label>
                  <input
                    type="text"
                    value={convertForm.name}
                    onChange={e => setConvertForm(p => ({ ...p, name: e.target.value }))}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/50"
                  />
                </div>
                <div>
                  <label className="block text-white/40 text-xs uppercase tracking-wide mb-1">Nom d'usuari (login)</label>
                  <input
                    type="text"
                    value={convertForm.username}
                    onChange={e => setConvertForm(p => ({ ...p, username: e.target.value }))}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[#c9a84c]/50"
                  />
                </div>
                <div>
                  <label className="block text-white/40 text-xs uppercase tracking-wide mb-1">Contrasenya inicial</label>
                  <input
                    type="password"
                    value={convertForm.password}
                    onChange={e => setConvertForm(p => ({ ...p, password: e.target.value }))}
                    required minLength={6}
                    placeholder="Mínim 6 caràcters"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/50"
                  />
                </div>
                <div>
                  <label className="block text-white/40 text-xs uppercase tracking-wide mb-1">Nom de la cartera</label>
                  <input
                    type="text"
                    value={convertForm.portfolioName}
                    onChange={e => setConvertForm(p => ({ ...p, portfolioName: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/50"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={converting}
                    className="flex-1 py-2.5 bg-[#c9a84c] hover:bg-[#b8963f] disabled:opacity-50 text-[#0d1f1a] font-bold text-sm rounded-lg transition-all">
                    {converting ? 'Creant client...' : 'Crear client'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConvertLead(null)}
                    className="px-4 py-2.5 text-white/40 hover:text-white text-sm transition-colors">
                    Cancel·lar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
