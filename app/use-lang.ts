import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { isLang, locale, translate, weekdays, type Lang, type Vars } from '@/lib/i18n';
import { appAt } from './apps';

const STORAGE_KEY = 'pelham_lang';
const listeners = new Set<() => void>();
let chosen: Lang | null = null;

// A first visit follows the device language; after that the saved choice wins.
function current(): Lang {
  if (chosen) return chosen;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return (chosen = saved);
  } catch {}
  return (chosen = (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en');
}

export function setLang(lang: Lang) {
  chosen = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useLang() {
  // The server always renders Korean; the viewer's language takes over right after hydration.
  const lang = useSyncExternalStore(subscribe, current, (): Lang => 'ko');
  useEffect(() => {
    document.documentElement.lang = lang;
    // 제목은 지금 주소의 앱 이름입니다. 출퇴근 앱 창에 스케줄 앱 이름이 뜨지 않게.
    document.title = translate(lang, appAt(window.location.pathname).title);
  }, [lang]);
  const t = useCallback((text: string, vars?: Vars) => translate(lang, text, vars), [lang]);
  return { lang, setLang, t, days: weekdays(lang), locale: locale(lang) };
}
