'use client';
import { useEffect, useRef } from 'react';

// 설치한 앱은 며칠씩 열린 채로 남아 옛 화면을 계속 띄웁니다.
// 앱으로 돌아올 때마다 서버 배포를 확인해, 바뀌었으면 스스로 새로고침합니다.
export default function Fresh() {
  const booted = useRef<string>('');
  useEffect(() => {
    let alive = true;
    const check = async (reload: boolean) => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok || !alive) return;
        const { version } = (await res.json()) as { version?: string };
        if (!version || !alive) return;
        if (!booted.current) {
          booted.current = version;
          return;
        }
        // 화면을 보고 있지 않다가 돌아온 순간에만 새로고침합니다. 입력 중에 날아가지 않게.
        if (reload && booted.current !== version) window.location.reload();
      } catch {
        // 오프라인이면 다음 기회에 확인합니다.
      }
    };
    void check(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);
  return null;
}
