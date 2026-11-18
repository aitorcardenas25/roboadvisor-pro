'use client';

import { useState, useEffect, useCallback } from 'react';
import type { NewsArticle, NewsCategory, NewsStatus } from '@/lib/news';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/news';

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as NewsCategory[];

const STATUS_LABELS: Record<NewsStatus, { label: string; color: string }> = {
  draft:     { label: 'Esborrany',  color: 'text-ink-soft bg-subtle-strong' },
  published: { label: 'Publicada',  color: 'text-positive bg-positive/10' },
  archived:  { label: 'Arxivada',   color: 'text-ink-muted bg-subtle' },
};

type FormData = {
  title: string; summary: string; content: string;
  category: NewsCategory; source: string; author: string;
  status: NewsStatus; featured: boolean; externalUrl: string;
};

const EMPTY_FORM: FormData = {
  title: '', summary: '', content: '', category: 'mercats',
  source: 'Factor OTC', author: 'Equip Factor OTC',
  status: 'draft', featured: false, externalUrl: '',
};

export default function NewsManager() {
  const [news, setNews]         = useState<NewsArticle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<NewsArticle | null>(null);
  const [form, setForm]         = useState<FormData>({ ...EMPTY_FORM });
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState('');
  const [filter, setFilter]     = useState<NewsStatus | 'all'>('all');

  const fetchNews = useCallback(async () => {
    const res = await fetch('/api/admin/news');
    if (res.ok) setNews((await res.json()).news);
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const notify = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(''), 3000); };

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setShowForm(true); };
  const openEdit   = (a: NewsArticle) => {
    setEditing(a);
    setForm({ title: a.title, summary: a.summary, content: a.content, category: a.category,
      source: a.source, author: a.author, status: a.status, featured: a.featured, externalUrl: a.externalUrl });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url    = editing ? `/api/admin/news/${editing.id}` : '/api/admin/news';
    const method = editing ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) {
      notify(editing ? 'Notícia actualitzada.' : 'Notícia creada.');
      setShowForm(false);
      fetchNews();
    } else {
      notify((await res.json()).error ?? 'Error.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar aquesta notícia?')) return;
    const res = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });
    if (res.ok) { notify('Eliminada.'); fetchNews(); }
  };

  const handlePublish = async (id: string, status: NewsStatus) => {
    const res = await fetch(`/api/admin/news/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { notify(`Estat: ${STATUS_LABELS[status].label}`); fetchNews(); }
  };

  const filtered = filter === 'all' ? news : news.filter(n => n.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-ink font-bold text-xl">Notícies</h2>
          <p className="text-ink-muted text-sm">{news.filter(n => n.status === 'published').length} publicades · {news.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          {feedback && <span className="text-accent text-sm">{feedback}</span>}
          <button onClick={openCreate} className="bg-accent hover:bg-accent-hover text-accent-ink font-bold text-sm px-4 py-2 rounded-lg transition-colors">
            + Nova notícia
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-subtle p-1 rounded-lg w-fit">
        {(['all', 'published', 'draft', 'archived'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:text-ink'}`}>
            {f === 'all' ? 'Totes' : STATUS_LABELS[f].label}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-subtle border border-line rounded-lg p-6 space-y-4">
          <h3 className="text-ink font-semibold">{editing ? 'Editar notícia' : 'Nova notícia'}</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-ink-soft text-xs font-medium mb-1">Títol *</label>
              <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-ink-soft text-xs font-medium mb-1">Resum *</label>
              <textarea required rows={2} value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
                className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50 resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-ink-soft text-xs font-medium mb-1">Contingut complet</label>
              <textarea rows={4} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50 resize-y" />
            </div>
            <div>
              <label className="block text-ink-soft text-xs font-medium mb-1">Categoria *</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as NewsCategory }))}
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50">
                {ALL_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-ink-soft text-xs font-medium mb-1">Estat</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as NewsStatus }))}
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50">
                <option value="draft">Esborrany</option>
                <option value="published">Publicada</option>
                <option value="archived">Arxivada</option>
              </select>
            </div>
            <div>
              <label className="block text-ink-soft text-xs font-medium mb-1">Autor</label>
              <input value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))}
                className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50" />
            </div>
            <div>
              <label className="block text-ink-soft text-xs font-medium mb-1">Font</label>
              <input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-ink-soft text-xs font-medium mb-1">URL externa (opcional)</label>
              <input type="url" value={form.externalUrl} onChange={e => setForm(p => ({ ...p, externalUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="featured" checked={form.featured} onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))}
                className="w-4 h-4 accent-accent" />
              <label htmlFor="featured" className="text-ink-soft text-sm">Notícia destacada</label>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-subtle-strong hover:bg-subtle-strong text-ink text-sm rounded-lg transition-colors">
              Cancel·lar
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-ink font-bold text-sm rounded-lg transition-colors">
              {loading ? 'Desant...' : editing ? 'Desar canvis' : 'Crear notícia'}
            </button>
          </div>
        </form>
      )}

      {/* News list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-ink-muted text-sm text-center py-8">Cap notícia. Clica "+ Nova notícia" per afegir-ne.</p>
        )}
        {filtered.map(article => {
          const s   = STATUS_LABELS[article.status];
          const col = CATEGORY_COLORS[article.category];
          return (
            <div key={article.id} className="bg-subtle border border-line rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${col}20`, color: col }}>
                    {CATEGORY_LABELS[article.category]}
                  </span>
                  {article.featured && <span className="text-xs text-accent/70">⭐</span>}
                </div>
                <p className="text-ink font-medium text-sm truncate">{article.title}</p>
                <p className="text-ink-muted text-xs mt-0.5">{article.publishedAt} · {article.author}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                <button onClick={() => openEdit(article)} className="text-xs px-3 py-1.5 bg-subtle-strong hover:bg-subtle-strong text-ink rounded-lg transition-colors">Editar</button>
                {article.status === 'draft' && (
                  <button onClick={() => handlePublish(article.id, 'published')} className="text-xs px-3 py-1.5 bg-positive/20 hover:bg-positive/30 text-positive rounded-lg transition-colors">Publicar</button>
                )}
                {article.status === 'published' && (
                  <button onClick={() => handlePublish(article.id, 'archived')} className="text-xs px-3 py-1.5 bg-subtle-strong hover:bg-subtle-strong text-ink-soft rounded-lg transition-colors">Arxivar</button>
                )}
                <button onClick={() => handleDelete(article.id)} className="text-xs px-3 py-1.5 bg-negative/20 hover:bg-negative/30 text-negative rounded-lg transition-colors">Eliminar</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
