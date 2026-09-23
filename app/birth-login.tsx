'use client';
import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { notice } from '@/lib/notice';
import { useLang } from './use-lang';

// 직원은 칸 하나만 씁니다 — 비밀번호 칸에 본인 직원 ID(단말에 대는 번호)를 칩니다.
// 그 번호가 누구인지 서버에 물어 이름을 윗칸에 띄워 주고, 사람은 자기 이름을 눈으로 확인한 뒤 누릅니다.
// 윗칸은 보여 주기만 하는 칸이라 직접 칠 수 없습니다.
// 관리자 계정은 번호가 아니라 이름('admin')으로 들어오므로 아래 토글로 윗칸을 열어 씁니다 —
// 직원이 쓰는 칸 하나에 관리자 비밀번호를 치는 길을 두지 않으려는 것입니다.
export default function BirthLogin() {
  const { t } = useLang();
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 친 번호가 누구인지 물어봅니다. 번호 모양이 갖춰졌을 때만, 그리고 손이 멈춘 뒤에만 묻습니다 —
  // 한 자 칠 때마다 두드리면 명부를 훑는 것과 다르지 않습니다.
  useEffect(() => {
    if (adminMode || !/^\d{4,8}$/.test(password.trim())) {
      setName('');
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.set('id', password.trim());
      fetch('/api/birth-login?' + params)
        .then((response) => response.json() as Promise<{ name?: string; ambiguous?: boolean }>)
        .then((result) => live && setName(result.name || ''))
        .catch(() => live && setName(''));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [password, adminMode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      // 직원은 번호 하나가 곧 이름이자 비밀번호입니다. 관리자만 둘을 따로 냅니다.
      const employeeId = adminMode ? adminId.trim() : password.trim();
      const response = await fetch('/api/birth-login' + window.location.search, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, password }),
      });
      const result = (await response.json()) as { error?: string; team?: string };
      if (!response.ok) throw Error(result.error || '로그인하지 못했습니다.');
      // 로그인한 주소에 그대로 머뭅니다. '/' 로 보내면 출퇴근 앱으로 들어온 사람이 스케줄 앱으로 새어 나갑니다.
      const here = window.location.pathname;
      window.location.assign(result.team ? here + '?team=' + encodeURIComponent(result.team) : here);
    } catch (reason) {
      setError(notice(reason, '로그인하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="birth-login panel">
      <div className="birth-login-icon"><LockKeyhole size={22} /></div>
      <div>
        <h2>{t('로그인')}</h2>
        <p>
          {t(
            adminMode
              ? '관리자 아이디와 비밀번호를 입력하세요.'
              : '비밀번호 칸에 본인 직원 ID 를 입력하면 이름이 나옵니다.',
          )}
        </p>
      </div>
      <form onSubmit={submit}>
        <label className="field">
          {t(adminMode ? '관리자 아이디' : '이름')}
          {adminMode ? (
            <input
              autoComplete="username"
              value={adminId}
              onChange={(event) => setAdminId(event.target.value)}
              required
            />
          ) : (
            // 보여 주기만 하는 칸입니다. 여기에 이름이 떠야 본인이 맞는지 알 수 있습니다.
            <input
              className="birth-login-name"
              value={name}
              placeholder={t('직원 ID 를 입력하세요')}
              aria-label={t('이름')}
              tabIndex={-1}
              readOnly
              disabled
            />
          )}
        </label>
        <label className="field">
          {t(adminMode ? '비밀번호' : '비밀번호 (직원 ID)')}
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus={!adminMode}
          />
        </label>
        <button className="button primary" disabled={busy || !password}>
          {busy ? t('확인 중…') : t('로그인')}
        </button>
      </form>
      {error && <p role="alert" className="formerror">{t(error)}</p>}
      <button
        type="button"
        className="linkbutton birth-login-switch"
        onClick={() => {
          setAdminMode((on) => !on);
          setError('');
          setPassword('');
          setAdminId('');
        }}
      >
        {t(adminMode ? '직원으로 로그인' : '관리자로 로그인')}
      </button>
    </section>
  );
}
