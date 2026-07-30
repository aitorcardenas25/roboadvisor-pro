# Pla Fase 1 — RoboAdvisor Pro

---

## Deute tècnic — lint

El lint NO forma part del CI actual (`ci.yml` no el crida, i `next build` a Next 16 tampoc l'executa). Abans d'afegir un pas `npm run lint` a `ci.yml`, cal resoldre primer el deute acumulat (74 errors + 61 warnings), o el primer PR després d'activar-lo fallarà en bloc.
