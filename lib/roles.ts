// lib/roles.ts
// Definició de rols i mapa de permisos del sistema

export type UserRole = 'public' | 'newsletter' | 'authorized' | 'admin';

export interface Permission {
  viewNews:           boolean; // Pàgina pública de notícies
  viewFundComparator: boolean; // Comparador de fons públic
  subscribeNewsletter:boolean; // Formulari de subscripció a newsletter
  receiveNewsletter:  boolean; // Rep newsletters per email
  createOwnPortfolio: boolean; // Crear cartera pròpia
  viewAdminPanel:     boolean; // Panell d'administració
  manageNewsletters:  boolean; // Crear/validar/enviar newsletters
  manageFunds:        boolean; // Gestionar fons a l'admin
  manageUsers:        boolean; // Gestionar usuaris
  validateOpportunities: boolean; // Validar oportunitats d'inversió
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  public: {
    viewNews:             true,
    viewFundComparator:   true,
    subscribeNewsletter:  true,
    receiveNewsletter:    false,
    createOwnPortfolio:   false,
    viewAdminPanel:       false,
    manageNewsletters:    false,
    manageFunds:          false,
    manageUsers:          false,
    validateOpportunities:false,
  },
  newsletter: {
    viewNews:             true,
    viewFundComparator:   true,
    subscribeNewsletter:  true,
    receiveNewsletter:    true,
    createOwnPortfolio:   false,
    viewAdminPanel:       false,
    manageNewsletters:    false,
    manageFunds:          false,
    manageUsers:          false,
    validateOpportunities:false,
  },
  authorized: {
    viewNews:             true,
    viewFundComparator:   true,
    subscribeNewsletter:  true,
    receiveNewsletter:    true,
    createOwnPortfolio:   true,
    viewAdminPanel:       false,
    manageNewsletters:    false,
    manageFunds:          false,
    manageUsers:          false,
    validateOpportunities:false,
  },
  admin: {
    viewNews:             true,
    viewFundComparator:   true,
    subscribeNewsletter:  true,
    receiveNewsletter:    true,
    createOwnPortfolio:   true,
    viewAdminPanel:       true,
    manageNewsletters:    true,
    manageFunds:          true,
    manageUsers:          true,
    validateOpportunities:true,
  },
};

export function can(role: UserRole | undefined, permission: keyof Permission): boolean {
  if (!role) return ROLE_PERMISSIONS.public[permission];
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

export function requiresAuth(role: UserRole): boolean {
  return role === 'authorized' || role === 'admin';
}
