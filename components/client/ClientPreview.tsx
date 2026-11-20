'use client';

// Vista del client per a l'administrador: el portal mostra les dades d'un client
// (les rutes del servidor ho decideixen per la galeta), en només lectura.
// Aquí només es pinta la franja d'avís i es dona el nom del client a les pàgines.
import { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface Preview { id: string; name: string | null }
const Ctx = createContext<Preview | null>(null);

/** Client que l'admin està mirant, o null si és el portal normal. */
export function usePreview() { return useContext(Ctx); }

/** Nom a mostrar al portal: el del client mirat en la vista de l'admin, si no el de la sessió. */
export function useClientName(sessionName?: string | null) {
  const p = useContext(Ctx);
  return p ? (p.name ?? '') : (sessionName ?? '');
}

export default function ClientPreviewProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || role !== 'admin') return;
    fetch('/api/admin/preview', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => setPreview(j?.preview ?? null))
      .catch(() => {});
  }, [status, role]);

  async function close() {
    await fetch('/api/admin/preview', { method: 'DELETE' }).catch(() => {});
    setPreview(null);
    window.close();                      // si s'ha obert en una pestanya nova
    window.location.href = '/admin';     // si el navegador no la deixa tancar
  }

  return (
    <Ctx.Provider value={preview}>
      {preview && (
        <div role="status" className="sticky top-0 z-50 bg-[#8a5a00] text-white text-xs sm:text-sm">
          <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            <span>
              Vista del client: estàs veient el portal tal com el veu <strong>{preview.name ?? 'el client'}</strong>.
              Només lectura, no es desa res.
            </span>
            <button type="button" onClick={close}
              className="rounded-md bg-white/15 hover:bg-white/25 px-3 py-1 font-medium">
              Tancar la vista
            </button>
          </div>
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}
