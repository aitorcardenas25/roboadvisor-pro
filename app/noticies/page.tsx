'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import SubscribeForm from '@/components/newsletter/SubscribeForm';
import type { NewsArticle, NewsCategory } from '@/lib/news';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/news';

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as NewsCategory[];

export default function NoticiesPage() {
  const [news, setNews]           = useState<NewsArticle[]>([]);
  const [category, setCategory]   = useState<NewsCategory | 'all'>('all');
  const [loading, setLoading]     = useState(true);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    const url = category === 'all' ? '/api/news' : `/api/news?category=${category}`;
    const res = await fetch(url);
    if (res.ok) setNews((await res.json()).news);
    setLoading(false);
  }, [category]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const featured = news.filter(n => n.featured);
  const rest     = news.filter(n => !n.featured);

  return (
    <div className="min-h-screen bg-[#0a0f0d]">

      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-white font-black text-lg tracking-wider">FACTOR</span>
            <span className="text-[#c9a84c] font-light text-lg tracking-widest">OTC</span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/noticies" className="text-[#c9a84c] font-medium">Notícies</Link>
            <Link href="/comparador" className="text-white/50 hover:text-white transition-colors">Comparador</Link>
            <Link href="/admin" className="text-white/30 hover:text-white/60 transition-colors text-xs uppercase tracking-widest">Admin</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] mb-2">Factor OTC</p>
          <h1 className="text-white font-black text-4xl mb-3">Notícies Financeres</h1>
          <p className="text-white/50 text-base">Anàlisi de mercats, macroeconomia i oportunitats d'inversió.</p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-10">
          <button
            onClick={() => setCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              category === 'all'
                ? 'bg-[#c9a84c] text-[#0d1f1a]'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
            }`}
          >
            Totes
          </button>
          {ALL_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                category === cat
                  ? 'text-[#0d1f1a] font-bold'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
              style={category === cat ? { backgroundColor: CATEGORY_COLORS[cat] } : {}}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-xl h-52 animate-pulse" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <p className="text-4xl mb-3">📭</p>
            <p>No hi ha notícies en aquesta categoria.</p>
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured.length > 0 && category === 'all' && (
              <div className="mb-10">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Destacada</p>
                <NewsCard article={featured[0]} large />
              </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(category === 'all' ? [...featured.slice(1), ...rest] : news).map(article => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          </>
        )}

        {/* Newsletter CTA */}
        <div className="mt-16 bg-[#1a3a2a]/40 border border-[#c9a84c]/20 rounded-2xl p-8">
          <div className="max-w-xl mx-auto text-center">
            <p className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] mb-2">Newsletter Factor OTC</p>
            <h2 className="text-white font-bold text-2xl mb-2">Rep l'anàlisi setmanal</h2>
            <p className="text-white/50 text-sm mb-6">
              Notícies de mercat, anàlisi macroeconòmica i oportunitats d'inversió, cada setmana al teu email.
            </p>
            <SubscribeForm compact />
          </div>
        </div>

      </main>
    </div>
  );
}

// ── NewsCard ──────────────────────────────────────────────────────────────────

function NewsCard({ article, large = false }: { article: NewsArticle; large?: boolean }) {
  const color = CATEGORY_COLORS[article.category];

  if (large) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
            {CATEGORY_LABELS[article.category]}
          </span>
          {article.featured && (
            <span className="text-xs text-[#c9a84c]/70 bg-[#c9a84c]/10 px-2.5 py-1 rounded-full">⭐ Destacada</span>
          )}
        </div>
        <h2 className="text-white font-bold text-xl mb-3 leading-snug">{article.title}</h2>
        <p className="text-white/60 text-sm leading-relaxed mb-4">{article.summary}</p>
        <div className="flex items-center justify-between text-xs text-white/30">
          <span>{article.author} · {article.source}</span>
          <span>{new Date(article.publishedAt).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        {article.externalUrl && (
          <a href={article.externalUrl} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[#c9a84c] text-xs hover:underline">
            Llegir font original ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
          {CATEGORY_LABELS[article.category]}
        </span>
      </div>
      <h3 className="text-white font-semibold text-sm leading-snug mb-2 flex-1">{article.title}</h3>
      <p className="text-white/50 text-xs leading-relaxed mb-4 line-clamp-3">{article.summary}</p>
      <div className="flex items-center justify-between text-xs text-white/30 mt-auto">
        <span>{article.source}</span>
        <span>{new Date(article.publishedAt).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}</span>
      </div>
      {article.externalUrl && (
        <a href={article.externalUrl} target="_blank" rel="noopener noreferrer"
          className="mt-2 text-[#c9a84c] text-xs hover:underline">
          Font original ↗
        </a>
      )}
    </div>
  );
}
