'use client';
import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Employee, Shift } from '@/lib/domain';
import { addDays, weekdayOf } from '@/lib/domain';
import { useLang } from './use-lang';

// 직원이 보는 스케줄. 한 주를 날짜 줄로 펼쳐, 근무가 없는 날도 한 줄씩 남겨 둡니다.
// '내 근무'는 본인 것만, '전체'는 같은 날 일하는 사람을 모두 보여 줍니다.
const clock = (v: string) => {
  const h = Number(v.slice(0, 2));
  return `${h % 12 || 12}:${v.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
};
// 오전과 오후가 같으면 앞쪽 AM/PM 은 지웁니다 — '8:00 AM–12:00 PM' 은 남고 '2:00–8:00 PM' 이 됩니다.
const span = (start: string, end: string) => {
  const from = clock(start);
  const to = clock(end);
  return from.slice(-2) === to.slice(-2)
    ? `${from.slice(0, -3)}\u2013${to}`
    : `${from}\u2013${to}`;
};

export default function StaffSchedule({
  me,
  week,
  day,
  scope,
  employees,
  shifts,
  location,
  onScopeChange,
  onWeekChange,
  onDayChange,
  onShiftSelect,
}: {
  me: string;
  week: string;
  day: string;
  scope: 'mine' | 'all';
  employees: Employee[];
  shifts: Shift[];
  location: string;
  onScopeChange: (scope: 'mine' | 'all') => void;
  onWeekChange: (week: string) => void;
  onDayChange: (date: string) => void;
  onShiftSelect: (id: string) => void;
}) {
  const { t, days, locale } = useLang();
  // 날짜를 고르면 그 줄만 화면 안으로 올립니다. 목록을 손으로 넘기는 중에는 끼어들지 않습니다.
  const rowsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const selected = day >= week && day <= weekDates[6] ? day : week;
  useEffect(() => {
    rowsRef.current[selected]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(selected + 'T12:00:00Z'));
  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(date + 'T12:00:00Z'));
  const of = (id: string) => employees.find((e) => e.id === id);
  // 화면에 세울 근무. '내 근무'에서는 이름이 줄마다 되풀이되지 않게 감춥니다.
  // 어느 보기든 그날 근무는 모두 세웁니다. '내 근무'에서는 내 것을 위에 두고
  // 나머지는 흐리게 남겨, 같은 날 누가 나오는지도 함께 보이게 합니다.
  const onDate = (date: string) =>
    shifts
      .filter((s) => s.date === date)
      .sort((a, b) =>
        scope === 'mine' && (a.employeeId === me) !== (b.employeeId === me)
          ? a.employeeId === me
            ? -1
            : 1
          : a.start.localeCompare(b.start),
      );
  const mineOn = (date: string) => onDate(date).filter((s) => s.employeeId === me);

  return (
    <section className="stsched">
      <header className="stsched-top">
        <button
          className="stsched-today"
          aria-label={t('오늘로')}
          onClick={() => {
            onWeekChange(addDays(today, -weekdayOf(today)));
            onDayChange(today);
          }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 9h18M8 2.8v3.4M16 2.8v3.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <text x="12" y="17.6" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor">
              {Number(today.slice(8))}
            </text>
          </svg>
        </button>
        <label className="stsched-month">
          <span>{monthLabel}</span>
          <ChevronDown size={19} />
          <input
            type="date"
            aria-label={t('기준 날짜')}
            value={selected}
            onChange={(e) => {
              if (!e.target.value) return;
              onWeekChange(addDays(e.target.value, -weekdayOf(e.target.value)));
              onDayChange(e.target.value);
            }}
          />
        </label>
      </header>
      <div className="stsched-scope" role="tablist" aria-label={t('보기')}>
        {(['mine', 'all'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={scope === key}
            className={'stsched-scope-tab' + (scope === key ? ' on' : '')}
            onClick={() => onScopeChange(key)}
          >
            {key === 'mine' ? t('내 근무') : t('전체 일정')}
          </button>
        ))}
      </div>
      <div className="stsched-strip">
        {weekDates.map((date, i) => (
          <button
            key={date}
            aria-label={dayLabel(date)}
            aria-pressed={date === selected}
            className={
              'stsched-chip' +
              (date === selected ? ' on' : '') +
              (date === today ? ' today' : '')
            }
            onClick={() => onDayChange(date)}
          >
            <small>{days[i]}</small>
            <b>{Number(date.slice(8))}</b>
            {/* 근무가 있는 날에만 점을 찍습니다. 고른 날에는 흰 점으로 뒤집습니다. */}
            <i
              className={
                (scope === 'mine' ? mineOn(date) : onDate(date)).length ? 'on' : ''
              }
            />
          </button>
        ))}
      </div>
      <div className="stsched-list">
        {weekDates.map((date) => {
          const rows = onDate(date);
          // '내 근무'인데 그날 내 근무가 없으면, 흐린 줄 위에 '근무 없음'을 먼저 적어 둡니다.
          const noneOfMine = scope === 'mine' && !mineOn(date).length;
          return (
            <div
              className={
                'stsched-day' +
                (date === selected ? ' picked' : '') +
                (rows.length ? '' : ' nowork')
              }
              key={date}
              ref={(node) => {
                rowsRef.current[date] = node;
              }}
            >
              <div className="stsched-date" aria-hidden="true">
                <small>{days[weekdayOf(date)]}</small>
                <b>{Number(date.slice(8))}</b>
              </div>
              {rows.length ? (
                <div className="stsched-shifts">
                  {noneOfMine && (
                    <p className="stsched-none inline">{t('근무 일정이 없습니다.')}</p>
                  )}
                  {rows.map((s) => {
                    const e = of(s.employeeId);
                    // 내 근무가 아니면 흐리게. 대신 누구 것인지 이름을 붙여 둡니다.
                    const others = s.employeeId !== me;
                    return (
                      <button
                        className={'stsched-shift' + (scope === 'mine' && others ? ' dim' : '')}
                        key={s.id}
                        onClick={() => onShiftSelect(s.id)}
                      >
                        <span className="stsched-shift-main">
                          <b>{span(s.start, s.end)}</b>
                          <span className="stsched-where">{location}</span>
                          <small className="stsched-role">
                            <i style={{ background: e?.color }} />
                            {(scope === 'all' || others) && e?.name ? `${e.name} · ` : ''}
                            {s.area}
                            {e?.role && e.role !== s.area ? ` | ${e.role}` : ''}
                          </small>
                        </span>
                        <ChevronRight className="stsched-go" size={19} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="stsched-none">
                  {scope === 'mine'
                    ? t('근무 일정이 없습니다.')
                    : t('이 날은 아무도 근무하지 않습니다.')}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
