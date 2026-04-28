export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Roboadvisor Pro
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Pàgina d&apos;inici personalitzada
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-300">
          Sí, ja t&apos;he ficat codi dins de <code>app/page.tsx</code>. Aquesta pàgina és ara un punt de partida
          net per continuar construint el teu dashboard.
        </p>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Pròxim pas</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Connectar dades de cartera i mostrar rendiment en temps real.
            </p>
          </article>
          <article className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Acció ràpida</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Crear components a <code>app/components</code> per separar UI i lògica.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
