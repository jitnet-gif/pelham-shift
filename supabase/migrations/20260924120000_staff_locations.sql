-- Pelham Shift · 관리자 위치 지도(/admin)가 읽는 직원 위치
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- 직원마다 마지막으로 받은 자리 한 줄만 둡니다. 지나온 길(이력)은 남기지 않습니다.
-- 자리는 출근을 찍어 둔 동안에만 받고, 퇴근하면 서버가 그 줄을 지웁니다.
-- 좌표는 double precision 입니다 — numeric 으로 두면 앱이 문자열로 받습니다.
-- at 은 서버가 받은 시각(ISO 문자열)이고, 기기가 보낸 시각은 믿지 않습니다.
--
-- 접근 정책: 다른 표와 같이 RLS 를 켜고 정책은 두지 않아, 공개 API 로는 읽을 수 없습니다.

begin;

create table if not exists public.staff_locations (
  workspace text not null,
  actor     text not null,
  lat       double precision not null,
  lng       double precision not null,
  accuracy  double precision,
  at        text not null,
  primary key (workspace, actor)
);

alter table public.staff_locations enable row level security;

commit;
