// English/Korean text. Korean source strings are the keys, so the Korean messages the server sends translate on the client too.
export type Lang = 'ko' | 'en';
export type Vars = Record<string, string | number>;

export const isLang = (value: unknown): value is Lang => value === 'ko' || value === 'en';
export const locale = (lang: Lang) => (lang === 'en' ? 'en-US' : 'ko-KR');
export const weekdays = (lang: Lang) =>
  lang === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['일', '월', '화', '수', '목', '금', '토'];

const en: Record<string, string> = {
  // App shell and navigation
  'Pelham Shift · 근무 관리': 'Pelham Shift · Staff scheduling',
  '근무 스케줄': 'Schedule',
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
  '안전하게 장비를 정리하고 퇴근 기록을 남겨주세요.':
    'Please put the equipment away safely and clock out.',
  '샘플 미리보기 · 실제 운영을 시작하면 샘플 일정은 비워집니다.':
    'Sample preview · The sample schedule is cleared once you start for real.',
  '내 워크스페이스 생성': 'Create my workspace',
  '출근 알림 · 오늘 {start}, {area} 근무가 1시간 이내에 시작됩니다.':
    'Shift reminder · Your {area} shift today at {start} starts within 1 hour.',
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
  '근무 추가': 'Add shift',
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
  '출근기계 엑셀을 업로드하면 근무시간과 예상 급여를 계산합니다.':
    "Upload the time clock's Excel export to calculate hours and estimated pay.",
  '출근기록 가져오기 →': 'Import attendance →',
  '월간 근무 일정': 'Monthly schedule',
  '이전 달': 'Previous month',
  '다음 달': 'Next month',
  오늘: 'Today',
  '{date} 일정 보기': 'View {date}',

  // Attendance tab
  '출근기록 가져오기': 'Import attendance',
  '내 출근 기록': 'My attendance',
  '직원 ID로 연결합니다. 중복·겹치는 기록은 저장하지 않습니다.':
    'Records are matched by employee ID. Duplicate or overlapping records are not saved.',
  '출근기계 기록을 읽기 전용으로 확인합니다.': 'Your time clock records (read-only).',
  '엑셀 양식': 'Excel template',
  '출근기계에서 내보낸 엑셀을 선택하세요': 'Choose the Excel file exported from the time clock',
  '.xlsx · 첫 번째 시트 · 최대 5MB / 3,000행': '.xlsx · first sheet · up to 5 MB / 3,000 rows',
  '1. 엑셀 열 연결': '1. Match Excel columns',
  '없음 · 0분': 'None · 0 min',
  '열 {n}': 'Column {n}',
  '2. 미리보기 · {n}개 기록': '2. Preview · {n} records',
  '검토한 출근기록 저장': 'Save reviewed attendance',
  '직원 ID': 'Employee ID',
  근무일: 'Date',
  출근: 'Start',
  퇴근: 'End',
  휴게: 'Break',
  '휴게(분)': 'Break (min)',
  실근무: 'Worked',
  ' (+1일)': ' (+1 day)',
  '{n}분': '{n} min',
  '아직 저장된 출근기록이 없습니다.': 'No attendance records yet.',
  출근기록: 'Attendance',
  '출근기록_양식.xlsx': 'attendance-template.xlsx',

  // Payroll tab
  '예상 급여': 'Estimated pay',
  '내 예상 급여': 'My estimated pay',
  '실근무시간 × 직원별 시급 + 승인된 대체 추가수당':
    'Hours worked × hourly rate + approved swap bonuses',
  'CSV 다운로드': 'Download CSV',
  시작일: 'Start date',
  종료일: 'End date',
  '세금·초과근무 가산·유급휴가를 제외한 예상 금액입니다. 시급 0인 직원은 지급액 확인이 필요합니다. 원근무자의 예정 시간은 지급 대상이 아니며 실제 출근기록만 지급합니다.':
    "Estimates exclude taxes, overtime premiums and paid leave. Check pay for anyone whose hourly rate is 0. Only actual attendance is paid, not the original employee's scheduled hours.",
  이름: 'Name',
  실근무시간: 'Hours worked',
  시급: 'Hourly rate',
  기본급: 'Base pay',
  '대체 추가수당': 'Swap bonus',
  통화: 'Currency',
  예상급여_: 'estimated-pay_',

  // Swaps tab
  '신청 → 대체 직원 수락 → 관리자 승인': 'Request → covering employee accepts → manager approves',
  '대체 신청': 'Request swap',
  '뉴욕 현지 날짜 기준, 근무일 7일 전까지 신청과 승인을 완료하세요. 기존 근무와 겹치는 대체는 차단됩니다.':
    'Request and approve swaps at least 7 days before the shift (New York date). Swaps that overlap existing shifts are blocked.',
  '수락 대기': 'Awaiting acceptance',
  '승인 대기': 'Awaiting approval',
  '승인 완료': 'Approved',
  'badge::거절/취소': 'Declined / cancelled',
  '거절/취소': 'Decline / cancel',
  수락: 'Accept',
  '수당 확인 및 승인': 'Set bonus & approve',
  '추가수당 {amount}': 'Bonus {amount}',
  '대체근무 요청이 없습니다.': 'No swap requests.',
  '스케줄을 선택하고 대체 직원을 지정하세요.': 'Pick a shift and choose who will cover it.',

  // Messages tab
  '팀 메시지': 'Team messages',
  '앱 내 메시지 · 30초마다 갱신 · 우천 공지는 푸시 알림으로도 발송':
    'In-app messages · refreshed every 30 seconds · rain notices are also sent as push notifications',
  '메시지 작성': 'New message',
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
  '급여 통화': 'Pay currency',
  '직원 접속 주소': 'Staff link',
  '직원의 생년월일 8자리로 로그인합니다. 생년월일은 로그인 설정에서 관리하세요.':
    "Staff sign in with their 8-digit birth date. Manage birth dates in each employee's settings.",
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
  '대체근무 신청': 'Request a swap',
  '대체근무 승인': 'Approve swap',
  '근무 상세': 'Shift details',
  '선택한 직원에게 앱 내 공지를 저장하고, 푸시 알림을 켠 직원에게 바로 보냅니다. 기본으로 전 직원이 선택되어 있습니다. 실제 퇴근기록과 급여는 자동 변경하지 않습니다.':
    'Saves an in-app notice for the selected staff and sends it right away to anyone with push notifications on. All staff are selected by default. Clock-out records and pay are not changed automatically.',
  '수락한 대체 직원에게 근무를 이전합니다. 추가수당은 실제 출근기록이 있을 때 반영합니다.':
    'Moves the shift to the covering employee who accepted. The bonus counts only when there is a matching attendance record.',
  '내용을 확인한 후 저장하세요.': 'Review the details, then save.',
  '종료 날짜': 'End date',
  '종료 시각 (뉴욕)': 'End time (New York)',
  '받는 직원 ({n}/{total}명)': 'Recipients ({n}/{total})',
  '안내 내용': 'Message',
  '퇴근이 출근보다 이르면 다음 날 퇴근으로 계산합니다.':
    'If the end time is earlier than the start time, the shift ends the next day.',
  '업무 / 장소': 'Role / location',
  '생년월일 8자리 (YYYYMMDD)': 'Birth date, 8 digits (YYYYMMDD)',
  '연락처 (예: 914-555-0123)': 'Phone (e.g. 914-555-0123)',
  '로그인 이메일': 'Login email',
  '직원 색상': 'Color',
  '개인별 시급 ({currency})': 'Hourly rate ({currency})',
  '대체할 근무': 'Shift to cover',
  '근무 선택': 'Choose a shift',
  '대체 직원': 'Covering employee',
  '직원 선택': 'Choose an employee',
  '근무일 7일 이내인 일정은 선택 목록에 표시되지 않습니다.':
    'Shifts less than 7 days away are not listed.',
  '대체 직원 추가수당 ({currency})': 'Bonus for covering employee ({currency})',
  '받는 사람': 'To',
  '원근무자 {from} → 대체자 {to}': 'Original: {from} → Covering: {to}',
  '직원용 보기 화면입니다. 일정 변경은 관리자에게 문의하세요.':
    'This is the staff view. Ask your manager to change the schedule.',
  '대체근무를 신청할 수 있습니다.': 'You can request a swap for this shift.',
  '대체근무 신청 기한이 지났습니다.': 'The swap request deadline has passed.',
  '전 직원에게 공지 저장': 'Save notice for all staff',
  '선택한 {n}명에게 공지 저장': 'Save notice for {n} selected',

  // Sign-in and password
  로그인: 'Sign in',
  '로그인하지 못했습니다.': 'Could not sign in.',
  '생년월일과 비밀번호를 입력하세요. 직원 초기 비밀번호는 생년월일입니다.':
    'Enter your birth date and password. Staff start with their birth date as the password.',
  '예: 19900115': 'e.g. 19900115',
  '확인 중…': 'Checking…',
  '비밀번호 변경': 'Change password',
  '새 비밀번호가 일치하지 않습니다.': 'The new passwords do not match.',
  '비밀번호를 변경하지 못했습니다.': 'Could not change the password.',
  '초기 비밀번호는 생년월일입니다. 지금 새 비밀번호로 변경하거나 나중에 변경할 수 있습니다.':
    'Your initial password is your birth date. You can change it now or later.',
  '새 비밀번호를 입력하면 다음 로그인부터 적용됩니다.':
    'The new password applies from your next sign-in.',
  '현재 비밀번호': 'Current password',
  '초기 비밀번호: 생년월일 8자리': 'Initial password: 8-digit birth date',
  '새 비밀번호': 'New password',
  '새 비밀번호 확인': 'Confirm new password',
  '변경 중…': 'Changing…',
  나중에: 'Later',

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

  // Task inbox
  '작업을 불러오지 못했습니다.': 'Could not load tasks.',
  완료: 'Done',
  'status::확인': 'Seen',
  확인: 'Mark as seen',
  '새 작업': 'New',
  '로그인하고 열기': 'Sign in to open',
  스케줄: 'Schedule',
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
  '작업 제목': 'Task title',
  '예: 3번 홀 장비 점검': 'e.g. Check equipment at hole 3',
  '작업 안내': 'Instructions',
  '필요한 준비물, 완료 기준 등을 적어주세요.': 'What is needed, what counts as done, etc.',
  '작업 보내기': 'Send task',
  '{n}개의 진행 중 작업': '{n} open tasks',
  '전체 {n}건': '{n} total',
  '마감 {date}': 'Due {date}',
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
  'Pelham Shift 테스트 알림': 'Pelham Shift test notification',
  '이 기기에서 푸시 알림을 받을 수 있습니다.': 'This device can receive push notifications.',

  // Server errors (API routes, lib/operations.ts, lib/birth-auth.ts, lib/push.ts)
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
  '등록된 생년월일을 찾을 수 없습니다. 관리자에게 확인하세요.':
    'That birth date is not registered. Check with your manager.',
  '생년월일 또는 비밀번호를 확인하세요.': 'Check your birth date or password.',
  '새 비밀번호는 8~128자로 입력하세요.': 'The new password must be 8–128 characters.',
  '생년월일로 로그인한 뒤 변경할 수 있습니다.': 'Sign in with your birth date to change it.',
  '관리자 비밀번호는 변경할 수 없습니다.': 'The manager password cannot be changed.',
  '현재 비밀번호를 확인하세요.': 'Check your current password.',
  'DATABASE_URL 환경변수가 설정되지 않았습니다.': 'The DATABASE_URL environment variable is not set.',
  '필수 입력값을 확인하세요.': 'Check the required fields.',
  '날짜를 확인하세요.': 'Check the date.',
  '근무시간은 30분 단위로 입력하세요.': 'Enter shift times in 30-minute steps.',
  '시간 형식을 확인하세요.': 'Check the time format.',
  '0 이상의 유효한 금액/시간을 입력하세요.': 'Enter a valid amount or time of 0 or more.',
  '관리자 권한이 필요합니다.': 'Manager permission is required.',
  '등록된 직원을 선택하세요.': 'Choose a registered employee.',
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
  '통화를 선택하세요.': 'Choose a currency.',
  '근무를 선택하세요.': 'Choose a shift.',
  '본인 근무만 대체 신청할 수 있습니다.': 'You can only request swaps for your own shifts.',
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
  '잘못된 작업 처리입니다.': 'Invalid task action.',
  '5MB 이하 파일만 업로드할 수 있습니다.': 'Only files up to 5 MB can be uploaded.',
  '.xlsx 형식으로 저장한 파일을 선택하세요.': 'Choose a file saved as .xlsx.',
  '첫 번째 시트가 비어 있습니다.': 'The first sheet is empty.',
  '최대 3,000개 행을 가져올 수 있습니다.': 'You can import up to 3,000 rows.',
  '제목 행과 출근기록이 필요합니다.': 'The file needs a header row and attendance rows.',
  '필수 열을 연결하세요.': 'Match the required columns.',
};

// Messages built from data (a date, a row number, a list of names) can't be dictionary keys.
const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
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
    /^(\d+)행: 직원 ID, 날짜\(YYYY-MM-DD\), 시간\(HH:mm\)을 확인하세요\.$/,
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
