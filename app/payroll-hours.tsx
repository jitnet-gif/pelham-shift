'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import type { Employee, State } from '@/lib/domain';
import {
  PAY_PERIOD_DAYS,
  addDays,
  holidayOn,
  payPeriodStart,
  payroll,
} from '@/lib/domain';
import { useLang } from './use-lang';
import './payroll-hours.css';

// 급여를 넘길 때 쓰던 엑셀 'Work hours' 시트를 그대로 옮긴 표입니다. 숫자는 모두 payroll() 에서 옵니다.
// 엑셀은 공휴일에 일한 시간도 Regular Hours 에 넣어 1배로 치고, 가산분 0.5배만 Holiday Pay 로 따로 적습니다.
// 그래서 Wage = 예상 급여 − 공휴일 가산분, Holiday Pay = 공휴일 시간 × 시급 × 0.5 로 나눕니다 — 둘을 더하면 예상 급여와 센트까지 같습니다.
// 2주 급여(salary)가 적힌 사람은 시급 명단에서 빠지고 아래 Management 에 섭니다.
// 모양도 엑셀을 따릅니다 — 7칸 한 장의 격자에 옅은 눈금선, 표마다 검은 테두리, 첫 부서 머리의 노란 칠까지.

export const HOLIDAY_PREMIUM = 0.5;
const cents = (n: number) => Math.round(n * 100) / 100;
const days = (from: string, to: string) =>
  Math.round(
    (Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) /
      86400000,
  ) + 1;

// 엑셀의 부서. 직군 이름(role)으로 가르고, 여기 없는 직군은 제 이름으로 뒤에 붙습니다.
// 직군 이름 자체는 바꾸지 않습니다 — Proshop·Workshop 은 Hybrid 판정과 근무 제한이 이름으로 봅니다.
const DEPARTMENTS = [
  {
    title: 'Maintenance (Landscape Gardeners)',
    areas: ['workshop', 'maintenance'],
  },
  {
    title: 'Admin & Proshop (Inc. Golf Simulators)',
    areas: ['proshop', 'admin', 'golf simulator'],
  },
  {
    title: 'F&B (Pub & Snackbar)',
    areas: ['f&b', 'pub', 'snackbar', 'snack bar'],
  },
];
// 2주에 80시간을 넘긴 시간은 엑셀처럼 빨갛게 적어 눈에 띄게 합니다.
export const LONG_HOURS = 80;

export type WorkHoursRow = {
  id: string;
  name: string;
  beginning: number;
  raised?: number;
  hours: number;
  otHours: number;
  wage: number;
  holidayHours: number;
  holidayPay: number;
  // 관리자가 이 기간의 시간·금액을 손으로 적은 줄. hours·wage 가 출퇴근 대신 그 값입니다.
  manual?: { hours: number; wage?: number };
};
export type WorkHoursData = {
  period: string;
  holiday: string;
  departments: { title: string; rows: WorkHoursRow[] }[];
  managers: { id: string; name: string; salary: number }[];
  // 관리직 급여를 G. Total 에 넣을 급여 기간 수. 고른 날짜가 2주 단위가 아니면 0 입니다.
  periods: number;
};

// 엑셀 머리글 표기를 따릅니다: "Sep 06- Sept 19, 2026", "Sept 7".
const month = (date: string, long: boolean) => {
  const m = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(date + 'T12:00:00Z'));
  return long && m === 'Sep' ? 'Sept' : m;
};
const day = (date: string, pad: boolean) =>
  pad ? date.slice(8) : String(+date.slice(8));

export function workHoursData(
  state: State,
  from: string,
  to: string,
): WorkHoursData {
  const holidays: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1))
    if (holidayOn(d)) holidays.push(d);
  const rowOf = (e: Employee): WorkHoursRow => {
    const pay = payroll(state, e.id, from, to);
    const holidayPay = cents(pay.holidayHours * e.rate * HOLIDAY_PREMIUM);
    const raised = e.startRate !== undefined && e.startRate !== e.rate;
    // 손으로 적은 시간이 있으면 Regular Hours·Wage 는 그 값입니다. 공휴일 가산분은 출퇴근 기록 그대로 둡니다.
    const hand = (state.payHours ?? []).find(
      (x) => x.employeeId === e.id && x.from === from && x.to === to,
    );
    return {
      id: e.id,
      name: e.name,
      beginning: raised ? e.startRate! : e.rate,
      raised: raised ? e.rate : undefined,
      hours: hand ? hand.hours : pay.hours,
      otHours: hand ? 0 : pay.otHours,
      wage: hand ? (hand.wage ?? cents(hand.hours * e.rate)) : cents(pay.total - holidayPay),
      holidayHours: pay.holidayHours,
      holidayPay,
      ...(hand ? { manual: { hours: hand.hours, wage: hand.wage } } : {}),
    };
  };
  // 퇴사한 사람은 이 기간에 근무가 있을 때만 세웁니다. 순서는 직원을 등록한 순서입니다.
  const hourly = state.employees
    .filter((e) => !e.salary)
    .map((e) => ({ e, row: rowOf(e) }))
    .filter((x) => !x.e.archived || x.row.hours > 0 || !!x.row.manual);
  const deptOf = (role: string) =>
    DEPARTMENTS.find((d) => d.areas.includes(role.trim().toLowerCase()))
      ?.title ??
    (role || 'Other');
  const titles = [
    ...DEPARTMENTS.map((d) => d.title),
    ...new Set(hourly.map((x) => deptOf(x.e.role))),
  ];
  const departments = [...new Set(titles)]
    .map((title) => ({
      title,
      rows: hourly.filter((x) => deptOf(x.e.role) === title).map((x) => x.row),
    }))
    .filter((d) => d.rows.length);
  const whole =
    payPeriodStart(from) === from &&
    payPeriodStart(addDays(to, 1)) === addDays(to, 1);
  return {
    period: `${month(from, false)} ${day(from, true)}- ${month(to, true)} ${day(to, false)}, ${to.slice(0, 4)}`,
    holiday: holidays.length
      ? `${holidays.map((d) => `${month(d, true)} ${day(d, false)}`).join(', ')} (Holiday)`
      : 'Holiday',
    departments,
    managers: state.employees
      .filter((e) => e.salary && !e.archived)
      .map((e) => ({ id: e.id, name: e.name, salary: e.salary ?? 0 })),
    periods: whole ? days(from, to) / PAY_PERIOD_DAYS : 0,
  };
}

// 손으로 고친 값. hours 를 비우면('') 손으로 적은 것을 지우고 출퇴근 기록으로 돌아갑니다. wage 를 비우면 시간 × 시급입니다.
export type WorkHoursEdit = { employeeId: string; hours: string; wage: string };

export function PayrollHours({
  state,
  from,
  to,
  onOpen,
  onEdit,
}: {
  state: State;
  from: string;
  to: string;
  onOpen?: (id: string) => void;
  onEdit?: (edit: WorkHoursEdit) => void;
}) {
  return (
    <WorkHoursSheet
      data={workHoursData(state, from, to)}
      currency={state.currency}
      onOpen={onOpen}
      onEdit={onEdit}
    />
  );
}

// 엑셀 칸처럼 누르면 그 자리에서 고칩니다. Enter·칸 밖을 누르면 저장, Esc 는 그만둡니다.
// 줄을 누르면 날짜별 상세가 열리므로, 이 칸을 누른 것은 줄까지 올라가지 않게 막습니다.
function EditCell({
  shown,
  value,
  label,
  onSave,
}: {
  shown: ReactNode;
  value: string;
  label: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const closed = useRef(false);
  const editing = draft !== null;
  useEffect(() => {
    if (editing) {
      closed.current = false;
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  if (draft === null)
    return (
      <button
        type="button"
        className="wh-edit"
        title={label}
        onClick={(e) => {
          stop(e);
          setDraft(value);
        }}
        onKeyDown={stop}
      >
        {/* 빈 칸도 누를 수 있다는 것이 보이게 연필을 그립니다. 출퇴근이 없는 사람의 회색 칸이 그렇습니다. */}
        {shown || <Pencil size={12} className="wh-pencil" aria-hidden />}
      </button>
    );
  // Enter 로 닫으면 칸이 사라지며 blur 가 한 번 더 올 수 있습니다. 같은 값을 두 번 보내 버전이 엇갈리지 않게 한 번만 저장합니다.
  const done = () => {
    if (closed.current) return;
    closed.current = true;
    const next = (draft ?? '').trim();
    setDraft(null);
    if (next !== value) onSave(next);
  };
  return (
    <input
      className="wh-input"
      type="number"
      min={0}
      step="0.01"
      inputMode="decimal"
      ref={input}
      aria-label={label}
      value={draft}
      onClick={stop}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={done}
      onKeyDown={(e) => {
        stop(e);
        if (e.key === 'Enter') done();
        if (e.key === 'Escape') {
          closed.current = true;
          setDraft(null);
        }
      }}
    />
  );
}

// 칸 하나. 엑셀처럼 오른쪽·아래 선은 그 칸이 긋습니다 — 이웃 칸과 선이 겹쳐 색이 뒤섞이지 않게.
type Cell = {
  text?: ReactNode;
  span?: number;
  rows?: number;
  cls?: string;
  title?: string;
};
const C = (text?: ReactNode, cls = '', more: Partial<Cell> = {}): Cell => ({
  text,
  cls,
  ...more,
});
const blank = (n: number, cls = '') =>
  Array.from({ length: n }, () => C('', cls));

export function WorkHoursSheet({
  data,
  currency,
  onOpen,
  onEdit,
}: {
  data: WorkHoursData;
  currency: string;
  // 직원 줄을 누르면 요약 보기처럼 그 직원의 날짜별 상세를 엽니다.
  onOpen?: (id: string) => void;
  // 있으면 Regular Hours·Wage 칸을 그 자리에서 고칩니다. 엑셀로 내릴 때는 넘기지 않습니다.
  onEdit?: (edit: WorkHoursEdit) => void;
}) {
  const { t } = useLang();
  const money = (n: number) =>
    new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(n);
  const sum = (rows: WorkHoursRow[], key: 'wage' | 'holidayPay') =>
    cents(rows.reduce((n, r) => n + r[key], 0));
  const all = data.departments.flatMap((d) => d.rows);
  const wageTotal = sum(all, 'wage');
  const holidayTotal = sum(all, 'holidayPay');
  const salaryTotal = cents(data.managers.reduce((n, m) => n + m.salary, 0));
  const managementPay = cents(salaryTotal * data.periods);
  const grandTotal = cents(wageTotal + holidayTotal + managementPay);

  const rows: { key: string; cells: Cell[]; open?: string }[] = [];
  const push = (key: string, cells: Cell[], open?: string) =>
    rows.push({ key, cells, open });
  push('title', [C('Work hours', 'wh-title', { span: 3 }), ...blank(4)]);
  push('gap', blank(7));
  data.departments.forEach((d, i) => {
    // 첫 부서 머리만 노랗게 칠합니다. 엑셀 원본이 그렇습니다.
    const y = i === 0 ? ' wh-yellow' : '';
    push(d.title, [
      C('* ' + d.title, 'wh-dept wh-bb' + y, { span: 3 }),
      ...blank(4, 'wh-bb'),
    ]);
    push(d.title + '-h1', [
      C('Name', 'wh-bl wh-br wh-bb' + y, { rows: 2 }),
      C('Hourly rate', 'wh-br wh-nb' + y, { span: 2 }),
      C(data.period, 'wh-blue wh-br', { span: 2 }),
      C(
        <div className="wh-stack">
          <span>Work hrs on</span>
          <span>{data.holiday}</span>
          <span>({HOLIDAY_PREMIUM}X pay rate)</span>
        </div>,
        'wh-blue wh-hol wh-br wh-bb',
        { rows: 2 },
      ),
      C(<div className="wh-clip">Holiday Pay Total</div>, 'wh-br wh-bb', {
        rows: 2,
      }),
    ]);
    push(d.title + '-h2', [
      C('Beginning', 'wh-center wh-br wh-bb' + y),
      C('Raised', 'wh-center wh-br wh-bb' + y),
      C(<div className="wh-clip">Regular Hours</div>, 'wh-bb'),
      C('Wage', 'wh-center wh-br wh-bb'),
    ]);
    d.rows.forEach((r, j) => {
      const next = d.rows[j + 1];
      const last = !next;
      const worked = r.hours > 0 || r.wage !== 0;
      const hol = r.holidayHours > 0;
      const nWorked = !!next && (next.hours > 0 || next.wage !== 0);
      const nHol = !!next && next.holidayHours > 0;
      // 회색 칸끼리는 엑셀 채우기처럼 눈금선 없이 이어지고, 흰 칸과 만나는 자리에만 선을 긋습니다.
      const edge = (grey: boolean, nextGrey: boolean) =>
        last ? ' wh-bb' : grey && nextGrey ? ' wh-gb' : '';
      const bb = last ? ' wh-bb' : '';
      const hand = r.manual ? ' wh-manual' : '';
      const hoursText = r.hours ? r.hours.toFixed(2) : '';
      const wageText = worked ? money(r.wage) : '';
      // 시간 칸을 고치면 적어 둔 금액은 그대로, 금액 칸을 고치면 지금 보이는 시간을 함께 적습니다.
      const hoursCell = onEdit ? (
        <EditCell
          shown={hoursText}
          value={r.manual ? String(r.manual.hours) : ''}
          label={t('이 기간 시간을 직접 적습니다. 비우면 출퇴근 기록으로 돌아갑니다.')}
          onSave={(v) =>
            onEdit({
              employeeId: r.id,
              hours: v,
              wage: r.manual?.wage !== undefined ? String(r.manual.wage) : '',
            })
          }
        />
      ) : (
        hoursText
      );
      const wageCell = onEdit ? (
        <EditCell
          shown={wageText}
          value={r.manual?.wage !== undefined ? String(r.manual.wage) : ''}
          label={t('이 기간 금액을 직접 적습니다. 비우면 시간 × 시급입니다.')}
          onSave={(v) =>
            onEdit({
              employeeId: r.id,
              hours: r.manual ? String(r.manual.hours) : v ? String(r.hours) : '',
              wage: v,
            })
          }
        />
      ) : (
        wageText
      );
      push(r.id, [
        C(r.name, 'wh-center wh-bl wh-br' + bb),
        C(money(r.beginning), 'wh-num wh-br' + bb),
        C(
          r.raised !== undefined ? money(r.raised) : '',
          'wh-num wh-red wh-bold wh-br' + bb,
        ),
        C(
          hoursCell,
          'wh-num wh-hours' +
            hand +
            (worked ? '' : ' wh-grey wh-gr') +
            (r.hours > LONG_HOURS ? ' wh-red wh-bold' : '') +
            edge(!worked, !nWorked),
          {
            title: r.manual
              ? t('직접 적은 값입니다.')
              : r.otHours
              ? t('초과근무 {h}시간이 들어 있습니다 (1.5배).', {
                  h: r.otHours.toFixed(2),
                })
              : undefined,
          },
        ),
        C(
          wageCell,
          'wh-num wh-br' + hand + (worked ? '' : ' wh-grey') + edge(!worked, !nWorked),
          r.manual ? { title: t('직접 적은 값입니다.') } : {},
        ),
        C(
          hol ? r.holidayHours.toFixed(2) : '',
          'wh-num wh-hours wh-br' + (hol ? '' : ' wh-grey') + edge(!hol, !nHol),
        ),
        C(
          hol ? money(r.holidayPay) : '',
          'wh-num wh-br' + (hol ? '' : ' wh-grey') + edge(!hol, !nHol),
        ),
      ], r.id);
    });
    push(d.title + '-total', [
      C('', 'wh-bl wh-br wh-bb'),
      C('', 'wh-br wh-bb'),
      C('', 'wh-br wh-bb'),
      C('Total', 'wh-center wh-bold wh-bb'),
      C(money(sum(d.rows, 'wage')), 'wh-num wh-bold wh-br wh-bb'),
      C('Total', 'wh-center wh-bold wh-br wh-bb'),
      C(money(sum(d.rows, 'holidayPay')), 'wh-num wh-bold wh-br wh-bb'),
    ]);
    push(d.title + '-gap', blank(7));
  });
  push('stotal', [
    C('S. Total:', 'wh-num wh-bold wh-label wh-thick', { span: 3 }),
    C('', 'wh-thick'),
    C(money(wageTotal), 'wh-num wh-blue wh-thick'),
    C('', 'wh-thick'),
    C(money(holidayTotal), 'wh-num wh-blue wh-thick'),
  ]);
  push('gtotal', [
    C('G. Total  (Incl. managing dept.):', 'wh-num wh-bold wh-label', {
      span: 3,
    }),
    C(),
    C(money(grandTotal), 'wh-num wh-red wh-bold'),
    ...blank(2),
  ]);
  if (data.managers.length) {
    push('m-gap', blank(7));
    push('m-title', [
      C('* Management (Bi-weekly pay)', 'wh-dept wh-bb', { span: 3 }),
      ...blank(4),
    ]);
    push('m-head', [
      C('Name', 'wh-center wh-bl'),
      C('Rate (Bi-weekly)', 'wh-center'),
      C('Revised', 'wh-center wh-br'),
      ...blank(4),
    ]);
    for (const m of data.managers)
      push('m-' + m.id, [
        C(m.name, 'wh-center wh-bl'),
        C(money(m.salary), 'wh-num'),
        C('', 'wh-br'),
        ...blank(4),
      ]);
    push('m-total', [
      C('Total', 'wh-center wh-bold wh-bl wh-bb'),
      C(money(salaryTotal), 'wh-num wh-bold wh-bb'),
      C('', 'wh-br wh-bb'),
      ...blank(4),
    ]);
  }

  return (
    <div className="workhours">
      <table>
        <colgroup>
          {[160, 95, 85, 108, 100, 97, 102].map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              {...(onOpen && r.open
                ? {
                    className: 'wh-link',
                    role: 'button',
                    tabIndex: 0,
                    title: t('날짜별 상세 보기'),
                    onClick: () => onOpen(r.open!),
                    onKeyDown: (event: KeyboardEvent) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpen(r.open!);
                      }
                    },
                  }
                : {})}
            >
              {r.cells.map((c, i) => (
                <td
                  key={i}
                  className={c.cls || undefined}
                  colSpan={c.span}
                  rowSpan={c.rows}
                  title={c.title}
                >
                  {c.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.managers.length > 0 && data.periods === 0 && (
        <p className="hint">
          {t(
            '고른 기간이 급여 기간(2주) 단위가 아니어서 관리직 급여는 G. Total 에 넣지 않았습니다.',
          )}
        </p>
      )}
      {data.managers.length > 0 && data.periods > 1 && (
        <p className="hint">
          {t(
            '관리직 급여는 급여 기간 {n}번 몫({amount})을 G. Total 에 넣었습니다.',
            {
              n: data.periods,
              amount: money(managementPay),
            },
          )}
        </p>
      )}
    </div>
  );
}
