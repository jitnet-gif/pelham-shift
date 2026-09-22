-- Pelham Shift · 출퇴근 사진
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- 사진은 workspaces.state(JSON 한 덩어리) 안에 넣지 않습니다. state 는 화면을 열 때마다 통째로
-- 읽고 쓰는 값이라, 사진이 섞이면 앱 전체가 무거워집니다. 그래서 따로 둡니다.
-- state 에는 '언제 찍혔는지'(photoAt)만 남고, 사진 자체는 이 표에 있습니다.
--
-- 보관 기간: 출퇴근 기록을 직원이 확인하는 동안만 필요합니다. 새 사진을 저장할 때마다
-- 지지난 급여 기간보다 오래된 사진은 앱이 지웁니다.

begin;

create table if not exists public.punch_photos (
  punch_id  text not null,
  kind      text not null,             -- 'in' (출근) 또는 'out' (퇴근)
  workspace text not null,
  taken_on  text not null,             -- YYYY-MM-DD, 매장 시각 기준. 오래된 사진을 지울 때 씁니다.
  photo     text not null,             -- data:image/jpeg;base64,... (작게 줄인 사진)
  primary key (punch_id, kind)
);

create index if not exists punch_photos_workspace_taken_on
  on public.punch_photos (workspace, taken_on);

alter table public.punch_photos enable row level security;

commit;
