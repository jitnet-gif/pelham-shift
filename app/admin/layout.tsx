import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './admin.css';

// 관리자만 여는 따로 떨어진 화면입니다. 직원 앱처럼 홈 화면에 깔리는 앱이 아니라 manifest 를 두지 않습니다.
// 로그인은 스케줄 앱과 같은 세션을 씁니다 — 거기서 관리자로 들어와 있으면 여기도 그대로 열립니다.
export const metadata: Metadata = {
  // 이 글은 서버가 그대로 내보내므로 t() 를 거치지 않습니다. 화면 말과 같게 영어로 적어 둡니다.
  title: 'Pelham Admin · Staff map',
  description: 'Where checked-in staff are right now.',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
