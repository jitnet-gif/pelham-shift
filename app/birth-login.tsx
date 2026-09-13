'use client';
import { FormEvent, useState } from 'react';
import { LockKeyhole } from 'lucide-react';

export default function BirthLogin() {
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/birth-login' + window.location.search, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate, password }),
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
        <h2>생년월일로 로그인</h2>
        <p>초기 비밀번호는 생년월일입니다. 변경한 경우 새 비밀번호를 입력하세요.</p>
      </div>
      <form onSubmit={submit}>
        <label className="field">
          생년월일
          <input
            inputMode="numeric"
            autoComplete="bday"
            maxLength={8}
            pattern="[0-9]{8}"
            placeholder="예: 19900115"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value.replace(/\D/g, ''))}
            required
          />
        </label>
        <label className="field">
          비밀번호 <small>선택</small>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="변경한 비밀번호가 있는 경우"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
      {error && <p role="alert" className="formerror">{error}</p>}
    </section>
  );
}
