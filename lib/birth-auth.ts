import { env } from '@/lib/db';
import type { State } from '@/lib/domain';

const SESSION_COOKIE = 'pelham_birth_session';
// 관리자 번호이자 비밀번호입니다. 직원과 같은 규칙 — 번호 하나가 곧 이름이자 비밀번호입니다.
// 이 저장소는 공개되어 있어, 여기 적어 두면 누구나 읽고 주인 계정으로 들어옵니다.
// 그래서 값은 코드에 두지 않고 환경변수로만 받습니다. 없으면 관리자 로그인은 아예 닫힙니다 —
// 조용히 옛 값으로 열려 있는 것보다, 막혀서 눈에 띄는 편이 낫습니다.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
// 로그인 화면에서 관리자도 직원처럼 번호를 칩니다. 그러면 이 이름이 윗칸에 떠 그대로 들어갑니다.
// id 'admin' 은 번호가 직원 번호와 겹쳐 막혔을 때 돌아갈 길로 남겨 둡니다.
const ADMINS = [
  { id: 'admin', name: process.env.ADMIN_NAME || 'hwang sunjae', punchId: ADMIN_PASSWORD },
];
const adminFor = (actor: string) => ADMINS.find((entry) => entry.id === actor) || null;
// 직원은 본인 직원 ID 로 로그인합니다. 아래 값은 아직 직원 ID 가 없는 사람만 쓰는 옛 기본값입니다.
const DEFAULT_PASSWORD = '1111';
const SESSION_DAYS = 30;

type WorkspaceRow = { id: string; owner: string; state: string; version: number };
type StoredSession = {
  token: string;
  workspace: string;
  actor: string;
  admin: number;
  expiresAt: string;
};
type Credential = { salt: string; hash: string };
// 직원 ID 하나로 찾아난 사람. 어느 워크스페이스의 누구인지만 담습니다.
export type MemberMatch = { team: string; actor: string; name: string };

export type BirthSession = {
  team: string;
  actor: { id: string; admin: boolean };
  row: WorkspaceRow | null;
  state: State | null;
  passwordChanged: boolean;
};

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const passwordHash = async (password: string, salt: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return hex(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120000, hash: 'SHA-256' },
      key,
      256,
    ),
  );
};
const credentialFor = (workspace: string, actor: string) =>
  env.DB
    .prepare('SELECT salt, hash FROM password_credentials WHERE workspace = ? AND actor = ?')
    .bind(workspace, actor)
    .first<Credential>();
const verifyPassword = async (
  workspace: string,
  actor: string,
  roster: boolean,
  password: string,
  punchId = '',
) => {
  if (!password) return false;
  // 관리자 비밀번호는 환경변수에서만 옵니다. 설정해 두지 않았으면 무엇을 쳐도 열리지 않습니다.
  // 관리자로 지정된 직원은 이 계정이 아니라 본인 비밀번호를 씁니다.
  if (roster) return ADMIN_PASSWORD !== '' && password === ADMIN_PASSWORD;
  // 직원 ID 는 언제나 그 사람의 비밀번호입니다. 이름과 번호만 알면 들어올 수 있습니다.
  if (punchId && password === punchId) return true;
  const credential = await credentialFor(workspace, actor);
  // 따로 정해 둔 비밀번호가 있으면 그것도 같이 받습니다. 아직 없고 번호도 없는 사람만 옛 기본값입니다.
  return credential
    ? (await passwordHash(password, credential.salt)) === credential.hash
    : password === DEFAULT_PASSWORD;
};

const readCookie = (request: Request, name: string) => {
  const value = request.headers.get('cookie') || '';
  return value
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.slice(1).join('=');
};

export const sessionCookie = (token: string, expiresAt: Date) =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}`;

export const clearSessionCookie = () =>
  `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function getBirthSession(request: Request): Promise<BirthSession | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  const session = await env.DB.prepare(
    'SELECT token, workspace, actor, admin, expires_at AS "expiresAt" FROM birth_sessions WHERE token = ?',
  )
    .bind(token)
    .first<StoredSession>();
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    await env.DB.prepare('DELETE FROM birth_sessions WHERE token = ?').bind(token).run();
    return null;
  }
  const row = await env.DB.prepare(
    'SELECT id, owner, state, version FROM workspaces WHERE id = ?',
  )
    .bind(session.workspace)
    .first<WorkspaceRow>();
  const state = row ? (JSON.parse(row.state) as State) : null;
  const roster = adminFor(session.actor) !== null;
  const employee = state?.employees.find((candidate) => candidate.id === session.actor);
  // 관리자 지정과 직원 삭제는 언제든 바뀌므로, 로그인 때 기록한 값 대신 지금의 직원 기록을 봅니다.
  if (!roster && (!employee || employee.archived)) return null;
  return {
    team: session.workspace,
    actor: { id: session.actor, admin: roster || employee?.admin === true },
    row: row || null,
    state,
    passwordChanged:
      roster || Boolean(await credentialFor(session.workspace, session.actor)),
  };
}

// 이름 목록에서 고르는 대신 직원 ID 를 칩니다 — 단말에 대는 그 번호이고, 직원이 아는 번호도 그것 하나입니다.
// 어느 워크스페이스 사람인지는 서버가 찾습니다. 번호는 워크스페이스마다 1001 부터 새로 나가므로
// 같은 번호가 여러 곳에 있을 수 있습니다 — 그래서 찾은 것을 모두 돌려주고, 고를 수 없으면 부르는 쪽에서 막습니다.
// 먼저 찾은 쪽을 그냥 고르면 번호만 같은 남의 팀으로 들어가게 됩니다.
export async function findMembers(typed: string, preferredTeam = ''): Promise<MemberMatch[]> {
  const wanted = typed.trim();
  if (!wanted || wanted.length > 100) return [];
  const rows = preferredTeam
    ? await env.DB
        .prepare('SELECT id, owner, state, version FROM workspaces WHERE id = ?')
        .bind(preferredTeam)
        .all<WorkspaceRow>()
    : await env.DB
        .prepare('SELECT id, owner, state, version FROM workspaces LIMIT 100')
        .all<WorkspaceRow>();
  const found: MemberMatch[] = [];
  // 관리자는 직원이 아니라 어느 워크스페이스에도 없습니다. 번호로도, id 로도 불립니다.
  // 아직 워크스페이스가 없어도 첫 설정을 시작해야 하므로 'master' 로라도 들여보냅니다.
  const roster = ADMINS.find(
    (entry) =>
      entry.id.toLowerCase() === wanted.toLowerCase() ||
      (entry.punchId !== '' && entry.punchId === wanted),
  );
  // 여기서 끝내지 않습니다 — 같은 번호를 쓰는 직원이 있으면 둘 다 담겨, 부르는 쪽이 고를 수 없음을
  // 알고 막습니다. 관리자가 조용히 이기면 남의 번호를 삼키는 셈입니다.
  if (roster) {
    found.push({
      team: preferredTeam || rows.results[0]?.id || 'master',
      actor: roster.id,
      name: roster.name,
    });
  }
  for (const row of rows.results) {
    const state = JSON.parse(row.state) as State;
    for (const employee of state.employees) {
      // 삭제한 사람의 번호로는 들어오지 못합니다. 그 번호를 다시 받은 사람만 걸립니다.
      if (!employee.archived && employee.punchId && employee.punchId === wanted) {
        found.push({ team: row.id, actor: employee.id, name: employee.name || employee.punchId });
      }
    }
  }
  return found;
}

export async function createBirthSession(team: string, actor: string, password = '') {
  if (!team || !actor || team.length > 100 || actor.length > 100) {
    throw Error('직원 ID를 입력하세요.');
  }
  // 관리자를 흉내 낸 요청도 그 계정의 비밀번호를 그대로 거쳐야 합니다.
  const adminEntry = adminFor(actor);
  const workspaceRow = await env.DB
    .prepare('SELECT id, owner, state, version FROM workspaces WHERE id = ?')
    .bind(team)
    .first<WorkspaceRow>();
  const state = workspaceRow ? (JSON.parse(workspaceRow.state) as State) : null;
  const employee = adminEntry ? null : state?.employees.find((candidate) => candidate.id === actor);
  // 삭제한 직원은 기록만 남기고 로그인은 막습니다.
  if (!adminEntry && (!employee || employee.archived)) {
    throw Error('등록되지 않은 직원입니다. 관리자에게 확인하세요.');
  }
  if (
    !(await verifyPassword(
      team,
      actor,
      adminEntry !== null,
      password,
      employee?.punchId || '',
    ))
  ) {
    // 없는 번호인지 틀린 비밀번호인지 가르지 않습니다. 가르면 번호를 넣어 보며 누가 있는지 셀 수 있습니다.
    throw Error('직원 ID 또는 비밀번호를 확인하세요.');
  }
  const admin = adminEntry !== null || employee?.admin === true;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await env.DB.prepare(
    'INSERT INTO birth_sessions (token, workspace, actor, admin, expires_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(token, team, actor, admin ? 1 : 0, expiresAt.toISOString())
    .run();
  return {
    token,
    expiresAt,
    team,
    actor: { id: actor, admin },
    passwordChanged: adminEntry !== null || Boolean(await credentialFor(team, actor)),
  };
}

export async function deleteBirthSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  await env.DB.prepare('DELETE FROM birth_sessions WHERE token = ?').bind(token).run();
}

export async function updatePassword(request: Request, currentPassword: string, nextPassword: string) {
  // 관리자 2222, 초기 1111 과 같은 네 자리 숫자를 직원이 그대로 쓸 수 있도록 최소 길이는 4자입니다.
  if (nextPassword.length < 4 || nextPassword.length > 128) {
    throw Error('새 비밀번호는 4~128자로 입력하세요.');
  }
  const session = await getBirthSession(request);
  if (!session) throw Error('로그인한 뒤 변경할 수 있습니다.');
  const roster = adminFor(session.actor.id) !== null;
  if (roster) throw Error('관리자 비밀번호는 변경할 수 없습니다.');
  const punchId =
    session.state?.employees.find((candidate) => candidate.id === session.actor.id)?.punchId || '';
  if (
    !(await verifyPassword(session.team, session.actor.id, roster, currentPassword, punchId))
  ) {
    throw Error('현재 비밀번호를 확인하세요.');
  }
  const salt = crypto.randomUUID();
  const hash = await passwordHash(nextPassword, salt);
  await env.DB
    .prepare('INSERT INTO password_credentials (workspace, actor, salt, hash, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(workspace, actor) DO UPDATE SET salt = excluded.salt, hash = excluded.hash, updated_at = excluded.updated_at')
    .bind(session.team, session.actor.id, salt, hash, new Date().toISOString())
    .run();
}
