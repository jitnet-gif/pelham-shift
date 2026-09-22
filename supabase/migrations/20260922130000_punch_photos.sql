-- Pelham Shift · 출퇴근 사진
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- 사진은 workspaces.state(JSON 한 덩어리) 안에 넣지 않습니다. state 는 화면을 열 때마다 통째로
-- 읽고 쓰는 값이라, 사진이 섞이면 앱 전체가 무거워집니다. 그래서 따로 둡니다.
-- state 에는 '언제 찍혔는지'(photoAt)만 남고, 사진 자체는 이 표에 있습니다.
--
-- 보관 기간: 출퇴근 기록을 직원이 확인하는 동안만 필요합니다. 새 사진을 저장할 때마다
-- 지지난 급여 기간보다 오래된 사진은 앱이 지웁니다.
--
-- 사진을 꺼내는 길은 앱의 /api/punch-photo 하나뿐입니다. 그 길은 로그인을 확인하고,
-- punch_id 와 workspace 를 함께 걸러, 관리자에게는 자기 워크스페이스만, 직원에게는 본인 것만 내줍니다.
-- 그래서 이 표는 Supabase 가 자동으로 만들어 주는 API 쪽으로는 아예 닫아 둡니다.

begin;

create table if not exists public.punch_photos (
  punch_id  text not null,
  kind      text not null,             -- 'in' (출근) 또는 'out' (퇴근)
  workspace text not null,
  taken_on  text not null,             -- YYYY-MM-DD, 매장 시각 기준. 오래된 사진을 지울 때 씁니다.
  photo     text not null,             -- data:image/jpeg;base64,... (작게 줄인 사진)
  primary key (punch_id, kind)
);

-- kind 는 두 값뿐입니다. 오타로 'IN' 이 들어가면 그 사진은 영영 못 찾습니다.
-- create table if not exists 는 이미 있는 표에 제약을 붙여 주지 않아, 따로 겁니다.
alter table public.punch_photos drop constraint if exists punch_photos_kind_check;
alter table public.punch_photos add constraint punch_photos_kind_check check (kind in ('in', 'out'));

-- 오래된 사진을 지울 때 쓰는 조건(workspace + taken_on) 그대로입니다.
create index if not exists punch_photos_workspace_taken_on
  on public.punch_photos (workspace, taken_on);

-- 앱이 아닌 길로는 닫습니다. RLS 를 켜고 정책을 하나도 두지 않으면
-- anon·authenticated 역할에게는 모든 행이 보이지 않습니다.
alter table public.punch_photos enable row level security;
-- RLS 와 별개로 권한 자체도 거둡니다. 둘 중 하나만으로도 막히지만, 한쪽이 풀려도 남아 있도록 둘 다 둡니다.
-- Supabase 가 아닌 Postgres 에는 anon·authenticated 역할이 없습니다. 없으면 건너뜁니다 —
-- 없는 역할에 revoke 하면 오류가 나고, 트랜잭션 전체가 되돌아가 표조차 만들어지지 않습니다.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.punch_photos from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.punch_photos from authenticated;
  end if;
end $$;

commit;

-- ── 확인 ────────────────────────────────────────────────────────────────
-- 앱은 DATABASE_URL(또는 POSTGRES_URL)의 역할로 붙습니다. 그 역할이 이 표의 주인이거나
-- BYPASSRLS 를 가지고 있어야 사진이 저장됩니다. 아니면 RLS 에 막혀 저장이 실패하는데,
-- 앱은 사진 저장 실패를 삼키도록 되어 있어(출퇴근 기록은 살리려고) 화면에는 아무 말도 안 나옵니다.
-- 아래를 실행해 can_insert 가 true 인지 보세요. false 면 앱의 접속 역할을 표의 주인으로 맞춰야 합니다.
--
--   select current_user,
--          pg_catalog.pg_get_userbyid(c.relowner) as owner,
--          has_table_privilege(current_user, 'public.punch_photos', 'INSERT') as can_insert,
--          (select rolbypassrls from pg_roles where rolname = current_user) as bypasses_rls
--     from pg_class c
--    where c.oid = 'public.punch_photos'::regclass;
--
-- 사진이 실제로 쌓이는지:
--
--   select workspace, taken_on, kind, count(*), pg_size_pretty(sum(length(photo))::bigint) as size
--     from public.punch_photos group by 1, 2, 3 order by 2 desc limit 20;
