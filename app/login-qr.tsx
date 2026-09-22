'use client';
import './login-qr.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { encode } from 'uqr';
import { Copy, Check } from 'lucide-react';
import { useLang } from './use-lang';
import { appAt } from './apps';

// 로그인 화면 아래에 스케줄 앱 주소를 QR 하나로 둡니다. 출퇴근 앱은 여기 두지 않습니다 —
// 로그인하러 온 사람에게 길을 둘 내밀면 고르는 일이 먼저 생깁니다. 두 앱 설치는 로그인한 뒤
// 관리자 화면의 '앱 설치 QR' 에서 안내합니다.
// 주소는 지금 보고 있는 서버의 주소를 씁니다 — 미리 적어 두면 주소가 바뀔 때 QR 만 옛 곳을 가리킵니다.
export default function LoginQr() {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const link = useRef<HTMLInputElement>(null);
  // 이 화면은 서버가 먼저 그립니다. 그때는 주소가 없으므로 브라우저에 붙은 뒤에 읽습니다.
  // 그리는 중에 window 를 읽으면 서버 그림과 어긋납니다.
  const [here, setHere] = useState<{ origin: string; team: string } | null>(null);
  useEffect(() => {
    // 지금 주소에 붙은 것 중 team 하나만 들고 갑니다. 주소줄은 광고·추적 꼬리가 붙은 채 열릴 수 있고,
    // 통째로 옮기면 그걸 본 적 없는 휴대폰들이 그대로 물려받게 됩니다.
    setHere({
      origin: window.location.origin,
      team: new URLSearchParams(window.location.search).get('team') || '',
    });
  }, []);

  // 스케줄 앱('/'). 어느 줄이 그 앱인지는 apps.ts 가 정합니다.
  const app = appAt('/');
  // ?team= 이 붙은 주소로 들어온 단말이면 QR 도 그 팀을 물려줘야 합니다.
  // 떼고 만들면 찍은 사람만 조용히 다른 팀으로 들어갑니다.
  const url = here
    ? here.origin + app.path + (here.team ? '?team=' + encodeURIComponent(here.team) : '')
    : '';
  const code = useMemo(() => {
    if (!url) return null;
    const { data } = encode(url, { ecc: 'M', border: 2 });
    return {
      size: data.length,
      path: data
        .flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : '')))
        .join(''),
    };
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {
      // 클립보드를 막아 둔 브라우저가 있습니다. 여기서 조용히 끝내면 단추가 먹통으로 보입니다.
    }
    // 그런 곳에서는 주소를 골라 둡니다 — 누른 사람이 그대로 Ctrl+C 를 누르면 됩니다.
    const box = link.current;
    if (!box) return;
    box.focus();
    box.select();
    try {
      // 옛 방법이 아직 되는 브라우저면 이걸로 끝납니다.
      if (document.execCommand('copy')) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // 둘 다 막혔으면 골라 둔 것까지가 우리가 할 수 있는 전부입니다.
    }
  }

  if (!code) return null;

  return (
    <section className="login-qr panel">
      <h3>{t('휴대폰으로 열기')}</h3>
      <p>{t('휴대폰 카메라로 QR을 비추면 앱이 열립니다. 아래 주소를 복사해 보내도 됩니다.')}</p>
      {/* QR 은 흰 바탕에 검정 그대로여야 읽힙니다. 화면 색을 입히지 않습니다. */}
      <svg
        className="qr"
        viewBox={`0 0 ${code.size} ${code.size}`}
        role="img"
        aria-label={t('앱 주소 QR 코드: ') + url}
        shapeRendering="crispEdges"
      >
        <rect width={code.size} height={code.size} fill="#fff" />
        <path d={code.path} fill="#000" />
      </svg>
      {/* 눌러서 복사하고, 클립보드를 못 쓰는 곳에서는 칸을 눌러 직접 고릅니다. */}
      <div className="login-qr-copy">
        <input
          ref={link}
          readOnly
          value={url}
          aria-label={t('앱 주소')}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="button" onClick={() => void copy()}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? t('복사됨') : t('복사')}
        </button>
      </div>
    </section>
  );
}
