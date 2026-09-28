import { env } from '@/lib/db';
import { log } from '@/lib/audit';
import { livePunches, roleTint, TIME_ZONE, workplaceOf } from '@/lib/domain';
import { context, json } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

type Row = {
  actor: string;
  actor_name: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  at: string;
};
type Point = {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: string;
  kind: 'in' | 'out' | 'gps';
};

// 출퇴근 시각은 매장 시각(HH:MM)으로만 적혀 있어, 그날 그 시각의 실제 순간으로 바꿉니다.
// 매장 시간대의 그 시각이 UTC 로 몇 시인지는 같은 날 정오의 시차로 맞춥니다(서머타임 바뀌는 새벽은 무시).
const clubInstant = (day: string, hhmm: string) => {
  const noon = new Date(day + 'T12:00:00Z');
  const shown = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(noon);
  const [h, m] = shown.split(':').map(Number);
  const offset = (h * 60 + m - 12 * 60) * 60000;
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(
    Date.parse(day + 'T00:00:00Z') + (hh * 60 + mm) * 60000 - offset,
  ).toISOString();
};

// 관리자가 고른 하루 동안 직원들이 지나온 자리. 출근·퇴근을 찍은 자리를 처음과 끝에 두고,
// 그 사이는 staff_location_log 의 30분 간격 자리로 잇습니다. 하루의 경계는 매장 시각(토론토)입니다.
export async function GET(req: Request) {
  try {
    const c = await context(req);
    if (!c) return json({ error: '로그인이 필요합니다.' }, 401);
    if (!c.actor.admin) return json({ error: '관리자만 볼 수 있습니다.' }, 403);
    const day = new URL(req.url).searchParams.get('day') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
      return json({ error: '날짜를 확인하세요.' }, 400);
    const state = c.state;
    const { results } = await env.DB.prepare(
      `SELECT actor, actor_name, lat, lng, accuracy, at FROM staff_location_log WHERE workspace = ? AND at >= ((?::date)::timestamp AT TIME ZONE '${TIME_ZONE}') AND at < ((?::date + 1)::timestamp AT TIME ZONE '${TIME_ZONE}') ORDER BY at ASC, id ASC LIMIT 20000`,
    )
      .bind(c.team, day, day)
      .all<Row>()
      .catch((error) => {
        if ((error as { code?: string })?.code === '42P01')
          return { results: [] as Row[] };
        throw error;
      });

    const people = new Map<
      string,
      { id: string; name: string; color: string; points: Point[] }
    >();
    const person = (id: string, fallback?: string | null) => {
      let p = people.get(id);
      if (!p) {
        const e = state?.employees.find((x) => x.id === id);
        p = {
          id,
          name: e?.name ?? fallback ?? id,
          color: (e && (roleTint(e) ?? e.color)) || '#5b6b66',
          points: [],
        };
        people.set(id, p);
      }
      return p;
    };
    for (const r of results)
      person(r.actor, r.actor_name).points.push({
        lat: Number(r.lat),
        lng: Number(r.lng),
        accuracy: r.accuracy == null ? null : Number(r.accuracy),
        at: new Date(r.at).toISOString(),
        kind: 'gps',
      });
    if (state)
      for (const p of livePunches(state).filter((x) => x.date === day)) {
        if (p.spot)
          person(p.employeeId).points.push({
            ...p.spot,
            accuracy: p.spot.accuracy ?? null,
            at: clubInstant(day, p.in),
            kind: 'in',
          });
        if (p.out && p.outSpot)
          person(p.employeeId).points.push({
            ...p.outSpot,
            accuracy: p.outSpot.accuracy ?? null,
            at: clubInstant(day, p.out),
            kind: 'out',
          });
      }
    const list = [...people.values()]
      .map((p) => ({
        ...p,
        points: p.points.sort((a, b) => a.at.localeCompare(b.at)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // 위치는 개인정보라, 엑셀 GPS 내려받기처럼 누가 언제 어느 날을 봤는지 남깁니다.
    await log(req, {
      workspace: c.team,
      actor: c.actor,
      state,
      kind: 'app',
      action: 'traceView',
      detail: { day, people: list.length },
    });
    return json({
      day,
      workplace: state ? workplaceOf(state) : null,
      people: list,
    });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : '불러오지 못했습니다.' },
      400,
    );
  }
}
