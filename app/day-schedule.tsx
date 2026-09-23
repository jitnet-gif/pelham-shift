'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, EyeOff, Plus, Search, Send } from 'lucide-react';
import type { Employee, Shift } from '@/lib/domain';
import { useLang } from './use-lang';

// 하루를 오전 5시부터 보여줍니다. 7shifts 의 Day 보기와 같은 구간입니다.
const FROM = 5 * 60;
// 마지막 칸은 자정~새벽 1시입니다. 자정을 넘긴 근무가 여기까지 이어집니다.
const TO = 25 * 60;
const SPAN = TO - FROM;
const HOURS = Array.from({ length: (TO - FROM) / 60 }, (_, i) => FROM / 60 + i);
const minutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
// 퇴근이 출근보다 이르면 다음 날로 넘어간 근무입니다. 화면은 자정에서 끊습니다.
const endOf = (s: Shift) => {
  const start = minutes(s.start);
  const end = minutes(s.end);
  return end > start ? end : end + 1440;
};
const clock = (v: string) => {
  const h = Number(v.slice(0, 2));
  const m = v.slice(3, 5);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === '00' ? `${hour}${suffix}` : `${hour}:${m}${suffix}`;
};
const hourLabel = (h: number) => {
  const hour = h % 24;
  const suffix = hour < 12 ? 'am' : 'pm';
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
};
// 근무가 그 한 시간 안에 실제로 걸쳐 있는 분을 셉니다. 인원수와 시간·인건비 합계에 함께 씁니다.
const overlapMinutes = (s: Shift, from: number, to: number) =>
  Math.max(0, Math.min(endOf(s), to) - Math.max(minutes(s.start), from));

export default function DaySchedule({
  date,
  employees,
  shifts,
  rateOf,
  money,
  published,
  canEdit,
  onDateChange,
  onShiftSelect,
  onAddShift,
  onPublish,
  onUnpublish,
}: {
  date: string;
  employees: Employee[];
  shifts: Shift[];
  rateOf: (employeeId: string) => number;
  money: (n: number) => string;
  published: boolean;
  canEdit: boolean;
  onDateChange: (date: string) => void;
  onShiftSelect: (id: string) => void;
  onAddShift: (employeeId: string, date: string, start?: string) => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const { t, locale } = useLang();
  // 빈 칸 위에 마우스를 올리면 그 자리에 + 를 띄웁니다. 누르면 그 시각으로 근무가 열립니다.
  const [hover, setHover] = useState<{ id: string; at: number } | null>(null);
  // 가로 위치를 30분 단위 시각으로 바꿉니다. 클릭과 + 표시가 같은 값을 씁니다.
  const slotAt = (event: { clientX: number; currentTarget: Element }) => {
    const box = event.currentTarget.getBoundingClientRect();
    const raw = FROM + ((event.clientX - box.left) / box.width) * SPAN;
    return Math.min(Math.max(Math.round(raw / 30) * 30, FROM), TO - 30);
  };
  const asTime = (m: number) =>
    String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const shift = (days: number) => {
    const next = new Date(date + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate() + days);
    onDateChange(next.toISOString().slice(0, 10));
  };
  const onDay = shifts.filter((s) => s.date === date);
  const mine = (id: string) => onDay.filter((s) => s.employeeId === id);
  const hoursOf = (id: string) =>
    mine(id).reduce((sum, s) => sum + (endOf(s) - minutes(s.start)) / 60, 0);
  // 업무(부서)별로 묶습니다. 근무가 없는 직원도 7shifts 처럼 자기 부서 줄에 남습니다.
  const groups = [...new Set(employees.map((e) => e.role || t('미지정')))]
    .sort((a, b) => a.localeCompare(b))
    .map((area) => ({ area, rows: employees.filter((e) => (e.role || t('미지정')) === area) }));
  const headcount = (h: number) =>
    onDay.filter((s) => overlapMinutes(s, h * 60, h * 60 + 60) > 0).length;
  const hourHours = (h: number) =>
    onDay.reduce((sum, s) => sum + overlapMinutes(s, h * 60, h * 60 + 60) / 60, 0);
  const hourCost = (h: number) =>
    onDay.reduce(
      (sum, s) => sum + (overlapMinutes(s, h * 60, h * 60 + 60) / 60) * rateOf(s.employeeId),
      0,
    );
  const dayHours = onDay.reduce((sum, s) => sum + (endOf(s) - minutes(s.start)) / 60, 0);
  const dayCost = onDay.reduce(
    (sum, s) => sum + ((endOf(s) - minutes(s.start)) / 60) * rateOf(s.employeeId),
    0,
  );
  const heading = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date + 'T12:00:00Z'));

  return (
    <section className="dayview">
      <header className="dayview-bar">
        <div className="dayview-nav">
          <button
            className="dayview-arrow"
            onClick={() => shift(-1)}
            aria-label={t('이전 날')}
          >
            <ChevronLeft size={17} />
          </button>
          <label className="dayview-date">
            <span>{heading}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
            />
          </label>
          <button className="dayview-arrow" onClick={() => shift(1)} aria-label={t('다음 날')}>
            <ChevronRight size={17} />
          </button>
          <button className="dayview-today" onClick={() => onDateChange(today)}>
            {t('오늘')}
          </button>
        </div>
        <div className="dayview-state">
          <span className={'dayview-pub' + (published ? ' on' : '')}>
            {published ? t('게시됨') : t('작성 중')}
          </span>
          {canEdit && (
            <button className="dayview-publish" disabled={published} onClick={onPublish}>
              <Send size={15} /> {t('직원에게 공개')}
            </button>
          )}
          {canEdit && published && (
            <button className="dayview-unpublish" onClick={onUnpublish}>
              <EyeOff size={15} /> {t('게시 해제')}
            </button>
          )}
        </div>
      </header>
      <div className="dayview-scroll">
        <div className="dayview-grid">
          <div className="dv-corner">
            <span className="dv-corner-search">
              <Search size={15} />
              {t('직원 {n}명', { n: employees.length })}
            </span>
            <small>
              {dayHours.toFixed(2)} {t('시간')} · {money(dayCost)}
            </small>
          </div>
          <div className="dv-hours">
            {HOURS.map((h) => (
              <span key={h}>
                <b>{hourLabel(h)}</b>
                <small>{headcount(h)}</small>
              </span>
            ))}
          </div>
          {groups.map((group) => (
            <div className="dv-block" key={group.area}>
              <div className="dv-group">{group.area}</div>
              {group.rows.map((e) => (
                <div className="dv-row" key={e.id}>
                  <div className="dv-staff">
                    <i style={{ background: e.color }} />
                    <span>
                      <b>{e.name}</b>
                      <small>
                        {hoursOf(e.id).toFixed(2)} {t('시간')} ·{' '}
                        {money(hoursOf(e.id) * rateOf(e.id))}
                      </small>
                    </span>
                    {canEdit && (
                      <button
                        className="dv-add"
                        onClick={() => onAddShift(e.id, date)}
                        aria-label={t('{name} 근무 추가', { name: e.name })}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  <div
                    // 마우스로 시각을 집는 보조 수단입니다. 키보드로는 옆의 + 버튼을 씁니다.
                    role="presentation"
                    className={'dv-track' + (canEdit ? ' clickable' : '')}
                    onMouseMove={(event) =>
                      canEdit && setHover({ id: e.id, at: slotAt(event) })
                    }
                    onMouseLeave={() => setHover(null)}
                    onClick={(event) => {
                      // 빈 자리를 누르면 그 시각부터 근무를 새로 만듭니다. 30분 단위로 맞춥니다.
                      if (!canEdit) return;
                      onAddShift(e.id, date, asTime(slotAt(event)));
                    }}
                  >
                    {HOURS.map((h) => (
                      <i key={h} className="dv-line" style={{ left: ((h * 60 - FROM) / SPAN) * 100 + '%' }} />
                    ))}
                    {hover?.id === e.id && (
                      <span
                        className="dv-ghost"
                        style={{
                          left: ((hover.at - FROM) / SPAN) * 100 + '%',
                          width: (30 / SPAN) * 100 + '%',
                        }}
                      >
                        <Plus size={15} />
                      </span>
                    )}
                    {mine(e.id).map((s) => {
                      const start = Math.max(minutes(s.start), FROM);
                      const end = Math.min(endOf(s), TO);
                      if (end <= start) return null;
                      return (
                        <button
                          key={s.id}
                          className={'dv-shift' + (s.draft ? ' is-draft' : '')}
                          style={{
                            left: ((start - FROM) / SPAN) * 100 + '%',
                            width: ((end - start) / SPAN) * 100 + '%',
                            // 아직 공개하지 않은 근무는 노란 바탕으로 눈에 띄게 둡니다.
                            background: s.draft ? '#f3c73f' : e.color,
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            onShiftSelect(s.id);
                          }}
                          title={`${clock(s.start)} - ${clock(s.end)} · ${s.area}${s.draft ? ' · Unpublished' : ''}`}
                        >
                          <b>{clock(s.start)} - {clock(s.end)}</b>
                          <span>
                            {s.draft ? 'Unpublished · ' : ''}
                            {s.area}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="dv-foot">
            <div className="dv-foot-label">
              <b>{dayHours.toFixed(2)} {t('시간')}</b>
              <small>{money(dayCost)}</small>
            </div>
            <div className="dv-foot-hours">
              {HOURS.map((h) => (
                <span key={h}>
                  <b>{hourHours(h).toFixed(1)}</b>
                  <small>{money(hourCost(h))}</small>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
