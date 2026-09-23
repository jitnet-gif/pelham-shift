'use client';
import { FormEvent, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { notice } from '@/lib/notice';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useLang } from './use-lang';

export default function PasswordChange({
  open,
  initial,
  onClose,
  onChanged,
}: {
  open: boolean;
  initial: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useLang();
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (nextPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/password' + window.location.search, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw Error(result.error || '비밀번호를 변경하지 못했습니다.');
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      onChanged();
      onClose();
    } catch (reason) {
      setError(notice(reason, '비밀번호를 변경하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="shift-dialog password-dialog">
        <DialogTitle><KeyRound size={20} /> {t('비밀번호 변경')}</DialogTitle>
        <DialogDescription>
          {initial
            ? t('첫 비밀번호는 본인 직원 ID 입니다. 단말에서 눌러 보이는 번호이니 지금 바꾸는 편이 좋습니다.')
            : t('새 비밀번호를 입력하면 다음 로그인부터 적용됩니다.')}
        </DialogDescription>
        <form onSubmit={submit}>
          <label className="field">
            {t('현재 비밀번호')}
            <input
              type="password"
              autoComplete="current-password"
              placeholder={initial ? t('첫 비밀번호: 내 직원 ID') : ''}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
          <label className="field">
            {t('새 비밀번호 (4자 이상)')}
            <input
              type="password"
              minLength={4}
              maxLength={128}
              autoComplete="new-password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              required
            />
          </label>
          <label className="field">
            {t('새 비밀번호 확인')}
            <input
              type="password"
              minLength={4}
              maxLength={128}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
          {error && <p role="alert" className="formerror">{t(error)}</p>}
          <div className="password-actions">
            <button className="button primary" disabled={busy}>
              {busy ? t('변경 중…') : t('비밀번호 변경')}
            </button>
            {initial && (
              <button className="button" type="button" onClick={onClose}>
                {t('나중에')}
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
