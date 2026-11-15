// D1 Database client — Cloudflare Edge compatible
// Replaces pg Pool. D1 binding injected via Cloudflare runtime env.

import { getRequestContext } from '@cloudflare/next-on-pages';

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: { changes: number; last_row_id: number; duration: number };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

// Get D1 binding from Cloudflare env
export function getDB(): D1Database {
  // 1. Official Next-on-Pages request context
  try {
    const ctx = getRequestContext();
    if ((ctx?.env as any)?.DB) return (ctx.env as any).DB as D1Database;
  } catch {
    // getRequestContext() throws outside edge request context
  }

  // 2. Direct symbol fallback (how next-on-pages stores it in globalThis)
  const symCtx = (globalThis as any)[Symbol.for('__cloudflare-request-context__')];
  if (symCtx?.env?.DB) return symCtx.env.DB as D1Database;

  // 3. Fallback for custom or direct bindings
  const globalCtx = (globalThis as any).__cloudflare_request_context__;
  if (globalCtx?.env?.DB) return globalCtx.env.DB as D1Database;

  // 4. Fallback for local wrangler / miniflare globals
  if ((globalThis as any).DB) return (globalThis as any).DB as D1Database;
  if ((process.env as any).DB) return (process.env as any).DB as D1Database;

  throw new Error('D1 database binding not available. Ensure wrangler.toml has [[d1_databases]] binding = "DB"');
}

// ── Query helpers ──────────────────────────────────────────────────────────

// Convert PostgreSQL $1,$2 placeholders to D1 ? placeholders
function convertPlaceholders(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?');
}

// Single row query (replaces pool.query for SELECT ... LIMIT 1)
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const db = getDB();
  const converted = convertPlaceholders(sql);
  return db.prepare(converted).bind(...params).first<T>();
}

// Multi-row query (replaces pool.query for SELECT)
export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = getDB();
  const converted = convertPlaceholders(sql);
  const result = await db.prepare(converted).bind(...params).all<T>();
  return result.results;
}

// Execute (INSERT/UPDATE/DELETE — replaces pool.query for mutations)
export async function execute(sql: string, params: any[] = []): Promise<{ rowCount: number; lastRowId: number }> {
  const db = getDB();
  const converted = convertPlaceholders(sql);
  const result = await db.prepare(converted).bind(...params).run();
  return {
    rowCount: result.meta.changes,
    lastRowId: result.meta.last_row_id,
  };
}

// INSERT ... RETURNING id equivalent (D1 has no RETURNING — use lastRowId)
export async function insertReturningId(sql: string, params: any[] = []): Promise<number> {
  const result = await execute(sql, params);
  return result.lastRowId;
}

// ── Transaction helper ─────────────────────────────────────────────────────
// D1 supports batch() for atomic multi-statement execution
// For complex transactions, use runTransaction()

export interface TxStatement {
  sql: string;
  params?: any[];
}

export async function runTransaction(statements: TxStatement[]): Promise<void> {
  const db = getDB();
  const prepared = statements.map(s =>
    db.prepare(convertPlaceholders(s.sql)).bind(...(s.params || []))
  );
  const results = await db.batch(prepared);
  for (const r of results) {
    if (!r.success) throw new Error('Transaction statement failed');
  }
}

// ── JSON helpers (replaces JSONB) ──────────────────────────────────────────
export function toJson(val: any): string {
  return JSON.stringify(val ?? null);
}

export function fromJson<T = any>(val: string | null): T | null {
  if (!val) return null;
  try { return JSON.parse(val) as T; } catch { return null; }
}
