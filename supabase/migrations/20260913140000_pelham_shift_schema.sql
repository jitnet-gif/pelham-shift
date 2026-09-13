-- Pelham Shift · Supabase(Postgres) 스키마
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- lib/domain.ts 의 데이터 구조를 정규화한 테이블입니다. 배포된 앱은 아직 Cloudflare D1(워크스페이스당
-- JSON 한 덩어리)에 저장하며, 이 스키마는 앱과 연결되어 있지 않습니다.
--
-- 접근 정책: 앱은 Supabase Auth가 아니라 ChatGPT 로그인을 사용하므로, 모든 테이블에 RLS를 켜고 정책은
-- 두지 않습니다. 브라우저용 publishable 키로는 어떤 행도 읽거나 쓸 수 없고, 서버의 secret 키(RLS 우회)로만
-- 접근합니다. 시급·급여·푸시 서명키가 공개 키로 노출되지 않게 하기 위함입니다.
--
-- ID는 앱과 같은 text 값을 그대로 씁니다(직원 'E001', 그 외 UUID 문자열). 직원 ID는 워크스페이스마다
-- 반복되므로 모든 테이블이 (workspace_id, id) 복합 키를 쓰고, 외래키도 같은 워크스페이스 안에서만 연결됩니다.

begin;

-- 워크스페이스: 관리자(소유자) 1명당 1개. id = 소유자의 ChatGPT 사용자 ID (D1 workspaces.id 와 동일)
create table if not exists public.workspaces (
  id            text primary key,
  owner_user_id text not null,
  currency      text not null default 'USD' check (currency in ('USD', 'CAD', 'KRW', 'PHP')),
  published     boolean not null default false,          -- 직원에게 스케줄 공개 여부
  version       integer not null default 1,              -- 동시 수정 방지용 낙관적 잠금
  created_at    timestamptz not null default now()
);

-- 직원: 이름 앞 컬러 상자, 시급, 로그인 이메일(직원 본인 확인용, 미등록이면 null)
create table if not exists public.employees (
  workspace_id text not null references public.workspaces (id) on delete cascade,
  id           text not null,
  name         text not null check (char_length(name) between 1 and 80),
  color        text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  role         text not null check (char_length(role) between 1 and 60),
  hourly_rate  numeric(12, 2) not null default 0 check (hourly_rate >= 0),
  email        text check (email = lower(email) and email like '%_@_%'),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, id)
);
create unique index if not exists employees_email_key on public.employees (workspace_id, email) where email is not null;

-- 근무 스케줄: 퇴근이 출근보다 이르면 다음 날 퇴근(야간 근무)
create table if not exists public.shifts (
  workspace_id         text not null references public.workspaces (id) on delete cascade,
  id                   text not null,
  employee_id          text not null,
  work_date            date not null,
  start_time           time not null,
  end_time             time not null,
  area                 text not null check (char_length(area) between 1 and 60),
  original_employee_id text,                               -- 대체 승인 시 원근무자
  created_at           timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, employee_id) references public.employees (workspace_id, id),
  foreign key (workspace_id, original_employee_id) references public.employees (workspace_id, id),
  check (start_time <> end_time),
  check (original_employee_id is null or original_employee_id <> employee_id)
);
create index if not exists shifts_employee_date_idx on public.shifts (workspace_id, employee_id, work_date);
create index if not exists shifts_date_idx on public.shifts (workspace_id, work_date);
create index if not exists shifts_original_employee_idx on public.shifts (workspace_id, original_employee_id) where original_employee_id is not null;

-- 대체근무: 신청(requested) → 대체자 수락(accepted) → 관리자 승인(approved) / 거절·취소(rejected)
create table if not exists public.swaps (
  workspace_id     text not null references public.workspaces (id) on delete cascade,
  id               text not null,
  shift_id         text not null,
  from_employee_id text not null,
  to_employee_id   text not null,
  status           text not null default 'requested' check (status in ('requested', 'accepted', 'approved', 'rejected')),
  bonus            numeric(12, 2) not null default 0 check (bonus >= 0),  -- 승인 시 대체자 추가수당
  created_at       timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, shift_id) references public.shifts (workspace_id, id) on delete cascade,
  foreign key (workspace_id, from_employee_id) references public.employees (workspace_id, id),
  foreign key (workspace_id, to_employee_id) references public.employees (workspace_id, id),
  check (from_employee_id <> to_employee_id)
);
-- 한 근무에는 진행 중이거나 승인된 대체가 하나만 (거절된 요청은 제외)
create unique index if not exists swaps_one_active_per_shift on public.swaps (workspace_id, shift_id) where status <> 'rejected';
create index if not exists swaps_shift_idx on public.swaps (workspace_id, shift_id);
create index if not exists swaps_from_idx on public.swaps (workspace_id, from_employee_id);
create index if not exists swaps_to_idx on public.swaps (workspace_id, to_employee_id);

-- 출근기록: 출근기계 엑셀에서 가져온 실제 근무시간 (급여 계산 기준)
create table if not exists public.attendance (
  workspace_id  text not null references public.workspaces (id) on delete cascade,
  id            text not null,
  employee_id   text not null,
  work_date     date not null,
  clock_in      time not null,
  clock_out     time not null,                            -- 출근보다 이르면 다음 날 퇴근
  break_minutes integer not null default 0 check (break_minutes between 0 and 1440),
  created_at    timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, employee_id) references public.employees (workspace_id, id),
  check (clock_in <> clock_out),
  unique (workspace_id, employee_id, work_date, clock_in)  -- 같은 기록 중복 업로드 방지
);

-- 메시지·공지: sender/recipient 는 직원 ID 또는 'admin', 수신자는 'all'(전 직원)도 가능.
-- 'admin'/'all' 예약값 때문에 직원 외래키를 걸지 않습니다.
create table if not exists public.messages (
  workspace_id text not null references public.workspaces (id) on delete cascade,
  id           text not null,
  sender       text not null,
  recipient    text not null,
  body         text not null check (char_length(body) between 1 and 4000),
  kind         text not null default 'message' check (kind in ('message', 'rain')),  -- rain = 우천 근무 종료 공지
  created_at   timestamptz not null default now(),
  primary key (workspace_id, id)
);
create index if not exists messages_created_idx on public.messages (workspace_id, created_at desc);
create index if not exists messages_recipient_idx on public.messages (workspace_id, recipient);

-- 메시지 확인 기록 (앱의 readBy 배열)
create table if not exists public.message_reads (
  workspace_id text not null,
  message_id   text not null,
  reader       text not null,                             -- 직원 ID 또는 'admin'
  read_at      timestamptz not null default now(),
  primary key (workspace_id, message_id, reader),
  foreign key (workspace_id, message_id) references public.messages (workspace_id, id) on delete cascade
);

-- 작업 수신함: 관리자가 직원에게 보낸 작업 지시
create table if not exists public.tasks (
  workspace_id text not null references public.workspaces (id) on delete cascade,
  id           text not null,
  assigned_to  text not null,
  title        text not null check (char_length(title) between 1 and 160),
  notes        text not null default '' check (char_length(notes) <= 2000),
  due_date     date not null,
  status       text not null default 'sent' check (status in ('sent', 'seen', 'completed')),
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  primary key (workspace_id, id),
  foreign key (workspace_id, assigned_to) references public.employees (workspace_id, id),
  check (status <> 'completed' or completed_at is not null)
);
create index if not exists tasks_assignee_idx on public.tasks (workspace_id, assigned_to, status);

-- 웹 푸시: 워크스페이스별 VAPID 키(서명용 비밀키 포함)
create table if not exists public.push_keys (
  workspace_id text primary key references public.workspaces (id) on delete cascade,
  public_key   text not null,
  private_key  text not null,
  tick_key     text not null,                             -- 외부 cron 점검 주소의 비밀 키
  created_at   timestamptz not null default now()
);

-- 웹 푸시 구독 (기기 1대당 1행)
create table if not exists public.push_subscriptions (
  endpoint     text primary key check (endpoint like 'https://%'),
  workspace_id text not null references public.workspaces (id) on delete cascade,
  member       text not null,                             -- 직원 ID 또는 'admin'
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists push_subscriptions_member_idx on public.push_subscriptions (workspace_id, member);

-- 출근 1시간 전 알림 중복 발송 방지 (근무 시작 1건당 1행)
create table if not exists public.push_sent (
  id           text primary key,
  workspace_id text not null references public.workspaces (id) on delete cascade,
  sent_at      timestamptz not null default now()
);
create index if not exists push_sent_workspace_idx on public.push_sent (workspace_id, sent_at);

-- 모든 테이블 RLS 켜기 (정책 없음 = publishable 키로 접근 불가, secret 키 서버만 접근)
alter table public.workspaces         enable row level security;
alter table public.employees          enable row level security;
alter table public.shifts             enable row level security;
alter table public.swaps              enable row level security;
alter table public.attendance         enable row level security;
alter table public.messages           enable row level security;
alter table public.message_reads      enable row level security;
alter table public.tasks              enable row level security;
alter table public.push_keys          enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_sent          enable row level security;

commit;
