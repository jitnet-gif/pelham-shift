'use client';
import { useState } from 'react';
import { useBackClose } from './use-back';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { Employee, Punch, Shift } from '@/lib/domain';
import {
  PAY_PERIOD_DAYS,
  addDays,
  payPeriods,
  payPeriodStart,
  missingOut,
  periodOpen,
  shownPunch,
  OFF_TIME_COLOR,
} from '@/lib/domain';
import { useLang } from './use-lang';

// 직원이 보는 근무표. 2주 급여 기간마다 자기가 찍은 출퇴근을 확인하고, 다르면 이의를 답니다.
// 이번 기간만 열려 있고 지난 기간은 급여가 나가 닫힙니다.
const clock = (v: string) => {
  const h = Number(v.slice(0, 2));
  return `${h % 12 || 12}:${v.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
};
// 목록에 몇 기간을 세울지. 2주 × 12 이면 반년쯤 거슬러 갑니다.
const PERIODS = 12;

export default function StaffTimesheets({
  me,
  punches,
  shifts,
  employee,
  location,
  today,
  busy,
  period,
  onPeriodChange,
  onReview,
  onApproveAll,
}: {
  me: string;
  punches: Punch[];
  // 출퇴근 시각을 예정 근무에 맞춰 적는 기준입니다(shownPunch).
  shifts: Shift[];
  employee?: Employee;
  location: string;
  today: string;
  busy: boolean;
  period: string;
  onPeriodChange: (from: string) => void;
  onReview: (id: string, action: 'approve' | 'dispute') => void;
  onApproveAll: (from: string) => void;
}) {
  const { t, locale } = useLang();
  const [open, setOpen] = useState('');
  // 펼친 급여 기간은 뒤로 가기로 접습니다.
  useBackClose(!!open, () => setOpen(''));
  const mine = punches.filter((p) => p.employeeId === me);
  const short = (date: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(date + 'T12:00:00Z'),
    );
  const long = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(date + 'T12:00:00Z'));
  const monthLabel = (date: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(date + 'T12:00:00Z'),
    );
  // 퇴근까지 찍힌 근무만 셉니다. 지금 일하는 중인 근무는 끝나야 근무표에 올라옵니다.
  const inPeriod = (from: string) => {
    const to = addDays(from, PAY_PERIOD_DAYS - 1);
    return mine
      .filter((p) => p.date >= from && p.date <= to)
      .sort((a, b) => (a.date + a.in).localeCompare(b.date + b.in));
  };
  const pendingIn = (from: string) =>
    inPeriod(from).filter((p) => p.out && (p.status ?? 'pending') === 'pending').length;

  // 기간 목록. 달로 묶어 최근 것부터 세웁니다.
  if (!period) {
    const months: { label: string; rows: { from: string; to: string }[] }[] = [];
    for (const row of payPeriods(today, PERIODS)) {
      const label = monthLabel(row.from);
      const last = months[months.length - 1];
      if (last?.label === label) last.rows.push(row);
      else months.push({ label, rows: [row] });
    }
    return (
      <section className="stsheet">
        {months.map((month) => (
          <div className="stsheet-month" key={month.label}>
            <h3>{month.label}</h3>
            {month.rows.map((row) => (
              <button
                className="stsheet-period"
                key={row.from}
                onClick={() => onPeriodChange(row.from)}
              >
                <span>
                  {short(row.from)} – {short(row.to)}
                </span>
                {periodOpen(row.from, today) && pendingIn(row.from) > 0 && (
                  <em className="stsheet-flag">{t('확인 필요')}</em>
                )}
                <ChevronRight size={19} />
              </button>
            ))}
          </div>
        ))}
      </section>
    );
  }

  // 한 기간 안을 보는 화면
  const from = payPeriodStart(period);
  const to = addDays(from, PAY_PERIOD_DAYS - 1);
  const rows = inPeriod(from);
  const live = periodOpen(from, today);
  // 급여가 세는 시간과 같은 눈금입니다. 예정 시작 전·예정 종료 뒤에 찍힌 시간은 빠집니다.
  const hours = rows.reduce((sum, p) => sum + shownPunch({ shifts }, p).hours, 0);
  const counts = {
    approved: rows.filter((p) => p.status === 'approved').length,
    disputed: rows.filter((p) => p.status === 'disputed').length,
    pending: rows.filter((p) => p.out && (p.status ?? 'pending') === 'pending').length,
  };

  return (
    <section className="stsheet">
      {live ? (
        <div className="stsheet-banner open">
          <div>
            <b>{t('확인해 주세요')}</b>
            <span>
              {t('확인 {a} · 이의 {b} · 대기 {c}', {
                a: counts.approved,
                b: counts.disputed,
                c: counts.pending,
              })}
            </span>
          </div>
          <Info size={18} aria-hidden="true" />
        </div>
      ) : (
        <div className="stsheet-banner">
          <span>{t('마감된 근무표입니다.')}</span>
        </div>
      )}
      <h2 className="stsheet-count">{t('근무 {n}건', { n: rows.length })}</h2>
      <p className="stsheet-hours">
        {t('{h}시간 {m}분 근무함', {
          h: Math.floor(hours),
          m: Math.round((hours % 1) * 60),
        })}
      </p>
      {live && counts.pending > 0 && (
        <button className="stsheet-approveall" disabled={busy} onClick={() => onApproveAll(from)}>
          {t('모두 확인')}
        </button>
      )}
      <h3 className="stsheet-section">{t('근무한 날')}</h3>
      {rows.map((p) => {
        const shown = open === p.id;
        const at = shownPunch({ shifts }, p);
        return (
          <div className={'stsheet-row' + (shown ? ' on' : '')} key={p.id}>
            <div className="stsheet-rowhead">
              <span className="stsheet-rowdate">
                <b>{long(p.date)}</b>
                {p.editedBy && <small className="stsheet-edited">{t('관리자가 수정함')}</small>}
                {p.status === 'disputed' && (
                  <small className="stsheet-disputed">{t('이의 제기함')}</small>
                )}
                {p.status === 'approved' && live && (
                  <small className="stsheet-ok">{t('확인함')}</small>
                )}
              </span>
              {live && p.out && (p.status ?? 'pending') === 'pending' && (
                <span className="stsheet-verdict">
                  <button
                    className="stsheet-approve"
                    disabled={busy}
                    onClick={() => onReview(p.id, 'approve')}
                  >
                    {t('approve::확인')}
                  </button>
                  <button
                    className="stsheet-dispute"
                    disabled={busy}
                    onClick={() => onReview(p.id, 'dispute')}
                  >
                    {t('이의')}
                  </button>
                </span>
              )}
              <button
                className="stsheet-expand"
                aria-expanded={shown}
                aria-label={t('{date} 자세히 보기', { date: long(p.date) })}
                onClick={() => setOpen(shown ? '' : p.id)}
              >
                <ChevronDown size={18} />
              </button>
            </div>
            {shown && (
              <div className="stsheet-detail">
                <b>
                  {/* 지각한 출근·조퇴한 퇴근은 빨간 글자로 적습니다. */}
                  <span style={at.late ? { color: OFF_TIME_COLOR, fontWeight: 600 } : undefined}>{clock(at.in)}</span>
                  {p.out && ' - '}
                  {p.out && (
                    <span style={at.early ? { color: OFF_TIME_COLOR, fontWeight: 600 } : undefined}>{clock(at.out ?? p.out)}</span>
                  )}
                  {missingOut(p, today) && ` - ${t('퇴근 미기록')}`}
                </b>
                <small>
                  <i style={{ background: employee?.color }} />
                  {p.area || employee?.role} - {location}
                </small>
                {p.disputeNote && <p>{p.disputeNote}</p>}
              </div>
            )}
          </div>
        );
      })}
      {!rows.length && (
        <p className="stsheet-empty">
          {t('{from} – {to} 사이에 찍힌 근무가 없습니다.', {
            from: short(from),
            to: short(to),
          })}
        </p>
      )}
    </section>
  );
}
