import { createBirthSession, deleteBirthSession, listMembers, clearSessionCookie, sessionCookie } from '@/lib/birth-auth';
export const dynamic = 'force-dynamic';

const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
};

// 로그인 화면의 이름 드롭다운을 채웁니다. 로그인 전이라 인증은 없고, 이름 외에는 아무것도 내보내지 않습니다.
export async function GET(request: Request) {
  try {
    const team = new URL(request.url).searchParams.get('team') || '';
    return Response.json(
      { members: await listMembers(team) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '직원 목록을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
    const body = (await request.json()) as {
      team?: unknown;
      actor?: unknown;
      birthDate?: unknown;
      password?: unknown;
    };
    const team = String(body.team || '') || new URL(request.url).searchParams.get('team') || '';
    const session = await createBirthSession(
      team,
      String(body.actor || ''),
      String(body.birthDate || ''),
      String(body.password || ''),
    );
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
