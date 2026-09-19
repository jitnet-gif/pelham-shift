import postgres from 'postgres';

// D1-shaped facade over Postgres, so the existing `env.DB.prepare(sql).bind(...)` call sites stay unchanged.
type Param = string | number | null;

const cache = globalThis as unknown as { pelhamSql?: postgres.Sql };

// DATABASE_URL is set by hand; POSTGRES_URL is what Vercel's Supabase integration (Storage → Connect) adds.
const connectionUrl = () => {
  // The integration may add a custom prefix (e.g. STORAGE_POSTGRES_URL), so accept any *_POSTGRES_URL too.
  const prefixed = Object.keys(process.env).find((key) => key.endsWith('_POSTGRES_URL'));
  const raw =
    process.env.DATABASE_URL || process.env.POSTGRES_URL || (prefixed && process.env[prefixed]);
  if (!raw)
    throw new Error(
      '데이터베이스 연결 정보가 없습니다. Vercel 환경변수 DATABASE_URL 또는 Supabase 연동(POSTGRES_URL)을 설정하세요.',
    );
  // postgres.js forwards unknown query params (e.g. Supabase's `supa=base-pooler.x`) as server settings,
  // which the server rejects, so keep only the TLS mode.
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) if (key !== 'sslmode') url.searchParams.delete(key);
  // Vercel can reach neither the API host (no Postgres listener) nor db.<ref>.supabase.co (IPv6 only),
  // so a Supabase host is rewritten to the transaction pooler, which is what this deployment needs.
  const ref = url.hostname.match(/^(?:db\.)?([a-z0-9]{16,})\.supabase\.co$/)?.[1];
  if (ref) {
    if (!url.username.includes('.')) url.username = `postgres.${ref}`;
    url.hostname = process.env.SUPABASE_POOLER_HOST || 'aws-0-us-east-2.pooler.supabase.com';
    url.port = '6543';
  }
  return url.toString();
};

const sql = () => {
  if (!cache.pelhamSql) {
    // The Supabase transaction pooler cannot keep prepared statements across requests.
    cache.pelhamSql = postgres(connectionUrl(), { prepare: false, max: 3, idle_timeout: 20 });
  }
  return cache.pelhamSql;
};

// D1 uses `?` placeholders; Postgres wants `$1..$n`. None of the queries put `?` inside string literals.
const positional = (query: string) => {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
};

// Network failures surface as an AggregateError with an empty message; name the error codes instead
// (never the address or password) so a wrong or unreachable DATABASE_URL can be told apart.
const target = () => {
  try {
    const url = new URL(connectionUrl());
    return `${url.hostname}:${url.port || '5432'}`;
  } catch {
    return 'unknown';
  }
};

const describe = (error: unknown) => {
  if (!(error instanceof Error) || error.message) return error;
  const parts = error instanceof AggregateError ? error.errors : [error];
  const codes = [
    ...new Set(parts.map((part) => (part as { code?: string }).code || (part as Error).message).filter(Boolean)),
  ];
  return new Error(
    `데이터베이스에 접속하지 못했습니다 (${codes.join(', ') || error.name} · ${target()}). DATABASE_URL이 Supabase Transaction pooler(포트 6543) 주소인지 확인하세요.`,
  );
};

class Statement {
  constructor(
    private readonly query: string,
    private readonly params: Param[] = [],
  ) {}

  // Accepts anything like D1's bind; call sites only pass strings and numbers.
  bind(...params: unknown[]) {
    return new Statement(this.query, params as Param[]);
  }

  private async execute() {
    try {
      return await sql().unsafe(positional(this.query), this.params);
    } catch (error) {
      throw describe(error);
    }
  }

  async first<T>(): Promise<T | null> {
    const rows = await this.execute();
    return (rows[0] as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: [...(await this.execute())] as T[] };
  }

  // `changes` backs the optimistic-lock and push de-duplication checks, so it must be the real row count.
  async run() {
    const rows = await this.execute();
    return { meta: { changes: rows.count } };
  }
}

export const env = { DB: { prepare: (query: string) => new Statement(query) } };
