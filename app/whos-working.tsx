'use client';
import { LogIn, LogOut } from 'lucide-react';
import type { Employee, Punch, Shift } from '@/lib/domain';
import { TIME_ZONE } from '@/lib/domain';
import { useLang } from './use-lang';

const minutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
// 퇴근이 출근보다 이르면 자정을 넘긴 근무입니다.
const endOf = (s: Shift) => (minutes(s.end) > minutes(s.start) ? minutes(s.end) : minutes(s.end) + 1440);
// 7shifts 와 같은 표기: 정각이면 분을 떼고 5:30 AM–1:30 PM, 10 AM–6 PM 처럼 씁니다.
const stamp = (v: string) => {
  const h = Number(v.slice(0, 2));
  const m = v.slice(3, 5);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m === '00' ? '' : ':' + m} ${h < 12 ? 'AM' : 'PM'}`;
};
const ruler = (h: number) => {
  const hour = h % 24;
  return `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'A' : 'P'}`;
};
// 업무마다 색을 고정합니다. 같은 업무는 어느 날 어느 화면에서나 같은 색입니다.
const TONES = ['#e8908c', '#5c7a3f', '#d9534f', '#4a7fb5', '#c98a3c', '#7a5ca8', '#3f8f84', '#9c6b4f'];
const toneOf = (area: string) => {
  let sum = 0;
  for (const c of area) sum = (sum + c.charCodeAt(0)) % 9973;
  return TONES[sum % TONES.length];
};

export default function WhosWorking({
  date,
  now,
  employees,
  shifts,
  punches,
  canPunchOthers,
  busy,
  onShiftSelect,
  onPunch,
}: {
  date: string;
  now: number;
  employees: Employee[];
  shifts: Shift[];
  punches: Punch[];
  canPunchOthers: boolean;
  busy: boolean;
  onShiftSelect: (id: string) => void;
  onPunch: (employeeId: string, kind: 'punchIn' | 'punchOut') => void;
}) {
  const { t } = useLang();
  const emp = (id: string) => employees.find((e) => e.id === id);
  const today = shifts
    .filter((s) => s.date === date && emp(s.employeeId))
    .sort((a, b) => minutes(a.start) - minutes(b.start) || endOf(a) - endOf(b));
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(now));
  const stampToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
  const live = date === stampToday;
  const cursor = minutes(clock);
  const dayPunches = punches.filter((p) => p.date === date);
  const punchOf = (employeeId: string) =>
    [...dayPunches].reverse().find((p) => p.employeeId === employeeId);
  // 실제 펀치가 있으면 그것이 사실입니다. 없을 때만 예정 시각으로 갈립니다.
  const state = (s: Shift) => {
    const punch = punchOf(s.employeeId);
    if (punch && !punch.out) return 'on';
    if (punch?.out) return 'done';
    if (!live) return 'soon';
    return cursor < minutes(s.start) ? 'soon' : cursor < endOf(s) ? 'late' : 'missed';
  };
  const count = (kind: string) => today.filter((s) => state(s) === kind).length;
  const blocks: [string, string, number][] = [
    ['on', '근무 중', count('on')],
    ['late', '미기록', count('late') + count('missed')],
    ['soon', '예정', count('soon')],
    ['done', '퇴근', count('done')],
  ];
  const from = today.length ? Math.floor(Math.min(...today.map((s) => minutes(s.start))) / 60) : 5;
  const to = today.length ? Math.ceil(Math.max(...today.map(endOf)) / 60) + 1 : 21;
  const span = Math.max(to - from, 1) * 60;
  const at = (m: number) => ((m - from * 60) / span) * 100;
  const hours = Array.from({ length: to - from }, (_, i) => from + i);

  return (
    <section className="working">
      <div className="working-blocks">
        {blocks.map(([key, label, n]) => (
          <div className={'working-block ' + key} key={key}>
            <b>{n}</b>
            <span>{t(label)}</span>
          </div>
        ))}
      </div>
      {today.length === 0 ? (
        <div className="working-empty">{t('이 날 예정된 근무가 없습니다.')}</div>
      ) : (
        <div className="working-scroll">
          <div className="working-chart">
            <div className="working-ruler">
              <span />
              <div>
                {hours.map((h) => (
                  <i key={h} style={{ left: at(h * 60) + '%' }}>
                    {ruler(h)}
                  </i>
                ))}
              </div>
            </div>
            {today.map((s) => {
              const person = emp(s.employeeId)!;
              const punch = punchOf(s.employeeId);
              const mark = state(s);
              return (
                <div className="working-row" key={s.id}>
                  <span className="working-name">
                    <b>{person.name}</b>
                    <small>
                      {punch
                        ? punch.out
                          ? t('{a} 출근 · {b} 퇴근', { a: stamp(punch.in), b: stamp(punch.out) })
                          : t('{a} 출근', { a: stamp(punch.in) })
                        : t('기록 없음')}
                    </small>
                  </span>
                  <div className="working-track">
                    {hours.map((h) => (
                      <i key={h} className="working-line" style={{ left: at(h * 60) + '%' }} />
                    ))}
                    {live && cursor >= from * 60 && cursor <= to * 60 && (
                      <i className="working-now" style={{ left: at(cursor) + '%' }} />
                    )}
                    <button
                      className={'working-bar ' + mark}
                      style={{
                        left: at(minutes(s.start)) + '%',
                        width: ((endOf(s) - minutes(s.start)) / span) * 100 + '%',
                        background: toneOf(s.area),
                      }}
                      onClick={() => onShiftSelect(s.id)}
                      title={`${person.name} · ${s.area}`}
                    >
                      <i>{(s.area || '?').slice(0, 1).toUpperCase()}</i>
                      <b>
                        {stamp(s.start)}–{stamp(s.end)}
                      </b>
                    </button>
                  </div>
                  {canPunchOthers && live && (
                    <button
                      className={'working-punch' + (punch && !punch.out ? ' out' : '')}
                      disabled={busy || Boolean(punch?.out)}
                      onClick={() =>
                        onPunch(person.id, punch && !punch.out ? 'punchOut' : 'punchIn')
                      }
                    >
                      {punch && !punch.out ? <LogOut size={15} /> : <LogIn size={15} />}
                      {punch?.out ? t('완료') : punch ? t('punch::퇴근') : t('punch::출근')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
