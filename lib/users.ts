import bcrypt from 'bcryptjs';
import { getDb } from './supabase';
import { UserRole } from './roles';

export interface AppUser {
  id:                 string;
  username:           string;
  name:               string;
  email:              string;
  role:               UserRole;
  active:             boolean;
  createdAt:          string;
  subscriptionPlan:   'free' | 'active' | 'premium';
  subscriptionStatus: 'active' | 'inactive' | 'suspended';
  subscriptionSince?: string;
  lastLoginAt?:       string;
}

// ── Dev fallback (no Supabase) ─────────────────────────────────────────────
// Plaintext password comparison — only used when SUPABASE_URL is not set.
// Never reaches production because Supabase is required in prod.

interface DevUser {
  id:                 string;
  username:           string;
  password:           string;
  name:               string;
  email:              string;
  role:               UserRole;
  active:             boolean;
  createdAt:          string;
  subscriptionPlan:   AppUser['subscriptionPlan'];
  subscriptionStatus: AppUser['subscriptionStatus'];
  subscriptionSince?: string;
  totpSecret?:        string | null;
}

let devDB: DevUser[] = [];

// Contrasenyes d'exemple dels fitxers .env*.example: mai s'han d'acceptar.
const PLACEHOLDER_PASSWORDS = new Set([
  'canvia-per-una-contrasenya-segura-aqui!',
  'canvia-aquesta-contrassenya',
  'factorOTC2024!',
]);

/**
 * Contrasenya d'admin configurada a l'entorn, o null si no és vàlida.
 * Abans hi havia una contrasenya per defecte escrita al codi (pública a GitHub);
 * ara, sense ADMIN_PASSWORD (mín. 12 caràcters i no d'exemple) no hi ha admin.
 */
function getConfiguredAdminPassword(): string | null {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd || pwd.length < 12 || PLACEHOLDER_PASSWORDS.has(pwd)) {
    console.warn('[users] ADMIN_PASSWORD no configurada o massa feble: usuari admin desactivat.');
    return null;
  }
  return pwd;
}

function buildDevDB(): DevUser[] {
  const users: DevUser[] = [];

  const adminPassword = getConfiguredAdminPassword();
  if (adminPassword) {
    users.push({
      id:                 'dev-admin-1',
      username:           process.env.ADMIN_USERNAME  ?? 'admin',
      password:           adminPassword,
      name:               'Admin Factor OTC',
      email:              process.env.ADMIN_EMAIL     ?? 'admin@factorotc.com',
      role:               'admin',
      active:             true,
      createdAt:          '2024-01-01',
      subscriptionPlan:   'active',
      subscriptionStatus: 'active',
    });
  }

  const extraJSON = process.env.AUTHORIZED_USERS;
  if (extraJSON) {
    try {
      const extra = JSON.parse(extraJSON) as Omit<DevUser, 'id' | 'createdAt'>[];
      extra.forEach((u, i) => {
        users.push({
          ...u,
          id:                 `dev-user-${i + 1}`,
          createdAt:          '2024-01-01',
          subscriptionPlan:   u.subscriptionPlan   ?? 'free',
          subscriptionStatus: u.subscriptionStatus ?? 'active',
        });
      });
    } catch { /* JSON mal format — ignorar */ }
  }

  return users;
}

function getDevDB(): DevUser[] {
  if (devDB.length === 0) devDB = buildDevDB();
  return devDB;
}

function devUserToAppUser(u: DevUser): AppUser {
  return {
    id: u.id, username: u.username, name: u.name, email: u.email,
    role: u.role, active: u.active, createdAt: u.createdAt,
    subscriptionPlan: u.subscriptionPlan, subscriptionStatus: u.subscriptionStatus,
    subscriptionSince: u.subscriptionSince,
  };
}

// ── Supabase row → AppUser ─────────────────────────────────────────────────

function rowToUser(row: Record<string, unknown>): AppUser {
  return {
    id:                 String(row.id),
    username:           String(row.username),
    name:               String(row.name ?? ''),
    email:              String(row.email ?? ''),
    role:               (row.role as UserRole) ?? 'client',
    active:             Boolean(row.active),
    createdAt:          String(row.created_at ?? ''),
    subscriptionPlan:   (row.subscription_plan as AppUser['subscriptionPlan'])   ?? 'free',
    subscriptionStatus: (row.subscription_status as AppUser['subscriptionStatus']) ?? 'active',
    subscriptionSince:  row.subscription_since ? String(row.subscription_since) : undefined,
    lastLoginAt:        row.last_login_at ? String(row.last_login_at) : undefined,
  };
}

// ── findUserByCredentials ──────────────────────────────────────────────────

export async function findUserByCredentials(
  username: string,
  password: string,
): Promise<AppUser | null> {
  const db = getDb();

  if (!db) {
    // ⚠️ SECURITY: sense Supabase, la contrasenya es compara en TEXT PLA
    // (u.password === password), NO amb bcrypt.compare(). bcrypt només
    // s'aplica al camí de Supabase, més avall. SUPABASE_URL i
    // SUPABASE_SERVICE_ROLE_KEY han d'estar configurades en QUALSEVOL
    // entorn que no sigui dev local — aquest fallback no és segur en
    // staging/producció.
    const u = getDevDB().find(u => u.username === username && u.password === password && u.active);
    return u ? devUserToAppUser(u) : null;
  }

  // Supabase path
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('username', username)
    .eq('active', true)
    .maybeSingle();

  if (error || !data) {
    // Lazy admin seeding: if Supabase has no users yet, seed admin from env vars
    if (!error) await seedAdminIfEmpty(db, username, password);
    // Re-try after potential seed
    const retry = await db
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('active', true)
      .maybeSingle();
    if (retry.error || !retry.data) return null;
    const match = await bcrypt.compare(password, String(retry.data.password_hash));
    if (!match) return null;
    await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', retry.data.id);
    return rowToUser(retry.data as Record<string, unknown>);
  }

  const match = await bcrypt.compare(password, String(data.password_hash));
  if (!match) return null;
  await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', data.id);
  return rowToUser(data as Record<string, unknown>);
}

// ── Lazy admin seeding ─────────────────────────────────────────────────────
// Creates the admin user in Supabase on first login when the table is empty.
// Runs at most once; subsequent calls find the row and skip.

async function seedAdminIfEmpty(
  db: NonNullable<ReturnType<typeof getDb>>,
  username: string,
  password: string,
): Promise<void> {
  const adminUser = process.env.ADMIN_USERNAME ?? 'admin';
  if (username !== adminUser) return;

  // Només es crea l'admin si la contrasenya coincideix amb ADMIN_PASSWORD.
  // Abans es desava la contrasenya del PRIMER intent de login, de manera que
  // qualsevol podia convertir-se en admin si la taula era buida.
  const adminPassword = getConfiguredAdminPassword();
  if (!adminPassword || password !== adminPassword) return;

  const { count } = await db.from('users').select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return;

  const hash = await bcrypt.hash(password, 12);
  await db.from('users').insert({
    id:                 `admin-${Date.now()}`,
    username:           adminUser,
    password_hash:      hash,
    name:               'Admin Factor OTC',
    email:              process.env.ADMIN_EMAIL ?? 'admin@factorotc.com',
    role:               'admin',
    active:             true,
    subscription_plan:   'active',
    subscription_status: 'active',
  });
}

// ── createUser ────────────────────────────────────────────────────────────

export interface CreateUserInput {
  username:           string;
  password:           string;
  name:               string;
  email:              string;
  role:               UserRole;
  active:             boolean;
  subscriptionPlan:   AppUser['subscriptionPlan'];
  subscriptionStatus: AppUser['subscriptionStatus'];
}

export async function createUser(input: CreateUserInput): Promise<AppUser> {
  const db = getDb();
  const hash = await bcrypt.hash(input.password, 12);

  if (!db) {
    const devUser: DevUser = {
      ...input,
      password:  input.password,
      id:        `user-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    getDevDB().push(devUser);
    return devUserToAppUser(devUser);
  }

  const id = `user-${Date.now()}`;
  const { data, error } = await db.from('users').insert({
    id,
    username:            input.username,
    password_hash:       hash,
    name:                input.name,
    email:               input.email,
    role:                input.role,
    active:              input.active,
    subscription_plan:   input.subscriptionPlan,
    subscription_status: input.subscriptionStatus,
  }).select().single();

  if (error || !data) throw new Error(error?.message ?? 'Error creant usuari');
  return rowToUser(data as Record<string, unknown>);
}

// Keep legacy export name so existing callers compile without change
export const createAuthorizedUser = createUser;

// ── getAllUsers ────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<AppUser[]> {
  const db = getDb();
  if (!db) return getDevDB().map(devUserToAppUser);

  const { data, error } = await db.from('users').select(
    'id,username,name,email,role,active,created_at,subscription_plan,subscription_status,subscription_since,last_login_at'
  ).order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToUser);
}

// ── findUserById ──────────────────────────────────────────────────────────

export async function findUserById(id: string): Promise<AppUser | null> {
  const db = getDb();
  if (!db) {
    const u = getDevDB().find(u => u.id === id);
    return u ? devUserToAppUser(u) : null;
  }

  const { data, error } = await db.from('users').select(
    'id,username,name,email,role,active,created_at,subscription_plan,subscription_status,subscription_since,last_login_at'
  ).eq('id', id).maybeSingle();

  if (error || !data) return null;
  return rowToUser(data as Record<string, unknown>);
}

// ── updateUserSubscription ────────────────────────────────────────────────

export async function updateUserSubscription(
  id: string,
  plan: AppUser['subscriptionPlan'],
  status: AppUser['subscriptionStatus'],
): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const u = getDevDB().find(u => u.id === id);
    if (!u) return false;
    u.subscriptionPlan   = plan;
    u.subscriptionStatus = status;
    if (plan !== 'free' && !u.subscriptionSince) {
      u.subscriptionSince = new Date().toISOString().split('T')[0];
    }
    return true;
  }

  const update: Record<string, unknown> = {
    subscription_plan:   plan,
    subscription_status: status,
    updated_at:          new Date().toISOString(),
  };
  if (plan !== 'free') {
    const existing = await db.from('users').select('subscription_since').eq('id', id).maybeSingle();
    if (!existing.data?.subscription_since) {
      update.subscription_since = new Date().toISOString().split('T')[0];
    }
  }

  const { error } = await db.from('users').update(update).eq('id', id);
  return !error;
}

// ── updateUserName ────────────────────────────────────────────────────────

/**
 * Canvia el nom complet (nom + cognoms) del client. També el copia a la cartera
 * i als informes mensuals ja generats, que el desen com a text.
 */
export async function updateUserName(id: string, name: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const u = getDevDB().find(u => u.id === id);
    if (!u) return false;
    u.name = name;
    return true;
  }
  const now = new Date().toISOString();
  const { data, error } = await db.from('users').update({ name, updated_at: now }).eq('id', id).select('id');
  if (error || !data?.length) return false;
  const { data: ports } = await db.from('client_portfolios').update({ client_name: name, updated_at: now }).eq('client_id', id).select('id');
  const ids = (ports ?? []).map(p => p.id as string);
  if (ids.length) {
    // L'informe mensual es mostra des de data.clientName (còpia desada en generar-lo).
    const { data: reps } = await db.from('monthly_reports').select('id, data').in('portfolio_id', ids);
    for (const r of reps ?? []) {
      const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      const next = d && typeof d === 'object' ? { ...d, clientName: name } : d;
      await db.from('monthly_reports').update({ client_name: name, data: next }).eq('id', r.id);
    }
  }
  return true;
}

// ── updateUserRole ────────────────────────────────────────────────────────

export async function updateUserRole(id: string, role: UserRole): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const u = getDevDB().find(u => u.id === id);
    if (!u) return false;
    u.role = role;
    return true;
  }

  const { error } = await db.from('users').update({ role, updated_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

// ── deactivateUser ────────────────────────────────────────────────────────

export async function deactivateUser(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const u = getDevDB().find(u => u.id === id);
    if (!u) return false;
    u.active = false;
    return true;
  }

  const { error } = await db.from('users').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

// ── updatePassword ────────────────────────────────────────────────────────

export async function updatePassword(id: string, password: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const u = getDevDB().find(u => u.id === id);
    if (!u) return false;
    u.password = password;
    return true;
  }
  const hash = await bcrypt.hash(password, 12);
  const { error } = await db.from('users').update({ password_hash: hash, updated_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

// ── Enllaços de contrasenya (lib/passwordLink.ts) ──────────────────────────

/**
 * Valor secret que canvia cada cop que canvia la contrasenya (el hash bcrypt).
 * Serveix perquè un enllaç per crear o canviar la contrasenya només es pugui
 * fer servir una vegada. Mai surt del servidor.
 */
export async function getPasswordStamp(id: string): Promise<string | null> {
  const db = getDb();
  if (!db) {
    const u = getDevDB().find(u => u.id === id && u.active);
    return u ? `dev:${u.password}` : null;
  }
  const { data, error } = await db.from('users').select('password_hash,active').eq('id', id).maybeSingle();
  if (error || !data || !data.active) return null;
  return String(data.password_hash);
}

/** Usuari actiu per nom d'usuari o correu (per a "He oblidat la contrasenya"). */
export async function findActiveUserByLogin(login: string): Promise<AppUser | null> {
  const q = login.trim().toLowerCase();
  if (!q) return null;
  const all = await getAllUsers();
  return all.find(u => u.active && (u.username.toLowerCase() === q || (!!u.email && u.email.toLowerCase() === q))) ?? null;
}

// ── Verificació en dos passos (lib/totp.ts) ────────────────────────────────

/** Secret TOTP xifrat de l'usuari (null si no té la verificació en dos passos activada). */
export async function getTotpSecret(id: string): Promise<string | null> {
  const db = getDb();
  if (!db) return getDevDB().find(u => u.id === id)?.totpSecret ?? null;
  const { data, error } = await db.from('users').select('totp_secret').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return (data.totp_secret as string | null) ?? null;
}

/** Desa (o esborra amb null) el secret TOTP xifrat. */
export async function setTotpSecret(id: string, encrypted: string | null): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const u = getDevDB().find(u => u.id === id);
    if (!u) return false;
    u.totpSecret = encrypted;
    return true;
  }
  const { error } = await db.from('users').update({
    totp_secret: encrypted, totp_enabled_at: encrypted ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  }).eq('id', id);
  return !error;
}
