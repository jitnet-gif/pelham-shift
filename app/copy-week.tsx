'use client';
import './copy-week.css';
import './shift-todos.css';
import { Fragment, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, CopyPlus, ListChecks, Pencil, Plus, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  MAX_SHIFT_TODOS,
  addDays,
  blockedBy,
  canWorkIn,
  duration,
  overlap,
  shiftTodos,
  type Employee,
  type Shift,
  type State,
} from '@/lib/domain';
import { useBackClose } from './use-back';
import { useLang } from './use-lang';

// 한 주의 근무를 다음 주로 옮겨 적는 창입니다. 바로 넣지 않고 미리보기를 먼저 보여 줍니다.
// 미리보기에서 빼고(✕) 되살리고, 줄마다 시간과 할 일을 고치고, 새 근무를 더한 뒤 한 번에 저장합니다 — 저장은 서버의 shiftCopy 하나입니다.
// 다음 주에 이미 같은 사람의 근무가 겹쳐 있으면 처음부터 빼 두고, 시간을 고쳐 겹치지 않게 하기 전까지는 되살릴 수 없습니다.
type Row = {
  key: string;
  employeeId: string;
  date: string;
  start: string;
  end: string;
  area: string;
  note?: string;
  breakMinutes?: number;
  // 할 일은 글만 옮깁니다. 체크와 메모는 지난주 것이라 따라가지 않습니다.
  todos: string[];
  added?: boolean;
  edited?: boolean;
};
type Change = { start: string; end: string; todos: string[] };

const shiftOf = (r: Row): Shift => ({ id: r.key, employeeId: r.employeeId, date: r.date, start: r.start, end: r.end, area: r.area });
const tenMinutes = (v: string) => /^([01]\d|2[0-3]):[0-5]0$/.test(v);

// 열 때마다 새로 그립니다(부모가 열려 있는 동안만 붙입니다). 그래서 미리보기를 되돌리는 effect 가 따로 없습니다.
export default function CopyWeek({
  from: initialFrom,
  data,
  staff,
  areas,
  busy,
  onClose,
  onCommand,
}: {
  // 복사할 주의 일요일.
  from: string;
  data: State;
  staff: Employee[];
  areas: string[];
  busy: boolean;
  onClose: () => void;
  onCommand: (type: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const { t, days } = useLang();
  const name = (id: string) => data.employees.find((e) => e.id === id)?.name ?? id;
  const person = (id: string) => data.employees.find((e) => e.id === id);
  const templates = data.todoTemplates ?? [];
  // 그 주의 근무를 7일 뒤로 옮긴 줄들. 작업본(Unpublished 포함)을 그대로 옮깁니다.
  const copiesOf = (week: string): Row[] =>
    data.shifts
      .filter((s) => s.date >= week && s.date <= addDays(week, 6) && !person(s.employeeId)?.archived)
      .map((s) => ({
        key: 'copy-' + s.id,
        employeeId: s.employeeId,
        date: addDays(s.date, 7),
        start: s.start,
        end: s.end,
        area: s.area,
        note: s.note,
        breakMinutes: s.breakMinutes,
        todos: shiftTodos(data, s.id).map((x) => x.text),
      }));
  // 다음 주에 이미 있는 근무와 겹치는 줄. 이 줄은 빼 둔 채로 시작하고, 겹치는 동안은 되살릴 수 없습니다.
  const taken = (r: Row) => data.shifts.some((s) => s.employeeId === r.employeeId && overlap(s, shiftOf(r)));
  const clashes = (week: string) => new Set(copiesOf(week).filter(taken).map((r) => r.key));

  const [from, setFrom] = useState(initialFrom);
  const [removed, setRemoved] = useState<Set<string>>(() => clashes(initialFrom));
  const [added, setAdded] = useState<Row[]>([]);
  // 복사해 온 줄에서 고친 시간과 할 일. 원래 근무는 건드리지 않고 여기에만 둡니다.
  const [changes, setChanges] = useState<Record<string, Change>>({});
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ employeeId: '', date: '', start: '09:00', end: '17:00', area: '' });
  const [error, setError] = useState('');
  // 지금 고치고 있는 줄 하나. todo 는 아직 목록에 넣지 않은 입력칸의 글입니다.
  const [editing, setEditing] = useState('');
  const [edit, setEdit] = useState<Change & { todo: string }>({ start: '', end: '', todos: [], todo: '' });
  const [editError, setEditError] = useState('');
  const seq = useRef(0);
  useBackClose(true, onClose);

  const to = addDays(from, 7);
  const targetDates = Array.from({ length: 7 }, (_, i) => addDays(to, i));
  const copied = copiesOf(from).map((r) => (changes[r.key] ? { ...r, ...changes[r.key], edited: true } : r));
  // 복사할 주를 바꾸면 미리보기를 새로 짭니다. 더해 둔 근무와 고친 내용은 날짜가 맞지 않으니 비웁니다.
  const pickWeek = (week: string) => {
    setFrom(week);
    setRemoved(clashes(week));
    setAdded([]);
    setChanges({});
    setAdding(false);
    setEditing('');
    setError('');
  };

  const rows = [...copied, ...added].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || name(a.employeeId).localeCompare(name(b.employeeId)),
  );
  const kept = rows.filter((r) => !removed.has(r.key));
  const hours = kept.reduce((sum, r) => sum + duration(r.start, r.end, r.breakMinutes ?? 0), 0);
  // 다른 줄과 겹치는지. 고치는 줄 자신은 빼고 봅니다.
  const crowded = (row: Row) =>
    taken(row) || kept.some((r) => r.key !== row.key && r.employeeId === row.employeeId && overlap(shiftOf(r), shiftOf(row)));

  const toggle = (key: string) =>
    setRemoved((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const drop = (r: Row) => {
    if (editing === r.key) setEditing('');
    if (r.added) setAdded((list) => list.filter((x) => x.key !== r.key));
    else toggle(r.key);
  };

  const startAdd = () => {
    const first = staff[0];
    setForm({ employeeId: first?.id ?? '', date: to, start: '09:00', end: '17:00', area: first?.role || areas[0] || '' });
    setError('');
    setAdding(true);
  };
  const add = () => {
    const who = person(form.employeeId);
    if (!who) return setError(t('직원을 선택하세요'));
    if (!tenMinutes(form.start) || !tenMinutes(form.end)) return setError(t('근무시간은 10분 단위로 입력하세요.'));
    if (!duration(form.start, form.end)) return setError(t('출근과 퇴근 시간이 같습니다.'));
    if (!canWorkIn(who, form.area)) return setError(t('Workshop 근무는 Workshop 업무를 맡은 직원에게만 넣을 수 있습니다.'));
    const row: Row = { key: 'add-' + seq.current++, ...form, todos: [], added: true };
    if (crowded(row)) return setError(t('해당 직원의 근무시간이 겹칩니다.'));
    setAdded((list) => [...list, row]);
    setAdding(false);
    setError('');
  };

  const openEdit = (r: Row) => {
    setEditing(r.key);
    setEdit({ start: r.start, end: r.end, todos: [...r.todos], todo: '' });
    setEditError('');
  };
  const pushTodos = (items: string[]) => {
    const list = [...edit.todos, ...items.map((x) => x.trim()).filter(Boolean)];
    if (list.length > MAX_SHIFT_TODOS) return setEditError(t('할 일은 {n}개까지 넣을 수 있습니다.', { n: MAX_SHIFT_TODOS }));
    setEdit({ ...edit, todos: list, todo: '' });
    setEditError('');
  };
  const onTodoKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    pushTodos([edit.todo]);
  };
  // 적용하면 그 줄을 되살립니다 — 고쳤다는 건 넣겠다는 뜻이고, 겹쳐서 빠졌던 줄도 시간을 고쳐 다시 넣을 수 있습니다.
  const applyEdit = (r: Row) => {
    // 입력칸에 적어 두고 추가를 누르지 않은 할 일도 함께 넣습니다.
    const todos = edit.todo.trim() ? [...edit.todos, edit.todo.trim()] : edit.todos;
    if (todos.length > MAX_SHIFT_TODOS) return setEditError(t('할 일은 {n}개까지 넣을 수 있습니다.', { n: MAX_SHIFT_TODOS }));
    if (!tenMinutes(edit.start) || !tenMinutes(edit.end)) return setEditError(t('근무시간은 10분 단위로 입력하세요.'));
    if (!duration(edit.start, edit.end)) return setEditError(t('출근과 퇴근 시간이 같습니다.'));
    if ((r.breakMinutes ?? 0) >= duration(edit.start, edit.end) * 60) return setEditError(t('휴게시간이 근무시간보다 깁니다.'));
    const next: Row = { ...r, start: edit.start, end: edit.end, todos };
    if (crowded(next)) return setEditError(t('해당 직원의 근무시간이 겹칩니다.'));
    const change = { start: next.start, end: next.end, todos };
    if (r.added) setAdded((list) => list.map((x) => (x.key === r.key ? { ...x, ...change } : x)));
    else setChanges((was) => ({ ...was, [r.key]: change }));
    setRemoved((was) => {
      const after = new Set(was);
      after.delete(r.key);
      return after;
    });
    setEditing('');
  };

  const save = () => {
    if (!kept.length || busy) return;
    const shifts = kept.map(({ employeeId, date, start, end, area, note, breakMinutes, todos }) => ({
      employeeId,
      date,
      start,
      end,
      area,
      note,
      breakMinutes,
      todos,
    }));
    void onCommand('shiftCopy', { shifts }).then((ok) => ok && onClose());
  };

  const label = (date: string) => `${days[new Date(date + 'T12:00:00Z').getUTCDay()]} ${date.slice(5).replace('-', '.')}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="shift-dialog copyweek">
        <DialogTitle>{t('다음 주로 복사')}</DialogTitle>
        <DialogDescription>
          {t('이 주의 근무를 다음 주 같은 요일로 옮겨 적습니다. 저장 전에 빼거나 더할 수 있고, 저장한 근무는 공개 전까지 Unpublished 로 남습니다.')}
        </DialogDescription>

        <div className="copyweek-body">
        <div className="copyweek-range">
          <button type="button" className="iconbutton" aria-label={t('이전 주')} onClick={() => pickWeek(addDays(from, -7))}>
            <ChevronLeft size={18} />
          </button>
          <span>
            <b>{label(from)} – {label(addDays(from, 6))}</b>
            <ChevronRight size={14} aria-hidden="true" />
            <b className="to">{label(to)} – {label(addDays(to, 6))}</b>
          </span>
          <button type="button" className="iconbutton" aria-label={t('다음 주')} onClick={() => pickWeek(addDays(from, 7))}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="copyweek-summary">
          <span>{t(kept.length === 1 ? 'copy::근무 1건' : 'copy::근무 {n}건', { n: kept.length })}</span>
          <span>{t('{h}시간', { h: Math.round(hours * 10) / 10 })}</span>
          {rows.length - kept.length > 0 && <span className="muted">{t('뺀 근무 {n}건', { n: rows.length - kept.length })}</span>}
        </div>

        {rows.length ? (
          <ul className="copyweek-list">
            {targetDates.map((date) => {
              const today = rows.filter((r) => r.date === date);
              if (!today.length) return null;
              return (
                <li key={date}>
                  <h4>{label(date)}</h4>
                  {today.map((r) => {
                    const off = removed.has(r.key);
                    const open = editing === r.key;
                    const clash = taken(r);
                    const block = blockedBy(data, shiftOf(r));
                    return (
                      <Fragment key={r.key}>
                        <div
                          className={
                            'copyweek-row' + (off ? ' is-off' : '') + (r.added ? ' added' : '') + (open ? ' is-open' : '')
                          }
                        >
                          <i style={{ background: person(r.employeeId)?.color }} />
                          <div>
                            <b>{name(r.employeeId)}</b>
                            <small>
                              {r.start}–{r.end} · {r.area}
                            </small>
                            <span className="copyweek-flags">
                              {clash ? (
                                <em className="warn">{t('이미 근무가 있어 뺐습니다')}</em>
                              ) : block && !off ? (
                                <em className="warn">
                                  <TriangleAlert size={12} />
                                  {block === 'timeoff' ? t('휴무와 겹칩니다') : t('근무 불가 시간과 겹칩니다')}
                                </em>
                              ) : r.added ? (
                                <em className="new">{t('새로 더함')}</em>
                              ) : null}
                              {r.edited && <em className="new">{t('copy::고침')}</em>}
                              {!!r.todos.length && (
                                <em className="todo">
                                  <ListChecks size={12} />
                                  {t(r.todos.length === 1 ? 'copy::할 일 1개' : 'copy::할 일 {n}개', { n: r.todos.length })}
                                </em>
                              )}
                            </span>
                          </div>
                          <span className="copyweek-tools">
                            <button
                              type="button"
                              className="iconbutton"
                              aria-label={t('시간·할 일 고치기')}
                              title={t('시간·할 일 고치기')}
                              aria-expanded={open}
                              onClick={() => (open ? setEditing('') : openEdit(r))}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="iconbutton"
                              disabled={off && clash}
                              aria-label={off ? t('되살리기') : t('빼기')}
                              title={off ? t('되살리기') : t('빼기')}
                              onClick={() => drop(r)}
                            >
                              {off ? <RotateCcw size={15} /> : <X size={15} />}
                            </button>
                          </span>
                        </div>
                        {open && (
                          <div className="copyweek-edit">
                            <label className="field">
                              <span>{t('출근')}</span>
                              <input type="time" step={600} value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />
                            </label>
                            <label className="field">
                              <span>{t('퇴근')}</span>
                              <input type="time" step={600} value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} />
                            </label>
                            {clash && <p className="hint wide">{t('바꾼 시간으로 겹치지 않으면 저장할 때 함께 넣습니다.')}</p>}
                            <div className="copyweek-todos wide">
                              <header>
                                <ListChecks size={15} aria-hidden="true" />
                                <b>{t('할 일')}</b>
                                <span>{edit.todos.length}/{MAX_SHIFT_TODOS}</span>
                              </header>
                              {edit.todos.length ? (
                                <ul>
                                  {edit.todos.map((item, i) => (
                                    <li key={i}>
                                      <span>{item}</span>
                                      <button
                                        type="button"
                                        className="todos-icon"
                                        aria-label={t('할 일 빼기')}
                                        title={t('할 일 빼기')}
                                        onClick={() => setEdit({ ...edit, todos: edit.todos.filter((_, j) => j !== i) })}
                                      >
                                        <X size={14} />
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="hint">{t('할 일이 없습니다')}</p>
                              )}
                              <div className="todos-add">
                                <input
                                  value={edit.todo}
                                  maxLength={160}
                                  placeholder={t('할 일 적기')}
                                  aria-label={t('할 일 적기')}
                                  onChange={(e) => setEdit({ ...edit, todo: e.target.value })}
                                  onKeyDown={onTodoKey}
                                />
                                <button type="button" className="button" disabled={!edit.todo.trim()} onClick={() => pushTodos([edit.todo])}>
                                  <Plus size={15} />
                                  {t('추가')}
                                </button>
                              </div>
                              {!!templates.length && (
                                <div className="todos-templates">
                                  <span>{t('템플릿 넣기')}</span>
                                  {templates.map((tpl) => (
                                    <span key={tpl.id} className="todos-chip">
                                      <button type="button" title={tpl.items.join('\n')} onClick={() => pushTodos(tpl.items)}>
                                        {tpl.name} <em>{tpl.items.length}</em>
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {editError && <p className="formerror wide">{editError}</p>}
                            <div className="copyweek-addbar wide">
                              <button type="button" className="button" onClick={() => setEditing('')}>
                                {t('취소')}
                              </button>
                              <button type="button" className="button primary" onClick={() => applyEdit(r)}>
                                {t('적용')}
                              </button>
                            </div>
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="hint">{t('이 주에는 복사할 근무가 없습니다. 아래에서 새로 더할 수 있습니다.')}</p>
        )}

        {adding ? (
          <div className="copyweek-add">
            <label className="field">
              <span>{t('직원')}</span>
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value, area: person(e.target.value)?.role || form.area })}
              >
                {staff.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('근무일')}</span>
              <select value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}>
                {targetDates.map((d) => (
                  <option key={d} value={d}>
                    {label(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('출근')}</span>
              <input type="time" step={600} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('퇴근')}</span>
              <input type="time" step={600} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </label>
            <label className="field wide">
              <span>{t('업무')}</span>
              <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="formerror wide">{error}</p>}
            <div className="copyweek-addbar wide">
              <button type="button" className="button" onClick={() => setAdding(false)}>
                {t('취소')}
              </button>
              <button type="button" className="button primary" onClick={add}>
                <Plus size={15} /> {t('목록에 더하기')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="button copyweek-more" onClick={startAdd} disabled={!staff.length}>
            <Plus size={15} /> {t('근무 더하기')}
          </button>
        )}

        </div>

        <div className="copyweek-foot">
          <button type="button" className="button" onClick={onClose}>
            {t('취소')}
          </button>
          <button type="button" className="button primary" disabled={busy || !kept.length} onClick={save}>
            <CopyPlus size={16} /> {t(kept.length === 1 ? '근무 1건 복사' : '근무 {n}건 복사', { n: kept.length })}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
