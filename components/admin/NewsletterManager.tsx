'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Newsletter, NewsletterSections, Subscriber } from '@/lib/newsletter';

type Tab = 'newsletters' | 'subscribers' | 'create' | 'edit';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Esborrany',          color: 'text-white/50 bg-white/10' },
  pending:   { label: 'Pendent revisió',    color: 'text-yellow-400 bg-yellow-400/10' },
  validated: { label: 'Validada',           color: 'text-green-400 bg-green-400/10' },
  sent:      { label: 'Enviada',            color: 'text-blue-400 bg-blue-400/10' },
};

const SECTION_LABELS: { key: keyof NewsletterSections; icon: string; label: string }[] = [
  { key: 'marketNews',        icon: '📰', label: 'Notícies de mercat'     },
  { key: 'macroSummary',      icon: '🌍', label: 'Resum macroeconòmic'    },
  { key: 'buyOpportunities',  icon: '📈', label: 'Oportunitats de compra' },
  { key: 'sellOpportunities', icon: '📉', label: 'Oportunitats de venda'  },
  { key: 'investmentIdeas',   icon: '💡', label: "Idees d'inversió"       },
  { key: 'fundamental',       icon: '🔬', label: 'Anàlisi fonamental'     },
  { key: 'technical',         icon: '📊', label: 'Anàlisi tècnica'        },
  { key: 'mainRisks',         icon: '⚠️', label: 'Riscos principals'      },
  { key: 'disclaimer',        icon: '⚖️', label: 'Disclaimer'             },
];

const EMPTY_SECTIONS: NewsletterSections = {
  marketNews: '', macroSummary: '', buyOpportunities: '', sellOpportunities: '',
  investmentIdeas: '', fundamental: '', technical: '', mainRisks: '',
  disclaimer: 'Les informacions contingudes en aquesta newsletter tenen caràcter exclusivament informatiu i educatiu. No constitueixen assessorament financer personalitzat ni recomanació d\'inversió. Factor OTC no és una entitat financera regulada.',
};

export default function NewsletterManager() {
  const [tab, setTab]                   = useState<Tab>('newsletters');
  const [newsletters, setNewsletters]   = useState<Newsletter[]>([]);
  const [subscribers, setSubscribers]   = useState<Subscriber[]>([]);
  const [editTarget, setEditTarget]     = useState<Newsletter | null>(null);
  const [loading, setLoading]           = useState(false);
  const [feedback, setFeedback]         = useState('');

  // Form state
  const [title, setTitle]       = useState('');
  const [subject, setSubject]   = useState('');
  const [sections, setSections] = useState<NewsletterSections>({ ...EMPTY_SECTIONS });

  const fetchNewsletters = useCallback(async () => {
    const res = await fetch('/api/admin/newsletter/newsletters');
    if (res.ok) setNewsletters((await res.json()).newsletters);
  }, []);

  const fetchSubscribers = useCallback(async () => {
    const res = await fetch('/api/admin/newsletter/subscribers');
    if (res.ok) setSubscribers((await res.json()).subscribers);
  }, []);

  useEffect(() => { fetchNewsletters(); fetchSubscribers(); }, [fetchNewsletters, fetchSubscribers]);

  const notify = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(''), 3500); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/newsletter/newsletters', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, subject, sections }),
    });
    setLoading(false);
    if (res.ok) {
      notify('Newsletter creada com a esborrany.');
      setTitle(''); setSubject(''); setSections({ ...EMPTY_SECTIONS });
      setTab('newsletters');
      fetchNewsletters();
    } else {
      notify((await res.json()).error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setLoading(true);
    const res = await fetch(`/api/admin/newsletter/newsletters/${editTarget.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, subject, sections }),
    });
    setLoading(false);
    if (res.ok) { notify('Desada correctament.'); setTab('newsletters'); fetchNewsletters(); }
    else        { notify((await res.json()).error); }
  };

  const handleStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/newsletter/newsletters/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    });
    if (res.ok) { notify(`Estat canviat a "${STATUS_LABELS[status]?.label}".`); fetchNewsletters(); }
    else        { notify((await res.json()).error); }
  };

  const handleSend = async (id: string) => {
    if (!confirm('Enviar aquesta newsletter a tots els subscriptors actius?')) return;
    setLoading(true);
    const res = await fetch(`/api/admin/newsletter/send/${id}`, { method: 'POST' });
    setLoading(false);
    const data = await res.json();
    if (res.ok) notify(data.message ?? `Enviada a ${data.sentTo} subscriptors.`);
    else        notify(data.error);
    fetchNewsletters();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar aquesta newsletter?')) return;
    const res = await fetch(`/api/admin/newsletter/newsletters/${id}`, { method: 'DELETE' });
    if (res.ok) { notify('Eliminada.'); fetchNewsletters(); }
    else        { notify((await res.json()).error); }
  };

  const openEdit = (nl: Newsletter) => {
    setEditTarget(nl);
    setTitle(nl.title);
    setSubject(nl.subject);
    setSections({ ...nl.sections });
    setTab('edit');
  };

  const activeCount = subscribers.filter(s => s.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Newsletter</h2>
          <p className="text-white/40 text-sm">{activeCount} subscriptors actius</p>
        </div>
        {feedback && (
          <div className="bg-[#c9a84c]/20 border border-[#c9a84c]/40 text-[#c9a84c] text-sm px-4 py-2 rounded-lg">
            {feedback}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-lg w-fit">
        {([['newsletters','📋','Newsletters'],['subscribers','👥','Subscriptors'],['create','✏️','Nova']] as const).map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === id ? 'bg-[#c9a84c] text-[#0d1f1a]' : 'text-white/60 hover:text-white'}`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Newsletters list ── */}
      {tab === 'newsletters' && (
        <div className="space-y-3">
          {newsletters.length === 0 && (
            <p className="text-white/40 text-sm text-center py-8">Cap newsletter creada. Clica "Nova" per començar.</p>
          )}
          {newsletters.map(nl => {
            const s = STATUS_LABELS[nl.status];
            return (
              <div key={nl.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                      {nl.sentTo && <span className="text-white/30 text-xs">· {nl.sentTo} enviats</span>}
                    </div>
                    <h3 className="text-white font-semibold truncate">{nl.title}</h3>
                    <p className="text-white/40 text-xs mt-0.5">{nl.subject} · {nl.createdAt}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                    {nl.status !== 'sent' && (
                      <button onClick={() => openEdit(nl)} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">Editar</button>
                    )}
                    {nl.status === 'draft' && (
                      <button onClick={() => handleStatus(nl.id, 'pending')} className="text-xs px-3 py-1.5 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 rounded-lg transition-colors">Enviar a revisió</button>
                    )}
                    {nl.status === 'pending' && (
                      <>
                        <button onClick={() => handleStatus(nl.id, 'draft')} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">Tornar esborrany</button>
                        <button onClick={() => handleStatus(nl.id, 'validated')} className="text-xs px-3 py-1.5 bg-green-400/20 hover:bg-green-400/30 text-green-400 rounded-lg transition-colors">Validar</button>
                      </>
                    )}
                    {nl.status === 'validated' && (
                      <button onClick={() => handleSend(nl.id)} disabled={loading} className="text-xs px-3 py-1.5 bg-[#c9a84c]/30 hover:bg-[#c9a84c]/50 text-[#c9a84c] rounded-lg transition-colors font-semibold">Enviar ara</button>
                    )}
                    {nl.status !== 'sent' && (
                      <button onClick={() => handleDelete(nl.id)} className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors">Eliminar</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Subscribers ── */}
      {tab === 'subscribers' && (
        <div>
          <p className="text-white/40 text-sm mb-4">{activeCount} actius · {subscribers.filter(s => !s.active).length} desactivats</p>
          <div className="space-y-2">
            {subscribers.length === 0 && <p className="text-white/40 text-sm text-center py-8">Cap subscriptor encara.</p>}
            {subscribers.map(sub => (
              <div key={sub.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{sub.name}</p>
                  <p className="text-white/40 text-xs">{sub.email} · {sub.subscribedAt}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${sub.active ? 'text-green-400 bg-green-400/10' : 'text-white/30 bg-white/10'}`}>
                  {sub.active ? 'Actiu' : 'Inactiu'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create / Edit form ── */}
      {(tab === 'create' || tab === 'edit') && (
        <form onSubmit={tab === 'create' ? handleCreate : (e) => { e.preventDefault(); handleSaveEdit(); }} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-widest mb-1">Títol intern *</label>
              <input required value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a84c]/50" />
            </div>
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-widest mb-1">Assumpte email *</label>
              <input required value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a84c]/50" />
            </div>
          </div>

          <div className="space-y-4">
            {SECTION_LABELS.map(({ key, icon, label }) => (
              <div key={key}>
                <label className="block text-white/60 text-xs uppercase tracking-widest mb-1">{icon} {label}</label>
                <textarea
                  rows={key === 'disclaimer' ? 3 : 4}
                  value={sections[key]}
                  onChange={e => setSections(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={`Contingut de ${label.toLowerCase()}...`}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/50 resize-y"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setTab('newsletters')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors">
              Cancel·lar
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-2 bg-[#c9a84c] hover:bg-[#b8973b] disabled:opacity-50 text-[#0d1f1a] font-bold text-sm rounded-lg transition-colors">
              {loading ? 'Desant...' : tab === 'create' ? 'Crear esborrany' : 'Desar canvis'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
