'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { localDate, TIME_ZONE } from '@/lib/domain';
import { useLang } from '../use-lang';

type TracePoint = {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: string;
  kind: 'in' | 'out' | 'gps';
};
type TracePerson = {
  id: string;
  name: string;
  color: string;
  points: TracePoint[];
};
type Trace = {
  day: string;
  workplace: { lat: number; lng: number; radius: number } | null;
  people: TracePerson[];
};
type Pt = TracePoint & { ms: number };

// 이력은 30분에 한 점이라, 두 점 사이를 이 간격까지만 곧게 잇습니다. 이보다 벌어지면 앱이 닫혀 있던 것이라
// 어디를 지났는지 모르므로 마지막 자리에 세워 두고 흐리게 그립니다.
const GAP_MS = 40 * 60000;
const STALE_MS = 10 * 60000;
// 재생 속도: 화면 1초에 흐르는 실제 시간.
const SPEEDS = [60, 300, 900, 1800];
const STALE_FILL = '#9aa6a2';
// 같은 직군이 여럿일 때 두 번째 사람부터 쓰는 색. 직군 색(파랑·갈색·보라)과 멀리 떨어진 색들입니다.
const EXTRA_COLORS = [
  '#d1343a',
  '#0f9d58',
  '#e08a00',
  '#0097a7',
  '#c2185b',
  '#5d4037',
  '#3949ab',
  '#7cb342',
  '#6d6d6d',
  '#ff7043',
];

const clock = (ms: number) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ms);
const shiftDay = (day: string, by: number) => {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};

// 시각 ms 에 그 사람이 있던 자리. 첫 점 전에는 없고, 끊긴 사이와 마지막 점 뒤에는 마지막 자리에 머뭅니다.
function spotAt(
  points: Pt[],
  ms: number,
): { lat: number; lng: number; stale: boolean; i: number } | null {
  if (!points.length || ms < points[0].ms) return null;
  let i = 0;
  while (i + 1 < points.length && points[i + 1].ms <= ms) i++;
  const a = points[i],
    b = points[i + 1];
  if (b && b.ms - a.ms <= GAP_MS) {
    const f = (ms - a.ms) / (b.ms - a.ms);
    return {
      lat: a.lat + (b.lat - a.lat) * f,
      lng: a.lng + (b.lng - a.lng) * f,
      stale: false,
      i,
    };
  }
  return {
    lat: a.lat,
    lng: a.lng,
    stale: ms - a.ms > STALE_MS || a.kind === 'out',
    i,
  };
}

// 이동 기록 모드. 관리자 지도(map)를 빌려 그리고, 모드가 꺼지면 제 층을 걷어 냅니다.
export function useStaffTrace(
  L: typeof Leaflet | null,
  map: Leaflet.Map | null,
  active: boolean,
) {
  const { t } = useLang();
  const [day, setDay] = useState(() => localDate(new Date()));
  const [trace, setTrace] = useState<Trace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(300);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const atRef = useRef(0);
  const fittedFor = useRef<Trace | null>(null);
  const live = useRef<Leaflet.LayerGroup | null>(null);
  const dots = useRef<{ dot: Leaflet.CircleMarker; ms: number }[]>([]);
  const heads = useRef<
    {
      p: { points: Pt[]; color: string };
      line: [number, number][];
      trail: Leaflet.Polyline;
      head: Leaflet.CircleMarker;
    }[]
  >([]);
  // 길을 새로 그린 횟수. 새로 그린 뒤에도 지금 시각의 자리를 한 번 맞추라는 신호입니다.
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    atRef.current = at;
  }, [at]);

  const load = useCallback(
    async (d: string) => {
      setLoading(true);
      setPlaying(false);
      try {
        const res = await fetch('/api/location/trace?day=' + d, {
          cache: 'no-store',
        });
        const body = (await res.json().catch(() => ({}))) as Trace & {
          error?: string;
        };
        if (!res.ok) {
          setError(body.error || t('불러오지 못했습니다.'));
          return;
        }
        setError(null);
        setTrace(body);
        // 새 날을 읽으면 그날 맨 처음으로 되감습니다.
        const all = body.people.flatMap((p) =>
          p.points.map((x) => Date.parse(x.at)),
        );
        setAt(all.length ? Math.min(...all) : 0);
      } catch {
        setError(t('서버에 닿지 못했습니다. 잠시 뒤 다시 읽습니다.'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (active) void load(day);
  }, [active, day, load]);

  const people = useMemo(() => {
    // 선 색은 직군 색이라 같은 직군끼리 겹칩니다. 이미 누가 쓴 색이면 남은 색을 골라 사람마다 다르게 합니다.
    const used = new Set<string>();
    return (trace?.people ?? []).map((p) => {
      const color = used.has(p.color)
        ? (EXTRA_COLORS.find((c) => !used.has(c)) ?? p.color)
        : p.color;
      used.add(color);
      return {
        ...p,
        color,
        points: p.points.map((x) => ({ ...x, ms: Date.parse(x.at) })) as Pt[],
      };
    });
  }, [trace]);
  const shown = useMemo(
    () => people.filter((p) => !hidden.has(p.id) && p.points.length),
    [people, hidden],
  );
  const range = useMemo(() => {
    const all = shown.flatMap((p) => p.points.map((x) => x.ms));
    return all.length ? { from: Math.min(...all), to: Math.max(...all) } : null;
  }, [shown]);

  // 재생: 화면 한 프레임마다 흐른 시간 × 속도만큼 앞으로. 끝에 닿으면 멈춥니다.
  useEffect(() => {
    if (!playing || !range) return;
    let last = performance.now(),
      frame = 0;
    const step = (now: number) => {
      const next = Math.min(
        range.to,
        Math.max(range.from, atRef.current) + (now - last) * speed,
      );
      last = now;
      atRef.current = next;
      setAt(next);
      if (next >= range.to) setPlaying(false);
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, range, speed]);

  // 층은 모드가 켜져 있는 동안만 지도에 붙입니다.
  useEffect(() => {
    if (!L || !map || !active) return;
    const group = L.layerGroup().addTo(map),
      moving = L.layerGroup().addTo(map);
    layer.current = group;
    live.current = moving;
    return () => {
      group.remove();
      moving.remove();
      layer.current = null;
      live.current = null;
    };
  }, [L, map, active]);

  const fit = useCallback(
    (only?: TracePerson) => {
      if (!L || !map) return;
      const pts = (only ? [only] : shown).flatMap((p) =>
        p.points.map((x) => [x.lat, x.lng] as [number, number]),
      );
      if (pts.length)
        map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 18 });
    },
    [L, map, shown],
  );

  // 새 날을 읽으면 그날 다닌 곳이 모두 보이게 한 번 맞춥니다.
  // 사람을 켜고 끌 때는 화면을 옮기지 않습니다.
  useEffect(() => {
    if (!active) fittedFor.current = null;
    else if (trace && layer.current && fittedFor.current !== trace) {
      fittedFor.current = trace;
      fit();
    }
  }, [trace, active, fit]);

  // 길과 점은 그날을 읽거나 사람을 켜고 끌 때만 다시 그립니다. 재생 중에는 매 프레임 아래 효과가
  // 이미 그려 둔 선·점을 옮기고 색만 바꿉니다 — 매번 다 지우고 다시 그리면 사람이 많을 때 끊깁니다.
  useEffect(() => {
    const g = layer.current,
      m = live.current;
    if (!L || !g || !m) return;
    g.clearLayers();
    m.clearLayers();
    dots.current = [];
    heads.current = [];
    if (trace?.workplace)
      L.circle([trace.workplace.lat, trace.workplace.lng], {
        radius: trace.workplace.radius,
        color: '#087e6d',
        weight: 1.5,
        fillOpacity: 0.05,
        interactive: false,
      }).addTo(g);
    for (const p of shown) {
      const line = p.points.map((x) => [x.lat, x.lng] as [number, number]);
      const route = L.polyline(line, {
        color: p.color,
        weight: 3,
        opacity: 0.3,
        dashArray: '4 6',
        interactive: false,
      }).addTo(g);
      // 점선은 가늘어 마우스로 짚기 어렵습니다. 보이지 않는 굵은 선을 겹쳐 두고, 올리면 이름을 띄우고 그 점선을 진하게 합니다.
      L.polyline(line, { color: p.color, weight: 16, opacity: 0 })
        .bindTooltip(p.name, { sticky: true, className: 'staffmap-tag' })
        .on('mouseover', () => route.setStyle({ opacity: 0.9, weight: 4 }))
        .on('mouseout', () => route.setStyle({ opacity: 0.3, weight: 3 }))
        .addTo(g);
    }
    // 점은 모든 선을 그린 뒤에 올려, 다른 사람의 굵은 짚기 선에 가려지지 않게 합니다.
    for (const p of shown) {
      const line = p.points.map((x) => [x.lat, x.lng] as [number, number]);
      for (const x of p.points) {
        const label =
          (x.kind === 'in'
            ? t('punch::출근') + ' '
            : x.kind === 'out'
              ? t('punch::퇴근') + ' '
              : '') + clock(x.ms);
        const dot = L.circleMarker([x.lat, x.lng], {
          radius: x.kind === 'gps' ? 4 : 6,
          color: p.color,
          weight: 2,
          fillColor: x.kind === 'gps' ? p.color : '#fff',
          fillOpacity: 0.25,
          opacity: 0.35,
        })
          .bindTooltip(
            `${p.name} · ${label}${x.accuracy != null ? ` · ±${x.accuracy}m` : ''}`,
            { direction: 'top' },
          )
          .addTo(g);
        dots.current.push({ dot, ms: x.ms });
      }
      const trail = L.polyline([], {
        color: p.color,
        weight: 4,
        opacity: 0.9,
        interactive: false,
      });
      const head = L.circleMarker(line[0], {
        radius: 9,
        color: '#fff',
        weight: 2.5,
        fillColor: p.color,
        fillOpacity: 1,
      }).bindTooltip(p.name, {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
        className: 'staffmap-tag',
      });
      heads.current.push({ p, line, trail, head });
    }
    setDrawn((n) => n + 1);
  }, [L, active, trace, shown, t]);

  // 지금 시각 at 에 맞춰 진한 길을 늘이고, 사람 점을 옮기고, 지난 점만 진하게.
  useEffect(() => {
    const m = live.current;
    if (!m) return;
    // 이미 그 모양이면 건드리지 않습니다 — 지금 모양은 Leaflet 이 들고 있는 값으로 봅니다.
    for (const d of dots.current) {
      const opacity = d.ms <= at ? 1 : 0.35;
      if (d.dot.options.opacity !== opacity)
        d.dot.setStyle({ fillOpacity: d.ms <= at ? 0.9 : 0.25, opacity });
    }
    for (const h of heads.current) {
      const now = spotAt(h.p.points, at);
      if (!now) {
        h.trail.remove();
        h.head.remove();
        continue;
      }
      h.trail.setLatLngs([...h.line.slice(0, now.i + 1), [now.lat, now.lng]]);
      h.head.setLatLng([now.lat, now.lng]);
      if (!m.hasLayer(h.head)) {
        h.trail.addTo(m);
        h.head.addTo(m);
      }
      const fill = now.stale ? STALE_FILL : h.p.color;
      if (h.head.options.fillColor !== fill) {
        h.head.setStyle({ fillColor: fill });
        h.head
          .getTooltip()
          ?.getElement()
          ?.classList.toggle('is-stale', now.stale);
      }
    }
  }, [at, drawn]);

  const toggle = (id: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const play = () => {
    if (!range) return;
    if (!playing && at >= range.to) setAt(range.from);
    setPlaying((v) => !v);
  };

  const reload = () => void load(day);

  return {
    day,
    setDay,
    trace,
    people,
    error,
    loading,
    hidden,
    toggle,
    at,
    setAt,
    range,
    playing,
    play,
    speed,
    setSpeed,
    fit,
    reload,
  };
}

type TraceState = ReturnType<typeof useStaffTrace>;

// 지도 아래 재생 막대: 날짜, 재생·멈춤, 시각 막대, 속도.
export function TraceBar({ s }: { s: TraceState }) {
  const { t } = useLang();
  const today = localDate(new Date());
  return (
    <div className="stafftrace-bar">
      <div className="stafftrace-day">
        <button
          className="iconbutton"
          onClick={() => s.setDay(shiftDay(s.day, -1))}
          aria-label={t('전날')}
        >
          <ChevronLeft size={18} />
        </button>
        <input
          type="date"
          aria-label={t('날짜')}
          value={s.day}
          max={today}
          onChange={(e) => e.target.value && s.setDay(e.target.value)}
        />
        <button
          className="iconbutton"
          onClick={() => s.setDay(shiftDay(s.day, 1))}
          disabled={s.day >= today}
          aria-label={t('다음날')}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <button
        className="button primary stafftrace-play"
        onClick={s.play}
        disabled={!s.range}
      >
        {s.playing ? <Pause size={16} /> : <Play size={16} />}
        {s.playing ? t('멈춤') : t('재생')}
      </button>
      <output className="stafftrace-clock">
        {s.range ? clock(Math.max(s.at, s.range.from)) : '--:--'}
      </output>
      <input
        className="stafftrace-range"
        type="range"
        min={s.range?.from ?? 0}
        max={s.range?.to ?? 0}
        step={60000}
        value={s.range ? Math.min(Math.max(s.at, s.range.from), s.range.to) : 0}
        onChange={(e) => s.setAt(Number(e.target.value))}
        disabled={!s.range}
        aria-label={t('시각')}
      />
      <select
        value={s.speed}
        onChange={(e) => s.setSpeed(Number(e.target.value))}
        aria-label={t('재생 속도')}
      >
        {SPEEDS.map((v) => (
          <option key={v} value={v}>
            {t('1초에 {n}분', { n: v / 60 })}
          </option>
        ))}
      </select>
    </div>
  );
}

// 옆 목록: 그날 기록이 있는 사람. 눌러 켜고 끄고, 이름을 누르면 그 사람 길에 맞춥니다.
export function TraceList({ s }: { s: TraceState }) {
  const { t } = useLang();
  return (
    <aside className="staffmap-list">
      <h2>
        {t('이동 기록')}{' '}
        <span>
          {s.loading ? t('불러오는 중…') : t('{n}명', { n: s.people.length })}
        </span>
      </h2>
      {s.error && <p className="staffmap-empty">{t(s.error)}</p>}
      {!s.loading && !s.error && s.people.length === 0 && (
        <p className="staffmap-empty">
          {t('이 날 남은 위치 기록이 없습니다.')}
        </p>
      )}
      <ul>
        {s.people.map((p) => {
          const first = p.points[0],
            last = p.points[p.points.length - 1],
            off = s.hidden.has(p.id);
          return (
            <li key={p.id} className={off ? 'is-stale' : ''}>
              <div className="stafftrace-person">
                <input
                  type="checkbox"
                  checked={!off}
                  onChange={() => s.toggle(p.id)}
                  aria-label={p.name}
                />
                <button
                  className="staffmap-person"
                  onClick={() => s.fit(p)}
                  disabled={off}
                  aria-label={p.name}
                >
                  <i style={{ background: p.color }} />
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {first && `${clock(first.ms)}–${clock(last.ms)}`} ·{' '}
                      {t('{n}곳', { n: p.points.length })}
                    </small>
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="stafftrace-note">
        {t(
          '출퇴근을 찍은 자리와, 근무 중 앱이 열려 있을 때 30분마다 남긴 자리를 잇습니다. 점 사이의 선은 실제로 걸은 길이 아닙니다.',
        )}
      </p>
    </aside>
  );
}
