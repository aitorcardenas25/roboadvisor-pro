// lib/clientTarget.ts — de quin client són les dades que demana el portal.
//
// - Un client sempre veu les seves (l'id de la sessió, mai un altre).
// - L'administrador pot obrir la "vista del client": una galeta amb l'id del
//   client fa que les rutes /api/client/* de lectura retornin les dades
//   d'aquell client, exactament com les veuria ell. La galeta només té efecte
//   si la sessió és d'administrador (un client que la falsifiqués no veu res
//   d'un altre). En aquesta vista no es pot escriure res.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './authOptions';
import { findUserById } from './users';

export const PREVIEW_COOKIE = 'otc_preview_as';

export interface ClientTarget {
  /** Id del client les dades del qual es llegeixen. */
  id:      string;
  email:   string | null;
  name:    string | null;
  /** Rol de qui mira: en la vista del client és 'admin'. */
  role:    'client' | 'admin';
  /** L'administrador està mirant la vista d'un client (només lectura). */
  preview: boolean;
}

type S = { user?: { id?: string; email?: string | null; name?: string | null; role?: string } } | null;

async function previewClientId(): Promise<string | null> {
  try { return (await cookies()).get(PREVIEW_COOKIE)?.value || null; }
  catch { return null; }   // fora d'una petició (tests)
}

/** Client de la sessió o, per a l'admin en la vista del client, el client que mira. */
export async function getClientTarget(): Promise<ClientTarget | null> {
  const session = await getServerSession(authOptions) as S;
  const u = session?.user;
  if (!u?.id) return null;
  if (u.role === 'client') return { id: u.id, email: u.email ?? null, name: u.name ?? null, role: 'client', preview: false };
  if (u.role !== 'admin') return null;

  const asId = await previewClientId();
  if (asId) {
    const c = await findUserById(asId);
    if (c && c.role === 'client') return { id: c.id, email: c.email ?? null, name: c.name ?? null, role: 'admin', preview: true };
  }
  return { id: u.id, email: u.email ?? null, name: u.name ?? null, role: 'admin', preview: false };
}

/** L'admin té oberta la vista d'un client: cap escriptura (ni amb el seu id ni amb el del client). */
export async function isPreviewSession(): Promise<boolean> {
  const session = await getServerSession(authOptions) as S;
  return session?.user?.role === 'admin' && !!(await previewClientId());
}

export function previewReadOnly() {
  return NextResponse.json({ error: 'Vista del client: només lectura', code: 'preview_read_only' }, { status: 403 });
}
