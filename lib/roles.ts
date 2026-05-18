export type UserRole = 'client' | 'admin';

export interface Permission {
  viewPublicContent:  boolean; // Notícies, comparador, carteres model, landing
  viewPrivatePortfolio: boolean; // Cartera pròpia, transaccions, informes, notes
  viewAdminPanel:     boolean; // Panell d'administració complet
  manageUsers:        boolean;
  manageContent:      boolean; // Notícies, fons, newsletters
  manageReports:      boolean; // Generar i enviar informes
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  client: {
    viewPublicContent:    true,
    viewPrivatePortfolio: true,
    viewAdminPanel:       false,
    manageUsers:          false,
    manageContent:        false,
    manageReports:        false,
  },
  admin: {
    viewPublicContent:    true,
    viewPrivatePortfolio: true,
    viewAdminPanel:       true,
    manageUsers:          true,
    manageContent:        true,
    manageReports:        true,
  },
};

export function can(role: UserRole | undefined, permission: keyof Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

export function requiresAuth(role: UserRole): boolean {
  return role === 'client' || role === 'admin';
}
