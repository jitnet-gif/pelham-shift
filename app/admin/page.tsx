import StaffMap from './staff-map';

// 관리자 위치 지도. 출근을 찍어 둔 직원이 지금 어디 있는지 봅니다.
export const dynamic = 'force-dynamic';
export default function AdminPage() {
  return <StaffMap />;
}
