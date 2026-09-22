import ShiftApp from '../shift-app';

// 홈 화면의 주황 아이콘이 여는 자리입니다. 스케줄 앱과 같은 화면이지만 출퇴근 탭에서 시작합니다.
// 예전에는 이 주소가 '/' 로 넘기기만 했습니다. 이제 설치되는 앱의 start_url 이라 실제 화면이 있어야 합니다.
export default function Attendance() {
  return <ShiftApp landing="home" />;
}
