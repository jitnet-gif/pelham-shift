-- Pelham Shift · 앱이 실제로 쓰는 테이블 (Cloudflare D1 스키마를 그대로 옮긴 것)
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- 워크스페이스 데이터는 D1 때와 같이 workspaces.state 에 JSON 한 덩어리로 저장합니다.
-- 시간 값은 앱이 ISO 문자열로 비교하므로 text 로 둡니다.
--
-- 접근 정책: 앱 서버만 DATABASE_URL 로 직접 접속합니다. 모든 테이블에 RLS를 켜고 정책은 두지 않아,
-- Supabase 공개 API(anon/publishable 키)로는 세션 토큰·비밀번호 해시·푸시 서명키를 읽거나 쓸 수 없습니다.

begin;

create table if not exists public.workspaces (
  id      text primary key,
  owner   text not null,
  state   text not null,
  version integer not null default 1
);

create table if not exists public.birth_sessions (
  token      text primary key,
  workspace  text not null,
  actor      text not null,
  admin      integer not null,
  expires_at text not null
);

create table if not exists public.password_credentials (
  workspace  text not null,
  actor      text not null,
  salt       text not null,
  hash       text not null,
  updated_at text not null,
  primary key (workspace, actor)
);

create table if not exists public.push_keys (
  workspace   text primary key,
  public_key  text not null,
  private_key text not null,
  tick_key    text not null
);

create table if not exists public.push_sent (
  id        text primary key,
  workspace text not null,
  sent_at   text not null
);

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  workspace  text not null,
  member     text not null,
  p256dh     text not null,
  auth       text not null,
  created_at text not null
);

alter table public.workspaces           enable row level security;
alter table public.birth_sessions       enable row level security;
alter table public.password_credentials enable row level security;
alter table public.push_keys            enable row level security;
alter table public.push_sent            enable row level security;
alter table public.push_subscriptions   enable row level security;

commit;
