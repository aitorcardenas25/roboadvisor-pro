// types/index.ts
// Tipus consolidats del RoboAdvisor Pro
// Re-exporta i extén tots els tipus de les llibreries principals

export type {
  AssetClass,
  RiskLevel,
  InvestorProfile,
  ManagementType,
  DataStatus,
  FinancialProduct,
} from '@/lib/products';

export type {
  InvestorQuestionnaire,
  FinancialGoal,
  KnowledgeLevel,
  ExperienceLevel,
  LossTolerance,
  ReactionToDrops,
  ESGPreference,
  LiquidityNeed,
  ScoringResult,
  ScoreBreakdown,
  FinancialDiagnostics,
  ValidationResult,
} from '@/lib/scoring';

export type {
  PortfolioAllocation,
  Portfolio,
  CompositeBenchmark,
  BenchmarkComponent,
  PortfolioCharacteristics,
} from '@/lib/portfolio';

export type {
  PortfolioMetrics,
  CorrelationMatrix,
  RiskContribution,
  RollingReturn,
  DataQuality,
  MetricsStatus,
  PricePoint,
  HistoricalSeries,
  HistoricalChartPoint,
  DrawdownPoint,
} from '@/lib/metrics';

export type {
  MonteCarloParams,
  MonteCarloResult,
  MonteCarloPercentiles,
  MonteCarloProjection,
  MonteCarloSummary,
  ProbabilityAnalysis,
  InflationAdjustedResult,
  ScenarioAnalysis,
  Scenario,
} from '@/lib/monteCarlo';

export type {
  BacktestConfig,
  BacktestResult,
  BacktestPoint,
  BacktestMetrics,
  YearlyAnalysis,
  PerformanceAttribution,
  AttributionItem,
  RiskAnalysis,
  BacktestDataQuality,
  RollingWindowResult,
} from '@/lib/backtest';

// ─── TIPUS UI ──────────────────────────────────────────────────────────────────

export type AppView = 'landing' | 'roboadvisor' | 'admin';

export type ChartType =
  | 'area'
  | 'bar'
  | 'pie'
  | 'radar'
  | 'scatter'
  | 'line'
  | 'composed';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ToastMessage {
  id:      string;
  type:    'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface TableColumn<T = Record<string, unknown>> {
  key:       keyof T | string;
  label:     string;
  sortable?: boolean;
  width?:    string;
  render?:   (value: unknown, row: T) => React.ReactNode;
}

// ─── TIPUS API ─────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?:    T;
  error?:   string;
  message?: string;
  status:   'success' | 'error';
}

export interface PaginatedResponse<T = unknown> {
  items:      T[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

export interface MarketDataPoint {
  date:          string;
  open:          number;
  high:          number;
  low:           number;
  close:         number;
  adjustedClose: number;
  volume?:       number;
}

export interface MarketDataResponse {
  ticker:  string;
  source:  string;
  prices:  MarketDataPoint[];
  error?:  string;
}

// ─── TIPUS INFORME ─────────────────────────────────────────────────────────────

export interface ReportGenerationOptions {
  includeCharts:      boolean;
  includeMonterCarlo: boolean;
  includeBacktest:    boolean;
  includeCosts:       boolean;
  includeDisclaimer:  boolean;
  language:           'ca' | 'es' | 'en';
  format:             'pdf' | 'email';
  clientEmail?:       string;
}

// ─── TIPUS ADMIN ───────────────────────────────────────────────────────────────

export type AdminSection = 'dashboard' | 'funds' | 'reports' | 'config';

export interface AdminUser {
  id:       string;
  username: string;
  role:     'admin' | 'viewer';
}
