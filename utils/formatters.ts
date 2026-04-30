// utils/formatters.ts
// Funcions de format per a l'aplicació RoboAdvisor Pro

// ─── MONEDA ────────────────────────────────────────────────────────────────────

export function formatCurrency(
  amount:   number,
  currency: string  = 'EUR',
  locale:   string  = 'ca-ES',
  decimals: number  = 0
): string {
  return new Intl.NumberFormat(locale, {
    style:                 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M €`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}k €`;
  }
  return `${amount.toFixed(0)} €`;
}

export function formatAUM(aum: number): string {
  if (aum >= 1000) return `${(aum / 1000).toFixed(1)}B €`;
  return `${aum.toFixed(0)}M €`;
}

// ─── PERCENTATGE ───────────────────────────────────────────────────────────────

export function formatPercent(
  value:    number,
  decimals: number = 2,
  showSign: boolean = false
): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatPercentChange(value: number, decimals: number = 2): string {
  const sign  = value >= 0 ? '+' : '';
  const color = value >= 0 ? 'text-green-600' : 'text-red-600';
  void color;
  return `${sign}${value.toFixed(decimals)}%`;
}

// ─── RÀTIOS ────────────────────────────────────────────────────────────────────

export function formatRatio(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

export function formatBasisPoints(value: number): string {
  return `${(value * 100).toFixed(0)} pb`;
}

// ─── DATES ────────────────────────────────────────────────────────────────────

export function formatDate(
  date:   string | Date,
  locale: string = 'ca-ES'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  });
}

export function formatDateLong(
  date:   string | Date,
  locale: string = 'ca-ES'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${m}/${y}`;
}

export function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString('ca-ES', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ─── NOMBRES ───────────────────────────────────────────────────────────────────

export function formatNumber(
  value:    number,
  decimals: number = 2,
  locale:   string = 'ca-ES'
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatYears(years: number): string {
  if (years === 1) return '1 any';
  return `${years} anys`;
}

export function formatMonths(months: number): string {
  if (months < 12) return `${months} ${months === 1 ? 'mes' : 'mesos'}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? formatYears(y) : `${formatYears(y)} i ${m} ${m === 1 ? 'mes' : 'mesos'}`;
}

// ─── RISC ──────────────────────────────────────────────────────────────────────

export function formatRiskLevel(risk: number): string {
  const labels: Record<number, string> = {
    1: 'Molt baix',
    2: 'Baix',
    3: 'Moderat',
    4: 'Alt',
    5: 'Molt alt',
  };
  return labels[risk] ?? `Risc ${risk}`;
}

export function getRiskColor(risk: number): string {
  const colors: Record<number, string> = {
    1: 'text-emerald-600',
    2: 'text-green-600',
    3: 'text-amber-600',
    4: 'text-orange-600',
    5: 'text-red-600',
  };
  return colors[risk] ?? 'text-gray-600';
}

export function getRiskBadgeColor(risk: number): string {
  const colors: Record<number, string> = {
    1: 'bg-emerald-100 text-emerald-800',
    2: 'bg-green-100 text-green-800',
    3: 'bg-amber-100 text-amber-800',
    4: 'bg-orange-100 text-orange-800',
    5: 'bg-red-100 text-red-800',
  };
  return colors[risk] ?? 'bg-gray-100 text-gray-800';
}

// ─── PERFIL ────────────────────────────────────────────────────────────────────

export function getProfileBadgeColor(profile: string): string {
  const colors: Record<string, string> = {
    conservador: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    moderat:     'bg-blue-100 text-blue-800 border-blue-200',
    dinamic:     'bg-amber-100 text-amber-800 border-amber-200',
    agressiu:    'bg-red-100 text-red-800 border-red-200',
  };
  return colors[profile] ?? 'bg-gray-100 text-gray-800';
}

// ─── RENDIBILITAT ──────────────────────────────────────────────────────────────

export function getReturnColor(ret: number): string {
  if (ret > 0)  return 'text-green-600';
  if (ret < 0)  return 'text-red-600';
  return 'text-gray-500';
}

export function getReturnBgColor(ret: number): string {
  if (ret > 0)  return 'bg-green-50 text-green-700';
  if (ret < 0)  return 'bg-red-50 text-red-700';
  return 'bg-gray-50 text-gray-600';
}

// ─── SHARPE / RÀTIOS ───────────────────────────────────────────────────────────

export function getSharpeQuality(sharpe: number): { label: string; color: string } {
  if (sharpe >= 2.0) return { label: 'Excel·lent', color: 'text-emerald-600' };
  if (sharpe >= 1.0) return { label: 'Molt bo',    color: 'text-green-600'   };
  if (sharpe >= 0.5) return { label: 'Bo',          color: 'text-blue-600'   };
  if (sharpe >= 0.0) return { label: 'Acceptable',  color: 'text-amber-600'  };
  return                      { label: 'Negatiu',    color: 'text-red-600'   };
}

// ─── TER ───────────────────────────────────────────────────────────────────────

export function getTERQuality(ter: number): { label: string; color: string } {
  if (ter <= 0.20) return { label: 'Molt baix',  color: 'text-emerald-600' };
  if (ter <= 0.50) return { label: 'Baix',        color: 'text-green-600'  };
  if (ter <= 1.00) return { label: 'Moderat',     color: 'text-amber-600'  };
  if (ter <= 1.50) return { label: 'Alt',          color: 'text-orange-600' };
  return                    { label: 'Molt alt',   color: 'text-red-600'   };
}

// ─── DRAWDOWN ──────────────────────────────────────────────────────────────────

export function getDrawdownSeverity(dd: number): { label: string; color: string } {
  const abs = Math.abs(dd);
  if (abs <= 5)  return { label: 'Mínim',     color: 'text-emerald-600' };
  if (abs <= 15) return { label: 'Moderat',   color: 'text-blue-600'   };
  if (abs <= 25) return { label: 'Significatiu', color: 'text-amber-600' };
  if (abs <= 40) return { label: 'Sever',     color: 'text-orange-600' };
  return                  { label: 'Extrem',  color: 'text-red-600'    };
}
