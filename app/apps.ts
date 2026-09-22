// 홈 화면에는 앱이 둘 깔립니다. 스케줄 앱('/')과 출퇴근 앱('/attendance').
// 주소마다 manifest 가 다르고 브라우저는 manifest 의 id 로 앱을 가르므로 아이콘도 둘 생깁니다.
// 설치 창·탭 제목·파비콘이 모두 여기를 봅니다. 앱을 고치려면 이 줄만 고치면 됩니다.
export const APPS = [
  {
    key: 'shift',
    path: '/',
    title: 'Pelham Shift · 근무 관리',
    name: 'Pelham Shift',
    icon: '/icons/icon-192.png',
    note: '스케줄·근무표·메시지',
  },
  {
    key: 'punch',
    path: '/attendance',
    title: 'Pelham Punch · 출퇴근',
    name: 'Check In',
    icon: '/icons/punch-192.png',
    note: '출근·퇴근·휴게 찍기',
  },
] as const;

export type AppKey = (typeof APPS)[number]['key'];

// 지금 열려 있는 주소가 어느 앱인지. 출퇴근 앱 안에서는 제목도 아이콘도 그 앱 것을 씁니다.
export const appAt = (path: string) => (path.startsWith('/attendance') ? APPS[1] : APPS[0]);
