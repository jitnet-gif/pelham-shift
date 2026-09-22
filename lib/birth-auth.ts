import { env } from '@/lib/db';
import type { State } from '@/lib/domain';

const SESSION_COOKIE = 'pelham_birth_session';
// 로그인 목록 맨 앞에 서는 관리자들. 직원 id(E001…) 와 겹치지 않는 id 를 씁니다.
const ADMINS = [{ id: 'admin', name: '관리자' }];
const adminFor = (actor: string) => ADMINS.find((entry) => entry.id === actor) || null;
// 관리자 비밀번호는 모두 같은 값을 쓰고, 직원처럼 바꿀 수 없습니다.
const ADMIN_PASSWORD = '2222';
// 아직 비밀번호를 바꾸지 않은 직원은 본인 직원 ID 로 들어옵니다.
// 단말에서 눌러 보이는 번호라 비밀 값이 아닙니다 — 첫 로그인 뒤 바꾸도록 안내합니다.
// 직원 ID 가 아직 없는 사람만 이 값으로 들어옵니다.
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
export type Member = { team: string; id: string; name: string; admin?: boolean };

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
  initial = DEFAULT_PASSWORD,
) => {
  if (!password) return false;
  // 고정 명단 관리자의 비밀번호만 코드에 있습니다. 관리자로 지정된 직원은 본인 비밀번호를 씁니다.
  if (roster) return password === ADMIN_PASSWORD;
  const credential = await credentialFor(workspace, actor);
  // 본인 비밀번호를 한 번이라도 정했다면 초기 비밀번호는 더 이상 통하지 않습니다.
  return credential
    ? (await passwordHash(password, credential.salt)) === credential.hash
    : password === initial;
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

// 로그인 드롭다운을 채우는 목록. 팀·id·이름만 내보내고 생년월일·연락처·시급은 내보내지 않습니다.
export async function listMembers(preferredTeam = '') {
  const rows = preferredTeam
    ? await env.DB
        .prepare('SELECT id, owner, state, version FROM workspaces WHERE id = ?')
        .bind(preferredTeam)
        .all<WorkspaceRow>()
    : await env.DB
        .prepare('SELECT id, owner, state, version FROM workspaces LIMIT 100')
        .all<WorkspaceRow>();
  // 워크스페이스가 아직 없어도 관리자는 골라야 첫 설정을 시작할 수 있으므로 항상 넣습니다.
  // 없을 때의 'master' 는 첫 워크스페이스를 만들 때 쓰는 이름이라 그대로 둡니다.
  const adminTeam = rows.results[0]?.id || 'master';
  const members: Member[] = ADMINS.map((entry) => ({
    team: adminTeam,
    id: entry.id,
    name: entry.name,
    admin: true,
  }));
  for (const row of rows.results) {
    const state = JSON.parse(row.state) as State;
    for (const employee of state.employees) {
      if (employee.archived) continue;
      members.push({ team: row.id, id: employee.id, name: employee.name || employee.id });
    }
  }
  return members;
}

export async function createBirthSession(team: string, actor: string, password = '') {
  if (!team || !actor || team.length > 100 || actor.length > 100) {
    throw Error('직원을 선택하세요.');
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
      employee?.punchId || DEFAULT_PASSWORD,
    ))
  ) {
    throw Error('비밀번호를 확인하세요.');
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
  const initial =
    session.state?.employees.find((candidate) => candidate.id === session.actor.id)?.punchId ||
    DEFAULT_PASSWORD;
  if (
    !(await verifyPassword(session.team, session.actor.id, roster, currentPassword, initial))
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
