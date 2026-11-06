// Regressió: amb Supabase i la taula `users` buida, el primer login com a
// "admin" desava la contrasenya escrita, fos quina fos, i creava un admin.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type Row = Record<string, unknown>;

function fakeDb(rows: Row[]) {
  const inserts: Row[] = [];
  const db = {
    from: () => {
      const filters: [string, unknown][] = [];
      const q = {
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) return Promise.resolve({ count: rows.length, error: null });
          return q;
        },
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        maybeSingle: () => Promise.resolve({
          data: rows.find(r => filters.every(([k, v]) => r[k] === v)) ?? null,
          error: null,
        }),
        insert: (row: Row) => { inserts.push(row); rows.push(row); return Promise.resolve({ error: null }); },
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
      return q;
    },
  };
  return { db, inserts };
}

const ORIGINAL_ENV = { ...process.env };

async function loadWithDb(db: unknown) {
  vi.resetModules();
  vi.doMock('@/lib/supabase', () => ({ getDb: () => db }));
  return import('@/lib/users');
}

describe('seeding de l\'admin a Supabase amb la taula buida', () => {
  beforeEach(() => {
    process.env.ADMIN_USERNAME = 'admin';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.doUnmock('@/lib/supabase');
    vi.restoreAllMocks();
  });

  it('no crea cap admin amb una contrasenya incorrecta', async () => {
    process.env.ADMIN_PASSWORD = 'una-contrasenya-llarga-i-segura';
    const { db, inserts } = fakeDb([]);
    const { findUserByCredentials } = await loadWithDb(db);
    expect(await findUserByCredentials('admin', 'qualsevol-cosa')).toBeNull();
    expect(inserts).toHaveLength(0);
  });

  it('no crea cap admin si ADMIN_PASSWORD no està configurada', async () => {
    delete process.env.ADMIN_PASSWORD;
    const { db, inserts } = fakeDb([]);
    const { findUserByCredentials } = await loadWithDb(db);
    expect(await findUserByCredentials('admin', 'factorOTC2024!')).toBeNull();
    expect(inserts).toHaveLength(0);
  });

  it('crea l\'admin només amb la contrasenya configurada', async () => {
    process.env.ADMIN_PASSWORD = 'una-contrasenya-llarga-i-segura';
    const { db, inserts } = fakeDb([]);
    const { findUserByCredentials } = await loadWithDb(db);
    const user = await findUserByCredentials('admin', 'una-contrasenya-llarga-i-segura');
    expect(inserts).toHaveLength(1);
    expect(user?.role).toBe('admin');
  });
});
