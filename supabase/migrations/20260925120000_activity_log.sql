-- Pelham Shift · 활동 로그 (작업 지시·삭제·복구·로그인·앱 사용)
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- 이 표는 쌓기만 합니다. 한 번 들어간 줄은 고치지도 지우지도 못합니다 —
-- UPDATE·DELETE·TRUNCATE 는 아래 트리거가 막고, 앱 코드에도 그런 문장이 없습니다.
-- 엑셀 복구도 이 표에는 손대지 않습니다. 복구 직전의 워크스페이스 전체는 여기에 한 줄로 남습니다.
--
-- 한계: 데이터베이스 주인(postgres 역할)은 트리거나 표 자체를 DROP 할 수 있습니다.
-- Supabase 에서는 이것까지 막는 이벤트 트리거를 만들 수 없으므로, 그 권한은 대시보드 접근으로만 지킵니다.
--
-- detail 은 명령에 실어 보낸 값과, 지우거나 고친 기록의 전체 모습(before/after)입니다.
-- 접근 정책: 다른 표와 같이 RLS 를 켜고 정책은 두지 않아, 공개 API 로는 읽을 수 없습니다.

begin;

create table if not exists public.activity_log (
  id          bigserial primary key,
  workspace   text not null,
  at          timestamptz not null default now(),
  actor       text not null,
  actor_name  text,
  admin       integer not null default 0,
  kind        text not null,   -- 'command' | 'app' | 'auth' | 'backup'
  action      text not null,   -- taskCreate, employeeRemove, open, tab, login ...
  target      text,
  detail      jsonb,
  ip          text,
  user_agent  text
);

create index if not exists activity_log_workspace_at on public.activity_log (workspace, at desc);

create or replace function public.activity_log_is_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'activity_log 은 지우거나 고칠 수 없습니다.';
end;
$$;

drop trigger if exists activity_log_no_change on public.activity_log;
create trigger activity_log_no_change
  before update or delete on public.activity_log
  for each row execute function public.activity_log_is_append_only();

drop trigger if exists activity_log_no_truncate on public.activity_log;
create trigger activity_log_no_truncate
  before truncate on public.activity_log
  for each statement execute function public.activity_log_is_append_only();

alter table public.activity_log enable row level security;

commit;

-- 확인: 로그가 한 줄이라도 쌓인 뒤, 아래 두 문장은 모두 오류가 나야 정상입니다.
--
--   delete from public.activity_log;
--   truncate public.activity_log;
