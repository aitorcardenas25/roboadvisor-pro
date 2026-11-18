'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Props {
  onClose:   () => void;
  onSuccess?: () => void;
}

const PROFILE_OPTIONS = [
  { value: 'beginner',    label: 'Vull começar a invertir' },
  { value: 'investor',    label: 'Ja inverteixo' },
  { value: 'business',    label: 'Empresa / autònom' },
  { value: 'information', label: 'Només vull informació' },
];

export default function LeadForm({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: '', lastName: '', email: '', phone: '', profile: '', message: '',
  });
  const [gdpr, setGdpr]       = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setError('');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, interest: form.profile, gdprConsent: gdpr, source: 'landing-gate' }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return; }
      setDone(true);
      onSuccess?.();
    } catch { setError('Error de connexió. Torna-ho a intentar.'); }
    finally { setSending(false); }
  }

  const inputCls = 'w-full bg-canvas border border-line rounded-lg px-3 py-2.5 text-ink text-sm focus:outline-none focus:border-accent/40 placeholder-ink-muted transition-colors';
  const labelCls = 'block text-ink-muted text-xs mb-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="bg-surface border border-line-strong rounded-lg p-8 w-full max-w-md shadow-lg my-auto">
        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-accent-soft rounded-full flex items-center justify-center mx-auto mb-4 border border-accent/20">
              <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-ink font-bold text-lg mb-2">Sol·licitud enviada</h3>
            <p className="text-ink-soft text-sm mb-6 leading-relaxed">
              Ens posarem en contacte amb tu en breu per explicar-te com funciona el servei.
            </p>
            <button onClick={onClose}
              className="px-6 py-2.5 bg-subtle-strong border border-accent/50 text-accent font-semibold text-sm rounded-xl hover:bg-subtle-strong transition-colors">
              Explorar la plataforma
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-ink font-bold text-lg">Sol·licita accés</h3>
                <p className="text-ink-muted text-xs mt-0.5">Et contactarem per presentar-te el servei</p>
              </div>
              <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="bg-negative/10 border border-negative/20 rounded-lg px-3 py-2 mb-4 text-negative text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nom *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)}
                    required placeholder="Joan" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Cognoms *</label>
                  <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                    required placeholder="García López" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  required placeholder="joan@exemple.com" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Telèfon (opcional)</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+34 6XX XXX XXX" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Perfil aproximat *</label>
                <select value={form.profile} onChange={e => set('profile', e.target.value)}
                  required className={inputCls + ' cursor-pointer'}>
                  <option value="" style={{ background: '#ffffff' }}>Selecciona el teu perfil...</option>
                  {PROFILE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} style={{ background: '#ffffff' }}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Missatge (opcional)</label>
                <textarea value={form.message} onChange={e => set('message', e.target.value)}
                  rows={2} placeholder="Explica'ns la teva situació o dubtes..."
                  className={inputCls + ' resize-none'} />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" required checked={gdpr} onChange={e => setGdpr(e.target.checked)}
                  className="mt-0.5 accent-accent flex-shrink-0 w-4 h-4" />
                <span className="text-ink-muted text-xs leading-relaxed">
                  Accepto que Factor OTC contacti amb mi per presentar el servei.{' '}
                  <Link href="/privacitat" target="_blank" className="text-accent/60 hover:text-accent underline">
                    Privacitat
                  </Link>
                </span>
              </label>

              <button type="submit" disabled={sending || !gdpr}
                className="w-full py-3 bg-accent hover:bg-accent-hover text-accent-ink font-bold text-sm rounded-xl disabled:opacity-50 transition-colors">
                {sending ? 'Enviant...' : 'Enviar sol·licitud'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
