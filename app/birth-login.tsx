'use client';
import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import type { Member } from '@/lib/birth-auth';
import { useLang } from './use-lang';

// 드롭다운 값 하나에 팀과 직원 id 를 함께 담습니다. 이름은 팀끼리 겹칠 수 있어 id 로 로그인합니다.
const optionValue = (member: Member) => member.team + '|' + member.id;

export default function BirthLogin() {
  const { t } = useLang();
  const [members, setMembers] = useState<Member[]>([]);
  const [choice, setChoice] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/birth-login' + window.location.search)
      .then((response) => response.json() as Promise<{ members?: Member[]; error?: string }>)
      .then((result) => {
        if (!live) return;
        if (result.members) setMembers(result.members);
        else setError(result.error || '직원 목록을 불러오지 못했습니다.');
      })
      .catch(() => live && setError('직원 목록을 불러오지 못했습니다.'));
    return () => {
      live = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const [team, actor] = choice.split('|');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/birth-login' + window.location.search, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, actor, birthDate, password }),
      });
      const result = (await response.json()) as { error?: string; team?: string };
      if (!response.ok) throw Error(result.error || '로그인하지 못했습니다.');
      const target = result.team ? '/?team=' + encodeURIComponent(result.team) : '/';
      window.location.assign(target);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '로그인하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="birth-login panel">
      <div className="birth-login-icon"><LockKeyhole size={22} /></div>
      <div>
        <h2>{t('로그인')}</h2>
        <p>{t('이름을 고르고 생년월일과 비밀번호를 입력하세요. 직원 초기 비밀번호는 1111입니다.')}</p>
      </div>
      <form onSubmit={submit}>
        <label className="field">
          {t('이름')}
          <select
            autoComplete="username"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            required
          >
            <option value="">{t('선택하세요')}</option>
            {members.map((member) => (
              <option key={optionValue(member)} value={optionValue(member)}>
                {t(member.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t('생년월일')}
          <input
            inputMode="numeric"
            autoComplete="bday"
            maxLength={8}
            pattern="[0-9]{8}"
            placeholder={t('예: 19900115')}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value.replace(/\D/g, ''))}
            required
          />
        </label>
        <label className="field">
          {t('비밀번호')}
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="button primary" disabled={busy || !choice || birthDate.length !== 8}>
          {busy ? t('확인 중…') : t('로그인')}
        </button>
      </form>
      {error && <p role="alert" className="formerror">{t(error)}</p>}
    </section>
  );
}
