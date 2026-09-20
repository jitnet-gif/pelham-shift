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
  Upload,
  Download,
  Check,
  RefreshCw,
  MapPin,
  ArrowRight,
  BellRing,
  ClipboardList,
  LogOut,
  Menu,
  Search,
  Send,
  TriangleAlert,
  UserRound,
  LayoutDashboard,
  GraduationCap,
  BriefcaseBusiness,
  BookOpen,
  CircleQuestionMark,
  Timer,
  CalendarX,
  CalendarClock,
  Network,
  ArrowUpDown,
  LayoutGrid,
  UserPlus,
  ChevronDown,
  X,
  CalendarRange,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
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
  addDays,
  weekStart,
  localDate,
  duration,
  payroll,
  lateBy,
  scheduledFor,
  wholeWeeks,
  OT_DAILY_HOURS,
  OT_WEEKLY_HOURS,
  OT_MULTIPLIER,
  canSwap,
  leadDate,
  blockedBy,
  weekdayOf,
  AREAS,
  type Employee,
  type Message,
  type State,
} from '@/lib/domain';
import {
  readAttendanceFile,
  mapRows,
  fields,
  downloadTemplate,
  download,
} from '@/lib/importer';
import { translate } from '@/lib/i18n';
import InstallQr from './install-qr';
import MonthSchedule from './month-schedule';
import BirthLogin from './birth-login';
import PasswordChange from './password-change';
import LangToggle from './lang-toggle';
import { useLang } from './use-lang';
import { LAYOUT_KEY, readLayout, type Layout } from './layout-choice';
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
  const { t } = useLang();
  return (
    <label className="field">
      {label}
      <Select
        value={value}
        onValueChange={(v) => onChange(String(v))}
        items={options}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('선택하세요')} />
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
  { key: 'timeoff', label: '휴무', Icon: CalendarX },
  { key: 'availability', label: '근무 가능 시간', Icon: CalendarClock },
  { key: 'attendance', label: '출근 기록', Icon: Clock3 },
  { key: 'payroll', label: '급여 관리', Icon: Wallet },
  { key: 'swaps', label: '대체 근무', Icon: ArrowLeftRight },
  { key: 'messages', label: '메시지', Icon: MessageSquare },
  { key: 'team', label: '직원 관리', Icon: Users },
];
const employeeNav = new Set([
  'schedule',
  'attendance',
  'payroll',
  'messages',
  'timeoff',
  'availability',
  'help',
]);
export default function ShiftApp() {
  const { t, lang, days, locale } = useLang();
  const [data, setData] = useState<State>(seed);
  const [week, setWeek] = useState(weekStart(localDate(new Date())));
  const [tab, setTab] = useState('schedule');
  const [view, setView] = useState('week');
  const [version, setVersion] = useState(0);
  const [team, setTeam] = useState('');
  const [actor, setActor] = useState({ id: 'admin', admin: true });
  const [setup, setSetup] = useState(true);
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>('loading');
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
  const [dept, setDept] = useState('all');
  const [sort, setSort] = useState('name');
  const [search, setSearch] = useState('');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [ui, setUi] = useState<Layout>('pelham');
  const [offFilter, setOffFilter] = useState('pending');
  const [inapp, setInapp] = useState<Message | null>(null);
  const seenMessages = useRef<Set<string>>(new Set());
  const chooseLayout = (next: Layout) => {
    setUi(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {}
  };
  const logout = async () => {
    await fetch('/api/birth-login', { method: 'DELETE' }).catch(() => 0);
    window.location.assign('/' + query());
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const [push, setPush] = useState<{ on: boolean; tickUrl?: string }>({
    on: false,
  });
  const [birthAuth, setBirthAuth] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(true);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const passwordOfferShown = useRef(false);
  const staffReadOnly = !actor.admin;
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
    setBirthAuth(r.authMethod === 'birth');
    if (r.authMethod === 'birth' && r.passwordChanged === false) {
      setPasswordChanged(false);
      if (!passwordOfferShown.current) {
        passwordOfferShown.current = true;
        setPasswordDialog(true);
      }
    } else if (r.authMethod === 'birth') setPasswordChanged(true);
  };
  async function refresh() {
    try {
      const r = await fetch('/api/workspace' + query());
      const json = (await r.json()) as { error?: string };
      if (r.status === 401) {
        setAuth('out');
        return;
      }
      if (!r.ok) throw Error(json.error);
      setAuth('in');
      ingest(json);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '불러오지 못했습니다.');
      setAuth((a) => (a === 'loading' ? 'out' : a));
    }
  }
  useEffect(() => {
    setUi(readLayout());
    void refresh();
    const timer = setInterval(() => {
      setTick(Date.now());
      void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!actor.admin) {
      setFilter('all');
      setView('month');
      if (!employeeNav.has(tab)) setTab('schedule');
    }
  }, [actor.admin, tab]);
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
  // Push text is chosen per device on the server, so re-register this device whenever its language changes.
  useEffect(() => {
    if (!push.on) return;
    void (async () => {
      try {
        const sub = await (
          await navigator.serviceWorker?.getRegistration()
        )?.pushManager.getSubscription();
        if (sub)
          await post('/api/push', {
            action: 'subscribe',
            subscription: sub.toJSON(),
            lang,
          });
      } catch {}
    })();
  }, [lang, push.on]);
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
        lang,
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
      <span>{t('관리자')}</span>
    );
  const emp = (id: string) => data.employees.find((e) => e.id === id);
  const name = (id: string) => emp(id)?.name || t('관리자');
  const options = data.employees.map((e) => ({
    value: e.id,
    label: e.name + ' · ' + e.id,
  }));
  const roles = [...new Set(data.employees.map((e) => e.role))].sort((a, b) =>
    a.localeCompare(b),
  );
  const visibleEmployees = data.employees
    .filter(
      (e) =>
        (filter === 'all' || e.id === filter) &&
        (dept === 'all' || e.role === dept) &&
        e.name.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      ui === 'pelham'
        ? 0
        : sort === 'id'
          ? a.id.localeCompare(b.id)
          : a.name.localeCompare(b.name, locale),
    );
  const longDate = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(date + 'T12:00:00Z'));
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const rosterShifts = data.shifts.filter(
    (s) =>
      s.date >= week &&
      s.date <= addDays(week, 6) &&
      visibleEmployees.some((e) => e.id === s.employeeId),
  );
  // Scheduled cost is an estimate from planned hours; payroll itself pays actual attendance.
  const rosterCost = (list: typeof data.shifts) =>
    list.reduce((n, s) => n + duration(s.start, s.end) * (emp(s.employeeId)?.rate || 0), 0);
  const timelineDate = addDays(
    localDate(new Date()),
    view === 'tomorrow' ? 1 : 0,
  );
  const weekShifts = data.shifts.filter(
    (s) => s.date >= week && s.date <= addDays(week, 6),
  );
  const pending = data.swaps.filter((s) =>
    ['requested', 'accepted'].includes(s.status),
  );
  const timeOff = data.timeOff ?? [];
  const availability = data.availability ?? [];
  const pendingOff = timeOff.filter((r) => r.status === 'pending');
  const pendingAvail = availability.filter((r) => r.status === 'pending');
  // 내가 받은 메시지 중 아직 읽지 않은 것. 종 아이콘의 숫자와 앱 안 알림이 이 목록을 씁니다.
  const unread = data.messages.filter(
    (m) => m.sender !== actor.id && !m.readBy.includes(actor.id),
  );
  const unreadKey = unread.map((m) => m.id).join(',');
  const conflicts = data.shifts.filter((s) => s.date >= localDate(new Date()) && blockedBy(data, s));
  const warnings = [
    ...pending.map(() => ({ text: t('확인이 필요한 대체근무 요청'), tab: 'swaps' })),
    ...pendingOff.map(() => ({ text: t('확인이 필요한 휴무 요청'), tab: 'timeoff' })),
    ...pendingAvail.map(() => ({ text: t('확인이 필요한 근무 불가 시간'), tab: 'availability' })),
    ...conflicts.map((c) => ({
      text: t('{name} {date} 근무가 휴무·불가 시간과 겹칩니다', { name: name(c.employeeId), date: c.date }),
      tab: 'schedule',
    })),
    ...data.employees
      .filter((e) => !e.rate)
      .map((e) => ({ text: t('{name} 시급 미설정', { name: e.name }), tab: 'team' })),
  ];
  // 앱을 열어 둔 동안 새 메시지가 오면 화면 안에 알림을 띄웁니다. 기기 푸시가 꺼져 있어도 보입니다.
  useEffect(() => {
    const fresh = unread.filter((m) => !seenMessages.current.has(m.id));
    if (!fresh.length) return;
    for (const m of fresh) seenMessages.current.add(m.id);
    setInapp(fresh[fresh.length - 1]);
  }, [unreadKey]);
  // 설치한 앱 아이콘(배지), 브라우저 탭 제목과 파비콘에도 안 읽은 개수를 올립니다.
  useEffect(() => {
    const count = unread.length;
    // Next 가 기본 제목을 다시 써 넣는 경우가 있어, 제목이 바뀌면 개수를 다시 붙입니다.
    const wanted = (count ? '(' + count + ') ' : '') + 'Pelham Shift · 근무 관리';
    const keepTitle = () => {
      if (document.title !== wanted) document.title = wanted;
    };
    keepTitle();
    const titleTag = document.querySelector('title');
    const watcher = new MutationObserver(keepTitle);
    if (titleTag) watcher.observe(titleTag, { childList: true, characterData: true, subtree: true });
    const badge = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    // 홈 화면·작업 표시줄에 설치했을 때만 동작하고, 지원하지 않는 브라우저에서는 조용히 넘어갑니다.
    if (count) void badge.setAppBadge?.(count).catch(() => 0);
    else void badge.clearAppBadge?.().catch(() => 0);
    const paint = (href: string) => {
      let link = document.querySelector<HTMLLinkElement>('link[data-unread-icon]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        link.setAttribute('data-unread-icon', '');
        document.head.appendChild(link);
      }
      link.href = href;
    };
    if (!count) {
      paint('/icons/icon-192.png');
      return () => watcher.disconnect();
    }
    let live = true;
    const icon = new Image();
    icon.src = '/icons/icon-192.png';
    icon.onload = () => {
      if (!live) return;
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(icon, 0, 0, size, size);
      const radius = 21;
      ctx.beginPath();
      ctx.arc(size - radius, radius, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#c0503a';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count > 9 ? '9+' : String(count), size - radius, radius + 1);
      paint(canvas.toDataURL('image/png'));
    };
    return () => {
      live = false;
      watcher.disconnect();
    };
  }, [unread.length]);
  const money = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: data.currency,
      currencyDisplay: 'narrowSymbol',
    }).format(n);
  // 7shifts-style clock times: 14:00 → 2pm, 08:30 → 8:30am.
  const ampm = (v: string) => {
    const h = Number(v.slice(0, 2));
    const m = v.slice(3, 5);
    return (h % 12 || 12) + (m === '00' ? '' : ':' + m) + (h < 12 ? 'am' : 'pm');
  };
  const span = (r: { allDay: boolean; start?: string; end?: string }) =>
    r.allDay || !r.start || !r.end ? t('종일') : ampm(r.start) + ' - ' + ampm(r.end);
  const monthDay = (date: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(date + 'T12:00:00Z'),
    );
  const statusLabel = (v: string) =>
    t(({ pending: '대기 중', approved: '승인됨', declined: '거절됨' } as Record<string, string>)[v] || v);
  const totals = data.employees.map((e) => ({
    e,
    ...payroll(data, e.id, from, to),
  }));
  const visibleTotals = totals.filter(
    (row) => actor.admin || row.e.id === actor.id,
  );
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
        step={type === 'number' ? '0.01' : type === 'time' ? 1800 : undefined}
      />
    </label>
  );
  const rainTargets = (form.targets || '').split(',').filter(Boolean);
  const rainAll =
    data.employees.length > 0 &&
    data.employees.every((e) => rainTargets.includes(e.id));
  const toggleRain = (id: string, on: boolean) =>
    put(
      'targets',
      data.employees
        .map((e) => e.id)
        .filter((v) => (v === id ? on : rainTargets.includes(v)))
        .join(','),
    );
  // Shifts with a swap in progress can't be edited, so bulk edit lists them without letting them be picked.
  const swapLocked = new Set(
    data.swaps
      .filter((r) => ['requested', 'accepted'].includes(r.status))
      .map((r) => r.shiftId),
  );
  const bulkMatches = (f: Record<string, string>) =>
    data.shifts
      .filter(
        (s) =>
          (f.employee === 'all' || s.employeeId === f.employee) &&
          s.date >= (f.from || '') &&
          s.date <= (f.to || ''),
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.start.localeCompare(b.start) ||
          name(a.employeeId).localeCompare(name(b.employeeId)),
      );
  const bulkSelectable = (f: Record<string, string>) =>
    bulkMatches(f)
      .filter((s) => !swapLocked.has(s.id))
      .map((s) => s.id);
  const isBulk = modal === 'shiftUpdate' && form.bulk === '1';
  const bulkShifts = isBulk ? bulkMatches(form) : [];
  const bulkOptions = isBulk ? bulkSelectable(form) : [];
  // Selection is kept as ids and re-checked against current shifts, since a background refresh can remove some.
  const bulkIds = (form.ids || '')
    .split(',')
    .filter((id) => bulkOptions.includes(id));
  const bulkAll =
    bulkOptions.length > 0 && bulkOptions.every((id) => bulkIds.includes(id));
  const putBulkFilter = (key: string, value: string) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      return { ...next, ids: bulkSelectable(next).join(',') };
    });
  const toggleBulk = (id: string, on: boolean) =>
    put(
      'ids',
      bulkOptions
        .filter((v) => (v === id ? on : bulkIds.includes(v)))
        .join(','),
    );
  const openBulk = () => {
    const values = {
      bulk: '1',
      employee: filter,
      from: week,
      to: addDays(week, 6),
      start: '',
      end: '',
      area: '',
    };
    open('shiftUpdate', { ...values, ids: bulkSelectable(values).join(',') });
  };
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
      const r = await readAttendanceFile(file);
      setRows(r);
      setFilename(file.name);
      const m: Record<string, string> = {};
      // Accept headers from either language's template.
      fields.forEach(([key, label], i) => {
        const match = r[0].findIndex(
          (h) => h === label || h === key || h === translate('en', label),
        );
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
        '정규시간',
        '초과시간',
        '시급',
        '기본급',
        '초과수당',
        '지각(분)',
        '지각일수',
        '지각 차감',
        '대체 추가수당',
        '예상 급여',
        '통화',
        '시작일',
        '종료일',
      ].map((h) => t(h)),
      ...totals.map((r) => [
        r.e.id,
        r.e.name,
        r.hours.toFixed(2),
        r.regularHours.toFixed(2),
        r.otHours.toFixed(2),
        r.e.rate,
        r.base,
        r.otPay,
        r.lateMinutes,
        r.lateDays,
        // 화면과 같은 부호로 내보내 시트에서 열을 합산해도 결과가 맞습니다.
        -r.lateDeduction || 0,
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
      t('예상급여_') + from + '.csv',
    );
  }
  if (auth !== 'in')
    return (
      <div className="login-screen">
        <LangToggle />
        <span className="brand">
          <span className="brandmark" aria-hidden="true" />
          pelham<span className="brandlight">shift</span>
        </span>
        {auth === 'loading' ? (
          <p className="login-loading">{t('불러오는 중…')}</p>
        ) : (
          <>
            {status && (
              <div role="status" className="statusbar">
                {t(status)}
              </div>
            )}
            <div className="layout-pick" role="radiogroup" aria-label={t('화면 버전')}>
              {(
                [
                  ['pelham', '1', 'pelham-shifts', t('기본 화면 · 위쪽 탭 메뉴')],
                  ['seven', '2', 'seven-shifts', t('7shifts 스타일 · 왼쪽 메뉴')],
                ] as const
              ).map(([value, num, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={ui === value}
                  className={'layout-option' + (ui === value ? ' on' : '')}
                  onClick={() => chooseLayout(value)}
                >
                  <em>{num}</em>
                  <span>
                    <b>{label}</b>
                    <small>{hint}</small>
                  </span>
                </button>
              ))}
            </div>
            <BirthLogin />
          </>
        )}
      </div>
    );
  const offShifts = (r: (typeof timeOff)[number]) =>
    data.shifts.filter(
      (s) =>
        s.employeeId === r.employeeId &&
        blockedBy({ ...data, timeOff: [{ ...r, status: 'approved' }], availability: [] }, s),
    );
  const staffList = actor.admin ? data.employees : data.employees.filter((e) => e.id === actor.id);
  const openTimeOff = () =>
    open('timeOffRequest', {
      employeeId: actor.admin ? data.employees[0]?.id || '' : actor.id,
      from: leadDate(),
      to: leadDate(),
      allDay: '1',
      start: '09:00',
      end: '13:00',
      reason: '',
    });
  const openAvailability = (weekday = '1', employeeId = '') =>
    open('availabilitySet', {
      employeeId: employeeId || (actor.admin ? data.employees[0]?.id || '' : actor.id),
      weekday,
      allDay: '1',
      start: '09:00',
      end: '13:00',
      note: '',
    });
  const otherTabs = (
    <>
            <TabsContent value="timeoff">
              <div className="panel contentpanel">
                <div className="sectionhead">
                  <div>
                    <h2>{t('휴무')}</h2>
                    <p>
                      {actor.admin
                        ? t('직원 휴무 신청을 확인하고 승인하세요. 승인된 휴무와 겹치는 근무는 스케줄에 경고로 표시됩니다.')
                        : t('휴무는 시작일 7일 전까지 신청할 수 있고, 관리자가 승인합니다. 대기 중인 신청은 직접 취소할 수 있습니다.')}
                    </p>
                  </div>
                  <button className="button primary" disabled={setup} onClick={openTimeOff}>
                    <Plus size={16} /> {actor.admin ? t('휴무 추가') : t('휴무 신청')}
                  </button>
                </div>
                <div className="segmented" role="tablist" aria-label={t('상태')}>
                  {(['pending', 'approved', 'declined', 'all'] as const).map((k) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={offFilter === k}
                      className={offFilter === k ? 'on' : ''}
                      onClick={() => setOffFilter(k)}
                    >
                      {k === 'all' ? t('전체') : statusLabel(k)}
                      <em>
                        {k === 'all' ? timeOff.length : timeOff.filter((r) => r.status === k).length}
                      </em>
                    </button>
                  ))}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['직원', '기간', '시간', '사유', '겹치는 근무', '상태', ''].map((h) => (
                        <TableHead key={h}>{t(h)}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeOff
                      .filter((r) => offFilter === 'all' || r.status === offFilter)
                      .slice()
                      .sort((a, b) => a.from.localeCompare(b.from))
                      .map((r) => {
                        const clash = offShifts(r);
                        return (
                          <TableRow key={r.id}>
                            <TableCell>{box(emp(r.employeeId))}</TableCell>
                            <TableCell>
                              {r.from === r.to ? longDate(r.from) : longDate(r.from) + ' – ' + longDate(r.to)}
                            </TableCell>
                            <TableCell>{span(r)}</TableCell>
                            <TableCell className="cell-wrap">{r.reason || '—'}</TableCell>
                            <TableCell>
                              {clash.length ? (
                                <span className="clash">
                                  <TriangleAlert size={14} /> {t('{n}개', { n: clash.length })}
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={'statuspill ' + r.status}>{statusLabel(r.status)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="rowactions">
                                {actor.admin && r.status === 'pending' && (
                                  <>
                                    <button
                                      className="button primary"
                                      disabled={busy}
                                      onClick={() =>
                                        command('timeOffDecision', { id: r.id, action: 'approve' })
                                      }
                                    >
                                      {t('승인')}
                                    </button>
                                    <button
                                      className="button"
                                      disabled={busy}
                                      onClick={() =>
                                        command('timeOffDecision', { id: r.id, action: 'decline' })
                                      }
                                    >
                                      {t('거절')}
                                    </button>
                                  </>
                                )}
                                {(actor.admin || r.status === 'pending') && (
                                  <button
                                    className="button"
                                    disabled={busy}
                                    onClick={() =>
                                      command('timeOffDecision', { id: r.id, action: 'cancel' })
                                    }
                                  >
                                    {actor.admin ? t('삭제') : t('취소')}
                                  </button>
                                )}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
                {!timeOff.filter((r) => offFilter === 'all' || r.status === offFilter).length && (
                  <div className="empty">
                    <CalendarX size={28} />
                    <h3>{t('표시할 휴무가 없습니다.')}</h3>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="availability">
              <div className="panel contentpanel">
                <div className="sectionhead">
                  <div>
                    <h2>{t('근무 가능 시간')}</h2>
                    <p>
                      {actor.admin
                        ? t('매주 반복되는 근무 불가 시간입니다. 승인된 불가 시간과 겹치는 근무는 스케줄에 경고로 표시됩니다.')
                        : t('매주 일할 수 없는 요일·시간을 등록하면 관리자가 승인합니다. 등록일로부터 7일 뒤 근무부터 적용됩니다.')}
                    </p>
                  </div>
                  <button className="button primary" disabled={setup} onClick={() => openAvailability()}>
                    <Plus size={16} /> {t('근무 불가 시간 추가')}
                  </button>
                </div>
                <div className="gridscroll">
                  <div className="availgrid">
                    <div className="availhead">{t('직원')}</div>
                    {days.map((d) => (
                      <div className="availhead" key={d}>
                        {d}
                      </div>
                    ))}
                    {staffList.map((e) => (
                      <div className="availrow" key={e.id}>
                        <div className="availstaff">{box(e)}</div>
                        {days.map((_, w) => {
                          const list = availability.filter(
                            (r) => r.employeeId === e.id && r.weekday === w && r.status !== 'declined',
                          );
                          return (
                            <div className="availcell" key={w}>
                              {list.length ? (
                                list.map((r) => (
                                  <span key={r.id} className={'availtag ' + r.status}>
                                    {r.status === 'pending' ? t('대기') + ' · ' : ''}
                                    {r.allDay ? t('종일 불가') : span(r) + ' ' + t('불가')}
                                  </span>
                                ))
                              ) : (
                                <button
                                  className="availfree"
                                  disabled={setup}
                                  onClick={() => openAvailability(String(w), e.id)}
                                  aria-label={t('{name} {day} 근무 불가 시간 추가', {
                                    name: e.name,
                                    day: days[w],
                                  })}
                                >
                                  {t('가능')}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <h3 className="subhead">{t('등록된 근무 불가 시간')}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['직원', '요일', '시간', '적용 시작일', '메모', '상태', ''].map((h) => (
                        <TableHead key={h}>{t(h)}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availability
                      .slice()
                      .sort(
                        (a, b) =>
                          Number(b.status === 'pending') - Number(a.status === 'pending') ||
                          name(a.employeeId).localeCompare(name(b.employeeId)) ||
                          a.weekday - b.weekday,
                      )
                      .map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{box(emp(r.employeeId))}</TableCell>
                          <TableCell>{days[r.weekday]}</TableCell>
                          <TableCell>{span(r)}</TableCell>
                          <TableCell>{r.effectiveFrom ? longDate(r.effectiveFrom) : '—'}</TableCell>
                          <TableCell className="cell-wrap">{r.note || '—'}</TableCell>
                          <TableCell>
                            <span className={'statuspill ' + r.status}>{statusLabel(r.status)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="rowactions">
                              {actor.admin && r.status === 'pending' && (
                                <>
                                  <button
                                    className="button primary"
                                    disabled={busy}
                                    onClick={() =>
                                      command('availabilityDecision', { id: r.id, action: 'approve' })
                                    }
                                  >
                                    {t('승인')}
                                  </button>
                                  <button
                                    className="button"
                                    disabled={busy}
                                    onClick={() =>
                                      command('availabilityDecision', { id: r.id, action: 'decline' })
                                    }
                                  >
                                    {t('거절')}
                                  </button>
                                </>
                              )}
                              <button
                                className="button"
                                disabled={busy}
                                onClick={() =>
                                  command('availabilityDecision', { id: r.id, action: 'delete' })
                                }
                              >
                                {t('삭제')}
                              </button>
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {!availability.length && (
                  <div className="empty">
                    <CalendarClock size={28} />
                    <h3>{t('등록된 근무 불가 시간이 없습니다.')}</h3>
                    <p>{t('모든 요일에 근무할 수 있는 것으로 표시됩니다.')}</p>
                  </div>
                )}
              </div>
            </TabsContent>
          <TabsContent value="attendance">
            <div className="panel contentpanel">
              <div className="sectionhead">
                <div>
                  <h2>{actor.admin ? t('출근기록 가져오기') : t('내 출근 기록')}</h2>
                  <p>
                    {actor.admin
                      ? t('직원 ID로 연결합니다. 중복·겹치는 기록은 저장하지 않습니다.')
                      : t('출근기계 기록을 읽기 전용으로 확인합니다.')}
                  </p>
                </div>
                {actor.admin && (
                  <button
                    className="button"
                    onClick={() =>
                      downloadTemplate(t).catch((e) => setStatus(e.message))
                    }
                  >
                    <Download size={16} /> {t('엑셀 양식')}
                  </button>
                )}
              </div>
              {actor.admin && (
                <>
                  <input
                    hidden
                    type="file"
                    accept=".xlsx,.csv"
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
                    <b>{filename || t('출근기계에서 내보낸 엑셀·CSV 파일을 선택하세요')}</b>
                    <span>{t('.xlsx · .csv · 최대 5MB / 3,000행')}</span>
                  </button>
                  {rows.length > 0 && (
                    <div className="importreview">
                      <h3>{t('1. 열 연결')}</h3>
                      <div className="formgrid">
                        {fields.map(([key, label]) => (
                          <Pick
                            key={key}
                            label={t(label)}
                            value={mapping[key] ?? ''}
                            onChange={(v) =>
                              setMapping((m) => ({ ...m, [key]: v }))
                            }
                            options={[
                              {
                                value: '',
                                label:
                                  key === 'breakMinutes'
                                    ? t('없음 · 0분')
                                    : t('선택하세요'),
                              },
                              ...rows[0].map((h, i) => ({
                                value: String(i),
                                label: h || t('열 {n}', { n: i + 1 }),
                              })),
                            ]}
                          />
                        ))}
                      </div>
                      <h3>{t('2. 미리보기 · {n}개 기록', { n: rows.length - 1 })}</h3>
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
                        {t('검토한 출근기록 저장')}
                      </button>
                    </div>
                  )}
                </>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      '직원',
                      '근무일',
                      '예정 출근',
                      '출근',
                      '퇴근',
                      '휴게',
                      '실근무',
                      '지각',
                    ].map((h) => (
                      <TableHead key={h}>{t(h)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attendance
                    .filter((a) => actor.admin || a.employeeId === actor.id)
                    .map((a) => {
                      // 예정 근무가 없는 기록은 지각 기준이 없어 '정시'가 아니라 '예정 없음'입니다.
                      const planned = scheduledFor(data, a);
                      const late = lateBy(data, a);
                      return (
                        <TableRow key={a.id}>
                          <TableCell>{box(emp(a.employeeId))}</TableCell>
                          <TableCell>{a.date}</TableCell>
                          <TableCell>{planned ? planned.start : '—'}</TableCell>
                          <TableCell>{a.start}</TableCell>
                          <TableCell>
                            {a.end}
                            {a.end < a.start ? t(' (+1일)') : ''}
                          </TableCell>
                          <TableCell>
                            {t('{n}분', { n: a.breakMinutes })}
                          </TableCell>
                          <TableCell>
                            {duration(a.start, a.end, a.breakMinutes).toFixed(2)}
                            h
                          </TableCell>
                          <TableCell className={late ? 'red' : undefined}>
                            {late === null
                              ? t('예정 없음')
                              : late
                                ? t('{n}분 지각', { n: late })
                                : t('정시')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              {!data.attendance.filter((a) => actor.admin || a.employeeId === actor.id)
                .length && (
                <div className="empty">{t('아직 저장된 출근기록이 없습니다.')}</div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="payroll">
            <div className="panel contentpanel">
              <div className="sectionhead">
                <div>
                  <h2>{actor.admin ? t('예상 급여') : t('내 예상 급여')}</h2>
                  <p>
                    {t(
                      '정규 {r}시간까지 시급 × 실근무, 초과분 {m}배 가산, 지각 차감, 승인된 대체 추가수당',
                      { r: OT_WEEKLY_HOURS, m: OT_MULTIPLIER },
                    )}
                  </p>
                </div>
                {actor.admin && (
                  <button className="button" onClick={exportPayroll}>
                    <Download size={16} /> {t('CSV 다운로드')}
                  </button>
                )}
              </div>
              <div className="filterbar">
                <label className="field">
                  {t('시작일')}
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label className="field">
                  {t('종료일')}
                  <input
                    type="date"
                    min={from}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
                <strong className="paytotal">
                  {money(visibleTotals.reduce((n, r) => n + r.total, 0))}
                </strong>
              </div>
              <div className="policy">
                {t(
                  '초과근무는 하루 {d}시간 초과분과 한 주(일요일 시작) {w}시간 초과분 중 큰 쪽만 {m}배로 가산합니다. 지각은 예정 출근 시각을 넘긴 분만큼 시급으로 차감하며, 예정 근무가 없는 출근기록은 지각으로 보지 않습니다. 세금·유급휴가를 제외한 예상 금액이고, 시급 0인 직원은 지급액 확인이 필요합니다. 원근무자의 예정 시간은 지급 대상이 아니며 실제 출근기록만 지급합니다.',
                  { d: OT_DAILY_HOURS, w: OT_WEEKLY_HOURS, m: OT_MULTIPLIER },
                )}
                {/* 주 단위로 끊기지 않은 구간은 걸쳐 있는 주의 초과근무가 적게 잡힙니다. */}
                {!wholeWeeks(from, to) && (
                  <b className="red">
                    {' '}
                    {t(
                      '조회 구간이 주(일요일~토요일) 단위가 아니어서 걸쳐 있는 주의 초과근무가 실제보다 적게 잡힐 수 있습니다.',
                    )}
                  </b>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      '직원',
                      '실근무',
                      '정규',
                      '초과',
                      '시급',
                      '기본급',
                      '초과수당',
                      '지각 차감',
                      '대체 추가수당',
                      '예상 급여',
                    ].map((h) => (
                      <TableHead key={h}>{t(h)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTotals.map((r) => (
                      <TableRow key={r.e.id}>
                        <TableCell>{box(r.e)}</TableCell>
                        <TableCell>{r.hours.toFixed(2)}h</TableCell>
                        <TableCell>{r.regularHours.toFixed(2)}h</TableCell>
                        <TableCell>{r.otHours.toFixed(2)}h</TableCell>
                        <TableCell>
                          {r.e.rate ? money(r.e.rate) : t('설정 필요')}
                        </TableCell>
                        <TableCell>{money(r.base)}</TableCell>
                        <TableCell className={r.otPay ? 'green' : undefined}>
                          +{money(r.otPay)}
                        </TableCell>
                        <TableCell
                          className={r.lateDeduction ? 'red' : undefined}
                        >
                          {r.lateMinutes
                            ? t('-{money} · {n}분 {d}일', {
                                money: money(r.lateDeduction),
                                n: r.lateMinutes,
                                d: r.lateDays,
                              })
                            : money(0)}
                        </TableCell>
                        <TableCell className={r.bonus ? 'green' : undefined}>
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
                  <h2>{t('대체근무 요청')}</h2>
                  <p>{t('신청 → 대체 직원 수락 → 관리자 승인')}</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => open('swap', { shiftId: '', to: '' })}
                >
                  <Plus size={16} /> {t('대체 신청')}
                </button>
              </div>
              <div className="policy">
                {t(
                  '뉴욕 현지 날짜 기준, 근무일 7일 전까지 신청과 승인을 완료하세요. 기존 근무와 겹치는 대체는 차단됩니다.',
                )}
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
                      {t(
                        {
                          requested: '수락 대기',
                          accepted: '승인 대기',
                          approved: '승인 완료',
                          rejected: 'badge::거절/취소',
                        }[r.status],
                      )}
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
                        {t('수락')}
                      </button>
                    )}
                    {r.status === 'accepted' && actor.admin && (
                      <button
                        className="button primary"
                        onClick={() =>
                          open('approve', { id: r.id, bonus: '0' })
                        }
                      >
                        {t('수당 확인 및 승인')}
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
                          {t('거절/취소')}
                        </button>
                      )}
                    {r.status === 'approved' && (
                      <span>{t('추가수당 {amount}', { amount: money(r.bonus) })}</span>
                    )}
                  </div>
                );
              })}
              {!data.swaps.length && (
                <div className="empty">
                  <ArrowLeftRight size={28} />
                  <h3>{t('대체근무 요청이 없습니다.')}</h3>
                  <p>{t('스케줄을 선택하고 대체 직원을 지정하세요.')}</p>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="messages">
            <div className="panel contentpanel">
              <div className="sectionhead">
                <div>
                  <h2>{t('팀 메시지')}</h2>
                  <p>
                    {actor.admin
                      ? t('앱 내 메시지 · 30초마다 갱신 · 우천 공지는 푸시 알림으로도 발송')
                      : t('나에게 온 메시지와 전체 공지 · 관리자에게 답장할 수 있습니다')}
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
                  <Plus size={16} /> {t('메시지 작성')}
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
                      <span>
                        →{' '}
                        {m.recipients
                          ? m.recipients.map(name).join(', ')
                          : m.to === 'all'
                            ? t('전 직원')
                            : name(m.to)}
                      </span>
                      <time>
                        {new Date(m.createdAt).toLocaleString(locale, {
                          timeZone: 'America/New_York',
                        })}
                      </time>
                    </div>
                    {/* Rain notices are generated text; regular messages are shown exactly as written. */}
                    <p>{m.kind === 'rain' ? t(m.body) : m.body}</p>
                    <div className="messagefoot">
                      {actor.admin && m.to === 'all' ? (
                        <span>
                          {t('확인 {read} / {total}명 · {names} 미확인', {
                            read: m.readBy.filter(
                              (id) =>
                                id !== 'admin' &&
                                (m.recipients?.includes(id) ?? true),
                            ).length,
                            total: m.recipients?.length ?? data.employees.length,
                            names: data.employees
                              .filter(
                                (e) =>
                                  (m.recipients?.includes(e.id) ?? true) &&
                                  !m.readBy.includes(e.id),
                              )
                              .map((e) => e.name)
                              .join(', '),
                          })}
                        </span>
                      ) : m.sender === actor.id ? (
                        <span>
                          {m.readBy.includes(m.to)
                            ? t('상대방 확인')
                            : t('확인 대기')}
                        </span>
                      ) : (
                        <span>
                          {m.readBy.includes(actor.id)
                            ? t('확인 완료')
                            : t('확인 대기')}
                        </span>
                      )}
                      {!m.readBy.includes(actor.id) && (
                        <button
                          disabled={busy}
                          className="button"
                          onClick={() => command('read', { id: m.id })}
                        >
                          <Check size={14} /> {t('확인했습니다')}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              {!data.messages.length && (
                <div className="empty">
                  <MessageSquare size={28} />
                  <h3>{t('팀의 대화를 시작하세요.')}</h3>
                  <p>{t('우천 종료 공지도 이곳에 모입니다.')}</p>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="team">
            <div className="panel contentpanel">
              <div className="sectionhead">
                <div>
                  <h2>{t('직원 관리')}</h2>
                  <p>{t('이름 앞 컬러 상자 · 직원 ID · 연락처 · 개인별 시급 · 로그인 설정')}</p>
                </div>
                <button
                  className="button primary"
                  onClick={() =>
                    open('employee', {
                      name: '',
                      phone: '',
                      email: '',
                      rate: '0',
                      color: '#087e6d',
                      role: AREAS[0],
                    })
                  }
                >
                  <Plus size={16} /> {t('직원 추가')}
                </button>
              </div>
              <div className="filterbar">
                <Pick
                  label={t('급여 통화')}
                  value={data.currency}
                  onChange={(v) => void command('currency', { currency: v })}
                  options={['USD', 'CAD', 'KRW', 'PHP'].map((v) => ({
                    value: v,
                    label: v,
                  }))}
                />
                {!setup && (
                  <div className="teamlink">
                    <b>{t('직원 접속 주소')}</b>
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
                      {t('직원은 로그인 화면에서 자기 이름을 골라 로그인합니다. 초기 비밀번호는 1111이며, 직원이 직접 변경할 수 있습니다.')}
                    </small>
                  </div>
                )}
                {push.tickUrl && (
                  <div className="teamlink">
                    <b>{t('출근 알림 자동 점검 주소')}</b>
                    <input
                      readOnly
                      value={push.tickUrl}
                      onFocus={(e) => e.target.select()}
                    />
                    <small>
                      {t(
                        '앱이 열려 있으면 30초마다 자동 점검합니다. 아무도 앱을 열지 않을 때도 1시간 전 알림을 보내려면 외부 cron(예: cron-job.org)에 이 주소를 5분 간격으로 등록하세요. 비공개 사이트는 외부 호출이 차단될 수 있습니다. 이 주소는 비밀번호처럼 보관하세요.',
                      )}
                    </small>
                  </div>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {['직원', '직원 ID', '업무', '생년월일', '연락처', '이메일', '개인별 시급', '설정'].map(
                      (h) => (
                        <TableHead key={h}>{t(h)}</TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{box(e)}</TableCell>
                      <TableCell>{e.id}</TableCell>
                      <TableCell>
                        {e.role}
                        {e.taskManager && (
                          <span className="badge taskbadge">{t('작업 지시')}</span>
                        )}
                      </TableCell>
                      <TableCell>{e.birthDate || t('미등록')}</TableCell>
                      <TableCell>{e.phone || t('미등록')}</TableCell>
                      <TableCell>{e.email || t('미등록')}</TableCell>
                      <TableCell>{money(e.rate)}</TableCell>
                      <TableCell>
                        <button
                          className="button"
                          onClick={() =>
                            open('employee', {
                              ...e,
                              rate: String(e.rate),
                              taskManager: e.taskManager ? '1' : '',
                            })
                          }
                        >
                          {t('수정')}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
    </>
  );
  const dialogs = (
    <>
      {inapp && (
        <div className="inapp-alert" role="status">
          <span className="inapp-icon"><BellRing size={18} /></span>
          <div>
            <b>
              {inapp.kind === 'rain'
                ? t('우천 근무 종료')
                : inapp.sender === 'admin'
                  ? t('관리자 메시지')
                  : t('{name} 메시지', { name: name(inapp.sender) })}
            </b>
            <p>{inapp.body}</p>
          </div>
          <div className="inapp-actions">
            <button
              className="button primary"
              onClick={() => {
                setTab('messages');
                setInapp(null);
              }}
            >
              {t('보기')}
            </button>
            <button className="iconbutton" aria-label={t('닫기')} onClick={() => setInapp(null)}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <Dialog
        open={!!modal}
        onOpenChange={(o) => {
          if (!o) setModal('');
        }}
      >
        <DialogContent className="shift-dialog">
          <DialogTitle>
            {t(
              (
                {
                  rain: '우천 근무 종료 공지',
                  shift: '근무 추가',
                  shiftUpdate: isBulk ? '여러 날 한번에 수정' : '근무 시간 수정',
                  timeOffRequest: actor.admin ? '휴무 추가' : '휴무 신청',
                  availabilitySet: '근무 불가 시간 추가',
                  employee: '직원 설정',
                  swap: '대체근무 신청',
                  approve: '대체근무 승인',
                  message: '메시지 작성',
                  detail: '근무 상세',
                } as Record<string, string>
              )[modal] || '',
            )}
          </DialogTitle>
          <DialogDescription>
            {modal === 'rain'
              ? t('선택한 직원에게 앱 내 공지를 저장하고, 푸시 알림을 켠 직원에게 바로 보냅니다. 기본으로 전 직원이 선택되어 있습니다. 실제 퇴근기록과 급여는 자동 변경하지 않습니다.')
              : modal === 'approve'
                ? t('수락한 대체 직원에게 근무를 이전합니다. 추가수당은 실제 출근기록이 있을 때 반영합니다.')
                : modal === 'shiftUpdate'
                  ? t('저장하면 스케줄이 작성 중 상태로 바뀝니다. 수정 후 직원에게 공개를 다시 누르세요.')
                  : t('내용을 확인한 후 저장하세요.')}
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (modal === 'approve')
                void command('swapDecision', { ...form, action: 'approve' });
              else if (isBulk)
                void command('shiftUpdate', {
                  ids: bulkIds.join(','),
                  start: form.start,
                  end: form.end,
                  area: form.area,
                });
              else if (modal === 'detail') {
                setModal('swap');
                setForm({ shiftId: form.id, to: '' });
              } else void command(modal, form);
            }}
          >
            {modal === 'rain' && (
              <>
                {input('date', t('종료 날짜'), 'date')}
                {input('end', t('종료 시각 (뉴욕)'), 'time')}
                <fieldset className="recipients">
                  <legend>
                    {t('받는 직원 ({n}/{total}명)', {
                      n: rainTargets.length,
                      total: data.employees.length,
                    })}
                  </legend>
                  <label className="recipient all">
                    <Checkbox
                      checked={rainAll}
                      onCheckedChange={(on) =>
                        put(
                          'targets',
                          on ? data.employees.map((e) => e.id).join(',') : '',
                        )
                      }
                    />
                    {t('전 직원')}
                  </label>
                  <div className="recipientlist">
                    {data.employees.map((e) => (
                      <label className="recipient" key={e.id}>
                        <Checkbox
                          checked={rainTargets.includes(e.id)}
                          onCheckedChange={(on) => toggleRain(e.id, on)}
                        />
                        {box(e)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {input('body', t('안내 내용'))}
              </>
            )}
            {modal === 'shift' && (
              <>
                <Pick
                  label={t('직원')}
                  value={form.employeeId || ''}
                  onChange={(v) => put('employeeId', v)}
                  options={options}
                />
                {input('date', t('근무일'), 'date')}
                <div className="formgrid">
                  {input('start', t('출근'), 'time')}
                  {input('end', t('퇴근'), 'time')}
                </div>
                <p className="hint">
                  {t('퇴근이 출근보다 이르면 다음 날 퇴근으로 계산합니다.')}
                </p>
                {input('area', t('업무 / 장소'))}
              </>
            )}
            {modal === 'shiftUpdate' && !isBulk && (
              <>
                {box(emp(data.shifts.find((s) => s.id === form.ids)?.employeeId || ''))}
                {input('date', t('근무일'), 'date')}
                <div className="formgrid">
                  {input('start', t('출근'), 'time')}
                  {input('end', t('퇴근'), 'time')}
                </div>
                <p className="hint">
                  {t('퇴근이 출근보다 이르면 다음 날 퇴근으로 계산합니다.')}
                </p>
                {input('area', t('업무 / 장소'))}
              </>
            )}
            {isBulk && (
              <>
                <Pick
                  label={t('직원')}
                  value={form.employee || 'all'}
                  onChange={(v) => putBulkFilter('employee', v)}
                  options={[{ value: 'all', label: t('모든 직원') }, ...options]}
                />
                <div className="formgrid">
                  <label className="field">
                    {t('시작일')}
                    <input
                      type="date"
                      required
                      value={form.from || ''}
                      onChange={(e) => putBulkFilter('from', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    {t('종료일')}
                    <input
                      type="date"
                      required
                      min={form.from}
                      value={form.to || ''}
                      onChange={(e) => putBulkFilter('to', e.target.value)}
                    />
                  </label>
                </div>
                <fieldset className="recipients shiftpick">
                  <legend>
                    {t('수정할 근무 ({n}/{total}개)', {
                      n: bulkIds.length,
                      total: bulkShifts.length,
                    })}
                  </legend>
                  {bulkShifts.length ? (
                    <>
                      <label className="recipient all">
                        <Checkbox
                          checked={bulkAll}
                          disabled={!bulkOptions.length}
                          onCheckedChange={(on) =>
                            put('ids', on ? bulkOptions.join(',') : '')
                          }
                        />
                        {t('전체 선택')}
                      </label>
                      <div className="recipientlist">
                        {bulkShifts.map((s) => {
                          const locked = swapLocked.has(s.id);
                          return (
                            <label
                              className={'recipient' + (locked ? ' locked' : '')}
                              key={s.id}
                            >
                              <Checkbox
                                checked={bulkIds.includes(s.id)}
                                disabled={locked}
                                onCheckedChange={(on) => toggleBulk(s.id, on)}
                              />
                              <span>
                                {s.date.slice(5).replace('-', '.')} (
                                {days[new Date(s.date + 'T12:00:00Z').getUTCDay()]})
                              </span>
                              {form.employee === 'all' && box(emp(s.employeeId))}
                              <small>
                                {s.start}–{s.end} · {s.area}
                                {locked ? ' · ' + t('대체 요청 진행 중') : ''}
                              </small>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="hint">{t('이 기간에 등록된 근무가 없습니다.')}</p>
                  )}
                </fieldset>
                <div className="formgrid">
                  {input('start', t('새 출근'), 'time', false)}
                  {input('end', t('새 퇴근'), 'time', false)}
                </div>
                {input('area', t('새 업무 / 장소'), 'text', false)}
                <p className="hint">
                  {t('비워 둔 항목은 기존 값을 그대로 유지합니다. 퇴근이 출근보다 이르면 다음 날 퇴근으로 계산합니다.')}
                </p>
              </>
            )}
            {modal === 'timeOffRequest' && (
              <>
                {actor.admin && (
                  <Pick
                    label={t('직원')}
                    value={form.employeeId || ''}
                    onChange={(v) => put('employeeId', v)}
                    options={options}
                  />
                )}
                <div className="formgrid">
                  <label className="field">
                    {t('시작일')}
                    <input
                      type="date"
                      required
                      min={actor.admin ? undefined : leadDate()}
                      value={form.from || ''}
                      onChange={(e) => {
                        const from = e.target.value;
                        // A partial day is a single date, and an end date never trails the start.
                        setForm((f) => ({
                          ...f,
                          from,
                          to: f.allDay !== '1' || (f.to || '') < from ? from : f.to,
                        }));
                      }}
                    />
                  </label>
                  <label className="field">
                    {t('종료일')}
                    <input
                      type="date"
                      required
                      min={form.from}
                      disabled={form.allDay !== '1'}
                      value={form.allDay === '1' ? form.to || '' : form.from || ''}
                      onChange={(e) => put('to', e.target.value)}
                    />
                  </label>
                </div>
                {!actor.admin && (
                  <p className="hint">{t('휴무는 시작일 7일 전까지 신청할 수 있습니다.')}</p>
                )}
                <label className="recipient all">
                  <Checkbox
                    checked={form.allDay === '1'}
                    onCheckedChange={(on) =>
                      setForm((f) => ({ ...f, allDay: on ? '1' : '', to: on ? f.to : f.from }))
                    }
                  />
                  {t('하루 종일')}
                </label>
                {form.allDay !== '1' && (
                  <>
                    <div className="formgrid">
                      {input('start', t('시작 시간'), 'time')}
                      {input('end', t('종료 시간'), 'time')}
                    </div>
                    <p className="hint">{t('시간 단위 휴무는 하루만 신청할 수 있습니다.')}</p>
                  </>
                )}
                {input('reason', t('사유 (선택)'), 'text', false)}
              </>
            )}
            {modal === 'availabilitySet' && (
              <>
                {actor.admin && (
                  <Pick
                    label={t('직원')}
                    value={form.employeeId || ''}
                    onChange={(v) => put('employeeId', v)}
                    options={options}
                  />
                )}
                <Pick
                  label={t('요일')}
                  value={form.weekday || ''}
                  onChange={(v) => put('weekday', v)}
                  options={days.map((d, i) => ({ value: String(i), label: d }))}
                />
                <label className="recipient all">
                  <Checkbox
                    checked={form.allDay === '1'}
                    onCheckedChange={(on) => put('allDay', on ? '1' : '')}
                  />
                  {t('종일 근무 불가')}
                </label>
                {form.allDay !== '1' && (
                  <div className="formgrid">
                    {input('start', t('불가 시작'), 'time')}
                    {input('end', t('불가 종료'), 'time')}
                  </div>
                )}
                {input('note', t('메모 (선택)'), 'text', false)}
                <p className="hint">
                  {actor.admin
                    ? t('관리자가 등록하면 바로 승인되고 오늘 근무부터 적용됩니다. 매주 같은 요일에 반복 적용됩니다.')
                    : t('관리자가 승인하면 매주 같은 요일에 반복 적용됩니다. 등록일로부터 7일 뒤 근무부터 적용됩니다.')}
                </p>
              </>
            )}
            {modal === 'employee' && (
              <>
                {input('name', t('이름'))}
                {input('birthDate', t('생년월일 8자리 (YYYYMMDD)'))}
                {input('phone', t('연락처 (예: 914-555-0123)'), 'tel', false)}
                {input('email', t('로그인 이메일'), 'email', false)}
                <div className="formgrid">
                  {input('color', t('직원 색상'), 'color')}
                  {input(
                    'rate',
                    t('개인별 시급 ({currency})', { currency: data.currency }),
                    'number',
                  )}
                </div>
                {input('role', t('업무'))}
                <label className="recipient all">
                  <Checkbox
                    checked={form.taskManager === '1'}
                    onCheckedChange={(on) => put('taskManager', on ? '1' : '')}
                  />
                  {t('작업 지시 권한')}
                </label>
                <p className="hint">
                  {t('켜면 이 직원이 작업 수신함에서 다른 직원에게 작업을 보내고 전체 작업 진행 상황을 볼 수 있습니다. 스케줄·급여·직원 정보는 계속 읽기 전용입니다.')}
                </p>
              </>
            )}
            {modal === 'swap' && (
              <>
                <Pick
                  label={t('대체할 근무')}
                  value={form.shiftId || ''}
                  onChange={(v) => put('shiftId', v)}
                  options={[
                    { value: '', label: t('근무 선택') },
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
                  label={t('대체 직원')}
                  value={form.to || ''}
                  onChange={(v) => put('to', v)}
                  options={[{ value: '', label: t('직원 선택') }, ...options]}
                />
                <p className="hint">
                  {t('근무일 7일 이내인 일정은 선택 목록에 표시되지 않습니다.')}
                </p>
              </>
            )}
            {modal === 'approve' &&
              input(
                'bonus',
                t('대체 직원 추가수당 ({currency})', { currency: data.currency }),
                'number',
              )}
            {modal === 'message' && (
              <>
                <Pick
                  label={t('받는 사람')}
                  value={form.to || ''}
                  onChange={(v) => put('to', v)}
                  options={
                    actor.admin
                      ? [{ value: 'all', label: t('전 직원') }, ...options]
                      : [{ value: 'admin', label: t('관리자') }]
                  }
                />
                <label className="field">
                  {t('field::메시지')}
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
                      {s.area} · {t('{n}시간', { n: duration(s.start, s.end) })}
                    </p>
                    {s.originalId && (
                      <p>
                        {t('원근무자 {from} → 대체자 {to}', {
                          from: name(s.originalId),
                          to: name(s.employeeId),
                        })}
                      </p>
                    )}
                    <p className="hint">
                      {staffReadOnly
                        ? t('직원용 보기 화면입니다. 일정 변경은 관리자에게 문의하세요.')
                        : canSwap(s.date)
                        ? t('대체근무를 신청할 수 있습니다.')
                        : t('대체근무 신청 기한이 지났습니다.')}
                    </p>
                    {actor.admin && (
                      <div className="detailactions">
                        <button
                          type="button"
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            open('shiftUpdate', {
                              ids: s.id,
                              date: s.date,
                              start: s.start,
                              end: s.end,
                              area: s.area,
                            })
                          }
                        >
                          {t('시간 수정')}
                        </button>
                        <button
                          type="button"
                          className="button"
                          disabled={busy}
                          onClick={() => {
                            const values = {
                              bulk: '1',
                              employee: s.employeeId,
                              from: weekStart(s.date),
                              to: addDays(weekStart(s.date), 6),
                              start: '',
                              end: '',
                              area: '',
                            };
                            open('shiftUpdate', {
                              ...values,
                              ids: bulkSelectable(values).join(','),
                            });
                          }}
                        >
                          {t('여러 날 한번에 수정')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
            {status && (
              <p role="alert" className="formerror">
                {t(status)}
              </p>
            )}
            {staffReadOnly && modal === 'detail' ? (
              <button
                className="button primary submit"
                type="button"
                onClick={() => setModal('')}
              >
                {t('닫기')}
              </button>
            ) : (
              <button
                className="button primary submit"
                disabled={
                  busy ||
                  (modal === 'rain' && !rainTargets.length) ||
                  (isBulk && !bulkIds.length) ||
                  (modal === 'detail' &&
                    !canSwap(
                      data.shifts.find((s) => s.id === form.id)?.date || '',
                    ))
                }
                type="submit"
              >
                {busy
                  ? t('저장 중…')
                  : modal === 'detail'
                    ? t('대체근무 신청')
                    : modal === 'rain'
                      ? rainAll
                        ? t('전 직원에게 공지 저장')
                        : t('선택한 {n}명에게 공지 저장', { n: rainTargets.length })
                      : isBulk
                        ? t('선택한 {n}개 근무 수정', { n: bulkIds.length })
                        : t('저장')}
              </button>
            )}
          </form>
        </DialogContent>
      </Dialog>
      <PasswordChange
        open={passwordDialog}
        initial={!passwordChanged}
        onClose={() => setPasswordDialog(false)}
        onChanged={() => setPasswordChanged(true)}
      />
    </>
  );
  // Version 1 (pelham-shifts): top bar and tab row.
  if (ui === 'pelham')
    return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brandmark" aria-hidden="true" />
          pelham<span className="brandlight">shift</span>
        </a>
        <div className="location">
          <MapPin size={16} /> Pelham Hills <span> / </span> {t('팀 워크스페이스')}
        </div>
        <div className="account">
          <LangToggle />
          {!setup && (
            <button
              aria-label={t('메시지 보기')}
              className="iconbutton bell"
              onClick={() => setTab('messages')}
            >
              <Bell size={19} />
              {unread.length > 0 && <em className="bellcount">{unread.length}</em>}
            </button>
          )}
          <span className="avatar">
            {actor.admin ? 'P' : name(actor.id).slice(0, 1)}
          </span>
          <span>{actor.admin ? t('관리자') : name(actor.id)}</span>
          {birthAuth && !actor.admin && (
            <button
              className="linkbutton"
              onClick={() => setPasswordDialog(true)}
            >
              {t('비밀번호')}
            </button>
          )}
          <button
            className="iconbutton"
            aria-label={t('로그아웃')}
            title={t('로그아웃')}
            onClick={() => void logout()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <div className="navrow">
          <TabsList variant="line">
            {nav
              .filter((n) => actor.admin || employeeNav.has(n.key))
              .map(({ key, label, Icon }) => (
                <TabsTrigger key={key} value={key}>
                  <Icon size={17} />
                  {t(label)}
                  {key === 'messages' && unread.length > 0 && (
                    <em className="navcount">{unread.length}</em>
                  )}
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
                  ? t('좋은 한 주는, 좋은 스케줄부터.')
                  : t(nav.find((n) => n.key === tab)?.label || '')}
              </h1>
              <p>
                {tab === 'schedule'
                  ? t('팀의 근무를 한눈에 확인하고, 함께 계획하세요.')
                  : t('스케줄부터 실제 근무시간까지, 같은 기록으로 연결합니다.')}
              </p>
            </div>
            <div className="headactions">
              {actor.admin && <InstallQr team={setup ? '' : team} />}
              {actor.admin && (
                <button
                  className="button rain"
                  onClick={() =>
                    open('rain', {
                      date: localDate(new Date()),
                      end: '15:00',
                      body: t('안전하게 장비를 정리하고 퇴근 기록을 남겨주세요.'),
                      targets: data.employees.map((e) => e.id).join(','),
                    })
                  }
                >
                  <CloudRain size={17} /> {t('우천 근무 종료')}
                </button>
              )}
            </div>
          </div>
          {setup && (
            <div className="demo-banner setup">
              <span>
                {t('샘플 미리보기 · 실제 운영을 시작하면 샘플 일정은 비워집니다.')}
              </span>
              <button
                className="button"
                disabled={busy}
                onClick={() => command('initialize')}
              >
                {t('내 워크스페이스 생성')}
              </button>
            </div>
          )}
          {status && (
            <div role="status" className="statusbar">
              {t(status)}
              <button
                className="iconbutton"
                onClick={() => void refresh()}
                aria-label={t('다시 불러오기')}
              >
                <RefreshCw size={15} />
              </button>
            </div>
          )}
          {actor.admin && (pendingOff.length > 0 || pendingAvail.length > 0) && (
            <div className="demo-banner setup">
              <span>
                {t('확인이 필요한 요청 · 휴무 {a}건 · 근무 불가 시간 {b}건', {
                  a: pendingOff.length,
                  b: pendingAvail.length,
                })}
              </span>
              <button
                className="button"
                onClick={() => setTab(pendingOff.length ? 'timeoff' : 'availability')}
              >
                {t('확인하기')}
              </button>
            </div>
          )}
          {reminders.map((s) => (
            <div className="demo-banner" key={s.id}>
              <Bell size={16} />{' '}
              {t('출근 알림 · 오늘 {start}, {area} 근무가 1시간 이내에 시작됩니다.', {
                start: s.start,
                area: s.area,
              })}
            </div>
          ))}
          <TabsContent value="schedule">
            <section className="stats">
              <div>
                <span>{t('이번 주 근무')}</span>
                <strong>
                  {weekShifts.length}
                  <small>{t('개')}</small>
                </strong>
                <p>
                  {t('{n}명의 직원과 함께하는 한 주', {
                    n: data.employees.length,
                  })}
                </p>
              </div>
              <div>
                <span>{t('예정 근무시간')}</span>
                <strong>
                  {weekShifts
                    .reduce((n, x) => n + duration(x.start, x.end), 0)
                    .toFixed(0)}
                  <small>{t('시간')}</small>
                </strong>
                <p>{t('등록된 스케줄 기준')}</p>
              </div>
              {actor.admin ? (
                <>
                  <div>
                    <span>{t('대체근무 요청')}</span>
                    <strong>
                      {pending.length}
                      <small>{t('건')}</small>
                    </strong>
                    <p className="green">
                      {pending.length
                        ? t('확인이 필요한 요청이 있습니다')
                        : t('모든 요청을 확인했습니다')}{' '}
                      <Check size={14} />
                    </p>
                  </div>
                  <div className="reminder">
                    <Bell size={23} />
                    <span>{t('출근 준비, 잊지 않도록')}</span>
                    <b>{t('근무 시작 1시간 전 알림')}</b>
                    <p>
                      {push.on
                        ? t('이 기기 푸시 알림 켜짐')
                        : t('앱 접속 중 알림 · 이 기기 푸시 꺼짐')}
                    </p>
                    {!setup && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          void (push.on ? testPush() : enablePush())
                        }
                      >
                        {push.on ? t('테스트 알림 보내기') : t('푸시 알림 켜기')}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span>{t('직원 화면')}</span>
                    <strong>{t('읽기 전용')}</strong>
                    <p className="green">{t('전체 일정과 내 기록만 볼 수 있습니다.')}</p>
                  </div>
                  <div className="reminder">
                    <Bell size={23} />
                    <span>{t('출근·메시지 알림')}</span>
                    <b>{t('근무 시작 1시간 전 알림')}</b>
                    <p>
                      {push.on
                        ? t('이 기기 푸시 알림 켜짐')
                        : t('앱 접속 중 알림 · 이 기기 푸시 꺼짐')}
                    </p>
                    {!setup && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          void (push.on ? testPush() : enablePush())
                        }
                      >
                        {push.on ? t('테스트 알림 보내기') : t('푸시 알림 켜기')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
            <section className="schedule panel">
              <div className="toolbar">
                <div className="weekpicker">
                  <button
                    aria-label={t('이전 주')}
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
                    aria-label={t('다음 주')}
                    onClick={() => setWeek(addDays(week, 7))}
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    className="button"
                    onClick={() => setWeek(weekStart(localDate(new Date())))}
                  >
                    {t('이번 주')}
                  </button>
                </div>
                <div className="actions">
                  <span className="draft">
                    ● {data.published ? t('직원 공개 중') : t('작성 중')}
                  </span>
                  {actor.admin && (
                    <>
                      <button
                        disabled={busy || setup}
                        className="button"
                        onClick={() => command('publish')}
                      >
                        {t('직원에게 공개')}
                      </button>
                      <button
                        disabled={busy || setup}
                        className="button"
                        onClick={openBulk}
                      >
                        {t('여러 날 한번에 수정')}
                      </button>
                      <button
                        className="button primary"
                        onClick={() =>
                          open('shift', {
                            employeeId: data.employees[0]?.id || '',
                            date: week,
                            start: '09:00',
                            end: '17:00',
                            area: AREAS[0],
                          })
                        }
                      >
                        <Plus size={16} /> {t('근무 추가')}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="filterbar">
                {staffReadOnly ? (
                  <strong className="paytotal">{t('전체 월간 일정 · 읽기 전용')}</strong>
                ) : (
                  <>
                    <Pick
                      label={t('직원')}
                      value={filter}
                      onChange={setFilter}
                      options={[
                        { value: 'all', label: t('모든 직원') },
                        ...options,
                      ]}
                    />
                    <Tabs
                      value={view}
                      onValueChange={(v) => setView(String(v))}
                    >
                      <TabsList>
                        <TabsTrigger value="today">TODAY</TabsTrigger>
                        <TabsTrigger value="tomorrow">TOMORROW</TabsTrigger>
                        <TabsTrigger value="week">WEEKLY</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </>
                )}
                {!staffReadOnly && (
                  <>
                    {view === 'month' && (
                      <label className="field">
                        {t('기준 날짜')}
                        <input
                          type="date"
                          value={day}
                          onChange={(e) => setDay(e.target.value)}
                        />
                      </label>
                    )}
                    <button
                      className="button all-schedule"
                      onClick={() => {
                        setFilter('all');
                        setView('month');
                      }}
                    >
                      {t('전체 일정 보기')}
                    </button>
                  </>
                )}
              </div>
              {view === 'week' ? (
                <div className="gridscroll">
                  <div className="weekgrid">
                    <div className="gridhead staffhead">
                      {t('직원')} <span>{t('{n}명', { n: visibleEmployees.length })}</span>
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
                                      {s.originalId ? t('대체 · ') : ''}
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
                  employees={staffReadOnly ? data.employees : visibleEmployees}
                  shifts={data.shifts.filter((shift) =>
                    (staffReadOnly ? data.employees : visibleEmployees).some(
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
                      <span>{t('직원')}</span>
                      <div>
                        {Array.from({ length: 13 }, (_, i) => (
                          <span key={i}>
                            {String(i * 2).padStart(2, '0')}:00
                          </span>
                        ))}
                      </div>
                    </div>
                    {[timelineDate].map((date) => {
                      const weekday =
                        days[new Date(date + 'T12:00:00Z').getUTCDay()];
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
                  <i className="tiny-dot" />{' '}
                  {t('직원별 컬러는 모든 화면에서 동일하게 표시됩니다.')}
                </span>
                <span>{t('대체 신청·승인 · 근무일 7일 전까지')}</span>
              </div>
            </section>
            <div className="below">
              <div>
                <Clock3 size={18} />
                <b>{t('실제 출근기록으로 정확하게')}</b>
                <span>
                  {t('출근기계 엑셀·CSV를 업로드하면 근무시간과 예상 급여를 계산합니다.')}
                </span>
              </div>
              <button
                className="linkbutton"
                onClick={() => setTab('attendance')}
              >
                {t('출근기록 가져오기 →')}
              </button>
            </div>
          </TabsContent>
{otherTabs}
        </main>
      </Tabs>
      <footer>
        PELHAM SHIFT <span>{t('팀의 시간, 더 간편하게.')}</span>
      </footer>
      {dialogs}
    </div>
    );
  // Version 2 (seven-shifts): 7shifts-style sidebar layout on the same data.
  const navItem = (
    key: string,
    label: string,
    Icon: typeof CalendarDays,
    { sub = false, count = 0 }: { sub?: boolean; count?: number } = {},
  ) => (
    <TabsTrigger
      key={key}
      value={key}
      className={'sidenav-item' + (sub ? ' sub' : '')}
      onClick={() => setNavOpen(false)}
    >
      <Icon size={19} />
      <span>{t(label)}</span>
      {count > 0 && <em className="sidenav-count">{count}</em>}
    </TabsTrigger>
  );
  const scheduleTabs = ['schedule', 'timeoff', 'availability', 'swaps'];
  const iconPick = (
    Icon: typeof CalendarDays,
    label: string,
    value: string,
    onChange: (v: string) => void,
    items: { value: string; label: string }[],
  ) => (
    <Select value={value} onValueChange={(v) => onChange(String(v))} items={items}>
      <SelectTrigger className="filterpick" aria-label={label}>
        <Icon size={17} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  const comingSoon = (key: string, Icon: typeof CalendarDays, title: string, desc: string) => (
    <TabsContent value={key}>
      <div className="panel contentpanel soon">
        <Icon size={34} />
        <h2>{t(title)}</h2>
        <span className="badge">{t('준비 중')}</span>
        <p>{t(desc)}</p>
      </div>
    </TabsContent>
  );
  // Shifts this request would block if approved (or already blocks).
  return (
    <div
      className={
        'app-shell' + (navCollapsed ? ' collapsed' : '') + (navOpen ? ' nav-open' : '')
      }
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(String(v))}
        className="app-tabs"
      >
        <aside className="sidebar" aria-label={t('메뉴')}>
          <div className="sidebar-brand">
            <a className="brand" href={'/' + query()}>
              <span className="brandmark" aria-hidden="true" />
              <span className="brandtext">
                pelham<span className="brandlight">shift</span>
              </span>
            </a>
            <button
              className="iconbutton sidebar-toggle"
              aria-label={navCollapsed ? t('메뉴 펼치기') : t('메뉴 접기')}
              onClick={() => {
                setNavCollapsed((c) => !c);
                setNavOpen(false);
              }}
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          <TabsList className="sidenav">
            {actor.admin && navItem('dashboard', '대시보드', LayoutDashboard)}
            <div className={'sidenav-group' + (scheduleTabs.includes(tab) ? ' current' : '')}>
              <span className="sidenav-heading">
                <CalendarDays size={19} />
                <span>{t('스케줄')}</span>
              </span>
              {navItem('schedule', '스케줄', CalendarDays, { sub: true })}
              {navItem('timeoff', '휴무', CalendarX, {
                sub: true,
                count: actor.admin ? pendingOff.length : 0,
              })}
              {navItem('availability', '근무 가능 시간', CalendarClock, {
                sub: true,
                count: actor.admin ? pendingAvail.length : 0,
              })}
              {actor.admin &&
                navItem('swaps', '대체 근무', ArrowLeftRight, { sub: true, count: pending.length })}
            </div>
            {actor.admin && navItem('team', '팀', Users)}
            {actor.admin && navItem('training', '교육', GraduationCap)}
            {actor.admin && navItem('hiring', '채용', BriefcaseBusiness)}
            <hr />
            <a className="sidenav-item" href={'/tasks' + query()}>
              <ClipboardList size={19} />
              <span>{t('작업')}</span>
            </a>
            {actor.admin && navItem('logbook', '업무일지', BookOpen)}
            {navItem('messages', '메시지', MessageSquare, { count: unread.length })}
            <hr />
            {navItem('attendance', '출근 기록', Timer)}
            {navItem('payroll', '급여 관리', Wallet)}
            <hr />
            {navItem('help', '도움말', CircleQuestionMark)}
          </TabsList>
          <div className="sidebar-foot">
            <div className="sidebar-account">
              <span className="avatar">
                {actor.admin ? 'P' : name(actor.id).slice(0, 1)}
              </span>
              <span className="sidebar-name">
                <b>{actor.admin ? t('관리자') : name(actor.id)}</b>
                <small>Pelham Hills · New York</small>
              </span>
            </div>
            <div className="sidebar-tools">
              <LangToggle />
              {birthAuth && !actor.admin && (
                <button className="linkbutton" onClick={() => setPasswordDialog(true)}>
                  {t('비밀번호')}
                </button>
              )}
              {!setup && (
                <button
                  className={'iconbutton' + (push.on ? ' on' : '')}
                  disabled={busy}
                  onClick={() => void (push.on ? testPush() : enablePush())}
                  aria-label={push.on ? t('테스트 알림 보내기') : t('푸시 알림 켜기')}
                  title={push.on ? t('이 기기 푸시 알림 켜짐') : t('푸시 알림 켜기')}
                >
                  {push.on ? <BellRing size={17} /> : <Bell size={17} />}
                </button>
              )}
              <button
                className="iconbutton"
                aria-label={t('로그아웃')}
                title={t('로그아웃')}
                onClick={() => void logout()}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </aside>
        <button
          className="sidebar-scrim"
          aria-label={t('메뉴 닫기')}
          onClick={() => setNavOpen(false)}
        />
        <div className="workarea">
          <header className="mobilebar">
            <button
              className="iconbutton"
              aria-label={t('메뉴 열기')}
              onClick={() => setNavOpen(true)}
            >
              <Menu size={22} />
            </button>
            <a className="brand" href={'/' + query()}>
              <span className="brandmark" aria-hidden="true" />
              pelham<span className="brandlight">shift</span>
            </a>
            <button
              aria-label={t('메시지 보기')}
              className="iconbutton bell"
              onClick={() => setTab('messages')}
            >
              <Bell size={20} />
              {unread.length > 0 && <em className="bellcount">{unread.length}</em>}
            </button>
          </header>
          <main>
            {setup && (
              <div className="demo-banner setup">
                <span>
                  {t('샘플 미리보기 · 실제 운영을 시작하면 샘플 일정은 비워집니다.')}
                </span>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => command('initialize')}
                >
                  {t('내 워크스페이스 생성')}
                </button>
              </div>
            )}
            {status && (
              <div role="status" className="statusbar">
                {t(status)}
                <button
                  className="iconbutton"
                  onClick={() => void refresh()}
                  aria-label={t('다시 불러오기')}
                >
                  <RefreshCw size={15} />
                </button>
              </div>
            )}
            {reminders.map((s) => (
              <div className="demo-banner" key={s.id}>
                <Bell size={16} />{' '}
                {t('출근 알림 · 오늘 {start}, {area} 근무가 1시간 이내에 시작됩니다.', {
                  start: s.start,
                  area: s.area,
                })}
              </div>
            ))}
            <TabsContent value="schedule">
              <section className="sched">
                <div className="sched-top">
                  {staffReadOnly ? (
                    <h1 className="sched-title">{t('전체 월간 일정 · 읽기 전용')}</h1>
                  ) : view === 'week' ? (
                    <>
                      <div className="daterange">
                        <button
                          aria-label={t('이전 주')}
                          onClick={() => setWeek(addDays(week, -7))}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span className="daterange-label">
                          <CalendarDays size={18} />
                          {longDate(week)}
                          <ArrowRight size={15} />
                          {longDate(addDays(week, 6))}
                        </span>
                        <button
                          aria-label={t('다음 주')}
                          onClick={() => setWeek(addDays(week, 7))}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                      <button
                        className="button"
                        onClick={() => setWeek(weekStart(localDate(new Date())))}
                      >
                        {t('오늘')}
                      </button>
                    </>
                  ) : view === 'month' ? (
                    <label className="field daterange-field">
                      <span className="sr-only">{t('기준 날짜')}</span>
                      <input
                        type="date"
                        value={day}
                        onChange={(e) => setDay(e.target.value)}
                      />
                    </label>
                  ) : (
                    <span className="daterange-label solo">
                      <CalendarDays size={18} />
                      {longDate(timelineDate)}
                    </span>
                  )}
                  {actor.admin && (
                    <div className="sched-actions">
                      {warnings.length > 0 && (
                        <button
                          className="warnpill"
                          title={warnings.map((w) => w.text).join('\n')}
                          onClick={() => setTab(warnings[0].tab)}
                        >
                          <TriangleAlert size={16} />
                          {t('경고 {n}건', { n: warnings.length })}
                        </button>
                      )}
                      <span className="sched-actions-rule" />
                      <button
                        className="button publish"
                        disabled={busy || setup || data.published}
                        onClick={() => command('publish')}
                        title={data.published ? t('직원 공개 중') : t('작성 중')}
                      >
                        <Send size={16} />
                        {data.published ? t('공개됨') : t('스케줄 공개')}
                      </button>
                    </div>
                  )}
                </div>
                {!staffReadOnly && (
                  <div className="sched-filters">
                    <span className="filterpick static" title="Pelham Hills">
                      <MapPin size={17} />
                      <span>Pelham Hills</span>
                      <ChevronDown size={16} />
                    </span>
                    {iconPick(Network, t('업무'), dept, setDept, [
                      { value: 'all', label: t('모든 업무') },
                      ...roles.map((r) => ({ value: r, label: r })),
                    ])}
                    {iconPick(ArrowUpDown, t('정렬'), sort, setSort, [
                      { value: 'name', label: t('이름순') },
                      { value: 'id', label: t('직원 ID순') },
                    ])}
                    {iconPick(LayoutGrid, t('보기'), view, setView, [
                      { value: 'week', label: t('주간') },
                      { value: 'today', label: t('오늘') },
                      { value: 'tomorrow', label: t('내일') },
                      { value: 'month', label: t('월간') },
                    ])}
                    {filter !== 'all' && (
                      <button className="filterchip" onClick={() => setFilter('all')}>
                        {name(filter)} <X size={14} />
                      </button>
                    )}
                    <span className="sched-filters-gap" />
                    <InstallQr team={setup ? '' : team} compact />
                    <button
                      className="button toolbutton"
                      title={t('우천 근무 종료')}
                      aria-label={t('우천 근무 종료')}
                      onClick={() =>
                        open('rain', {
                          date: localDate(new Date()),
                          end: '15:00',
                          body: t('안전하게 장비를 정리하고 퇴근 기록을 남겨주세요.'),
                          targets: data.employees.map((e) => e.id).join(','),
                        })
                      }
                    >
                      <CloudRain size={18} />
                    </button>
                    <button
                      disabled={busy || setup}
                      className="button toolbutton"
                      title={t('여러 날 한번에 수정')}
                      aria-label={t('여러 날 한번에 수정')}
                      onClick={openBulk}
                    >
                      <CalendarRange size={18} />
                    </button>
                  </div>
                )}
                {!staffReadOnly && view === 'week' ? (
                  <div className="roster-wrap">
                    <div className="roster-scroll">
                      <div className="roster">
                        <div className="roster-corner">
                          <label className="roster-search">
                            <Search size={16} />
                            <input
                              type="search"
                              placeholder={t('직원 검색')}
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </label>
                          <button
                            className="roster-add"
                            aria-label={t('직원 추가')}
                            title={t('직원 추가')}
                            onClick={() =>
                              open('employee', {
                                name: '',
                                phone: '',
                                email: '',
                                rate: '0',
                                color: '#087e6d',
                                role: dept === 'all' ? AREAS[0] : dept,
                              })
                            }
                          >
                            <UserPlus size={18} />
                          </button>
                        </div>
                        {weekDates.map((date, i) => (
                          <div
                            className={
                              'roster-day' + (date === localDate(new Date()) ? ' today' : '')
                            }
                            key={date}
                          >
                            <span>
                              <b>{days[i]}</b>
                              {monthDay(date)}
                            </span>
                            <small title={t('근무 인원')}>
                              <UserRound size={13} />
                              {
                                new Set(
                                  rosterShifts
                                    .filter((s) => s.date === date)
                                    .map((s) => s.employeeId),
                                ).size
                              }
                            </small>
                          </div>
                        ))}
                        <div className="roster-location">Pelham Hills</div>
                        {roles
                          .filter((role) => visibleEmployees.some((e) => e.role === role))
                          .map((role) => {
                            const members = visibleEmployees.filter((e) => e.role === role);
                            return (
                              <div className="roster-group" key={role}>
                                <div className="roster-band">
                                  {role}
                                  <small>{t('{n}명', { n: members.length })}</small>
                                </div>
                                {members.map((e) => {
                                  const mine = rosterShifts.filter((s) => s.employeeId === e.id);
                                  const hours = mine.reduce(
                                    (n, s) => n + duration(s.start, s.end),
                                    0,
                                  );
                                  return (
                                    <div className="roster-row" key={e.id}>
                                      <div className="roster-staff">
                                        <span
                                          className="roster-avatar"
                                          style={{ background: e.color }}
                                        >
                                          {e.name.slice(0, 1)}
                                        </span>
                                        <span>
                                          <button
                                            className="roster-name"
                                            onClick={() =>
                                              setFilter(filter === e.id ? 'all' : e.id)
                                            }
                                          >
                                            {e.name}
                                          </button>
                                          <small>
                                            {t('{h}시간', { h: hours.toFixed(2) })} -{' '}
                                            {money(hours * e.rate)}
                                          </small>
                                        </span>
                                      </div>
                                      {weekDates.map((date) => {
                                        const shifts = mine.filter((s) => s.date === date);
                                        const offs = timeOff.filter(
                                          (r) =>
                                            r.employeeId === e.id &&
                                            r.status !== 'declined' &&
                                            date >= r.from &&
                                            date <= r.to,
                                        );
                                        const unavailable = availability.filter(
                                          (r) =>
                                            r.employeeId === e.id &&
                                            r.status !== 'declined' &&
                                            r.weekday === weekdayOf(date),
                                        );
                                        return (
                                          <div className="roster-cell" key={date}>
                                            {offs.map((r) => (
                                              <button
                                                key={r.id}
                                                className={'roster-note off ' + r.status}
                                                onClick={() => setTab('timeoff')}
                                              >
                                                <b>
                                                  {r.status === 'pending'
                                                    ? t('휴무 신청')
                                                    : t('휴무')}
                                                </b>
                                                <span>{span(r)}</span>
                                              </button>
                                            ))}
                                            {unavailable.map((r) => (
                                              <button
                                                key={r.id}
                                                className={'roster-note unavailable ' + r.status}
                                                onClick={() => setTab('availability')}
                                              >
                                                <b>
                                                  {r.status === 'pending'
                                                    ? t('불가 신청')
                                                    : t('근무 불가')}
                                                </b>
                                                <span>{span(r)}</span>
                                              </button>
                                            ))}
                                            {shifts.map((s) => {
                                              const blocked = blockedBy(data, s);
                                              return (
                                                <button
                                                  key={s.id}
                                                  className={
                                                    'roster-shift' + (blocked ? ' conflict' : '')
                                                  }
                                                  onClick={() => open('detail', { id: s.id })}
                                                  title={
                                                    blocked
                                                      ? t('휴무·불가 시간과 겹치는 근무입니다')
                                                      : undefined
                                                  }
                                                >
                                                  <i style={{ background: e.color }}>
                                                    {s.area.slice(0, 1).toUpperCase()}
                                                  </i>
                                                  <span>
                                                    <b>
                                                      {ampm(s.start)} - {ampm(s.end)}
                                                    </b>
                                                    <small>
                                                      {blocked && <TriangleAlert size={11} />}
                                                      {s.originalId ? t('대체 · ') : ''}
                                                      {s.area}
                                                    </small>
                                                  </span>
                                                </button>
                                              );
                                            })}
                                            <button
                                              className="roster-celladd"
                                              aria-label={t('{name} {date} 근무 추가', {
                                                name: e.name,
                                                date,
                                              })}
                                              onClick={() =>
                                                open('shift', {
                                                  employeeId: e.id,
                                                  date,
                                                  start: '09:00',
                                                  end: '17:00',
                                                  area: e.role,
                                                })
                                              }
                                            >
                                              <Plus size={15} />
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        {!visibleEmployees.length && (
                          <div className="roster-empty">{t('조건에 맞는 직원이 없습니다.')}</div>
                        )}
                        <div className="roster-total">
                          <span className="roster-tab">{t('인건비')}</span>
                          <b>{t('예정')}</b>
                          <span>
                            {t('{h}시간', {
                              h: rosterShifts
                                .reduce((n, s) => n + duration(s.start, s.end), 0)
                                .toFixed(2),
                            })}
                            <small>{money(rosterCost(rosterShifts))}</small>
                          </span>
                        </div>
                        {weekDates.map((date) => {
                          const list = rosterShifts.filter((s) => s.date === date);
                          const dayHours = list.reduce((n, s) => n + duration(s.start, s.end), 0);
                          const weekHours = rosterShifts.reduce(
                            (n, s) => n + duration(s.start, s.end),
                            0,
                          );
                          return (
                            <div className="roster-daytotal" key={date}>
                              <em
                                className={dayHours ? '' : 'none'}
                                title={t('이번 주 예정 시간 중 비중')}
                              >
                                {dayHours && weekHours
                                  ? Math.round((dayHours / weekHours) * 100) + '%'
                                  : '-'}
                              </em>
                              <b>{t('{h}시간', { h: dayHours.toFixed(2) })}</b>
                              <small>{money(rosterCost(list))}</small>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : staffReadOnly || view === 'month' ? (
                  <MonthSchedule
                    date={day}
                    employees={staffReadOnly ? data.employees : visibleEmployees}
                    shifts={data.shifts.filter((shift) =>
                      (staffReadOnly ? data.employees : visibleEmployees).some(
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
                        <span>{t('직원')}</span>
                        <div>
                          {Array.from({ length: 13 }, (_, i) => (
                            <span key={i}>{String(i * 2).padStart(2, '0')}:00</span>
                          ))}
                        </div>
                      </div>
                      {[timelineDate].map((date) => {
                        const weekday = days[new Date(date + 'T12:00:00Z').getUTCDay()];
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
                                    .filter((s) => s.employeeId === e.id && s.date === date)
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
              </section>
            </TabsContent>
            {comingSoon('dashboard', LayoutDashboard, '대시보드', '오늘 근무자, 이번 주 근무시간과 인건비, 처리할 요청을 한 화면에 모아 보여줄 예정입니다.')}
            {comingSoon('training', GraduationCap, '교육', '교육 자료를 직원에게 배정하고 이수 여부를 확인하는 기능을 준비하고 있습니다.')}
            {comingSoon('hiring', BriefcaseBusiness, '채용', '지원자를 등록하고 면접·채용 단계를 관리하는 기능을 준비하고 있습니다.')}
            {comingSoon('logbook', BookOpen, '업무일지', '날짜별 운영 메모와 특이사항을 기록하고 팀과 공유하는 기능을 준비하고 있습니다.')}
            {comingSoon('help', CircleQuestionMark, '도움말', '스케줄 작성, 휴무·근무 가능 시간, 대체 근무 사용법 안내를 준비하고 있습니다.')}
{otherTabs}
            <footer>
              PELHAM SHIFT <span>{t('팀의 시간, 더 간편하게.')}</span>
            </footer>
          </main>
        </div>
      </Tabs>
      {dialogs}
    </div>
  );
}
