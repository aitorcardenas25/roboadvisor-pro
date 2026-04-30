// lib/news.ts

export type NewsCategory =
  | 'mercats'
  | 'macroeconomia'
  | 'renda-variable'
  | 'renda-fixa'
  | 'fons'
  | 'etfs';

export type NewsStatus = 'draft' | 'published' | 'archived';

export interface NewsArticle {
  id:          string;
  title:       string;
  summary:     string;
  content:     string;
  category:    NewsCategory;
  source:      string;
  author:      string;
  status:      NewsStatus;
  featured:    boolean;
  externalUrl: string;
  publishedAt: string;
  createdAt:   string;
  updatedAt:   string;
}

export const CATEGORY_LABELS: Record<NewsCategory, string> = {
  'mercats':        'Mercats',
  'macroeconomia':  'Macroeconomia',
  'renda-variable': 'Renda Variable',
  'renda-fixa':     'Renda Fixa',
  'fons':           'Fons d\'Inversió',
  'etfs':           'ETFs',
};

export const CATEGORY_COLORS: Record<NewsCategory, string> = {
  'mercats':        '#c9a84c',
  'macroeconomia':  '#3b82f6',
  'renda-variable': '#10b981',
  'renda-fixa':     '#8b5cf6',
  'fons':           '#f59e0b',
  'etfs':           '#06b6d4',
};

// Dades d'exemple per arrancar amb contingut
const SAMPLE_NEWS: NewsArticle[] = [
  {
    id: 'news-1',
    title: 'Els mercats europeus tanquen al màxim anual enmig de l\'optimisme per la inflació',
    summary: 'L\'Eurostoxx 50 ha tancat la setmana amb un guany del 2,3% després de les dades d\'inflació de la zona euro que mostren una tendència a la baixa consistent.',
    content: 'Els principals índexs europeus han registrat una sessió alcista, impulsats per les dades d\'inflació de la zona euro que confirmen la tendència desinflacionista. L\'Eurostoxx 50 ha pujat un 2,3% setmanal, mentre l\'IBEX 35 ha avançat un 1,8%, liderat pel sector bancari i les utilities.',
    category: 'mercats',
    source: 'Factor OTC',
    author: 'Equip Factor OTC',
    status: 'published',
    featured: true,
    externalUrl: '',
    publishedAt: '2026-04-28',
    createdAt: '2026-04-28',
    updatedAt: '2026-04-28',
  },
  {
    id: 'news-2',
    title: 'BCE manté els tipus al 2,5% i obre la porta a noves retallades al segon semestre',
    summary: 'El Consell de Govern del Banc Central Europeu ha decidit mantenir els tipus d\'interès al 2,5%, però els missatges de Lagarde apunten a possibles retallades si la inflació continua cedint.',
    content: 'El BCE ha celebrat la seva reunió de política monetària d\'abril sense canvis en els tipus, però amb un to clarament dovish. Christine Lagarde ha destacat que l\'economia de la zona euro mostra senyals de recuperació gradual i que la inflació s\'encamina cap a l\'objectiu del 2%.',
    category: 'macroeconomia',
    source: 'Factor OTC',
    author: 'Equip Factor OTC',
    status: 'published',
    featured: false,
    externalUrl: '',
    publishedAt: '2026-04-25',
    createdAt: '2026-04-25',
    updatedAt: '2026-04-25',
  },
  {
    id: 'news-3',
    title: 'Els fons de renda variable global acumulen entrades netes de 45.000M€ en el primer trimestre',
    summary: 'Els fons d\'inversió de renda variable global han registrat les majors entrades netes des de 2021, impulsats per la rotació des de la renda fixa i la millora de les perspectives de beneficis empresarials.',
    content: 'Segons les dades de Morningstar, els fons de renda variable global han captat 45.000 milions d\'euros en entrades netes durant el primer trimestre de 2026. Els fons indexats han liderat els fluxos, mentre els fons de gestió activa han registrat resultats mixtos.',
    category: 'fons',
    source: 'Factor OTC',
    author: 'Equip Factor OTC',
    status: 'published',
    featured: false,
    externalUrl: '',
    publishedAt: '2026-04-22',
    createdAt: '2026-04-22',
    updatedAt: '2026-04-22',
  },
  {
    id: 'news-4',
    title: 'La renda fixa corporativa europea ofereix oportunitats en el tram curt davant la caiguda dels spreads',
    summary: 'Els spreads de crèdit europeu han assolit mínims de dos anys, però el tram curt de la corba (1-3 anys) manté una rendibilitat atractiva amb risc de durada limitat.',
    content: 'La compressió dels spreads en el crèdit europeu reflecteix la millora de la qualitat creditícia de les empreses i la reducció de les preocupacions sobre un aterratge dur. Els bons corporatius IG en el tram curt ofereixen yields del 3,2%-3,8%, una rendibilitat atractiva per als perfils conservadors.',
    category: 'renda-fixa',
    source: 'Factor OTC',
    author: 'Equip Factor OTC',
    status: 'published',
    featured: false,
    externalUrl: '',
    publishedAt: '2026-04-20',
    createdAt: '2026-04-20',
    updatedAt: '2026-04-20',
  },
  {
    id: 'news-5',
    title: 'Els ETFs de dividend europeu baten el mercat en el que va d\'any amb un rendiment del 8,4%',
    summary: 'Els ETFs especialitzats en dividend europeu s\'han convertit en la categoria guanyadora del 2026, combinant apreciació del capital i rendiment per dividend en un entorn de tipus a la baixa.',
    content: 'La categoria de ETFs de dividend europeu acumula una rendibilitat del 8,4% en el que va d\'any, superant el 6,2% de l\'Eurostoxx 50. La combinació de valoracions atractives, beneficis empresarials resilients i tipus a la baixa crea el context ideal per a la inversió en dividend.',
    category: 'etfs',
    source: 'Factor OTC',
    author: 'Equip Factor OTC',
    status: 'published',
    featured: false,
    externalUrl: '',
    publishedAt: '2026-04-18',
    createdAt: '2026-04-18',
    updatedAt: '2026-04-18',
  },
  {
    id: 'news-6',
    title: 'El sector tecnològic als EUA mostra senyals de sobrecompra tècnica a curt termini',
    summary: 'L\'RSI setmanal del Nasdaq 100 ha superat 70 per primera vegada des del setembre de 2024, suggerint una possible consolidació o correcció a curt termini.',
    content: 'L\'anàlisi tècnica del Nasdaq 100 mostra un RSI setmanal per sobre de 70, nivell que històricament ha precedit correccions del 5-10% a curt termini. Els inversors de llarg termini no haurien de modificar les seves posicions, però els nous entrada podrien esperar millors nivells de preu.',
    category: 'renda-variable',
    source: 'Factor OTC',
    author: 'Equip Factor OTC',
    status: 'published',
    featured: false,
    externalUrl: '',
    publishedAt: '2026-04-15',
    createdAt: '2026-04-15',
    updatedAt: '2026-04-15',
  },
];

let newsDB: NewsArticle[] = [...SAMPLE_NEWS];

// ── Public ────────────────────────────────────────────────────────────────────

export function getPublishedNews(category?: NewsCategory): NewsArticle[] {
  return newsDB
    .filter(n => n.status === 'published' && (!category || n.category === category))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getFeaturedNews(): NewsArticle[] {
  return newsDB
    .filter(n => n.status === 'published' && n.featured)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export function getAllNews(): NewsArticle[] {
  return [...newsDB].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getNewsById(id: string): NewsArticle | null {
  return newsDB.find(n => n.id === id) ?? null;
}

export function createNews(data: Omit<NewsArticle, 'id' | 'createdAt' | 'updatedAt'>): NewsArticle {
  const now = new Date().toISOString().split('T')[0];
  const article: NewsArticle = {
    ...data,
    id:        `news-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
  newsDB.push(article);
  return article;
}

export function updateNews(id: string, updates: Partial<Omit<NewsArticle, 'id' | 'createdAt'>>): NewsArticle | null {
  const idx = newsDB.findIndex(n => n.id === id);
  if (idx === -1) return null;
  newsDB[idx] = { ...newsDB[idx], ...updates, updatedAt: new Date().toISOString().split('T')[0] };
  return newsDB[idx];
}

export function deleteNews(id: string): boolean {
  const idx = newsDB.findIndex(n => n.id === id);
  if (idx === -1) return false;
  newsDB.splice(idx, 1);
  return true;
}
