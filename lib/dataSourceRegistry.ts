// lib/dataSourceRegistry.ts
// Central registry of all data sources used in FACTOR OTC.
// Pure definitions — no process.env, works both client and server.

export type SourceId =
  | 'fmp'
  | 'alphavantage'
  | 'yahoo'
  | 'ecb'
  | 'frankfurter'
  | 'tradingview'
  | 'supabase'
  | 'resend'
  | 'stripe'
  | 'internal';

export type SourceCategory =
  | 'market_data'
  | 'fx'
  | 'persistence'
  | 'communication'
  | 'payment'
  | 'internal';

export type ReliabilityLevel = 'high' | 'medium' | 'fallback' | 'simulated';

export interface DataSourceDef {
  id:               SourceId;
  name:             string;
  shortName:        string;
  description:      string;
  url:              string;
  category:         SourceCategory;
  usedFor:          string[];
  apiKeyRequired:   boolean;
  envKey?:          string;
  reliabilityLevel: ReliabilityLevel;
  accentColor:      string;
  initials:         string;
  priority:         number;  // lower = higher priority in fallback chain
}

export const DATA_SOURCES: Record<SourceId, DataSourceDef> = {
  fmp: {
    id:               'fmp',
    name:             'Financial Modeling Prep',
    shortName:        'FMP',
    description:      'Font principal de dades de mercat. Preus en temps real, historials, fonamentals d\'empreses i ETFs.',
    url:              'https://financialmodelingprep.com',
    category:         'market_data',
    usedFor:          ['Preu actual d\'actius', 'Historial de preus', 'Quotes ETFs i accions', 'Fonamentals d\'empresa'],
    apiKeyRequired:   true,
    envKey:           'FMP_API_KEY',
    reliabilityLevel: 'high',
    accentColor:      '#3b82f6',
    initials:         'FM',
    priority:         1,
  },
  alphavantage: {
    id:               'alphavantage',
    name:             'Alpha Vantage',
    shortName:        'AV',
    description:      'Font alternativa per a preus i historials mensuals. S\'activa si FMP no està disponible.',
    url:              'https://alphavantage.co',
    category:         'market_data',
    usedFor:          ['Historial mensual de preus (fallback FMP)'],
    apiKeyRequired:   true,
    envKey:           'ALPHA_VANTAGE_API_KEY',
    reliabilityLevel: 'medium',
    accentColor:      '#8b5cf6',
    initials:         'AV',
    priority:         2,
  },
  yahoo: {
    id:               'yahoo',
    name:             'Yahoo Finance',
    shortName:        'YF',
    description:      'Última font de suport per a preus i historials. S\'utilitza quan FMP i Alpha Vantage no estan disponibles.',
    url:              'https://finance.yahoo.com',
    category:         'market_data',
    usedFor:          ['Preus historials (2n fallback)', 'Cobertura ampliada de tickers europeus'],
    apiKeyRequired:   false,
    reliabilityLevel: 'fallback',
    accentColor:      '#7c3aed',
    initials:         'YF',
    priority:         3,
  },
  ecb: {
    id:               'ecb',
    name:             'Banc Central Europeu',
    shortName:        'ECB',
    description:      'Proveeix la taxa €STR (Euro Short-Term Rate), usada com a taxa lliure de risc en els càlculs CAPM i Sharpe.',
    url:              'https://data-api.ecb.europa.eu',
    category:         'market_data',
    usedFor:          ['Taxa lliure de risc (€STR)', 'Càlcul de Sharpe Ratio', 'Model CAPM'],
    apiKeyRequired:   false,
    reliabilityLevel: 'high',
    accentColor:      '#0ea5e9',
    initials:         'BC',
    priority:         1,
  },
  frankfurter: {
    id:               'frankfurter',
    name:             'Frankfurter',
    shortName:        'FX',
    description:      'API gratuïta per a tipus de canvi EUR/USD/GBP/CHF. Sense API key. Necessari per mostrar actius en USD en euros.',
    url:              'https://api.frankfurter.app',
    category:         'fx',
    usedFor:          ['Conversió EUR/USD per actius en dòlars', 'Valors de cartera en EUR', 'Tipus de canvi en temps real'],
    apiKeyRequired:   false,
    reliabilityLevel: 'high',
    accentColor:      '#f59e0b',
    initials:         'FX',
    priority:         1,
  },
  tradingview: {
    id:               'tradingview',
    name:             'TradingView',
    shortName:        'TV',
    description:      'Widgets de gràfics interactius. Disponible sense API key via scripts incrustats.',
    url:              'https://tradingview.com',
    category:         'market_data',
    usedFor:          ['Gràfics interactius d\'actius', 'Comparació de carteres vs benchmark', 'Gràfics de fons d\'inversió'],
    apiKeyRequired:   false,
    reliabilityLevel: 'high',
    accentColor:      '#2962ff',
    initials:         'TV',
    priority:         1,
  },
  supabase: {
    id:               'supabase',
    name:             'Supabase',
    shortName:        'DB',
    description:      'Base de dades PostgreSQL persistent. Totes les dades de clients, carteres i informes s\'emmagatzemen aquí.',
    url:              'https://supabase.com',
    category:         'persistence',
    usedFor:          ['Carteres de clients', 'Leads i clients', 'Instantànies de valor', 'Notes d\'assessor', 'Informes mensuals', 'Transaccions', 'Usuaris i autenticació'],
    apiKeyRequired:   true,
    envKey:           'SUPABASE_SERVICE_ROLE_KEY',
    reliabilityLevel: 'high',
    accentColor:      '#10b981',
    initials:         'SB',
    priority:         1,
  },
  resend: {
    id:               'resend',
    name:             'Resend',
    shortName:        'RS',
    description:      'Plataforma d\'enviament d\'emails transaccionals. Usada per a totes les comunicacions automatitzades.',
    url:              'https://resend.com',
    category:         'communication',
    usedFor:          ['Notificació de lead nou (admin)', 'Benvinguda al client', 'Informe mensual disponible', 'Confirmació d\'accés'],
    apiKeyRequired:   true,
    envKey:           'RESEND_API_KEY',
    reliabilityLevel: 'high',
    accentColor:      '#f43f5e',
    initials:         'RS',
    priority:         1,
  },
  stripe: {
    id:               'stripe',
    name:             'Stripe',
    shortName:        'ST',
    description:      'Processament de pagaments per a informes inicials i subscripcions mensuals.',
    url:              'https://stripe.com',
    category:         'payment',
    usedFor:          ['Informe inicial (pagament únic)', 'Subscripció mensual'],
    apiKeyRequired:   true,
    envKey:           'STRIPE_SECRET_KEY',
    reliabilityLevel: 'high',
    accentColor:      '#6366f1',
    initials:         'SP',
    priority:         1,
  },
  internal: {
    id:               'internal',
    name:             'FACTOR OTC',
    shortName:        'OTC',
    description:      'Càlculs interns de la plataforma: rendibilitats, distribució, mètriques de risc, PDF d\'informes i perfilació MiFID II.',
    url:              '#',
    category:         'internal',
    usedFor:          ['Càlcul de rendibilitat', 'Distribució per actiu/categoria', 'PDF d\'informes', 'Perfilació inversora MiFID II', 'Mètriques de risc (Sharpe, VaR)', 'Dades introduïdes per assessor'],
    apiKeyRequired:   false,
    reliabilityLevel: 'high',
    accentColor:      '#c9a84c',
    initials:         'FO',
    priority:         1,
  },
};

export function getDataSourceDef(id: string): DataSourceDef | undefined {
  return DATA_SOURCES[id as SourceId];
}

// Which sources provide data for each dashboard widget type
export const WIDGET_SOURCES: Record<string, SourceId[]> = {
  current_price:      ['fmp', 'alphavantage', 'yahoo'],
  price_history:      ['fmp', 'alphavantage', 'yahoo'],
  portfolio_value:    ['internal', 'supabase'],
  returns:            ['internal'],
  distribution:       ['internal'],
  snapshots:          ['supabase'],
  notes:              ['supabase'],
  reports:            ['internal', 'supabase'],
  transactions:       ['supabase'],
  risk_free_rate:     ['ecb'],
  fx_conversion:      ['frankfurter'],
  emails:             ['resend'],
  payments:           ['stripe'],
  interactive_charts: ['tradingview'],
};

// Readable label for a priceSource value from ClientHolding
export function getPriceSourceLabel(priceSource: 'fmp' | 'manual' | 'pending' | undefined): string {
  if (priceSource === 'fmp')    return 'Preu via FMP';
  if (priceSource === 'manual') return 'Introduït per assessor';
  return 'Pendent d\'actualitzar';
}

// Maps ClientHolding.priceSource → SourceId for badge rendering
export function priceSourceToId(priceSource: 'fmp' | 'manual' | 'pending' | undefined): SourceId {
  if (priceSource === 'fmp')    return 'fmp';
  if (priceSource === 'manual') return 'internal';
  return 'internal';
}

// All sources grouped by category
export const SOURCES_BY_CATEGORY: Record<SourceCategory, DataSourceDef[]> = {
  market_data:   [DATA_SOURCES.fmp, DATA_SOURCES.alphavantage, DATA_SOURCES.yahoo, DATA_SOURCES.ecb, DATA_SOURCES.tradingview],
  fx:            [DATA_SOURCES.frankfurter],
  persistence:   [DATA_SOURCES.supabase],
  communication: [DATA_SOURCES.resend],
  payment:       [DATA_SOURCES.stripe],
  internal:      [DATA_SOURCES.internal],
};

export const CATEGORY_LABELS: Record<SourceCategory, string> = {
  market_data:   'Dades de mercat',
  fx:            'Tipus de canvi',
  persistence:   'Persistència',
  communication: 'Comunicació',
  payment:       'Pagaments',
  internal:      'Plataforma',
};
