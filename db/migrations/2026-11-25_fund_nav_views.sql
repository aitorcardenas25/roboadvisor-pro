-- Migració 2026-11-25: vistes per llegir ràpid els preus dels fons quan la
-- taula fund_navs té l'històric diari complet (~250.000 files).
-- Com aplicar-la: Supabase → projecte factor-otc → SQL Editor → enganxa i Run.
-- Es pot executar més d'una vegada sense perill. Només lectura: no toca dades.

-- Últim preu de cada mes de cada fons (rendibilitat, volatilitat, resum de l'admin)
CREATE OR REPLACE VIEW fund_nav_month_ends WITH (security_invoker = true) AS
SELECT DISTINCT ON (isin, date_trunc('month', nav_date))
       isin, nav_date, nav, currency, fund_name
FROM fund_navs
ORDER BY isin, date_trunc('month', nav_date), nav_date DESC;

-- Quants preus té cada fons, i el primer i l'últim
CREATE OR REPLACE VIEW fund_nav_stats WITH (security_invoker = true) AS
SELECT isin, COUNT(*)::int AS points, MIN(nav_date) AS first_date, MAX(nav_date) AS last_date
FROM fund_navs
GROUP BY isin;
