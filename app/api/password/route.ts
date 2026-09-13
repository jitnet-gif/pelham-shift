import { updatePassword } from '@/lib/birth-auth';
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
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다.' },
      { status: 400 },
    );
  }
}
