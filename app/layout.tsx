import type { Metadata, Viewport } from 'next';
import './globals.css';
import './mobile.css';
import './tasks.css';
import './task-launch.css';
import './schedule-controls.css';
import './timeline.css';
import './month-schedule.css';
import './phone-schedule.css';
import './phone-team.css';
import './punch-log.css';
import './day-schedule.css';
import './whos-working.css';
import Fresh from './fresh';
import './birth-login.css';
import './app-shell.css';
import './phone-dialog.css';
import './staff.css';
import './time-picker.css';
import TaskLaunch from './task-launch';
// 화면 키보드가 올라오면 화면을 덮지 않고 그만큼 줄입니다.
// 이게 없으면 전체화면 시트에서 시계 아래 칸들이 키보드에 가려 손이 닿지 않습니다.
// 폰에서는 앱처럼 쓰도록 핀치 확대·축소를 막습니다. 최소 배율도 1로 묶어, 넓은 표가 있어도 화면 폭이 기기 폭을 넘지 않게 합니다.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, minimumScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover', interactiveWidget: 'resizes-content' };
export const metadata: Metadata = { title: 'Pelham Shift · Staff scheduling', description: 'Schedules, shift cover, attendance and estimated pay in one place.', manifest: '/manifest.webmanifest', icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }], apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] }, appleWebApp: { capable: true, title: 'Pelham Shift', statusBarStyle: 'default' } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}<TaskLaunch/><Fresh/></body></html>; }
