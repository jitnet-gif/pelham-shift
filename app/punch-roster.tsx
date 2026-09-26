'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Employee, Punch, Shift } from '@/lib/domain';
import {
  PAY_PERIOD_DAYS,
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
// 퇴근까지 찍혀 확인을 기다리는 근무. 지금 열린 기간에서만 뜻이 있어 그때만 셉니다.
const waiting = (rows: Punch[]) =>
  rows.filter((p) => p.out && (p.status ?? 'pending') === 'pending').length;

export function PunchRoster({
  employees,
  punches,
  shifts,
  today,
  onPick,
}: {
  employees: Employee[];
  punches: Punch[];
  shifts: Shift[];
  today: string;
  onPick: (employeeId: string) => void;
}) {
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
          const pending = waiting(now);
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
                  {pending > 0 && (
                    <em className="punchroster-flag">{t('확인 대기 {n}', { n: pending })}</em>
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
