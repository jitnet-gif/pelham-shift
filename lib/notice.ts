// 화면에 올릴 말을 고릅니다. 스케줄·출퇴근·작업 수신함·로그인이 모두 이 한 줄을 지납니다.
//
// 서버가 돌려주는 말은 전부 한국어 원문이고, 그 원문이 곧 lib/i18n.ts 의 번역 열쇠입니다.
// 그런데 요청이 서버에 닿지도 못하면, 던져지는 말은 브라우저가 제 말로 지은 것입니다 —
// 크롬 'Failed to fetch', 사파리 'Load failed', 파이어폭스 'NetworkError when attempting to
// fetch resource.' 열쇠가 없으니 t() 는 원문 그대로 흘려보내고, 번역도 안 된 영어 한 줄이
// 띠(.statusbar)에 박힌 채 남습니다. 읽는 사람이 손 쓸 것도 없는 말이라 여기서 거릅니다.

/** 서버에 닿지 못한 것인가 — 전파 끊김, 중단, 서버 대신 돌아온 HTML 오류 페이지. */
export const unreachable = (e: unknown): boolean =>
  e instanceof TypeError || // fetch 가 통째로 실패했습니다 (오프라인·DNS·CORS)
  e instanceof SyntaxError || // 서버 대신 게이트웨이가 HTML 을 돌려줘 r.json() 이 깨졌습니다
  (e as { name?: string } | null)?.name === 'AbortError';

/**
 * 서버가 돌려준 우리 말만 그대로 쓰고, 그 밖의 것은 fallback 으로 덮습니다.
 * fallback 은 반드시 lib/i18n.ts 에 열쇠가 있는 한국어 원문이어야 합니다.
 */
export const notice = (e: unknown, fallback: string): string => {
  if (e instanceof Error && e.message && !unreachable(e)) return e.message;
  // 전파가 끊긴 것은 흔한 일이라 조용히 넘어갑니다. 그 밖에 뜻밖의 것만 콘솔에 남겨
  // 고칠 사람이 원문을 볼 수 있게 합니다.
  if (!unreachable(e)) console.warn('[pelham]', e);
  return fallback;
};
