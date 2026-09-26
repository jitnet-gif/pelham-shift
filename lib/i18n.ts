// English/Korean text. Korean source strings are the keys, so the Korean messages the server sends translate on the client too.
export type Lang = 'ko' | 'en';
export type Vars = Record<string, string | number>;

// 화면에 나가는 말은 하나뿐입니다. 화면도 서버가 보내는 알림도 이 한 줄을 봅니다.
// 여기를 'ko' 로 되돌리면 한국어 원문이 그대로 보입니다 — 번역 열쇠가 곧 한국어이기 때문입니다.
export const SCREEN_LANG: Lang = 'en';

export const isLang = (value: unknown): value is Lang => value === 'ko' || value === 'en';
export const locale = (lang: Lang) => (lang === 'en' ? 'en-US' : 'ko-KR');
export const weekdays = (lang: Lang) =>
  lang === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['일', '월', '화', '수', '목', '금', '토'];

const en: Record<string, string> = {
  // App shell and navigation
  'Pelham Shift · 근무 관리': 'Pelham Shift · Staff scheduling',
  '근무 스케줄': 'Team shifts',
  '근무 현황': "Who's working",
  '근무 중': 'On now',
  // 퇴근을 찍지 않은 채 날이 바뀐 기록. '근무 중'과 달리 지금 일하는 사람이 아닙니다.
  '퇴근 미기록': 'No check-out',
  '종료': 'Done',
  '오늘 근무': 'Scheduled',
  '오늘 누가 나와 있는지 출근 순서대로 봅니다. 실제 출근 기록이 아니라 예정된 근무 기준입니다.':
    'Who is on the floor today, in the order they start. It follows the schedule, not the time clock.',
  '이 날 예정된 근무가 없습니다.': 'No shifts are scheduled for this day.',
  '미기록': 'Overdue',
  'punch::출근': 'In',
  'punch::퇴근': 'Out',
  '기록 없음': 'No check-in',
  '{a} 출근 · {b} 퇴근': 'in {a} · out {b}',
  '{a} 출근': 'in {a}',
  '출근 찍기': 'Check in',
  '퇴근 찍기': 'Check out',
  '아직 출근을 찍지 않았습니다.': 'You have not checked in yet.',
  '출근으로 찍혀 있습니다.': 'You are checked in.',
  '오늘 퇴근까지 찍었습니다.': 'You are checked out for today.',
  '일을 시작할 때 눌러주세요. 찍히는 시각은 매장 서버 시각입니다.':
    'Press it when you start. The time comes from the club server, not your phone.',
  ' 출근': ' in',
  '출근 기록': 'Attendance',
  '급여 관리': 'Payroll',
  '대체 근무': 'Shift swaps',
  메시지: 'Messages',
  'field::메시지': 'Message',
  '직원 관리': 'Staff',
  '팀 워크스페이스': 'Team workspace',
  '메시지 보기': 'View messages',
  관리자: 'Manager',
  비밀번호: 'Password',
  '작업 수신함': 'Task inbox',
  '팀의 시간, 더 간편하게.': "Your team's time, made simple.",
  '주요 메뉴': 'Main menu',
  '불러오는 중…': 'Loading…',
  '다시 불러오기': 'Reload',
  선택하세요: 'Select',
  저장: 'Save',
  '저장 중…': 'Saving…',
  닫기: 'Close',
  수정: 'Edit',
  '설정 필요': 'Not set',
  미등록: 'Not set',

  // Status messages
  '불러오지 못했습니다.': 'Could not load.',
  '저장했습니다.': 'Saved.',
  '바꾼 내용을 팀 워크스페이스에 기록했습니다.': 'Your change is recorded in the team workspace.',
  '저장하지 못했습니다.': 'Could not save.',
  '먼저 워크스페이스를 생성하세요. 샘플 데이터는 저장되지 않습니다.':
    'Create your workspace first. Sample data is not saved.',
  '이 브라우저에서는 푸시 알림을 켤 수 없습니다. iPhone은 Safari 공유 버튼 → 홈 화면에 추가한 뒤, 홈 화면 앱에서 켜세요.':
    "Push notifications aren't available in this browser. On iPhone, tap Safari's Share button → Add to Home Screen, then turn them on from the home screen app.",
  '알림 권한이 허용되지 않았습니다. 브라우저 설정에서 이 사이트의 알림을 허용하세요.':
    'Notification permission was not granted. Allow notifications for this site in your browser settings.',
  '이 기기에서 푸시 알림을 켰습니다. 출근 1시간 전 알림과 우천 공지를 받습니다.':
    "Push notifications are on for this device. You'll get a reminder 1 hour before each shift, plus rain notices.",
  '알림을 켜지 못했습니다.': 'Could not turn on notifications.',
  '테스트 알림을 보냈습니다. 잠시 후 이 기기에 표시됩니다.':
    'Test notification sent. It will appear on this device shortly.',
  '알림을 받을 기기가 없습니다. 푸시 알림을 다시 켜세요.':
    'No device is set up to receive notifications. Turn push notifications on again.',
  '테스트 알림을 보내지 못했습니다.': 'Could not send the test notification.',
  '열을 연결하고 검토한 다음 저장하세요.': 'Match the columns, review, then save.',

  // Schedule tab
  '좋은 한 주는, 좋은 스케줄부터.': 'A good week starts with a good schedule.',
  '팀의 근무를 한눈에 확인하고, 함께 계획하세요.':
    "See the team's shifts at a glance and plan together.",
  '스케줄부터 실제 근무시간까지, 같은 기록으로 연결합니다.':
    'From the schedule to actual hours worked, all in one record.',
  '우천 근무 종료': 'Rain closure',
  // 스케줄 화면의 날씨 칸
  '날씨': 'Weather',
  '날씨와 일출·일몰': 'Weather, sunrise and sunset',
  '일출': 'Sunrise',
  '일몰': 'Sunset',
  '낮 길이': 'Daylight',
  '최고 · 최저': 'High · low',
  '강수 확률': 'Chance of rain',
  '바람': 'Wind',
  '체감': 'Feels like',
  '날씨를 불러오는 중입니다.': 'Loading the weather…',
  '날씨를 불러오지 못했습니다.': 'The weather could not be loaded.',
  '다시 시도': 'Try again',
  '이 날짜는 예보 범위를 벗어났습니다.': 'This date is outside the forecast range.',
  '근무지 좌표가 없어 날씨를 불러올 수 없습니다. 출퇴근 반경을 먼저 설정해주세요.':
    'The weather needs the workplace coordinates. Set the check-in radius first.',
  '맑음': 'Clear',
  '대체로 맑음': 'Mostly clear',
  '구름 조금': 'Partly cloudy',
  '흐림': 'Overcast',
  '안개': 'Fog',
  '이슬비': 'Drizzle',
  '비': 'Rain',
  '눈': 'Snow',
  '소나기': 'Showers',
  '진눈깨비': 'Sleet',
  '뇌우': 'Thunderstorms',
  '우박을 동반한 뇌우': 'Thunderstorms with hail',
  '날씨 정보 없음': 'No weather reading',
  '안전하게 장비를 정리하고 퇴근 기록을 남겨주세요.':
    'Please put the equipment away safely and check out.',
  '샘플 미리보기 · 실제 운영을 시작하면 샘플 일정은 비워집니다.':
    'Sample preview · The sample schedule is cleared once you start for real.',
  '내 워크스페이스 생성': 'Create my workspace',
  '출근 알림 · 오늘 {start}, {area} 근무가 1시간 이내에 시작됩니다.':
    'Shift reminder · Your {area} shift today at {start} starts within 1 hour.',
  '출근 기록 없음 · {start}, {area} 근무가 시작됐습니다. 출근을 찍어 주세요.':
    'Not checked in · Your {area} shift started at {start}. Please check in.',
  '이번 주 근무': 'Shifts this week',
  개: 'shifts',
  '{n}명의 직원과 함께하는 한 주': 'A week with {n} staff',
  '예정 근무시간': 'Scheduled hours',
  시간: 'hrs',
  '{n}시간': '{n} hrs',
  '등록된 스케줄 기준': 'Based on the saved schedule',
  '대체근무 요청': 'Swap requests',
  건: 'requests',
  '확인이 필요한 요청이 있습니다': 'Some requests need review',
  '모든 요청을 확인했습니다': 'All requests reviewed',
  '출근 준비, 잊지 않도록': 'Never miss a shift',
  '근무 시작 1시간 전 알림': 'Reminder 1 hour before each shift',
  '이 기기 푸시 알림 켜짐': 'Push notifications on for this device',
  '앱 접속 중 알림 · 이 기기 푸시 꺼짐': 'In-app reminders only · push off on this device',
  '테스트 알림 보내기': 'Send test notification',
  '푸시 알림 켜기': 'Turn on push notifications',
  '직원 화면': 'Staff view',
  '읽기 전용': 'Read-only',
  '전체 일정과 내 기록만 볼 수 있습니다.':
    'You can see the full schedule and only your own records.',
  '이전 주': 'Previous week',
  '다음 주': 'Next week',
  '이번 주': 'This week',
  '직원 공개 중': 'Published to staff',
  '작성 중': 'Draft',
  '직원에게 공개': 'Publish to staff',
  '스케줄 공개 (근무 1건)': 'Publish Schedule (1 shift)',
  '스케줄 공개 (근무 {n}건)': 'Publish Schedule ({n} shifts)',
  '근무 추가': 'Add shift',
  메뉴: 'Menu',
  '대시보드': 'Dashboard',
  '휴무': 'Time off',
  '근무 가능 시간': 'Availability',
  '팀': 'Team',
  '도움말': 'Help',
  '스케줄 공개': 'Publish schedule',
  '인건비': 'Labor',
  '예정': 'Scheduled',
  '이번 주 예정 시간 중 비중': "Share of this week's scheduled hours",
  '휴무 신청': 'Request time off',
  '불가 신청': 'Unavailability requested',
  '근무 불가': 'Unavailable',
  '휴무·불가 시간과 겹치는 근무입니다': 'This shift overlaps time off or unavailability',
  '준비 중': 'Coming soon',
  '오늘 근무자, 이번 주 근무시간과 인건비, 처리할 요청을 한 화면에 모아 보여줄 예정입니다.': "Today's staff, this week's hours and labor cost, and requests to review, all on one screen.",
  '스케줄 작성, 휴무·근무 가능 시간, 대체 근무 사용법 안내를 준비하고 있습니다.': 'Guides for building schedules, time off and availability, and shift swaps.',
  '확인이 필요한 요청 · 휴무 {a}건 · 근무 불가 시간 {b}건':
    'Requests to review · {a} time off · {b} unavailability',
  '확인하기': 'Review',
  '종일': 'All day',
  '대기 중': 'Pending',
  '승인됨': 'Approved',
  '거절됨': 'Declined',
  '휴무 추가': 'Add time off',
  '상태': 'Status',
  '전체': 'All',
  '기간': 'Dates',
  '사유': 'Reason',
  '겹치는 근무': 'Overlapping shifts',
  '{n}개': '{n}',
  '승인': 'Approve',
  '거절': 'Decline',
  '삭제': 'Delete',
  '이 메시지를 삭제할까요? 직원 화면에서도 사라집니다.':
    'Delete this message? It disappears from the staff screens too.',
  '취소': 'Cancel',
  '표시할 휴무가 없습니다.': 'No time off to show.',
  '직원 휴무 신청을 확인하고 승인하세요. 승인된 휴무와 겹치는 근무는 스케줄에 경고로 표시됩니다.': 'Review and approve time off requests. Shifts that overlap approved time off are flagged on the schedule.',
  '휴무는 시작일 7일 전까지 신청할 수 있고, 관리자가 승인합니다. 대기 중인 신청은 직접 취소할 수 있습니다.':
    'Request time off at least 7 days before it starts; your manager approves it. You can cancel a request while it is pending.',
  '근무 불가 시간 추가': 'Add unavailability',
  '매주 반복되는 근무 불가 시간입니다. 승인된 불가 시간과 겹치는 근무는 스케줄에 경고로 표시됩니다.': 'Weekly recurring unavailability. Shifts that overlap approved unavailability are flagged on the schedule.',
  '매주 일할 수 없는 요일·시간을 등록하면 관리자가 승인합니다. 등록일로부터 7일 뒤 근무부터 적용됩니다.':
    "Add the days and times you can't work each week; your manager approves them. They apply to shifts from 7 days after you add them.",
  '대기': 'Pending',
  '종일 불가': 'Unavailable all day',
  '불가': 'unavailable',
  '{name} {day} 근무 불가 시간 추가': 'Add unavailability for {name} on {day}',
  '가능': 'Available',
  '등록된 근무 불가 시간': 'Unavailability',
  '요일': 'Day',
  '메모': 'Note',
  '등록된 근무 불가 시간이 없습니다.': 'No unavailability added.',
  '모든 요일에 근무할 수 있는 것으로 표시됩니다.': 'Everyone shows as available every day.',
  '하루 종일': 'All day',
  '시작 시간': 'Start time',
  '종료 시간': 'End time',
  '시간 단위 휴무는 하루만 신청할 수 있습니다.': 'Partial-day time off covers a single date.',
  '사유 (선택)': 'Reason (optional)',
  '종일 근무 불가': 'Unavailable all day',
  '불가 시작': 'Unavailable from',
  '불가 종료': 'Unavailable until',
  '메모 (선택)': 'Note (optional)',
  '관리자가 등록하면 바로 승인되고 오늘 근무부터 적용됩니다. 매주 같은 요일에 반복 적용됩니다.':
    'Entries added by a manager are approved right away, apply from today and repeat every week.',
  '관리자가 승인하면 매주 같은 요일에 반복 적용됩니다. 등록일로부터 7일 뒤 근무부터 적용됩니다.':
    'Once approved, this repeats on the same day every week. It applies to shifts from 7 days after you add it.',
  '휴무는 시작일 7일 전까지 신청할 수 있습니다.': 'Time off must be requested at least 7 days before it starts.',
  '적용 시작일': 'Effective from',
  '종료일이 시작일보다 빠릅니다.': 'The end date is before the start date.',
  '휴무는 한 번에 최대 62일까지 신청할 수 있습니다.': 'Time off can cover at most 62 days at once.',
  '휴무 요청을 찾을 수 없습니다.': 'Time off request not found.',
  '승인된 휴무는 관리자에게 취소를 요청하세요.': 'Ask your manager to cancel approved time off.',
  '요일을 선택하세요.': 'Choose a day.',
  '같은 요일에 이미 등록된 근무 불가 시간이 있습니다. 기존 항목을 삭제한 뒤 다시 등록하세요.': 'That day already has unavailability. Delete it first, then add it again.',
  '근무 불가 시간을 찾을 수 없습니다.': 'Unavailability not found.',
  '이미 신청한 휴무와 날짜가 겹칩니다.': 'These dates overlap time off you already requested.',
  '화면 버전': 'Layout',
  '기본 화면 · 위쪽 탭 메뉴': 'Classic · tabs across the top',
  '왼쪽 메뉴 · 근무 현황과 하루 보기': 'Side menu · who is working and the day',
  '메뉴 펼치기': 'Expand menu',
  '메뉴 접기': 'Collapse menu',
  '메뉴 열기': 'Open menu',
  '메뉴 닫기': 'Close menu',
  작업: 'Tasks',
  로그아웃: 'Log out',
  공개됨: 'Published',
  '모든 업무': 'All roles',
  정렬: 'Sort',
  이름순: 'Sorted by name',
  '직원 ID순': 'Sorted by employee ID',
  보기: 'View',
  주간: 'Week view',
  일간: 'Day view',
  게시됨: 'Published',
  '이전 날': 'Previous day',
  '다음 날': 'Next day',
  '직원 {n}명': '{n} employees',
  미지정: 'Unassigned',
  '{name} 근무 추가': 'Add a shift for {name}',
  내일: 'Tomorrow',
  월간: 'Month view',
  '직원 검색': 'Search employees',
  '근무 인원': 'People working',
  '{h}시간': '{h} hrs',
  '{name} {date} 근무 추가': 'Add shift for {name} on {date}',
  '조건에 맞는 직원이 없습니다.': 'No employees match these filters.',
  '예정 합계': 'Scheduled',
  '근무 시간 수정': 'Edit shift',
  '시간 수정': 'Edit time',
  '저장하면 스케줄이 작성 중 상태로 바뀝니다. 수정 후 직원에게 공개를 다시 누르세요.':
    'Saving puts the schedule back into draft. Press Publish to staff again after editing.',
  '수정할 근무를 선택하세요.': 'Choose the shifts to edit.',
  '한 번에 최대 1,000개 근무를 수정할 수 있습니다.': 'You can edit up to 1,000 shifts at once.',
  '변경할 내용을 입력하세요.': 'Enter what to change.',
  '근무를 찾을 수 없습니다. 새로고침 후 다시 시도하세요.': 'Shift not found. Reload and try again.',
  '전체 월간 일정 · 읽기 전용': 'Full monthly schedule · read-only',
  직원: 'Employee',
  '모든 직원': 'All staff',
  '기준 날짜': 'Date',
  '전체 일정 보기': 'View full schedule',
  '{n}명': '{n}',
  '대체 · ': 'Swap · ',
  '직원별 컬러는 모든 화면에서 동일하게 표시됩니다.':
    "Each employee's color is the same on every screen.",
  '대체 신청·승인 · 근무일 7일 전까지': 'Swap request & approval · at least 7 days before the shift',
  '실제 출근기록으로 정확하게': 'Accurate, from real attendance records',
  '출근기계 엑셀·CSV를 업로드하면 근무시간과 예상 급여를 계산합니다.':
    "Upload the time clock's Excel or CSV export to calculate hours and estimated pay.",
  '출근기록 가져오기 →': 'Import attendance →',
  '월간 근무 일정': 'Monthly schedule',
  '이전 달': 'Previous month',
  '다음 달': 'Next month',
  오늘: 'Today',
  '{date} 일정 보기': 'View {date}',

  // Attendance tab
  // 관리자는 이름 목록에서 한 사람을 고르고, 그 사람 출근부를 2주 급여 기간씩 넘겨 봅니다.
  '이름을 고르면 그 사람 출근부를 2주 급여 기간씩 봅니다.':
    'Pick a name to read that person’s timesheet, one two-week pay period at a time.',
  '직원별 출근 기록': 'Attendance by employee',
  '등록된 직원이 없습니다.': 'No employees have been added yet.',
  '이번 기간 {n}건 · {h}시간': '{n} this period · {h} h',
  '마지막 기록 {date}': 'Last seen {date}',
  '찍힌 기록 없음': 'No check-ins',
  '퇴사': 'Left',
  '확인 대기 {n}': '{n} awaiting review',
  '아직 끝난 근무가 없습니다': 'No finished shifts yet',
  '근무 중 {n}': '{n} on shift',
  '퇴근 미기록 {n}': '{n} missing check-out',
  '직원 목록': 'All employees',
  '이전 급여 기간': 'Previous pay period',
  '다음 급여 기간': 'Next pay period',
  '{n}건 · {h}시간': '{n} shifts · {h} h',
  '진행 중인 기간': 'Open period',
  '마감된 기간': 'Closed period',
  '이 기간에 출근기계 기록이 없습니다.': 'No time clock records in this period.',
  '단말에서 찍힌 출퇴근과 그때 찍힌 사진을 봅니다.':
    'The check-ins taken on the time clock, with the photo from that moment.',
  '찍힌 출퇴근': 'Check-ins',
  '출퇴근 추가': 'Add check-in',
  '출퇴근 수정': 'Edit check-in',
  '출퇴근 삭제': 'Delete check-in',
  '이 출퇴근 기록을 지울까요? 급여에서 빠지고 직원 화면에서도 사라집니다.':
    'Delete this check-in? It comes out of pay and disappears from the staff screen too.',
  '출근 기록에서 고치기': 'Fix in check-in records',
  '시급 수정': 'Edit hourly rate',
  '퇴근이 출근보다 이르면 다음 날 퇴근으로 계산합니다. 고친 기록은 직원이 다시 확인하도록 확인 대기로 돌아갑니다.':
    'If check-out is earlier than check-in, it counts as the next day. The edited record goes back to pending so the employee confirms it again.',
  '아직 퇴근하지 않은 근무는 고칠 수 없습니다.': 'A shift that has not checked out yet cannot be edited.',
  '출근기계에서 가져온 기록': 'Imported from the time clock',
  '아직 찍힌 출퇴근 기록이 없습니다.': 'No check-ins have been recorded yet.',
  // 'Awaiting review' 는 메시지의 '확인 대기'(Not read yet)와 뜻이 달라 앞가지로 갈라 둡니다.
  'review::확인 대기': 'Awaiting review',
  '확인됨': 'Confirmed',
  '이의 있음': 'Disputed',
  '휴게 {n}분': 'break {n} min',
  '무급 {n}분': 'unpaid {n} min',
  '위치 없음': 'No location',
  '사진 보기': 'View photo',
  '사진 확인됨': 'Photo checked',
  '출근기록 가져오기': 'Import attendance',
  '내 출근 기록': 'My attendance',
  '직원 ID로 연결합니다. 중복·겹치는 기록은 저장하지 않습니다.':
    'Records are matched by employee ID. Duplicate or overlapping records are not saved.',
  '출근기계 기록을 읽기 전용으로 확인합니다.': 'Your time clock records (read-only).',
  '엑셀 양식': 'Excel template',
  '출근기계에서 내보낸 엑셀·CSV 파일을 선택하세요':
    'Choose the Excel or CSV file exported from the time clock',
  '.xlsx · .csv · 최대 5MB / 3,000행': '.xlsx · .csv · up to 5 MB / 3,000 rows',
  '출근기계 타임카드 · 기록 {n}건': 'Time clock timecard · {n} records',
  '이 형식은 열을 연결할 필요가 없습니다. 이름으로 직원을 찾아 넣습니다.':
    'This format needs no column matching. Staff are found by name.',
  '직원을 찾지 못한 이름 {n}개 · 확인하고 승인하세요':
    '{n} name(s) with no staff record · review and approve',
  '비슷한 이름을 미리 골라 두었습니다. 승인하면 이 이름은 다음 임포트부터 같은 직원으로 자동 연결됩니다.':
    'The closest name is preselected. Once approved, this name is linked to that employee on every later import.',
  '연결할 직원': 'Link to employee',
  '기록 {n}건': '{n} records',
  '기록 {n}건 · 퇴근 미기록 {open}건': '{n} records · {open} with no check-out',
  '승인해 둔 이름 연결 {n}개': '{n} approved name link(s)',
  '연결 해제': 'Unlink',
  '출근기계에 찍힌 이름을 확인하세요.': 'Check the name as the time clock recorded it.',
  '이름 연결은 500개까지 저장할 수 있습니다.': 'Up to 500 name links can be saved.',
  '저장된 이름 연결이 아닙니다.': 'That name link is not saved.',
  '퇴근이 찍히지 않아 건너뛴 기록 {n}건: {rows}':
    '{n} records were skipped because no one checked out: {rows}',
  '검토한 출근기록 {n}건 저장': 'Save {n} reviewed records',
  '읽은 내용을 확인하고 저장하세요.': 'Check what was read, then save.',
  '1. 열 연결': '1. Match columns',
  '없음 · 0분': 'None · 0 min',
  '열 {n}': 'Column {n}',
  '2. 미리보기 · {n}개 기록': '2. Preview · {n} records',
  '검토한 출근기록 저장': 'Save reviewed attendance',
  '직원 ID': 'Employee ID',
  근무일: 'Date',
  '근무일 · {date}': 'Date · {date}',
  출근: 'Start',
  퇴근: 'End',
  휴게: 'Break',
  '휴게(분)': 'Break (min)',
  실근무: 'Worked',
  '예정 출근': 'Scheduled in',
  지각: 'Late',
  '{n}분 지각': '{n} min late',
  조퇴: 'Undertime',
  '{n}분 조퇴': '{n} min early',
  정시: 'On time',
  '예정 없음': 'Unscheduled',
  ' (+1일)': ' (+1 day)',
  '{n}분': '{n} min',
  '아직 저장된 출근기록이 없습니다.': 'No attendance records yet.',
  출근기록: 'Attendance',
  '출근기록_양식.xlsx': 'attendance-template.xlsx',

  // Payroll tab
  '예상 급여': 'Estimated pay',
  'CSV 다운로드': 'Download CSV',
  '급여 이메일로 보내기': 'Email payroll',
  '받는 사람: {names}': 'Sends to {names}',
  '예상 급여 {from} ~ {to}': 'Estimated pay {from} – {to}',
  '{from} ~ {to} 기간의 예상 급여입니다.': 'Estimated pay for {from} – {to}.',
  '급여 합계': 'Total',
  '사람별 자세한 내역은 함께 보내는 CSV 파일에 있습니다.':
    'The per-person breakdown is in the CSV file attached.',
  '급여 CSV 를 내려받았습니다. 열린 메일 초안에 그 파일을 첨부해 보내세요.':
    'The payroll CSV has been downloaded. Attach it to the email draft that just opened, then send.',
  '{names} 는 등록된 이메일이 없어 받는 사람에서 빠졌습니다.':
    '{names} has no email on file and was left out of the recipients.',
  '급여를 보낼 주소가 없습니다. 직원 관리에서 {names} 의 이메일을 먼저 등록하세요.':
    'No payroll recipients have an email yet. Add an email for {names} under Staff first.',
  시작일: 'Start date',
  종료일: 'End date',
  '지급액은 단말에서 찍힌 출퇴근을 기준으로 계산합니다. 유급 휴게는 근무로 치고 무급 휴게만 뺍니다. 예정 시작보다 일찍 찍어도 예정 시작 시각부터 셉니다. 그 사람 그 날짜에 찍힌 기록이 없을 때만 예전에 가져온 기록을 씁니다. 초과근무는 한 주(일요일 시작) {w}시간을 넘긴 시간만 {m}배로 가산하며, 하루 기준은 없습니다. 지각은 체크인 하나하나 따로 보아 예정 출근 시각을 넘긴 분만큼 그 체크인에서 번 금액까지만 차감하며, 예정 근무가 없는 출근기록은 지각으로 보지 않습니다. 조퇴도 같은 방법으로 예정 퇴근 시각보다 일찍 찍은 분만큼 차감하며, 지각과 조퇴를 합친 차감은 그 체크인에서 번 금액을 넘지 않습니다. 세금·유급휴가를 제외한 예상 금액이고, 시급 0인 직원은 지급액 확인이 필요합니다. 원근무자의 예정 시간은 지급 대상이 아니며 실제 출근기록만 지급합니다.':
    "Pay is worked out from the check-ins taken on the time clock. Paid breaks count as work; only unpaid breaks come off. Checking in before the scheduled start is paid from the scheduled start. Imported time clock records are used only when that person has no check-in on that date. Overtime pays {m}× on hours over {w} in a week (weeks start Sunday); there is no daily limit. Lateness is worked out per check-in: every minute past that check-in’s scheduled start is deducted at the hourly rate, never more than that check-in earned; attendance with no scheduled shift is never counted late. Undertime is deducted the same way, for every minute checked out ahead of the scheduled end; late and undertime together never take more than that check-in earned. Estimates exclude taxes and paid leave, and pay needs checking for anyone whose hourly rate is 0. Only actual attendance is paid, not the original employee's scheduled hours.",
  '직원이 이의를 제기한 근무 {n}건이 이 금액에 들어 있습니다. ':
    'This total includes {n} shift(s) a staff member has disputed. ',
  '아직 아무도 확인하지 않은 근무 {n}건이 있습니다. ': '{n} shift(s) have not been reviewed yet. ',
  '지급 전에 출근 기록에서 확인하세요.': 'Check them under Attendance before paying.',
  '출근 기록 보기': 'Open attendance',
  '조회 구간이 주(일요일~토요일) 단위가 아니어서 걸쳐 있는 주의 초과근무가 실제보다 적게 잡힐 수 있습니다.':
    'This range is not a whole Sunday-to-Saturday week, so overtime in the weeks it cuts across may come out lower than it really is.',
  이름: 'Name',
  실근무시간: 'Hours worked',
  정규: 'Regular',
  초과: 'Overtime',
  정규시간: 'Regular hours',
  초과시간: 'Overtime hours',
  시급: 'Hourly rate',
  기본급: 'Base pay',
  초과수당: 'Overtime pay',
  '지각 차감': 'Late deduction',
  '조퇴 차감': 'Undertime deduction',
  '지각(분)': 'Late (min)',
  지각일수: 'Late days',
  '조퇴(분)': 'Undertime (min)',
  조퇴일수: 'Undertime days',
  '-{money} · {n}분 {d}일': '-{money} · {n} min over {d} day(s)',
  '급여 상세': 'Pay detail',
  '날짜별 상세 보기': 'Open the day-by-day detail',
  '저장된 출근기록 기준입니다. 예정 시간이 아니라 실제로 찍힌 기록으로 계산합니다.':
    'Based on saved attendance: the check-ins on record, not what was scheduled.',
  날짜: 'Date',
  '예정 근무': 'Scheduled',
  출퇴근: 'In / Out',
  금액: 'Amount',
  '{week} 시작 주 · 실근무 {worked}h · 주 {w}시간 초과분 {applied}h → {m}배 가산':
    'Week of {week} · {worked}h worked · {applied}h over {w}h a week → paid at {m}x',
  '날짜별 금액은 시급 × 실근무이고, 지각 차감은 그 체크인에서 번 금액까지만 그 줄에서 바로 뺍니다. 초과분에 붙는 0.5배 가산만 주 단위로 아래에서 더합니다. 조퇴 차감도 같은 줄에서 바로 빼며, 지각과 조퇴를 합쳐도 그 줄에서 번 금액을 넘지 않습니다.':
    'Each day shows the hourly rate times hours worked, with that check-in’s late deduction taken off on the same row, never more than the row earned. Only the extra 0.5x on overtime is applied per week, below. The undertime deduction comes off the same row, and late plus undertime together never exceed what that row earned.',
  통화: 'Currency',
  예상급여_: 'estimated-pay_',

  // Swaps tab
  '신청 → 대체 직원 수락 → 관리자 승인': 'Request → covering employee accepts → manager approves',
  '대체 신청': 'Request swap',
  '온타리오 현지 날짜 기준, 근무일 7일 전까지 신청과 승인을 완료하세요. 기존 근무와 겹치는 대체는 차단됩니다.':
    'Request and approve swaps at least 7 days before the shift (Ontario date). Swaps that overlap existing shifts are blocked.',
  '수락 대기': 'Awaiting acceptance',
  '승인 대기': 'Awaiting approval',
  '승인 완료': 'Approved',
  'badge::거절/취소': 'Declined / cancelled',
  '거절/취소': 'Decline / cancel',
  수락: 'Accept',
  '대체근무 요청이 없습니다.': 'No swap requests.',
  '스케줄을 선택하고 대체 직원을 지정하세요.': 'Pick a shift and choose who will cover it.',

  // Messages tab
  '팀 메시지': 'Team messages',
  '앱 내 메시지 · 30초마다 갱신 · 우천 공지는 푸시 알림으로도 발송':
    'In-app messages · refreshed every 30 seconds · rain notices are also sent as push notifications',
  '메시지 작성': 'New message',
  '출근·메시지 알림': 'Shift and message alerts',
  '나에게 온 메시지와 전체 공지 · 관리자에게 답장할 수 있습니다': 'Messages to you and team notices · you can reply to the manager',
  '확인 완료': 'Read',
  '직원은 관리자나 동료에게만 메시지를 보낼 수 있습니다.': 'Staff can only message the manager or a teammate.',
  '퇴사한 직원에게는 보낼 수 없습니다.': 'You cannot message a former employee.',
  '관리자 메시지': 'Message from the manager',
  '관리자 공지': 'Announcement from the manager',
  '받는 사람 ({n}/{total}명)': 'To ({n}/{total})',
  '공지로 올리기 (공지 탭에 한 건으로 올라갑니다)': 'Post as announcement (shows once in the Announcements tab)',
  '{n}명에게 보내기': 'Send to {n}',
  보내기: 'Send',
  '여러 명에게 보내기는 관리자만 할 수 있습니다.': 'Only the manager can send to several people at once.',
  '{n}명에게 공지 올리기': 'Post announcement to {n}',
  '공지 답장: {title}': 'Re announcement: {title}',
  '받는 사람을 선택하세요.': 'Choose at least one recipient.',
  '한 번에 300명까지 보낼 수 있습니다.': 'You can send to up to 300 people at once.',
  '{name} 메시지': 'Message from {name}',
  '직원 메시지': 'Message from staff',
  '전 직원': 'All staff',
  '확인 {read} / {total}명 · {names} 미확인': 'Read {read} / {total} · Unread: {names}',
  '상대방 확인': 'Read by recipient',
  '확인 대기': 'Not read yet',
  확인했습니다: 'Mark as read',
  '팀의 대화를 시작하세요.': 'Start a team conversation.',
  '우천 종료 공지도 이곳에 모입니다.': 'Rain closure notices show up here too.',

  // Staff tab
  '이름 앞 컬러 상자 · 직원 ID · 연락처 · 개인별 시급 · 로그인 설정':
    'Color tag · employee ID · phone · hourly rate · login settings',
  '직원 추가': 'Add employee',
  '직원 접속 주소': 'Staff link',
  '직원은 로그인 화면에서 본인 직원 ID 를 쳐서 로그인합니다. 첫 비밀번호도 본인 직원 ID 이며, 직원이 직접 변경할 수 있습니다.':
    'Staff sign in by typing their own employee ID on the sign-in screen. That same ID is also their first password, and they can change it themselves.',
  '출근 알림 자동 점검 주소': 'Shift reminder check URL',
  '앱이 열려 있으면 30초마다 자동 점검합니다. 아무도 앱을 열지 않을 때도 1시간 전 알림을 보내려면 외부 cron(예: cron-job.org)에 이 주소를 5분 간격으로 등록하세요. 비공개 사이트는 외부 호출이 차단될 수 있습니다. 이 주소는 비밀번호처럼 보관하세요.':
    "While the app is open it checks every 30 seconds. To send 1-hour reminders even when nobody has the app open, add this URL to an external cron service (e.g. cron-job.org) every 5 minutes. Private sites may block outside calls. Keep this URL secret, like a password.",
  업무: 'Role',
  생년월일: 'Birth date',
  연락처: 'Phone',
  이메일: 'Email',
  '개인별 시급': 'Hourly rate',
  설정: 'Settings',

  // Dialogs
  '우천 근무 종료 공지': 'Rain closure notice',
  '직원 설정': 'Employee settings',
  '작업 지시': 'Assigns tasks',
  '관리자 권한': 'Administrator',
  '켜면 이 직원이 본인 비밀번호로 관리자 화면에 들어옵니다. 스케줄·급여·직원 정보를 모두 보고 고칠 수 있으니, 전 직원의 생년월일·연락처·시급이 함께 보인다는 점을 염두에 두세요.':
    "When this is on, the employee signs in to the admin screens with their own password. They can see and change the schedule, payroll and staff records, which includes every employee's birth date, phone number and hourly rate.",
  '{name} 직원을 삭제할까요? 지난 근무·급여 기록은 그대로 남고 목록에서만 사라집니다.':
    'Remove {name}? Their past shifts and payroll records stay as they are; they only disappear from the lists.',
  '완전 삭제': 'Delete for good',
  '{name} 직원을 완전히 삭제할까요? 지난 근무·출퇴근·급여·작업·메시지 기록까지 모두 지워지고 되돌릴 수 없습니다.':
    'Delete {name} for good? Their past shifts, clock-ins, payroll, tasks and messages are all erased, and this cannot be undone.',
  '이 휴무 요청을 삭제할까요?': 'Delete this time-off request?',
  '이 근무 가능 시간을 삭제할까요?': 'Delete this availability?',
  '보관된 직원': 'Archived staff',
  '삭제해 목록에서 감춘 직원입니다. 지난 근무·급여 기록은 아직 남아 있습니다.':
    'Staff you removed from the lists. Their past shifts and payroll records are still here.',
  '본인 계정은 삭제할 수 없습니다.': 'You cannot remove your own account.',
  '작업 지시 권한': 'Can assign tasks',
  '켜면 이 직원이 작업 수신함에서 다른 직원에게 작업을 보내고 전체 작업 진행 상황을 볼 수 있습니다. 스케줄·급여·직원 정보는 계속 읽기 전용입니다.':
    'When on, this employee can send tasks to other staff from the task inbox and see the progress of every task. Schedules, payroll and staff details stay read-only.',
  '· {name} 지시': '· assigned by {name}',
  '작업 지시 권한이 필요합니다.': 'You need permission to assign tasks.',
  // Jobs (업무) — the list every employee and shift picks from, grown from the task screen.
  '업무 목록': 'Jobs',
  '여기에 더한 업무는 직원 정보와 근무 추가 화면의 업무 선택지에 바로 나타납니다.':
    'A job you add here shows up right away in the job picker on the employee and shift screens.',
  '새 업무 이름': 'New job name',
  '예: Kitchen': 'e.g. Kitchen',
  '업무 추가': 'Add job',
  '‘{name}’ 업무를 목록에 더했습니다.': '“{name}” has been added to the job list.',
  '이미 있는 업무입니다.': 'That job is already on the list.',
  '업무는 40개까지 만들 수 있습니다.': 'You can keep up to 40 jobs.',
  // 한 사람이 여러 업무를 겸할 수 있습니다 — Proshop 과 Workshop 을 함께 뛰는 멀티 플레이어.
  '업무 (겸직이면 여러 개를 고릅니다)': 'Roles (tick more than one for staff who cover both)',
  '두 업무를 함께 뛰면 Hybrid 를 고르세요. 먼저 고른 업무가 새 근무의 기본이 됩니다.':
    'Pick Hybrid for staff who cover both jobs. The first role picked is the default on their new shifts.',
  '{roles} 를 함께 맡습니다. 먼저 고른 {main} 이 새 근무의 기본 업무가 됩니다.':
    'Covers {roles}. {main} was picked first, so it is the default on their new shifts.',
  '{roles} 를 함께 맡는 Hybrid 입니다. 먼저 고른 {main} 이 새 근무의 기본 업무가 됩니다.':
    'Hybrid — covers {roles}. {main} was picked first, so it is the default on their new shifts.',
  '업무를 하나 이상 고르세요.': 'Pick at least one role.',
  // 직원 드롭다운에서 Proshop · Workshop · Hybrid 어디에도 들지 않는 사람들의 묶음.
  '기타': 'Other',
  '초과 근무 편성 권한': 'Overtime scheduling',
  '초과 근무': 'Overtime',
  '끄면 이 직원이 짜는 근무는 한 주(일요일 시작) {w}시간까지만 들어갑니다. 켜면 그 선을 넘는 근무도 낼 수 있고, 넘긴 시간에는 급여에서 {m}배가 붙습니다. 관리자는 이 설정과 상관없이 넘겨 짤 수 있습니다.':
    'With this off, shifts this person schedules stop at {w} hours a week (weeks start Sunday). With it on they can schedule past that line, and the hours over it are paid at {m}× . Administrators can always schedule past it.',
  '대체근무 신청': 'Request a swap',
  '대체근무 승인': 'Approve swap',
  '근무 상세': 'Shift details',
  '선택한 직원에게 앱 내 공지를 저장하고, 푸시 알림을 켠 직원에게 바로 보냅니다. 기본으로 전 직원이 선택되어 있습니다. 실제 퇴근기록과 급여는 자동 변경하지 않습니다.':
    'Saves an in-app notice for the selected staff and sends it right away to anyone with push notifications on. All staff are selected by default. Clock-out records and pay are not changed automatically.',
  '수락한 대체 직원에게 근무를 이전합니다. 급여는 실제 출근기록만큼 지급하며 추가수당은 없습니다.':
    'Moves the shift to the covering employee who accepted. They are paid for their actual attendance; there is no swap bonus.',
  '내용을 확인한 후 저장하세요.': 'Review the details, then save.',
  '종료 날짜': 'End date',
  '종료 시각 (온타리오)': 'End time (Ontario)',
  '받는 직원 ({n}/{total}명)': 'Recipients ({n}/{total})',
  '안내 내용': 'Message',
  '{n}시간 근무 · 퇴근이 출근보다 이르면 다음 날 퇴근으로 계산합니다.':
    '{n} hour shift · an end time earlier than the start counts as the next day.',
  '({n}시간)': '({n} hrs)',
  '자주 쓰는 시간대 고르기': 'or use common shift times',
  '휴게 추가': 'Add break',
  '휴게시간이 근무시간보다 깁니다.': 'The break is longer than the shift.',
  '직원에게 남길 메모': 'Note for the employee',
  '이 근무에서 알아야 할 내용을 적어주세요.': 'Anything the employee should know about this shift.',
  '퇴근이 출근보다 이르면 다음 날 퇴근으로 계산합니다.':
    'If the end time is earlier than the start time, the shift ends the next day.',
  '업무 / 장소': 'Role / location',
  '달력에서 고르세요': 'Pick from the calendar',
  '생년월일 지우기': 'Clear birth date',
  '연락처 (예: 914-555-0123)': 'Phone (e.g. 914-555-0123)',
  '로그인 이메일': 'Login email',
  '직원 색상': 'Color',
  '개인별 시급 ({currency})': 'Hourly rate ({currency})',
  '대체할 근무': 'Shift to cover',
  '근무 선택': 'Choose a shift',
  '대체 직원': 'Covering employee',
  '직원 선택': 'Choose an employee',
  '지금 대체 신청할 수 있는 근무가 없습니다. 근무일이 7일 넘게 남은 일정만 고를 수 있어, 다음 주 이후 일정을 먼저 등록하세요.':
    "No shift can be swapped right now. Only a shift more than 7 days away can be, so add next week's schedule first.",
  '근무일 7일 이내인 일정은 선택 목록에 표시되지 않습니다.':
    'Shifts less than 7 days away are not listed.',
  '받는 사람': 'To',
  '원근무자 {from} → 대체자 {to}': 'Original: {from} → Covering: {to}',
  '직원용 보기 화면입니다. 일정 변경은 관리자에게 문의하세요.':
    'This is the staff view. Ask your manager to change the schedule.',
  '대체근무를 신청할 수 있습니다.': 'You can request a swap for this shift.',
  '대체근무 신청 기한이 지났습니다.': 'The swap request deadline has passed.',
  '진행 중인 대체근무 요청이 있어 수정하거나 삭제할 수 없습니다.':
    'A swap request is in progress, so this shift cannot be edited or deleted.',
  '근무 내용을 확인하고, 시간을 고치거나 근무를 삭제할 수 있습니다.':
    'Review the shift, then edit its time or delete it.',
  '근무 내용입니다.': 'Shift details.',
  '근무 삭제': 'Delete shift',
  '이 근무를 삭제할까요? 되돌릴 수 없고, 직원 화면에서도 사라집니다.':
    'Delete this shift? This cannot be undone and it disappears from the staff view too.',
  '전 직원에게 공지 저장': 'Save notice for all staff',
  '선택한 {n}명에게 공지 저장': 'Save notice for {n} selected',

  // Sign-in and password
  로그인: 'Sign in',
  '로그인하지 못했습니다.': 'Could not sign in.',
  '비밀번호 칸에 본인 직원 ID 를 입력하면 이름이 나옵니다.':
    'Type your employee ID in the password box and your name appears above it.',
  '관리자 아이디와 비밀번호를 입력하세요.': 'Enter the manager account and its password.',
  '관리자 아이디': 'Manager account',
  '비밀번호 (직원 ID)': 'Password (your employee ID)',
  '직원 ID 를 입력하세요': 'Enter your employee ID',
  '관리자로 로그인': 'Sign in as a manager',
  '직원으로 로그인': 'Sign in as staff',
  '직원 ID를 입력하세요.': 'Enter your employee ID.',
  '직원 ID 또는 비밀번호를 확인하세요.': 'Check your employee ID and password.',
  '이 번호를 쓰는 사람이 둘 이상입니다. 팀 주소로 열거나 관리자에게 문의하세요.':
    'More than one account uses this number. Open your team’s link, or ask a manager.',
  '확인 중…': 'Checking…',
  '비밀번호 변경': 'Change password',
  '새 비밀번호가 일치하지 않습니다.': 'The new passwords do not match.',
  '비밀번호를 변경하지 못했습니다.': 'Could not change the password.',
  '첫 비밀번호는 본인 직원 ID 입니다. 단말에서 눌러 보이는 번호이니 지금 바꾸는 편이 좋습니다.':
    'Your first password is your own employee ID — the number you press on the time clock, so it is worth changing now.',
  '새 비밀번호를 입력하면 다음 로그인부터 적용됩니다.':
    'The new password applies from your next sign-in.',
  '현재 비밀번호': 'Current password',
  '첫 비밀번호: 내 직원 ID': 'First password: your employee ID',
  '새 비밀번호': 'New password',
  '새 비밀번호 (4자 이상)': 'New password (4 or more characters)',
  '새 비밀번호 확인': 'Confirm new password',
  '변경 중…': 'Changing…',
  나중에: 'Later',

  // Punch app (주황 아이콘으로 여는 출퇴근 전용 앱)
  'Pelham Punch · 출퇴근': 'Pelham Punch · Time clock',
  '스케줄 앱 열기': 'Open the Shift app',
  '알림 켜짐': 'Alerts on',
  '알림 켜기': 'Turn on alerts',
  '기록했습니다.': 'Recorded.',
  '기록하지 못했습니다.': 'Could not record.',
  '아직 워크스페이스가 없습니다. 관리자가 먼저 만들어야 기록이 남습니다.':
    'There is no workspace yet. An admin has to create one before check-ins are saved.',
  '출퇴근은 직원 기록이 있어야 찍힙니다. 스케줄 앱의 직원 관리에서 본인을 직원으로 추가하고, 그 이름으로 로그인해 주세요.':
    'Checking in needs an employee record. Add yourself under Team in the Shift app, then sign in with that name.',

  // Login screen QR
  '휴대폰으로 열기': 'Open on your phone',
  '휴대폰 카메라로 QR을 비추면 앱이 열립니다. 아래 주소를 복사해 보내도 됩니다.':
    'Point your phone camera at the code to open the app, or copy the link below and send it.',
  '앱 주소': 'App link',
  '앱 주소 QR 코드: ': 'QR code for the app link: ',

  // Install QR
  '앱 설치 QR': 'Install app (QR)',
  '휴대폰에 앱 설치': 'Install the app on your phone',
  '휴대폰 카메라로 QR 코드를 스캔해 접속한 뒤, 홈 화면에 추가하세요.':
    "Scan the QR code with your phone's camera, open the link, then add it to your home screen.",
  '설치 주소 QR 코드: ': 'QR code for the install link: ',
  '설치 주소': 'Install link',
  복사됨: 'Copied',
  복사: 'Copy',
  'Safari로 열기 → 공유 버튼 → ': 'Open in Safari → Share button → ',
  '홈 화면에 추가': 'Add to Home Screen',
  'Chrome으로 열기 → 메뉴(⋮) → ': 'Open in Chrome → menu (⋮) → ',
  '앱 설치': 'Install app',
  ' 또는 홈 화면에 추가': ' or Add to Home screen',
  '홈 화면 앱을 열고 로그인 → ': 'Open the home screen app and sign in → ',
  '이 기기에 바로 설치': 'Install on this device',
  '앱은 두 개입니다. 하나씩 따로 설치하면 홈 화면에 아이콘이 두 개 생깁니다.':
    'There are two apps. Install them one at a time and you get two icons on your home screen.',
  '설치할 앱': 'App to install',
  '스케줄·근무표·메시지': 'Schedule, timesheets, messages',
  '출근·퇴근·휴게 찍기': 'Check in, check out, breaks',
  '나머지 앱은 위 토글로 바꿔 주소를 열고 같은 방법으로 한 번 더 설치하세요.':
    'For the other app, switch above, open its link, and install it the same way.',
  '이 앱 주소로 이동해 설치하기': 'Go to this app’s link to install it',

  // Task inbox
  '작업을 불러오지 못했습니다.': 'Could not load tasks.',
  완료: 'Done',
  'status::확인': 'Seen',
  확인: 'Mark as seen',
  '새 작업': 'New',
  '로그인하고 열기': 'Sign in to open',
  스케줄: 'Team shifts',
  '작업 지시 관리': 'Task assignments',
  '내 작업 수신함': 'My task inbox',
  새로고침: 'Refresh',
  '워크스페이스를 먼저 생성하세요': 'Create the workspace first',
  '관리자 화면에서 ‘내 워크스페이스 생성’을 누르면 작업 지시를 시작할 수 있습니다.':
    'Press ‘Create my workspace’ on the manager screen to start assigning tasks.',
  '스케줄로 이동': 'Go to schedule',
  '직원에게 작업 지시 보내기': 'Send a task to staff',
  '직원은 수신함에서 확인과 완료 처리를 할 수 있습니다.':
    'Staff can mark tasks as seen and done from their inbox.',
  '받는 직원': 'Assign to',
  '직원을 선택하세요': 'Choose an employee',
  마감일: 'Due date',
  '마감 시각': 'Due time',
  '적지 않아도 됩니다': 'Optional',
  '시각 비우기': 'Clear time',
  '마감 시각은 10분 단위로 고르세요.': 'Pick a due time on a 10-minute mark.',
  '작업 제목': 'Task title',
  '예: 3번 홀 장비 점검': 'e.g. Check equipment at hole 3',
  '작업 안내': 'Instructions',
  '필요한 준비물, 완료 기준 등을 적어주세요.': 'What is needed, what counts as done, etc.',
  '작업 보내기': 'Send task',
  '{n}개의 진행 중 작업': '{n} open tasks',
  '전체 {n}건': '{n} total',
  '마감 {date}': 'Due {date}',
  '마감 {date} {time}': 'Due {date} {time}',
  '· {time} 완료': '· Completed {time}',
  '완료 처리': 'Mark done',
  '보낸 작업이 없습니다': 'No tasks sent yet',
  '새로 받은 작업이 없습니다': 'No new tasks',
  '위 양식에서 직원에게 첫 작업을 보내세요.': 'Use the form above to send the first task.',
  '새 작업이 오면 이곳에서 바로 확인할 수 있습니다.': 'New tasks will show up here.',

  // Push notifications (translated per device on the server)
  '출근 1시간 전 알림': 'Shift starts in 1 hour',
  '{date} {start} · {area} 근무가 1시간 이내에 시작됩니다.':
    '{date} {start} · Your {area} shift starts within 1 hour.',
  '출근 기록이 아직 없습니다': 'You have not checked in yet',
  '{start} · {area} 근무가 시작됐는데 출근이 찍히지 않았습니다. 출퇴근 화면에서 출근을 찍어 주세요.':
    '{start} · Your {area} shift has started but no check-in was recorded. Please check in on the clock screen.',
  '주 {w}시간 초과': 'Over {w} hours this week',
  '{name}: 이번 주 {hours}시간 일했습니다. 초과 근무 수당이 붙습니다. 눌러서 근무 시간을 확인하세요.':
    '{name} has worked {hours} hours this week. Overtime pay applies. Tap to see their hours.',
  '주 {w}시간 넘는 근무 편성': 'Shift scheduled over {w} hours',
  '{who}님이 {name}의 {week} 시작 주 근무를 {hours}시간으로 짰습니다. 눌러서 출근 기록을 확인하세요.':
    '{who} scheduled {name} for {hours} hours in the week of {week}. Tap to see their attendance.',
  'Pelham Shift 테스트 알림': 'Pelham Shift test notification',
  '이 기기에서 푸시 알림을 받을 수 있습니다.': 'This device can receive push notifications.',

  // Server errors (API routes, lib/operations.ts, lib/birth-auth.ts, lib/push.ts)
  '본인 출퇴근만 찍을 수 있습니다.': 'You can only check in and out for yourself.',
  '이미 출근으로 찍혀 있습니다. 먼저 퇴근을 찍으세요.':
    'You are already checked in. Check out first.',
  '출근으로 찍힌 기록이 없습니다.': 'There is no open check-in.',
  '아직 오지 않은 날짜에는 출퇴근을 넣을 수 없습니다.': 'You cannot add a check-in for a future date.',
  '출근과 퇴근 시각이 같습니다.': 'Check-in and check-out are the same time.',
  '이 시간에 이미 찍힌 출퇴근이 있습니다.': 'There is already a check-in at this time.',
  '휴게 중이 아닙니다.': 'You are not on a break.',
  '이미 휴게 중입니다.': 'You are already on a break.',
  '휴게는 하루 12번까지 찍을 수 있습니다.': 'You can take up to 12 breaks a day.',
  '잘못된 휴게 처리입니다.': 'That is not a valid break action.',
  '근무 기록을 찾을 수 없습니다.': 'That check-in record could not be found.',
  '본인 근무 기록만 확인할 수 있습니다.': 'You can only review your own check-in records.',
  '퇴근까지 찍힌 근무만 확인할 수 있습니다.': 'Only check-ins with a check-out time can be reviewed.',
  '마감된 근무표입니다. 관리자에게 문의하세요.':
    'This timesheet is closed. Ask a manager for help.',
  '급여 기간의 시작일이 아닙니다.': 'That is not the first day of a pay period.',
  '확인할 근무가 없습니다.': 'There is nothing to review.',
  '로그인이 필요합니다.': 'Please sign in.',
  '허용되지 않은 요청입니다.': 'Request not allowed.',
  '요청이 너무 큽니다.': 'Request too large.',
  '이미 생성되었거나 권한이 없습니다.': 'Already created, or not allowed.',
  '워크스페이스를 먼저 생성하세요.': 'Create the workspace first.',
  '다른 사용자가 변경했습니다. 새로고침 후 다시 시도하세요.':
    'Someone else changed this. Refresh and try again.',
  '동시 변경이 감지되었습니다. 다시 불러오세요.':
    'A simultaneous change was detected. Reload and try again.',
  '알림 설정을 불러오지 못했습니다.': 'Could not load notification settings.',
  '알림 설정을 저장하지 못했습니다.': 'Could not save notification settings.',
  '알림 구독 정보를 확인하세요.': 'Check the notification subscription.',
  '워크스페이스가 없습니다.': 'Workspace not found.',
  '점검하지 못했습니다.': 'Could not run the check.',
  '지원하지 않는 요청입니다.': 'Unsupported request.',
  '생년월일 8자리를 입력하세요.': 'Enter an 8-digit birth date.',
  '등록되지 않은 직원입니다. 관리자에게 확인하세요.':
    'That staff member is not registered. Check with your manager.',
  '새 비밀번호는 4~128자로 입력하세요.': 'The new password must be 4–128 characters.',
  '로그인한 뒤 변경할 수 있습니다.': 'Sign in to change it.',
  '관리자 비밀번호는 변경할 수 없습니다.': 'The manager password cannot be changed.',
  '현재 비밀번호를 확인하세요.': 'Check your current password.',
  '데이터베이스 연결 정보가 없습니다. Vercel 환경변수 DATABASE_URL 또는 Supabase 연동(POSTGRES_URL)을 설정하세요.':
    'No database connection is configured. Set the DATABASE_URL environment variable on Vercel or connect Supabase (POSTGRES_URL).',
  '필수 입력값을 확인하세요.': 'Check the required fields.',
  '날짜를 확인하세요.': 'Check the date.',
  '근무시간은 10분 단위로 입력하세요.': 'Enter shift times in 10-minute steps.',
  '시간 형식을 확인하세요.': 'Check the time format.',
  '0 이상의 유효한 금액/시간을 입력하세요.': 'Enter a valid amount or time of 0 or more.',
  '관리자 권한이 필요합니다.': 'Manager permission is required.',
  '등록된 직원을 선택하세요.': 'Choose a registered employee.',
  '이 계정은 직원 명부에 없습니다': 'This account is not on the staff list',
  '출퇴근은 직원 명부에 있는 사람만 찍습니다.': 'Only people on the staff list check in and out.',
  '직원 계정은 전체 일정, 본인 근태 및 급여를 읽기 전용으로만 볼 수 있습니다.':
    'Staff accounts can only view the full schedule and their own attendance and pay.',
  '직원 색상을 확인하세요.': 'Check the employee color.',
  '연락처를 확인하세요. 숫자와 + - ( ) 만 입력할 수 있습니다.':
    'Check the phone number. Only digits and + - ( ) are allowed.',
  '이메일을 확인하세요.': 'Check the email.',
  '이미 등록된 이메일입니다.': 'That email is already registered.',
  '같은 생년월일이 이미 등록되어 있습니다.': 'That birth date is already registered.',
  '출근과 퇴근 시간이 같습니다.': 'Start and end times are the same.',
  '해당 직원의 근무시간이 겹칩니다.': "This overlaps the employee's other shifts.",
  'Workshop 근무는 Workshop 업무를 맡은 직원에게만 넣을 수 있습니다.':
    'Workshop shifts can only go to staff who have the Workshop job.',
  '통화를 선택하세요.': 'Choose a currency.',
  '근무를 선택하세요.': 'Choose a shift.',
  '본인 근무만 대체 신청할 수 있습니다.': 'You can only request swaps for your own shifts.',
  '휴무 신청은 시작일 7일 전까지 가능합니다.':
    'Time off must be requested at least 7 days before the start date.',
  '대체 신청은 근무일 7일 전까지 가능합니다.':
    'Swaps must be requested at least 7 days before the shift.',
  '다른 대체 직원을 선택하세요.': 'Choose a different covering employee.',
  '이미 대체 승인된 근무입니다.': 'This shift already has an approved swap.',
  '이미 대체 요청이 있습니다.': 'A swap request already exists for this shift.',
  '대체 직원의 기존 근무시간과 겹칩니다.': "This overlaps the covering employee's existing shifts.",
  '요청을 찾을 수 없습니다.': 'Request not found.',
  '대체 직원 본인이 수락해야 합니다.': 'The covering employee must accept it themselves.',
  '처리된 요청입니다.': 'This request was already handled.',
  '권한이 없습니다.': 'Not allowed.',
  '승인된 대체는 취소할 수 없습니다.': 'An approved swap cannot be cancelled.',
  '대체 직원의 수락이 먼저 필요합니다.': 'The covering employee must accept first.',
  '근무가 없습니다.': 'Shift not found.',
  '대체 승인도 근무일 7일 전까지 가능합니다.':
    'Swaps must also be approved at least 7 days before the shift.',
  '원래 근무자가 변경되었습니다.': 'The original employee has changed.',
  '대체 직원의 근무시간이 겹칩니다.': "The covering employee's shifts overlap.",
  '잘못된 처리입니다.': 'Invalid action.',
  '1~3,000개 행을 가져올 수 있습니다.': 'You can import 1–3,000 rows.',
  '퇴근 시간과 휴게시간을 확인하세요.': 'Check the end time and break.',
  '공지를 받을 직원을 선택하세요.': 'Choose who should receive the notice.',
  '메시지가 없습니다.': 'Message not found.',
  '작업을 찾을 수 없습니다.': 'Task not found.',
  '본인에게 배정된 작업만 처리할 수 있습니다.': 'You can only update tasks assigned to you.',
  '본인이 지시한 작업만 삭제할 수 있습니다.':
    'You can only delete tasks you assigned.',
  '이 작업 지시를 삭제할까요? 받은 직원의 수신함에서도 사라집니다.':
    'Delete this task? It disappears from the assignee’s inbox too.',
  '잘못된 작업 처리입니다.': 'Invalid task action.',
  '5MB 이하 파일만 업로드할 수 있습니다.': 'Only files up to 5 MB can be uploaded.',
  '.xlsx 또는 .csv 형식으로 저장한 파일을 선택하세요.':
    'Choose a file saved as .xlsx or .csv.',
  '첫 번째 시트가 비어 있습니다.': 'The first sheet is empty.',
  '최대 3,000개 행을 가져올 수 있습니다.': 'You can import up to 3,000 rows.',
  '제목 행과 출근기록이 필요합니다.': 'The file needs a header row and attendance rows.',
  '필수 열을 연결하세요.': 'Match the required columns.',

  // 직원 전용 폰 화면 · staff-only phone screens
  '홈': 'Home',
  'tab::출퇴근': 'Time clock',
  '더보기': 'More',
  '뒤로': 'Back',
  '오늘로': 'Today',
  '내 근무': 'My shifts',
  '전체 일정': 'Team shifts',
  '근무 일정이 없습니다.': 'You are not scheduled to work.',
  '이 날은 아무도 근무하지 않습니다.': 'No one is scheduled to work.',
  '보기 설정': 'View settings',
  '근무 없음': 'No shifts',
  '새 근무 만들기': 'Add a shift',
  // 팀 화면 · phone team screen
  '목록으로': 'Back to the list',
  '보관됨': 'Archived',
  '이메일 미등록': 'No email',
  '연락처 미등록': 'No phone number',
  '생년월일 미등록': 'No date of birth',
  '배정': 'Assignment',
  '변경': 'Change',
  '{money} / 시간': '{money} / hour',
  '직원은 로그인 화면에서 본인 직원 ID 를 쳐서 들어옵니다. 처음 비밀번호도 본인 직원 ID 이고, 직원이 직접 바꿉니다.':
    'Staff sign in by typing their own employee ID on the login screen. That same ID is also the first password, and they change it themselves.',
  '직원 삭제': 'Remove employee',
  '재직': 'Active',
  // '재직' 과 짝을 이루는 거르개 단추입니다. 누르는 동작이 아니라 보고 있는 목록을 가리킵니다.
  '보관': 'Archived',
  '이름으로 검색': 'Search by name',
  '찾는 이름이 없습니다.': 'No one matches that name.',
  '아직 직원이 없습니다.': 'No staff yet.',

  // 근무표 · timesheets
  '내 근무표': 'My Timesheets',
  '확인 필요': 'Action required',
  '확인해 주세요': 'Pending your review',
  '확인 {a} · 이의 {b} · 대기 {c}': '{a} Approved, {b} Disputed, {c} Pending',
  '마감된 근무표입니다.': 'Timesheet is closed',
  '근무 {n}건': '{n} shifts worked',
  '{h}시간 {m}분 근무함': '{h} Hrs {m} Min worked',
  '모두 확인': 'Approve All',
  '근무한 날': 'Shifts Worked',
  '관리자가 수정함': 'Edited by manager',
  '이의 제기함': 'Disputed',
  '확인함': 'Approved',
  'approve::확인': 'Approve',
  '이의': 'Dispute',
  '{date} 자세히 보기': 'Show {date} in full',
  '{from} – {to} 사이에 찍힌 근무가 없습니다.': 'No check-ins between {from} and {to}.',
  '근무 기록에 이의': 'Dispute this shift',
  '어디가 다른가요?': "What's different?",
  '예: 12시가 아니라 12시 30분에 퇴근했습니다.': 'For example: I checked out at 12:30 PM, not 12:00 PM.',

  // 메시지 · messaging
  'title::메시지': 'Messaging',
  '메시지 종류': 'Message type',
  '새 메시지': 'New message',
  '대화': 'Messages',
  '공지': 'Announcements',
  '오늘의 칭찬': 'Shift shout-outs',
  '오늘 같이 일한 동료를 칭찬해 보세요.': 'Recognize a team member from today’s shift',
  '같이 근무하는 날 동료를 칭찬할 수 있습니다.': 'Recognize a team member on a day you work together',
  '최근 대화': 'Recent messages',
  '전체 공지': 'Announcements',
  '나: ': 'You: ',
  '답장': 'Reply',
  '주고받은 메시지가 없습니다.': 'No messages yet.',
  '공지가 없습니다.': 'No announcements yet.',
  '오늘 고마웠던 동료: ': 'Shout-out to: ',

  // 출퇴근 가능 위치 · geofence
  '위치 확인 필요': 'Location needed',
  '위치를 켜주세요': 'Turn on location',
  '잠시만 기다려 주세요.': 'One moment.',
  '근무지에서 일하는 동안에만 앱이 열립니다. 기기 설정에서 위치를 켜고, 이 앱에 위치 권한을 허용해 주세요.':
    'The app opens only while you are at work. Turn on location in your device settings and allow this app to use it.',
  '이 기기에서 위치가 꺼져 있습니다. 직원은 위치를 켜야 앱을 쓸 수 있습니다.':
    'Location is off on this device. Staff need it on to use the app.',
  // 한 번 막아 둔 권한은 앱이 다시 물어도 창이 뜨지 않습니다. 어디서 푸는지 알려 줍니다.
  '아이폰: 설정 > 개인정보 보호 및 보안 > 위치 서비스를 켜고, 설정 > Safari > 위치에서 이 사이트를 허용으로 바꿉니다.':
    'iPhone: turn on Settings > Privacy & Security > Location Services, then set Settings > Safari > Location to Allow for this site.',
  '안드로이드: 주소창의 자물쇠 > 사이트 설정 > 위치를 허용으로 바꾸고, 기기 설정에서 위치를 켭니다.':
    'Android: tap the lock in the address bar > Site settings > Location and set it to Allow, then turn on location in your device settings.',
  '위치가 꺼져 있어 출퇴근을 찍을 수 없습니다. 기기 설정에서 위치를 켜고 이 앱에 허용해 주세요.':
    'Location is off, so you cannot check in or out. Turn it on in your device settings and allow it for this app.',
  '위치를 확인하는 중입니다. 자리가 잡히면 출퇴근을 찍을 수 있습니다.':
    'Checking your location. You can check in and out once it is found.',
  '위치를 다시 잡는 중입니다. 자리가 잡히면 출퇴근을 찍을 수 있습니다.':
    'Getting a fresh location fix. You can check in and out once it is found.',
  '다시 확인': 'Check again',
  '출퇴근 가능 위치': 'Where staff can check in and out',
  '지금 내 위치로 지정': 'Use my location',
  '위치를 확인하는 중입니다…': 'Checking your location…',
  '반경(m)': 'Radius (m)',
  '기본 위치로': 'Reset to default',
  '근무지에서 {n}m 안에서만 출퇴근이 찍힙니다. 위도 {lat}, 경도 {lng}':
    'Staff can check in and out within {n} m of the workplace. Latitude {lat}, longitude {lng}.',
  '클럽 자리(196 Webber Rd, Welland)가 기본값입니다. 근무지에서 위 버튼을 누르면 그 자리로 바뀝니다.':
    'The club itself (196 Webber Rd, Welland) is the default. Press the button above while at the workplace to move the centre there.',
  '근무지에서 약 {n}m 떨어져 있습니다. {r}m 안에서만 출퇴근을 찍을 수 있습니다.':
    'You are about {n} m from the workplace. Check in and out is only possible within {r} m.',
  '이 기기는 위치를 알려주지 않습니다.': 'This device does not report a location.',
  '위치를 확인하지 못했습니다. 위치 권한을 허용하고 다시 눌러주세요.':
    'Your location could not be checked. Allow location access and try again.',
  '위치를 확인하지 못해 출퇴근을 기록하지 않았습니다. 위치 권한을 허용하고 다시 눌러주세요.':
    'No shift was recorded because your location could not be checked. Allow location access and try again.',
  '위치를 확인하세요.': 'Check the location.',

  // 로그인 목록
  '직원 ID 일괄 발급': 'Issue missing IDs',
  '로그인 목록 내려받기': 'Download sign-in list',
  '번호가 없는 직원에게 1001부터 차례로 내어 줍니다.': 'Gives 1001 and up to anyone without a number.',
  '모든 직원에게 이미 직원 ID 가 있습니다.': 'Everyone already has an employee ID.',
  '쓸 수 있는 번호가 없습니다.': 'No free number is left.',
  '직원ID_': 'employee-ids_',

  // 출퇴근 단말 · /attendance kiosk
  '스케줄 앱을 엽니다…': 'Opening the Shift app…',
  '직원 ID를 입력하세요': 'Enter your employee ID',
  '직원 ID가 맞지 않습니다.': 'That employee ID does not match.',
  '직원 ID (숫자 4~8자리)': 'Employee ID (4–8 digits)',
  '직원 ID는 숫자 4~8자리로 입력하세요.': 'Enter an employee ID of 4 to 8 digits.',
  '이미 쓰이고 있는 직원 ID 입니다.': 'That employee ID is already in use.',
  '출퇴근 단말': 'Time clock',
  'pad::지우기': 'Clear',
  'start::출근 찍기': 'Check in',
  '출근 전': 'Not checked in',
  '예정된 근무가 없습니다': 'No scheduled shift',
  '일정이 없어도 찍을 수 있습니다.': 'You can still check in.',
  '출근·퇴근은 사진이 찍혀야 기록됩니다.': 'A photo is required to check in or out.',
  '근무 종료 시간({time})입니다. 퇴근을 찍어주세요.':
    'Your shift is over ({time}). Please check out.',
  '방금 찍은 사진': 'The photo just taken',
  '출근을 기록했습니다.': 'Checked in.',
  '퇴근을 기록했습니다.': 'Checked out.',
  '조퇴 — 퇴근을 기록했습니다.': 'Checked out early — undertime.',
  '예정 퇴근은 {t} 입니다. 지금 퇴근을 찍으면 {n}분 조퇴로 남습니다.':
    'Your shift ends at {t}. Checking out now records {n} min of undertime.',
  '이미 출근으로 찍혀 있습니다.': 'Already checked in.',
  '이미 퇴근으로 찍혀 있습니다.': 'Already checked out.',
  '카메라를 켜는 중입니다…': 'Starting the camera…',
  '카메라를 켤 수 없습니다. 기기 설정에서 카메라 권한을 허용해 주세요.':
    'The camera is not available. Allow camera access in this device’s settings.',
  '화면이 너무 어둡거나 가려져 있습니다. 카메라를 보고 다시 눌러주세요.':
    'The picture is too dark or the lens is covered. Face the camera and try again.',
  '사진을 만들지 못했습니다. 다시 눌러주세요.': 'The photo could not be taken. Try again.',
  '사진이 찍히지 않았습니다.': 'No photo was taken.',
  '사진을 찍을 수 없어 기록하지 않았습니다.': 'No photo could be taken, so nothing was recorded.',
  '카메라가 멈춰 있습니다. 잠시 뒤 다시 눌러주세요.':
    'The camera has stopped. Wait a moment and press again.',
  '카메라 화면이 멈춰 있습니다. 잠시 뒤 다시 눌러주세요.':
    'The camera picture has frozen. Wait a moment and press again.',
  '사진이 찍히지 않아 출퇴근을 기록하지 않았습니다. 카메라를 확인하고 다시 눌러주세요.':
    'No shift was recorded because the photo failed. Check the camera and try again.',
  '사진이 너무 큽니다. 다시 찍어주세요.': 'That photo is too large. Take it again.',
  '자리를 비운 것 같아 로그아웃했습니다.': 'Signed out after a period of inactivity.',
  '이 기기가 로그인되어 있지 않습니다. 관리자 계정으로 먼저 로그인하세요.':
    'This device is not signed in. Sign in with a manager account first.',
  '관리자 계정으로 로그인된 기기에서만 쓸 수 있습니다.':
    'Only a device signed in with a manager account can use this screen.',
  '동시에 다른 변경이 있었습니다. 잠시 후 다시 눌러주세요.':
    'Something else changed at the same time. Try again in a moment.',
  '로그인하러 가기': 'Go to sign in',
  '열 수 없습니다.': 'This screen could not be opened.',

  // 출퇴근 · time clock
  'Punch ID (숫자 4~8자리, 선택)': 'Punch ID (4–8 digits, optional)',
  'Punch ID는 숫자 4~8자리로 입력하세요.': 'Enter a Punch ID of 4 to 8 digits.',
  '이미 쓰이고 있는 Punch ID 입니다.': 'That Punch ID is already in use.',
  'Punch ID를 입력하세요': 'Enter your Punch ID',
  '출근을 찍습니다': 'Check in',
  '지우기': 'CLEAR',
  '한 자 지우기': 'Delete one digit',
  'signin::출근 찍기': 'Sign in',
  'endshift::퇴근 찍기': 'Check out',
  '출근 중': 'Checked-in',
  '휴게 중': 'On break',
  '{h}시간 {m}분': '{h}h {m}min',
  '근무한 시간': 'time on shift',
  '지금 근무': 'Current shift',
  '유급 휴게 시작': 'Go on paid break',
  '휴게 끝내기': 'End break',
  'h::시간': 'h',
  '기록': 'Records',

  // 앱 시계 · in-app time picker
  'cancel::취소': 'Cancel',
  'ok::확인': 'Ok',

  // 관리자 위치 지도 · /admin staff map
  'Pelham Admin · 직원 위치': 'Pelham Admin · Staff map',
  '직원 위치': 'Staff locations',
  '출근을 찍어 둔 직원만 보입니다. 직원 앱이 열려 있는 동안 1분마다 자리가 갱신됩니다.':
    'Only staff who are checked in appear. Their spot refreshes every minute while the staff app is open.',
  '모두 보기': 'Show everyone',
  '관리자만 볼 수 있습니다.': 'Only managers can see this.',
  '서버에 닿지 못했습니다. 잠시 뒤 다시 읽습니다.': "Couldn't reach the server. Trying again shortly.",
  '{a}명 중 {b}명 위치 확인': '{b} of {a} located',
  '지금 출근해 있는 직원이 없습니다.': 'Nobody is checked in right now.',
  '방금': 'just now',
  '{n}분 전': '{n} min ago',
  '±{n}m': '±{n}m',
  '위치 없음 · 앱이 닫혀 있습니다': 'No location · app is closed',
  '위치 표가 아직 없습니다. supabase/migrations/20260924120000_staff_locations.sql 을 Supabase SQL Editor 에서 실행하세요.':
    'The location table does not exist yet. Run supabase/migrations/20260924120000_staff_locations.sql in the Supabase SQL Editor.',
};

// Messages built from data (a date, a row number, a list of names) can't be dictionary keys.
const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
  [
    /^근무지에서 약 (\d+)m 떨어져 있어 출퇴근을 기록하지 않았습니다\. 근무지에서 다시 눌러주세요\.$/,
    ([, away]) =>
      `No shift was recorded: you are about ${away} m from the workplace. Try again at the workplace.`,
  ],
  [
    /^데이터베이스에 접속하지 못했습니다 \((.+)\)\. DATABASE_URL이 Supabase Transaction pooler\(포트 6543\) 주소인지 확인하세요\.$/,
    ([, detail]) =>
      `Could not reach the database (${detail}). Check that DATABASE_URL points at the Supabase Transaction pooler (port 6543).`,
  ],
  [
    /^반경은 (\d+)~(\d+)m 로 입력하세요\.$/,
    ([, low, high]) => `Enter a radius between ${low} and ${high} m.`,
  ],
  [
    /^\[우천 근무 종료\] (\S+) (\S+)에 (.+?) 근무를 종료합니다\. ?([\s\S]*)$/,
    ([, date, end, names, body]) =>
      `[Rain closure] Work ends at ${end} on ${date} for ${names === '전 직원' ? 'all staff' : names}. ${translate('en', body)}`.trim(),
  ],
  [
    /^(\S+) (\S+): 중복 또는 겹치는 출근기록입니다\.$/,
    ([, date, employee]) => `${date} ${employee}: duplicate or overlapping attendance record.`,
  ],
  [
    /^(\S+): 진행 중인 대체근무 요청이 있어 수정할 수 없습니다\.$/,
    ([, date]) => `${date}: a swap request is in progress, so this shift can't be edited.`,
  ],
  [
    /^(\S+): 진행 중인 대체근무 요청이 있어 삭제할 수 없습니다\.$/,
    ([, date]) => `${date}: a swap request is in progress, so this shift can't be deleted.`,
  ],
  [
    /^(\S+): 출근과 퇴근 시간이 같습니다\.$/,
    ([, date]) => `${date}: start and end times are the same.`,
  ],
  [
    /^(.+): Workshop 근무는 Workshop 업무를 맡은 직원에게만 넣을 수 있습니다\.$/,
    ([, employee]) => `${employee}: Workshop shifts can only go to staff who have the Workshop job.`,
  ],
  [
    /^(\S+) (.+): 근무시간이 겹칩니다\.$/,
    ([, date, employee]) => `${date} ${employee}: shifts overlap.`,
  ],
  [
    /^(\d+)행:직원 ID, 날짜\(YYYY-MM-DD\), 시간\(HH:mm\)을 확인하세요\.$/,
    ([, row]) => `Row ${row}: check the employee ID, date (YYYY-MM-DD) and time (HH:mm).`,
  ],
];

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole)) : text;

// A `badge::`-style prefix separates identical Korean text that needs different English.
const CONTEXT = /^[a-z]+::/;

export function translate(lang: Lang, text: string, vars?: Vars): string {
  const source = text.replace(CONTEXT, '');
  if (lang === 'ko' || !source) return fill(source, vars);
  const english = en[text] ?? en[source];
  if (english !== undefined) return fill(english, vars);
  for (const [pattern, render] of patterns) {
    const match = source.match(pattern);
    if (match) return render(match);
  }
  return fill(source, vars);
}
