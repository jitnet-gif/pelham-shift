'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, Coffee, Delete, Hourglass, LogOut, Settings } from 'lucide-react';
import type { Employee, Punch, Shift } from '@/lib/domain';
import { duration } from '@/lib/domain';
import { useLang } from './use-lang';

// 출퇴근 화면. 아직 안 찍었으면 Punch ID 키패드를, 찍혀 있으면 지금 근무를 보여 줍니다.
// 키패드는 매장 공용 단말을 염두에 둔 확인 절차입니다 — 로그인 자체를 대신하지는 않습니다.
const clock = (v: string) => {
  const h = Number(v.slice(0, 2));
  return `${h % 12 || 12}:${v.slice(3, 5)}${h < 12 ? 'AM' : 'PM'}`;
};
const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function StaffClock({
  employee,
  punch,
  shift,
  location,
  busy,
  onPunchIn,
  onPunchOut,
  onBreak,
  onOpenSettings,
}: {
  employee?: Employee;
  punch?: Punch;
  shift?: Shift;
  location: string;
  busy: boolean;
  onPunchIn: (punchId: string) => void;
  onPunchOut: () => void;
  onBreak: (action: 'start' | 'end') => void;
  onOpenSettings: () => void;
}) {
  const { t, locale } = useLang();
  // 헤더 시계와 '근무한 시간'은 분이 바뀌면 같이 움직입니다.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(timer);
  }, []);
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const stamp = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(now);
  const onBreakNow = (punch?.breaks ?? []).find((b) => !b.end);

  // 아직 출근을 찍지 않았습니다 — Punch ID 를 받습니다.
  if (!punch || punch.out) {
    const expected = employee?.punchId || '';
    const ready = expected ? code.length >= expected.length : true;
    // 화면에서 먼저 한 번 걸러 주고, 실제 확인은 서버가 다시 합니다.
    const signIn = () => {
      if (expected && code !== expected) {
        setWrong(true);
        setCode('');
        return;
      }
      setWrong(false);
      setCode('');
      onPunchIn(code);
    };
    return (
      <section className="stclock pad">
        <header className="stclock-top">
          <button
            className="stclock-icon"
            aria-label={t('설정')}
            onClick={onOpenSettings}
          >
            <Settings size={21} />
          </button>
          <h2>{stamp}</h2>
          <span className="stclock-icon" aria-hidden="true" />
        </header>
        <div className="stclock-place">
          <span className="stclock-mark" aria-hidden="true" />
          <span>
            <b>{location}</b>
            <small>{employee?.name ?? location}</small>
          </span>
        </div>
        <div className="stclock-pad">
          <p className="stclock-ask">
            {expected ? t('직원 ID를 입력하세요') : t('출근을 찍습니다')}
          </p>
          {expected && (
            <>
              <output className="stclock-code" aria-live="polite">
                {'•'.repeat(code.length)}
              </output>
              <div className="stclock-keys">
                {PAD.map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setWrong(false);
                      setCode((v) => (v.length >= 8 ? v : v + key));
                    }}
                  >
                    {key}
                  </button>
                ))}
                <button className="word" onClick={() => setCode('')}>
                  {t('지우기')}
                </button>
                <button
                  onClick={() => {
                    setWrong(false);
                    setCode((v) => (v.length >= 8 ? v : v + '0'));
                  }}
                >
                  0
                </button>
                <button aria-label={t('한 자 지우기')} onClick={() => setCode((v) => v.slice(0, -1))}>
                  <Delete size={22} />
                </button>
              </div>
            </>
          )}
          {wrong && <p className="stclock-wrong">{t('직원 ID가 맞지 않습니다.')}</p>}
          <button
            className="stclock-signin"
            disabled={busy || !ready}
            onClick={signIn}
          >
            {t('signin::출근 찍기')}
          </button>
        </div>
      </section>
    );
  }

  // 출근으로 찍혀 있습니다 — 지금 근무를 보여 줍니다.
  const since = duration(punch.in, hhmm(now)) * 60;
  const today = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(now);
  return (
    <section className="stclock">
      <header className="stclock-top">
        <span className="stclock-icon" aria-hidden="true">
          <ArrowLeft size={21} style={{ opacity: 0 }} />
        </span>
        <h2>{stamp}</h2>
        <span className="stclock-icon" aria-hidden="true" />
      </header>
      <div className="stclock-who">
        <span className="stclock-face" style={{ background: employee?.color }}>
          {employee?.name.slice(0, 1)}
        </span>
        <span className="stclock-name">
          <b>{employee?.name}</b>
          <em className={onBreakNow ? 'onbreak' : ''}>
            {onBreakNow ? t('휴게 중') : t('출근 중')}
          </em>
        </span>
        <span className="stclock-elapsed">
          <Hourglass size={20} aria-hidden="true" />
          <span>
            <b>
              {t('{h}시간 {m}분', {
                h: Math.floor(since / 60),
                m: Math.round(since % 60),
              })}
            </b>
            <small>{t('근무한 시간')}</small>
          </span>
        </span>
      </div>
      <div className="stclock-body">
        <h3>{t('지금 근무')}</h3>
        <p className="stclock-date">{today}</p>
        <div className="stclock-card">
          <span className="stclock-badge" style={{ background: employee?.color }}>
            {(shift?.area || employee?.role || '?').slice(0, 1)}
          </span>
          <span>
            <b>
              {shift
                ? `${clock(shift.start)}–${clock(shift.end)} (${duration(shift.start, shift.end)}${t('h::시간')})`
                : `${clock(punch.in)} ${t('출근')}`}
            </b>
            <small>
              {punch.area || shift?.area || employee?.role} | {location}
            </small>
          </span>
        </div>
        <button
          className="stclock-break"
          disabled={busy}
          onClick={() => onBreak(onBreakNow ? 'end' : 'start')}
        >
          <Coffee size={19} />
          {onBreakNow ? t('휴게 끝내기') : t('유급 휴게 시작')}
        </button>
        <button className="stclock-end" disabled={busy} onClick={onPunchOut}>
          {t('endshift::퇴근 찍기')}
          <LogOut size={20} />
        </button>
      </div>
    </section>
  );
}

// 매장 시각(뉴욕)의 HH:MM. 찍히는 시각과 같은 기준으로 셈해야 '근무한 시간'이 어긋나지 않습니다.
const hhmm = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
