'use client';
import { FormEvent, useState } from 'react';
import { LockKeyhole } from 'lucide-react';

export default function BirthLogin() {
  const [birthDate, setBirthDate] = useState('');
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
        body: JSON.stringify({ birthDate }),
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
        <p>직원 등록 시 설정한 생년월일 8자리를 입력하세요.</p>
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
        <button className="button primary" disabled={busy}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
      {error && <p role="alert" className="formerror">{error}</p>}
    </section>
  );
}
