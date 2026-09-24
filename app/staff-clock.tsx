'use client';
// next/image 를 쓰지 않습니다. 방금 찍은 사진은 data URL 이라 서버에 보낼 것도 캐시할 것도 없습니다.
// oxlint-disable next/no-img-element
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlarmClock, Camera, Check, Coffee, Hourglass, LogOut } from 'lucide-react';
import type { Employee, Punch, Shift, Workplace } from '@/lib/domain';
import { say } from './say';
import { FIX_MAX_AGE_MS, type GpsState } from './gps-guard';
import { TIME_ZONE, distanceMeters, duration, earlyOut, minutes } from '@/lib/domain';
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
// 기록되었다는 말도 같은 시간만큼만 머뭅니다. 공용 단말은 이 시간이 지난 뒤에 다음 사람에게 넘어갑니다.
export const REVIEW_MS = 3000;
// 방금 찍고 나서 다시 누른 것으로 보는 시간.
// 찍혔는지 몰라 한 번 더 누르러 오는 사이 버튼은 반대로 바뀌어 있어서,
// 그대로 받으면 막 온 사람이 퇴근으로, 막 간 사람이 다시 출근으로 남습니다.
// 이 시간 안에 누른 것은 사진도 기록도 남기지 않고 지금 상태만 읽어 줍니다.
const REPEAT_MIN = 10;
// 매장 시각(온타리오)의 HH:MM. 찍히는 시각과 같은 기준이어야 '근무한 시간'이 어긋나지 않습니다.
const hhmm = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
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
  workplace,
  spot,
  gpsState,
  onLocate,
  onPunch,
  onBreak,
}: {
  employee?: Employee;
  punch?: Punch;
  shift?: Shift;
  location: string;
  busy: boolean;
  // 출퇴근을 찍을 수 있는 자리와 그 반경. 사진과 함께 지금 서 있는 자리도 보냅니다.
  workplace: Workplace;
  // 앱이 내내 지켜보고 있는 자리. 찍는 순간에만 위치를 켜는 일이 없도록 이 값을 씁니다.
  spot: { lat: number; lng: number; accuracy?: number; at?: number } | null;
  // 위치가 지금 켜져 있는지. 꺼져 있으면 출퇴근 버튼을 잠급니다.
  gpsState: GpsState;
  // 위치를 다시 확인해 달라는 부탁. 설정에서 켜고 돌아온 사람이 그 자리에서 누릅니다.
  onLocate: () => void;
  onPunch: (
    action: 'punchIn' | 'punchOut',
    photo: string,
    place?: { lat: number; lng: number; accuracy?: number },
    // 서버가 받아 주었는지 돌려줍니다. 받아 준 것만 '기록했습니다' 라고 말합니다.
  ) => void | Promise<boolean | void>;
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
  // 보내는 중인지, 무엇으로 남았는지. 찍힌 사진 위에 한 줄로 뜹니다.
  const [saved, setSaved] = useState<
    '' | 'saving' | 'in' | 'out' | 'earlyOut' | 'againIn' | 'againOut'
  >('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  // 마지막으로 잡은 프레임의 시각. 같은 값이 또 나오면 영상이 멈춘 것이고,
  // 그대로 찍으면 아까 찍힌 장면이 한 번 더 저장됩니다.
  const lastFrame = useRef(-1);
  // 지켜보던 자리를 아직 못 받았을 때, 누르면서 한 번 물어본 값. 화면에 남겨 두어야 왜 막혔는지 보입니다.
  const [fix, setFix] = useState<{ lat: number; lng: number } | null>(null);
  const here = spot ?? fix;
  // 서버가 재는 것과 같은 방법으로 잽니다 — 화면에서 통과한 것이 서버에서 막히면 안 됩니다.
  const away = here ? Math.round(distanceMeters(workplace, here)) : null;
  const tooFar = away !== null && away > workplace.radius;
  // 오래된 자리로는 찍지 못합니다. 아까 근무지에서 받아 둔 자리를 들고 나가는 일을 막습니다.
  // now 가 20초마다 움직이므로 자리가 늙는 것도 그 걸음으로 알아차립니다.
  const fresh = !!spot && spot.at !== undefined && now.getTime() - spot.at < FIX_MAX_AGE_MS;
  // 출퇴근을 찍을 수 있는 상태. 위치가 켜져 있고, 방금 받은 자리가 있고, 근무지 안이어야 합니다.
  const ready = gpsState === 'on' && fresh && !tooFar;
  // 마지막으로 찍힌 것. 무엇을 눌렀는지가 아니라 이것이 무엇으로 남았는지를 보고 다시 누른 것을 가립니다.
  const last = punch?.out
    ? ({ state: 'out', at: punch.out } as const)
    : punch
      ? ({ state: 'in', at: punch.in } as const)
      : null;
  // 찍힌 시각은 서버 시계, 지금은 이 기기 시계입니다. 조금 어긋난 폰에서 음수로 나와도 다시 누른 것은 다시 누른 것입니다.
  // 자정을 넘긴 값은 1440분쯤 벌어져 이 창에 들어오지 않고, 날이 바뀌면 punch 자체가 오늘 기록으로 새로 잡힙니다.
  const ago = last ? minutes(hhmm(now)) - minutes(last.at) : Infinity;
  // 10분 안에 다시 누른 것. 기록을 남기지 않고 지금 상태만 읽어 주므로 위치가 잡히지 않아도 받습니다 —
  // 찍혔는지 몰라 한 번 더 누르러 온 사람에게 잠긴 버튼은 아무 말도 해 주지 않습니다.
  const repeat = !!last && ago > -REPEAT_MIN && ago < REPEAT_MIN;
  // 지금 퇴근을 찍으면 예정 퇴근 시각보다 몇 분 이른지. 퇴근은 근무시간이 끝난 뒤에 찍는 것이고,
  // 그보다 일찍 찍은 것은 조퇴입니다. 막지는 않습니다 — 먼저 가는 사람도 퇴근은 찍혀야 하기 때문입니다.
  // 예정 근무가 없으면 기준이 없어 null 이고, 그때 퇴근은 지금까지와 똑같이 찍힙니다.
  const earlyNow = (at: Date) =>
    punch && !punch.out ? earlyOut(shift, punch.in, hhmm(at)) : null;

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
      if (savedTimer.current) clearTimeout(savedTimer.current);
      void audio.current?.close().catch(() => 0);
      audio.current = null;
    },
    [],
  );

  // 소리 장치는 누른 그 자리에서 깨워 둡니다.
  // 말하기가 실패해 뒤늦게 찰깍으로 돌아갈 때는 이미 누른 손가락과 이어지지 않아,
  // 그 자리에서 열어 두지 않으면 장치를 새로 열지 못하는 기기가 있습니다.
  const wake = () => {
    try {
      const Maker =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Maker) return null;
      const ctx = (audio.current ??= new Maker());
      void ctx.resume().catch(() => 0);
      return ctx;
    } catch {
      audio.current = null;
      return null;
    }
  };

  // 찰깍. 사진이 찍힌 순간을 소리로 알려 줍니다.
  // 소리 파일을 받아 두지 않고 그 자리에서 만들어 냅니다 — 기기가 조용하면 소리도 나지 않습니다.
  const click = () => {
    try {
      const ctx = wake();
      if (!ctx) return;
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

  // 찍힌 순간을 사람 말로 알려 줍니다. 읽어 줄 목소리가 없는 기기에서는 예전 찰깍 소리가 납니다.
  // 출근인지 퇴근인지까지 읽어 주어, 화면을 보지 않아도 무엇이 찍혔는지 압니다.
  const shutter = (action: 'punchIn' | 'punchOut') => {
    wake();
    // 세 마디를 한 마디 속도로 읽으면 한 덩어리로 뭉칩니다. 조금 눌러 읽습니다.
    say(action === 'punchIn' ? 'pelham check in' : 'pelham check out', click, 1.15);
  };

  // 이미 찍혀 있다는 말. 사진을 찍지 않았으니 찰깍은 내지 않습니다 — 그 소리는 사진이 남았다는 뜻입니다.
  const alreadySaid = (state: 'in' | 'out') => {
    say(state === 'in' ? 'pelham check in already' : 'pelham check out already', undefined, 1.15);
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
    // 이미 찍혀 있다는 말이 먼저입니다. 위치보다 앞에 두어야,
    // 찍혔는지 몰라 자리를 옮긴 사람도 까닭 없이 조용한 화면을 보지 않습니다.
    if (last && repeat) {
      if (reviewTimer.current) clearTimeout(reviewTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setReview('');
      setProblem('');
      alreadySaid(last.state);
      setSaved(last.state === 'in' ? 'againIn' : 'againOut');
      savedTimer.current = setTimeout(() => setSaved(''), REVIEW_MS);
      return;
    }
    // 위치가 없거나 근무지 밖이면 사진도 찍지 않습니다 —
    // 어차피 기록되지 않고, 까닭은 화면에 이미 떠 있습니다.
    if (!ready) return;
    // 조퇴인지는 누른 그 순간으로 가립니다. now 는 20초마다 걸어서, 예정 퇴근 시각을 막 지난 자리에서
    // 아직 걸어오지 않은 값을 보면 정시 퇴근이 조퇴로 남습니다.
    const early = action === 'punchOut' ? earlyNow(new Date()) : null;
    const taken = capture();
    if (!taken.photo) {
      setProblem(taken.problem || '사진이 찍히지 않았습니다.');
      return;
    }
    // 소리와 사진은 누른 그 자리에서 바로 내보냅니다.
    // 아래 await 를 지나고 나면 누른 손가락과 이어지지 않아 소리가 나지 않는 기기가 있습니다.
    shutter(action);
    if (reviewTimer.current) clearTimeout(reviewTimer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setReview(taken.photo);
    // 사진은 찍힌 순간부터 3초입니다. 저장이 늦어도 화면이 사진에 붙들려 있지 않습니다.
    reviewTimer.current = setTimeout(() => setReview(''), REVIEW_MS);
    setSaved('saving');
    // 출퇴근은 근무지 안에서만 찍힙니다. 어디서 눌렀는지 모르면 사진이 있어도 보내지 않습니다.
    let place: { lat: number; lng: number; accuracy?: number } | undefined = spot ?? undefined;
    // 지켜보던 값이 있으면 그대로 쓰고, 아직 첫 값을 못 받았을 때만 한 번 더 물어봅니다.
    if (!place) {
      setProblem('위치를 확인하는 중입니다…');
      place = (await locate()) ?? undefined;
      if (place) setFix(place);
    }
    if (!place) {
      setSaved('');
      setProblem('위치를 확인하지 못했습니다. 위치 권한을 허용하고 다시 눌러주세요.');
      return;
    }
    // 첫 자리를 방금 받은 길입니다. 여기서 처음 거리를 재고, 멀면 보내지 않습니다 — 까닭은 위 경고 줄이 말합니다.
    if (Math.round(distanceMeters(workplace, place)) > workplace.radius) {
      setSaved('');
      setProblem('');
      return;
    }
    setProblem('');
    setShot(taken.photo);
    // 서버가 받아 준 뒤에야 기록되었다고 말합니다. 보내다 실패하면 이 말은 나오지 않고 아래 줄에 까닭이 뜹니다.
    const kept = await onPunch(action, taken.photo, place);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    if (kept === false) {
      setSaved('');
      return;
    }
    // 조퇴도 퇴근은 퇴근입니다 — 기록은 그대로 남고, 조퇴라는 말만 한 줄 더 붙습니다.
    setSaved(action === 'punchIn' ? 'in' : early ? 'earlyOut' : 'out');
    savedTimer.current = setTimeout(() => setSaved(''), REVIEW_MS);
  };

  const working = punch && !punch.out ? punch : undefined;
  // 버튼 위 안내. 근무 중이고 아직 예정 퇴근 시각 전이면, 지금 찍으면 조퇴로 남는다고 미리 알립니다.
  const earlyBefore = earlyNow(now);
  const onBreakNow = (working?.breaks ?? []).find((b) => !b.end);
  // 지금까지 일한 시간(분). 화면에 오는 punch 는 늘 오늘 찍은 것이라 자정을 넘는 뺄셈은 없습니다.
  // 음수는 이 기기 시계가 매장 서버보다 조금 뒤처졌다는 뜻입니다 — 찍힌 시각은 서버 시계이기 때문입니다.
  // duration() 에 그대로 넣으면 음수를 하루로 되감아 23시간이 되고,
  // 막 출근한 사람의 '근무한 시간' 이 23시간으로 뜨며 아래 종료 안내까지 함께 뜹니다.
  const since = working ? Math.max(0, minutes(hhmm(now)) - minutes(working.in)) : 0;
  // 예정된 근무가 끝났는데 아직 퇴근이 찍히지 않은 상태입니다.
  // 견주는 것은 '지금 시각과 종료 시각' 이 아니라 '일한 시간과 근무 길이' 입니다.
  // 시계 글자(HH:MM)만으로는 02:00 이 오늘인지 어제인지 알 수 없어, 앞의 방법으로는
  // 22:00–02:00 근무가 출근하자마자 끝난 것으로 보입니다. 길이는 duration() 이 자정을 넘겨 재 줍니다.
  // 길이가 0 이면 예정 종료에 이르러서야 출근을 찍은 것입니다. 이미 지난 근무를 두고 다그치지 않습니다.
  const planned = working && shift ? duration(working.in, shift.end) : 0;
  const overdue = planned > 0 && since >= planned * 60;
  const stamp =
    new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: TIME_ZONE,
    }).format(now) +
    '  ' +
    new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: TIME_ZONE,
    }).format(now);
  const today = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: TIME_ZONE,
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
          {/* 보낸 결과. 얼굴을 가리지 않게 사진 아래쪽에 한 줄로 얹습니다.
              읽어 주는 것은 화면 아래 알림 줄이 맡습니다 — 같은 말을 두 번 읽지 않습니다. */}
          {saved && (
            <span
              className={'stclock-saved' + (saved === 'saving' ? '' : ' done')}
              aria-hidden="true"
            >
              {saved !== 'saving' && <Check size={16} />}
              {t(
                saved === 'saving'
                  ? '저장 중…'
                  : saved === 'in'
                    ? '출근을 기록했습니다.'
                    : saved === 'out'
                      ? '퇴근을 기록했습니다.'
                      : saved === 'earlyOut'
                        ? '조퇴 — 퇴근을 기록했습니다.'
                        : saved === 'againIn'
                          ? '이미 출근으로 찍혀 있습니다.'
                          : '이미 퇴근으로 찍혀 있습니다.',
              )}
            </span>
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
        {/* 위치가 꺼져 있으면 출퇴근을 찍을 수 없습니다. 어디서 푸는지는 앱을 덮는 안내가 말합니다. */}
        {gpsState !== 'on' && (
          <p role="alert" className="stclock-error">
            {t(
              gpsState === 'blocked'
                ? '위치가 꺼져 있어 출퇴근을 찍을 수 없습니다. 기기 설정에서 위치를 켜고 이 앱에 허용해 주세요.'
                : '위치를 확인하는 중입니다. 자리가 잡히면 출퇴근을 찍을 수 있습니다.',
            )}{' '}
            <button type="button" className="stclock-relocate" onClick={onLocate}>
              {t('다시 확인')}
            </button>
          </p>
        )}
        {/* 켜져 있어도 자리가 오래되었으면 지금 서 있는 곳이라 할 수 없습니다. */}
        {gpsState === 'on' && !fresh && (
          <p role="alert" className="stclock-error">
            {t('위치를 다시 잡는 중입니다. 자리가 잡히면 출퇴근을 찍을 수 있습니다.')}
          </p>
        )}
        {/* 근무지에서 멀면 버튼을 잠그고 얼마나 떨어졌는지 알립니다. 눌러도 기록되지 않기 때문입니다. */}
        {tooFar && (
          <p role="alert" className="stclock-error">
            {t('근무지에서 약 {n}m 떨어져 있습니다. {r}m 안에서만 출퇴근을 찍을 수 있습니다.', {
              n: away,
              r: workplace.radius,
            })}
          </p>
        )}
        {/* 퇴근은 근무시간이 끝난 뒤에 찍는 것입니다. 아직 그 전이라면 지금 찍으면 무엇으로 남는지 미리 말해 줍니다.
            막지는 않습니다 — 먼저 가는 사람도 퇴근은 찍고 가야 합니다. */}
        {shift && !!earlyBefore && (
          <p className="stclock-note">
            {t('예정 퇴근은 {t} 입니다. 지금 퇴근을 찍으면 {n}분 조퇴로 남습니다.', {
              t: clock(shift.end),
              n: earlyBefore,
            })}
          </p>
        )}
        {problem && (
          <p role="alert" className="stclock-error">
            {t(problem)}
          </p>
        )}
        {/* 근무가 예정대로 끝났는데 퇴근이 찍히지 않았습니다. 막는 말이 아니라 잊은 것을 짚어 주는 말이라,
            빨간 경고(.stclock-error)와 색도 역할도 나눕니다 — 눌러야 할 버튼 바로 위에 둡니다. */}
        {overdue && shift && (
          <output className="stclock-due">
            <AlarmClock size={19} aria-hidden="true" />
            <span>
              {t('근무 종료 시간({time})입니다. 퇴근을 찍어주세요.', {
                time: clock(shift.end),
              })}
            </span>
          </output>
        )}
        {/* 찍힌 사진이 떠 있는 동안에는 버튼을 잠급니다.
            앞사람 화면이 아직 남아 있는 3초 사이에 뒷사람이 눌러 버리는 일을 막습니다. */}
        <div className="stclock-actions">
        {working ? (
          <>
            <button
              className="stclock-break"
              disabled={busy || !!saved}
              onClick={() => onBreak(onBreakNow ? 'end' : 'start')}
            >
              <Coffee size={19} />
              {onBreakNow ? t('휴게 끝내기') : t('유급 휴게 시작')}
            </button>
            <button
              className="stclock-end"
              disabled={busy || !!saved || (!ready && !repeat)}
              onClick={() => void press('punchOut')}
            >
              {t('endshift::퇴근 찍기')}
              <LogOut size={20} />
            </button>
          </>
        ) : (
          <button
            className="stclock-start"
            disabled={busy || !!saved || (!ready && !repeat)}
            onClick={() => void press('punchIn')}
          >
            <Camera size={20} />
            {t('start::출근 찍기')}
          </button>
        )}
        </div>
      </div>
    </section>
  );
}
