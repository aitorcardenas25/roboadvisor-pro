'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UserRole } from '@/lib/roles';

interface ClientUser {
  id:                 string;
  username:           string;
  name:               string;
  email:              string;
  role:               UserRole;
  active:             boolean;
  createdAt:          string;
  subscriptionPlan?:   'free' | 'active' | 'premium';
  subscriptionStatus?: 'active' | 'inactive' | 'suspended';
}

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string }> = {
  client: { label: 'Client', color: 'rgb(var(--c-accent))', bg: 'rgb(var(--c-accent) / 0.1)' },
  admin:  { label: 'Admin',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};

const ROLES: UserRole[] = ['client', 'admin'];

const PLAN_META: Record<string, { label: string; color: string }> = {
  free:    { label: 'Gratuït',    color: '#9ca3af' },
  active:  { label: 'Bàsic',  color: 'rgb(var(--c-accent))' },
  premium: { label: 'Premium',color: '#a78bfa' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  active:    { label: 'Actiu',     color: '#10b981' },
  inactive:  { label: 'Inactiu',  color: '#9ca3af' },
  suspended: { label: 'Suspès',   color: '#ef4444' },
};

function Badge({ role, active }: { role: UserRole; active: boolean }) {
  const meta = ROLE_META[role];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${!active ? 'opacity-40' : ''}`}
      style={{ color: meta.color, backgroundColor: meta.bg }}>
      {!active && <span>✕</span>}
      {meta.label}
    </span>
  );
}

interface NewClientForm {
  name: string; email: string; username: string; password: string; role: UserRole; sendWelcome: boolean;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `Alta: ${d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

const EMPTY_FORM: NewClientForm = { name: '', email: '', username: '', password: '', role: 'client', sendWelcome: true };

export default function ClientsManager({ onViewClient }: { onViewClient?: (id: string) => void }) {
  const [users, setUsers]       = useState<ClientUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<NewClientForm>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/clients');
      const { users: data } = await res.json();
      setUsers(data ?? []);
    } catch {
      setError('No s\'han pogut carregar els clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Error creant client');
        return;
      }
      const d = await res.json().catch(() => ({}));
      setSuccess(d.welcome
        ? (d.welcome.sent ? 'Client creat i correu de benvinguda enviat. Passa-li la contrasenya per WhatsApp.' : `Client creat, però el correu no s'ha enviat (${d.welcome.error ?? 'error'}).`)
        : 'Client creat correctament');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
      setTimeout(() => setSuccess(''), 6000);
    } catch {
      setError('Error de connexió');
    } finally {
      setSaving(false);
    }
  }

  async function handleWelcome(u: ClientUser) {
    if (!confirm(`Enviar el correu de benvinguda a ${u.email}? Porta l'usuari i l'enllaç, no la contrasenya.`)) return;
    setError(''); setSuccess('');
    const res = await fetch(`/api/admin/clients/${u.id}/welcome`, { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setSuccess(`Correu de benvinguda enviat a ${u.email}.`); setTimeout(() => setSuccess(''), 6000); }
    else setError(d.error ?? 'No s\'ha pogut enviar el correu');
  }

  async function handleRoleChange(id: string, role: UserRole) {
    try {
      await fetch('/api/admin/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
    } catch { /* silent */ }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Desactivar aquest usuari?')) return;
    try {
      await fetch('/api/admin/clients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, active: false } : u));
    } catch { /* silent */ }
  }

  async function handleSubscriptionChange(id: string, plan: string, status: string) {
    try {
      await fetch(`/api/admin/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionPlan: plan, subscriptionStatus: status }),
      });
      setUsers(prev => prev.map(u => u.id === id
        ? { ...u, subscriptionPlan: plan as ClientUser['subscriptionPlan'], subscriptionStatus: status as ClientUser['subscriptionStatus'] }
        : u));
    } catch { /* silent */ }
  }

  const activeCount = users.filter(u => u.active).length;
  const clientCount = users.filter(u => u.active && u.role === 'client').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-ink text-xl font-bold mb-1">Gestió de Clients</h2>
          <p className="text-ink-muted text-sm">
            {activeCount} usuaris actius · {clientCount} clients amb accés
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-ink font-semibold text-sm rounded-lg transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nou client
        </button>
      </div>

      {/* Feedback */}
      {success && (
        <div className="mb-4 p-3 bg-positive/10 border border-positive/30 rounded-lg text-positive text-sm">{success}</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-negative/10 border border-negative/30 rounded-lg text-negative text-sm">{error}</div>
      )}

      {/* New client form */}
      <>
        {showForm && (
          <div
            className="mb-6 overflow-hidden">
            <form
              onSubmit={handleCreate}
              autoComplete="off"
              className="bg-surface border border-accent/30 rounded-lg p-5">
              <h3 className="text-ink font-semibold text-sm mb-4">Nou client</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {([
                  ['name',     'Nom complet',   'text',     'Joan Garcia'],
                  ['email',    'Email',          'email',    'joan@exemple.com'],
                  ['username', 'Usuari (login)', 'text',     'joan.garcia'],
                  ['password', 'Contrasenya (mín. 10)', 'password', '·····'],
                ] as const).map(([field, label, type, ph]) => (
                  <div key={field}>
                    <label className="block text-ink-muted text-xs mb-1">{label}</label>
                    <input
                      type={type}
                      value={form[field]}
                      onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={ph}
                      required
                      // Evita que el navegador hi posi l'usuari i la contrasenya de l'admin
                      autoComplete={field === 'password' ? 'new-password' : 'off'}
                      name={`new-client-${field}`}
                      className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-accent/50"
                    />
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <label className="block text-ink-muted text-xs mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/50">
                  {ROLES.map(r => (
                    <option key={r} value={r} style={{ background: 'rgb(var(--c-surface))' }}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 mb-4 text-ink-soft text-sm">
                <input type="checkbox" checked={form.sendWelcome}
                  onChange={e => setForm(prev => ({ ...prev, sendWelcome: e.target.checked }))} />
                Enviar correu de benvinguda (usuari i enllaç, sense contrasenya)
              </label>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-ink font-semibold text-sm rounded-lg transition-all">
                  {saving ? 'Creant...' : 'Crear client'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(''); }}
                  className="px-4 py-2 text-ink-muted hover:text-ink text-sm transition-colors">
                  Cancel·lar
                </button>
              </div>
            </form>
          </div>
        )}
      </>

      {/* Users table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">No hi ha cap usuari registrat.</div>
      ) : (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-line text-ink-muted text-xs font-medium font-medium">
            <div className="col-span-3">Client</div>
            <div className="col-span-2">Email / Usuari</div>
            <div className="col-span-2">Rol</div>
            <div className="col-span-2">Pla</div>
            <div className="col-span-2">Estat sub.</div>
            <div className="col-span-1 text-right">—</div>
          </div>

          <div className="divide-y divide-line">
            {users.map(u => (
              <div
                key={u.id}

                className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${!u.active ? 'opacity-40' : ''}`}>
                {/* Name + status */}
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.active ? 'bg-positive' : 'bg-subtle-strong'}`} />
                    <div>
                      <div className="text-ink text-sm font-medium truncate">{u.name}</div>
                      <div className="text-ink-muted text-xs">{fmtDate(u.createdAt)}</div>
                    </div>
                  </div>
                </div>

                {/* Email + username */}
                <div className="col-span-2 min-w-0">
                  <div className="text-ink-soft text-xs truncate">{u.email}</div>
                  <div className="text-ink-muted text-xs font-mono">@{u.username}</div>
                </div>

                {/* Role selector */}
                <div className="col-span-2">
                  {u.role === 'admin' ? (
                    <Badge role={u.role} active={u.active} />
                  ) : (
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                      disabled={!u.active}
                      className="bg-subtle border border-line rounded-md px-2 py-1 text-xs text-ink focus:outline-none focus:border-accent/50 disabled:opacity-40">
                      {ROLES.filter(r => r !== 'admin').map(r => (
                        <option key={r} value={r} style={{ background: 'rgb(var(--c-surface))' }}>
                          {ROLE_META[r].label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Subscription plan */}
                <div className="col-span-2">
                  {u.role !== 'admin' ? (
                    <select
                      value={u.subscriptionPlan ?? 'free'}
                      disabled={!u.active}
                      onChange={e => handleSubscriptionChange(u.id, e.target.value, u.subscriptionStatus ?? 'active')}
                      className="bg-subtle border border-line rounded-md px-2 py-1 text-xs text-ink focus:outline-none focus:border-accent/50 disabled:opacity-40">
                      {Object.entries(PLAN_META).map(([v, m]) => (
                        <option key={v} value={v} style={{ background: 'rgb(var(--c-surface))' }}>{m.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: PLAN_META.premium.color, background: 'rgba(167,139,250,0.1)' }}>
                      Premium
                    </span>
                  )}
                </div>

                {/* Subscription status */}
                <div className="col-span-2">
                  {u.role !== 'admin' ? (
                    <select
                      value={u.subscriptionStatus ?? 'active'}
                      disabled={!u.active}
                      onChange={e => handleSubscriptionChange(u.id, u.subscriptionPlan ?? 'free', e.target.value)}
                      className="bg-subtle border border-line rounded-md px-2 py-1 text-xs text-ink focus:outline-none focus:border-accent/50 disabled:opacity-40">
                      {Object.entries(STATUS_META).map(([v, m]) => (
                        <option key={v} value={v} style={{ background: 'rgb(var(--c-surface))' }}>{m.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs" style={{ color: STATUS_META.active.color }}>Actiu</span>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end gap-1">
                  {onViewClient && (
                    <button
                      onClick={() => onViewClient(u.id)}
                      title="Veure fitxa"
                      className="p-1.5 text-ink-muted hover:text-accent hover:bg-accent-soft rounded-md transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </button>
                  )}
                  {u.active && u.role === 'client' && (
                    <button
                      onClick={() => handleWelcome(u)}
                      title="Enviar correu de benvinguda"
                      aria-label={`Enviar correu de benvinguda a ${u.name}`}
                      className="p-1.5 text-ink-muted hover:text-info hover:bg-info/10 rounded-md transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </button>
                  )}
                  {u.active && u.role !== 'admin' && (
                    <button
                      onClick={() => handleDeactivate(u.id)}
                      title="Desactivar"
                      className="p-1.5 text-ink-muted hover:text-negative hover:bg-negative/10 rounded-md transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </button>
                  )}
                  {!u.active && (
                    <span className="text-ink-muted text-xs">Off</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info note */}
      <p className="mt-4 text-ink-muted text-xs">
        Els usuaris autoritzats poden accedir al dashboard de cartera i al robo-advisor.
        Els canvis de rol s&apos;apliquen immediatament. Les contrasenyes no es mostren per seguretat.
      </p>
    </div>
  );
}
