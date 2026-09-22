'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Coffee, Delete, Hourglass, LogOut, Settings } from 'lucide-react';
import { duration } from '@/lib/domain';
import LangToggle from '../lang-toggle';
import { useLang } from '../use-lang';

// 매장에 두고 여럿이 함께 쓰는 출퇴근 화면입니다.
// 기기는 관리자 계정으로 한 번 로그인해 두고, 직원은 Punch ID 로 본인을 밝힙니다.
// 출근·퇴근은 그 자리에서 찍은 사진이 있어야만 기록됩니다.
type Snapshot = {
  location: string;
  employee: { id: string; name: string; color: string; role: string };
  shifts: { id: string; start: string; end: string; area: string }[];
  punch: {
    id: string;
    date: string;
    in: string;
    out?: string;
    area?: string;
    breaks: { start: string; end?: string; paid: boolean }[];
  } | null;
};
const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
// 자리를 비운 사이 남의 근무를 건드리지 않도록, 손을 떼면 곧 키패드로 돌아갑니다.
const IDLE_MS = 90_000;
// 저장할 사진 크기. 얼굴을 알아볼 만하면서 기록이 무거워지지 않는 선입니다.
const SHOT_WIDTH = 360;
const clock = (v: string) => {
  const h = Number(v.slice(0, 2));
  return `${h % 12 || 12}:${v.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
};
// 매장 시각(뉴욕)의 HH:MM. 찍히는 시각과 같은 기준이어야 '근무한 시간'이 어긋나지 않습니다.
const hhmm = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

export default function AttendanceKiosk() {
  const { t, locale } = useLang();
  const [now, setNow] = useState(() => new Date());
  const [device, setDevice] = useState<'loading' | 'ready' | 'blocked'>('loading');
  const [location, setLocation] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState('');
  const [camera, setCamera] = useState<'off' | 'on' | 'denied'>('off');
  const [settings, setSettings] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = () => (typeof window === 'undefined' ? '' : window.location.search);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  // 이 기기가 쓸 수 있는 상태인지 먼저 확인합니다. 직원 정보는 아직 오가지 않습니다.
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/attendance' + query());
        const data = (await r.json()) as { location?: string; error?: string };
        if (!r.ok) throw Error(data.error || '열 수 없습니다.');
        setLocation(data.location || '');
        setDevice('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : '열 수 없습니다.');
        setDevice('blocked');
      }
    })();
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    setCode('');
    setShot('');
    setError('');
  }, []);
  // 로그인해 있는 동안만 시계를 겁니다. 화면을 누를 때마다 다시 셉니다.
  useEffect(() => {
    if (!session) return;
    const restart = () => {
      if (idle.current) clearTimeout(idle.current);
      idle.current = setTimeout(() => {
        signOut();
        setError('자리를 비운 것 같아 로그아웃했습니다.');
      }, IDLE_MS);
    };
    restart();
    window.addEventListener('pointerdown', restart);
    return () => {
      if (idle.current) clearTimeout(idle.current);
      window.removeEventListener('pointerdown', restart);
    };
  }, [session, signOut]);

  // 카메라는 로그인한 동안만 켭니다. 화면을 나가면 곧바로 끕니다.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Error('no camera');
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!alive) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        if (video.current) video.current.srcObject = media;
        setCamera('on');
      } catch {
        if (alive) setCamera('denied');
      }
    })();
    return () => {
      alive = false;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setCamera('off');
    };
  }, [session]);

  // 지금 보이는 화면을 한 장 잡습니다. 까맣거나 가려져 있으면 사진으로 치지 않습니다.
  const capture = (): { photo?: string; problem?: string } => {
    const node = video.current;
    if (camera !== 'on' || !node || !node.videoWidth)
      return { problem: '사진을 찍을 수 없어 기록하지 않았습니다.' };
    const width = SHOT_WIDTH;
    const height = Math.round((node.videoHeight / node.videoWidth) * width);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { problem: '사진을 만들지 못했습니다. 다시 눌러주세요.' };
    ctx.drawImage(node, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    // 밝기의 평균과 퍼짐을 봅니다. 렌즈가 막히면 퍼짐이 거의 0 이 됩니다.
    let sum = 0;
    let squares = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4 * 16) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += luma;
      squares += luma * luma;
      count += 1;
    }
    const mean = sum / count;
    const spread = Math.sqrt(Math.max(0, squares / count - mean * mean));
    if (spread < 6 || mean < 12 || mean > 248)
      return { problem: '화면이 너무 어둡거나 가려져 있습니다. 카메라를 보고 다시 눌러주세요.' };
    const photo = canvas.toDataURL('image/jpeg', 0.62);
    // 내용이 제대로 담겼는지는 위 밝기 검사가 보고, 여기서는 사진이 만들어졌는지만 봅니다.
    return photo.startsWith('data:image/jpeg;base64,/9j/')
      ? { photo }
      : { problem: '사진을 만들지 못했습니다. 다시 눌러주세요.' };
  };

  async function send(punchId: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/attendance' + query(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ punchId, ...extra }),
      });
      const data = (await r.json()) as Snapshot & { error?: string };
      if (!r.ok) throw Error(data.error || '저장하지 못했습니다.');
      setSession(data);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  // 출근·퇴근은 사진이 먼저입니다. 사진이 없으면 서버로 보내지도 않습니다.
  async function punch(action: 'punchIn' | 'punchOut') {
    const { photo, problem } = capture();
    if (!photo) {
      setError(problem || '사진이 찍히지 않았습니다.');
      return;
    }
    const next = await send(code, { action, photo });
    if (!next) return;
    setShot(photo);
    // 퇴근까지 찍었으면 다음 사람을 위해 자리를 비웁니다.
    if (action === 'punchOut') setTimeout(signOut, 2500);
  }

  const stamp =
    new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    }).format(now) +
    '  ' +
    new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    }).format(now);

  if (device === 'blocked')
    return (
      <main className="kiosk">
        <section className="kiosk-stop">
          <Settings size={30} />
          <h1>{t('출퇴근 단말')}</h1>
          <p>{t(error)}</p>
          <a className="kiosk-link" href={'/' + query()}>
            {t('로그인하러 가기')}
          </a>
          <LangToggle />
        </section>
      </main>
    );

  // 로그인한 사람이 있습니다 — 지금 근무와 사진 찍는 화면을 보여 줍니다.
  if (session) {
    const punchNow = session.punch && !session.punch.out ? session.punch : null;
    const onBreak = punchNow?.breaks.find((b) => !b.end);
    const since = punchNow ? duration(punchNow.in, hhmm(now)) * 60 : 0;
    const shift = session.shifts[0];
    const today = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/New_York',
    }).format(now);
    const area = punchNow?.area || shift?.area || session.employee.role;
    return (
      <main className="kiosk">
        <header className="kiosk-top">
          <button className="kiosk-icon" aria-label={t('로그아웃')} onClick={signOut}>
            <ArrowLeft size={21} />
          </button>
          <h2>{stamp}</h2>
          <span className="kiosk-shot" aria-hidden="true">
            {/* 방금 찍힌 사진입니다 — 제대로 찍혔는지 그 자리에서 보입니다. */}
            <span
              style={
                shot
                  ? { backgroundImage: `url(${shot})` }
                  : { background: session.employee.color }
              }
            >
              {shot ? '' : session.employee.name.slice(0, 1)}
            </span>
          </span>
        </header>
        <div className="kiosk-who">
          <span className="kiosk-face" style={{ background: session.employee.color }}>
            {session.employee.name.slice(0, 1)}
          </span>
          <span className="kiosk-name">
            <b>{session.employee.name}</b>
            <em className={punchNow ? (onBreak ? 'onbreak' : 'in') : 'out'}>
              {punchNow ? (onBreak ? t('휴게 중') : t('출근 중')) : t('출근 전')}
            </em>
          </span>
          {punchNow && (
            <span className="kiosk-elapsed">
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
          )}
        </div>
        <div className="kiosk-body">
          {/* 사진 찍는 화면. 누르는 순간 여기 보이는 그대로가 기록에 남습니다. */}
          <div className={'kiosk-cam' + (camera === 'on' ? '' : ' off')}>
            <video ref={video} autoPlay muted playsInline />
            {camera !== 'on' && (
              <p>
                <Camera size={26} />
                {camera === 'denied'
                  ? t('카메라를 켤 수 없습니다. 기기 설정에서 카메라 권한을 허용해 주세요.')
                  : t('카메라를 켜는 중입니다…')}
              </p>
            )}
          </div>
          <p className="kiosk-camnote">{t('출근·퇴근은 사진이 찍혀야 기록됩니다.')}</p>
          <h3>{t('지금 근무')}</h3>
          <p className="kiosk-date">{today}</p>
          <div className="kiosk-card">
            <span className="kiosk-badge" style={{ background: session.employee.color }}>
              {(area || '?').slice(0, 1)}
            </span>
            <span>
              <b>
                {punchNow
                  ? clock(punchNow.in)
                  : shift
                    ? `${clock(shift.start)} – ${clock(shift.end)}`
                    : t('예정된 근무가 없습니다')}
              </b>
              <small>
                {session.employee.role}
                {area && area !== session.employee.role ? ` | ${area}` : ''}
              </small>
            </span>
          </div>
          {error && (
            <p role="alert" className="kiosk-error">
              {t(error)}
            </p>
          )}
          {punchNow ? (
            <>
              <button
                className="kiosk-break"
                disabled={busy}
                onClick={() =>
                  void send(code, { action: 'punchBreak', breakAction: onBreak ? 'end' : 'start' })
                }
              >
                <Coffee size={19} />
                {onBreak ? t('휴게 끝내기') : t('유급 휴게 시작')}
              </button>
              <button className="kiosk-end" disabled={busy} onClick={() => void punch('punchOut')}>
                {t('endshift::퇴근 찍기')}
                <LogOut size={20} />
              </button>
            </>
          ) : (
            <button className="kiosk-start" disabled={busy} onClick={() => void punch('punchIn')}>
              <Camera size={20} />
              {t('start::출근 찍기')}
            </button>
          )}
        </div>
      </main>
    );
  }

  // 아직 아무도 로그인하지 않았습니다 — Punch ID 를 받습니다.
  return (
    <main className="kiosk">
      <header className="kiosk-top">
        <button
          className="kiosk-icon"
          aria-label={t('설정')}
          aria-expanded={settings}
          onClick={() => setSettings((v) => !v)}
        >
          <Settings size={21} />
        </button>
        <h2>{stamp}</h2>
        <span className="kiosk-icon" aria-hidden="true" />
      </header>
      {/* 톱니는 이 단말의 설정입니다 — 표시 언어와 본 앱으로 돌아가는 길만 둡니다. */}
      {settings && (
        <div className="kiosk-settings">
          <LangToggle />
          <a href={'/' + query()}>{t('스케줄로 이동')}</a>
        </div>
      )}
      <div className="kiosk-place">
        <span className="kiosk-mark" aria-hidden="true" />
        <span>
          <b>{location}</b>
          <small>{t('출퇴근 단말')}</small>
        </span>
      </div>
      <div className="kiosk-pad">
        <p className="kiosk-ask">{t('Punch ID를 입력하세요')}</p>
        <output className="kiosk-code" aria-live="polite">
          {'•'.repeat(code.length)}
        </output>
        <div className="kiosk-keys">
          {PAD.map((key) => (
            <button
              key={key}
              disabled={busy}
              onClick={() => {
                setError('');
                setCode((v) => (v.length >= 8 ? v : v + key));
              }}
            >
              {key}
            </button>
          ))}
          <button className="word" disabled={busy} onClick={() => setCode('')}>
            {t('pad::지우기')}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setError('');
              setCode((v) => (v.length >= 8 ? v : v + '0'));
            }}
          >
            0
          </button>
          <button
            aria-label={t('한 자 지우기')}
            disabled={busy}
            onClick={() => setCode((v) => v.slice(0, -1))}
          >
            <Delete size={22} />
          </button>
        </div>
        {error && (
          <p role="alert" className="kiosk-error">
            {t(error)}
          </p>
        )}
        <button
          className="kiosk-signin"
          disabled={busy || device !== 'ready' || code.length < 4}
          onClick={() => void send(code)}
        >
          {t('signin::출근 찍기')}
        </button>
      </div>
    </main>
  );
}
