'use client';
import './shift-todos.css';
import { useState, type KeyboardEvent } from 'react';
import { ListChecks, MessageSquareText, Plus, Save, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { MAX_SHIFT_TODOS, localTime, type ShiftTodo, type TodoTemplate } from '@/lib/domain';
import { useLang } from './use-lang';

// 근무 하나에 붙은 할 일 목록입니다. 근무 상세 창과 직원의 출퇴근 화면이 함께 씁니다.
// 근무를 편성하는 사람은 할 일을 넣고 빼고 템플릿으로 저장하며, 그 근무의 직원은 체크하고 메모를 남깁니다.
// 근무 상세 창의 <form> 안에 놓이므로 단추는 모두 type="button" 이고, 입력칸의 Enter 는 여기서 받습니다 —
// 그대로 두면 창의 기본 단추(근무 삭제)가 눌립니다.
export default function ShiftTodos({
  shiftId,
  todos,
  templates = [],
  canManage,
  canCheck,
  busy,
  name,
  heading,
  className,
  onCommand,
}: {
  shiftId: string;
  todos: ShiftTodo[];
  templates?: TodoTemplate[];
  canManage: boolean;
  canCheck: boolean;
  busy: boolean;
  name: (id: string) => string;
  // 출퇴근 화면처럼 목록 위에 다른 제목이 필요할 때 씁니다.
  heading?: string;
  className?: string;
  onCommand: (type: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const { t } = useLang();
  const [draft, setDraft] = useState('');
  const [memoFor, setMemoFor] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const done = todos.filter((x) => x.doneAt).length;
  const full = todos.length >= MAX_SHIFT_TODOS;

  const enter = (go: () => void) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    go();
  };
  const add = () => {
    const text = draft.trim();
    if (!text || busy || full) return;
    void onCommand('todoAdd', { shiftId, text }).then((ok) => ok && setDraft(''));
  };
  const openMemo = (todo: ShiftTodo) => {
    setMemoFor(todo.id);
    setMemo(todo.memo ?? '');
  };
  const saveMemo = () => {
    if (busy) return;
    void onCommand('todoMemo', { id: memoFor, memo }).then((ok) => ok && setMemoFor(''));
  };
  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name || busy || !todos.length) return;
    void onCommand('todoTemplate', { name, items: todos.map((x) => x.text) }).then(
      (ok) => ok && (setSaving(false), setTemplateName('')),
    );
  };

  // 직원에게는 할 일이 없는 근무에 빈 칸을 보여 줄 까닭이 없습니다.
  if (!todos.length && !canManage) return null;

  return (
    <section className={'todos' + (className ? ' ' + className : '')} aria-label={t('할 일')}>
      <header className="todos-head">
        <ListChecks size={17} aria-hidden="true" />
        <b>{heading ?? t('할 일')}</b>
        {!!todos.length && (
          <span className={'todos-count' + (done === todos.length ? ' all' : '')}>
            {done}/{todos.length}
          </span>
        )}
      </header>
      {!!todos.length && (
        <div className="todos-bar" aria-hidden="true">
          <i style={{ width: (done / todos.length) * 100 + '%' }} />
        </div>
      )}
      {!!todos.length && (
        <ul className="todos-list">
          {todos.map((todo) => (
            <li key={todo.id} className={todo.doneAt ? 'done' : ''}>
              <label className="todos-item">
                <Checkbox
                  checked={!!todo.doneAt}
                  disabled={!canCheck || busy}
                  onCheckedChange={(on) => void onCommand('todoCheck', { id: todo.id, done: on ? '1' : '' })}
                />
                <span>{todo.text}</span>
              </label>
              {canCheck && memoFor !== todo.id && (
                <button
                  type="button"
                  className="todos-icon"
                  aria-label={todo.memo ? t('메모 고치기') : t('메모 남기기')}
                  title={todo.memo ? t('메모 고치기') : t('메모 남기기')}
                  disabled={busy}
                  onClick={() => openMemo(todo)}
                >
                  <MessageSquareText size={16} />
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  className="todos-icon"
                  aria-label={t('할 일 빼기')}
                  title={t('할 일 빼기')}
                  disabled={busy}
                  onClick={() => void onCommand('todoRemove', { id: todo.id })}
                >
                  <X size={16} />
                </button>
              )}
              {todo.doneAt && (
                <small className="todos-meta">
                  {t('{time} 체크 · {name}', { time: localTime(new Date(todo.doneAt)), name: name(todo.doneBy ?? '') })}
                </small>
              )}
              {todo.memo && memoFor !== todo.id && (
                <p className="todos-memo">
                  {todo.memo}
                  {todo.memoAt && (
                    <small>
                      {' · '}
                      {name(todo.memoBy ?? '')} {localTime(new Date(todo.memoAt))}
                    </small>
                  )}
                </p>
              )}
              {memoFor === todo.id && (
                <div className="todos-memoedit">
                  <textarea
                    maxLength={500}
                    value={memo}
                    placeholder={t('예: 재고가 2박스만 남았습니다.')}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                  <div>
                    <button type="button" className="button" onClick={() => setMemoFor('')}>
                      {t('취소')}
                    </button>
                    <button type="button" className="button primary" disabled={busy} onClick={saveMemo}>
                      {t('메모 저장')}
                    </button>
                  </div>
                  <small>{t('비워서 저장하면 메모를 지웁니다. 관리자에게 알림이 갑니다.')}</small>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="todos-manage">
          <div className="todos-add">
            <input
              value={draft}
              maxLength={160}
              disabled={full}
              placeholder={full ? t('할 일은 {n}개까지 넣을 수 있습니다.', { n: MAX_SHIFT_TODOS }) : t('할 일 적기')}
              aria-label={t('할 일 적기')}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={enter(add)}
            />
            <button type="button" className="button" disabled={busy || full || !draft.trim()} onClick={add}>
              <Plus size={15} />
              {t('추가')}
            </button>
          </div>
          {!!templates.length && (
            <div className="todos-templates">
              <span>{t('템플릿 넣기')}</span>
              {templates.map((tpl) => (
                <span key={tpl.id} className="todos-chip">
                  <button
                    type="button"
                    disabled={busy || todos.length + tpl.items.length > MAX_SHIFT_TODOS}
                    title={tpl.items.join('\n')}
                    onClick={() => void onCommand('todoAdd', { shiftId, items: tpl.items })}
                  >
                    {tpl.name} <em>{tpl.items.length}</em>
                  </button>
                  <button
                    type="button"
                    aria-label={t('{name} 템플릿 지우기', { name: tpl.name })}
                    disabled={busy}
                    onClick={() => {
                      if (confirm(t('{name} 템플릿을 지울까요? 이미 근무에 넣은 할 일은 그대로 남습니다.', { name: tpl.name })))
                        void onCommand('todoTemplateRemove', { id: tpl.id });
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {!!todos.length &&
            (saving ? (
              <div className="todos-add">
                <input
                  value={templateName}
                  maxLength={60}
                  placeholder={t('템플릿 이름 (예: Proshop 오픈)')}
                  aria-label={t('템플릿 이름')}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={enter(saveTemplate)}
                />
                <button type="button" className="button" onClick={() => setSaving(false)}>
                  {t('취소')}
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={busy || !templateName.trim()}
                  onClick={saveTemplate}
                >
                  {t('저장')}
                </button>
              </div>
            ) : (
              <button type="button" className="linkbutton todos-save" onClick={() => setSaving(true)}>
                <Save size={14} />
                {t('이 목록을 템플릿으로 저장')}
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
