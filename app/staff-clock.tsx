'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Coffee, Hourglass, LogOut } from 'lucide-react';
import type { Employee, Punch, Shift } from '@/lib/domain';
import { duration } from '@/lib/domain';
import { useLang } from './use-lang';

// 직원이 자기 폰으로 출퇴근을 찍는 화면입니다.
// 누구인지는 로그인으로 이미 알고 있으니 번호를 다시 묻지 않고, 대신 그 자리에서 사진을 한 장 남깁니다.
// 사진이 제대로 찍히지 않으면 출근도 퇴근도 기록되지 않습니다.
const clock = (v: string) => {
  const h = Number(v.slice(0, 2));
  return `${h % 12 || 12}:${v.slice(3, 5)}${h < 12 ? 'AM' : 'PM'}`;
};
// 저장할 사진 크기. 얼굴을 알아볼 만하면서 기록이 무거워지지 않는 선입니다.
const SHOT_WIDTH = 360;
// 매장 시각(뉴욕)의 HH:MM. 찍히는 시각과 같은 기준이어야 '근무한 시간'이 어긋나지 않습니다.
const hhmm = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

export default function StaffClock({
  employee,
  punch,
  shift,
  location,
  busy,
  needsLocation,
  onPunch,
  onBreak,
}: {
  employee?: Employee;
  punch?: Punch;
  shift?: Shift;
  location: string;
  busy: boolean;
  // 근무지를 지정해 둔 곳이면, 사진과 함께 지금 서 있는 자리도 보냅니다.
  needsLocation: boolean;
  onPunch: (
    action: 'punchIn' | 'punchOut',
    photo: string,
    place?: { lat: number; lng: number },
  ) => void;
  onBreak: (action: 'start' | 'end') => void;
}) {
  const { t, locale } = useLang();
  // 헤더 시계와 '근무한 시간'은 분이 바뀌면 같이 움직입니다.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(timer);
  }, []);
  const [camera, setCamera] = useState<'off' | 'on' | 'denied'>('off');
  const [problem, setProblem] = useState('');
  const [shot, setShot] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  // 이 화면에 머무는 동안만 카메라를 켭니다. 다른 탭으로 옮기면 곧바로 끕니다.
  useEffect(() => {
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
  }, []);

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
  // 기기에 지금 자리를 물어봅니다. 권한이 없거나 신호를 못 잡으면 찍지 않습니다.
  const locate = () =>
    new Promise<{ lat: number; lng: number } | null>((done) => {
      if (!navigator.geolocation) return done(null);
      navigator.geolocation.getCurrentPosition(
        (spot) => done({ lat: spot.coords.latitude, lng: spot.coords.longitude }),
        () => done(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    });
  // 출근·퇴근은 사진이 먼저입니다. 사진이 없으면 서버로 보내지도 않습니다.
  const press = async (action: 'punchIn' | 'punchOut') => {
    const taken = capture();
    if (!taken.photo) {
      setProblem(taken.problem || '사진이 찍히지 않았습니다.');
      return;
    }
    let place: { lat: number; lng: number } | undefined;
    if (needsLocation) {
      setProblem('위치를 확인하는 중입니다…');
      place = (await locate()) ?? undefined;
      if (!place) {
        setProblem('위치를 확인하지 못했습니다. 위치 권한을 허용하고 다시 눌러주세요.');
        return;
      }
    }
    setProblem('');
    setShot(taken.photo);
    onPunch(action, taken.photo, place);
  };

  const working = punch && !punch.out ? punch : undefined;
  const onBreakNow = (working?.breaks ?? []).find((b) => !b.end);
  const since = working ? duration(working.in, hhmm(now)) * 60 : 0;
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
  const today = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(now);
  const area = working?.area || shift?.area || employee?.role;

  return (
    <section className="stclock">
      <header className="stclock-top">
        <span className="stclock-icon" aria-hidden="true" />
        <h2>{stamp}</h2>
        <span className="stclock-shot" aria-hidden="true">
          {/* 방금 찍힌 사진입니다 — 제대로 찍혔는지 그 자리에서 보입니다. */}
          <span
            style={shot ? { backgroundImage: `url(${shot})` } : { background: employee?.color }}
          >
            {shot ? '' : employee?.name.slice(0, 1)}
          </span>
        </span>
      </header>
      <div className="stclock-who">
        <span className="stclock-face" style={{ background: employee?.color }}>
          {employee?.name.slice(0, 1)}
        </span>
        <span className="stclock-name">
          <b>{employee?.name}</b>
          <em className={working ? (onBreakNow ? 'onbreak' : 'in') : 'out'}>
            {working ? (onBreakNow ? t('휴게 중') : t('출근 중')) : t('출근 전')}
          </em>
        </span>
        {working && (
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
        )}
      </div>
      <div className="stclock-body">
        {/* 사진 찍는 화면. 누르는 순간 여기 보이는 그대로가 기록에 남습니다. */}
        <div className={'stclock-cam' + (camera === 'on' ? '' : ' off')}>
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
        <p className="stclock-camnote">{t('출근·퇴근은 사진이 찍혀야 기록됩니다.')}</p>
        <h3>{t('지금 근무')}</h3>
        <p className="stclock-date">{today}</p>
        <div className="stclock-card">
          <span className="stclock-badge" style={{ background: employee?.color }}>
            {(area || '?').slice(0, 1)}
          </span>
          <span>
            <b>
              {working
                ? clock(working.in)
                : shift
                  ? `${clock(shift.start)}–${clock(shift.end)} (${duration(shift.start, shift.end)}${t('h::시간')})`
                  : t('예정된 근무가 없습니다')}
            </b>
            <small>
              {employee?.role}
              {area && area !== employee?.role ? ` | ${area}` : ''} · {location}
            </small>
          </span>
        </div>
        {problem && (
          <p role="alert" className="stclock-error">
            {t(problem)}
          </p>
        )}
        {working ? (
          <>
            <button
              className="stclock-break"
              disabled={busy}
              onClick={() => onBreak(onBreakNow ? 'end' : 'start')}
            >
              <Coffee size={19} />
              {onBreakNow ? t('휴게 끝내기') : t('유급 휴게 시작')}
            </button>
            <button className="stclock-end" disabled={busy} onClick={() => void press('punchOut')}>
              {t('endshift::퇴근 찍기')}
              <LogOut size={20} />
            </button>
          </>
        ) : (
          <button className="stclock-start" disabled={busy} onClick={() => void press('punchIn')}>
            <Camera size={20} />
            {t('start::출근 찍기')}
          </button>
        )}
      </div>
    </section>
  );
}
