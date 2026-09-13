'use client';
import { FormEvent, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

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
      setError(reason instanceof Error ? reason.message : '비밀번호를 변경하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="shift-dialog password-dialog">
        <DialogTitle><KeyRound size={20} /> 비밀번호 변경</DialogTitle>
        <DialogDescription>
          {initial
            ? '초기 비밀번호는 생년월일입니다. 지금 새 비밀번호로 변경하거나 나중에 변경할 수 있습니다.'
            : '새 비밀번호를 입력하면 다음 로그인부터 적용됩니다.'}
        </DialogDescription>
        <form onSubmit={submit}>
          <label className="field">
            현재 비밀번호
            <input
              type="password"
              autoComplete="current-password"
              placeholder={initial ? '비워두면 생년월일로 확인' : ''}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className="field">
            새 비밀번호
            <input
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              required
            />
          </label>
          <label className="field">
            새 비밀번호 확인
            <input
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
          {error && <p role="alert" className="formerror">{error}</p>}
          <div className="password-actions">
            <button className="button primary" disabled={busy}>
              {busy ? '변경 중…' : '비밀번호 변경'}
            </button>
            {initial && (
              <button className="button" type="button" onClick={onClose}>
                나중에
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
