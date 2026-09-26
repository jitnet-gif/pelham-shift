'use client';
import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import type { Employee, State } from '@/lib/domain';
import {
  HOLIDAY_MULTIPLIER,
  LOCATION,
  OFF_TIME_COLOR,
  OT_MULTIPLIER,
  OT_PERIOD_HOURS,
  addDays,
  groupByRole,
  holidayOn,
  livePunches,
  missingOut,
  paidEnd,
  paidRecords,
  paidStart,
  payPeriodEnd,
  payableHours,
  payroll,
  roleGroup,
  roleLabel,
  scheduledFor,
  shownPunch,
  ROLE_GROUP_COLORS,
} from '@/lib/domain';
import { useLang } from './use-lang';

// 급여 명세 엑셀처럼 적은 출근부. 사람마다 급여 기간 두 주를 주별로 나눠 근무를 한 줄씩 적고,
// 주 합계와 사람 합계를 붙입니다. 숫자는 급여 화면과 같은 payroll() 규칙을 따릅니다 —
// 초과근무는 급여 기간 안에서 시간 순으로 쌓아 88시간을 넘긴 근무부터 붙고, 공휴일 근무는 1.5배로 따로 셉니다.
// 지각·조퇴 차감은 Exception costs 칸에 빼는 금액으로 적어, Total pay 가 급여 화면의 예상 급여와 같습니다.
// 아직 퇴근을 찍지 않은 근무도 줄로 세우되 시간과 금액은 0 입니다(급여도 세지 않습니다).

type Line = {
  key: string;
  date: string;
  start: string;
  end?: string;
  flags: string[];
  late: boolean;
  early: boolean;
  role: string;
  regular: number;
  ot: number;
  holiday: number;
  hours: number;
  regularPay: number;
  otPay: number;
  holidayPay: number;
  exception: number;
  total: number;
  pending: boolean;
};
type Sum = Pick<
  Line,
  'regular' | 'ot' | 'holiday' | 'hours' | 'regularPay' | 'otPay' | 'holidayPay' | 'exception' | 'total'
>;
const SUM_KEYS = [
  'regular',
  'ot',
  'holiday',
  'hours',
  'regularPay',
  'otPay',
  'holidayPay',
  'exception',
  'total',
] as const;
const add = (list: Sum[]): Sum =>
  Object.fromEntries(SUM_KEYS.map((k) => [k, list.reduce((n, x) => n + x[k], 0)])) as Sum;

function sheetOf(state: State, e: Employee, from: string, today: string) {
  const to = payPeriodEnd(from);
  const pay = payroll(state, e.id, from, to);
  const cut = new Map(pay.lates.map((l) => [l.id, l]));
  const punches = livePunches(state);
  const byId = new Map(punches.map((p) => [p.id, p]));
  const records = paidRecords(state)
    .filter((a) => a.employeeId === e.id && a.date >= from && a.date <= to)
    .sort((a, b) => (a.date + paidStart(state, a)).localeCompare(b.date + paidStart(state, b)));
  let cum = 0;
  const lines: Line[] = records.map((a) => {
    const h = payableHours(state, a);
    const holiday = !!holidayOn(a.date);
    let ot = 0;
    if (!holiday) {
      ot = Math.max(0, Math.min(h, cum + h - OT_PERIOD_HOURS));
      cum += h;
    }
    const regular = holiday ? 0 : h - ot;
    const l = cut.get(a.id);
    const late = (l?.minutes ?? 0) > 0;
    const early = (l?.early ?? 0) > 0;
    const regularPay = regular * e.rate;
    const otPay = ot * e.rate * OT_MULTIPLIER;
    const holidayPay = (holiday ? h : 0) * e.rate * HOLIDAY_MULTIPLIER;
    const exception = -((l?.deduction ?? 0) + (l?.earlyDeduction ?? 0));
    const p = byId.get(a.id);
    return {
      key: a.id,
      date: a.date,
      start: paidStart(state, a),
      end: paidEnd(state, a),
      flags: [
        ...(late ? ['Late'] : []),
        ...(early ? ['Early'] : []),
        ...(holiday ? ['Holiday'] : []),
        ...(ot > 0 ? ['Overtime'] : []),
        ...(p?.status === 'disputed' ? ['Disputed'] : []),
      ],
      late,
      early,
      role: p?.area || scheduledFor(state, a)?.area || roleLabel(e),
      regular,
      ot,
      holiday: holiday ? h : 0,
      hours: h,
      regularPay,
      otPay,
      holidayPay,
      exception,
      total: regularPay + otPay + holidayPay + exception,
      pending: !!p && (p.status ?? 'pending') === 'pending',
    };
  });
  // 아직 끝나지 않은 근무. 급여에는 들지 않지만 출근부에는 보여야 합니다.
  for (const p of punches) {
    if (p.employeeId !== e.id || p.out || p.date < from || p.date > to) continue;
    const s = shownPunch(state, p);
    lines.push({
      key: p.id,
      date: p.date,
      start: s.in,
      flags: [missingOut(p, today) ? 'No check-out' : 'On now'],
      late: s.late,
      early: false,
      role: p.area || roleLabel(e),
      regular: 0,
      ot: 0,
      holiday: 0,
      hours: 0,
      regularPay: 0,
      otPay: 0,
      holidayPay: 0,
      exception: 0,
      total: 0,
      pending: false,
    });
  }
  lines.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const weeks = [0, 7].map((offset) => {
    const start = addDays(from, offset);
    const end = addDays(start, 6);
    const list = lines.filter((x) => x.date >= start && x.date <= end);
    return { n: offset / 7 + 1, start, end, lines: list, total: add(list) };
  });
  // 사람 합계의 시간과 금액은 payroll() 값을 그대로 적어 급여 화면과 센트까지 맞춥니다.
  const grand = { ...add(lines), hours: pay.hours, total: pay.total };
  return { weeks, grand, hasAny: lines.length > 0 };
}

const clock = (v: string) => {
  const h = Number(v.slice(0, 2));
  return `${h % 12 || 12}:${v.slice(3, 5)}${h < 12 ? 'AM' : 'PM'}`;
};
// 엑셀 명세처럼 끝자리 0 은 떼고 적습니다(4, 6.1, 97.75).
const num = (n: number) => String(Math.round(n * 100) / 100);
const md = (d: string) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const HEAD = [
  'Date',
  'Shift Details',
  'Shift Flags',
  'Location',
  'Role',
  'Wage',
  'Regular hours',
  'OT hours',
  'Double OT hours',
  'Holiday hours',
  'Total hours',
  'Regular pay',
  'OT pay',
  'Double OT pay',
  'Exception costs',
  'Holiday pay',
  'Total pay',
];
// 합계 줄이 채우는 뒤쪽 열. 온타리오에는 2배 초과근무가 없어 Double OT 는 늘 0 입니다.
const sumCells = (s: Sum) => [
  num(s.regular),
  num(s.ot),
  '0',
  num(s.holiday),
  num(s.hours),
  num(s.regularPay),
  num(s.otPay),
  '0',
  num(s.exception),
  num(s.holidayPay),
  num(s.total),
];

export function PunchTimesheet({
  state,
  employees,
  from,
  today,
  onPick,
  focus,
}: {
  state: State;
  employees: Employee[];
  from: string;
  today: string;
  // 줄을 누르면 그 기록의 id 도 넘겨, 그 사람 출퇴근 카드에서 바로 그 카드를 짚습니다.
  onPick: (employeeId: string, from?: string, id?: string) => void;
  // 형광색으로 짚을 줄(급여 상세에서 누른 기록). 그려지면 화면 가운데로 끌어옵니다.
  focus?: string;
}) {
  const { t, locale } = useLang();
  const focused = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    focused.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [focus, from]);
  // 퇴사한 사람은 이 기간에 기록이 있을 때만 세웁니다.
  const people = [...employees]
    .sort((a, b) => a.name.localeCompare(b.name, locale))
    .map((e) => ({ e, sheet: sheetOf(state, e, from, today) }))
    .filter((x) => !x.e.archived || x.sheet.hasAny);
  const groups = groupByRole(people, (x) => roleGroup(x.e));

  const download = () => {
    const rows: string[][] = [];
    for (const { e, sheet } of people) {
      rows.push([e.name], HEAD);
      for (const w of sheet.weeks) {
        rows.push([`Week ${w.n}: ${md(w.start)} - ${md(w.end)}`]);
        if (!w.lines.length) rows.push(['No shifts']);
        for (const x of w.lines)
          rows.push([
            md(x.date),
            clock(x.start) + ' - ' + (x.end ? clock(x.end) : ''),
            x.flags.join(', '),
            LOCATION,
            x.role,
            num(e.rate),
            ...sumCells(x),
          ]);
        rows.push(['', '', '', '', 'Weekly Total', '', ...sumCells(w.total)]);
      }
      rows.push(['', '', '', '', 'Grand Total', '', ...sumCells(sheet.grand)], []);
    }
    const csv = rows
      .map((r) => r.map((c) => (/[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet_${from}_${payPeriodEnd(from)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="timesheet">
      <div className="timesheet-tools">
        <button className="button" onClick={download}>
          <Download size={16} /> {t('CSV 다운로드')}
        </button>
      </div>
      {groups.map((g) => (
        <section key={g.group ?? 'other'}>
          <h4
            className="timesheet-group"
            style={{ color: g.group ? ROLE_GROUP_COLORS[g.group] : undefined }}
          >
            {g.group ?? t('기타')} <small>{g.items.length}</small>
          </h4>
          {g.items.map(({ e, sheet }) => (
            <div className="timesheet-scroll" key={e.id}>
              <table className="timesheet-table">
                <thead>
                  <tr className="timesheet-who">
                    <th colSpan={HEAD.length}>
                      <button onClick={() => onPick(e.id, from)} title={t('출근부 열기')}>
                        <i style={{ background: e.color }} />
                        {e.name}
                        {e.archived && <small className="punchroster-gone">{t('퇴사')}</small>}
                      </button>
                    </th>
                  </tr>
                  <tr className="timesheet-head">
                    {HEAD.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                {sheet.weeks.map((w) => (
                  <tbody key={w.n}>
                    <tr className="timesheet-week">
                      <td colSpan={HEAD.length}>
                        Week {w.n}: {md(w.start)} - {md(w.end)}
                      </td>
                    </tr>
                    {!w.lines.length && (
                      <tr>
                        <td colSpan={HEAD.length} className="timesheet-none">
                          No shifts
                        </td>
                      </tr>
                    )}
                    {w.lines.map((x) => (
                      <tr
                        key={x.key}
                        className={
                          'timesheet-line' +
                          (x.pending ? ' pending' : '') +
                          (!x.end ? ' open' : '') +
                          (holidayOn(x.date) ? ' holiday' : '') +
                          (x.key === focus ? ' focus' : '')
                        }
                        ref={x.key === focus ? focused : undefined}
                        onClick={() => onPick(e.id, from, x.key)}
                      >
                        <td>{md(x.date)}</td>
                        <td className="timesheet-shift">
                          <span style={x.late ? { color: OFF_TIME_COLOR } : undefined}>
                            {clock(x.start)}
                          </span>
                          {' - '}
                          <span style={x.early ? { color: OFF_TIME_COLOR } : undefined}>
                            {x.end ? clock(x.end) : ''}
                          </span>
                        </td>
                        <td className="timesheet-flags">{x.flags.join(', ')}</td>
                        <td>{LOCATION}</td>
                        <td>{x.role}</td>
                        <td className="n">{num(e.rate)}</td>
                        {sumCells(x).map((c, i) => (
                          <td className="n" key={i}>
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="timesheet-weekly">
                      <td colSpan={6} className="timesheet-label">Weekly Total</td>
                      {sumCells(w.total).map((c, i) => (
                        <td className="n" key={i}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                ))}
                <tfoot>
                  <tr className="timesheet-grand">
                    <td colSpan={6} className="timesheet-label">Grand Total</td>
                    {sumCells(sheet.grand).map((c, i) => (
                      <td className="n" key={i}>
                        {c}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
