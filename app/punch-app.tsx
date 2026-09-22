'use client';
import './punch-app.css';
import { useEffect, useState } from 'react';
import { Bell, BellRing, CalendarDays, LogOut, UserRound } from 'lucide-react';
import { LOCATION, localDate, seed, type State } from '@/lib/domain';
import { pushOn, relangPush, subscribePush } from '@/lib/push-client';
import { useLang } from './use-lang';
import GpsGuard, { useGps } from './gps-guard';
import StaffClock from './staff-clock';
import BirthLogin from './birth-login';
import LangToggle from './lang-toggle';

// 홈 화면의 주황 아이콘이 여는 앱입니다. 스케줄 앱과 데이터는 같지만 화면은 시계 한 장뿐입니다.
// 일하러 온 사람이 찍기까지 한 번도 길을 고르지 않게 하려고 탭바도 사이드바도 두지 않았습니다.
// 스케줄·근무표·메시지는 스케줄 앱('/')에 있습니다.

// 찍힌 출근 시각에 가장 가까운 근무를 고를 때 씁니다.
const minutesOf = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));

type Actor = { id: string; admin: boolean };
type Payload = { state?: State; version?: number; actor?: Actor; error?: string };

export default function PunchApp() {
  const { t, lang } = useLang();
  const [data, setData] = useState<State>(seed);
  const [version, setVersion] = useState(0);
  const [actor, setActor] = useState<Actor>({ id: 'admin', admin: true });
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>('loading');
  // 워크스페이스를 아직 만들지 않았으면 화면에 보이는 건 샘플입니다. 찍어도 남지 않습니다.
  const [setup, setSetup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [tick, setTick] = useState(() => Date.now());
  const [push, setPush] = useState(false);
  // 근무지를 지정해 둔 곳에서는 앱을 여는 동안 위치를 계속 지켜봅니다.
  const gps = useGps(!!data.workplace);
  const query = () => (typeof window === 'undefined' ? '' : window.location.search);

  const ingest = (r: Payload) => {
    if (r.state) {
      setData(r.state);
      setVersion(r.version ?? 0);
      setSetup(false);
    } else setSetup(true);
    if (r.actor) setActor(r.actor);
    return r.version;
  };

  // 불러오기는 지금 판 번호를 돌려줍니다. 저장이 어긋났을 때 그 번호로 한 번 더 보냅니다.
  const refresh = async () => {
    try {
      const r = await fetch('/api/workspace' + query());
      const json = (await r.json()) as Payload;
      if (r.status === 401) {
        setAuth('out');
        return undefined;
      }
      if (!r.ok) throw Error(json.error);
      setAuth('in');
      return ingest(json);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '불러오지 못했습니다.');
      setAuth((a) => (a === 'loading' ? 'out' : a));
      return undefined;
    }
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      setTick(Date.now());
      void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (auth === 'in') void pushOn().then(setPush);
  }, [auth]);
  // 알림 문구는 서버가 기기별로 고릅니다. 말을 바꾸면 이 기기를 다시 등록합니다.
  useEffect(() => {
    if (push) void relangPush(query(), lang);
  }, [push, lang]);

  const send = (type: string, payload: Record<string, unknown>, at: number) =>
    fetch('/api/workspace' + query(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, version: at }),
    });

  const command = async (type: string, payload: Record<string, unknown> = {}) => {
    if (setup) {
      setStatus('아직 워크스페이스가 없습니다. 관리자가 먼저 만들어야 기록이 남습니다.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      let r = await send(type, payload, version);
      // 그 사이 관리자가 무언가를 고쳤을 뿐이면 최신 번호를 받아 한 번 더 보냅니다.
      // 사진은 이미 찍혔습니다 — 남의 편집 때문에 다시 찍게 만들 이유가 없습니다.
      if (r.status === 409) {
        const at = await refresh();
        if (at !== undefined) r = await send(type, payload, at);
      }
      const json = (await r.json()) as Payload;
      if (!r.ok) throw Error(json.error);
      ingest(json);
      setStatus('기록했습니다.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '기록하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const enablePush = async () => {
    setBusy(true);
    try {
      await subscribePush(query(), lang);
      setPush(true);
      setStatus('이 기기에서 푸시 알림을 켰습니다. 출근 1시간 전 알림과 우천 공지를 받습니다.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '알림을 켜지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch('/api/birth-login', { method: 'DELETE' }).catch(() => 0);
    window.location.assign(window.location.pathname + query());
  };

  if (auth !== 'in')
    return (
      <div className="login-screen">
        <LangToggle />
        <span className="brand">
          <span className="brandmark" aria-hidden="true" />
          pelham<span className="brandlight">punch</span>
        </span>
        {auth === 'loading' ? (
          <p className="login-loading">{t('불러오는 중…')}</p>
        ) : (
          <>
            {status && (
              <div role="status" className="statusbar">
                {t(status)}
              </div>
            )}
            <BirthLogin />
          </>
        )}
      </div>
    );

  // 매장 시각으로 본 오늘. 찍힌 기록과 근무표가 모두 이 날짜를 기준으로 삼습니다.
  const today = localDate(new Date(tick));
  const me = data.employees.find((e) => e.id === actor.id);
  const myPunch = [...(data.punches ?? [])]
    .reverse()
    .find((p) => p.employeeId === actor.id && p.date === today);
  const myShiftToday = data.shifts
    .filter((s) => s.employeeId === actor.id && s.date === today)
    .sort((a, b) =>
      myPunch
        ? Math.abs(minutesOf(a.start) - minutesOf(myPunch.in)) -
          Math.abs(minutesOf(b.start) - minutesOf(myPunch.in))
        : a.start.localeCompare(b.start),
    )[0];

  return (
    <div className="punchapp">
      {/* 위치 안내가 화면을 덮어도 이 줄은 위에 남습니다 — 위치를 막은 사람도 계정은 바꿀 수 있어야 합니다. */}
      <div className="punchbar">
        <LangToggle />
        <span className="punchbar-gap" />
        <button
          type="button"
          className={push ? 'on' : ''}
          disabled={busy || push}
          onClick={() => void enablePush()}
          title={push ? t('이 기기 푸시 알림 켜짐') : t('푸시 알림 켜기')}
        >
          {push ? <BellRing size={16} /> : <Bell size={16} />}
          {push ? t('알림 켜짐') : t('알림 켜기')}
        </button>
        <a href={'/' + query()} title={t('스케줄 앱 열기')}>
          <CalendarDays size={16} />
          {t('스케줄')}
        </a>
        <button type="button" onClick={() => void logout()} title={t('로그아웃')}>
          <LogOut size={16} />
        </button>
      </div>
      {me ? (
        <StaffClock
          employee={me}
          punch={myPunch}
          shift={myShiftToday}
          location={LOCATION}
          busy={busy}
          needsLocation={!!data.workplace}
          spot={gps.spot}
          needsPunchId={!!me.punchId}
          onPunch={(action, photo, place, punchId) =>
            void command(action, { photo, punchId: punchId ?? '', ...place })
          }
          onBreak={(action) => void command('punchBreak', { action, paid: '1' })}
        />
      ) : (
        // 고정 '관리자' 계정은 직원 명부에 없습니다. 카메라를 띄워 봐야 서버가 되돌려 보냅니다.
        <section className="nostaff">
          <UserRound size={34} />
          <h2>{t('이 계정은 직원 명부에 없습니다')}</h2>
          <p>
            {t('출퇴근은 직원 기록이 있어야 찍힙니다. 스케줄 앱의 직원 관리에서 본인을 직원으로 추가하고, 그 이름으로 로그인해 주세요.')}
          </p>
          <a className="button primary" href={'/' + query()}>
            <CalendarDays size={16} /> {t('스케줄 앱 열기')}
          </a>
        </section>
      )}
      {status && (
        <div role="status" className="statusbar punchstatus">
          {t(status)}
        </div>
      )}
      <GpsGuard state={gps.state} admin={actor.admin} onRetry={gps.retry} />
    </div>
  );
}
