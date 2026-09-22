// 출퇴근 앱 아이콘을 만듭니다. 스케줄 앱과 같은 로고를 쓰되 바탕색을 주황으로 바꿔,
// 홈 화면에 두 앱이 나란히 있어도 한눈에 구분됩니다. 색을 바꾸려면 PUNCH 를 고치고 다시 실행하세요.
//   node scripts/make-punch-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { ImageResponse } from 'next/og.js';

const PUNCH = '#e2650f';
const logo = 'data:image/png;base64,' + readFileSync('public/icons/icon-512.png').toString('base64');

// 로고는 흰 원 안에 둡니다. 주황 바탕에 로고의 베이지·검정이 묻히지 않게 하는 유일한 방법입니다.
const badge = (size, inner) => {
  const disc = Math.round(size * inner);
  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: PUNCH,
      },
      children: {
        type: 'div',
        props: {
          style: {
            width: disc, height: disc, borderRadius: disc, background: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          },
          children: {
            type: 'img',
            props: { src: logo, width: Math.round(disc * 0.9), height: Math.round(disc * 0.9) },
          },
        },
      },
    },
  };
};

// maskable 은 기기가 가장자리를 잘라내므로 안쪽 80% 안에 담습니다.
const files = [
  ['public/icons/punch-192.png', 192, 0.86],
  ['public/icons/punch-512.png', 512, 0.86],
  ['public/icons/punch-maskable-512.png', 512, 0.66],
  ['public/icons/punch-apple-touch-icon.png', 180, 0.86],
];

for (const [path, size, inner] of files) {
  const png = new ImageResponse(badge(size, inner), { width: size, height: size });
  writeFileSync(path, Buffer.from(await png.arrayBuffer()));
  console.log(path, size);
}
