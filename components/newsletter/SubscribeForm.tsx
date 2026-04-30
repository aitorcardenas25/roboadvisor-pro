'use client';

import { useState } from 'react';

interface Props {
  compact?: boolean;
}

export default function SubscribeForm({ compact = false }: Props) {
  const [email, setEmail]   = useState('');
  const [name, setName]     = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msg, setMsg]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res  = await fetch('/api/newsletter/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (res.ok) { setStatus('ok');    setMsg(data.message); }
      else        { setStatus('error'); setMsg(data.error);   }
    } catch {
      setStatus('error');
      setMsg('Error de connexió. Torna-ho a intentar.');
    }
  };

  if (status === 'ok') {
    return (
      <div className={`${compact ? 'p-4' : 'p-6'} bg-[#1a3a2a]/60 border border-[#c9a84c]/30 rounded-xl text-center`}>
        <span className="text-2xl">✅</span>
        <p className="text-[#c9a84c] font-semibold mt-2">{msg}</p>
        <p className="text-white/50 text-sm mt-1">T'informarem quan publiquem nova anàlisi.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${compact ? 'space-y-3' : 'space-y-4'}`}>
      {!compact && (
        <div>
          <label className="block text-white/60 text-xs uppercase tracking-widest mb-1">Nom (opcional)</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="El teu nom"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#c9a84c]/50"
          />
        </div>
      )}
      <div className={compact ? 'flex gap-2' : ''}>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="El teu email"
          className={`${compact ? 'flex-1' : 'w-full'} bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#c9a84c]/50`}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className={`${compact ? '' : 'w-full mt-1'} bg-[#c9a84c] hover:bg-[#b8973b] disabled:opacity-50 text-[#0d1f1a] font-bold px-6 py-3 rounded-lg text-sm transition-colors whitespace-nowrap`}
        >
          {status === 'loading' ? '...' : 'Subscriure\'m'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-red-400 text-xs">{msg}</p>
      )}
    </form>
  );
}
