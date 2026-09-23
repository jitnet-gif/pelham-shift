-- Pelham Shift · 특정 날짜의 근무에 Unpublished 딱지를 다시 붙이기
-- 실행: Supabase 대시보드 → SQL Editor → 블록 하나를 통째로 붙여넣고 Run.
--       (1 → 2 → 3 순서로. 파일 전체를 한 번에 돌리지 마세요.)
--
-- 왜 이 파일이 필요한가
--   앱의 '공개'는 날짜별이 아니라 워크스페이스 전체 스위치 하나입니다(state.published).
--   publish 는 그때 모든 근무의 draft 를 지우므로(lib/operations.ts 의 `case 'publish'`),
--   한 번 공개하면 '어느 근무가 새로 넣은 것이었는지'가 기록에 남지 않습니다.
--   게시 해제(unpublish)는 published 만 false 로 돌릴 뿐 딱지는 건드리지 않으니,
--   특정 날짜만 다시 '작성 중'으로 보이게 하려면 여기처럼 draft 를 직접 세워야 합니다.
--
-- 이 파일이 하는 일 / 하지 않는 일
--   · 고른 날짜의 근무에 draft: true 를 세웁니다 → 노란 바탕 + 'Unpublished' 표시가 돌아옵니다.
--   · published 는 건드리지 않습니다 → 직원 화면에서 근무표가 사라지지 않습니다.
--   · 근무 자체는 하나도 지우거나 옮기지 않습니다. 시간·담당·메모 모두 그대로입니다.
--
-- ※ 딱지는 직원 화면에도 보입니다 (app/phone-schedule.tsx).
--   lib/workspace.ts 의 visible() 은 draft 를 떼지 않고 그대로 내려보냅니다.
--   직원에게 숨기려는 목적이라면 이 파일이 아니라 게시 해제(전체)를 써야 합니다.
--
-- ※ 관리자가 나중에 '직원에게 공개'를 다시 누르면 이 딱지는 또 지워집니다. 정상 동작입니다.
--
-- ※ version 을 반드시 +1 합니다. 앱은 UPDATE ... WHERE id = ? AND version = ? 로 저장하므로,
--   올리지 않으면 관리자 화면에 열려 있던 예전 state 가 이 변경을 덮어씁니다.
--   올리면 그 화면은 '다른 사용자가 변경했습니다' 를 받고 새로고침하게 됩니다 — 그게 맞는 동작입니다.


-- ───────────────────────────────────────────────────────────────────────────
-- 1. 먼저 확인 · 팀 id 와, 그 날짜에 근무가 몇 건인지
--    바꾸기 전에 이것부터 돌려 workspace 값과 건수를 눈으로 보세요.
-- ───────────────────────────────────────────────────────────────────────────
select
  w.id                                             as workspace,
  w.version,
  (w.state::jsonb ->> 'published')::boolean        as published,
  count(*) filter (where s ->> 'date' = '2026-09-23')                                as on_day,
  count(*) filter (where s ->> 'date' = '2026-09-23'
                     and coalesce((s ->> 'draft')::boolean, false))                  as already_draft
from public.workspaces w
     left join lateral jsonb_array_elements(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb)) s on true
group by w.id, w.version, w.state
order by w.id;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. 딱지 붙이기 · 고른 날짜의 근무에 draft: true
--    아래 두 곳의 날짜 '2026-09-23' 과 팀 id 를 1번에서 본 값으로 맞추세요.
--    (팀이 하나뿐이면 마지막 줄의 and w.id = ... 를 지워도 됩니다.)
-- ───────────────────────────────────────────────────────────────────────────
update public.workspaces w
set state = jsonb_set(
      w.state::jsonb,
      '{shifts}',
      coalesce((
        select jsonb_agg(
                 case when s ->> 'date' = '2026-09-23'      -- ← 되돌릴 날짜
                      then s || '{"draft": true}'::jsonb
                      else s
                 end
                 order by ord)                              -- 배열 순서를 그대로 지킵니다
        from jsonb_array_elements(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb))
             with ordinality as t(s, ord)
      ), '[]'::jsonb)
    )::text,
    version = w.version + 1
where w.id = 'master'                                       -- ← 1번에서 본 팀 id
  and w.state::jsonb -> 'shifts' @> '[{"date": "2026-09-23"}]'::jsonb;   -- 그 날짜가 없으면 아무 줄도 건드리지 않습니다


-- ───────────────────────────────────────────────────────────────────────────
-- 3. 확인 · 그 날짜 근무가 모두 draft 로 섰는지
-- ───────────────────────────────────────────────────────────────────────────
select
  w.id                                   as workspace,
  w.version,
  s ->> 'date'                           as date,
  s ->> 'start'                          as start,
  s ->> 'end'                            as "end",
  s ->> 'area'                           as area,
  coalesce((s ->> 'draft')::boolean, false) as draft
from public.workspaces w,
     lateral jsonb_array_elements(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb)) s
where s ->> 'date' = '2026-09-23'
order by w.id, s ->> 'start';


-- ───────────────────────────────────────────────────────────────────────────
-- 4. 되돌리기 (필요할 때만) · 그 날짜의 딱지를 다시 뗍니다
--    2번을 잘못 돌렸을 때 씁니다. 근무는 그대로 두고 draft 키만 지웁니다.
-- ───────────────────────────────────────────────────────────────────────────
-- update public.workspaces w
-- set state = jsonb_set(
--       w.state::jsonb,
--       '{shifts}',
--       coalesce((
--         select jsonb_agg(
--                  case when s ->> 'date' = '2026-09-23' then s - 'draft' else s end
--                  order by ord)
--         from jsonb_array_elements(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb))
--              with ordinality as t(s, ord)
--       ), '[]'::jsonb)
--     )::text,
--     version = w.version + 1
-- where w.id = 'master';
