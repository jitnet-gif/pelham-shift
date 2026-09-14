import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { isLang, locale, translate, weekdays, type Lang, type Vars } from '@/lib/i18n';

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
    document.title = translate(lang, 'Pelham Shift · 근무 관리');
  }, [lang]);
  const t = useCallback((text: string, vars?: Vars) => translate(lang, text, vars), [lang]);
  return { lang, setLang, t, days: weekdays(lang), locale: locale(lang) };
}
