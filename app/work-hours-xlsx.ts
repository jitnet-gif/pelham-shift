import type * as ExcelJS from 'exceljs';
import { HOLIDAY_PREMIUM, LONG_HOURS, managerTotalFormula, type WorkHoursData } from './payroll-hours';

// 급여 탭의 'Work hours' 표를 원래 쓰던 엑셀 시트와 같은 모양의 .xlsx 로 만듭니다.
// 숫자는 화면 표와 같은 workHoursData() 에서 옵니다. 합계 칸은 SUM 수식이라, 엑셀에서 고쳐도 합이 따라옵니다.
// exceljs 는 무거워 이 파일과 함께 버튼을 누를 때만 불러옵니다.

const MONEY = '"$"#,##0.00';
const HOURS = '0.00';
const BLACK = { argb: 'FF000000' };
const BLUE = { argb: 'FF0000FF' };
const RED = { argb: 'FFFF0000' };
const thin = { style: 'thin', color: BLACK } as const;
const medium = { style: 'medium', color: BLACK } as const;
const fill = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
});
const YELLOW = fill('FFFFFF00');
const GREY = fill('FFEEEEEE');
const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export async function workHoursXlsx(data: WorkHoursData): Promise<Blob> {
  // 브라우저용 exceljs 는 CommonJS 묶음이라, 불러온 모양이 번들러마다 default 안팎으로 갈립니다.
  const mod = (await import('exceljs')) as unknown as {
    Workbook?: typeof ExcelJS.Workbook;
    default?: { Workbook: typeof ExcelJS.Workbook };
  };
  const Workbook = mod.Workbook ?? mod.default!.Workbook;
  const book = new Workbook();
  book.creator = 'Pelham Shift';
  book.created = new Date();
  const sheet = book.addWorksheet('Work hours', {
    properties: { defaultRowHeight: 16 },
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [24, 12, 11, 15, 13, 14, 15].map((width) => ({ width }));
  const base: Partial<ExcelJS.Font> = { name: 'Arial', size: 10 };

  let r = 0;
  const next = () => ++r;
  const cell = (col: string, row: number) => sheet.getCell(col + row);
  const put = (
    col: string,
    row: number,
    value: ExcelJS.CellValue,
    style: {
      font?: Partial<ExcelJS.Font>;
      fmt?: string;
      align?: Partial<ExcelJS.Alignment>;
      fill?: ExcelJS.Fill;
    } = {},
  ) => {
    const c = cell(col, row);
    c.value = value;
    c.font = { ...base, ...style.font };
    if (style.fmt) c.numFmt = style.fmt;
    if (style.align) c.alignment = style.align;
    if (style.fill) c.fill = style.fill;
    return c;
  };
  const center: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
  const right: Partial<ExcelJS.Alignment> = { horizontal: 'right', vertical: 'middle' };
  // 표 안의 칸은 모두 가는 검은 선으로 둘러 엑셀 원본의 격자를 따릅니다.
  const grid = (row: number, cols = COLS) => {
    for (const col of cols)
      cell(col, row).border = { top: thin, left: thin, bottom: thin, right: thin };
  };
  const sum = (col: string, from: number, to: number, result: number): ExcelJS.CellValue => ({
    formula: `SUM(${col}${from}:${col}${to})`,
    result,
  });
  const cents = (n: number) => Math.round(n * 100) / 100;

  const title = next();
  put('A', title, 'Work hours', { font: { bold: true, size: 14 } });
  sheet.getRow(title).height = 22;
  next();

  const wageTotals: string[] = [];
  const holidayTotals: string[] = [];
  let wageTotal = 0;
  let holidayTotal = 0;
  data.departments.forEach((d, i) => {
    // 첫 부서 머리만 노랗게 칠합니다. 엑셀 원본이 그렇습니다.
    const y = i === 0 ? YELLOW : undefined;
    const head = next();
    sheet.mergeCells(`A${head}:C${head}`);
    put('A', head, '* ' + d.title, { font: { bold: true, size: 11 }, fill: y });

    const h1 = next();
    const h2 = next();
    sheet.mergeCells(`A${h1}:A${h2}`);
    sheet.mergeCells(`B${h1}:C${h1}`);
    sheet.mergeCells(`D${h1}:E${h1}`);
    sheet.mergeCells(`F${h1}:F${h2}`);
    sheet.mergeCells(`G${h1}:G${h2}`);
    put('A', h1, 'Name', { align: center, fill: y });
    put('B', h1, 'Hourly rate', { align: center, fill: y });
    put('D', h1, data.period, { font: { bold: true, color: BLUE, size: 11 }, align: center });
    put('F', h1, `Work hrs on\n${data.holiday}\n(${HOLIDAY_PREMIUM}X pay rate)`, {
      font: { bold: true, color: BLUE, size: 9 },
      align: { ...center, wrapText: true },
    });
    put('G', h1, 'Holiday Pay Total', { align: { ...center, wrapText: true } });
    put('B', h2, 'Beginning', { align: center, fill: y });
    put('C', h2, 'Raised', { align: center, fill: y });
    put('D', h2, 'Regular Hours', { align: { ...center, shrinkToFit: true } });
    put('E', h2, 'Wage', { align: center });
    // 노란 칠은 병합된 칸 전체에 들어가도록 가려진 칸에도 줍니다.
    if (y) for (const a of [`C${h1}`, `A${h2}`, `B${head}`, `C${head}`]) sheet.getCell(a).fill = y;
    sheet.getRow(h1).height = 20;
    sheet.getRow(h2).height = 20;
    grid(h1);
    grid(h2);

    const first = r + 1;
    for (const w of d.rows) {
      const row = next();
      const worked = w.hours > 0 || w.wage !== 0;
      const hol = w.holidayHours > 0;
      put('A', row, w.name, { align: center });
      put('B', row, w.beginning, { fmt: MONEY, align: right });
      put('C', row, w.raised ?? null, {
        fmt: MONEY,
        align: right,
        font: { bold: true, color: RED },
      });
      // 일하지 않은 칸은 엑셀처럼 비워 두고 회색으로 칠합니다.
      put('D', row, w.hours ? cents(w.hours) : null, {
        fmt: HOURS,
        align: right,
        fill: worked ? undefined : GREY,
        font: w.hours > LONG_HOURS ? { bold: true, color: RED } : undefined,
      });
      put('E', row, worked ? w.wage : null, {
        fmt: MONEY,
        align: right,
        fill: worked ? undefined : GREY,
      });
      put('F', row, hol ? cents(w.holidayHours) : null, {
        fmt: HOURS,
        align: right,
        fill: hol ? undefined : GREY,
      });
      put('G', row, hol ? w.holidayPay : null, {
        fmt: MONEY,
        align: right,
        fill: hol ? undefined : GREY,
      });
      grid(row);
    }
    const last = r;
    const total = next();
    const wages = cents(d.rows.reduce((n, w) => n + w.wage, 0));
    const holidays = cents(d.rows.reduce((n, w) => n + w.holidayPay, 0));
    wageTotal = cents(wageTotal + wages);
    holidayTotal = cents(holidayTotal + holidays);
    put('D', total, 'Total', { font: { bold: true }, align: center });
    put('E', total, sum('E', first, last, wages), { fmt: MONEY, font: { bold: true }, align: right });
    put('F', total, 'Total', { font: { bold: true }, align: center });
    put('G', total, sum('G', first, last, holidays), {
      fmt: MONEY,
      font: { bold: true },
      align: right,
    });
    grid(total);
    wageTotals.push('E' + total);
    holidayTotals.push('G' + total);
    next();
  });

  const salaryTotal = cents(data.managers.reduce((n, m) => n + (m.revised ?? m.salary), 0));
  const managementPay = cents(salaryTotal * data.periods);
  const sTotal = next();
  const gTotal = next();
  // 관리직 합계 칸은 아래에 놓입니다. G. Total 수식이 그 칸을 미리 가리킵니다.
  const mStart = gTotal + 2;
  const mTotal = mStart + 2 + data.managers.length;

  sheet.mergeCells(`A${sTotal}:C${sTotal}`);
  put('A', sTotal, 'S. Total:', { font: { bold: true }, align: right });
  put(
    'E',
    sTotal,
    { formula: wageTotals.join('+') || '0', result: wageTotal },
    { fmt: MONEY, font: { color: BLUE }, align: right },
  );
  put(
    'G',
    sTotal,
    { formula: holidayTotals.join('+') || '0', result: holidayTotal },
    { fmt: MONEY, font: { color: BLUE }, align: right },
  );
  for (const col of COLS) cell(col, sTotal).border = { top: medium };

  sheet.mergeCells(`A${gTotal}:C${gTotal}`);
  put('A', gTotal, 'G. Total  (Incl. managing dept.):', { font: { bold: true }, align: right });
  // 관리직 급여는 언제나 G. Total 에 들어갑니다. 고른 날짜가 2주 기간 여러 개면 그 수만큼 곱합니다.
  const withManagers = data.managers.length > 0;
  put(
    'E',
    gTotal,
    {
      formula:
        `E${sTotal}+G${sTotal}` +
        (withManagers ? `+B${mTotal}${data.periods > 1 ? '*' + data.periods : ''}` : ''),
      result: cents(wageTotal + holidayTotal + (withManagers ? managementPay : 0)),
    },
    { fmt: MONEY, font: { bold: true, color: RED }, align: right },
  );

  if (data.managers.length) {
    r = gTotal + 1;
    const head = next();
    sheet.mergeCells(`A${head}:C${head}`);
    put('A', head, '* Management (Bi-weekly pay)', { font: { bold: true, size: 11 } });
    const mh = next();
    put('A', mh, 'Name', { align: center });
    put('B', mh, 'Rate (Bi-weekly)', { align: center });
    put('C', mh, 'Revised', { align: center });
    grid(mh, ['A', 'B', 'C']);
    // Revised 가 있으면 그 금액을 셉니다. 엑셀에서 Revised 칸을 고치거나 비워도 합계가 따라오게 IF 수식으로 둡니다.
    const parts: { rate: string; revised: string }[] = [];
    for (const m of data.managers) {
      const row = next();
      put('A', row, m.name, { align: center });
      put('B', row, m.salary, { fmt: MONEY, align: right });
      put('C', row, m.revised ?? null, { fmt: MONEY, align: right });
      grid(row, ['A', 'B', 'C']);
      parts.push({ rate: 'B' + row, revised: 'C' + row });
    }
    const total = next();
    put('A', total, 'Total', { font: { bold: true }, align: center });
    put('B', total, { formula: managerTotalFormula(parts), result: salaryTotal }, {
      fmt: MONEY,
      font: { bold: true },
      align: right,
    });
    put('C', total, null);
    grid(total, ['A', 'B', 'C']);
  }

  const buffer = await book.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
