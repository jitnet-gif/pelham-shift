import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Pelham Shift · 근무 관리', description: '직원 스케줄, 대체근무, 출근기록과 예상 급여를 한곳에서 관리하세요.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ko"><body>{children}</body></html>; }
