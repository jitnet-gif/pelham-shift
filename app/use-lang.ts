import { useCallback, useEffect } from 'react';
import { locale, translate, weekdays, type Vars } from '@/lib/i18n';
import { appAt } from './apps';

// 화면 글은 영어 하나로 갑니다. 고르는 기능은 없앴고, 한국어 원문은 lib/i18n.ts 의 열쇠로만 남습니다.
// 서버와 화면이 같은 말로 그리니 첫 그림과 두 번째 그림이 어긋나는 일도 없습니다.
const LANG = 'en' as const;

export function useLang() {
  useEffect(() => {
    document.documentElement.lang = LANG;
    // 제목은 지금 주소의 앱 이름입니다. 출퇴근 앱 창에 스케줄 앱 이름이 뜨지 않게.
    document.title = translate(LANG, appAt(window.location.pathname).title);
  }, []);
  const t = useCallback((text: string, vars?: Vars) => translate(LANG, text, vars), []);
  return { lang: LANG, t, days: weekdays(LANG), locale: locale(LANG) };
}
