import { env } from '@/lib/db';
import type { State } from '@/lib/domain';

const SESSION_COOKIE = 'pelham_birth_session';
const MASTER_BIRTH_DATE = '19760802';
const ADMIN_PASSWORD = '2222';
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
const defaultPassword = (state: State | null, actor: string) =>
  state?.employees.find((employee) => employee.id === actor)?.birthDate || '';
const verifyPassword = async (
  workspace: string,
  actor: string,
  state: State | null,
  admin: boolean,
  password: string,
) => {
  if (!password) return false;
  // 관리자 비밀번호는 코드에 고정되며 저장된 자격 증명보다 우선합니다.
  if (admin) return password === ADMIN_PASSWORD;
  const credential = await credentialFor(workspace, actor);
  return credential
    ? (await passwordHash(password, credential.salt)) === credential.hash
    : password === defaultPassword(state, actor);
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
  if (!session.admin && (!state || !state.employees.some((employee) => employee.id === session.actor))) {
    return null;
  }
  return {
    team: session.workspace,
    actor: { id: session.actor, admin: session.admin === 1 },
    row: row || null,
    state,
    passwordChanged:
      session.admin === 1 || Boolean(await credentialFor(session.workspace, session.actor)),
  };
}

export async function createBirthSession(birthDate: string, password = '', preferredTeam = '') {
  if (!/^\d{8}$/.test(birthDate)) throw Error('생년월일 8자리를 입력하세요.');
  const rows = preferredTeam
    ? await env.DB
        .prepare('SELECT id, owner, state, version FROM workspaces WHERE id = ?')
        .bind(preferredTeam)
        .all<WorkspaceRow>()
    : await env.DB
        .prepare('SELECT id, owner, state, version FROM workspaces LIMIT 100')
        .all<WorkspaceRow>();
  let workspace = '';
  let actor = '';
  let admin = false;

  if (birthDate === MASTER_BIRTH_DATE) {
    workspace = rows.results[0]?.id || 'master';
    actor = 'admin';
    admin = true;
  } else {
    for (const row of rows.results) {
      const state = JSON.parse(row.state) as State;
      const employee = state.employees.find(
        (candidate) => candidate.birthDate === birthDate,
      );
      if (employee) {
        workspace = row.id;
        actor = employee.id;
        break;
      }
    }
    if (!workspace) throw Error('등록된 생년월일을 찾을 수 없습니다. 관리자에게 확인하세요.');
  }
  const workspaceRow = rows.results.find((row) => row.id === workspace) || null;
  const state = workspaceRow ? (JSON.parse(workspaceRow.state) as State) : null;
  if (!(await verifyPassword(workspace, actor, state, admin, password))) {
    throw Error('생년월일 또는 비밀번호를 확인하세요.');
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await env.DB.prepare(
    'INSERT INTO birth_sessions (token, workspace, actor, admin, expires_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(token, workspace, actor, admin ? 1 : 0, expiresAt.toISOString())
    .run();
  return {
    token,
    expiresAt,
    team: workspace,
    actor: { id: actor, admin },
    passwordChanged: admin || Boolean(await credentialFor(workspace, actor)),
  };
}

export async function deleteBirthSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  await env.DB.prepare('DELETE FROM birth_sessions WHERE token = ?').bind(token).run();
}

export async function updatePassword(request: Request, currentPassword: string, nextPassword: string) {
  if (nextPassword.length < 8 || nextPassword.length > 128) {
    throw Error('새 비밀번호는 8~128자로 입력하세요.');
  }
  const session = await getBirthSession(request);
  if (!session) throw Error('생년월일로 로그인한 뒤 변경할 수 있습니다.');
  if (session.actor.admin) throw Error('관리자 비밀번호는 변경할 수 없습니다.');
  if (!(await verifyPassword(session.team, session.actor.id, session.state, session.actor.admin, currentPassword))) {
    throw Error('현재 비밀번호를 확인하세요.');
  }
  const salt = crypto.randomUUID();
  const hash = await passwordHash(nextPassword, salt);
  await env.DB
    .prepare('INSERT INTO password_credentials (workspace, actor, salt, hash, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(workspace, actor) DO UPDATE SET salt = excluded.salt, hash = excluded.hash, updated_at = excluded.updated_at')
    .bind(session.team, session.actor.id, salt, hash, new Date().toISOString())
    .run();
}
