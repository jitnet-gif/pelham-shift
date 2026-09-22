'use client';
import type { Employee, Shift } from '@/lib/domain';
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
  onShiftSelect,
}: {
  date: string;
  now: number;
  employees: Employee[];
  shifts: Shift[];
  onShiftSelect: (id: string) => void;
}) {
  const { t } = useLang();
  const emp = (id: string) => employees.find((e) => e.id === id);
  const today = shifts
    .filter((s) => s.date === date && emp(s.employeeId))
    .sort((a, b) => minutes(a.start) - minutes(b.start) || endOf(a) - endOf(b));
  // 뉴욕 기준 현재 시각. 오늘이 아닌 날을 보고 있으면 진행 중인 근무는 없습니다.
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(now));
  const stampToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
  const live = date === stampToday;
  const cursor = minutes(clock);
  const state = (s: Shift) =>
    !live ? 'plan' : cursor < minutes(s.start) ? 'soon' : cursor < endOf(s) ? 'on' : 'done';
  const count = (kind: string) => today.filter((s) => state(s) === kind).length;
  // 눈금은 그날 근무에 맞춰 잡습니다. 7shifts 처럼 첫 출근 한 시간 전부터 마지막 퇴근 한 시간 뒤까지.
  const from = today.length ? Math.floor(Math.min(...today.map((s) => minutes(s.start))) / 60) : 5;
  const to = today.length ? Math.ceil(Math.max(...today.map(endOf)) / 60) + 1 : 21;
  const span = Math.max(to - from, 1) * 60;
  const at = (m: number) => ((m - from * 60) / span) * 100;
  const hours = Array.from({ length: to - from }, (_, i) => from + i);

  return (
    <section className="working">
      <div className="working-blocks">
        {[
          ['on', '근무 중', count('on')],
          ['soon', '예정', count('soon')],
          ['done', '종료', count('done')],
          ['all', '오늘 근무', today.length],
        ].map(([key, label, n]) => (
          <div className={'working-block ' + key} key={key as string}>
            <b>{n as number}</b>
            <span>{t(label as string)}</span>
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
              return (
                <div className="working-row" key={s.id}>
                  <span className="working-name">{person.name}</span>
                  <div className="working-track">
                    {hours.map((h) => (
                      <i key={h} className="working-line" style={{ left: at(h * 60) + '%' }} />
                    ))}
                    {live && cursor >= from * 60 && cursor <= to * 60 && (
                      <i className="working-now" style={{ left: at(cursor) + '%' }} />
                    )}
                    <button
                      className={'working-bar ' + state(s)}
                      style={{
                        left: at(minutes(s.start)) + '%',
                        width: (endOf(s) - minutes(s.start)) / span * 100 + '%',
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
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
