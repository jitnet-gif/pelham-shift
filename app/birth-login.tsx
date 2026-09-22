'use client';
import { FormEvent, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useLang } from './use-lang';

// 직원은 단말에 대는 그 번호(직원 ID)로 들어옵니다. 이름을 고르지 않으므로 로그인 전에
// 직원 명부가 화면으로 나갈 일도 없습니다 — 누가 일하는지는 로그인한 뒤에만 보입니다.
// 관리자 계정은 번호가 없으니 이 칸에 'admin' 을 칩니다.
export default function BirthLogin() {
  const { t } = useLang();
  const [employeeId, setEmployeeId] = useState('');
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
        body: JSON.stringify({ employeeId: employeeId.trim(), password }),
      });
      const result = (await response.json()) as { error?: string; team?: string };
      if (!response.ok) throw Error(result.error || '로그인하지 못했습니다.');
      // 로그인한 주소에 그대로 머뭅니다. '/' 로 보내면 출퇴근 앱으로 들어온 사람이 스케줄 앱으로 새어 나갑니다.
      const here = window.location.pathname;
      window.location.assign(result.team ? here + '?team=' + encodeURIComponent(result.team) : here);
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
        <p>{t('직원 ID와 비밀번호를 입력하세요. 첫 비밀번호는 본인 직원 ID 입니다.')}</p>
      </div>
      <form onSubmit={submit}>
        <label className="field">
          {t('직원 ID')}
          {/*
            번호만 치는 사람이 거의 전부지만 inputMode 는 두지 않습니다.
            아이폰의 숫자 자판에는 글자로 넘어갈 길이 없어, 그러면 'admin' 을 칠 수 없게 됩니다.
          */}
          <input
            autoComplete="username"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
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
        <button className="button primary" disabled={busy || !employeeId.trim()}>
          {busy ? t('확인 중…') : t('로그인')}
        </button>
      </form>
      {error && <p role="alert" className="formerror">{t(error)}</p>}
    </section>
  );
}
