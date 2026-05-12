'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserRole } from '@/lib/roles';

interface ClientUser {
  id:        string;
  username:  string;
  password:  string;
  name:      string;
  email:     string;
  role:      UserRole;
  active:    boolean;
  createdAt: string;
}

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string }> = {
  public:      { label: 'Públic',      color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
  newsletter:  { label: 'Newsletter',  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'  },
  authorized:  { label: 'Autoritzat',  color: '#c9a84c', bg: 'rgba(201,168,76,0.1)'  },
  admin:       { label: 'Admin',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};

const ROLES: UserRole[] = ['public', 'newsletter', 'authorized', 'admin'];

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
  name: string; email: string; username: string; password: string; role: UserRole;
}

const EMPTY_FORM: NewClientForm = { name: '', email: '', username: '', password: '', role: 'authorized' };

export default function ClientsManager() {
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
      setSuccess('Client creat correctament');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Error de connexió');
    } finally {
      setSaving(false);
    }
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
  const authorizedCount = users.filter(u => u.active && (u.role === 'authorized' || u.role === 'admin')).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-white text-xl font-bold mb-1">Gestió de Clients</h2>
          <p className="text-white/40 text-sm">
            {activeCount} usuaris actius · {authorizedCount} amb accés al dashboard
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-semibold text-sm rounded-lg transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nou client
        </button>
      </div>

      {/* Feedback */}
      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">{success}</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* New client form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden">
            <form
              onSubmit={handleCreate}
              className="bg-[#0d1f1a] border border-[#c9a84c]/30 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Nou client</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {([
                  ['name',     'Nom complet',   'text',     'Joan Garcia'],
                  ['email',    'Email',          'email',    'joan@exemple.com'],
                  ['username', 'Usuari (login)', 'text',     'joan.garcia'],
                  ['password', 'Contrasenya',   'password', '·····'],
                ] as const).map(([field, label, type, ph]) => (
                  <div key={field}>
                    <label className="block text-white/40 text-xs mb-1">{label}</label>
                    <input
                      type={type}
                      value={form[field]}
                      onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={ph}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/50"
                    />
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <label className="block text-white/40 text-xs mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/50">
                  {ROLES.map(r => (
                    <option key={r} value={r} style={{ background: '#0d1f1a' }}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#c9a84c] hover:bg-[#b8963f] disabled:opacity-50 text-[#0d1f1a] font-semibold text-sm rounded-lg transition-all">
                  {saving ? 'Creant...' : 'Crear client'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(''); }}
                  className="px-4 py-2 text-white/40 hover:text-white text-sm transition-colors">
                  Cancel·lar
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-white/30">No hi ha cap usuari registrat.</div>
      ) : (
        <div className="bg-[#0d1f1a] border border-white/10 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-white/10 text-white/30 text-xs font-medium uppercase tracking-wide">
            <div className="col-span-3">Client</div>
            <div className="col-span-3">Email / Usuari</div>
            <div className="col-span-2">Rol</div>
            <div className="col-span-2">Creat</div>
            <div className="col-span-2 text-right">Accions</div>
          </div>

          <div className="divide-y divide-white/5">
            {users.map(u => (
              <motion.div
                key={u.id}
                layout
                className={`grid grid-cols-12 gap-3 px-4 py-3 items-center ${!u.active ? 'opacity-40' : ''}`}>
                {/* Name + status */}
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.active ? 'bg-green-400' : 'bg-white/20'}`} />
                    <span className="text-white text-sm font-medium truncate">{u.name}</span>
                  </div>
                </div>

                {/* Email + username */}
                <div className="col-span-3 min-w-0">
                  <div className="text-white/60 text-xs truncate">{u.email}</div>
                  <div className="text-white/30 text-xs font-mono">@{u.username}</div>
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
                      className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[#c9a84c]/50 disabled:opacity-40">
                      {ROLES.filter(r => r !== 'admin').map(r => (
                        <option key={r} value={r} style={{ background: '#0d1f1a' }}>
                          {ROLE_META[r].label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Created at */}
                <div className="col-span-2 text-white/30 text-xs">{u.createdAt}</div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  {u.active && u.role !== 'admin' && (
                    <button
                      onClick={() => handleDeactivate(u.id)}
                      title="Desactivar"
                      className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </button>
                  )}
                  {!u.active && (
                    <span className="text-white/20 text-xs">Inactiu</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Info note */}
      <p className="mt-4 text-white/20 text-xs">
        Els usuaris autoritzats poden accedir al dashboard de cartera i al robo-advisor.
        Els canvis de rol s'apliquen immediatament. Les contrasenyes no es mostren per seguretat.
      </p>
    </div>
  );
}
