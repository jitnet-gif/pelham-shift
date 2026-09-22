import type { Metadata, Viewport } from 'next';
import './globals.css';
import './mobile.css';
import './tasks.css';
import './task-launch.css';
import './schedule-controls.css';
import './timeline.css';
import './month-schedule.css';
import './phone-schedule.css';
import './day-schedule.css';
import './whos-working.css';
import Fresh from './fresh';
import './birth-login.css';
import './password-change.css';
import './app-shell.css';
import './phone-dialog.css';
import './staff.css';
import './time-picker.css';
import TaskLaunch from './task-launch';
// 화면 키보드가 올라오면 화면을 덮지 않고 그만큼 줄입니다.
// 이게 없으면 전체화면 시트에서 시계 아래 칸들이 키보드에 가려 손이 닿지 않습니다.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', interactiveWidget: 'resizes-content' };
export const metadata: Metadata = { title: 'Pelham Shift · 근무 관리', description: '직원 스케줄, 대체근무, 출근기록과 예상 급여를 한곳에서 관리하세요.', manifest: '/manifest.webmanifest', icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }], apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] }, appleWebApp: { capable: true, title: 'Pelham Shift', statusBarStyle: 'default' } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ko"><body>{children}<TaskLaunch/><Fresh/></body></html>; }
