'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AdminNotification } from '@/lib/notifications';

const TYPE_ICON: Record<string, string> = {
  new_lead:                '👤',
  questionnaire_completed: '📋',
  client_converted:        '✓',
  monthly_report_due:      '📅',
  stale_prices:            '⚠️',
  api_error:               '🔴',
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [open, setOpen]                   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/notifications?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleMarkAll() {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  async function handleMarkOne(id: string) {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className="relative p-2 text-white/30 hover:text-white transition-colors rounded-lg hover:bg-white/5">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#0d1f1a] border border-white/15 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-white font-semibold text-sm">Notificacions</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} className="text-[#c9a84c]/70 hover:text-[#c9a84c] text-xs transition-colors">
                Marcar totes llegides
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-white/25 text-sm">Sense notificacions</div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => { if (!n.readAt) handleMarkOne(n.id); }}
                className={`px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/3 transition-colors ${
                  !n.readAt ? 'bg-[#c9a84c]/5' : ''
                }`}>
                <div className="flex items-start gap-3">
                  <span className="text-base flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.readAt ? 'text-white' : 'text-white/60'}`}>{n.title}</p>
                    <p className="text-white/35 text-xs mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-white/20 text-xs mt-1">
                      {new Date(n.createdAt).toLocaleString('ca-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  {!n.readAt && (
                    <div className="w-2 h-2 rounded-full bg-[#c9a84c] flex-shrink-0 mt-1.5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
