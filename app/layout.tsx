import type { Metadata } from 'next';
import './globals.css';
import './mobile.css';
import './tasks.css';
import './task-launch.css';
import './schedule-controls.css';
import './timeline.css';
import './month-schedule.css';
import './birth-login.css';
import './password-change.css';
import TaskLaunch from './task-launch';
export const metadata: Metadata = { title: 'Pelham Shift · 근무 관리', description: '직원 스케줄, 대체근무, 출근기록과 예상 급여를 한곳에서 관리하세요.', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'Pelham Shift', statusBarStyle: 'default' } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ko"><body>{children}<TaskLaunch/></body></html>; }
