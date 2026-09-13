import { createBirthSession, deleteBirthSession, clearSessionCookie, sessionCookie } from '@/lib/birth-auth';
export const dynamic = 'force-dynamic';

const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
};

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
    const body = (await request.json()) as { birthDate?: unknown; password?: unknown };
    const team = new URL(request.url).searchParams.get('team') || '';
    const session = await createBirthSession(
      String(body.birthDate || ''),
      String(body.password || ''),
      team,
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
