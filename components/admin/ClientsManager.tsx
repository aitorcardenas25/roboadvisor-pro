'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UserRole } from '@/lib/roles';
import { ADVISOR_STAGE_LABEL, type AdvisorStage } from '@/lib/onboarding';

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
  stage?:              AdvisorStage;
}

const STAGE_TONE: Record<AdvisorStage, string> = {
  'sense-dades': 'bg-subtle-strong text-ink-soft',
  'dades':       'bg-info/10 text-info',
  'esborrany':   'bg-warning/10 text-warning',
  'aprovat':     'bg-warning/10 text-warning',
  'enviat':      'bg-accent-soft text-accent',
  'actiu':       'bg-positive/15 text-positive',
};

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string }> = {
  client: { label: 'Client', color: 'rgb(var(--c-accent))', bg: 'rgb(var(--c-accent) / 0.1)' },
  admin:  { label: 'Admin',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};

const ROLES: UserRole[] = ['client', 'admin'];

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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <a
            href="/api/admin/clients/export"
            download
            title="Excel amb totes les dades de cada client (conté dades personals)"
            className="flex items-center gap-2 px-3 py-2 border border-line hover:border-accent/50 text-ink text-sm rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Exportar Excel
          </a>
          <a
            href="/api/admin/clients/export?anon=1"
            download
            title="Sense nom, usuari, correu ni telèfon: per al TFG o per analitzar"
            className="px-3 py-2 border border-line hover:border-accent/50 text-ink-soft text-sm rounded-lg transition-all">
            Excel anonimitzat
          </a>
          <button
            onClick={() => { setShowForm(!showForm); setError(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-ink font-semibold text-sm rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nou client
          </button>
        </div>
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
            <div className="col-span-3">Pas de l&apos;alta</div>
            <div className="col-span-2 text-right">—</div>
          </div>

          <div className="divide-y divide-line">
            {users.map(u => (
              <div
                key={u.id}

                className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${!u.active ? 'opacity-40' : ''}`}>
                {/* Name + status */}
                <div className="col-span-3 min-w-0">
                  <button type="button" disabled={!onViewClient || u.role !== 'client'} onClick={() => onViewClient?.(u.id)}
                    className="group flex items-center gap-2 text-left w-full disabled:cursor-default">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.active ? 'bg-positive' : 'bg-subtle-strong'}`} />
                    <div className="min-w-0">
                      <div className="text-ink text-sm font-medium truncate group-enabled:group-hover:text-accent group-enabled:group-hover:underline">{u.name}</div>
                      <div className="text-ink-muted text-xs">{fmtDate(u.createdAt)}</div>
                    </div>
                  </button>
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

                {/* Pas de l'alta */}
                <div className="col-span-3">
                  {u.role === 'client' && u.stage ? (
                    <button type="button" onClick={() => onViewClient?.(u.id)}
                      className={`text-xs px-2 py-0.5 rounded-full ${STAGE_TONE[u.stage]}`}>
                      {ADVISOR_STAGE_LABEL[u.stage]}
                    </button>
                  ) : <span className="text-ink-muted text-xs">—</span>}
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1">
                  {onViewClient && u.role === 'client' && (
                    <button
                      onClick={() => onViewClient(u.id)}
                      title="Obrir la fitxa del client"
                      className="px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft rounded-md transition-all whitespace-nowrap">
                      Obrir
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
      <p className="mt-1 text-ink-muted text-xs">
        L&apos;Excel exportat conté dades financeres personals: no el comparteixis ni el pengis a carpetes compartides.
        Els correus no es poden fer servir per a una newsletter sense un consentiment separat. Cada exportació queda registrada.
      </p>
    </div>
  );
}
