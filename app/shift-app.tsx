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
  Download,
  Mail,
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
  CircleQuestionMark,
  Timer,
  Radar,
  CalendarX,
  CalendarClock,
  Network,
  ArrowUpDown,
  LayoutGrid,
  UserPlus,
  ChevronDown,
  ArrowLeft,
  Clock,
  X,
  EyeOff,
  CheckCircle2,
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
import { Calendar } from '@/components/ui/calendar';
import { enUS } from 'date-fns/locale';
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
  paidRecords,
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
  payPeriodStart,
  payPeriodEnd,
  LOCATION,
  TIME_ZONE,
  areaList,
  roleList,
  roleLabel,
  roleTint,
  ROLE_GROUP_COLORS,
  hasRole,
  AREAS,
  HYBRID_ROLE,
  workplaceOf,
  nameKey,
  dueShifts,
  missedShifts,
  type Employee,
  type Message,
  type Shift,
  type State,
} from '@/lib/domain';
import { download } from '@/lib/importer';
import { notice } from '@/lib/notice';
import InstallQr from './install-qr';
import MonthSchedule from './month-schedule';
import DaySchedule from './day-schedule';
import WhosWorking from './whos-working';
import BirthLogin from './birth-login';
import LoginQr from './login-qr';
import { useLang } from './use-lang';
import { useIsMobile } from '@/hooks/use-mobile';
import PhoneSchedule from './phone-schedule';
import PhoneTeam from './phone-team';
import PunchLog from './punch-log';
import { savePunchPhoto } from './punch-photo-store';
import StaffSchedule from './staff-schedule';
import StaffMessaging from './staff-messaging';
import StaffTimesheets from './staff-timesheets';
import { PunchRoster, PunchPeriodBar } from './punch-roster';
import StaffClock from './staff-clock';
import { say } from './say';
import StaffMore, { type MoreItem } from './staff-more';
import TimePicker from './time-picker';
import GpsGuard, { useGps } from './gps-guard';
import { LAYOUT_KEY, readLayout, type Layout } from './layout-choice';
import { appAt } from './apps';
import { pushOn, relangPush, subscribePush } from '@/lib/push-client';
const minutesOf = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
// 폰 상단 바는 브랜드 대신 지금 보고 있는 화면 이름을 띄웁니다. 사이드바와 같은 말을 씁니다.
const TAB_LABELS: Record<string, string> = {
  home: 'tab::출퇴근',
  more: '더보기',
  timesheets: '내 근무표',
  dashboard: '대시보드',
  working: '근무 현황',
  schedule: '스케줄',
  // 메뉴에서는 뺐지만 스케줄 화면에서 열리므로 제목은 그대로 둡니다.
  timeoff: '휴무',
  availability: '근무 가능 시간',
  team: '팀',
  messages: '메시지',
  attendance: '출근 기록',
  payroll: '급여 관리',
  help: '도움말',
};
// 급여를 받아 보는 사람들. 관리자 화면의 '급여 이메일로 보내기' 가 이 이름으로 직원 명부를 찾아 받는 사람을 채웁니다.
// 주소를 여기에 박아 두지 않는 것은, 사람이 바뀌면 직원 관리의 이메일 한 칸만 고치면 되게 하기 위해서입니다.
const PAYROLL_MAIL_TO = ['Emiline', 'Bright', 'Francis'];

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
  { key: 'working', label: '근무 현황', Icon: Radar },
  { key: 'attendance', label: '출근 기록', Icon: Clock3 },
  { key: 'payroll', label: '급여 관리', Icon: Wallet },
  { key: 'messages', label: '메시지', Icon: MessageSquare },
  { key: 'team', label: '직원 관리', Icon: Users },
];
// 메뉴 목록이 아니라 직원이 머물 수 있는 화면의 명단입니다. 여기 없는 화면은
// 스케줄로 되돌립니다. 휴무와 근무 가능 시간은 메뉴에서 뺐어도 스케줄에서
// 열리므로 남겨 둡니다.
// 급여는 관리자만 봅니다. 직원은 '내 근무표'에서 자기 출퇴근을 확인하고 이의를 냅니다.
const employeeNav = new Set([
  'home',
  'more',
  'timesheets',
  'schedule',
  'timeoff',
  'availability',
  'attendance',
  'messages',
  'help',
]);
export default function ShiftApp() {
  const { t, lang, days, locale } = useLang();
  const [data, setData] = useState<State>(seed);
  const [week, setWeek] = useState(weekStart(localDate(new Date())));
  const [tab, setTab] = useState('schedule');
  // 스케줄은 오늘 하루부터 보여줍니다. 주간은 보기 메뉴에서 고릅니다.
  const [view, setView] = useState('day');
  // 직원 폰 화면의 상태: 스케줄의 '내 근무/전체', 메시지 탭, 지금 보고 있는 급여 기간.
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [msgTab, setMsgTab] = useState<'messages' | 'announcements'>('messages');
  const [sheet, setSheet] = useState('');
  // 앱 시계로 고치고 있는 시간 칸. 기기 기본 시간 선택창은 쓰지 않습니다.
  const [clockField, setClockField] = useState<{ key: string; label: string; step: number } | null>(null);
  // 근무지를 지정하는 동안 기기에 자리를 물어보는 중인지.
  const [locating, setLocating] = useState(false);
  // 근무지를 지정해 둔 곳에서는 앱을 여는 동안 위치를 계속 지켜봅니다.
  const gps = useGps();
  const [version, setVersion] = useState(0);
  const [team, setTeam] = useState('');
  const [actor, setActor] = useState({ id: 'admin', admin: true });
  const [setup, setSetup] = useState(true);
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>('loading');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [presets, setPresets] = useState(false);
  // 생년월일 달력. 열림 여부와 보고 있는 달은 모달을 열 때마다 초기화합니다.
  const [birthOpen, setBirthOpen] = useState(false);
  const [birthMonth, setBirthMonth] = useState<Date | undefined>();
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
  const [ui, setUi] = useState<Layout>('seven');
  const [offFilter, setOffFilter] = useState('pending');
  // 폰에서는 주간 표 대신 날짜별 목록을 그립니다. 첫 렌더는 서버와 같게 데스크톱으로 두고 마운트 뒤 바뀝니다.
  const phone = useIsMobile();
  // 폰에서는 팀이 목록과 한 사람 화면으로 갈립니다. 빈 값이면 목록입니다.
  const [teamPick, setTeamPick] = useState('');
  const [inapp, setInapp] = useState<Message | null>(null);
  // 저장이 끝났다는 말. 띠 한 줄이 아니라 오른쪽 아래 상자로 떠서, 대화상자가 닫힌 뒤에도 눈에 들어옵니다.
  // 실패는 지금까지처럼 statusbar 에 남깁니다 — 성공과 실패가 같은 자리에 같은 모양으로 뜨면 구분이 되지 않습니다.
  const [saved, setSaved] = useState('');
  const [payDetail, setPayDetail] = useState('');
  // 관리자 출근 기록: 어느 이름의 출근부를 어느 2주 기간으로 보고 있는지.
  // 로그인한 사람(actor)을 함께 들고 있어, 사람이 바뀌면 앞사람 출근부에 서 있지 않고 이름 목록부터 다시 엽니다.
  const [att, setAtt] = useState({ actor: '', who: '', from: '' });
  const seenMessages = useRef<Set<string>>(new Set());
  // 앱을 연 시각. 열기 전부터 쌓여 있던 메시지와 방금 온 메시지를 가릅니다.
  const bootedAt = useRef('');
  const chooseLayout = (next: Layout) => {
    setUi(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {}
  };
  const logout = async () => {
    await fetch('/api/birth-login', { method: 'DELETE' }).catch(() => 0);
    window.location.assign(window.location.pathname + query());
  };
  const [push, setPush] = useState<{ on: boolean; tickUrl?: string }>({
    on: false,
  });
  // 작업 지시 권한은 근무 편성까지 봅니다 — 근무를 넣고 고치고 지우고, 스케줄을 공개하고 내립니다.
  // 급여와 직원 정보는 그대로 관리자 몫이라, 그 둘은 계속 actor.admin 으로 가릅니다.
  const canSchedule =
    actor.admin || !!data.employees.find((e) => e.id === actor.id)?.taskManager;
  const staffReadOnly = !canSchedule;
  // 시급은 관리자에게만 내려오므로, 다른 사람에게는 0 원이 아니라 아예 보이지 않게 합니다.
  const showCost = actor.admin;
  // 폰으로 보는 직원. 스케줄·메시지·출퇴근이 전용 화면으로 갈립니다.
  const staffPhone = phone && !canSchedule;

  // 뒤로 가기는 앱을 닫지 않고 한 단계씩 되돌립니다.
  // 열려 있는 것부터 닫고, 그다음 지나온 화면을 되짚고, 마지막은 홈(스케줄)에 머뭅니다.
  const back = useRef({
    // 직원이 폰으로 보면 홈은 출퇴근 화면입니다. 관리자·데스크톱은 스케줄입니다.
    home: 'schedule',
    tab: 'schedule',
    modal: '',
    navOpen: false,
    payDetail: '',
    // 근무표 안에서 보고 있는 급여 기간. 뒤로 가기는 기간 목록으로 먼저 돌아갑니다.
    sheet: '',
    clock: false,
    // 팀에서 보고 있는 한 사람. 뒤로 가기는 이름 목록으로 먼저 돌아갑니다.
    teamPick: '',
    // 지나온 화면. 뒤로 가기로 옮긴 걸음은 다시 쌓지 않습니다.
    trail: [] as string[],
    popping: false,
  });
  useEffect(() => {
    back.current.home = staffPhone ? 'home' : 'schedule';
    back.current.modal = modal;
    back.current.navOpen = navOpen;
    back.current.payDetail = payDetail;
    back.current.sheet = sheet;
    back.current.teamPick = teamPick;
    back.current.clock = !!clockField;
  });
  useEffect(() => {
    const state = back.current;
    if (state.tab === tab) return;
    if (state.popping) state.popping = false;
    else state.trail.push(state.tab);
    state.tab = tab;
  }, [tab]);
  useEffect(() => {
    const state = back.current;
    // 되돌아갈 자리를 항상 하나 채워 둡니다. 이게 없으면 뒤로 가기가 앱을 닫습니다.
    const refill = () => window.history.pushState({ pelham: true }, '');
    refill();
    const step = () => {
      if (state.navOpen) return setNavOpen(false);
      if (state.payDetail) return setPayDetail('');
      if (state.clock) return setClockField(null);
      if (state.modal) return setModal('');
      // 근무표 화면에 있을 때만 한 걸음으로 칩니다. 다른 화면에서는 보이지 않는 값을 소비해 헛걸음이 됩니다.
      if (state.tab === 'timesheets' && state.sheet) return setSheet('');
      // 팀 화면에 있을 때만 한 걸음으로 칩니다. 다른 화면에서는 헛걸음이 됩니다.
      if (state.tab === 'team' && state.teamPick) return setTeamPick('');
      const previous = state.trail.pop();
      if (previous && previous !== state.tab) {
        state.popping = true;
        return setTab(previous);
      }
      if (state.tab !== state.home) {
        state.popping = true;
        return setTab(state.home);
      }
      // 홈에서는 더 되돌릴 곳이 없습니다. 자리만 다시 채우고 그대로 머뭅니다.
    };
    const onPop = () => {
      refill();
      step();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace') return;
      // 글자를 지우는 중이면 건드리지 않습니다.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      event.preventDefault();
      step();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
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
  // 30초마다 도는 불러오기입니다. 전파가 잠깐 끊긴 것까지 알리면, 브라우저가 던지는
  // 'Failed to fetch' 가 번역도 없이 띠에 박힌 채 남습니다 (lib/notice.ts).
  // 서버까지 닿아서 받은 말만 띄우고, 못 닿은 것은 다음 차례에 저절로 낫게 둡니다.
  async function refresh() {
    let reached = false;
    try {
      const r = await fetch('/api/workspace' + query());
      reached = true;
      const json = (await r.json()) as { error?: string };
      if (r.status === 401) {
        setAuth('out');
        return;
      }
      if (!r.ok) throw Error(json.error);
      setAuth('in');
      ingest(json);
      // 지난번에 띄운 말은 여기서 지웁니다. 그래야 한 번 뜬 띠가 계속 박혀 있지 않습니다.
      setStatus('');
    } catch (e) {
      setAuth((a) => (a === 'loading' ? 'out' : a));
      if (!reached) return;
      setStatus(notice(e, '불러오지 못했습니다.'));
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
    // 근무를 편성하지 않는 사람에게는 월간 한 장만 보여 줍니다. 편성하는 사람은 보기와 필터를 그대로 씁니다.
    if (!canSchedule) {
      setFilter('all');
      setView('month');
    }
    if (!actor.admin && !employeeNav.has(tab)) setTab('schedule');
  }, [actor.admin, canSchedule, tab]);
  // 게시 해제는 직원 화면에서 근무표가 통째로 사라지므로 한 번 묻습니다. 기록은 지워지지 않습니다.
  const unpublish = () => {
    if (
      confirm(
        t(
          '게시를 해제할까요? 근무표는 그대로 저장되지만 직원 화면에서는 사라집니다. 기록은 지워지지 않습니다.',
        )
      )
    )
      void command('unpublish');
  };
  async function command(type: string, payload: any = {}) {
    if (setup && type !== 'initialize') {
      setStatus(
        '먼저 워크스페이스를 생성하세요. 샘플 데이터는 저장되지 않습니다.',
      );
      return null;
    }
    setBusy(true);
    setStatus('');
    try {
      const r = await fetch('/api/workspace' + query(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload, version }),
      });
      const json = (await r.json()) as { error?: string; state?: State };
      if (!r.ok) throw Error(json.error);
      ingest(json);
      setModal('');
      setSaved('저장했습니다.');
      return json.state ?? null;
    } catch (e) {
      // 실패했을 때 직전 저장 상자가 남아 있으면 무엇이 들어갔는지 헷갈립니다. 상자를 걷고 띠만 남깁니다.
      setSaved('');
      setStatus(notice(e, '저장하지 못했습니다.'));
      return null;
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
        setPush({ on: await pushOn(), tickUrl: json.tickUrl });
      } catch {}
    })();
  }, [setup]);
  // Push text is chosen per device on the server, so re-register this device whenever its language changes.
  useEffect(() => {
    if (!push.on) return;
    void relangPush(query(), lang);
  }, [lang, push.on]);
  async function enablePush() {
    setBusy(true);
    try {
      await subscribePush(query(), lang);
      setPush((p) => ({ ...p, on: true }));
      setStatus(
        '이 기기에서 푸시 알림을 켰습니다. 출근 1시간 전 알림과 우천 공지를 받습니다.',
      );
    } catch (e) {
      setStatus(notice(e, '알림을 켜지 못했습니다.'));
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
      setStatus(notice(e, '테스트 알림을 보내지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  }
  const open = (kind: string, values: Record<string, string> = {}) => {
    setForm(values);
    setModal(kind);
    setStatus('');
    setBirthOpen(false);
    setBirthMonth(undefined);
  };
  const box = (e: Employee | undefined) =>
    e ? (
      <span className="person">
        <i style={{ background: e.color }} />
        <span style={{ color: roleTint(e) }}>{e.name}</span>
      </span>
    ) : (
      <span>{t('관리자')}</span>
    );
  const emp = (id: string) => data.employees.find((e) => e.id === id);
  // 삭제한 직원은 지난 기록을 위해 데이터에 남기고, 고르는 자리에서만 감춥니다.
  const staff = data.employees.filter((e) => !e.archived);
  const gone = data.employees.filter((e) => e.archived);
  const name = (id: string) => emp(id)?.name || t('관리자');
  // 감추는 삭제. 이름은 지난 근무·급여 기록에 그대로 남습니다.
  const removeEmployee = (e: Employee) => {
    if (
      confirm(
        t('{name} 직원을 삭제할까요? 지난 근무·급여 기록은 그대로 남고 목록에서만 사라집니다.', { name: e.name }),
      )
    ) {
      setTeamPick('');
      void command('employeeRemove', { id: e.id });
    }
  };
  // 지우는 삭제. 누르는 그 자리에서 지난 근무·출퇴근·급여·작업·메시지 기록까지 함께 사라지고 되돌릴 수 없습니다.
  const purgeEmployee = (e: Employee) => {
    setTeamPick('');
    void command('employeePurge', { id: e.id });
  };
  const options = staff.map((e) => ({
    value: e.id,
    label: e.name + ' · ' + e.id,
  }));
  // 대체 신청은 근무일 7일 전까지만 받습니다. 가까운 날짜만 남아 있으면 고를 근무가 하나도 없습니다.
  // 근무 길이를 대화상자에서 바로 보여 줍니다. 7shifts 의 (4 hrs) 표시와 같은 자리입니다.
  const shiftHours =
    /^\d{2}:\d{2}$/.test(form.start || '') && /^\d{2}:\d{2}$/.test(form.end || '')
      ? duration(form.start, form.end)
      : 0;
  const noteField = (
    <label className="field">
      {t('직원에게 남길 메모')}
      <textarea
        maxLength={250}
        value={form.note || ''}
        onChange={(e) => put('note', e.target.value)}
        placeholder={t('이 근무에서 알아야 할 내용을 적어주세요.')}
      />
      <small className="notecount">{250 - (form.note || '').length}</small>
    </label>
  );
  const clockText = (v: string) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return '';
    const h = Number(v.slice(0, 2));
    return `${h % 12 || 12}:${v.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const openClock = (key: string, label: string, step = 10) =>
    setClockField({ key, label, step });
  // 시간 칸은 눌리면 앱 시계를 엽니다. 값은 시계에서만 바뀌고, 비어 있으면 제출이 막힙니다.
  const timeInput = (key: string, label: string, step = 10) => (
    <input
      type="text"
      required
      inputMode="none"
      placeholder="--:--"
      className="timepick"
      value={clockText(form[key] || '')}
      aria-label={label}
      onKeyDown={(e) => {
        e.preventDefault();
        if (e.key === 'Enter' || e.key === ' ') openClock(key, label, step);
      }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => openClock(key, label, step)}
      onChange={() => undefined}
    />
  );
  // 이미 짜 놓은 근무에서 가장 자주 쓰인 시간대를 그대로 프리셋으로 씁니다.
  const commonTimes = [
    ...data.shifts
      .reduce((m, s) => m.set(s.start + '|' + s.end, (m.get(s.start + '|' + s.end) ?? 0) + 1), new Map<string, number>())
      .entries(),
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pair]) => pair.split('|'));
  const shiftBreak = Number(form.breakMinutes || 0);
  const paidHours = Math.max(0, shiftHours - shiftBreak / 60);
  const shiftTimes = (
    <>
      <div className="timerow">
        <span className="timebox">
          <Clock3 size={16} />
          {timeInput('start', t('시작 시간'))}
          <em>→</em>
          {timeInput('end', t('종료 시간'))}
          {paidHours > 0 && <b>{t('({n}시간)', { n: Math.round(paidHours * 100) / 100 })}</b>}
        </span>
      </div>
      {commonTimes.length > 0 && (
        <button type="button" className="linklike" onClick={() => setPresets((v) => !v)}>
          {t('자주 쓰는 시간대 고르기')}
        </button>
      )}
      {presets && (
        <div className="presetrow">
          {commonTimes.map(([a, b]) => (
            <button
              type="button"
              key={a + b}
              className="presetchip"
              onClick={() => {
                put('start', a);
                put('end', b);
                setPresets(false);
              }}
            >
              {a} – {b}
            </button>
          ))}
        </div>
      )}
      {form.breakMinutes ? (
        <label className="field breakfield">
          {t('휴게(분)')}
          <input
            type="number"
            min={0}
            max={720}
            value={form.breakMinutes}
            onChange={(e) => put('breakMinutes', e.target.value)}
          />
        </label>
      ) : (
        <button type="button" className="linklike plus" onClick={() => put('breakMinutes', '30')}>
          <Plus size={15} /> {t('휴게 추가')}
        </button>
      )}
    </>
  );
  // 매장 시각으로 본 오늘. 펀치·근무표·달력이 모두 이 날짜를 기준으로 삼습니다.
  const today = localDate(new Date(tick));
  // 오늘 내 펀치. 직원 화면의 출근·퇴근 버튼이 이것을 보고 갈립니다.
  const myPunch = [...(data.punches ?? [])]
    .reverse()
    .find((p) => p.employeeId === actor.id && p.date === today);
  // 출퇴근 화면이 띄우는 오늘 근무. 찍힌 출근 시각에 가장 가까운 근무를 고릅니다.
  const myShiftToday = data.shifts
    .filter((s) => s.employeeId === actor.id && s.date === today)
    .sort((a, b) =>
      myPunch
        ? Math.abs(minutesOf(a.start) - minutesOf(myPunch.in)) -
          Math.abs(minutesOf(b.start) - minutesOf(myPunch.in))
        : a.start.localeCompare(b.start),
    )[0];
  // 대체근무 요청이 오가는 중인 근무. 이때는 시간도 못 고치고 지우지도 못합니다.
  const swapBusy = (shiftId: string) =>
    data.swaps.some(
      (r) =>
        r.shiftId === shiftId &&
        (r.status === 'requested' || r.status === 'accepted'),
    );
  const swappable = data.shifts.filter(
    (s) => canSwap(s.date) && (actor.admin || s.employeeId === actor.id) && !s.originalId,
  );
  // 겸직하는 사람이 있어 직군은 사람 수보다 많을 수 있습니다 — 맡은 직군을 모두 펼쳐 모읍니다.
  const roles = [...new Set(staff.flatMap((e) => roleList(e)))].sort((a, b) =>
    a.localeCompare(b),
  );
  // 고를 수 있는 업무. 작업 화면에서 늘린 목록이 있으면 그것이고, 없으면 기본 두 가지입니다.
  const areas = areaList(data);
  // 명단에서 그 사람이 설 자리. 업무를 좁혀 보면 그 업무 아래, 전체로 보면 기본 업무 아래 한 번만 섭니다.
  const bandOf = (e: Employee) =>
    dept === 'all' ? roleList(e)[0] || '' : hasRole(e, dept) ? dept : '';
  const visibleEmployees = staff
    .filter(
      (e) =>
        (filter === 'all' || e.id === filter) &&
        (dept === 'all' || hasRole(e, dept)) &&
        e.name.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      ui === 'pelham'
        ? 0
        : sort === 'id'
          ? (a.punchId || '').localeCompare(b.punchId || '')
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
  // 저장 알림은 4초만 머뭅니다. 다음 저장이 들어오면 앞 타이머는 걷어 냅니다.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(''), 4000);
    return () => clearTimeout(timer);
  }, [saved]);
  // 앱을 열어 둔 동안 새 메시지가 오면 화면 안에 알림을 띄웁니다. 기기 푸시가 꺼져 있어도 보입니다.
  useEffect(() => {
    const booted = (bootedAt.current ||= new Date().toISOString());
    const fresh = unread.filter((m) => !seenMessages.current.has(m.id));
    if (!fresh.length) return;
    for (const m of fresh) seenMessages.current.add(m.id);
    setInapp(fresh[fresh.length - 1]);
    // 방금 온 메시지에만 한 마디 읽어 줍니다. 화면을 안 보고 있어도 새 메시지가 온 것을 압니다.
    // 열기 전부터 안 읽은 채 쌓여 있던 것까지 읽으면 앱을 열 때마다 소리가 나서, 그건 배너만 띄웁니다.
    // 아이폰은 앱을 연 뒤 아직 아무 곳도 누르지 않았으면 소리가 막힐 수 있습니다.
    if (fresh.some((m) => m.createdAt > booted)) say('pelham');
  }, [unreadKey]);
  // 설치한 앱 아이콘(배지), 브라우저 탭 제목과 파비콘에도 안 읽은 개수를 올립니다.
  useEffect(() => {
    const count = unread.length;
    // 제목도 파비콘도 지금 주소의 앱 것을 씁니다. 출퇴근 앱은 이름도 아이콘도 따로입니다.
    const self = appAt(window.location.pathname);
    // Next 가 기본 제목을 다시 써 넣는 경우가 있어, 제목이 바뀌면 개수를 다시 붙입니다.
    const wanted = (count ? '(' + count + ') ' : '') + t(self.title);
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
    // 앱을 닫아 둔 동안에는 서비스 워커가 푸시마다 숫자를 올립니다.
    // 화면이 열려 있는 동안에는 여기 개수가 맞으니, 0 일 때도 그 값을 보내 워커가 센 값을 맞춰 둡니다.
    const sync = () => {
      if (count) void badge.setAppBadge?.(count).catch(() => 0);
      else void badge.clearAppBadge?.().catch(() => 0);
      void navigator.serviceWorker
        ?.getRegistration()
        .then((reg) => (reg?.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'badge', count }))
        .catch(() => 0);
    };
    sync();
    // 알림을 받고 앱으로 돌아온 순간에도 맞춥니다. 안 읽은 글이 없으면 그때 숫자가 사라집니다.
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
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
    const stop = () => {
      document.removeEventListener('visibilitychange', onVisible);
      watcher.disconnect();
    };
    if (!count) {
      paint(self.icon);
      return stop;
    }
    let live = true;
    const icon = new Image();
    icon.src = self.icon;
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
      stop();
    };
  }, [unread.length, t]);
  // 기호로 쓰면 CAD 와 USD 가 똑같이 $ 로 보입니다. 어느 나라 돈인지 드러나게 통화 코드로 적습니다.
  const money = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: data.currency,
      currencyDisplay: 'code',
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
  // 급여 상세. 고른 구간의 출근기록을 날짜순으로 펼치고, 그 옆에 예정 근무·지각·그날 금액을 같이 둡니다.
  // 상세도 합계와 같은 기록을 봐야 합니다. 둘이 다른 데이터를 쓰면 숫자가 어긋납니다.
  const payDays = (employeeId: string) => {
    // 지각 차감도 합계가 쓴 값을 그대로 가져옵니다. 화면에서 다시 계산하면 열을 더한 값이 아래 합계와 어긋납니다.
    const deductions = new Map(
      payroll(data, employeeId, from, to).lates.map((r) => [r.id, r.deduction]),
    );
    return paidRecords(data)
      .filter((a) => a.employeeId === employeeId && a.date >= from && a.date <= to)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
      .map((a) => ({
        a,
        shift: scheduledFor(data, a),
        worked: duration(a.start, a.end, a.breakMinutes),
        late: lateBy(data, a),
        lateDeduction: deductions.get(a.id) ?? 0,
      }));
  };
  // 초과근무가 어떤 근거로 잡혔는지. 하루 8시간 초과분의 합과 주 40시간 초과분 중 큰 쪽만 가산합니다.
  const payWeeks = (employeeId: string) => {
    const byDay = new Map<string, number>();
    for (const r of payDays(employeeId))
      byDay.set(r.a.date, (byDay.get(r.a.date) ?? 0) + r.worked);
    const weeks = new Map<string, number[]>();
    for (const [day, h] of byDay)
      weeks.set(weekStart(day), [...(weeks.get(weekStart(day)) ?? []), h]);
    return [...weeks.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, days]) => {
        const daily = days.reduce((n, h) => n + Math.max(0, h - OT_DAILY_HOURS), 0);
        const worked = days.reduce((n, h) => n + h, 0);
        const weekly = Math.max(0, worked - OT_WEEKLY_HOURS);
        return { week, worked, daily, weekly, applied: Math.max(daily, weekly) };
      });
  };
  const totals = data.employees.map((e) => ({
    e,
    ...payroll(data, e.id, from, to),
  }));
  const visibleTotals = totals.filter(
    (row) => actor.admin || row.e.id === actor.id,
  );
  // 화면에 뜬 사람들 몫을 합친 확인 현황.
  const payCheck = visibleTotals.reduce(
    (n, r) => ({
      unconfirmed: n.unconfirmed + r.unconfirmed,
      disputed: n.disputed + r.disputed,
    }),
    { unconfirmed: 0, disputed: 0 },
  );
  const input = (
    key: string,
    label: string,
    type = 'text',
    required = true,
  ) =>
    type === 'time' ? (
      <label className="field">
        {label}
        {timeInput(key, label)}
      </label>
    ) : (
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
  // 생년월일은 달력에서 고릅니다. 저장 형식은 지금까지와 같은 8자리(YYYYMMDD)라 로그인 쪽은 손대지 않았습니다.
  // 시간대가 하루씩 밀리지 않도록 UTC 를 거치지 않고 연·월·일을 그대로 읽고 씁니다.
  const birthDate = (v: string) =>
    /^\d{8}$/.test(v)
      ? new Date(Number(v.slice(0, 4)), Number(v.slice(4, 6)) - 1, Number(v.slice(6)))
      : undefined;
  const birthDigits = (d: Date) =>
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const birthField = (label: string) => {
    const picked = birthDate(form.birthDate || '');
    return (
      <div className="field birthfield">
        {label}
        <button
          type="button"
          className="birthtrigger"
          aria-expanded={birthOpen}
          onClick={() => setBirthOpen((v) => !v)}
        >
          <CalendarDays size={16} />
          <span>
            {picked
              ? picked.toLocaleDateString(locale, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : t('달력에서 고르세요')}
          </span>
          <ChevronDown size={16} />
        </button>
        {birthOpen && (
          <Calendar
            className="birthcalendar"
            mode="single"
            locale={enUS}
            captionLayout="dropdown"
            startMonth={new Date(1930, 0)}
            endMonth={new Date()}
            month={birthMonth ?? picked ?? new Date(1980, 0)}
            onMonthChange={setBirthMonth}
            selected={picked}
            onSelect={(chosen) => {
              if (!chosen) return;
              put('birthDate', birthDigits(chosen));
              setBirthOpen(false);
            }}
          />
        )}
        {picked && (
          <button
            type="button"
            className="linklike"
            onClick={() => {
              put('birthDate', '');
              setBirthMonth(undefined);
            }}
          >
            {t('생년월일 지우기')}
          </button>
        )}
      </div>
    );
  };
  // 직원의 업무와 근무의 장소는 같은 목록에서 고릅니다. 예전에 저장된 값이 목록에 없을 수 있어, 그 값도 선택지에 함께 둡니다.
  // 일괄 수정의 '유지'는 빈 값으로 보내지만 빈 값은 고른 것이 없는 상태로 표시되어, 표식을 따로 씁니다.
  const KEEP_AREA = '__keep';
  const areaPick = (
    key: string,
    label: string,
    blank = '',
    list: readonly string[] = areas,
  ) => {
    const current = form[key] || '';
    return (
      <Pick
        label={label}
        value={current || (blank ? KEEP_AREA : '')}
        onChange={(v) => put(key, v === KEEP_AREA ? '' : v)}
        options={[
          ...(blank ? [{ value: KEEP_AREA, label: blank }] : []),
          ...list.map((area) => ({ value: area, label: area })),
          ...(current && !list.some((area) => area === current)
            ? [{ value: current, label: current }]
            : []),
        ]}
      />
    );
  };
  // 직군은 겸할 수 있습니다 — Proshop 과 Workshop 을 함께 뛰는 사람은 Hybrid 한 칸으로 고릅니다.
  // 먼저 고른 업무가 기본 업무가 되어, 새 근무와 출퇴근 기록에 장소로 적힙니다.
  const rolePick = () => {
    const picked = (form.roles ?? form.role ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    // 예전에 저장된 업무가 목록에서 빠졌을 수 있어, 그 값도 선택지에 함께 둡니다.
    const list = [...areas, ...picked.filter((role) => !areas.includes(role))];
    const toggle = (role: string, on: boolean) => {
      const next = on ? [...picked, role] : picked.filter((r) => r !== role);
      put('roles', next.join(','));
      put('role', next[0] ?? '');
    };
    // Hybrid 는 새 업무 이름이 아니라 Proshop 과 Workshop 을 한 번에 켜고 끄는 칸입니다.
    // 저장되는 값은 지금까지와 같은 두 업무라, 업무로 거르는 화면과 예전 기록이 그대로 맞물립니다.
    const base = [...AREAS] as string[];
    const bothListed = base.every((role) => list.includes(role));
    const hybrid = base.every((role) => picked.includes(role));
    const toggleHybrid = (on: boolean) => {
      const rest = picked.filter((role) => !base.includes(role));
      const next = on ? [...base, ...rest] : rest;
      put('roles', next.join(','));
      put('role', next[0] ?? '');
    };
    return (
      <fieldset className="recipients">
        <legend>{t('업무 (겸직이면 여러 개를 고릅니다)')}</legend>
        <div className="recipientlist">
          {list.map((role) => (
            <label className="recipient" key={role}>
              <Checkbox
                checked={picked.includes(role)}
                onCheckedChange={(on) => toggle(role, on === true)}
              />
              <span style={{ color: ROLE_GROUP_COLORS[role as keyof typeof ROLE_GROUP_COLORS] }}>{role}</span>
            </label>
          ))}
          {bothListed && (
            <label className="recipient" key={HYBRID_ROLE}>
              <Checkbox
                checked={hybrid}
                onCheckedChange={(on) => toggleHybrid(on === true)}
              />
              <span style={{ color: ROLE_GROUP_COLORS.Hybrid }}>{HYBRID_ROLE}</span>
            </label>
          )}
        </div>
        <p className="hint">
          {hybrid
            ? t('{roles} 를 함께 맡는 Hybrid 입니다. 먼저 고른 {main} 이 새 근무의 기본 업무가 됩니다.', {
                roles: base.join(' · '),
                main: picked[0],
              })
            : picked.length > 1
              ? t('{roles} 를 함께 맡습니다. 먼저 고른 {main} 이 새 근무의 기본 업무가 됩니다.', {
                  roles: picked.join(' · '),
                  main: picked[0],
                })
              : t('두 업무를 함께 뛰면 Hybrid 를 고르세요. 먼저 고른 업무가 새 근무의 기본이 됩니다.')}
        </p>
      </fieldset>
    );
  };
  const rainTargets = (form.targets || '').split(',').filter(Boolean);
  const rainAll =
    staff.length > 0 && staff.every((e) => rainTargets.includes(e.id));
  const toggleRain = (id: string, on: boolean) =>
    put(
      'targets',
      staff
        .map((e) => e.id)
        .filter((v) => (v === id ? on : rainTargets.includes(v)))
        .join(','),
    );
  // 아직 공개하지 않은 근무 수. 공개는 워크스페이스 전체 스위치라 보고 있는 주가 아니라
  // 전체를 셉니다 — 버튼에 적힌 수가 곧 누르면 공개될 근무 수입니다.
  const drafts = data.shifts.filter((s) => s.draft).length;
  // 띄울지 말지는 한 곳에서 정합니다 — 띄우는 자리와, 목록 끝이 가리지 않게 둘 여백이 같은 답을 봐야 합니다.
  const publishBar = phone && canSchedule && tab === 'schedule' && drafts > 0;
  // 출근 알림 띠. 시작 1시간 전부터 뜨고, 출근을 찍으면 사라집니다 — 이미 찍은 사람에게는 할 말이 없습니다.
  // 찍지 않은 채 시작 시각이 지나면 깜빡한 것으로 보고 한 번 더, 이번에는 출근이 비었다는 말로 띄웁니다.
  // 띠와 푸시가 같은 함수를 봐서, 화면에 뜬 것과 기기로 간 것이 어긋나지 않습니다.
  const forMe = (list: Shift[]) => list.filter((s) => s.employeeId === actor.id);
  const reminders = [
    ...forMe(dueShifts(data, new Date(tick))).map((s) => ({
      shift: s,
      missed: false,
    })),
    ...forMe(missedShifts(data, new Date(tick))).map((s) => ({
      shift: s,
      missed: true,
    })),
  ];
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'show_staff_schedule',
            // MCP 도구 설명은 t() 를 거치지 않고 클라이언트에 그대로 전달됩니다.
            title: 'Show staff schedule',
            description:
              'Opens the weekly schedule view for the chosen employee. It changes no saved data.',
            inputSchema: {
              type: 'object',
              properties: { employeeId: { type: 'string' } },
              required: ['employeeId'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: (input: any) => {
              if (!data.employees.some((e) => e.id === input.employeeId))
                throw Error('No such employee ID.');
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
  // 직원에게 나눠 줄 로그인 안내. 이름과 직원 ID 만 담습니다 — 그 번호가 곧 비밀번호입니다.
  function exportLogins() {
    const safe = (v: string) =>
      '"' + (/^[=+@-]/.test(v) ? "'" : '') + v.replaceAll('"', '""') + '"';
    const csv = [
      ['이름', '직원 ID', '업무'].map((h) => t(h)),
      ...staff.map((e) => [e.name, e.punchId || t('미등록'), roleLabel(e)]),
    ]
      .map((r) => r.map((v) => safe(String(v))).join(','))
      .join('\r\n');
    download(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
      t('직원ID_') + localDate(new Date()) + '.csv',
    );
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
  // 급여 담당자에게 보내는 메일. 메일 앱은 파일을 스스로 붙이지 못해, CSV 를 먼저 내려받고 초안을 띄웁니다.
  // 받는 사람은 PAYROLL_MAIL_TO 의 이름을 직원 명부에서 찾아 그 사람의 이메일로 채웁니다.
  function mailPayroll() {
    const wanted = PAYROLL_MAIL_TO.map((label) => ({
      label,
      email:
        data.employees.find(
          (e) => !e.archived && nameKey(e.name) === nameKey(label),
        )?.email || '',
    }));
    const sendTo = wanted.filter((w) => w.email).map((w) => w.email);
    const missing = wanted.filter((w) => !w.email).map((w) => w.label);
    // 한 사람도 찾지 못하면 메일 앱을 열어 봐야 헛걸음입니다. 어디를 고쳐야 하는지만 알려 줍니다.
    if (!sendTo.length) {
      setStatus(
        t('급여를 보낼 주소가 없습니다. 직원 관리에서 {names} 의 이메일을 먼저 등록하세요.', {
          names: missing.join(', '),
        }),
      );
      return;
    }
    // 본문은 CSV 와 같은 totals 를 봅니다. 화면 필터로 걸러진 값을 쓰면 줄의 합과 합계가 어긋납니다.
    const rows = totals.filter((r) => r.hours > 0 || r.total !== 0);
    const sum = money(rows.reduce((n, r) => n + r.total, 0));
    const head = t('{from} ~ {to} 기간의 예상 급여입니다.', { from, to });
    const tail = t('사람별 자세한 내역은 함께 보내는 CSV 파일에 있습니다.');
    const link = (lines: string[]) =>
      'mailto:' +
      sendTo.join(',') +
      '?subject=' +
      encodeURIComponent(t('예상 급여 {from} ~ {to}', { from, to })) +
      '&body=' +
      encodeURIComponent(lines.join('\n'));
    let url = link([
      head,
      '',
      ...rows.map((r) => r.e.name + ' · ' + r.hours.toFixed(2) + 'h · ' + money(r.total)),
      '',
      t('급여 합계') + ' ' + sum,
      '',
      tail,
    ]);
    // 주소가 길면 본문을 잘라 버리는 메일 앱이 있습니다. 사람별 줄은 CSV 에 그대로 있으니 합계만 남깁니다.
    if (url.length > 1800) url = link([head, '', t('급여 합계') + ' ' + sum, '', tail]);
    exportPayroll();
    window.location.assign(url);
    setStatus(
      t('급여 CSV 를 내려받았습니다. 열린 메일 초안에 그 파일을 첨부해 보내세요.') +
        (missing.length
          ? ' ' +
            t('{names} 는 등록된 이메일이 없어 받는 사람에서 빠졌습니다.', {
              names: missing.join(', '),
            })
          : ''),
    );
  }
  if (auth !== 'in')
    return (
      <div className="login-screen">
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
                  // 기본 화면(pelham-shifts)은 잠시 감춰 두었습니다. 줄을 되살리면 다시 고를 수 있습니다.
                  ['seven', '1', '8 shift', t('왼쪽 메뉴 · 근무 현황과 하루 보기')],
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
            <LoginQr />
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
  const staffList = actor.admin ? staff : staff.filter((e) => e.id === actor.id);
  const openTimeOff = () =>
    open('timeOffRequest', {
      employeeId: actor.admin ? staff[0]?.id || '' : actor.id,
      from: leadDate(),
      to: leadDate(),
      allDay: '1',
      start: '09:00',
      end: '13:00',
      reason: '',
    });
  const openAvailability = (weekday = '1', employeeId = '') =>
    open('availabilitySet', {
      employeeId: employeeId || (actor.admin ? staff[0]?.id || '' : actor.id),
      weekday,
      allDay: '1',
      start: '09:00',
      end: '13:00',
      note: '',
    });
  // 출근 기록 화면이 보는 범위. 관리자는 고른 이름 + 2주 기간, 직원은 언제나 자기 기록입니다.
  const attMine = att.actor === actor.id;
  const attWho = attMine ? att.who : '';
  const attFrom = (attMine && att.from) || payPeriodStart(today);
  const attTo = payPeriodEnd(attFrom);
  const inAtt = (employeeId: string, date: string) =>
    actor.admin
      ? employeeId === attWho && date >= attFrom && date <= attTo
      : employeeId === actor.id;
  const attPunches = (data.punches ?? []).filter((p) => inAtt(p.employeeId, p.date));
  const attClock = data.attendance.filter((a) => inAtt(a.employeeId, a.date));
  // 이름 목록. 퇴사자도 남은 기록이 있으면 세웁니다 — 여기는 지난 기록을 읽는 자리라 감추면 닿을 길이 없습니다.
  const attRoster = data.employees.filter(
    (e) =>
      !e.archived ||
      (data.punches ?? []).some((p) => p.employeeId === e.id) ||
      data.attendance.some((a) => a.employeeId === e.id),
  );
  const otherTabs = (
    <>
            <TabsContent value="working">
              <div className="panel contentpanel">
                <div className="sectionhead">
                  <div>
                    <h2>{t('근무 현황')}</h2>
                    <p>{t('오늘 누가 나와 있는지 출근 순서대로 봅니다. 실제 출근 기록이 아니라 예정된 근무 기준입니다.')}</p>
                  </div>
                </div>
                {/* 관리자가 대신 찍어 주는 버튼은 잠시 감춰 둡니다. canPunchOthers 를 actor.admin 으로 되돌리면 다시 나옵니다. */}
                <WhosWorking
                  date={day}
                  now={tick}
                  employees={staff}
                  shifts={data.shifts}
                  punches={data.punches ?? []}
                  canPunchOthers={false}
                  busy={busy}
                  onShiftSelect={(id) => open('detail', { id })}
                  onPunch={(employeeId, kind) => void command(kind, { employeeId })}
                />
              </div>
            </TabsContent>
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
                  <h2>{actor.admin ? t('출근 기록') : t('내 출근 기록')}</h2>
                  <p>
                    {actor.admin
                      ? t('이름을 고르면 그 사람 출근부를 2주 급여 기간씩 봅니다.')
                      : t('출근기계 기록을 읽기 전용으로 확인합니다.')}
                  </p>
                </div>
              </div>
              {!actor.admin && (
                <div className="punchcard">
                  <div>
                    <b>
                      {myPunch
                        ? myPunch.out
                          ? t('오늘 퇴근까지 찍었습니다.')
                          : t('출근으로 찍혀 있습니다.')
                        : t('아직 출근을 찍지 않았습니다.')}
                    </b>
                    <span>
                      {myPunch
                        ? myPunch.out
                          ? myPunch.in + ' → ' + myPunch.out
                          : myPunch.in + t(' 출근')
                        : t('일을 시작할 때 눌러주세요. 찍히는 시각은 매장 서버 시각입니다.')}
                    </span>
                  </div>
                  <button
                    className="button primary"
                    disabled={busy || Boolean(myPunch?.out)}
                    onClick={() =>
                      void command(myPunch && !myPunch.out ? 'punchOut' : 'punchIn', {})
                    }
                  >
                    {myPunch?.out ? t('완료') : myPunch ? t('퇴근 찍기') : t('출근 찍기')}
                  </button>
                </div>
              )}
              {actor.admin && !attWho ? (
                <>
                  <h3 className="punchlog-head">{t('직원별 출근 기록')}</h3>
                  <PunchRoster
                    employees={attRoster}
                    punches={data.punches ?? []}
                    today={today}
                    onPick={(who) =>
                      setAtt({ actor: actor.id, who, from: payPeriodStart(today) })
                    }
                  />
                </>
              ) : (
                <>
                  {actor.admin && (
                    <PunchPeriodBar
                      employee={emp(attWho)}
                      rows={attPunches}
                      from={attFrom}
                      today={today}
                      onBack={() => setAtt({ actor: actor.id, who: '', from: '' })}
                      onPeriod={(start) => setAtt({ actor: actor.id, who: attWho, from: start })}
                    />
                  )}
                  <h3 className="punchlog-head">{t('찍힌 출퇴근')}</h3>
                  {/* 한 사람 출근부를 보는 중이면 카드마다 같은 이름을 붙일 까닭이 없습니다. */}
                  <PunchLog
                    punches={attPunches}
                    employees={data.employees}
                    isAdmin={actor.admin && !attWho}
                  />
                  <h3 className="punchlog-head">{t('출근기계에서 가져온 기록')}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          // 한 사람 출근부를 보는 중이면 이름 칸은 같은 이름만 되풀이해 빼 둡니다.
                          ...(attWho ? [] : ['직원']),
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
                      {attClock.map((a) => {
                          // 예정 근무가 없는 기록은 지각 기준이 없어 '정시'가 아니라 '예정 없음'입니다.
                          const planned = scheduledFor(data, a);
                          const late = lateBy(data, a);
                          return (
                            <TableRow key={a.id}>
                              {!attWho && <TableCell>{box(emp(a.employeeId))}</TableCell>}
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
                  {!attClock.length && (
                    <div className="empty">
                      {actor.admin
                        ? t('이 기간에 출근기계 기록이 없습니다.')
                        : t('아직 저장된 출근기록이 없습니다.')}
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
          <TabsContent value="payroll">
            <div className="panel contentpanel">
              <div className="sectionhead">
                <div>
                  <h2>{t('예상 급여')}</h2>
                  <p>
                    {t(
                      '정규 {r}시간까지 시급 × 실근무, 초과분 {m}배 가산, 체크인별 지각 차감, 승인된 대체 추가수당',
                      { r: OT_WEEKLY_HOURS, m: OT_MULTIPLIER },
                    )}
                  </p>
                </div>
                {actor.admin && (
                  <button className="button" onClick={exportPayroll}>
                    <Download size={16} /> {t('CSV 다운로드')}
                  </button>
                )}
                {/* 급여는 늘 같은 사람들에게 갑니다. 주소를 다시 적지 않도록 버튼 하나에 담아 둡니다. */}
                {actor.admin && (
                  <button
                    className="button"
                    onClick={mailPayroll}
                    title={t('받는 사람: {names}', { names: PAYROLL_MAIL_TO.join(', ') })}
                  >
                    <Mail size={16} /> {t('급여 이메일로 보내기')}
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
              {/* 지급 전에 알아야 할 숫자입니다. 아직 본 사람이 없는 기록과, 직원이 틀렸다고 한 기록은 뜻이 다릅니다. */}
              {(payCheck.unconfirmed > 0 || payCheck.disputed > 0) && (
                <div className="statusbar payreview">
                  <span>
                    {payCheck.disputed > 0 &&
                      t('직원이 이의를 제기한 근무 {n}건이 이 금액에 들어 있습니다. ', {
                        n: payCheck.disputed,
                      })}
                    {payCheck.unconfirmed > 0 &&
                      t('아직 아무도 확인하지 않은 근무 {n}건이 있습니다. ', {
                        n: payCheck.unconfirmed,
                      })}
                    {t('지급 전에 출근 기록에서 확인하세요.')}
                  </span>
                  <button className="button" onClick={() => setTab('attendance')}>
                    {t('출근 기록 보기')}
                  </button>
                </div>
              )}
              <div className="policy">
                {t(
                  '지급액은 단말에서 찍힌 출퇴근을 기준으로 계산합니다. 유급 휴게는 근무로 치고 무급 휴게만 뺍니다. 그 사람 그 날짜에 찍힌 기록이 없을 때만 예전에 가져온 기록을 씁니다. 초과근무는 하루 {d}시간 초과분과 한 주(일요일 시작) {w}시간 초과분 중 큰 쪽만 {m}배로 가산합니다. 지각은 체크인 하나하나 따로 보아 예정 출근 시각을 넘긴 분만큼 그 체크인에서 번 금액까지만 차감하며, 예정 근무가 없는 출근기록은 지각으로 보지 않습니다. 세금·유급휴가를 제외한 예상 금액이고, 시급 0인 직원은 지급액 확인이 필요합니다. 원근무자의 예정 시간은 지급 대상이 아니며 실제 출근기록만 지급합니다.',
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
                      <TableRow
                        key={r.e.id}
                        className="rowlink"
                        role="button"
                        tabIndex={0}
                        title={t('날짜별 상세 보기')}
                        onClick={() => setPayDetail(r.e.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setPayDetail(r.e.id);
                          }
                        }}
                      >
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
                  '온타리오 현지 날짜 기준, 근무일 7일 전까지 신청과 승인을 완료하세요. 기존 근무와 겹치는 대체는 차단됩니다.',
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
            {staffPhone ? (
              <StaffMessaging
                me={actor.id}
                tab={msgTab}
                messages={data.messages.filter(
                  (m) =>
                    m.to !== 'all' ||
                    !m.recipients ||
                    m.recipients.includes(actor.id),
                )}
                employees={staff}
                teammates={
                  new Set(
                    data.shifts
                      .filter((x) => x.date === today && x.employeeId !== actor.id)
                      .map((x) => x.employeeId),
                  ).size
                }
                onTabChange={setMsgTab}
                onCompose={() => open('message', { to: 'admin', body: '' })}
                onShoutOut={() =>
                  open('message', { to: 'admin', body: t('오늘 고마웠던 동료: ') })
                }
                onOpen={(id) => void command('read', { id })}
              />
            ) : (
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
                          timeZone: TIME_ZONE,
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
                                staff.some((e) => e.id === id) &&
                                (m.recipients?.includes(id) ?? true),
                            ).length,
                            total: m.recipients?.length ?? staff.length,
                            names: staff
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
                          {(m.to === 'admin'
                            ? m.readBy.some((id) => emp(id)?.admin)
                            : m.readBy.includes(m.to))
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
                      {/* 받는 사람만 누를 수 있습니다. 관리자에게 온 메시지는 to 가 'admin' 이라 관리자면 받는 사람입니다. */}
                      {!m.readBy.includes(actor.id) &&
                        (m.to === 'all'
                          ? !m.recipients || m.recipients.includes(actor.id)
                          : m.to === 'admin'
                            ? actor.admin
                            : m.to === actor.id) && (
                        <button
                          disabled={busy}
                          className="button"
                          onClick={() => command('read', { id: m.id })}
                        >
                          <Check size={14} /> {t('확인했습니다')}
                        </button>
                      )}
                      {/* 메시지 삭제는 관리자만 보입니다. 서버에서도 관리자만 통과시킵니다. */}
                      {actor.admin && (
                        <button
                          disabled={busy}
                          className="button"
                          onClick={() => {
                            if (confirm(t('이 메시지를 삭제할까요? 직원 화면에서도 사라집니다.')))
                              void command('messageRemove', { id: m.id });
                          }}
                        >
                          <X size={14} /> {t('삭제')}
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
            )}
          </TabsContent>
          <TabsContent value="team">
            {phone ? (
              <PhoneTeam
                employees={staff}
                archived={data.employees.filter((e) => e.archived)}
                location={LOCATION}
                meId={actor.id}
                busy={busy}
                teamLink={
                  setup || typeof window === 'undefined'
                    ? ''
                    : window.location.origin + '/?team=' + encodeURIComponent(team)
                }
                money={money}
                picked={teamPick}
                onPick={setTeamPick}
                onAdd={() =>
                  open('employee', {
                    name: '',
                    phone: '',
                    email: '',
                    rate: '0',
                    color: '#087e6d',
                    role: areas[0],
                    roles: areas[0],
                  })
                }
                onEdit={(e) =>
                  open('employee', {
                    ...e,
                    rate: String(e.rate),
                    roles: roleList(e).join(','),
                    taskManager: e.taskManager ? '1' : '',
                    overtimeManager: e.overtimeManager ? '1' : '',
                    admin: e.admin ? '1' : '',
                    archived: e.archived ? '1' : '',
                  })
                }
                onMessage={(e) => open('message', { to: e.id, body: '' })}
                onRemove={removeEmployee}
                onPurge={purgeEmployee}
              />
            ) : (
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
                      role: areas[0],
                      roles: areas[0],
                    })
                  }
                >
                  <Plus size={16} /> {t('직원 추가')}
                </button>
                {/* 번호가 곧 비밀번호라, 나눠 줄 목록을 여기서 바로 뽑습니다. */}
                <button
                  className="button"
                  disabled={busy || !staff.some((e) => !e.punchId)}
                  onClick={() => void command('employeeIds')}
                  title={t('번호가 없는 직원에게 1001부터 차례로 내어 줍니다.')}
                >
                  <UserPlus size={16} /> {t('직원 ID 일괄 발급')}
                </button>
                <button className="button" onClick={exportLogins}>
                  <Download size={16} /> {t('로그인 목록 내려받기')}
                </button>
              </div>
              <div className="filterbar">
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
                      {t('직원은 로그인 화면에서 자기 이름을 골라 로그인합니다. 첫 비밀번호는 본인 직원 ID 이며, 직원이 직접 변경할 수 있습니다.')}
                    </small>
                  </div>
                )}
                {/* 출퇴근을 찍을 수 있는 자리. 끌 수는 없고, 풀면 클럽 기본 자리(1km)로 돌아갑니다. */}
                <div className="teamlink">
                  <b>{t('출퇴근 가능 위치')}</b>
                  <span className="workplace">
                    <button
                      className="button"
                      disabled={busy || locating}
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setStatus('이 기기는 위치를 알려주지 않습니다.');
                          return;
                        }
                        setLocating(true);
                        navigator.geolocation.getCurrentPosition(
                          (spot) => {
                            setLocating(false);
                            void command('workplace', {
                              lat: String(spot.coords.latitude),
                              lng: String(spot.coords.longitude),
                              radius: String(workplaceOf(data).radius),
                            });
                          },
                          () => {
                            setLocating(false);
                            setStatus('위치를 확인하지 못했습니다. 위치 권한을 허용하고 다시 눌러주세요.');
                          },
                          { enableHighAccuracy: true, timeout: 12000 },
                        );
                      }}
                    >
                      <MapPin size={16} />{' '}
                      {locating ? t('위치를 확인하는 중입니다…') : t('지금 내 위치로 지정')}
                    </button>
                    <label>
                      {t('반경(m)')}
                      <input
                        type="number"
                        min={50}
                        max={2000}
                        step={50}
                        key={workplaceOf(data).radius}
                        defaultValue={workplaceOf(data).radius}
                        onBlur={(e) =>
                          void command('workplace', {
                            lat: String(workplaceOf(data).lat),
                            lng: String(workplaceOf(data).lng),
                            radius: e.target.value,
                          })
                        }
                      />
                    </label>
                    {/* 기본 자리로 되돌리기. 직접 잡아 둔 자리가 있을 때만 보입니다 — 끄기가 아닙니다. */}
                    {data.workplace && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => void command('workplace', { clear: '1' })}
                      >
                        {t('기본 위치로')}
                      </button>
                    )}
                  </span>
                  <small>
                    {t('근무지에서 {n}m 안에서만 출퇴근이 찍힙니다. 위도 {lat}, 경도 {lng}', {
                      n: workplaceOf(data).radius,
                      lat: workplaceOf(data).lat.toFixed(5),
                      lng: workplaceOf(data).lng.toFixed(5),
                    })}{' '}
                    {!data.workplace &&
                      t('클럽 자리(196 Webber Rd, Welland)가 기본값입니다. 근무지에서 위 버튼을 누르면 그 자리로 바뀝니다.')}
                  </small>
                </div>
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
              {/* 이름 열과 수정·삭제 열, 제목 줄을 고정해 가로로 밀어도 늘 보이게 합니다. */}
              <div className="stafftable">
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
                  {staff.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{box(e)}</TableCell>
                      <TableCell>
                        {e.punchId || <span className="muted">{t('미등록')}</span>}
                      </TableCell>
                      <TableCell>
                        {roleLabel(e)}
                        {e.admin && (
                          <span className="badge taskbadge">{t('관리자')}</span>
                        )}
                        {e.taskManager && (
                          <span className="badge taskbadge">{t('작업 지시')}</span>
                        )}
                        {e.overtimeManager && (
                          <span className="badge taskbadge">{t('초과 근무')}</span>
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
                              roles: roleList(e).join(','),
                              taskManager: e.taskManager ? '1' : '',
                              overtimeManager: e.overtimeManager ? '1' : '',
                              admin: e.admin ? '1' : '',
                              archived: e.archived ? '1' : '',
                            })
                          }
                        >
                          {t('수정')}
                        </button>
                        <button
                          className="button"
                          disabled={busy || e.id === actor.id}
                          onClick={() => removeEmployee(e)}
                        >
                          {t('삭제')}
                        </button>
                        {/* 감추는 삭제 옆의 지우는 삭제. 묻지 않고 그 자리에서 기록까지 지웁니다. */}
                        <button
                          className="button danger"
                          disabled={busy || e.id === actor.id}
                          onClick={() => purgeEmployee(e)}
                        >
                          {t('완전 삭제')}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              {/* 보관된 직원은 목록에서만 감춘 사람들입니다. 여기서만 흔적까지 지울 수 있습니다. */}
              {gone.length > 0 && (
                <>
                  <div className="sectionhead">
                    <div>
                      <h2>{t('보관된 직원')}</h2>
                      <p>{t('삭제해 목록에서 감춘 직원입니다. 지난 근무·급여 기록은 아직 남아 있습니다.')}</p>
                    </div>
                  </div>
                  <div className="stafftable">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {['직원', '직원 ID', '업무', '이메일', '설정'].map((h) => (
                            <TableHead key={h}>{t(h)}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gone.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell>{box(e)}</TableCell>
                            <TableCell>
                              {e.punchId || <span className="muted">{t('미등록')}</span>}
                            </TableCell>
                            <TableCell>{roleLabel(e)}</TableCell>
                            <TableCell>{e.email || t('미등록')}</TableCell>
                            <TableCell>
                              <button
                                className="button danger"
                                disabled={busy}
                                onClick={() => purgeEmployee(e)}
                              >
                                {t('완전 삭제')}
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
            )}
          </TabsContent>
    </>
  );
  const dialogs = (
    <>
      {payDetail && (
        <Dialog open onOpenChange={(open) => !open && setPayDetail('')}>
          <DialogContent className="shift-dialog paydetail">
            <DialogTitle>
              {t('급여 상세')} · {name(payDetail)}
            </DialogTitle>
            <DialogDescription>
              {from} ~ {to} · {t('저장된 출근기록 기준입니다. 예정 시간이 아니라 실제로 찍힌 기록으로 계산합니다.')}
            </DialogDescription>
            {payDays(payDetail).length === 0 ? (
              <p className="hint">{t('아직 저장된 출근기록이 없습니다.')}</p>
            ) : (
              <>
                <div className="paydetail-scroll">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['날짜', '예정 근무', '출퇴근', '휴게', '실근무', '지각', '지각 차감', '초과', '금액'].map(
                          (h) => (
                            <TableHead key={h}>{t(h)}</TableHead>
                          ),
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payDays(payDetail).map(({ a, shift, worked, late, lateDeduction }) => (
                        <TableRow key={a.id}>
                          <TableCell>{monthDay(a.date)}</TableCell>
                          <TableCell>
                            {shift ? ampm(shift.start) + ' – ' + ampm(shift.end) : '—'}
                          </TableCell>
                          <TableCell>
                            {ampm(a.start)} – {ampm(a.end)}
                          </TableCell>
                          <TableCell>
                            {a.breakMinutes ? t('{n}분', { n: a.breakMinutes }) : '—'}
                          </TableCell>
                          <TableCell>{worked.toFixed(2)}h</TableCell>
                          <TableCell className={late ? 'red' : undefined}>
                            {late === null
                              ? t('예정 없음')
                              : late
                                ? t('{n}분 지각', { n: late })
                                : t('정시')}
                          </TableCell>
                          <TableCell className={lateDeduction ? 'red' : undefined}>
                            {lateDeduction ? '-' + money(lateDeduction) : '—'}
                          </TableCell>
                          <TableCell>
                            {worked > OT_DAILY_HOURS
                              ? (worked - OT_DAILY_HOURS).toFixed(2) + 'h'
                              : '—'}
                          </TableCell>
                          <TableCell>{money(worked * (emp(payDetail)?.rate ?? 0))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="hint">
                  {t('날짜별 금액은 시급 × 실근무이고, 지각 차감은 그 체크인에서 번 금액까지만 그 줄에서 바로 뺍니다. 초과분에 붙는 0.5배 가산만 주 단위로 아래에서 더합니다.')}
                </p>
                {payWeeks(payDetail).map((w) => (
                  <p className="hint" key={w.week}>
                    {t(
                      '{week} 시작 주 · 실근무 {worked}h · 하루 8시간 초과분 합 {daily}h · 주 40시간 초과분 {weekly}h → 1.5배 가산 {applied}h',
                      {
                        week: monthDay(w.week),
                        worked: w.worked.toFixed(2),
                        daily: w.daily.toFixed(2),
                        weekly: w.weekly.toFixed(2),
                        applied: w.applied.toFixed(2),
                      },
                    )}
                  </p>
                ))}
                {(() => {
                  const sum = payroll(data, payDetail, from, to);
                  return (
                    <div className="paytotals">
                      <span>
                        {t('기본급')} <b>{money(sum.base)}</b>
                      </span>
                      <span className={sum.otPay ? 'green' : undefined}>
                        {t('초과수당')} <b>+{money(sum.otPay)}</b>
                      </span>
                      <span className={sum.lateDeduction ? 'red' : undefined}>
                        {t('지각 차감')} <b>-{money(sum.lateDeduction)}</b>
                      </span>
                      <span className={sum.bonus ? 'green' : undefined}>
                        {t('대체 추가수당')} <b>+{money(sum.bonus)}</b>
                      </span>
                      <span className="paytotals-sum">
                        {t('예상 급여')} <b>{money(sum.total)}</b>
                      </span>
                    </div>
                  );
                })()}
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
      <GpsGuard state={gps.state} admin={actor.admin} onRetry={gps.retry} />
      {clockField && (
        <TimePicker
          key={clockField.key}
          value={form[clockField.key] || ''}
          label={clockField.label}
          minuteStep={clockField.step}
          onCancel={() => setClockField(null)}
          onPick={(value) => {
            put(clockField.key, value);
            // 근무 추가에서는 시작 시간을 고르자마자 종료 시간 시계를 이어서 엽니다.
            if (modal === 'shift' && clockField.key === 'start')
              setClockField({ key: 'end', label: t('종료 시간'), step: clockField.step });
            else setClockField(null);
          }}
        />
      )}
      {/* 저장 확인과 새 메시지는 같은 자리에 뜹니다. 한 통에 담아 세로로 쌓아, 둘이 겹쳐 서로를 가리지 않게 합니다. */}
      {(saved || inapp) && (
        <div className="alertstack">
          {saved && (
            <div className="inapp-alert" role="status">
              <span className="inapp-icon"><CheckCircle2 size={18} /></span>
              <div>
                <b>{t(saved)}</b>
                <p>{t('바꾼 내용을 팀 워크스페이스에 기록했습니다.')}</p>
              </div>
              <div className="inapp-actions">
                <button className="iconbutton" aria-label={t('닫기')} onClick={() => setSaved('')}>
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
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
                  shiftUpdate: '근무 시간 수정',
                  timeOffRequest: actor.admin ? '휴무 추가' : '휴무 신청',
                  availabilitySet: '근무 불가 시간 추가',
                  employee: '직원 설정',
                  swap: '대체근무 신청',
                  approve: '대체근무 승인',
                  message: '메시지 작성',
                  punchReview: '근무 기록에 이의',
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
                  : modal === 'detail'
                    ? canSchedule
                      ? t('근무 내용을 확인하고, 시간을 고치거나 근무를 삭제할 수 있습니다.')
                      : t('근무 내용입니다.')
                    : t('내용을 확인한 후 저장하세요.')}
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (modal === 'approve')
                void command('swapDecision', { ...form, action: 'approve' });
              else if (modal === 'detail') {
                // 근무 상세의 기본 단추는 삭제입니다. 되돌릴 수 없어 한 번 묻고 지웁니다.
                if (confirm(t('이 근무를 삭제할까요? 되돌릴 수 없고, 직원 화면에서도 사라집니다.')))
                  void command('shiftRemove', { id: form.id });
              } else void command(modal, form);
            }}
          >
            {modal === 'rain' && (
              <>
                {input('date', t('종료 날짜'), 'date')}
                {input('end', t('종료 시각 (온타리오)'), 'time')}
                <fieldset className="recipients">
                  <legend>
                    {t('받는 직원 ({n}/{total}명)', {
                      n: rainTargets.length,
                      total: staff.length,
                    })}
                  </legend>
                  <label className="recipient all">
                    <Checkbox
                      checked={rainAll}
                      onCheckedChange={(on) =>
                        put(
                          'targets',
                          on ? staff.map((e) => e.id).join(',') : '',
                        )
                      }
                    />
                    {t('전 직원')}
                  </label>
                  <div className="recipientlist">
                    {staff.map((e) => (
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
                {areaPick('area', t('업무 / 장소'))}
                {/* 근무일은 열던 자리에서 정해져 있어 고르지 않고 보여만 줍니다. */}
                <p className="hint">
                  {t('근무일 · {date}', { date: form.date ? longDate(form.date) : '' })}
                </p>
                {shiftTimes}
                <p className="hint">
                  {t('퇴근이 출근보다 이르면 다음 날 퇴근으로 계산합니다.')}
                </p>
                {noteField}
              </>
            )}
            {modal === 'shiftUpdate' && (
              <>
                {box(emp(data.shifts.find((s) => s.id === form.ids)?.employeeId || ''))}
                {areaPick('area', t('업무 / 장소'))}
                {input('date', t('근무일'), 'date')}
                {shiftTimes}
                <p className="hint">
                  {t('퇴근이 출근보다 이르면 다음 날 퇴근으로 계산합니다.')}
                </p>
                {noteField}
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
                {birthField(t('생년월일'))}
                {input('phone', t('연락처 (예: 914-555-0123)'), 'tel', false)}
                {/* 공용 단말에서 출근을 찍을 때 본인 확인에 쓰는 번호입니다. 비워 두면 묻지 않고 바로 찍습니다. */}
                {/* 단말에서 찍는 번호이자 첫 로그인 비밀번호입니다. 한 사람에 하나. */}
                {input('punchId', t('직원 ID (숫자 4~8자리)'))}
                {input('email', t('로그인 이메일'), 'email', false)}
                <div className="formgrid">
                  {input('color', t('직원 색상'), 'color')}
                  {input(
                    'rate',
                    t('개인별 시급 ({currency})', { currency: data.currency }),
                    'number',
                  )}
                </div>
                {rolePick()}
                <label className="recipient all">
                  <Checkbox
                    checked={form.admin === '1'}
                    onCheckedChange={(on) => put('admin', on ? '1' : '')}
                  />
                  {t('관리자 권한')}
                </label>
                <p className="hint">
                  {t('켜면 이 직원이 본인 비밀번호로 관리자 화면에 들어옵니다. 스케줄·급여·직원 정보를 모두 보고 고칠 수 있으니, 전 직원의 생년월일·연락처·시급이 함께 보인다는 점을 염두에 두세요.')}
                </p>
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
                <label className="recipient all">
                  <Checkbox
                    checked={form.overtimeManager === '1'}
                    onCheckedChange={(on) => put('overtimeManager', on ? '1' : '')}
                  />
                  {t('초과 근무 편성 권한')}
                </label>
                <p className="hint">
                  {t(
                    '끄면 이 직원이 짜는 근무는 하루 {d}시간, 한 주(일요일 시작) {w}시간까지만 들어갑니다. 켜면 그 선을 넘는 근무도 낼 수 있고, 넘긴 시간에는 급여에서 {m}배가 붙습니다. 관리자는 이 설정과 상관없이 넘겨 짤 수 있습니다.',
                    { d: OT_DAILY_HOURS, w: OT_WEEKLY_HOURS, m: OT_MULTIPLIER },
                  )}
                </p>
              </>
            )}
            {modal === 'swap' && (
              <>
                {swappable.length ? (
                  <Pick
                    label={t('대체할 근무')}
                    value={form.shiftId || ''}
                    onChange={(v) => put('shiftId', v)}
                    options={[
                      { value: '', label: t('근무 선택') },
                      ...swappable.map((s) => ({
                        value: s.id,
                        label: `${s.date} ${s.start} · ${name(s.employeeId)}`,
                      })),
                    ]}
                  />
                ) : (
                  <p className="formerror">
                    {t('지금 대체 신청할 수 있는 근무가 없습니다. 근무일이 7일 넘게 남은 일정만 고를 수 있어, 다음 주 이후 일정을 먼저 등록하세요.')}
                  </p>
                )}
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
            {modal === 'punchReview' && (
              <label className="field">
                {t('어디가 다른가요?')}
                <textarea
                  required
                  maxLength={500}
                  placeholder={t('예: 12시가 아니라 12시 30분에 퇴근했습니다.')}
                  value={form.note || ''}
                  onChange={(e) => put('note', e.target.value)}
                />
              </label>
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
                    {s.note && <p className="shiftnote">{s.note}</p>}
                    {s.originalId && (
                      <p>
                        {t('원근무자 {from} → 대체자 {to}', {
                          from: name(s.originalId),
                          to: name(s.employeeId),
                        })}
                      </p>
                    )}
                    {/* 관리자에게는 막히는 경우에만 한 줄을 띄웁니다. 할 수 있는 일은 설명 줄이 이미 말합니다. */}
                    {staffReadOnly ? (
                      <p className="hint">
                        {t('직원용 보기 화면입니다. 일정 변경은 관리자에게 문의하세요.')}
                      </p>
                    ) : swapBusy(s.id) ? (
                      <p className="hint">
                        {t('진행 중인 대체근무 요청이 있어 수정하거나 삭제할 수 없습니다.')}
                      </p>
                    ) : null}
                    {canSchedule && (
                      <div className="detailactions">
                        <button
                          type="button"
                          className="button"
                          disabled={busy || swapBusy(s.id)}
                          onClick={() =>
                            open('shiftUpdate', {
                              ids: s.id,
                              date: s.date,
                              start: s.start,
                              end: s.end,
                              area: s.area,
                              note: s.note || '',
                            })
                          }
                        >
                          {t('시간 수정')}
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
            {/* 폰에서는 이 묶음이 시트 바닥에 붙는 푸터가 됩니다. 데스크톱에서는 display:contents 라 아무 영향이 없습니다. */}
            {staffReadOnly && modal === 'detail' ? (
              <div className="dialog-actions">
                <button
                  className="button primary submit"
                  type="button"
                  onClick={() => setModal('')}
                >
                  {t('닫기')}
                </button>
              </div>
            ) : (
              <div className="dialog-actions">
              {(modal === 'shift' || modal === 'shiftUpdate' || modal === 'detail') && (
                <button className="button cancel" type="button" onClick={() => setModal('')}>
                  {t('취소')}
                </button>
              )}
              <button
                className="button primary submit"
                disabled={
                  busy ||
                  (modal === 'rain' && !rainTargets.length) ||
                  (modal === 'swap' && !swappable.length) ||
                  (modal === 'detail' &&
                    (!data.shifts.some((s) => s.id === form.id) || swapBusy(form.id)))
                }
                type="submit"
              >
                {busy
                  ? t('저장 중…')
                  : modal === 'detail'
                    ? t('근무 삭제')
                    : modal === 'rain'
                      ? rainAll
                        ? t('전 직원에게 공지 저장')
                        : t('선택한 {n}명에게 공지 저장', { n: rainTargets.length })
                      : t('저장')}
              </button>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
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
          <span className="tz">America / Toronto</span>
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
                      targets: staff.map((e) => e.id).join(','),
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
          {reminders.map(({ shift, missed }) => (
            <div className={'demo-banner' + (missed ? ' missed' : '')} key={shift.id}>
              <Bell size={16} />{' '}
              {missed
                ? t('출근 기록 없음 · {start}, {area} 근무가 시작됐습니다. 출근을 찍어 주세요.', {
                    start: shift.start,
                    area: shift.area,
                  })
                : t('출근 알림 · 오늘 {start}, {area} 근무가 1시간 이내에 시작됩니다.', {
                    start: shift.start,
                    area: shift.area,
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
                    n: staff.length,
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
                  {canSchedule && (
                    <>
                      <button
                        disabled={busy || setup}
                        className="button"
                        onClick={() => command('publish')}
                      >
                        {t('직원에게 공개')}
                      </button>
                      {data.published && (
                        <button
                          disabled={busy || setup}
                          className="button unpublish"
                          onClick={() => unpublish()}
                        >
                          {t('게시 해제')}
                        </button>
                      )}
                      <button
                        className="button primary"
                        onClick={() =>
                          open('shift', {
                            employeeId: staff[0]?.id || '',
                            // 근무일은 폼에서 고르지 않으므로 지금 보고 있는 날을 그대로 씁니다.
                            date:
                              view === 'week'
                                ? week
                                : view === 'month'
                                  ? day || localDate(new Date())
                                  : timelineDate,
                            start: '09:00',
                            end: '17:00',
                            area: areas[0],
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
                          <small>{roleLabel(e)}</small>
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
                                    className={
                                      'shift' + (s.draft ? ' is-draft' : '')
                                    }
                                    onClick={() => open('detail', { id: s.id })}
                                    style={{
                                      // 아직 공개하지 않은 근무는 노란 바탕으로 눈에 띄게 둡니다.
                                      background: s.draft
                                        ? '#fff4d4'
                                        : e.color + '13',
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
                                    {s.draft && (
                                      <em className="shift-flag">Unpublished</em>
                                    )}
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
                  employees={staffReadOnly ? staff : visibleEmployees}
                  shifts={data.shifts.filter((shift) =>
                    (staffReadOnly ? staff : visibleEmployees).some(
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
                                      className={s.draft ? 'is-draft' : ''}
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
                                        background: s.draft
                                          ? '#f3c73f'
                                          : e.color,
                                      }}
                                    >
                                      {s.draft ? 'Unpublished · ' : ''}
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
  // 필터 줄은 데스크톱과 폰이 같은 JSX 를 씁니다. 폰에서는 보기 설정 버튼으로 펼칩니다.
  // 하단 탭바 네 칸. 관리자와 직원이 자주 쓰는 화면이 달라 목록도 갈립니다.
  // 고정 '관리자' 계정은 직원 명부에 없습니다. 찍을 것이 없는 탭을 길에 두지 않습니다.
  const canPunch = !!emp(actor.id);
  const tabBarItems = (actor.admin
    ? [
        { key: 'home', label: 'tab::출퇴근', Icon: Clock, count: 0 },
        { key: 'schedule', label: '스케줄', Icon: CalendarDays, count: 0 },
        { key: 'team', label: '팀', Icon: Users, count: 0 },
        { key: 'messages', label: '메시지', Icon: MessageSquare, count: unread.length },
      ]
    : [
        { key: 'home', label: 'tab::출퇴근', Icon: Clock, count: 0 },
        { key: 'schedule', label: '스케줄', Icon: CalendarDays, count: 0 },
        { key: 'messages', label: '메시지', Icon: MessageSquare, count: unread.length },
      ]
  ).filter((i) => i.key !== 'home' || canPunch);
  // 탭바에 없는 화면에 처리할 일이 남아 있으면 '더보기'에 점을 띄웁니다.
  const myPending = (data.punches ?? []).filter(
    (r) =>
      r.employeeId === actor.id &&
      r.out &&
      (r.status ?? 'pending') === 'pending' &&
      payPeriodStart(r.date) === payPeriodStart(today),
  );
  // 더보기 안에서 숫자가 붙는 줄은 '내 근무표' 하나입니다.
  const moreCount = myPending.length;
  // 직원 폰의 '더보기'에 들어가는 화면들. 탭바에서 밀려난 것들이 여기 모입니다.
  const staffMore: { label?: string; items: MoreItem[] }[] = [
    {
      items: [
        {
          key: 'timesheets',
          label: '내 근무표',
          Icon: Timer,
          count: myPending.length,
          onSelect: () => {
            setSheet('');
            setTab('timesheets');
          },
        },
      ],
    },
    {
      label: '기록',
      items: [
        { key: 'attendance', label: '출근 기록', Icon: Clock3, onSelect: () => setTab('attendance') },
      ],
    },
    {
      label: '설정',
      items: [
        { key: 'help', label: '도움말', Icon: CircleQuestionMark, onSelect: () => setTab('help') },
        { key: 'logout', label: '로그아웃', Icon: LogOut, onSelect: () => void logout() },
      ],
    },
  ];
  // 뒤로가기가 붙는 화면들. 나머지는 탭바가 뿌리입니다.
  const staffRoot = ['home', 'schedule', 'messages', 'more'].includes(tab);
  const staffOwnHeader =
    tab === 'home' || (staffPhone && ['schedule', 'messages'].includes(tab));
  // 뒤로가기 줄에 띄울 이름. 근무표는 보고 있는 급여 기간을 그대로 제목으로 씁니다.
  const staffTitle =
    tab === 'timesheets' && sheet
      ? `${monthDay(sheet)} – ${monthDay(addDays(sheet, 13))}`
      : t(TAB_LABELS[tab] || '더보기');
  const staffBack = () => {
    if (tab === 'timesheets' && sheet) setSheet('');
    else setTab('more');
  };
  // 날씨를 물어볼 자리. 출퇴근이 찍히는 자리와 같은 좌표를 봅니다.
  const weatherSpot: { lat: number; lng: number } = workplaceOf(data);
  // 우천 근무 종료 공지. 데스크톱 머리줄과 폰 날씨 칸이 같은 내용을 엽니다.
  const rainNotice = () =>
    open('rain', {
      date: localDate(new Date()),
      end: '15:00',
      body: t('안전하게 장비를 정리하고 퇴근 기록을 남겨주세요.'),
      targets: staff.map((e) => e.id).join(','),
    });
  const schedActionsNode = canSchedule ? (
                    <div className="sched-actions">
                      <button
                        className="button publish"
                        disabled={busy || setup || data.published}
                        onClick={() => command('publish')}
                        title={data.published ? t('직원 공개 중') : t('작성 중')}
                      >
                        <Send size={16} />
                        {data.published ? t('공개됨') : t('스케줄 공개')}
                      </button>
                      {data.published && (
                        <button
                          className="button unpublish"
                          disabled={busy || setup}
                          onClick={() => unpublish()}
                        >
                          <EyeOff size={16} />
                          {t('게시 해제')}
                        </button>
                      )}
                    </div>
  ) : null;
  const schedFiltersNode = staffReadOnly ? null : (
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
                    {/* 폰은 보기 종류와 상관없이 날짜별 목록 하나만 씁니다. */}
                    {!phone &&
                      iconPick(LayoutGrid, t('보기'), view, setView, [
                        { value: 'week', label: t('주간') },
                        { value: 'day', label: t('일간') },
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
                      onClick={rainNotice}
                    >
                      <CloudRain size={18} />
                    </button>
                  </div>
  );
  // Shifts this request would block if approved (or already blocks).
  return (
    <div
      className={
        'app-shell' +
        (navCollapsed ? ' collapsed' : '') +
        (navOpen ? ' nav-open' : '') +
        (staffPhone ? ' staff-shell' : '') +
        (staffOwnHeader ? ' staff-full' : '')
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
            {canPunch && navItem('home', 'tab::출퇴근', Clock)}
            {actor.admin && navItem('dashboard', '대시보드', LayoutDashboard)}
            {actor.admin && navItem('working', '근무 현황', Radar, { sub: true })}
            {navItem('schedule', '스케줄', CalendarDays)}
            {actor.admin && navItem('team', '팀', Users)}
            <hr />
            <a className="sidenav-item" href={'/tasks' + query()}>
              <ClipboardList size={19} />
              <span>{t('작업')}</span>
            </a>
            {navItem('messages', '메시지', MessageSquare, { count: unread.length })}
            <hr />
            {navItem('attendance', '출근 기록', Timer)}
            {actor.admin && navItem('payroll', '급여 관리', Wallet)}
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
                <small>Pelham Hills · Ontario</small>
              </span>
            </div>
            <div className="sidebar-tools">
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
          {!staffOwnHeader && (
            <header className={'mobilebar' + (staffPhone ? ' for-staff' : '')}>
              {staffPhone && !staffRoot ? (
                <button
                  className="iconbutton"
                  aria-label={t('뒤로')}
                  onClick={staffBack}
                >
                  <ArrowLeft size={21} />
                </button>
              ) : (
                <button
                  className="mobilebar-me"
                  aria-label={t('메뉴 열기')}
                  onClick={() => setNavOpen(true)}
                >
                  <span className="avatar">
                    {actor.admin ? 'P' : name(actor.id).slice(0, 1)}
                  </span>
                </button>
              )}
              <h1 className="mobilebar-title">
                {staffPhone ? staffTitle : t(TAB_LABELS[tab] || '스케줄')}
              </h1>
              {staffPhone ? (
                <span className="mobilebar-gap" aria-hidden="true" />
              ) : (
                <button
                  aria-label={t('메시지 보기')}
                  className="iconbutton bell"
                  onClick={() => setTab('messages')}
                >
                  <Bell size={20} />
                  {unread.length > 0 && <em className="bellcount">{unread.length}</em>}
                </button>
              )}
            </header>
          )}
          <main className={publishBar ? 'has-publishbar' : undefined}>
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
            {reminders.map(({ shift, missed }) => (
              <div className={'demo-banner' + (missed ? ' missed' : '')} key={shift.id}>
                <Bell size={16} />{' '}
                {missed
                  ? t('출근 기록 없음 · {start}, {area} 근무가 시작됐습니다. 출근을 찍어 주세요.', {
                      start: shift.start,
                      area: shift.area,
                    })
                  : t('출근 알림 · 오늘 {start}, {area} 근무가 1시간 이내에 시작됩니다.', {
                      start: shift.start,
                      area: shift.area,
                    })}
              </div>
            ))}
            <TabsContent value="schedule">
              <section className="sched">
                {!phone && (
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
                {!phone && schedActionsNode}
                </div>
                )}
                {!phone && schedFiltersNode}
                {staffPhone ? (
                  <StaffSchedule
                    me={actor.id}
                    week={week}
                    day={day}
                    scope={scope}
                    employees={data.employees}
                    shifts={data.shifts}
                    location={LOCATION}
                    onScopeChange={setScope}
                    onWeekChange={setWeek}
                    onDayChange={setDay}
                    onShiftSelect={(id) => open('detail', { id })}
                  />
                ) : phone ? (
                  <PhoneSchedule
                    week={week}
                    day={day}
                    employees={staffReadOnly ? staff : visibleEmployees}
                    shifts={data.shifts.filter((shift) =>
                      (staffReadOnly ? staff : visibleEmployees).some(
                        (employee) => employee.id === shift.employeeId,
                      ),
                    )}
                    timeOff={timeOff}
                    availability={availability}
                    location="Pelham Hills Golf Club"
                    canEdit={!staffReadOnly}
                    spot={weatherSpot}
                    actions={schedActionsNode}
                    blockedOf={(shift) => blockedBy(data, shift)}
                    onWeekChange={setWeek}
                    onDayChange={setDay}
                    onShiftSelect={(id) => open('detail', { id })}
                    onRainNotice={actor.admin ? rainNotice : undefined}
                    onAddShift={(date) =>
                      open('shift', {
                        employeeId: filter === 'all' ? '' : filter,
                        date,
                        start: '09:00',
                        end: '17:00',
                        area: dept === 'all' ? areas[0] : dept,
                        note: '',
                      })
                    }
                    onOpenTimeOff={() => setTab('timeoff')}
                    onOpenAvailability={() => setTab('availability')}
                  />
                ) : !staffReadOnly && view === 'week' ? (
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
                          {actor.admin && (
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
                                  role: dept === 'all' ? areas[0] : dept,
                                  roles: dept === 'all' ? areas[0] : dept,
                                })
                              }
                            >
                              <UserPlus size={18} />
                            </button>
                          )}
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
                        {/* 한 사람은 한 번만 섭니다 — 겸직자는 기본 업무 아래 두고, 업무를 좁혀 보면 그 업무 자리에 나타납니다. */}
                        {(dept === 'all' ? roles : [dept])
                          .filter((role) => visibleEmployees.some((e) => bandOf(e) === role))
                          .map((role) => {
                            const members = visibleEmployees.filter((e) => bandOf(e) === role);
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
                                            style={{ color: roleTint(e) }}
                                            onClick={() =>
                                              setFilter(filter === e.id ? 'all' : e.id)
                                            }
                                          >
                                            {e.name}
                                          </button>
                                          <small>
                                            {t('{h}시간', { h: hours.toFixed(2) })}
                                            {showCost && <> - {money(hours * e.rate)}</>}
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
                            {showCost && <small>{money(rosterCost(rosterShifts))}</small>}
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
                              {showCost && <small>{money(rosterCost(list))}</small>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : view === 'day' ? (
                  <DaySchedule
                    date={day}
                    employees={staffReadOnly ? staff : visibleEmployees}
                    shifts={data.shifts.filter((shift) =>
                      (staffReadOnly ? staff : visibleEmployees).some(
                        (employee) => employee.id === shift.employeeId,
                      ),
                    )}
                    rateOf={(id) => emp(id)?.rate || 0}
                    money={money}
                    showCost={showCost}
                    published={data.published}
                    canEdit={!staffReadOnly}
                    onDateChange={setDay}
                    onShiftSelect={(id) => open('detail', { id })}
                    onAddShift={(employeeId, date, start) => {
                      // 누른 시각부터 네 시간을 기본으로 채워 둡니다. 7shifts 도 같은 길이로 엽니다.
                      const from = start || '09:00';
                      const end = (Number(from.slice(0, 2)) + 4) % 24;
                      open('shift', {
                        employeeId,
                        date,
                        start: from,
                        end: String(end).padStart(2, '0') + from.slice(2),
                        area: emp(employeeId)?.role || areas[0],
                        note: '',
                      });
                    }}
                    onPublish={() => void command('publish')}
                    onUnpublish={unpublish}
                  />
                ) : staffReadOnly || view === 'month' ? (
                  <MonthSchedule
                    date={day}
                    employees={staffReadOnly ? staff : visibleEmployees}
                    shifts={data.shifts.filter((shift) =>
                      (staffReadOnly ? staff : visibleEmployees).some(
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
            {comingSoon('help', CircleQuestionMark, '도움말', '스케줄 작성, 휴무·근무 가능 시간, 대체 근무 사용법 안내를 준비하고 있습니다.')}
            <TabsContent value="home">
              {/* 이 탭은 직원 기록이 있을 때만 길에 놓입니다. 주소를 직접 열어 들어온 경우에만 이 줄을 봅니다. */}
              {!canPunch ? (
                <section className="nostaff">
                  <UserRound size={34} />
                  <h2>{t('이 계정은 직원 명부에 없습니다')}</h2>
                  <p>{t('출퇴근은 직원 명부에 있는 사람만 찍습니다.')}</p>
                </section>
              ) : (
              <StaffClock
                employee={emp(actor.id)}
                punch={myPunch}
                shift={myShiftToday}
                location={LOCATION}
                busy={busy}
                workplace={workplaceOf(data)}
                spot={gps.spot}
                gpsState={gps.state}
                onLocate={gps.retry}
                onPunch={async (action, photo, place) => {
                  const next = await command(action, {
                    photo,
                    // 번호는 로그인한 본인 기록에서 그대로 보냅니다 — 화면에서 다시 묻지 않습니다.
                    punchId: emp(actor.id)?.punchId ?? '',
                    ...place,
                  });
                  // 사진은 이 기기에만 남깁니다. 방금 남은 기록에 묶어 두어야 나중에 찾습니다.
                  if (next) {
                    const mine = (next.punches ?? [])
                      .filter((x) => x.employeeId === actor.id)
                      .at(-1);
                    if (mine)
                      void savePunchPhoto(mine.id, action === 'punchIn' ? 'in' : 'out', photo);
                  }
                  return !!next;
                }}
                onBreak={(action) => void command('punchBreak', { action, paid: '1' })}
              />
              )}
            </TabsContent>
            <TabsContent value="more">
              <StaffMore
                name={name(actor.id)}
                role={emp(actor.id)?.role ?? ''}
                groups={staffMore}
              />
            </TabsContent>
            <TabsContent value="timesheets">
              <StaffTimesheets
                me={actor.id}
                punches={data.punches ?? []}
                employee={emp(actor.id)}
                location={LOCATION}
                today={today}
                busy={busy}
                period={sheet}
                onPeriodChange={setSheet}
                onReview={(id, action) => {
                  // 확인은 바로 저장하고, 이의는 무엇이 다른지 받아서 함께 보냅니다.
                  if (action === 'approve') void command('punchReview', { id, action });
                  else open('punchReview', { id, action, note: '' });
                }}
                onApproveAll={(from) => void command('punchApproveAll', { from })}
              />
            </TabsContent>
{otherTabs}
            <footer>
              PELHAM SHIFT <span>{t('팀의 시간, 더 간편하게.')}</span>
            </footer>
          </main>
          {/* 공개하지 않은 근무가 남아 있으면 탭바 바로 위에 띄웁니다. 목록을 아무리 내려도
              '아직 공개 안 된 게 몇 건 있다'가 눈에서 사라지지 않게. 공개하면 스스로 사라집니다. */}
          {publishBar && (
            <div className="publishbar">
              <button
                className="publishbar-button"
                disabled={busy || setup}
                onClick={() => command('publish')}
              >
                {drafts === 1
                  ? t('스케줄 공개 (근무 1건)')
                  : t('스케줄 공개 (근무 {n}건)', { n: drafts })}
              </button>
            </div>
          )}
          {/* 폰의 기본 이동 수단. 나머지 메뉴는 '더보기'가 여는 서랍에 그대로 있습니다. */}
          <nav className="tabbar" aria-label={t('주요 메뉴')}>
            {tabBarItems.map(({ key, label, Icon, count }) => (
              <button
                key={key}
                className={'tabbar-item' + (tab === key ? ' on' : '')}
                aria-current={tab === key ? 'page' : undefined}
                onClick={() => {
                  setTab(key);
                  setNavOpen(false);
                }}
              >
                <span className="tabbar-icon">
                  <Icon size={21} />
                  {count > 0 && <em />}
                </span>
                {t(label)}
              </button>
            ))}
            {/* 서랍이 열리면 이 버튼은 가림막 아래로 들어갑니다. 닫는 쪽은 가림막이 맡습니다. */}
            <button
              className={
                'tabbar-item' + ((staffPhone ? tab === 'more' : navOpen) ? ' on' : '')
              }
              aria-expanded={staffPhone ? undefined : navOpen}
              aria-current={staffPhone && tab === 'more' ? 'page' : undefined}
              onClick={() => (staffPhone ? setTab('more') : setNavOpen(true))}
            >
              <span className="tabbar-icon">
                <Menu size={21} />
                {moreCount > 0 && <em />}
              </span>
              {t('더보기')}
            </button>
          </nav>
        </div>
      </Tabs>
      {dialogs}
    </div>
  );
}
