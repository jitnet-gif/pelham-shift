'use client';
import './login-qr.css';
import { useEffect, useMemo, useState } from 'react';
import { encode } from 'uqr';
import { useLang } from './use-lang';
import { APPS } from './apps';

// 로그인 화면 아래에 두 앱의 주소를 QR 로 나란히 둡니다. 앱이 둘이라는 걸 로그인 전에 알려주는 자리이고,
// 단말 앞에 선 사람이 자기 휴대폰으로 그 자리에서 앱을 열 수 있게 하는 자리이기도 합니다.
// 주소는 지금 보고 있는 서버의 주소를 씁니다 — 미리 적어 두면 주소가 바뀔 때 QR 만 옛 곳을 가리킵니다.
export default function LoginQr() {
  const { t } = useLang();
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

  // ?team= 이 붙은 주소로 들어온 단말이면 QR 도 그 팀을 물려줘야 합니다.
  // 떼고 만들면 찍은 사람만 조용히 다른 팀으로 들어갑니다.
  const codes = useMemo(
    () =>
      !here
        ? []
        : APPS.map((app) => {
            const url =
              here.origin + app.path + (here.team ? '?team=' + encodeURIComponent(here.team) : '');
            const { data } = encode(url, { ecc: 'M', border: 2 });
            return {
              key: app.key,
              name: app.name,
              note: app.note,
              icon: app.icon,
              url,
              size: data.length,
              path: data
                .flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : '')))
                .join(''),
            };
          }),
    [here],
  );

  if (!codes.length) return null;

  return (
    <section className="login-qr panel">
      <h3>{t('휴대폰으로 열기')}</h3>
      <p>{t('휴대폰 카메라로 QR을 비추면 그 앱이 열립니다. 앱은 두 개, 주소도 두 개입니다.')}</p>
      <ul>
        {codes.map((code) => (
          <li key={code.key}>
            <span className="login-qr-name">
              <span className="login-qr-icon" style={{ backgroundImage: `url(${code.icon})` }} />
              <b>{t(code.name)}</b>
            </span>
            <small>{t(code.note)}</small>
            {/* QR 은 흰 바탕에 검정 그대로여야 읽힙니다. 화면 색을 입히지 않습니다. */}
            <svg
              className="qr"
              viewBox={`0 0 ${code.size} ${code.size}`}
              role="img"
              aria-label={t('앱 주소 QR 코드: ') + code.url}
              shapeRendering="crispEdges"
            >
              <rect width={code.size} height={code.size} fill="#fff" />
              <path d={code.path} fill="#000" />
            </svg>
            {/* 찍을 수 없는 자리에서는 주소를 눈으로 읽고 손으로 칩니다. */}
            <a className="login-qr-url" href={code.url}>
              {code.url}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
