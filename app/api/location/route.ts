import { env } from '@/lib/db';
import { localDate, roleTint, workplaceOf, type Punch, type State } from '@/lib/domain';
import { context, json, sameOrigin } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

type Row = { actor: string; lat: number; lng: number; accuracy: number | null; at: string };

// 자리를 받는 것은 출근을 찍어 둔 동안뿐입니다. 퇴근했거나 출근 전이면 받지 않고, 남아 있던 자리도 지웁니다.
// '오늘' 찍은 출근만 봅니다 — 퇴근을 잊은 어제 기록 때문에 집에서까지 자리가 잡히면 안 됩니다.
const openPunch = (state: State, employeeId: string, today = localDate(new Date())) =>
  (state.punches ?? []).find((p) => p.employeeId === employeeId && p.date === today && !p.out);

// 표를 아직 만들지 않았으면(42P01) 무엇을 해야 하는지 알려 줍니다.
const missingTable = (error: unknown) => (error as { code?: string })?.code === '42P01';
const MIGRATION_NOTE =
  '위치 표가 아직 없습니다. supabase/migrations/20260924120000_staff_locations.sql 을 Supabase SQL Editor 에서 실행하세요.';

// 직원 앱이 보내는 지금 자리. 관리자 계정(직원이 아님)은 보내지 않습니다.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({ error: '허용되지 않은 요청입니다.' }, 403);
    const c = await context(req);
    if (!c) return json({ error: '로그인이 필요합니다.' }, 401);
    const employee = c.state?.employees.find((e) => e.id === c.actor.id);
    if (!c.state || !employee || employee.archived) return json({ tracking: false });
    if (!openPunch(c.state, employee.id)) {
      await env.DB.prepare('DELETE FROM staff_locations WHERE workspace = ? AND actor = ?')
        .bind(c.team, employee.id)
        .run();
      return json({ tracking: false });
    }
    const body = (await req.json()) as { lat?: unknown; lng?: unknown; accuracy?: unknown };
    const lat = Number(body?.lat),
      lng = Number(body?.lng),
      accuracy = Number(body?.accuracy);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
      return json({ error: '위치 값이 올바르지 않습니다.' }, 400);
    await env.DB.prepare(
      'INSERT INTO staff_locations (workspace, actor, lat, lng, accuracy, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (workspace, actor) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, accuracy = excluded.accuracy, at = excluded.at',
    )
      .bind(
        c.team,
        employee.id,
        lat,
        lng,
        Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null,
        new Date().toISOString(),
      )
      .run();
    return json({ tracking: true });
  } catch (e) {
    if (missingTable(e)) return json({ tracking: false });
    return json({ error: e instanceof Error ? e.message : '저장하지 못했습니다.' }, 400);
  }
}

// 관리자 지도가 읽는 자리. 지금 출근해 있는 사람의 것만 내보냅니다 — 퇴근한 뒤 지워지지 못한 줄도 여기서 걸러집니다.
export async function GET(req: Request) {
  try {
    const c = await context(req);
    if (!c) return json({ error: '로그인이 필요합니다.' }, 401);
    if (!c.actor.admin) return json({ error: '관리자만 볼 수 있습니다.' }, 403);
    const state = c.state;
    if (!state) return json({ workplace: null, staff: [], now: new Date().toISOString() });
    const { results } = await env.DB.prepare(
      'SELECT actor, lat, lng, accuracy, at FROM staff_locations WHERE workspace = ?',
    )
      .bind(c.team)
      .all<Row>();
    const seen = new Map(results.map((r) => [r.actor, r]));
    const today = localDate(new Date());
    // 출근해 있는데 아직 자리가 들어오지 않은 사람도 목록에 올립니다. 앱을 닫아 두었다는 뜻입니다.
    const staff = state.employees
      .filter((e) => !e.archived)
      .map((e) => ({ e, punch: openPunch(state, e.id, today) }))
      .filter((x): x is { e: (typeof state.employees)[number]; punch: Punch } => Boolean(x.punch))
      .map(({ e, punch }) => {
        // 어제 퇴근을 찍지 못해 남은 자리는 오늘 자리가 아닙니다. 오늘 첫 자리가 들어올 때까지 비워 둡니다.
        const row = seen.get(e.id);
        const spot = row && localDate(new Date(row.at)) === today ? row : undefined;
        return {
          id: e.id,
          name: e.name,
          color: roleTint(e) ?? e.color,
          area: punch.area ?? e.role ?? '',
          in: punch.in,
          spot: spot
            ? { lat: Number(spot.lat), lng: Number(spot.lng), accuracy: spot.accuracy, at: spot.at }
            : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return json({ workplace: workplaceOf(state), staff, now: new Date().toISOString() });
  } catch (e) {
    if (missingTable(e)) return json({ error: MIGRATION_NOTE }, 503);
    return json({ error: e instanceof Error ? e.message : '불러오지 못했습니다.' }, 400);
  }
}
