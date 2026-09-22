import { createBirthSession, deleteBirthSession, findMembers, clearSessionCookie, sessionCookie } from '@/lib/birth-auth';
export const dynamic = 'force-dynamic';

const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
};

// 비밀번호 칸에 친 직원 ID 가 누구인지, 이름 하나만 돌려줍니다.
// 로그인 전에 열려 있는 창구라 이름 밖의 것은 내보내지 않습니다 — 팀도, 내부 id 도.
// 목록은 없습니다. 번호 하나를 정확히 맞혔을 때만 그 한 명의 이름이 나옵니다.
export async function GET(request: Request) {
  const blank = Response.json({}, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const url = new URL(request.url);
    const id = (url.searchParams.get('id') || '').trim();
    // 직원 ID 모양(숫자 4~8자)이 아니면 명부를 뒤지지도 않습니다.
    if (!/^\d{4,8}$/.test(id)) return blank;
    const found = await findMembers(id, url.searchParams.get('team') || '');
    // 같은 번호가 여러 팀에 있으면 누구인지 고를 수 없습니다. 아무 이름도 대지 않습니다.
    if (found.length > 1) {
      return Response.json({ ambiguous: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (!found.length) return blank;
    return Response.json({ name: found[0].name }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return blank;
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
    const body = (await request.json()) as {
      team?: unknown;
      employeeId?: unknown;
      password?: unknown;
    };
    const team = String(body.team || '') || new URL(request.url).searchParams.get('team') || '';
    // 친 번호가 누구인지 먼저 찾습니다. 비밀번호 확인은 그다음이고, 아래 createBirthSession 이 합니다.
    const found = await findMembers(String(body.employeeId || ''), team);
    // 번호가 여러 팀에 있으면 고르지 않습니다. 팀 주소(?team=)로 열면 그 팀 안에서만 찾습니다.
    if (found.length > 1) throw Error('이 번호를 쓰는 사람이 둘 이상입니다. 팀 주소로 열거나 관리자에게 문의하세요.');
    // 없는 번호도 틀린 비밀번호와 같은 말로 돌려보냅니다 — 번호를 넣어 보며 누가 있는지 세지 못하게.
    if (!found.length) throw Error('직원 ID 또는 비밀번호를 확인하세요.');
    const session = await createBirthSession(found[0].team, found[0].actor, String(body.password || ''));
    return Response.json(
      { team: session.team, actor: session.actor, passwordChanged: session.passwordChanged },
      { headers: { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '로그인하지 못했습니다.' },
      { status: 401 },
    );
  }
}

export async function DELETE(request: Request) {
  await deleteBirthSession(request);
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}
