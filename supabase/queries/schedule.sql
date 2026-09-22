-- Pelham Shift · 일정(근무표) 확인용 조회 모음
-- 실행: Supabase 대시보드 → SQL Editor → 필요한 블록 하나를 통째로 붙여넣고 Run.
--       (블록마다 맨 위 `with` 부터 마지막 `;` 까지가 한 덩어리입니다. 파일 전체를 한 번에 돌리지 마세요.)
--
-- 모두 읽기 전용입니다. 아무것도 바꾸지 않으니 몇 번을 돌려도 안전합니다.
-- 모든 표에 RLS가 켜져 있고 정책이 없어, anon/publishable 키로는 한 줄도 나오지 않습니다.
-- 대시보드 SQL Editor 나 DATABASE_URL 직접 접속으로만 보입니다.
--
-- 데이터가 있는 곳: 일정은 따로 표가 없습니다. workspaces.state 에 JSON 한 덩어리로 들어 있고,
-- 그 안의 shifts / employees / punches / timeOff / availability / swaps 배열이 일정 정보입니다.
-- state 는 jsonb 가 아니라 text 라서, 꺼낼 때마다 state::jsonb 로 한 번 바꿔 줘야 합니다.
--
-- 앱과 숫자를 맞추기 위해 지킨 규칙 (lib/domain.ts 와 같습니다)
--   · 시각은 'HH:MM' 문자열입니다. 분으로 바꿔서 계산합니다.
--   · 자정을 넘기는 근무가 있어 길이는 (끝 - 시작 + 1440) mod 1440 으로 셉니다. 그냥 빼면 음수가 됩니다.
--   · 근무시간 = 그 길이에서 breakMinutes 를 뺀 값, 0 밑으로는 내려가지 않습니다.
--   · 주는 일요일에 시작합니다. Postgres 의 date_trunc('week') 는 월요일이라 쓰지 않습니다.
--   · 오늘은 서버 시간(UTC)이 아니라 America/New_York 기준입니다.
--   · 급여 기간은 2026-09-20 일요일부터 2주씩입니다. 기준일보다 앞선 날짜도 맞게 떨어지도록 floor 로 나눕니다.
--
-- 두 가지는 정해 두었으니 필요하면 바꾸세요
--   1) 그만둔 직원(archived)도 지난 근무가 남아 있어 결과에 포함했습니다. 빼려면 각 조회의
--      `-- and not coalesce(e.archived, false)` 주석을 풀면 됩니다.
--   2) workspaces 에 팀이 여러 개 있을 수 있어, 모든 조회가 workspace 를 함께 보여 주고 그 단위로 묶습니다.
--      한 팀만 보려면 where 에 `and w.id = '팀id'` 를 더하세요. 팀 id 는 아래 1번으로 확인합니다.


-- ───────────────────────────────────────────────────────────────────────────
-- 1. 워크스페이스 한눈에 보기 · 어떤 팀이 있고 일정이 얼마나 들어 있는지
--    published 가 false 면 직원 화면에는 근무표가 아직 보이지 않습니다.
-- ───────────────────────────────────────────────────────────────────────────
select
  w.id                                                                        as workspace,
  w.owner,
  w.version,
  (w.state::jsonb ->> 'published')::boolean                                   as published,
  jsonb_array_length(coalesce(w.state::jsonb -> 'employees',    '[]'::jsonb)) as employees,
  jsonb_array_length(coalesce(w.state::jsonb -> 'shifts',       '[]'::jsonb)) as shifts,
  jsonb_array_length(coalesce(w.state::jsonb -> 'punches',      '[]'::jsonb)) as punches,
  jsonb_array_length(coalesce(w.state::jsonb -> 'timeOff',      '[]'::jsonb)) as time_off,
  jsonb_array_length(coalesce(w.state::jsonb -> 'availability', '[]'::jsonb)) as availability,
  jsonb_array_length(coalesce(w.state::jsonb -> 'swaps',        '[]'::jsonb)) as swaps,
  (select min(x ->> 'date') from jsonb_array_elements(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb)) x) as first_shift,
  (select max(x ->> 'date') from jsonb_array_elements(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb)) x) as last_shift,
  pg_size_pretty(octet_length(w.state)::bigint)                                     as state_size
from public.workspaces w
order by w.id;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. 하루 근무표 · 그 날 누가 언제 어디서 일하는지
--    날짜는 params 에서 한 줄만 바꾸면 됩니다.
-- ───────────────────────────────────────────────────────────────────────────
with params as (
  select (now() at time zone 'America/New_York')::date as day   -- 다른 날을 보려면: date '2026-09-22'
),
shift_raw as (
  select w.id as workspace, s.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb))
         as s(id text, "employeeId" text, date text, "start" text, "end" text,
              area text, note text, "breakMinutes" int)
),
shift as (
  select workspace, id, "employeeId", date::date as day, "start", "end", area, note,
         coalesce("breakMinutes", 0) as break_min,
         substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int as start_min,
         mod(substr("end", 1, 2)::int * 60 + substr("end", 4, 2)::int
             - (substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int) + 1440, 1440) as span_min
  from shift_raw
),
emp as (
  select w.id as workspace, e.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'employees', '[]'::jsonb))
         as e(id text, name text, role text, rate numeric, archived boolean)
)
select s.workspace,
       s.day,
       to_char(s.day, 'Dy')                                            as weekday,
       coalesce(e.name, '(직원 목록에 없음: ' || s."employeeId" || ')') as name,
       s.area,
       s."start",
       s."end",
       s.break_min,
       round(greatest(0, s.span_min - s.break_min) / 60.0, 2)          as hours,
       s.note
from shift s
cross join params p
left join emp e on e.workspace = s.workspace and e.id = s."employeeId"
where s.day = p.day
  -- and not coalesce(e.archived, false)
order by s.workspace, s.start_min, name;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. 지금 이 순간 근무 중인 사람 · 자정을 넘긴 어제 근무까지 같이 봅니다
-- ───────────────────────────────────────────────────────────────────────────
with params as (
  select (now() at time zone 'America/New_York')                 as ts,
         (now() at time zone 'America/New_York')::date           as day,
         extract(hour   from now() at time zone 'America/New_York')::int * 60
       + extract(minute from now() at time zone 'America/New_York')::int as now_min
),
shift_raw as (
  select w.id as workspace, s.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb))
         as s(id text, "employeeId" text, date text, "start" text, "end" text,
              area text, note text, "breakMinutes" int)
),
shift as (
  select workspace, id, "employeeId", date::date as day, "start", "end", area,
         substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int as start_min,
         mod(substr("end", 1, 2)::int * 60 + substr("end", 4, 2)::int
             - (substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int) + 1440, 1440) as span_min
  from shift_raw
),
emp as (
  select w.id as workspace, e.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'employees', '[]'::jsonb))
         as e(id text, name text, role text, archived boolean)
)
select s.workspace,
       p.ts                                                            as now_ny,
       coalesce(e.name, s."employeeId")                                as name,
       s.area,
       s.day                                                           as shift_date,
       s."start",
       s."end",
       -- 시작한 지 몇 분 지났는지 / 끝까지 몇 분 남았는지
       p.now_min - ((s.day - p.day) * 1440 + s.start_min)              as in_for_min,
       ((s.day - p.day) * 1440 + s.start_min + s.span_min) - p.now_min as left_min
from shift s
cross join params p
left join emp e on e.workspace = s.workspace and e.id = s."employeeId"
where s.day between p.day - 1 and p.day
  and (s.day - p.day) * 1440 + s.start_min <= p.now_min
  and p.now_min < (s.day - p.day) * 1440 + s.start_min + s.span_min
order by s.workspace, s.area, name;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. 직원별 주간 예정 시간 · 주는 일요일에 시작합니다
--    40시간을 넘는 주가 보이면 초과근무가 예정되어 있다는 뜻입니다.
-- ───────────────────────────────────────────────────────────────────────────
with params as (
  select (now() at time zone 'America/New_York')::date - 28 as from_day,   -- 조회 시작
         (now() at time zone 'America/New_York')::date + 28 as to_day      -- 조회 끝
),
shift_raw as (
  select w.id as workspace, s.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb))
         as s(id text, "employeeId" text, date text, "start" text, "end" text,
              area text, note text, "breakMinutes" int)
),
shift as (
  select workspace, "employeeId", date::date as day,
         greatest(0,
           mod(substr("end", 1, 2)::int * 60 + substr("end", 4, 2)::int
               - (substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int) + 1440, 1440)
           - coalesce("breakMinutes", 0)) / 60.0 as hours
  from shift_raw
),
emp as (
  select w.id as workspace, e.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'employees', '[]'::jsonb))
         as e(id text, name text, archived boolean)
)
-- 이름을 먼저 붙인 뒤에 묶습니다. group by 에 별칭을 그냥 쓰면
-- Postgres 가 별칭이 아니라 원래 컬럼(e.name)으로 읽어, 이름 없는 근무가 한 덩어리로 뭉칩니다.
select workspace,
       week_start,
       week_start + 6                         as week_end,
       name,
       count(*)                               as shifts,
       round(sum(hours), 2)                   as hours,
       round(greatest(0, sum(hours) - 40), 2) as over_40
from (
  select s.workspace,
         s.day - extract(dow from s.day)::int as week_start,   -- 일요일
         coalesce(e.name, s."employeeId")     as name,
         s.hours
  from shift s
  cross join params p
  left join emp e on e.workspace = s.workspace and e.id = s."employeeId"
  where s.day between p.from_day and p.to_day
    -- and not coalesce(e.archived, false)
) x
group by workspace, week_start, name
order by workspace, week_start desc, hours desc;


-- ───────────────────────────────────────────────────────────────────────────
-- 5. 급여 기간별 예정 시간 · 2026-09-20 일요일부터 2주씩
--    실제 지급액이 아니라 '예정된 근무'만 셉니다. 지급 기준은 찍힌 출퇴근(punches)입니다.
-- ───────────────────────────────────────────────────────────────────────────
with shift_raw as (
  select w.id as workspace, s.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb))
         as s(id text, "employeeId" text, date text, "start" text, "end" text,
              area text, note text, "breakMinutes" int)
),
shift as (
  select workspace, "employeeId", date::date as day,
         greatest(0,
           mod(substr("end", 1, 2)::int * 60 + substr("end", 4, 2)::int
               - (substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int) + 1440, 1440)
           - coalesce("breakMinutes", 0)) / 60.0 as hours
  from shift_raw
),
emp as (
  select w.id as workspace, e.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'employees', '[]'::jsonb))
         as e(id text, name text, rate numeric, archived boolean)
)
select workspace,
       period_from,
       period_from + 13            as period_to,
       name,
       count(*)                    as shifts,
       round(sum(hours), 2)        as hours,
       round(sum(hours) * rate, 2) as plain_pay   -- 가산·차감 없는 단순 곱
from (
  select s.workspace,
         -- floor 로 나눠야 기준일보다 앞선 날짜도 같은 주기 위에 떨어집니다
         date '2026-09-20' + (floor((s.day - date '2026-09-20')::numeric / 14) * 14)::int as period_from,
         coalesce(e.name, s."employeeId") as name,
         coalesce(e.rate, 0)              as rate,
         s.hours
  from shift s
  left join emp e on e.workspace = s.workspace and e.id = s."employeeId"
  -- where not coalesce(e.archived, false)
) x
group by workspace, period_from, name, rate
order by workspace, period_from desc, hours desc;


-- ───────────────────────────────────────────────────────────────────────────
-- 6. 날짜·장소별 배치 · 어느 날 어디에 몇 명이 깔려 있는지
--    사람이 0명인 칸은 여기 나오지 않습니다. 빈 날은 9번으로 확인하세요.
-- ───────────────────────────────────────────────────────────────────────────
with params as (
  select (now() at time zone 'America/New_York')::date      as from_day,
         (now() at time zone 'America/New_York')::date + 13 as to_day
),
shift_raw as (
  select w.id as workspace, s.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb))
         as s(id text, "employeeId" text, date text, "start" text, "end" text,
              area text, note text, "breakMinutes" int)
),
shift as (
  select workspace, "employeeId", date::date as day, area, "start", "end",
         greatest(0,
           mod(substr("end", 1, 2)::int * 60 + substr("end", 4, 2)::int
               - (substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int) + 1440, 1440)
           - coalesce("breakMinutes", 0)) / 60.0 as hours
  from shift_raw
)
select s.workspace,
       s.day,
       to_char(s.day, 'Dy')           as weekday,
       s.area,
       count(*)                       as shifts,
       count(distinct s."employeeId") as people,
       min(s."start")                 as opens,
       max(s."end")                   as closes,
       round(sum(s.hours), 2)         as hours
from shift s
cross join params p
where s.day between p.from_day and p.to_day
group by s.workspace, s.day, s.area
order by s.workspace, s.day, s.area;


-- ───────────────────────────────────────────────────────────────────────────
-- 7. 한 사람이 겹쳐 잡힌 근무 · 같은 사람이 같은 시간에 두 군데 배정된 경우
--    앱의 overlap() 과 같은 방식이라, 자정을 넘긴 근무도 제대로 겹쳐 봅니다.
-- ───────────────────────────────────────────────────────────────────────────
with shift_raw as (
  select w.id as workspace, s.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb))
         as s(id text, "employeeId" text, date text, "start" text, "end" text,
              area text, note text, "breakMinutes" int)
),
shift as (
  select workspace, id, "employeeId", date::date as day, "start", "end", area,
         -- 1970-01-01 부터 흐른 분. 날짜가 달라도 그대로 비교됩니다.
         (date::date - date '1970-01-01') * 1440
           + substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int as t0,
         (date::date - date '1970-01-01') * 1440
           + substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int
           + mod(substr("end", 1, 2)::int * 60 + substr("end", 4, 2)::int
                 - (substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int) + 1440, 1440) as t1
  from shift_raw
),
emp as (
  select w.id as workspace, e.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'employees', '[]'::jsonb))
         as e(id text, name text)
)
select a.workspace,
       coalesce(e.name, a."employeeId")         as name,
       a.day as day_a, a."start" as start_a, a."end" as end_a, a.area as area_a,
       b.day as day_b, b."start" as start_b, b."end" as end_b, b.area as area_b,
       least(a.t1, b.t1) - greatest(a.t0, b.t0) as overlap_min
from shift a
join shift b
  on b.workspace = a.workspace
 and b."employeeId" = a."employeeId"
 and b.id > a.id                  -- 같은 짝을 두 번 세지 않습니다
 and a.t0 < b.t1 and b.t0 < a.t1  -- 앱의 overlap() 과 같은 조건
left join emp e on e.workspace = a.workspace and e.id = a."employeeId"
order by a.workspace, a.day, name;


-- ───────────────────────────────────────────────────────────────────────────
-- 8. 승인된 휴무·근무 불가와 부딪히는 근무 · 앱의 blockedBy() 와 같은 판정
--    관리자는 경고만 받고 배정 자체는 되기 때문에, 이렇게 남아 있는 것이 있습니다.
-- ───────────────────────────────────────────────────────────────────────────
with shift_raw as (
  select w.id as workspace, s.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb))
         as s(id text, "employeeId" text, date text, "start" text, "end" text,
              area text, note text, "breakMinutes" int)
),
shift as (
  select workspace, id, "employeeId", date::date as day, "start", "end", area,
         substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int as start_min,
         mod(substr("end", 1, 2)::int * 60 + substr("end", 4, 2)::int
             - (substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int) + 1440, 1440) as span_min
  from shift_raw
),
emp as (
  select w.id as workspace, e.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'employees', '[]'::jsonb))
         as e(id text, name text)
),
timeoff as (
  select w.id as workspace, t.id, t."employeeId", t."from"::date as from_day, t."to"::date as to_day,
         coalesce(t."allDay", true) as all_day, t.reason, t.status,
         case when t."start" is null then null
              else substr(t."start", 1, 2)::int * 60 + substr(t."start", 4, 2)::int end as start_min,
         case when t."start" is null or t."end" is null then null
              else mod(substr(t."end", 1, 2)::int * 60 + substr(t."end", 4, 2)::int
                       - (substr(t."start", 1, 2)::int * 60 + substr(t."start", 4, 2)::int) + 1440, 1440) end as span_min
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'timeOff', '[]'::jsonb))
         as t(id text, "employeeId" text, "from" text, "to" text, "allDay" boolean,
              "start" text, "end" text, reason text, status text)
),
avail as (
  select w.id as workspace, a.id, a."employeeId", a.weekday, coalesce(a."allDay", true) as all_day,
         a.note, a.status, a."effectiveFrom",
         case when a."start" is null then null
              else substr(a."start", 1, 2)::int * 60 + substr(a."start", 4, 2)::int end as start_min,
         case when a."start" is null or a."end" is null then null
              else mod(substr(a."end", 1, 2)::int * 60 + substr(a."end", 4, 2)::int
                       - (substr(a."start", 1, 2)::int * 60 + substr(a."start", 4, 2)::int) + 1440, 1440) end as span_min
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'availability', '[]'::jsonb))
         as a(id text, "employeeId" text, weekday int, "allDay" boolean,
              "start" text, "end" text, note text, "effectiveFrom" text, status text)
)
select * from (
  select s.workspace, '휴무' as kind, coalesce(e.name, s."employeeId") as name,
         s.day, s."start" as shift_start, s."end" as shift_end, s.area,
         t.reason as why, t.from_day::text || ' ~ ' || t.to_day::text as rule_window
  from shift s
  join timeoff t
    on t.workspace = s.workspace and t."employeeId" = s."employeeId"
   and t.status = 'approved'
   and s.day between t.from_day and t.to_day
   and (t.all_day or t.start_min is null or t.span_min is null
        or (s.start_min < t.start_min + t.span_min and t.start_min < s.start_min + s.span_min))
  left join emp e on e.workspace = s.workspace and e.id = s."employeeId"

  union all

  select s.workspace, '근무 불가' as kind, coalesce(e.name, s."employeeId") as name,
         s.day, s."start" as shift_start, s."end" as shift_end, s.area,
         a.note as why, '매주 ' || to_char(s.day, 'Dy') as rule_window
  from shift s
  join avail a
    on a.workspace = s.workspace and a."employeeId" = s."employeeId"
   and a.status = 'approved'
   and a.weekday = extract(dow from s.day)::int
   and (a."effectiveFrom" is null or s.day >= a."effectiveFrom"::date)
   and (a.all_day or a.start_min is null or a.span_min is null
        or (s.start_min < a.start_min + a.span_min and a.start_min < s.start_min + s.span_min))
  left join emp e on e.workspace = s.workspace and e.id = s."employeeId"
) clash
order by workspace, day, name;


-- ───────────────────────────────────────────────────────────────────────────
-- 9. 아무도 잡히지 않은 날 · 근무표에 구멍이 있는지
-- ───────────────────────────────────────────────────────────────────────────
with params as (
  select (now() at time zone 'America/New_York')::date      as from_day,
         (now() at time zone 'America/New_York')::date + 27 as to_day
),
day_list as (
  select w.id as workspace, d::date as day
  from public.workspaces w
  cross join params p
  cross join generate_series(p.from_day, p.to_day, interval '1 day') d
),
shift as (
  select w.id as workspace, (s ->> 'date')::date as day, s ->> 'area' as area
  from public.workspaces w,
       jsonb_array_elements(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb)) s
)
select d.workspace,
       d.day,
       to_char(d.day, 'Dy')                                as weekday,
       count(s.day)                                        as shifts,
       coalesce(string_agg(distinct s.area, ', '), '(없음)') as areas
from day_list d
left join shift s on s.workspace = d.workspace and s.day = d.day
group by d.workspace, d.day
having count(s.day) = 0        -- 빈 날만 봅니다. 전부 보려면 이 줄을 지우세요.
order by d.workspace, d.day;


-- ───────────────────────────────────────────────────────────────────────────
-- 10. 예정 vs 실제 · 잡힌 근무와 그 날 찍힌 출퇴근을 나란히
--     지각(late_min)은 그 날 첫 예정 시각과 첫 출근 시각을 견준 대략입니다.
--     정확한 지각·급여는 lib/domain.ts 의 lateBy() / payroll() 이 겹치는 근무를 짝지어 계산합니다.
-- ───────────────────────────────────────────────────────────────────────────
with params as (
  select (now() at time zone 'America/New_York')::date - 13 as from_day,
         (now() at time zone 'America/New_York')::date      as to_day
),
shift_raw as (
  select w.id as workspace, s.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb))
         as s(id text, "employeeId" text, date text, "start" text, "end" text,
              area text, note text, "breakMinutes" int)
),
planned as (
  select workspace, "employeeId", date::date as day,
         min("start") as first_start,
         min(substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int) as start_min,
         round(sum(greatest(0,
           mod(substr("end", 1, 2)::int * 60 + substr("end", 4, 2)::int
               - (substr("start", 1, 2)::int * 60 + substr("start", 4, 2)::int) + 1440, 1440)
           - coalesce("breakMinutes", 0)) / 60.0), 2) as hours
  from shift_raw
  group by workspace, "employeeId", date::date
),
punch_raw as (
  select w.id as workspace, p.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'punches', '[]'::jsonb))
         as p(id text, "employeeId" text, date text, "in" text, "out" text,
              area text, status text, breaks jsonb)
),
actual as (
  select workspace, "employeeId", date::date as day,
         min("in")  as first_in,
         min(substr("in", 1, 2)::int * 60 + substr("in", 4, 2)::int) as in_min,
         max("out") as last_out,
         count(*) filter (where "out" is null)                       as still_in,
         count(*) filter (where status = 'disputed')                 as disputed,
         count(*) filter (where "out" is not null
                            and coalesce(status, 'pending') not in ('approved', 'disputed')) as unconfirmed,
         round(sum(
           case when "out" is null then 0 else greatest(0,
             mod(substr("out", 1, 2)::int * 60 + substr("out", 4, 2)::int
                 - (substr("in", 1, 2)::int * 60 + substr("in", 4, 2)::int) + 1440, 1440)
             -- 무급 휴게만 뺍니다. 유급 휴게는 일한 시간으로 칩니다.
             - coalesce((select sum(mod(substr(b ->> 'end', 1, 2)::int * 60 + substr(b ->> 'end', 4, 2)::int
                                        - (substr(b ->> 'start', 1, 2)::int * 60 + substr(b ->> 'start', 4, 2)::int)
                                        + 1440, 1440))
                         from jsonb_array_elements(coalesce(breaks, '[]'::jsonb)) b
                         where b ->> 'end' is not null
                           and not coalesce((b ->> 'paid')::boolean, false)), 0)
           ) / 60.0 end), 2) as hours
  from punch_raw
  group by workspace, "employeeId", date::date
),
emp as (
  select w.id as workspace, e.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'employees', '[]'::jsonb))
         as e(id text, name text)
)
select coalesce(pl.workspace, ac.workspace)                          as workspace,
       coalesce(pl.day, ac.day)                                      as day,
       coalesce(e.name, coalesce(pl."employeeId", ac."employeeId"))   as name,
       pl.first_start                                                as planned_in,
       ac.first_in                                                   as actual_in,
       ac.last_out                                                   as actual_out,
       pl.hours                                                      as planned_hours,
       ac.hours                                                      as actual_hours,
       round(coalesce(ac.hours, 0) - coalesce(pl.hours, 0), 2)       as gap_hours,
       greatest(0, ac.in_min - pl.start_min)                         as late_min,
       case when ac."employeeId" is null then '결근(찍힘 없음)'
            when pl."employeeId" is null then '예정 없는 출근'
            when ac.in_min > pl.start_min then '지각'
            else '정상' end                                           as flag,
       ac.still_in, ac.unconfirmed, ac.disputed
from planned pl
full join actual ac
  on ac.workspace = pl.workspace and ac."employeeId" = pl."employeeId" and ac.day = pl.day
cross join params p
left join emp e
  on e.workspace = coalesce(pl.workspace, ac.workspace)
 and e.id = coalesce(pl."employeeId", ac."employeeId")
where coalesce(pl.day, ac.day) between p.from_day and p.to_day
order by workspace, day desc, name;


-- ───────────────────────────────────────────────────────────────────────────
-- 11. 짝이 안 맞는 데이터 · 고치기 전에 확인할 것들
--     직원 목록에 없는 employeeId, 형식이 깨진 시각·날짜, 끝나지 않은 출퇴근.
-- ───────────────────────────────────────────────────────────────────────────
with emp as (
  select w.id as workspace, e ->> 'id' as id, e ->> 'name' as name
  from public.workspaces w,
       jsonb_array_elements(coalesce(w.state::jsonb -> 'employees', '[]'::jsonb)) e
),
shift as (
  select w.id as workspace, s ->> 'id' as id, s ->> 'employeeId' as "employeeId",
         s ->> 'date' as date, s ->> 'start' as "start", s ->> 'end' as "end"
  from public.workspaces w,
       jsonb_array_elements(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb)) s
),
punch as (
  select w.id as workspace, p ->> 'id' as id, p ->> 'employeeId' as "employeeId",
         p ->> 'date' as date, p ->> 'in' as "in", p ->> 'out' as "out"
  from public.workspaces w,
       jsonb_array_elements(coalesce(w.state::jsonb -> 'punches', '[]'::jsonb)) p
)
select * from (
  select s.workspace, '직원 목록에 없는 근무' as issue, s.id as row_id,
         s."employeeId" as detail, s.date, s."start" || '~' || s."end" as extra
  from shift s
  where not exists (select 1 from emp e where e.workspace = s.workspace and e.id = s."employeeId")

  union all

  select s.workspace, '시각이 HH:MM 이 아님', s.id, s."start" || ' / ' || s."end", s.date, ''
  from shift s
  where s."start" !~ '^[0-2][0-9]:[0-5][0-9]$' or s."end" !~ '^[0-2][0-9]:[0-5][0-9]$'

  union all

  select s.workspace, '날짜가 YYYY-MM-DD 가 아님', s.id, s.date, s.date, ''
  from shift s
  where s.date !~ '^\d{4}-\d{2}-\d{2}$'

  union all

  select s.workspace, '같은 근무 id 가 두 번', s.id, count(*)::text, min(s.date), ''
  from shift s
  group by s.workspace, s.id
  having count(*) > 1

  union all

  select p.workspace, '퇴근이 안 찍힌 기록', p.id, coalesce(e.name, p."employeeId"), p.date, p."in"
  from punch p
  left join emp e on e.workspace = p.workspace and e.id = p."employeeId"
  where p."out" is null
) issues
order by workspace, issue, date;


-- ───────────────────────────────────────────────────────────────────────────
-- 12. 대체 근무(swaps) 현황 · 누가 누구 근무를 넘겨받았는지
--     approved 인 건만 추가수당(bonus)이 급여에 더해집니다.
-- ───────────────────────────────────────────────────────────────────────────
with swap as (
  select w.id as workspace, r.*
  from public.workspaces w,
       jsonb_to_recordset(coalesce(w.state::jsonb -> 'swaps', '[]'::jsonb))
         as r(id text, "shiftId" text, "from" text, "to" text, status text,
              "createdAt" text, bonus numeric)
),
shift as (
  select w.id as workspace, s ->> 'id' as id, (s ->> 'date')::date as day,
         s ->> 'start' as "start", s ->> 'end' as "end", s ->> 'area' as area,
         s ->> 'employeeId' as "employeeId"
  from public.workspaces w,
       jsonb_array_elements(coalesce(w.state::jsonb -> 'shifts', '[]'::jsonb)) s
),
emp as (
  select w.id as workspace, e ->> 'id' as id, e ->> 'name' as name
  from public.workspaces w,
       jsonb_array_elements(coalesce(w.state::jsonb -> 'employees', '[]'::jsonb)) e
)
select r.workspace,
       r.status,
       s.day,
       s."start", s."end", s.area,
       coalesce(a.name, r."from")       as handed_over_by,
       coalesce(b.name, r."to")         as taken_by,
       coalesce(c.name, s."employeeId") as assigned_now,   -- 근무에 실제로 박혀 있는 사람
       r.bonus,
       left(r."createdAt", 10)          as requested_on
from swap r
left join shift s on s.workspace = r.workspace and s.id = r."shiftId"
left join emp a on a.workspace = r.workspace and a.id = r."from"
left join emp b on b.workspace = r.workspace and b.id = r."to"
left join emp c on c.workspace = r.workspace and c.id = s."employeeId"
order by r.workspace, s.day desc nulls last, r.status;
