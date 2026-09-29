'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Employee, Punch, Shift, State } from '@/lib/domain';
import { PunchTimesheet } from './punch-timesheet';
import {
  HOLIDAY_MULTIPLIER,
  OFF_TIME_COLOR,
  OT_PERIOD_HOURS,
  PAY_PERIOD_DAYS,
  holidayOn,
  weekdayOf,
  ROLE_GROUP_COLORS,
  addDays,
  groupByRole,
  payPeriodEnd,
  payPeriodStart,
  periodOpen,
  missingOut,
  shownPunch,
  roleGroup,
  roleLabel,
  roleTint,
} from '@/lib/domain';
import { useLang } from './use-lang';

// 관리자가 보는 출근 기록. 먼저 이름만 세우고, 고른 사람의 출근부를 2주 급여 기간씩 봅니다.
// 기간 경계는 직원 근무표(staff-timesheets)와 같은 payPeriod* 를 씁니다 — 두 화면이 같은 날을 같은 기간으로 셉니다.

// 건수와 시간은 퇴근까지 찍힌 근무만 셉니다. 아직 일하는 중인 근무는 시간이 0이라,
// 함께 세면 '1건 · 0.00시간' 처럼 고장난 것처럼 읽힙니다. 대신 live 로 따로 알립니다.
// 퇴근을 못 찍은 채 날이 바뀐 기록은 지금 일하는 사람이 아닙니다. live 에 함께 세면
// 그 사람이 급여 기간 내내 '근무 중'으로 박혀 있어, noOut 으로 갈라 셉니다.
// 시간은 급여가 세는 시간입니다(shownPunch) — 예정 시작 전·예정 종료 뒤는 빠집니다.
const tally = (rows: Punch[], shifts: Shift[], today: string) => {
  const done = rows.filter((p) => p.out);
  const noOut = rows.filter((p) => missingOut(p, today));
  return {
    count: done.length,
    hours: done.reduce((n, p) => n + shownPunch({ shifts }, p).hours, 0),
    live: rows.length - done.length - noOut.length,
    noOut: noOut.length,
  };
};

type RosterProps = {
  // 출근부 보기는 급여와 같은 계산(payroll)을 써서 시급·근무 기록 전부가 필요합니다.
  state: State;
  employees: Employee[];
  punches: Punch[];
  shifts: Shift[];
  today: string;
  // 표에서 고르면 그 칸의 급여 기간을 함께 넘깁니다. 카드는 언제나 지금 기간입니다.
  onPick: (employeeId: string, from?: string, id?: string) => void;
  // 급여 상세에서 건너온 줄. 출근부 보기로 그 기간을 열고 그 줄을 형광색으로 짚습니다.
  focus?: { id: string; from: string };
};

// 관리자가 고른 보기. 이 기기에서만 기억합니다 — 막혀 있어도 기본 보기로 그립니다.
const VIEW_KEY = 'pelham.punchroster.view';
const CELL_KEY = 'pelham.punchroster.cell';
const recall = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const v = window.localStorage.getItem(key);
    return allowed.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
};
const keep = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
};

// 세 보기. 출근부(급여 명세처럼 사람마다 주별 근무 줄과 합계), 표(엑셀처럼 2주를 한눈에), 카드(한 사람씩).
// 표 안에서는 칸에 출퇴근 시각을 적을지 그날 일한 시간을 적을지 고릅니다. 처음에는 출근부로 엽니다.
// 출근부와 표는 같은 급여 기간을 보고, 보기를 바꿔도 보던 기간에 머뭅니다.
export function PunchRoster(props: RosterProps) {
  const { t } = useLang();
  // 출근 기록은 데이터를 받은 뒤 브라우저에서만 그려져, 저장된 보기를 처음부터 읽어도 됩니다.
  const [view, setView] = useState(() =>
    recall(VIEW_KEY, ['ledger', 'sheet', 'cards'] as const, 'ledger'),
  );
  const [from, setFrom] = useState(() => payPeriodStart(props.today));
  const [cell, setCell] = useState(() => recall(CELL_KEY, ['clock', 'hours'] as const, 'clock'));
  // 짚을 줄이 오면 출근부와 그 기간으로 맞춥니다. 저장된 보기는 건드리지 않습니다.
  useEffect(() => {
    if (!props.focus) return;
    setView('ledger');
    setFrom(props.focus.from);
  }, [props.focus?.id, props.focus?.from]);
  const pick = <T extends string>(set: (v: T) => void, key: string) => (v: T) => {
    set(v);
    keep(key, v);
  };
  if (!props.employees.length)
    return <p className="punchroster-empty">{t('등록된 직원이 없습니다.')}</p>;
  return (
    <>
      <div className="punchroster-tools">
        <Switch
          label={t('보기')}
          value={view}
          onChange={pick<'ledger' | 'sheet' | 'cards'>(setView, VIEW_KEY)}
          options={[
            ['ledger', t('ledger::출근부')],
            ['sheet', t('sheet::표')],
            ['cards', t('카드')],
          ]}
        />
        {view === 'sheet' && (
          <Switch
            label={t('칸에 적을 것')}
            value={cell}
            onChange={pick<'clock' | 'hours'>(setCell, CELL_KEY)}
            options={[
              ['clock', t('출퇴근 시각')],
              ['hours', t('일한 시간')],
            ]}
          />
        )}
      </div>
      {view !== 'cards' && <PeriodNav from={from} today={props.today} onPeriod={setFrom} />}
      {view === 'ledger' ? (
        <PunchTimesheet
          state={props.state}
          employees={props.employees}
          from={from}
          today={props.today}
          onPick={props.onPick}
          focus={props.focus?.id}
        />
      ) : view === 'sheet' ? (
        <PunchSheet {...props} cell={cell} from={from} />
      ) : (
        <RosterCards {...props} />
      )}
    </>
  );
}

function Switch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="punchroster-switch" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </fieldset>
  );
}

// 출근부·표가 함께 쓰는 급여 기간 머리말. 아직 오지 않은 기간은 볼 것이 없어 막아 둡니다.
function PeriodNav({
  from,
  today,
  onPeriod,
}: {
  from: string;
  today: string;
  onPeriod: (from: string) => void;
}) {
  const { t, locale } = useLang();
  const span = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(date + 'T12:00:00Z'));
  return (
    <div className="punchperiod-nav punchsheet-period">
      <button
        className="punchperiod-step"
        aria-label={t('이전 급여 기간')}
        onClick={() => onPeriod(addDays(from, -PAY_PERIOD_DAYS))}
      >
        <ChevronLeft size={18} />
      </button>
      <span className="punchperiod-range">
        <b>
          {span(from)} – {span(payPeriodEnd(from))}
        </b>
        <small>{periodOpen(from, today) ? t('진행 중인 기간') : t('마감된 기간')}</small>
      </span>
      <button
        className="punchperiod-step"
        aria-label={t('다음 급여 기간')}
        disabled={from >= payPeriodStart(today)}
        onClick={() => onPeriod(addDays(from, PAY_PERIOD_DAYS))}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

const clockShort = (v: string) => {
  const h = Number(v.slice(0, 2));
  return `${h % 12 || 12}:${v.slice(3, 5)}${h < 12 ? 'a' : 'p'}`;
};

// 엑셀 출근부처럼 줄은 직원, 칸은 급여 기간 14일. 칸을 누르면 그 사람 출근부로 넘어가 고칩니다.
function PunchSheet({
  employees,
  punches,
  shifts,
  today,
  onPick,
  cell,
  from,
}: RosterProps & { cell: 'clock' | 'hours'; from: string }) {
  const { t, locale, days: weekdayNames } = useLang();
  const to = payPeriodEnd(from);
  const dates = Array.from({ length: PAY_PERIOD_DAYS }, (_, i) => addDays(from, i));
  const groups = groupByRole(
    [...employees].sort((a, b) => a.name.localeCompare(b.name, locale)),
    roleGroup,
  );
  const inPeriod = punches.filter((p) => p.date >= from && p.date <= to);

  return (
    <div className="punchsheet">
      <div className="punchsheet-scroll">
        <table className={'punchsheet-table ' + cell}>
          <thead>
            <tr>
              <th className="punchsheet-name">{t('직원')}</th>
              {dates.map((d) => {
                const holiday = holidayOn(d);
                return (
                  <th
                    key={d}
                    className={
                      (d === today ? 'today ' : '') +
                      (holiday ? 'holiday ' : '') +
                      (weekdayOf(d) === 0 || weekdayOf(d) === 6 ? 'weekend' : '')
                    }
                    title={holiday}
                  >
                    <small>{weekdayNames[weekdayOf(d)]}</small>
                    <b>{Number(d.slice(8))}</b>
                    {holiday && <em>×{HOLIDAY_MULTIPLIER}</em>}
                  </th>
                );
              })}
              <th className="punchsheet-total">{t('합계')}</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.group ?? 'other'}>
              <tr className="punchsheet-group">
                <th
                  colSpan={dates.length + 2}
                  style={{ color: g.group ? ROLE_GROUP_COLORS[g.group] : undefined }}
                >
                  <span>
                    {g.group ?? t('기타')} <small>{g.items.length}</small>
                  </span>
                </th>
              </tr>
              {g.items.map((e) => {
                const mine = inPeriod.filter((p) => p.employeeId === e.id);
                const hours = mine.reduce(
                  (n, p) => n + (p.out ? shownPunch({ shifts }, p).hours : 0),
                  0,
                );
                // 공휴일에 일한 시간은 초과근무에 세지 않습니다(급여와 같은 규칙).
                const otBase = mine.reduce(
                  (n, p) => n + (p.out && !holidayOn(p.date) ? shownPunch({ shifts }, p).hours : 0),
                  0,
                );
                return (
                  <tr key={e.id}>
                    <th className="punchsheet-name">
                      <button onClick={() => onPick(e.id, from)}>
                        <i style={{ background: e.color }} />
                        <b style={{ color: roleTint(e) }}>{e.name}</b>
                        {e.archived && <small className="punchroster-gone">{t('퇴사')}</small>}
                      </button>
                    </th>
                    {dates.map((d) => (
                      <SheetCell
                        key={d}
                        rows={mine.filter((p) => p.date === d).sort((a, b) => a.in.localeCompare(b.in))}
                        shifts={shifts}
                        today={today}
                        cell={cell}
                        className={
                          (d === today ? 'today ' : '') + (holidayOn(d) ? 'holiday' : '')
                        }
                        onOpen={() => onPick(e.id, from)}
                      />
                    ))}
                    <td className="punchsheet-total">
                      <b style={otBase > OT_PERIOD_HOURS ? { color: OFF_TIME_COLOR } : undefined}>
                        {hours ? hours.toFixed(2) : '–'}
                      </b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="punchsheet-legend">
        <span className="pending">{t('review::확인 대기')}</span>
        <span className="noout">{t('퇴근 미기록')}</span>
        <span className="live">{t('근무 중')}</span>
        <span style={{ color: OFF_TIME_COLOR }}>{t('지각·조퇴')}</span>
        <span className="holiday">{t('공휴일 ×{m}', { m: HOLIDAY_MULTIPLIER })}</span>
      </p>
    </div>
  );
}

function SheetCell({
  rows,
  shifts,
  today,
  cell,
  className,
  onOpen,
}: {
  rows: Punch[];
  shifts: Shift[];
  today: string;
  cell: 'clock' | 'hours';
  className: string;
  onOpen: () => void;
}) {
  const { t } = useLang();
  if (!rows.length) return <td className={className} aria-label={t('찍힌 기록 없음')} />;
  const shown = rows.map((p) => ({ p, s: shownPunch({ shifts }, p) }));
  // 칸의 바탕은 그날 기록 가운데 가장 손이 가야 하는 상태를 따릅니다.
  const state = rows.some((p) => missingOut(p, today))
    ? 'noout'
    : rows.some((p) => !p.out)
      ? 'live'
      : rows.some((p) => (p.status ?? 'pending') === 'pending')
        ? 'pending'
        : rows.some((p) => p.status === 'disputed')
          ? 'disputed'
          : '';
  const hours = shown.reduce((n, x) => n + x.s.hours, 0);
  return (
    <td className={className + ' ' + state}>
      <button onClick={onOpen} title={t('출근부 열기')}>
        {cell === 'hours'
          ? state === 'noout' && !hours
            ? '?'
            : state === 'live' && !hours
              ? '●'
              : hours.toFixed(2)
          : shown.map(({ p, s }) => (
              <span key={p.id} className="punchsheet-pair">
                <span style={s.late ? { color: OFF_TIME_COLOR } : undefined}>{clockShort(s.in)}</span>
                <span style={s.early ? { color: OFF_TIME_COLOR } : undefined}>
                  {s.out ? clockShort(s.out) : missingOut(p, today) ? '?' : '●'}
                </span>
              </span>
            ))}
      </button>
    </td>
  );
}

function RosterCards({ employees, punches, shifts, today, onPick }: RosterProps) {
  const { t, locale } = useLang();
  // 직원 드롭다운과 같이 Proshop · Workshop · Hybrid · 기타 로 묶고, 묶음 안은 이름순으로 세웁니다.
  const groups = groupByRole(
    [...employees].sort((a, b) => a.name.localeCompare(b.name, locale)),
    roleGroup,
  );
  const open = payPeriodStart(today);
  const openEnd = payPeriodEnd(open);
  const day = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(date + 'T12:00:00Z'));

  if (!employees.length) return <p className="punchroster-empty">{t('등록된 직원이 없습니다.')}</p>;

  return groups.map((g) => (
    <section className="punchroster-group" key={g.group ?? 'other'}>
      <h4 style={{ color: g.group ? ROLE_GROUP_COLORS[g.group] : undefined }}>
        {g.group ?? t('기타')} <small>{g.items.length}</small>
      </h4>
      <div className="punchroster">
        {g.items.map((e) => {
          const mine = punches.filter((p) => p.employeeId === e.id);
          const now = mine.filter((p) => p.date >= open && p.date <= openEnd);
          const seen = tally(now, shifts, today);
          // 가장 최근에 찍은 날. 이번 기간에 아무것도 없는 사람도 언제까지 일했는지 보입니다.
          const last = mine.reduce((v, p) => (p.date > v ? p.date : v), '');
          return (
            <button className="punchroster-card" key={e.id} onClick={() => onPick(e.id)}>
              {/* 이름은 윗칸에만 서고, 맡은 자리와 건수·표지는 아랫칸으로 내려보냅니다.
                한 줄에 모두 세우면 이름이 밀려 사라지고 글자끼리 겹쳐 읽혔습니다. */}
              <span className="punchroster-body">
                <span className="punchroster-name">
                  <i style={{ background: e.color }} />
                  <b style={{ color: roleTint(e) }}>{e.name}</b>
                  {e.archived && <small className="punchroster-gone">{t('퇴사')}</small>}
                </span>
                <span className="punchroster-meta">
                  {roleLabel(e) && <small className="punchroster-role">{roleLabel(e)}</small>}
                  <span className="punchroster-stat">
                    {seen.count
                      ? t('이번 기간 {n}건 · {h}시간', {
                          n: seen.count,
                          h: seen.hours.toFixed(2),
                        })
                      : seen.live || seen.noOut
                        ? t('아직 끝난 근무가 없습니다')
                        : last
                          ? t('마지막 기록 {date}', { date: day(last) })
                          : t('찍힌 기록 없음')}
                  </span>
                  {seen.live > 0 && <em className="punchroster-live">{t('근무 중')}</em>}
                  {seen.noOut > 0 && (
                    <em className="punchroster-flag">{t('퇴근 미기록 {n}', { n: seen.noOut })}</em>
                  )}
                </span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  ));
}

// 고른 사람의 2주 기간 머리말. 앞뒤로 옮기고, 이 기간에 몇 건 몇 시간인지 함께 셉니다.
export function PunchPeriodBar({
  employee,
  rows,
  shifts,
  from,
  today,
  onBack,
  onPeriod,
}: {
  employee?: Employee;
  rows: Punch[];
  shifts: Shift[];
  from: string;
  today: string;
  onBack: () => void;
  onPeriod: (from: string) => void;
}) {
  const { t, locale } = useLang();
  const to = payPeriodEnd(from);
  const seen = tally(rows, shifts, today);
  // 아직 오지 않은 기간은 볼 것이 없어 막아 둡니다.
  const atNow = from >= payPeriodStart(today);
  const span = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(date + 'T12:00:00Z'));

  return (
    <div className="punchperiod">
      <div className="punchperiod-top">
        <button className="punchperiod-back" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden="true" />
          {t('직원 목록')}
        </button>
        <span className="punchperiod-who">
          <i style={{ background: employee?.color }} />
          <b>{employee?.name ?? t('관리자')}</b>
          {employee && roleLabel(employee) && <small>{roleLabel(employee)}</small>}
        </span>
      </div>
      <div className="punchperiod-nav">
        <button
          className="punchperiod-step"
          aria-label={t('이전 급여 기간')}
          onClick={() => onPeriod(addDays(from, -PAY_PERIOD_DAYS))}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="punchperiod-range">
          <b>
            {span(from)} – {span(to)}
          </b>
          <small>
            {t('{n}건 · {h}시간', { n: seen.count, h: seen.hours.toFixed(2) })}
            {seen.live > 0 && ' · ' + t('근무 중 {n}', { n: seen.live })}
            {seen.noOut > 0 && ' · ' + t('퇴근 미기록 {n}', { n: seen.noOut })}
            {periodOpen(from, today) ? ' · ' + t('진행 중인 기간') : ' · ' + t('마감된 기간')}
          </small>
        </span>
        <button
          className="punchperiod-step"
          aria-label={t('다음 급여 기간')}
          disabled={atNow}
          onClick={() => onPeriod(addDays(from, PAY_PERIOD_DAYS))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
