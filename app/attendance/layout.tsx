import type { Metadata, Viewport } from 'next';

// 출퇴근 앱은 스케줄 앱과 같은 코드를 쓰지만, 홈 화면에는 따로 깔립니다.
// 그러려면 이 주소만 다른 manifest 를 가리켜야 합니다 — 브라우저는 manifest 의 id 로 앱을 구분합니다.
// 아이콘·테마색도 주황으로 갈라 두 아이콘이 한눈에 구분되게 했습니다.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#e2650f',
};

export const metadata: Metadata = {
  // 이 글은 서버가 그대로 내보내므로 t() 를 거치지 않습니다. 화면 말과 같게 영어로 적어 둡니다.
  title: 'Pelham Punch · Time clock',
  description: 'Punch in, punch out and take breaks straight from your phone.',
  manifest: '/manifest-punch.webmanifest',
  icons: {
    icon: [
      { url: '/icons/punch-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/punch-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // 아이폰은 manifest 의 아이콘을 보지 않고 이 태그만 봅니다. 없으면 화면을 찍어 아이콘으로 씁니다.
    apple: [{ url: '/icons/punch-apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Punch In', statusBarStyle: 'default' },
};

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
