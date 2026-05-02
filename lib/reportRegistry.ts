// lib/reportRegistry.ts
// Registre en memòria d'informes generats. En producció substituir per MongoDB/Postgres.

export interface ReportRecord {
  id:            string;
  clientName:    string;
  clientEmail:   string;
  profile:       string;
  score:         number;
  monthlyAmount: number;
  investable:    number;
  horizon:       number;
  portfolio:     string[];
  pdfGenerated:  boolean;
  emailSent:     boolean;
  date:          string;
  createdAt:     string;
}

// Registre persistent en memòria del procés (sobreviu entre requests en el mateix worker)
const registry: ReportRecord[] = [];

export function saveReport(report: Omit<ReportRecord, 'id' | 'createdAt'>): ReportRecord {
  const rec: ReportRecord = {
    ...report,
    id: `RA-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };
  registry.unshift(rec); // més recent primer
  if (registry.length > 500) registry.pop(); // límit de memòria
  return rec;
}

export function getReports(): ReportRecord[] {
  return [...registry];
}

export function getReportById(id: string): ReportRecord | undefined {
  return registry.find(r => r.id === id);
}
