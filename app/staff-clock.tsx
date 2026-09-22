'use client';
// next/image 를 쓰지 않습니다. 방금 찍은 사진은 data URL 이라 서버에 보낼 것도 캐시할 것도 없습니다.
// oxlint-disable next/no-img-element
import { useCallback, useEffect, useRef, useState } from 'react';
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
// 찍힌 사진을 화면에 크게 띄워 두는 시간. 이 뒤에는 다시 카메라가 보입니다.
const REVIEW_MS = 3000;
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
  spot,
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
  // 앱이 내내 지켜보고 있는 자리. 찍는 순간에만 위치를 켜는 일이 없도록 이 값을 씁니다.
  spot: { lat: number; lng: number; accuracy?: number } | null;
  onPunch: (
    action: 'punchIn' | 'punchOut',
    photo: string,
    place?: { lat: number; lng: number; accuracy?: number },
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
  // 방금 찍힌 사진. 누른 자리에서 잠깐 크게 보여 주고 다시 카메라로 돌아갑니다.
  const [review, setReview] = useState('');
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  // 마지막으로 잡은 프레임의 시각. 같은 값이 또 나오면 영상이 멈춘 것이고,
  // 그대로 찍으면 아까 찍힌 장면이 한 번 더 저장됩니다.
  const lastFrame = useRef(-1);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  // 이미 살아 있는 카메라는 그대로 둡니다. 꺼졌거나 잠든 것만 다시 엽니다.
  const start = useCallback(async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (track && track.readyState === 'live' && !track.muted) return;
    stop();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error('no camera');
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        void video.current.play().catch(() => 0);
      }
      // 새로 연 카메라입니다. 지난 프레임과 지난 사진은 여기서 버립니다.
      lastFrame.current = -1;
      setShot('');
      setCamera('on');
    } catch {
      setCamera('denied');
    }
  }, [stop]);

  // 이 화면에 머무는 동안만 카메라를 켭니다. 다른 탭으로 옮기면 곧바로 끕니다.
  useEffect(() => {
    void start();
    // 화면을 떠날 때는 카메라만 끕니다. 상태는 이 컴포넌트와 함께 사라집니다.
    return stop;
  }, [start, stop]);

  // 화면으로 돌아오면 카메라를 다시 살핍니다.
  // 잠자던 사이 영상이 멈춰 있으면, 다음에 찍는 것이 잠들기 직전 장면이 됩니다.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === 'visible') void start();
    };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [start]);

  // 화면을 떠날 때 띄워 둔 사진과 소리 장치를 함께 거둡니다.
  useEffect(
    () => () => {
      if (reviewTimer.current) clearTimeout(reviewTimer.current);
      void audio.current?.close().catch(() => 0);
      audio.current = null;
    },
    [],
  );

  // 찰깍. 사진이 찍힌 순간을 소리로 알려 줍니다.
  // 소리 파일을 받아 두지 않고 그 자리에서 만들어 냅니다 — 기기가 조용하면 소리도 나지 않습니다.
  const shutter = () => {
    try {
      const Maker =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Maker) return;
      const ctx = (audio.current ??= new Maker());
      void ctx.resume().catch(() => 0);
      // 짧게 터졌다 바로 잦아드는 소리. 셔터가 열리고 닫히는 두 번입니다.
      const tick = (at: number, loud: number) => {
        const length = Math.round(ctx.sampleRate * 0.03);
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const wave = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1)
          wave[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 2600;
        band.Q.value = 0.9;
        const volume = ctx.createGain();
        volume.gain.value = loud;
        source.connect(band).connect(volume).connect(ctx.destination);
        source.start(at);
      };
      const at = ctx.currentTime;
      tick(at, 0.5);
      tick(at + 0.08, 0.3);
    } catch {
      // 소리를 내지 못해도 사진과 기록은 그대로입니다. 다음 번에 다시 만들어 봅니다.
      audio.current = null;
    }
  };

  // 지금 보이는 화면을 한 장 잡습니다. 까맣거나 가려져 있으면 사진으로 치지 않습니다.
  const capture = (): { photo?: string; problem?: string } => {
    const node = video.current;
    if (camera !== 'on' || !node || !node.videoWidth)
      return { problem: '사진을 찍을 수 없어 기록하지 않았습니다.' };
    const track = stream.current?.getVideoTracks()[0];
    // 멈춰 있거나 잠든 영상에서 찍으면 지난 장면이 그대로 저장됩니다. 찍지 않고 카메라를 다시 엽니다.
    if (node.paused || node.ended || node.readyState < 2 || !track || track.readyState !== 'live' || track.muted) {
      void start();
      return { problem: '카메라가 멈춰 있습니다. 잠시 뒤 다시 눌러주세요.' };
    }
    if (node.currentTime === lastFrame.current) {
      void start();
      return { problem: '카메라 화면이 멈춰 있습니다. 잠시 뒤 다시 눌러주세요.' };
    }
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
    lastFrame.current = node.currentTime;
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
    // 소리와 사진은 누른 그 자리에서 바로 내보냅니다.
    // 아래 await 를 지나고 나면 누른 손가락과 이어지지 않아 소리가 나지 않는 기기가 있습니다.
    shutter();
    if (reviewTimer.current) clearTimeout(reviewTimer.current);
    setReview(taken.photo);
    reviewTimer.current = setTimeout(() => setReview(''), REVIEW_MS);
    // 자리는 근무지를 지정하지 않은 곳에서도 기록에 남깁니다.
    // 다만 '그 자리에서만 찍을 수 있게' 막는 것은 근무지를 지정한 곳에서만입니다.
    let place: { lat: number; lng: number; accuracy?: number } | undefined = spot ?? undefined;
    if (needsLocation) {
      // 지켜보던 값이 있으면 그대로 쓰고, 아직 첫 값을 못 받았을 때만 한 번 더 물어봅니다.
      if (!place) {
        setProblem('위치를 확인하는 중입니다…');
        place = (await locate()) ?? undefined;
      }
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
          {/* 방금 찍힌 사진. 저장되는 그대로라서 거울처럼 뒤집지 않습니다. */}
          {review && <img className="stclock-still" src={review} alt={t('방금 찍은 사진')} />}
          {camera !== 'on' && !review && (
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
            {!working && !shift && (
              <small className="stclock-free">{t('일정이 없어도 찍을 수 있습니다.')}</small>
            )}
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
        <div className="stclock-actions">
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
      </div>
    </section>
  );
}
