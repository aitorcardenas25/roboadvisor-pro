// lib/users.ts
// Store d'usuaris en memòria. En producció substituir per BD real.

import { UserRole } from './roles';

export interface AppUser {
  id:        string;
  username:  string;
  password:  string; // en producció: hash bcrypt
  name:      string;
  email:     string;
  role:      UserRole;
  active:    boolean;
  createdAt: string;
}

function buildUsersDB(): AppUser[] {
  const users: AppUser[] = [];

  // Admin principal des de variables d'entorn
  users.push({
    id:        '1',
    username:  process.env.ADMIN_USERNAME  ?? 'admin',
    password:  process.env.ADMIN_PASSWORD  ?? 'factorOTC2024!',
    name:      'Admin Factor OTC',
    email:     process.env.ADMIN_EMAIL     ?? 'admin@factorotc.com',
    role:      'admin',
    active:    true,
    createdAt: '2024-01-01',
  });

  // Usuaris autoritzats addicionals des de variables d'entorn (JSON array)
  const extraJSON = process.env.AUTHORIZED_USERS;
  if (extraJSON) {
    try {
      const extra = JSON.parse(extraJSON) as Omit<AppUser, 'id' | 'createdAt'>[];
      extra.forEach((u, i) => {
        users.push({ ...u, id: `authorized-${i + 1}`, createdAt: '2024-01-01' });
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

export function createAuthorizedUser(data: Omit<AppUser, 'id' | 'createdAt'>): AppUser {
  const user: AppUser = {
    ...data,
    id:        `user-${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
  };
  usersDB.push(user);
  return { ...user, password: '***' };
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
