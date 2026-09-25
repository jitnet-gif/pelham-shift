'use client';
import './punch-app.css';
import { savePunchPhoto } from './punch-photo-store';
import { useEffect, useState } from 'react';
import { Bell, BellRing, CalendarDays, LogOut } from 'lucide-react';
import { LOCATION, localDate, seed, workplaceOf, type State } from '@/lib/domain';
import { pushOn, relangPush, subscribePush } from '@/lib/push-client';
import { notice } from '@/lib/notice';
import { useLang } from './use-lang';
import GpsGuard, { useGps } from './gps-guard';
import StaffClock from './staff-clock';
import { useBack } from './use-back';
import BirthLogin from './birth-login';
import LoginQr from './login-qr';

// 홈 화면의 주황 아이콘이 여는 앱입니다. 스케줄 앱과 데이터는 같지만 화면은 시계 한 장뿐입니다.
// 일하러 온 사람이 찍기까지 한 번도 길을 고르지 않게 하려고 탭바도 사이드바도 두지 않았습니다.
// 로그인한 사람의 시계만 엽니다 — 누구냐고 다시 묻지 않습니다.
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
  // 출퇴근은 근무지 안에서만 찍히므로, 앱을 여는 동안 위치를 계속 지켜봅니다.
  const gps = useGps();
  // 출퇴근 앱은 시계 한 장뿐이라 되돌아갈 화면이 없습니다. 뒤로 가기는 앱을 닫지 않고 그대로 머뭅니다.
  useBack(() => {});
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
    // 전파가 잠깐 끊긴 것은 알리지 않습니다. 브라우저가 던지는 'Failed to fetch' 를
    // 그대로 띄우면 번역도 없이 띠에 박힌 채 남고, 30초 뒤 차례에 저절로 다시 붙습니다.
    let reached = false;
    try {
      const r = await fetch('/api/workspace' + query());
      reached = true;
      const json = (await r.json()) as Payload;
      if (r.status === 401) {
        setAuth('out');
        return undefined;
      }
      if (!r.ok) throw Error(json.error);
      setAuth('in');
      const at = ingest(json);
      setStatus('');
      return at;
    } catch (e) {
      setAuth((a) => (a === 'loading' ? 'out' : a));
      if (reached) setStatus(notice(e, '불러오지 못했습니다.'));
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

  // 로그인한 계정이 직원 명부에 없으면(고정 관리자 계정) 찍을 기록이 없습니다.
  // 번호를 다시 묻는 대신 스케줄 앱으로 보냅니다 — 관리자가 여기서 할 일은 없습니다.
  const me = data.employees.find((e) => e.id === actor.id);
  const leaving = auth === 'in' && !me;
  useEffect(() => {
    if (leaving) window.location.replace('/' + query());
  }, [leaving]);

  const send = (type: string, payload: Record<string, unknown>, at: number) =>
    fetch('/api/workspace' + query(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, version: at }),
    });

  const command = async (type: string, payload: Record<string, unknown> = {}) => {
    if (setup) {
      setStatus('아직 워크스페이스가 없습니다. 관리자가 먼저 만들어야 기록이 남습니다.');
      return null;
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
      return json.state ?? null;
    } catch (e) {
      setStatus(notice(e, '기록하지 못했습니다.'));
      return null;
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
      setStatus(notice(e, '알림을 켜지 못했습니다.'));
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
            <LoginQr />
          </>
        )}
      </div>
    );

  // 스케줄 앱으로 넘어가는 중입니다. 그 사이 시계를 잠깐 보여 주지 않습니다.
  if (!me)
    return (
      <div className="login-screen">
        <span className="brand">
          <span className="brandmark" aria-hidden="true" />
          pelham<span className="brandlight">punch</span>
        </span>
        <p className="login-loading">{t('스케줄 앱을 엽니다…')}</p>
      </div>
    );

  // 매장 시각으로 본 오늘. 찍힌 기록과 근무표가 모두 이 날짜를 기준으로 삼습니다.
  const today = localDate(new Date(tick));
  const myPunch = [...(data.punches ?? [])]
    .reverse()
    .find((p) => p.employeeId === me.id && p.date === today);
  const myShiftToday = data.shifts
    .filter((s) => s.employeeId === me.id && s.date === today)
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
      <StaffClock
        employee={me}
        punch={myPunch}
        shift={myShiftToday}
        location={LOCATION}
        busy={busy}
        workplace={workplaceOf(data)}
        spot={gps.spot}
        gpsState={gps.state}
        onLocate={gps.retry}
        onPunch={async (action, photo, place) => {
          const next = await command(action, {
            employeeId: me.id,
            photo,
            // 번호는 로그인한 사람의 기록에서 그대로 보냅니다 — 화면에서 다시 묻지 않습니다.
            punchId: me.punchId ?? '',
            ...place,
          });
          if (next) {
            // 사진은 이 기기에만 남깁니다. 방금 남은 기록에 묶어 두어야 나중에 찾습니다.
            const mine = (next.punches ?? []).filter((x) => x.employeeId === me.id).at(-1);
            if (mine) void savePunchPhoto(mine.id, action === 'punchIn' ? 'in' : 'out', photo);
          }
          return !!next;
        }}
        onBreak={(action) => void command('punchBreak', { employeeId: me.id, action, paid: '1' })}
      />
      {status && (
        <div role="status" className="statusbar punchstatus">
          {t(status)}
        </div>
      )}
      <GpsGuard state={gps.state} admin={actor.admin} onRetry={gps.retry} />
    </div>
  );
}
