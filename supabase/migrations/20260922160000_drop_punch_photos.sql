-- Pelham Shift · 출퇴근 사진 보관 중단
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- 출퇴근 사진은 더 이상 서버에 남기지 않습니다.
-- 사진은 여전히 그 자리에서 찍고, 서버는 '사진이 맞는지'만 확인한 뒤 버립니다.
-- 기록에 남는 것은 언제 찍었는지(photoAt)와 어디서 찍었는지(spot)뿐이고,
-- 사진 자체는 직원 기기를 떠나 어디에도 저장되지 않습니다.
--
-- 이미 쌓여 있던 얼굴 사진은 이 표와 함께 지워집니다. 되돌릴 수 없습니다.
-- 사진이 필요한 상황이었다면 지우기 전에 따로 받아 두세요.

begin;

drop table if exists public.punch_photos;

commit;

-- 확인: 아무 행도 나오지 않아야 합니다.
--
--   select table_name from information_schema.tables
--    where table_schema = 'public' and table_name = 'punch_photos';
