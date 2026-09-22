'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { useLang } from './use-lang';

export type Spot = { lat: number; lng: number; accuracy: number };
// 앱을 쓰는 동안 위치를 계속 지켜봅니다.
// 출퇴근을 찍을 때만 잠깐 켜고 끄면, 찍는 순간에만 근무지에 있는 척할 수 있습니다.
// 그래서 근무지를 지정해 둔 곳에서는 앱을 여는 동안 위치가 켜져 있어야 합니다.
export function useGps(required: boolean) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [state, setState] = useState<'off' | 'asking' | 'on' | 'blocked'>('off');
  const watch = useRef<number | null>(null);
  const start = useCallback(() => {
    if (!required) return;
    if (!navigator.geolocation) {
      setState('blocked');
      return;
    }
    setState((was) => (was === 'on' ? was : 'asking'));
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = navigator.geolocation.watchPosition(
      (found) => {
        setSpot({
          lat: found.coords.latitude,
          lng: found.coords.longitude,
          accuracy: found.coords.accuracy,
        });
        setState('on');
      },
      // 권한을 막았거나 신호를 못 잡으면 더 이상 쓸 수 없습니다.
      () => setState('blocked'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 },
    );
  }, [required]);
  useEffect(() => {
    if (!required) {
      setState('off');
      setSpot(null);
      return;
    }
    start();
    return () => {
      if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
      watch.current = null;
    };
  }, [required, start]);
  // 화면을 다시 보게 되면 한 번 더 확인합니다 — 그 사이 위치를 꺼 두었을 수 있습니다.
  useEffect(() => {
    if (!required) return;
    const again = () => document.visibilityState === 'visible' && start();
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [required, start]);
  return { spot, state, retry: start };
}

// 위치가 꺼져 있는 동안 앱을 덮는 화면. 관리자는 덮지 않습니다 —
// 근무지 설정을 풀 수 있는 사람까지 갇히면 아무도 되돌릴 수 없기 때문입니다.
export default function GpsGuard({
  state,
  admin,
  onRetry,
}: {
  state: 'off' | 'asking' | 'on' | 'blocked';
  admin: boolean;
  onRetry: () => void;
}) {
  const { t } = useLang();
  if (state === 'off' || state === 'on') return null;
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
        {state === 'blocked' && (
          <button className="button primary" onClick={onRetry}>
            <RefreshCw size={16} /> {t('다시 확인')}
          </button>
        )}
      </div>
    </div>
  );
}
