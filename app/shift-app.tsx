'use client';
import { useState, useEffect, useRef } from 'react';
import {
  CalendarDays,
  Clock3,
  ArrowLeftRight,
  Wallet,
  MessageSquare,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  CloudRain,
  Bell,
  MapPin,
  Upload,
  Download,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  seed,
  days,
  addDays,
  weekStart,
  localDate,
  duration,
  payroll,
  canSwap,
  type Employee,
  type State,
} from '@/lib/domain';
import {
  readWorkbook,
  mapRows,
  fields,
  downloadTemplate,
  download,
} from '@/lib/importer';
import InstallQr from './install-qr';
import MonthSchedule from './month-schedule';
function Pick({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="field">
      {label}
      <Select
        value={value}
        onValueChange={(v) => onChange(String(v))}
        items={options}
      >
        <SelectTrigger>
          <SelectValue placeholder="선택하세요" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
const nav = [
  { key: 'schedule', label: '근무 스케줄', Icon: CalendarDays },
  { key: 'attendance', label: '출근 기록', Icon: Clock3 },
  { key: 'payroll', label: '급여 관리', Icon: Wallet },
  { key: 'swaps', label: '대체 근무', Icon: ArrowLeftRight },
  { key: 'messages', label: '메시지', Icon: MessageSquare },
  { key: 'team', label: '직원 관리', Icon: Users },
];
export default function ShiftApp() {
  const [data, setData] = useState<State>(seed);
  const [week, setWeek] = useState(weekStart(localDate(new Date())));
  const [tab, setTab] = useState('schedule');
  const [view, setView] = useState('week');
  const [version, setVersion] = useState(0);
  const [team, setTeam] = useState('');
  const [actor, setActor] = useState({ id: 'admin', admin: true });
  const [setup, setSetup] = useState(true);
  const [auth, setAuth] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [filename, setFilename] = useState('');
  const [filter, setFilter] = useState('all');
  const [day, setDay] = useState(localDate(new Date()));
  const [from, setFrom] = useState(week);
  const [to, setTo] = useState(addDays(week, 6));
  const [tick, setTick] = useState(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const [push, setPush] = useState<{ on: boolean; tickUrl?: string }>({
    on: false,
  });
  const put = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const query = () =>
    typeof window === 'undefined' ? '' : window.location.search;
  const ingest = (r: any) => {
    if (r.state) {
      setData(r.state);
      setVersion(r.version);
      setSetup(false);
    } else setSetup(true);
    if (r.actor) setActor(r.actor);
    if (r.team) setTeam(r.team);
  };
  async function refresh() {
    try {
      const r = await fetch('/api/workspace' + query());
      const json = (await r.json()) as { error?: string };
      if (r.status === 401) {
        setAuth(false);
        return;
      }
      if (!r.ok) throw Error(json.error);
      setAuth(true);
      ingest(json);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '불러오지 못했습니다.');
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      setTick(Date.now());
      void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  async function command(type: string, payload: any = {}) {
    if (setup && type !== 'initialize') {
      setStatus(
        '먼저 워크스페이스를 생성하세요. 샘플 데이터는 저장되지 않습니다.',
      );
      return false;
    }
    setBusy(true);
    setStatus('');
    try {
      const r = await fetch('/api/workspace' + query(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload, version }),
      });
      const json = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(json.error);
      ingest(json);
      setModal('');
      setStatus('저장했습니다.');
      return true;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '저장하지 못했습니다.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const post = async (url: string, body: unknown) => {
    const r = await fetch(url + query(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await r.json()) as { sent?: number; error?: string };
    if (!r.ok) throw Error(json.error);
    return json;
  };
  useEffect(() => {
    if (setup) return;
    void (async () => {
      try {
        const r = await fetch('/api/push' + query());
        const json = (await r.json()) as { tickUrl?: string };
        const sub = await (
          await navigator.serviceWorker?.getRegistration()
        )?.pushManager.getSubscription();
        setPush({
          on:
            !!sub &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted',
          tickUrl: json.tickUrl,
        });
      } catch {}
    })();
  }, [setup]);
  async function enablePush() {
    setBusy(true);
    try {
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        typeof Notification === 'undefined'
      )
        throw Error(
          '이 브라우저에서는 푸시 알림을 켤 수 없습니다. iPhone은 Safari 공유 버튼 → 홈 화면에 추가한 뒤, 홈 화면 앱에서 켜세요.',
        );
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== 'granted')
        throw Error(
          '알림 권한이 허용되지 않았습니다. 브라우저 설정에서 이 사이트의 알림을 허용하세요.',
        );
      const r = await fetch('/api/push' + query());
      const json = (await r.json()) as { publicKey?: string; error?: string };
      if (!r.ok || !json.publicKey) throw Error(json.error);
      await (await reg.pushManager.getSubscription())?.unsubscribe();
      const key = atob(
        json.publicKey.replaceAll('-', '+').replaceAll('_', '/'),
      );
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(key, (c) => c.charCodeAt(0)),
      });
      await post('/api/push', {
        action: 'subscribe',
        subscription: sub.toJSON(),
      });
      setPush((p) => ({ ...p, on: true }));
      setStatus(
        '이 기기에서 푸시 알림을 켰습니다. 출근 1시간 전 알림과 우천 공지를 받습니다.',
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '알림을 켜지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function testPush() {
    setBusy(true);
    try {
      const r = await post('/api/push', { action: 'test' });
      setStatus(
        r.sent
          ? '테스트 알림을 보냈습니다. 잠시 후 이 기기에 표시됩니다.'
          : '알림을 받을 기기가 없습니다. 푸시 알림을 다시 켜세요.',
      );
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : '테스트 알림을 보내지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }
  const open = (kind: string, values: Record<string, string> = {}) => {
    setForm(values);
    setModal(kind);
    setStatus('');
  };
  const box = (e: Employee | undefined) =>
    e ? (
      <span className="person">
        <i style={{ background: e.color }} />
        {e.name}
      </span>
    ) : (
      <span>관리자</span>
    );
  const emp = (id: string) => data.employees.find((e) => e.id === id);
  const name = (id: string) => emp(id)?.name || '관리자';
  const options = data.employees.map((e) => ({
    value: e.id,
    label: e.name + ' · ' + e.id,
  }));
  const visibleEmployees = data.employees.filter(
    (e) => filter === 'all' || e.id === filter,
  );
  const timelineWeek = weekStart(day);
  const weekShifts = data.shifts.filter(
    (s) => s.date >= week && s.date <= addDays(week, 6),
  );
  const pending = data.swaps.filter((s) =>
    ['requested', 'accepted'].includes(s.status),
  );
  const money = (n: number) =>
    new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: data.currency,
    }).format(n);
  const totals = data.employees.map((e) => ({
    e,
    ...payroll(data, e.id, from, to),
  }));
  const input = (
    key: string,
    label: string,
    type = 'text',
    required = true,
  ) => (
    <label className="field">
      {label}
      <input
        type={type}
        required={required}
        value={form[key] || ''}
        onChange={(e) => put(key, e.target.value)}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? '0.01' : undefined}
      />
    </label>
  );
  const reminders = data.published
    ? data.shifts
        .filter(
          (s) =>
            s.employeeId === actor.id && s.date === localDate(new Date(tick)),
        )
        .filter((s) => {
          const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date(tick));
          const m = (t: string) =>
            Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
          return m(s.start) - m(parts) > 0 && m(s.start) - m(parts) <= 60;
        })
    : [];
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'show_staff_schedule',
            title: '직원 스케줄 보기',
            description:
              '선택한 직원의 주간 스케줄 화면으로 이동합니다. 저장된 데이터는 변경하지 않습니다.',
            inputSchema: {
              type: 'object',
              properties: { employeeId: { type: 'string' } },
              required: ['employeeId'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: (input: any) => {
              if (!data.employees.some((e) => e.id === input.employeeId))
                throw Error('직원 ID가 없습니다.');
              setFilter(input.employeeId);
              setTab('schedule');
              return { employeeId: input.employeeId, view: 'schedule' };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [data.employees]);
  async function loadFile(file: File) {
    setBusy(true);
    try {
      const r = await readWorkbook(file);
      setRows(r);
      setFilename(file.name);
      const m: Record<string, string> = {};
      fields.forEach(([key, label], i) => {
        const match = r[0].findIndex((h) => h === label || h === key);
        m[key] =
          match >= 0 ? String(match) : key === 'breakMinutes' ? '' : String(i);
      });
      setMapping(m);
      setStatus('열을 연결하고 검토한 다음 저장하세요.');
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportPayroll() {
    const safe = (s: string) =>
      '"' + (/^[=+@-]/.test(s) ? "'" : '') + s.replaceAll('"', '""') + '"';
    const csv = [
      [
        '직원 ID',
        '이름',
        '실근무시간',
        '시급',
        '기본급',
        '대체 추가수당',
        '예상 급여',
        '통화',
        '시작일',
        '종료일',
      ],
      ...totals.map((r) => [
        r.e.id,
        r.e.name,
        r.hours.toFixed(2),
        r.e.rate,
        r.base,
        r.bonus,
        r.total,
        data.currency,
        from,
        to,
      ]),
    ]
      .map((r) => r.map((v) => safe(String(v))).join(','))
      .join('\r\n');
    download(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
      '예상급여_' + from + '.csv',
    );
  }
  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brandmark">
            p<span>•</span>
          </span>
          pelham<span className="brandlight">shift</span>
        </a>
        <div className="location">
          <MapPin size={16} /> Pelham Hills <span> / </span> 팀 워크스페이스
        </div>
        <div className="account">
          <button
            aria-label="메시지 보기"
            className="iconbutton"
            onClick={() => setTab('messages')}
          >
            <Bell size={19} />
          </button>
          <span className="avatar">
            {actor.admin ? 'P' : name(actor.id).slice(0, 1)}
          </span>
          <span>{actor.admin ? '관리자' : name(actor.id)}</span>
        </div>
      </header>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <div className="navrow">
          <TabsList variant="line">
            {nav
              .filter((n) => actor.admin || n.key !== 'team')
              .map(({ key, label, Icon }) => (
                <TabsTrigger key={key} value={key}>
                  <Icon size={17} />
                  {label}
                </TabsTrigger>
              ))}
          </TabsList>
          <span className="tz">America / New York</span>
        </div>
        <main>
          <div className="pageheading">
            <div>
              <div className="eyebrow">TEAM OPERATIONS</div>
              <h1>
                {tab === 'schedule'
                  ? '좋은 한 주는, 좋은 스케줄부터.'
                  : nav.find((n) => n.key === tab)?.label}
              </h1>
              <p>
                {tab === 'schedule'
                  ? '팀의 근무를 한눈에 확인하고, 함께 계획하세요.'
                  : '스케줄부터 실제 근무시간까지, 같은 기록으로 연결합니다.'}
              </p>
            </div>
            <div className="headactions">
              <InstallQr team={setup ? '' : team} />
              {actor.admin && (
                <button
                  className="button rain"
                  onClick={() =>
                    open('rain', {
                      date: localDate(new Date()),
                      end: '15:00',
                      body: '안전하게 장비를 정리하고 퇴근 기록을 남겨주세요.',
                    })
                  }
                >
                  <CloudRain size={17} /> 우천 근무 종료
                </button>
              )}
            </div>
          </div>
          {setup && (
            <div className="demo-banner setup">
              <span>
                샘플 미리보기 · 실제 운영을 시작하면 샘플 일정은 비워집니다.
              </span>
              {auth ? (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => command('initialize')}
                >
                  내 워크스페이스 생성
                </button>
              ) : (
                <a
                  className="button"
                  href={
                    '/signin-with-chatgpt?return_to=' +
                    encodeURIComponent('/' + query())
                  }
                  target="_top"
                >
                  로그인하고 시작
                </a>
              )}
            </div>
          )}
          {status && (
            <div role="status" className="statusbar">
              {status}
              <button
                className="iconbutton"
                onClick={() => void refresh()}
                aria-label="다시 불러오기"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          )}
          {reminders.map((s) => (
            <div className="demo-banner" key={s.id}>
              <Bell size={16} /> 출근 알림 · 오늘 {s.start}, {s.area} 근무가
              1시간 이내에 시작됩니다.
            </div>
          ))}
          <TabsContent value="schedule">
            <section className="stats">
              <div>
                <span>이번 주 근무</span>
                <strong>
                  {weekShifts.length}
                  <small>개</small>
                </strong>
                <p>{data.employees.length}명의 직원과 함께하는 한 주</p>
              </div>
              <div>
                <span>예정 근무시간</span>
                <strong>
                  {weekShifts
                    .reduce((n, x) => n + duration(x.start, x.end), 0)
                    .toFixed(0)}
                  <small>시간</small>
                </strong>
                <p>등록된 스케줄 기준</p>
              </div>
              <div>
                <span>대체근무 요청</span>
                <strong>
                  {pending.length}
                  <small>건</small>
                </strong>
                <p className="green">
                  {pending.length
                    ? '확인이 필요한 요청이 있습니다'
                    : '모든 요청을 확인했습니다'}{' '}
                  <Check size={14} />
                </p>
              </div>
              <div className="reminder">
                <Bell size={23} />
                <span>출근 준비, 잊지 않도록</span>
                <b>근무 시작 1시간 전 알림</b>
                <p>
                  {push.on
                    ? '이 기기 푸시 알림 켜짐'
                    : '앱 접속 중 알림 · 이 기기 푸시 꺼짐'}
                </p>
                {!setup && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void (push.on ? testPush() : enablePush())}
                  >
                    {push.on ? '테스트 알림 보내기' : '푸시 알림 켜기'}
                  </button>
                )}
              </div>
            </section>
            <section className="schedule panel">
              <div className="toolbar">
                <div className="weekpicker">
                  <button
                    aria-label="이전 주"
                    onClick={() => setWeek(addDays(week, -7))}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <h2>
                    {week.slice(5).replace('-', '.')} –{' '}
                    {addDays(week, 6).slice(5).replace('-', '.')}{' '}
                    <span>{week.slice(0, 4)}</span>
                  </h2>
                  <button
                    aria-label="다음 주"
                    onClick={() => setWeek(addDays(week, 7))}
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    className="button"
                    onClick={() => setWeek(weekStart(localDate(new Date())))}
                  >
                    이번 주
                  </button>
                </div>
                <div className="actions">
                  <span className="draft">
                    ● {data.published ? '직원 공개 중' : '작성 중'}
                  </span>
                  {actor.admin && (
                    <>
                      <button
                        disabled={busy || setup}
                        className="button"
                        onClick={() => command('publish')}
                      >
                        직원에게 공개
                      </button>
                      <button
                        className="button primary"
                        onClick={() =>
                          open('shift', {
                            employeeId: data.employees[0]?.id || '',
                            date: week,
                            start: '09:00',
                            end: '17:00',
                            area: 'Outdoor',
                          })
                        }
                      >
                        <Plus size={16} /> 근무 추가
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="filterbar">
                <Pick
                  label="직원"
                  value={filter}
                  onChange={setFilter}
                  options={[{ value: 'all', label: '모든 직원' }, ...options]}
                />
                <Tabs value={view} onValueChange={(v) => setView(String(v))}>
                  <TabsList>
                    <TabsTrigger value="week">주간 보기</TabsTrigger>
                    <TabsTrigger value="timeline">타임라인</TabsTrigger>
                    <TabsTrigger value="month">월간 보기</TabsTrigger>
                  </TabsList>
                </Tabs>
                {(view === 'timeline' || view === 'month') && (
                  <>
                    <label className="field">
                      기준 날짜
                      <input
                        type="date"
                        value={day}
                        onChange={(e) => setDay(e.target.value)}
                      />
                    </label>
                    <button
                      className="button all-schedule"
                      onClick={() => {
                        setFilter('all');
                        setView('month');
                      }}
                    >
                      전체 일정 보기
                    </button>
                  </>
                )}
              </div>
              {view === 'week' ? (
                <div className="gridscroll">
                  <div className="weekgrid">
                    <div className="gridhead staffhead">
                      직원 <span>{visibleEmployees.length}명</span>
                    </div>
                    {days.map((d, i) => (
                      <div
                        className={
                          'gridhead ' +
                          (addDays(week, i) === localDate(new Date())
                            ? 'today'
                            : '')
                        }
                        key={d}
                      >
                        {d}
                        <strong>{Number(addDays(week, i).slice(8))}</strong>
                      </div>
                    ))}
                    {visibleEmployees.map((e) => (
                      <div className="gridrow" key={e.id}>
                        <div className="staff">
                          {box(e)}
                          <small>{e.role}</small>
                        </div>
                        {days.map((_, d) => {
                          const shifts = data.shifts.filter(
                            (s) =>
                              s.employeeId === e.id &&
                              s.date === addDays(week, d),
                          );
                          return (
                            <div className="daycell" key={d}>
                              {shifts.length ? (
                                shifts.map((s) => (
                                  <button
                                    key={s.id}
                                    className="shift"
                                    onClick={() => open('detail', { id: s.id })}
                                    style={{
                                      background: e.color + '13',
                                      borderLeftColor: e.color,
                                    }}
                                  >
                                    <b>
                                      {s.start} – {s.end}
                                    </b>
                                    <span>
                                      {s.originalId ? '대체 · ' : ''}
                                      {s.area}
                                    </span>
                                    <small>{duration(s.start, s.end)}h</small>
                                  </button>
                                ))
                              ) : (
                                <span className="off">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : view === 'month' ? (
                <MonthSchedule
                  date={day}
                  employees={visibleEmployees}
                  shifts={data.shifts.filter((shift) =>
                    visibleEmployees.some(
                      (employee) => employee.id === shift.employeeId,
                    ),
                  )}
                  onDateChange={setDay}
                  onShiftSelect={(id) => open('detail', { id })}
                />
              ) : (
                <div className="gridscroll timeline-scroll">
                  <div className="timeline">
                    <div className="timeruler">
                      <span>직원</span>
                      <div>
                        {Array.from({ length: 13 }, (_, i) => (
                          <span key={i}>
                            {String(i * 2).padStart(2, '0')}:00
                          </span>
                        ))}
                      </div>
                    </div>
                    {days.map((weekday, index) => {
                      const date = addDays(timelineWeek, index);
                      return (
                        <section className="timeline-day" key={date}>
                          <div className="timeline-day-label">
                            <span>{weekday}</span>
                            <strong>{date.slice(5).replace('-', '.')}</strong>
                          </div>
                          {visibleEmployees.map((e) => (
                            <div className="timerow" key={`${date}-${e.id}`}>
                              <div className="staff">{box(e)}</div>
                              <div className="track">
                                {data.shifts
                                  .filter(
                                    (s) =>
                                      s.employeeId === e.id &&
                                      s.date === date,
                                  )
                                  .map((s) => (
                                    <button
                                      key={s.id}
                                      onClick={() => open('detail', { id: s.id })}
                                      style={{
                                        left:
                                          ((Number(s.start.slice(0, 2)) +
                                            Number(s.start.slice(3)) / 60) /
                                            24) *
                                            100 +
                                          '%',
                                        width:
                                          (Math.min(
                                            duration(s.start, s.end),
                                            24 -
                                              Number(s.start.slice(0, 2)) -
                                              Number(s.start.slice(3)) / 60,
                                          ) /
                                            24) *
                                            100 +
                                          '%',
                                        background: e.color,
                                      }}
                                    >
                                      {s.start}–{s.end} · {s.area}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="schedulefoot">
                <span>
                  <i className="tiny-dot" /> 직원별 컬러는 모든 화면에서
                  동일하게 표시됩니다.
                </span>
                <span>대체 신청·승인 · 근무일 7일 전까지</span>
              </div>
            </section>
            <div className="below">
              <div>
                <Clock3 size={18} />
                <b>실제 출근기록으로 정확하게</b>
                <span>
                  출근기계 엑셀을 업로드하면 근무시간과 예상 급여를 계산합니다.
                </span>
              </div>
              <button
                className="linkbutton"
                onClick={() => setTab('attendance')}
              >
                출근기록 가져오기 →
              </button>
            </div>
          </TabsContent>
          <TabsContent value="attendance">
            <div className="panel contentpanel">
              <div className="sectionhead">
                <div>
                  <h2>출근기록 가져오기</h2>
                  <p>
                    직원 ID로 연결합니다. 중복·겹치는 기록은 저장하지 않습니다.
                  </p>
                </div>
                {actor.admin && (
                  <button
                    className="button"
                    onClick={() =>
                      downloadTemplate().catch((e) => setStatus(e.message))
                    }
                  >
                    <Download size={16} /> 엑셀 양식
                  </button>
                )}
              </div>
              {actor.admin && (
                <>
                  <input
                    hidden
                    type="file"
                    accept=".xlsx"
                    ref={fileRef}
                    onChange={(e) => {
                      if (e.target.files?.[0]) void loadFile(e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                  <button
                    disabled={busy}
                    className="uploadzone"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload size={28} />
                    <b>{filename || '출근기계에서 내보낸 엑셀을 선택하세요'}</b>
                    <span>.xlsx · 첫 번째 시트 · 최대 5MB / 3,000행</span>
                  </button>
                  {rows.length > 0 && (
                    <div className="importreview">
                      <h3>1. 엑셀 열 연결</h3>
                      <div className="formgrid">
                        {fields.map(([key, label]) => (
                          <Pick
                            key={key}
                            label={label}
                            value={mapping[key] ?? ''}
                            onChange={(v) =>
                              setMapping((m) => ({ ...m, [key]: v }))
                            }
                            options={[
                              {
                                value: '',
                                label:
                                  key === 'breakMinutes'
                                    ? '없음 · 0분'
                                    : '선택하세요',
                              },
                              ...rows[0].map((h, i) => ({
                                value: String(i),
                                label: h || `열 ${i + 1}`,
                              })),
                            ]}
                          />
                        ))}
                      </div>
                      <h3>2. 미리보기 · {rows.length - 1}개 기록</h3>
                      <div className="rawpreview">
                        {rows.slice(0, 6).map((r, i) => (
                          <div key={i}>{r.join('  |  ')}</div>
                        ))}
                      </div>
                      <button
                        className="button primary"
                        disabled={busy || setup}
                        onClick={async () => {
                          try {
                            if (
                              await command('attendance', {
                                rows: mapRows(rows, mapping),
                              })
                            ) {
                              setRows([]);
                              setFilename('');
                            }
                          } catch (e) {
                            setStatus((e as Error).message);
                          }
                        }}
                      >
                        검토한 출근기록 저장
                      </button>
                    </div>
                  )}
                </>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    {['직원', '근무일', '출근', '퇴근', '휴게', '실근무'].map(
                      (h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{box(emp(a.employeeId))}</TableCell>
                      <TableCell>{a.date}</TableCell>
                      <TableCell>{a.start}</TableCell>
                      <TableCell>
                        {a.end}
                        {a.end < a.start ? ' (+1일)' : ''}
                      </TableCell>
                      <TableCell>{a.breakMinutes}분</TableCell>
                      <TableCell>
                        {duration(a.start, a.end, a.breakMinutes).toFixed(2)}h
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!data.attendance.length && (
                <div className="empty">아직 저장된 출근기록이 없습니다.</div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="payroll">
            <div className="panel contentpanel">
              <div className="sectionhead">
                <div>
                  <h2>예상 급여</h2>
                  <p>실근무시간 × 직원별 시급 + 승인된 대체 추가수당</p>
                </div>
                <button className="button" onClick={exportPayroll}>
                  <Download size={16} /> CSV 다운로드
                </button>
              </div>
              <div className="filterbar">
                <label className="field">
                  시작일
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label className="field">
                  종료일
                  <input
                    type="date"
                    min={from}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
                <strong className="paytotal">
                  {money(totals.reduce((n, r) => n + r.total, 0))}
                </strong>
              </div>
              <div className="policy">
                세금·초과근무 가산·유급휴가를 제외한 예상 금액입니다. 시급 0인
                직원은 지급액 확인이 필요합니다. 원근무자의 예정 시간은 지급
                대상이 아니며 실제 출근기록만 지급합니다.
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      '직원',
                      '실근무',
                      '시급',
                      '기본급',
                      '대체 추가수당',
                      '예상 급여',
                    ].map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {totals
                    .filter((r) => actor.admin || r.e.id === actor.id)
                    .map((r) => (
                      <TableRow key={r.e.id}>
                        <TableCell>{box(r.e)}</TableCell>
                        <TableCell>{r.hours.toFixed(2)}h</TableCell>
                        <TableCell>
                          {r.e.rate ? money(r.e.rate) : '설정 필요'}
                        </TableCell>
                        <TableCell>{money(r.base)}</TableCell>
                        <TableCell className="green">
                          +{money(r.bonus)}
                        </TableCell>
                        <TableCell>
                          <b>{money(r.total)}</b>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="swaps">
            <div className="panel contentpanel">
              <div className="sectionhead">
                <div>
                  <h2>대체근무 요청</h2>
                  <p>신청 → 대체 직원 수락 → 관리자 승인</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => open('swap', { shiftId: '', to: '' })}
                >
                  <Plus size={16} /> 대체 신청
                </button>
              </div>
              <div className="policy">
                뉴욕 현지 날짜 기준, 근무일 7일 전까지 신청과 승인을 완료하세요.
                기존 근무와 겹치는 대체는 차단됩니다.
              </div>
              {data.swaps.map((r) => {
                const s = data.shifts.find((s) => s.id === r.shiftId);
                return (
                  <div className="requestrow" key={r.id}>
                    <div>
                      <div className="swapnames">
                        {box(emp(r.from))}
                        <ArrowLeftRight size={16} />
                        {box(emp(r.to))}
                      </div>
                      <p>
                        {s?.date} · {s?.start}–{s?.end} · {s?.area}
                      </p>
                    </div>
                    <span className="badge">
                      {
                        {
                          requested: '수락 대기',
                          accepted: '승인 대기',
                          approved: '승인 완료',
                          rejected: '거절/취소',
                        }[r.status]
                      }
                    </span>
                    {r.status === 'requested' && actor.id === r.to && (
                      <button
                        disabled={busy}
                        className="button primary"
                        onClick={() =>
                          command('swapDecision', {
                            id: r.id,
                            action: 'accept',
                          })
                        }
                      >
                        수락
                      </button>
                    )}
                    {r.status === 'accepted' && actor.admin && (
                      <button
                        className="button primary"
                        onClick={() =>
                          open('approve', { id: r.id, bonus: '0' })
                        }
                      >
                        수당 확인 및 승인
                      </button>
                    )}
                    {['requested', 'accepted'].includes(r.status) &&
                      (actor.admin ||
                        actor.id === r.from ||
                        actor.id === r.to) && (
                        <button
                          disabled={busy}
                          className="button"
                          onClick={() =>
                            command('swapDecision', {
                              id: r.id,
                              action: 'reject',
                            })
                          }
                        >
                          거절/취소
                        </button>
                      )}
                    {r.status === 'approved' && (
                      <span>추가수당 {money(r.bonus)}</span>
                    )}
                  </div>
                );
              })}
              {!data.swaps.length && (
                <div className="empty">
                  <ArrowLeftRight size={28} />
                  <h3>대체근무 요청이 없습니다.</h3>
                  <p>스케줄을 선택하고 대체 직원을 지정하세요.</p>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="messages">
            <div className="panel contentpanel">
              <div className="sectionhead">
                <div>
                  <h2>팀 메시지</h2>
                  <p>
                    앱 내 메시지 · 30초마다 갱신 · 우천 공지는 푸시 알림으로도
                    발송
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() =>
                    open('message', {
                      to: actor.admin ? 'all' : 'admin',
                      body: '',
                    })
                  }
                >
                  <Plus size={16} /> 메시지 작성
                </button>
              </div>
              {data.messages
                .slice()
                .reverse()
                .map((m) => (
                  <article
                    className={
                      'message ' + (m.kind === 'rain' ? 'weather' : '')
                    }
                    key={m.id}
                  >
                    <div className="messagehead">
                      {m.kind === 'rain' ? (
                        <CloudRain size={21} />
                      ) : (
                        box(emp(m.sender))
                      )}
                      <span>→ {m.to === 'all' ? '전 직원' : name(m.to)}</span>
                      <time>
                        {new Date(m.createdAt).toLocaleString('ko-KR', {
                          timeZone: 'America/New_York',
                        })}
                      </time>
                    </div>
                    <p>{m.body}</p>
                    <div className="messagefoot">
                      {actor.admin && m.to === 'all' ? (
                        <span>
                          확인 {m.readBy.filter((id) => id !== 'admin').length}{' '}
                          / {data.employees.length}명 ·{' '}
                          {data.employees
                            .filter((e) => !m.readBy.includes(e.id))
                            .map((e) => e.name)
                            .join(', ')}{' '}
                          미확인
                        </span>
                      ) : (
                        <span>
                          {m.readBy.includes(m.to)
                            ? '상대방 확인'
                            : '확인 대기'}
                        </span>
                      )}
                      {!m.readBy.includes(actor.id) && (
                        <button
                          disabled={busy}
                          className="button"
                          onClick={() => command('read', { id: m.id })}
                        >
                          <Check size={14} /> 확인했습니다
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              {!data.messages.length && (
                <div className="empty">
                  <MessageSquare size={28} />
                  <h3>팀의 대화를 시작하세요.</h3>
                  <p>우천 종료 공지도 이곳에 모입니다.</p>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="team">
            <div className="panel contentpanel">
              <div className="sectionhead">
                <div>
                  <h2>직원 관리</h2>
                  <p>이름 앞 컬러 상자 · 직원 ID · 시급 · 로그인 이메일</p>
                </div>
                <button
                  className="button primary"
                  onClick={() =>
                    open('employee', {
                      name: '',
                      email: '',
                      rate: '0',
                      color: '#087e6d',
                      role: 'Outdoor',
                    })
                  }
                >
                  <Plus size={16} /> 직원 추가
                </button>
              </div>
              <div className="filterbar">
                <Pick
                  label="급여 통화"
                  value={data.currency}
                  onChange={(v) => void command('currency', { currency: v })}
                  options={['USD', 'CAD', 'KRW', 'PHP'].map((v) => ({
                    value: v,
                    label: v,
                  }))}
                />
                {!setup && (
                  <div className="teamlink">
                    <b>직원 접속 주소</b>
                    <input
                      readOnly
                      value={
                        typeof window === 'undefined'
                          ? ''
                          : window.location.origin +
                            '/?team=' +
                            encodeURIComponent(team)
                      }
                      onFocus={(e) => e.target.select()}
                    />
                    <small>
                      아래에 등록한 이메일로 로그인해야 접근할 수 있습니다.
                      사이트 공유 권한은 별도 설정이 필요합니다.
                    </small>
                  </div>
                )}
                {push.tickUrl && (
                  <div className="teamlink">
                    <b>출근 알림 자동 점검 주소</b>
                    <input
                      readOnly
                      value={push.tickUrl}
                      onFocus={(e) => e.target.select()}
                    />
                    <small>
                      앱이 열려 있으면 30초마다 자동 점검합니다. 아무도 앱을
                      열지 않을 때도 1시간 전 알림을 보내려면 외부 cron(예:
                      cron-job.org)에 이 주소를 5분 간격으로 등록하세요. 비공개
                      사이트는 외부 호출이 차단될 수 있습니다. 이 주소는
                      비밀번호처럼 보관하세요.
                    </small>
                  </div>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {['직원', '직원 ID', '업무', '이메일', '시급', '설정'].map(
                      (h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{box(e)}</TableCell>
                      <TableCell>{e.id}</TableCell>
                      <TableCell>{e.role}</TableCell>
                      <TableCell>{e.email || '미등록'}</TableCell>
                      <TableCell>{money(e.rate)}</TableCell>
                      <TableCell>
                        <button
                          className="button"
                          onClick={() =>
                            open('employee', { ...e, rate: String(e.rate) })
                          }
                        >
                          수정
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </main>
      </Tabs>
      <footer>
        PELHAM SHIFT <span>팀의 시간, 더 간편하게.</span>
      </footer>
      <Dialog
        open={!!modal}
        onOpenChange={(o) => {
          if (!o) setModal('');
        }}
      >
        <DialogContent className="shift-dialog">
          <DialogTitle>
            {
              {
                rain: '우천 근무 종료 공지',
                shift: '근무 추가',
                employee: '직원 설정',
                swap: '대체근무 신청',
                approve: '대체근무 승인',
                message: '메시지 작성',
                detail: '근무 상세',
              }[modal]
            }
          </DialogTitle>
          <DialogDescription>
            {modal === 'rain'
              ? '전 직원에게 앱 내 공지를 저장하고, 푸시 알림을 켠 직원에게 바로 보냅니다. 실제 퇴근기록과 급여는 자동 변경하지 않습니다.'
              : modal === 'approve'
                ? '수락한 대체 직원에게 근무를 이전합니다. 추가수당은 실제 출근기록이 있을 때 반영합니다.'
                : '내용을 확인한 후 저장하세요.'}
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (modal === 'approve')
                void command('swapDecision', { ...form, action: 'approve' });
              else if (modal === 'detail') {
                setModal('swap');
                setForm({ shiftId: form.id, to: '' });
              } else void command(modal, form);
            }}
          >
            {modal === 'rain' && (
              <>
                {input('date', '종료 날짜', 'date')}
                {input('end', '종료 시각 (뉴욕)', 'time')}
                {input('body', '안내 내용')}
              </>
            )}
            {modal === 'shift' && (
              <>
                <Pick
                  label="직원"
                  value={form.employeeId || ''}
                  onChange={(v) => put('employeeId', v)}
                  options={options}
                />
                {input('date', '근무일', 'date')}
                <div className="formgrid">
                  {input('start', '출근', 'time')}
                  {input('end', '퇴근', 'time')}
                </div>
                <p className="hint">
                  퇴근이 출근보다 이르면 다음 날 퇴근으로 계산합니다.
                </p>
                {input('area', '업무 / 장소')}
              </>
            )}
            {modal === 'employee' && (
              <>
                {input('name', '이름')}
                {input('email', '로그인 이메일', 'email', false)}
                <div className="formgrid">
                  {input('color', '직원 색상', 'color')}
                  {input('rate', '시급 (' + data.currency + ')', 'number')}
                </div>
                {input('role', '업무')}
              </>
            )}
            {modal === 'swap' && (
              <>
                <Pick
                  label="대체할 근무"
                  value={form.shiftId || ''}
                  onChange={(v) => put('shiftId', v)}
                  options={[
                    { value: '', label: '근무 선택' },
                    ...data.shifts
                      .filter(
                        (s) =>
                          canSwap(s.date) &&
                          (actor.admin || s.employeeId === actor.id) &&
                          !s.originalId,
                      )
                      .map((s) => ({
                        value: s.id,
                        label: `${s.date} ${s.start} · ${name(s.employeeId)}`,
                      })),
                  ]}
                />
                <Pick
                  label="대체 직원"
                  value={form.to || ''}
                  onChange={(v) => put('to', v)}
                  options={[{ value: '', label: '직원 선택' }, ...options]}
                />
                <p className="hint">
                  근무일 7일 이내인 일정은 선택 목록에 표시되지 않습니다.
                </p>
              </>
            )}
            {modal === 'approve' &&
              input(
                'bonus',
                '대체 직원 추가수당 (' + data.currency + ')',
                'number',
              )}
            {modal === 'message' && (
              <>
                <Pick
                  label="받는 사람"
                  value={form.to || ''}
                  onChange={(v) => put('to', v)}
                  options={
                    actor.admin
                      ? [{ value: 'all', label: '전 직원' }, ...options]
                      : [
                          { value: 'admin', label: '관리자' },
                          ...options.filter((e) => e.value !== actor.id),
                        ]
                  }
                />
                <label className="field">
                  메시지
                  <textarea
                    required
                    maxLength={2000}
                    value={form.body || ''}
                    onChange={(e) => put('body', e.target.value)}
                  />
                </label>
              </>
            )}
            {modal === 'detail' &&
              (() => {
                const s = data.shifts.find((s) => s.id === form.id);
                return s ? (
                  <div className="shiftdetail">
                    {box(emp(s.employeeId))}
                    <h3>{s.date}</h3>
                    <strong>
                      {s.start} – {s.end}
                    </strong>
                    <p>
                      {s.area} · {duration(s.start, s.end)}시간
                    </p>
                    {s.originalId && (
                      <p>
                        원근무자 {name(s.originalId)} → 대체자{' '}
                        {name(s.employeeId)}
                      </p>
                    )}
                    <p className="hint">
                      {canSwap(s.date)
                        ? '대체근무를 신청할 수 있습니다.'
                        : '대체근무 신청 기한이 지났습니다.'}
                    </p>
                  </div>
                ) : null;
              })()}
            {status && (
              <p role="alert" className="formerror">
                {status}
              </p>
            )}
            <button
              className="button primary submit"
              disabled={
                busy ||
                (modal === 'detail' &&
                  (!canSwap(
                    data.shifts.find((s) => s.id === form.id)?.date || '',
                  ) ||
                    (!actor.admin &&
                      data.shifts.find((s) => s.id === form.id)?.employeeId !==
                        actor.id)))
              }
              type="submit"
            >
              {busy
                ? '저장 중…'
                : modal === 'detail'
                  ? '대체근무 신청'
                  : modal === 'rain'
                    ? '전 직원에게 공지 저장'
                    : '저장'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
