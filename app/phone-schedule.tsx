'use client';
import { useState } from 'react';
import {
  CalendarClock,
  CalendarX,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  MapPin,
  Plus,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import type { Availability, Employee, Shift, TimeOff } from '@/lib/domain';
import { TIME_ZONE, addDays, weekdayOf } from '@/lib/domain';
import { useLang } from './use-lang';
import WeatherPanel from './weather-panel';

// 폰에서는 주간 표를 옆으로 밀어 보는 대신, 고른 날부터 그 주 끝까지를 날짜별 목록으로 폅니다.
// 표를 CSS 로 줄이지 않고 아예 다른 화면을 그립니다 — 390px 에서 가로 스크롤이 사라집니다.
const clock = (v: string) => {
  const h = Number(v.slice(0, 2));
  return `${h % 12 || 12}:${v.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
};

export default function PhoneSchedule({
  week,
  day,
  employees,
  shifts,
  timeOff,
  availability,
  location,
  canEdit,
  spot,
  actions,
  blockedOf,
  onWeekChange,
  onDayChange,
  onShiftSelect,
  onAddShift,
  onRainNotice,
  onOpenTimeOff,
  onOpenAvailability,
}: {
  week: string;
  day: string;
  employees: Employee[];
  shifts: Shift[];
  timeOff: TimeOff[];
  availability: Availability[];
  location: string;
  canEdit: boolean;
  spot: { lat: number; lng: number } | null;
  actions: React.ReactNode;
  blockedOf: (shift: Shift) => 'timeoff' | 'unavailable' | null;
  onWeekChange: (week: string) => void;
  onDayChange: (date: string) => void;
  onShiftSelect: (id: string) => void;
  onAddShift: (date: string) => void;
  onRainNotice?: () => void;
  onOpenTimeOff: () => void;
  onOpenAvailability: () => void;
}) {
  const { t, days, locale } = useLang();
  // 날씨 칸은 눌러야 열립니다. 닫혀 있는 동안에는 예보를 부르지 않습니다.
  const [weatherOpen, setWeatherOpen] = useState(false);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  // 고른 날이 이 주를 벗어나면 주 첫날부터 보여 줍니다.
  const from = day >= week && day <= weekDates[6] ? day : week;
  const listDates = weekDates.filter((date) => date >= from);
  const monthLabel = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(from + 'T12:00:00Z'));
  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(date + 'T12:00:00Z'));
  const of = (id: string) => employees.find((e) => e.id === id);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  // 주를 옮길 때 고른 요일은 그대로 둡니다. 화요일을 보던 사람은 다음 주에도 화요일을 봅니다.
  const stepWeek = (n: number) => {
    onWeekChange(addDays(week, n * 7));
    onDayChange(addDays(from, n * 7));
  };
  const spanOf = (r: { allDay: boolean; start?: string; end?: string }) =>
    r.allDay || !r.start || !r.end ? t('종일') : `${clock(r.start)} - ${clock(r.end)}`;

  return (
    <section className="psched">
      <header className="psched-top">
        <button
          className="psched-step"
          aria-label={t('이전 주')}
          onClick={() => stepWeek(-1)}
        >
          <ChevronLeft size={20} />
        </button>
        <label className="psched-month">
          <span>{monthLabel}</span>
          <ChevronDown size={17} />
          <input
            type="date"
            aria-label={t('기준 날짜')}
            value={from}
            onChange={(e) => {
              if (!e.target.value) return;
              onWeekChange(addDays(e.target.value, -weekdayOf(e.target.value)));
              onDayChange(e.target.value);
            }}
          />
        </label>
        <button
          className="psched-step"
          aria-label={t('다음 주')}
          onClick={() => stepWeek(1)}
        >
          <ChevronRight size={20} />
        </button>
        {canEdit && (
          <button
            className="psched-new-top"
            aria-label={t('근무 추가')}
            onClick={() => onAddShift(from)}
          >
            <Plus size={22} />
          </button>
        )}
      </header>
      <div className="psched-week">
        {weekDates.map((date, i) => (
          <button
            key={date}
            // 화면에는 '화 22' 만 보이지만, 읽어 줄 때는 무슨 날인지 온전히 들립니다.
            aria-label={dayLabel(date)}
            aria-pressed={date === from}
            className={
              'psched-chip' +
              (date === from ? ' on' : '') +
              (date === today ? ' today' : '')
            }
            onClick={() => onDayChange(date)}
          >
            <small>{days[i]}</small>
            <b>{Number(date.slice(8))}</b>
          </button>
        ))}
      </div>
      <div className="psched-place">
        <MapPin size={16} />
        <span>{location}</span>
        <button
          className={'psched-sky' + (weatherOpen ? ' on' : '')}
          aria-label={t('날씨와 일출·일몰')}
          aria-expanded={weatherOpen}
          onClick={() => setWeatherOpen((v) => !v)}
        >
          <CloudSun size={19} />
        </button>
      </div>
      {weatherOpen && (
        <WeatherPanel
          key={from}
          date={from}
          today={today}
          spot={spot}
          onRainNotice={onRainNotice}
        />
      )}
      {actions && <div className="psched-actions">{actions}</div>}
      {listDates.map((date) => {
        const onDay = shifts
          .filter((s) => s.date === date)
          .sort((a, b) => a.start.localeCompare(b.start));
        const offs = timeOff.filter(
          (r) =>
            r.status !== 'declined' &&
            date >= r.from &&
            date <= r.to &&
            employees.some((e) => e.id === r.employeeId),
        );
        const unavailable = availability.filter(
          (r) =>
            r.status !== 'declined' &&
            r.weekday === weekdayOf(date) &&
            (!r.effectiveFrom || date >= r.effectiveFrom) &&
            employees.some((e) => e.id === r.employeeId),
        );
        return (
          <div className={'psched-day' + (date === today ? ' today' : '')} key={date}>
            <div className="psched-dayhead">
              <b>{dayLabel(date)}</b>
              <span>
                <UserRound size={14} />
                {new Set(onDay.map((s) => s.employeeId)).size}
              </span>
            </div>
            {offs.map((r) => (
              <button
                className="psched-row note"
                key={'off-' + r.id}
                onClick={onOpenTimeOff}
              >
                <span className="psched-avatar note">
                  <CalendarX size={16} />
                </span>
                <span className="psched-main">
                  <b>{of(r.employeeId)?.name}</b>
                  <span className="psched-time">{spanOf(r)}</span>
                  <small className="psched-role">
                    {r.status === 'pending' ? t('휴무 신청') : t('휴무')}
                  </small>
                </span>
                <ChevronRight className="psched-go" size={18} />
              </button>
            ))}
            {unavailable.map((r) => (
              <button
                className="psched-row note"
                key={'av-' + r.id}
                onClick={onOpenAvailability}
              >
                <span className="psched-avatar note">
                  <CalendarClock size={16} />
                </span>
                <span className="psched-main">
                  <b>{of(r.employeeId)?.name}</b>
                  <span className="psched-time">{spanOf(r)}</span>
                  <small className="psched-role">
                    {r.status === 'pending' ? t('불가 신청') : t('근무 불가')}
                  </small>
                </span>
                <ChevronRight className="psched-go" size={18} />
              </button>
            ))}
            {onDay.map((s) => {
              const e = of(s.employeeId);
              const blocked = blockedOf(s);
              return (
                <button
                  className={'psched-row' + (s.draft ? ' is-draft' : '')}
                  key={s.id}
                  onClick={() => onShiftSelect(s.id)}
                >
                  <span className="psched-avatar" style={{ background: e?.color }}>
                    {e?.name.slice(0, 1)}
                  </span>
                  <span className="psched-main">
                    <b>
                      {e?.name}
                      {s.draft && <em className="psched-flag">Unpublished</em>}
                    </b>
                    <span className="psched-time">
                      {clock(s.start)} - {clock(s.end)}
                    </span>
                    <small className="psched-role">
                      <i style={{ background: e?.color }} />
                      {s.originalId ? t('대체 · ') : ''}
                      {s.area} | {e?.role}
                    </small>
                  </span>
                  {blocked && (
                    <TriangleAlert
                      className="psched-warn"
                      size={16}
                      aria-label={t('휴무·불가 시간과 겹치는 근무입니다')}
                    />
                  )}
                  <ChevronRight className="psched-go" size={18} />
                </button>
              );
            })}
            {!onDay.length && !offs.length && !unavailable.length && (
              <p className="psched-empty">{t('근무 없음')}</p>
            )}
            {canEdit && (
              <button className="psched-new" onClick={() => onAddShift(date)}>
                {t('새 근무 만들기')}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
