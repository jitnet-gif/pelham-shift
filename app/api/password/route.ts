import { getBirthSession, updatePassword } from '@/lib/birth-auth';
import { log } from '@/lib/audit';
export const dynamic = 'force-dynamic';

const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
};

export async function PATCH(request: Request) {
  try {
    if (!sameOrigin(request)) {
      return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
    }
    const body = (await request.json()) as {
      currentPassword?: unknown;
      nextPassword?: unknown;
    };
    await updatePassword(
      request,
      String(body.currentPassword || ''),
      String(body.nextPassword || ''),
    );
    // 비밀번호 자체는 적지 않습니다. 바꿨다는 사실만 남깁니다.
    const session = await getBirthSession(request);
    if (session) await log(request, { workspace: session.team, actor: session.actor, state: session.state, kind: 'auth', action: 'passwordChange' });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다.' },
      { status: 400 },
    );
  }
}
