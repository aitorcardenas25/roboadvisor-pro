# Pla Fase 1 — RoboAdvisor Pro

---

## Deute tècnic

### Lint

El lint NO forma part del CI actual (`ci.yml` no el crida, i `next build` a Next 16 tampoc l'executa). Abans d'afegir un pas `npm run lint` a `ci.yml`, cal resoldre primer el deute acumulat (74 errors + 61 warnings), o el primer PR després d'activar-lo fallarà en bloc.

### Autenticació

El fallback in-memory de `lib/users.ts` (quan `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no estan configurades) compara les contrasenyes en **text pla** (`u.password === password`), NO amb `bcrypt.compare()`. `bcrypt` només s'aplica al camí de Supabase. **`SUPABASE_URL` ha d'estar configurada en qualsevol entorn que no sigui dev local** — aquest fallback no és segur en staging/producció.
