import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildTemplate, parseClientWorkbook, parseNumber, parseDate } from '@/lib/clientImport';
import { isValidIsin, lookupIsin } from '@/lib/fundUniverse';

// Escriu a la primera fila lliure (la plantilla ja té validacions fins a la fila 500)
function put(ws: ExcelJS.Worksheet, values: unknown[]) {
  let r = 2;
  while (ws.getRow(r).getCell(1).value !== null && ws.getRow(r).getCell(1).value !== undefined) r++;
  values.forEach((v, i) => { ws.getRow(r).getCell(i + 1).value = v as ExcelJS.CellValue; });
}

async function filled(fill: (wb: ExcelJS.Workbook) => void): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildTemplate('Test') as unknown as ArrayBuffer);
  fill(wb);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe('isValidIsin (ISO 6166, Luhn)', () => {
  it('accepta ISIN reals', () => {
    for (const i of ['IE00B42W4L06', 'LU0625737910', 'US0378331005', 'ES0113900J37']) expect(isValidIsin(i)).toBe(true);
  });
  it('rebutja dígit de control erroni o format dolent', () => {
    expect(isValidIsin('IE00B42W4L07')).toBe(false);
    expect(isValidIsin('IE00B42W4L0')).toBe(false);
    expect(isValidIsin('1E00B42W4L06')).toBe(false);
  });
  it('reconeix els fons de l\'assessor', () => {
    expect(lookupIsin('ie00b42w4l06')?.source).toBe('advisor');
    expect(lookupIsin('US0378331005')).toBeNull();
  });
});

describe('parseNumber / parseDate', () => {
  it('format europeu i anglès', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('1,234.56')).toBe(1234.56);
    expect(parseNumber('12,5 €')).toBe(12.5);
    expect(parseNumber('2.000')).toBe(2000);
    expect(parseNumber('2.5')).toBe(2.5);
    expect(parseNumber('abc')).toBeNull();
  });
  it('dates dd/mm/aaaa, ISO i Date', () => {
    expect(parseDate('05/03/2024')).toBe('2024-03-05');
    expect(parseDate('2024-03-05')).toBe('2024-03-05');
    expect(parseDate(new Date(Date.UTC(2024, 2, 5)))).toBe('2024-03-05');
    expect(parseDate('31/02/2024')).toBeNull();
  });
});

describe('parseClientWorkbook', () => {
  it('la plantilla buida dona error "cap dada"', async () => {
    const r = await parseClientWorkbook(await buildTemplate());
    expect(r.errors[0].message).toMatch(/cap dada/);
  });

  it('llegeix dades personals, posicions i moviments vàlids', async () => {
    const buf = await filled(wb => {
      const per = wb.getWorksheet('Dades personals')!;
      per.getCell('B3').value = 48000;        // annualIncome
      per.getCell('B4').value = '2.000';      // monthlyExpenses
      put(wb.getWorksheet('Posicions')!, ['IE00B42W4L06', '', 'MyInvestor', '', 10.5, 250, 'EUR']);
      put(wb.getWorksheet('Moviments')!, ['15/01/2024', 'Compra', 'IE00B42W4L06', '', 10.5, 250, null, 0, 'MyInvestor']);
      put(wb.getWorksheet('Moviments')!, [new Date(Date.UTC(2024, 0, 10)), 'Aportació', '', '', 0, 0, 3000, 0, 'MyInvestor']);
    });
    const r = await parseClientWorkbook(buf);
    expect(r.errors).toEqual([]);
    expect(r.personal).toEqual({ annualIncome: 48000, monthlyExpenses: 2000 });
    expect(r.holdings).toHaveLength(1);
    expect(r.holdings[0]).toMatchObject({ isin: 'IE00B42W4L06', recognized: true, quantity: 10.5, avgEntryPrice: 250 });
    expect(r.holdings[0].name).toMatch(/Vanguard Global Small-Cap/);
    expect(r.transactions.map(t => t.operationType)).toEqual(['buy', 'deposit']);
    expect(r.transactions[0].totalEur).toBe(2625);   // participacions × preu
  });

  it('marca errors per fila i no importa files dolentes', async () => {
    const buf = await filled(wb => {
      put(wb.getWorksheet('Posicions')!, ['IE00B42W4L07', 'x', 'MyInvestor', '', 1, 10]);
      put(wb.getWorksheet('Posicions')!, ['LU0625737910', 'Pictet', '', '', 0, 10]);
      put(wb.getWorksheet('Moviments')!, ['2099-01-01', 'Regal', '', '', 1, 1, 1]);
    });
    const r = await parseClientWorkbook(buf);
    expect(r.holdings).toHaveLength(0);
    expect(r.transactions).toHaveLength(0);
    expect(r.errors.map(e => `${e.sheet}:${e.row}`)).toEqual(['Posicions:2', 'Posicions:3', 'Moviments:2']);
    expect(r.errors[2].message).toMatch(/data futura/);
    expect(r.errors[2].message).toMatch(/tipus/);
  });

  it('avisa d\'ISIN desconegut i de duplicats sense bloquejar', async () => {
    const buf = await filled(wb => {
      const ws = wb.getWorksheet('Posicions')!;
      put(ws, ['US0378331005', 'Apple', 'IBKR', 'Acció', 2, 150]);
      put(ws, ['US0378331005', 'Apple', 'ibkr', 'Acció', 1, 160]);
    });
    const r = await parseClientWorkbook(buf);
    expect(r.errors).toEqual([]);
    expect(r.holdings).toHaveLength(2);
    expect(r.warnings.some(w => /no és al catàleg/.test(w.message))).toBe(true);
    expect(r.warnings.some(w => /ja surt a la fila 2/.test(w.message))).toBe(true);
  });

  it('un fitxer que no és Excel dona error clar', async () => {
    const r = await parseClientWorkbook(Buffer.from('hola'));
    expect(r.errors[0].message).toMatch(/no és un fitxer Excel/i);
  });
});

describe('regressions de revisió', () => {
  it('rebutja dates ISO impossibles', () => {
    expect(parseDate('2024-02-31')).toBeNull();
    expect(parseDate('2024-02-29')).toBe('2024-02-29');
  });

  it('una cel·la numèrica plena però no vàlida és error, no zero', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await buildTemplate() as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Moviments')!;
    ['15/01/2024', 'Compra', 'IE00B42W4L06', '', 10, 250, null, '10 euros', 'MyInvestor']
      .forEach((v, i) => { ws.getRow(2).getCell(i + 1).value = v as ExcelJS.CellValue; });
    const r = await parseClientWorkbook((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(r.transactions).toHaveLength(0);
    expect(r.errors[0].message).toMatch(/comissió "10 euros" no és un número/);
  });
});

describe('plantilla v2: pressupost, situació laboral i objectius', () => {
  const NEW_ISINS = ['LU0996182563', 'IE0008248803', 'LU0389811885', 'LU0996177134', 'IE00B03HCZ61', 'IE00B42W3S00', 'IE00BQQP9G91'];

  it('els 7 fons indexats nous tenen ISIN vàlid i es reconeixen com a fons de l\'assessor', () => {
    for (const i of NEW_ISINS) {
      expect(isValidIsin(i)).toBe(true);
      expect(lookupIsin(i)?.source).toBe('advisor');
    }
  });

  it('llegeix pressupost, desplegables i objectius', async () => {
    const buf = await filled(wb => {
      const per = wb.getWorksheet('Dades personals')!;
      const set = (key: string, v: unknown) => per.eachRow(row => { if (row.getCell(3).value === key) row.getCell(2).value = v as ExcelJS.CellValue; });
      set('monthlyNetIncome', 1500);
      set('monthlyFixedExpenses', '600');
      set('monthlyVariableExpenses', 400);
      set('employmentType', 'autònom');
      set('selfKnowledge', 'Bàsic');
      const g = wb.getWorksheet('Objectius')!;
      g.getCell('B2').value = 'Fons d\'emergència';
      g.getCell('C2').value = 10000;
      g.getCell('B3').value = 'Entrada d\'un pis';
      g.getCell('D3').value = new Date().getUTCFullYear() + 4;
    });
    const r = await parseClientWorkbook(buf);
    expect(r.errors).toEqual([]);
    expect(r.personal).toMatchObject({
      monthlyNetIncome: 1500, monthlyFixedExpenses: 600, monthlyVariableExpenses: 400,
      employmentType: 'autonom', selfKnowledge: 'basic',
    });
    expect(r.goals).toEqual([
      { horizon: 'curt', description: 'Fons d\'emergència', amount: 10000, targetYear: undefined },
      { horizon: 'mitja', description: 'Entrada d\'un pis', amount: undefined, targetYear: new Date().getUTCFullYear() + 4 },
    ]);
  });

  it('opció de desplegable desconeguda i objectiu sense descripció són errors', async () => {
    const buf = await filled(wb => {
      const per = wb.getWorksheet('Dades personals')!;
      per.eachRow(row => { if (row.getCell(3).value === 'employmentType') row.getCell(2).value = 'Funcionari'; });
      wb.getWorksheet('Objectius')!.getCell('C4').value = 5000;
    });
    const r = await parseClientWorkbook(buf);
    expect(r.errors.map(e => e.sheet)).toEqual(['Dades personals', 'Objectius']);
    expect(r.errors[0].message).toMatch(/tria una opció/);
    expect(r.errors[1].message).toMatch(/falta descriure/);
  });

  it('una plantilla v1 (sense pestanya Objectius) continua funcionant', async () => {
    const buf = await filled(wb => {
      wb.removeWorksheet(wb.getWorksheet('Objectius')!.id);
      wb.getWorksheet('Dades personals')!.getCell('B3').value = 30000;
    });
    const r = await parseClientWorkbook(buf);
    expect(r.errors).toEqual([]);
    expect(r.goals).toEqual([]);
    expect(r.personal).toEqual({ annualIncome: 30000 });
  });
});
