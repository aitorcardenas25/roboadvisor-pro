// lib/users.ts
// Store d'usuaris en memòria. En producció substituir per BD real.

import { UserRole } from './roles';

export interface AppUser {
  id:                 string;
  username:           string;
  password:           string; // en producció: hash bcrypt
  name:               string;
  email:              string;
  role:               UserRole;
  active:             boolean;
  createdAt:          string;
  subscriptionPlan:   'free' | 'active' | 'premium';
  subscriptionStatus: 'active' | 'inactive' | 'suspended';
  subscriptionSince?: string;
}

function buildUsersDB(): AppUser[] {
  const users: AppUser[] = [];

  // Admin principal des de variables d'entorn
  users.push({
    id:                 '1',
    username:           process.env.ADMIN_USERNAME  ?? 'admin',
    password:           process.env.ADMIN_PASSWORD  ?? 'factorOTC2024!',
    name:               'Admin Factor OTC',
    email:              process.env.ADMIN_EMAIL     ?? 'admin@factorotc.com',
    role:               'admin',
    active:             true,
    createdAt:          '2024-01-01',
    subscriptionPlan:   'premium',
    subscriptionStatus: 'active',
  });

  // Usuaris autoritzats addicionals des de variables d'entorn (JSON array)
  const extraJSON = process.env.AUTHORIZED_USERS;
  if (extraJSON) {
    try {
      const extra = JSON.parse(extraJSON) as Partial<Omit<AppUser, 'id' | 'createdAt'>>[];
      extra.forEach((u, i) => {
        users.push({
          ...u,
          id: `authorized-${i + 1}`,
          createdAt: '2024-01-01',
          subscriptionPlan:   u.subscriptionPlan   ?? 'free',
          subscriptionStatus: u.subscriptionStatus ?? 'active',
        });
      });
    } catch {
      // JSON mal format — ignorar
    }
  }

  return users;
}

let usersDB: AppUser[] = buildUsersDB();

export function findUserByCredentials(username: string, password: string): AppUser | null {
  return usersDB.find(u => u.username === username && u.password === password && u.active) ?? null;
}

export function findUserById(id: string): AppUser | null {
  return usersDB.find(u => u.id === id) ?? null;
}

export function getAllUsers(): AppUser[] {
  return usersDB.map(u => ({ ...u, password: '***' }));
}

export function createAuthorizedUser(data: Omit<AppUser, 'id' | 'createdAt' | 'subscriptionPlan' | 'subscriptionStatus' | 'subscriptionSince'> & Partial<Pick<AppUser, 'subscriptionPlan' | 'subscriptionStatus' | 'subscriptionSince'>>): AppUser {
  const user: AppUser = {
    subscriptionPlan: 'free', subscriptionStatus: 'active',
    ...data,
    subscriptionPlan:   data.subscriptionPlan   ?? 'free',
    subscriptionStatus: data.subscriptionStatus ?? 'active',
    id:        `user-${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
  };
  usersDB.push(user);
  return { ...user, password: '***' };
}

export function updateUserSubscription(
  id: string,
  plan: AppUser['subscriptionPlan'],
  status: AppUser['subscriptionStatus'],
): boolean {
  const user = usersDB.find(u => u.id === id);
  if (!user) return false;
  user.subscriptionPlan   = plan;
  user.subscriptionStatus = status;
  if (plan !== 'free' && !user.subscriptionSince) {
    user.subscriptionSince = new Date().toISOString().split('T')[0];
  }
  return true;
}

export function updateUserRole(id: string, role: UserRole): boolean {
  const user = usersDB.find(u => u.id === id);
  if (!user) return false;
  user.role = role;
  return true;
}

export function deactivateUser(id: string): boolean {
  const user = usersDB.find(u => u.id === id);
  if (!user) return false;
  user.active = false;
  return true;
}
