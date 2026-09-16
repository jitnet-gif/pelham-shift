import postgres from 'postgres';

// D1-shaped facade over Postgres, so the existing `env.DB.prepare(sql).bind(...)` call sites stay unchanged.
type Param = string | number | null;

const cache = globalThis as unknown as { pelhamSql?: postgres.Sql };

// DATABASE_URL is set by hand; POSTGRES_URL is what Vercel's Supabase integration (Storage → Connect) adds.
const connectionUrl = () => {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw)
    throw new Error(
      '데이터베이스 연결 정보가 없습니다. Vercel 환경변수 DATABASE_URL 또는 Supabase 연동(POSTGRES_URL)을 설정하세요.',
    );
  // postgres.js forwards unknown query params (e.g. Supabase's `supa=base-pooler.x`) as server settings,
  // which the server rejects, so keep only the TLS mode.
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) if (key !== 'sslmode') url.searchParams.delete(key);
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

class Statement {
  constructor(
    private readonly query: string,
    private readonly params: Param[] = [],
  ) {}

  // Accepts anything like D1's bind; call sites only pass strings and numbers.
  bind(...params: unknown[]) {
    return new Statement(this.query, params as Param[]);
  }

  private execute() {
    return sql().unsafe(positional(this.query), this.params);
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
