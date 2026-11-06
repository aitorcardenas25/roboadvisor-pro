// Regressió: abans, sense ADMIN_PASSWORD, l'admin entrava amb una contrasenya
// per defecte escrita al codi (pública a GitHub).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadUsers() {
  vi.resetModules();
  return import('@/lib/users');
}

describe('admin sense base de dades (mode dev)', () => {
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.AUTHORIZED_USERS;
    process.env.ADMIN_USERNAME = 'admin';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('no accepta la contrasenya antiga per defecte si ADMIN_PASSWORD no existeix', async () => {
    delete process.env.ADMIN_PASSWORD;
    const { findUserByCredentials } = await loadUsers();
    expect(await findUserByCredentials('admin', 'factorOTC2024!')).toBeNull();
  });

  it('no accepta les contrasenyes d\'exemple dels fitxers .env', async () => {
    process.env.ADMIN_PASSWORD = 'canvia-aquesta-contrassenya';
    const { findUserByCredentials } = await loadUsers();
    expect(await findUserByCredentials('admin', 'canvia-aquesta-contrassenya')).toBeNull();
  });

  it('no accepta contrasenyes de menys de 12 caràcters', async () => {
    process.env.ADMIN_PASSWORD = 'curta123';
    const { findUserByCredentials } = await loadUsers();
    expect(await findUserByCredentials('admin', 'curta123')).toBeNull();
  });

  it('accepta una ADMIN_PASSWORD vàlida i rebutja una d\'incorrecta', async () => {
    process.env.ADMIN_PASSWORD = 'una-contrasenya-llarga-i-segura';
    const { findUserByCredentials } = await loadUsers();
    const user = await findUserByCredentials('admin', 'una-contrasenya-llarga-i-segura');
    expect(user?.role).toBe('admin');
    expect(await findUserByCredentials('admin', 'una-altra')).toBeNull();
  });
});
