import { createBirthSession, deleteBirthSession, findMembers, clearSessionCookie, sessionCookie } from '@/lib/birth-auth';
export const dynamic = 'force-dynamic';

const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
};

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
    if (found.length > 1) throw Error('이 직원 ID를 쓰는 팀이 여럿입니다. 팀 주소로 열어 다시 로그인하세요.');
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
