'use client';
import './lang-toggle.css';
import { useLang } from './use-lang';

export default function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label="Language / 언어">
      <button type="button" aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>
        한국어
      </button>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
        EN
      </button>
    </div>
  );
}
