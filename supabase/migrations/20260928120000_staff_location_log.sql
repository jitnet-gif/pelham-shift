-- Pelham Shift · 직원 위치 이력 (근무 중 30분마다 한 줄)
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- staff_locations 는 지도에 쓰는 '마지막 자리' 한 줄뿐이고, 이 표는 지나온 자리를 쌓습니다.
-- 자리는 출근을 찍어 둔 동안, 직원 앱이 화면에 열려 있을 때만 들어옵니다(웹앱의 한계).
-- 같은 사람의 마지막 줄에서 30분이 지나야 다음 줄을 쌓습니다 — 간격은 서버가 정합니다.
-- at 은 서버가 받은 시각이고, 기기가 보낸 시각은 믿지 않습니다.
--
-- 위치는 개인정보라 activity_log 와 달리 지우기를 막지 않습니다. 보관 기한이 지난 줄은 이렇게 지웁니다:
--   delete from public.staff_location_log where at < now() - interval '90 days';
-- 접근 정책: 다른 표와 같이 RLS 를 켜고 정책은 두지 않아, 공개 API 로는 읽을 수 없습니다.

begin;

create table if not exists public.staff_location_log (
  id          bigserial primary key,
  workspace   text not null,
  actor       text not null,
  actor_name  text,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    double precision,
  at          timestamptz not null default now()
);

create index if not exists staff_location_log_actor_at on public.staff_location_log (workspace, actor, at desc);
create index if not exists staff_location_log_workspace_at on public.staff_location_log (workspace, at desc);

alter table public.staff_location_log enable row level security;

commit;
