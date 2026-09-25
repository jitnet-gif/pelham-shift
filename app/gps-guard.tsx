'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { useLang } from './use-lang';
import { distanceMeters } from '@/lib/domain';

// at: 이 자리를 받은 시각. 오래된 자리로는 출퇴근을 찍지 못하게 하려고 함께 들고 다닙니다.
export type Spot = { lat: number; lng: number; accuracy: number; at: number };
export type GpsState = 'asking' | 'on' | 'blocked';
// 앱을 쓰는 동안 위치를 계속 지켜봅니다.
// 출퇴근을 찍을 때만 잠깐 켜고 끄면, 찍는 순간에만 근무지에 있는 척할 수 있습니다.
// 브라우저는 앱이 기기 위치를 대신 켜 주지 못합니다. 할 수 있는 것은 셋뿐입니다 —
// 물어볼 수 있는 상태면 계속 다시 묻고, 사람이 설정에서 켜는 순간 스스로 알아차리고,
// 그때까지 출퇴근을 막습니다.
const RETRY_MS = 5000;
// 신호를 못 잡는 일은 건물 안에서 흔합니다. 몇 번을 내리 놓쳐야 '꺼졌다'고 봅니다.
const MISSES_BEFORE_BLOCKED = 3;
// 출퇴근에 쓸 수 있는 자리의 나이. 이보다 오래된 자리는 지금 서 있는 곳이라 할 수 없습니다.
export const FIX_MAX_AGE_MS = 120000;

export function useGps() {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [state, setState] = useState<GpsState>('asking');
  const watch = useRef<number | null>(null);
  // 내리 놓친 횟수. 한 번 놓쳤다고 화면을 덮으면 잠깐 흐려진 신호에도 앱이 닫힙니다.
  const misses = useRef(0);
  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setSpot(null);
      setState('blocked');
      return;
    }
    setState((was) => (was === 'on' ? was : 'asking'));
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = navigator.geolocation.watchPosition(
      (found) => {
        misses.current = 0;
        setSpot({
          lat: found.coords.latitude,
          lng: found.coords.longitude,
          accuracy: found.coords.accuracy,
          at: Date.now(),
        });
        setState('on');
      },
      (error) => {
        // 권한을 막은 것은 그 자리에서 '꺼짐'입니다. 다시 물어도 창이 뜨지 않습니다.
        if (error.code === error.PERMISSION_DENIED) {
          misses.current = 0;
          setSpot(null);
          setState('blocked');
          return;
        }
        // 신호를 못 잡거나 늦는 것은 다릅니다. 몇 번을 내리 놓친 뒤에야 꺼진 것으로 봅니다 —
        // 기기 설정에서 위치 서비스를 끄면 이 길로 들어오는 기기가 있습니다.
        misses.current += 1;
        if (misses.current >= MISSES_BEFORE_BLOCKED) {
          setSpot(null);
          setState('blocked');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 },
    );
  }, []);
  useEffect(() => {
    start();
    return () => {
      if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
      watch.current = null;
    };
  }, [start]);
  // 꺼져 있는 동안에는 스스로 계속 다시 물어봅니다. 사람이 누르지 않아도 됩니다.
  // 아직 묻는 중일 때는 건드리지 않습니다 — 떠 있는 권한 창을 5초마다 새로 여는 꼴이 됩니다.
  useEffect(() => {
    if (state !== 'blocked') return;
    const again = setInterval(start, RETRY_MS);
    return () => clearInterval(again);
  }, [state, start]);
  // 설정에서 위치를 켜는 순간 바로 이어 붙입니다. 이 신호를 주지 않는 브라우저에서는
  // 위의 되묻기와 아래 화면 복귀가 대신 맡습니다.
  useEffect(() => {
    let watcher: PermissionStatus | null = null;
    const changed = () => start();
    try {
      void navigator.permissions
        ?.query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          watcher = status;
          status.addEventListener('change', changed);
        })
        .catch(() => 0);
    } catch {
      // 이 브라우저는 권한 상태를 알려주지 않습니다. 되묻기로 충분합니다.
    }
    return () => watcher?.removeEventListener('change', changed);
  }, [start]);
  // 화면을 다시 보게 되면 한 번 더 확인합니다 — 그 사이 설정에서 위치를 켜고 왔을 수 있습니다.
  useEffect(() => {
    const again = () => document.visibilityState === 'visible' && start();
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [start]);
  useBeacon(spot);
  return { spot, state, retry: start };
}

// 관리자 지도(/admin)에 지금 자리를 알립니다. 받을지 말지는 서버가 정합니다 —
// 출근을 찍어 둔 동안에만 저장하고, 그 밖에는 { tracking: false } 로 돌려보냅니다.
// 웹앱이라 앱이 화면에 떠 있는 동안에만 보냅니다. 화면을 끄면 마지막 자리가 남습니다.
const BEACON_EVERY_MS = 60000;
// 움직였으면 1분을 기다리지 않고 보냅니다. 다만 건물 안에서는 가만히 있어도 자리가 수십 m 씩 튀므로,
// 오차보다 크게 움직였을 때만, 그리고 적어도 이만큼은 띄워서 보냅니다 — 몇 초마다 서버를 두드리지 않게.
const BEACON_MOVED_M = 30;
const BEACON_MIN_GAP_MS = 20000;
const BEACON_TICK_MS = 15000;
// 출근 전·퇴근 뒤·로그인 전에는 이만큼 쉬었다가 다시 물어봅니다. 너무 길면 출근 직후 지도에 늦게 뜹니다.
const BEACON_IDLE_MS = 120000;
function useBeacon(spot: Spot | null) {
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const quietUntil = useRef(0);
  const latest = useRef(spot);
  const send = useCallback(() => {
    const spot = latest.current;
    if (!spot || document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now < quietUntil.current) return;
    const was = last.current;
    if (was) {
      const gap = now - was.at;
      const moved = distanceMeters(was, spot) >= Math.max(BEACON_MOVED_M, spot.accuracy);
      if (gap < BEACON_MIN_GAP_MS || (gap < BEACON_EVERY_MS && !moved)) return;
    }
    last.current = { lat: spot.lat, lng: spot.lng, at: now };
    void fetch('/api/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: spot.lat, lng: spot.lng, accuracy: spot.accuracy }),
      keepalive: true,
    })
      .then(async (res) => {
        // 로그인 전이거나 받지 않는 때입니다. 쉬었다가 다시 물어봅니다 — 로그인 화면에서도 이 훅이 돌기 때문입니다.
        const body = (await res.json().catch(() => null)) as { tracking?: boolean } | null;
        if (res.status === 401 || res.status === 403 || body?.tracking === false) {
          quietUntil.current = Date.now() + BEACON_IDLE_MS;
          last.current = null;
        }
      })
      .catch(() => 0);
  }, []);
  useEffect(() => {
    latest.current = spot;
    send();
  }, [spot, send]);
  // 가만히 서 있으면 기기가 새 자리를 주지 않습니다. 그래도 '아직 여기 있다'는 것은 알려야 하므로 자주 들여다보고,
  // 보내는 간격은 위의 1분이 정합니다.
  useEffect(() => {
    const tick = setInterval(send, BEACON_TICK_MS);
    return () => clearInterval(tick);
  }, [send]);
}

// 위치가 꺼져 있는 동안 앱을 덮는 화면. 관리자는 덮지 않습니다 —
// 근무지 설정을 풀 수 있는 사람까지 갇히면 아무도 되돌릴 수 없기 때문입니다.
// 다만 출퇴근 버튼은 관리자에게도 잠깁니다. 그것은 출퇴근 화면이 맡습니다.
export default function GpsGuard({
  state,
  admin,
  onRetry,
}: {
  state: GpsState;
  admin: boolean;
  onRetry: () => void;
}) {
  const { t } = useLang();
  if (state === 'on') return null;
  if (admin)
    return (
      <div role="status" className="gps-note">
        <MapPin size={16} />
        {state === 'asking'
          ? t('위치를 확인하는 중입니다…')
          : t('이 기기에서 위치가 꺼져 있습니다. 직원은 위치를 켜야 앱을 쓸 수 있습니다.')}
      </div>
    );
  return (
    <div className="gps-block" role="alertdialog" aria-label={t('위치 확인 필요')}>
      <div>
        <MapPin size={34} />
        <h2>{state === 'asking' ? t('위치를 확인하는 중입니다…') : t('위치를 켜주세요')}</h2>
        <p>
          {state === 'asking'
            ? t('잠시만 기다려 주세요.')
            : t('근무지에서 일하는 동안에만 앱이 열립니다. 기기 설정에서 위치를 켜고, 이 앱에 위치 권한을 허용해 주세요.')}
        </p>
        {/* 한 번 막아 둔 권한은 다시 물어도 창이 뜨지 않습니다. 어디서 푸는지 알려 주어야 합니다. */}
        {state === 'blocked' && (
          <p className="gps-how">
            {t('아이폰: 설정 > 개인정보 보호 및 보안 > 위치 서비스를 켜고, 설정 > Safari > 위치에서 이 사이트를 허용으로 바꿉니다.')}
            <br />
            {t('안드로이드: 주소창의 자물쇠 > 사이트 설정 > 위치를 허용으로 바꾸고, 기기 설정에서 위치를 켭니다.')}
          </p>
        )}
        {/* 묻는 중에도 눌러 볼 수 있어야 합니다. 권한 창을 닫아 버린 사람에게는 이 버튼이 유일한 길입니다. */}
        <button className="button primary" onClick={onRetry}>
          <RefreshCw size={16} /> {t('다시 확인')}
        </button>
      </div>
    </div>
  );
}
