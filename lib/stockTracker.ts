// lib/stockTracker.ts

export type StockSignal = 'neutral' | 'vigilancia' | 'oportunitat' | 'risc-elevat';

export interface TrackedStock {
  id:               string;
  symbol:           string;
  name:             string;
  sector:           string;
  region:           string;
  currency:         string;
  signal:           StockSignal;
  signalNote:       string;
  technicalNote:    string;
  fundamentalNote:  string;
  active:           boolean;
  addedAt:          string;
  updatedAt:        string;
}

export const SIGNAL_META: Record<StockSignal, { label: string; color: string; bg: string; icon: string }> = {
  'neutral':      { label: 'Neutral',       color: '#9ca3af', bg: 'bg-white/10',          icon: '⚪' },
  'vigilancia':   { label: 'Vigilància',    color: '#f59e0b', bg: 'bg-yellow-400/15',     icon: '👁' },
  'oportunitat':  { label: 'Oportunitat',   color: '#10b981', bg: 'bg-emerald-400/15',    icon: '🟢' },
  'risc-elevat':  { label: 'Risc elevat',   color: '#ef4444', bg: 'bg-red-400/15',        icon: '🔴' },
};

const SAMPLE_STOCKS: TrackedStock[] = [
  {
    id: 'stock-asml', symbol: 'ASML', name: 'ASML Holding NV', sector: 'Tecnologia / Semiconductors',
    region: 'Europa', currency: 'EUR', signal: 'oportunitat',
    signalNote: 'Correcció recent del 15% des de màxims ofereix punt d\'entrada atractiu. Monopoli de facto en litografia EUV imprescindible per a xips d\'última generació.',
    technicalNote: 'Suport en zona 650€. RSI setmanal en zona de sobrevenda (38). Divergència positiva en MACD mensual.',
    fundamentalNote: 'P/E 28x vs. mitjana 5Y de 35x. Cartera de comandes >40.000M€ assegura visibilitat 2-3 anys. Marge EBITDA ~35%.',
    active: true, addedAt: '2026-04-01', updatedAt: '2026-04-28',
  },
  {
    id: 'stock-msft', symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Tecnologia / Software',
    region: 'EUA', currency: 'USD', signal: 'neutral',
    signalNote: 'Valoració ajustada als nivells actuals. Excel·lent qualitat però sense marge de seguretat suficient. Mantenir posicions existents.',
    technicalNote: 'Cotitza en canal alcista de llarg termini. Resistència en 430$. RSI en zona neutral (55).',
    fundamentalNote: 'P/E 32x. Creixement Cloud (Azure) +25% YoY. Integració IA (Copilot) incipient però amb potencial de monetització alt.',
    active: true, addedAt: '2026-04-01', updatedAt: '2026-04-20',
  },
  {
    id: 'stock-novo', symbol: 'NVO', name: 'Novo Nordisk A/S', sector: 'Salut / Farmacèutica',
    region: 'Europa', currency: 'DKK', signal: 'vigilancia',
    signalNote: 'Resultats decebedors de l\'assaig CagriSema han provocat una correcció important. Cal vigilar pròximes dades clíniques.',
    technicalNote: 'Ruptura a la baixa del suport en 500 DKK. Tendència bajista a curt termini. Esperar consolidació.',
    fundamentalNote: 'P/E 22x, atractiu vs. historial. Ozempic/Wegovy mantenen demanda record. Risc de competència creixent (Eli Lilly).',
    active: true, addedAt: '2026-04-01', updatedAt: '2026-04-25',
  },
  {
    id: 'stock-inditex', symbol: 'ITX', name: 'Industria de Diseño Textil (Inditex)', sector: 'Consum Discrecional / Moda',
    region: 'Espanya', currency: 'EUR', signal: 'neutral',
    signalNote: 'Negoci de qualitat excepcional però valoració en màxims històrics. Sense catàlitzadors a curt termini.',
    technicalNote: 'Sobrecomprat en marc mensual. Resistència en 50€. Potencial de consolidació lateral.',
    fundamentalNote: 'P/E 24x. Marge net >15%. Model de negoci únic i defensiu. Dividend consistent i creixent.',
    active: true, addedAt: '2026-04-01', updatedAt: '2026-04-15',
  },
  {
    id: 'stock-nvda', symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Tecnologia / IA / Semiconductors',
    region: 'EUA', currency: 'USD', signal: 'vigilancia',
    signalNote: 'Empresa de qualitat excepcional amb creixement explosiu, però cotitza a múltiples molt exigents. Concentració de risc en sector IA.',
    technicalNote: 'Tendència alcista intacta. Suport clave en 800$. Volatilitat elevada, gestionar posicions.',
    fundamentalNote: 'P/E forward 35x. Creixement revenues +122% YoY. Backlog d\'H100/H200 garanteix revenues. Marge brut >75%.',
    active: true, addedAt: '2026-04-10', updatedAt: '2026-04-28',
  },
  {
    id: 'stock-mc', symbol: 'MC', name: 'LVMH Moët Hennessy Louis Vuitton', sector: 'Consum Discrecional / Luxe',
    region: 'Europa', currency: 'EUR', signal: 'oportunitat',
    signalNote: 'Correcció del 30% des de màxims per desacceleració del luxe a la Xina. Valoració atractiva per a empresa de qualitat superlativa.',
    technicalNote: 'Suport en 550€ amb volum. RSI en sobrevenda. Possible formació de doble mínims.',
    fundamentalNote: 'P/E 18x vs. 25x historial. Portafoli de marques insuperable. Directament beneficiada per recuperació turisme europeu.',
    active: true, addedAt: '2026-04-15', updatedAt: '2026-04-28',
  },
];

let stocksDB: TrackedStock[] = [...SAMPLE_STOCKS];

export function getAllStocks(): TrackedStock[] {
  return [...stocksDB].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getActiveStocks(): TrackedStock[] {
  return stocksDB.filter(s => s.active).sort((a, b) => {
    const order: StockSignal[] = ['oportunitat', 'vigilancia', 'neutral', 'risc-elevat'];
    return order.indexOf(a.signal) - order.indexOf(b.signal);
  });
}

export function getStockBySymbol(symbol: string): TrackedStock | null {
  return stocksDB.find(s => s.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
}

export function createStock(data: Omit<TrackedStock, 'id' | 'addedAt' | 'updatedAt'>): TrackedStock {
  const now = new Date().toISOString().split('T')[0];
  const stock: TrackedStock = { ...data, id: `stock-${Date.now()}`, addedAt: now, updatedAt: now };
  stocksDB.push(stock);
  return stock;
}

export function updateStock(id: string, updates: Partial<Omit<TrackedStock, 'id' | 'addedAt'>>): TrackedStock | null {
  const idx = stocksDB.findIndex(s => s.id === id);
  if (idx === -1) return null;
  stocksDB[idx] = { ...stocksDB[idx], ...updates, updatedAt: new Date().toISOString().split('T')[0] };
  return stocksDB[idx];
}

export function deleteStock(id: string): boolean {
  const idx = stocksDB.findIndex(s => s.id === id);
  if (idx === -1) return false;
  stocksDB.splice(idx, 1);
  return true;
}
