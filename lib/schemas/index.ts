import { z } from 'zod';

// ── Compartits ─────────────────────────────────────────────────────────────

const InvestorProfile = z.enum(['conservador', 'moderat', 'dinamic', 'agressiu']);
const PortfolioStatus = z.enum(['draft', 'active', 'archived']);
const AssetType       = z.enum(['fund', 'etf', 'stock']);
const NewsletterStatus = z.enum(['draft', 'pending', 'validated', 'sent']);

// Enums inferits dels tipus interns del projecte
const NewsCategory = z.enum(['mercats', 'macroeconomia', 'renda-variable', 'renda-fixa', 'fons', 'etfs']);
const NewsStatus   = z.enum(['draft', 'published', 'archived']);
const StockSignal  = z.enum(['neutral', 'vigilancia', 'oportunitat', 'risc-elevat']);

// ── Portfolios ─────────────────────────────────────────────────────────────

const PortfolioAsset = z.object({
  type:          AssetType,
  id:            z.string().min(1),
  name:          z.string().min(1),
  isin:          z.string().optional(),
  symbol:        z.string().optional(),
  weight:        z.number().min(0).max(100),
  justification: z.string(),
});

export const CreatePortfolioSchema = z.object({
  name:               z.string().min(1, 'Nom obligatori'),
  description:        z.string().default(''),
  recommendedProfile: InvestorProfile,
  horizon:            z.string().default('5–10 anys'),
  assets:             z.array(PortfolioAsset).default([]),
  justification:      z.string().default(''),
  status:             PortfolioStatus.default('draft'),
});

export const UpdatePortfolioSchema = z.object({
  name:               z.string().min(1).optional(),
  description:        z.string().optional(),
  recommendedProfile: InvestorProfile.optional(),
  horizon:            z.string().optional(),
  assets:             z.array(PortfolioAsset).optional(),
  justification:      z.string().optional(),
  status:             PortfolioStatus.optional(),
});

// ── Informes ───────────────────────────────────────────────────────────────

export const SaveReportSchema = z.object({
  clientName:    z.string().default('Client'),
  clientEmail:   z.string().email().or(z.literal('')).default(''),
  profile:       InvestorProfile,
  score:         z.number().min(0).max(100).default(0),
  monthlyAmount: z.number().min(0).default(0),
  investable:    z.number().min(0).default(0),
  horizon:       z.number().int().min(1).max(50).default(10),
  portfolio:     z.array(z.string()).default([]),
  pdfGenerated:  z.boolean().default(false),
  emailSent:     z.boolean().default(false),
  date:          z.string().default(() => new Date().toLocaleDateString('ca-ES')),
});

// ── Newsletter ─────────────────────────────────────────────────────────────

export const SubscribeSchema = z.object({
  email: z.string().email('Format d\'email invàlid'),
  name:  z.string().default(''),
});

export const CreateNewsletterSchema = z.object({
  title:    z.string().min(1, 'Títol obligatori'),
  subject:  z.string().min(1, 'Assumpte obligatori'),
  sections: z.record(z.string(), z.string()).optional(),
});

export const UpdateNewsletterSchema = z.object({
  title:    z.string().min(1).optional(),
  subject:  z.string().min(1).optional(),
  sections: z.record(z.string(), z.string()).optional(),
  status:   NewsletterStatus.optional(),
});

// ── Fons (Funds) ───────────────────────────────────────────────────────────

export const CreateFundSchema = z.object({
  name:       z.string().min(1, 'Nom obligatori'),
  isin:       z.string().length(12, 'ISIN ha de tenir 12 caràcters'),
  manager:    z.string().min(1, 'Gestora obligatòria'),
  ter:        z.number().min(0, 'TER mínim 0%').max(5, 'TER màxim 5%'),
  category:   z.string().optional(),
  assetClass: z.string().optional(),
  region:     z.string().optional(),
  riskLevel:  z.number().int().min(1).max(7).optional(),
}).passthrough();

export const UpdateFundSchema = z.object({
  id: z.string().min(1, 'id obligatori'),
}).passthrough();

// ── Accions (Stocks) ───────────────────────────────────────────────────────

export const CreateStockSchema = z.object({
  symbol:          z.string().min(1, 'Symbol obligatori').transform(s => s.toUpperCase()),
  name:            z.string().min(1, 'Nom obligatori'),
  sector:          z.string().default(''),
  region:          z.string().default('Global'),
  currency:        z.string().default('EUR'),
  signal:          StockSignal.default('neutral'),
  signalNote:      z.string().default(''),
  technicalNote:   z.string().default(''),
  fundamentalNote: z.string().default(''),
  active:          z.boolean().default(true),
});

export const UpdateStockSchema = z.object({
  symbol:          z.string().min(1).transform(s => s.toUpperCase()).optional(),
  name:            z.string().min(1).optional(),
  sector:          z.string().optional(),
  region:          z.string().optional(),
  currency:        z.string().optional(),
  signal:          StockSignal.optional(),
  signalNote:      z.string().optional(),
  technicalNote:   z.string().optional(),
  fundamentalNote: z.string().optional(),
  active:          z.boolean().optional(),
});

// ── Notícies (News) ────────────────────────────────────────────────────────

export const CreateNewsSchema = z.object({
  title:       z.string().min(1, 'Títol obligatori'),
  summary:     z.string().min(1, 'Resum obligatori'),
  category:    NewsCategory,
  content:     z.string().default(''),
  source:      z.string().default('Factor OTC'),
  author:      z.string().default('Equip Factor OTC'),
  status:      NewsStatus.default('draft'),
  featured:    z.boolean().default(false),
  externalUrl: z.string().url().or(z.literal('')).default(''),
  publishedAt: z.string().optional(),
});

export const UpdateNewsSchema = z.object({
  title:       z.string().min(1).optional(),
  summary:     z.string().min(1).optional(),
  category:    NewsCategory.optional(),
  content:     z.string().optional(),
  source:      z.string().optional(),
  author:      z.string().optional(),
  status:      NewsStatus.optional(),
  featured:    z.boolean().optional(),
  externalUrl: z.string().url().or(z.literal('')).optional(),
  publishedAt: z.string().optional(),
});

// ── Backtest ───────────────────────────────────────────────────────────────

export const BacktestSchema = z.object({
  allocations: z.array(z.object({
    productId: z.string().min(1),
    isin:      z.string(),
    weight:    z.number().min(0).max(100),
  })).min(1, 'Almenys un actiu obligatori'),
  startDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  endDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  initialAmount: z.number().positive('Import inicial ha de ser positiu'),
}).refine(
  d => new Date(d.startDate) < new Date(d.endDate),
  { message: 'startDate ha de ser anterior a endDate', path: ['startDate'] }
);

// ── Portfolio Metrics ──────────────────────────────────────────────────────

export const PortfolioMetricsSchema = z.object({
  portfolio:     z.record(z.string(), z.unknown()),
  scoring:       z.record(z.string(), z.unknown()),
  questionnaire: z.record(z.string(), z.unknown()),
  options: z.object({
    includeReport:     z.boolean().optional(),
    includeMonteCarlo: z.boolean().optional(),
    numSimulations:    z.number().int().min(100).max(10000).optional(),
  }).optional(),
});
