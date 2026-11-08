// The product's own database.
//
// This used to shell out to the `team-db` CLI for every single statement, which
// meant every user, entry (trauma journals), Savid conversation and evidence
// record was written into the TEAM'S SHARED COORDINATION DATABASE — the same file
// that holds the task board — and pushed to a remote Turso replica on every query.
// The product now owns a private SQLite file: local disk, no sync, no shared file.
//
// The file lives under the API directory (which is inside /home, the part of this
// machine that survives a machine replacement) and is created on first boot by
// init-db.js, so "the file does not exist yet" is a normal, handled state.
//
// Parameters are bound by the driver, never interpolated into SQL text.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DECIPHER_DB_PATH is an escape hatch for tests and one-off instances. The default
// is module-relative, so whichever copy of the API is running owns the database
// next to itself: the live one at decipher-api/data/decipher.db.
export const DB_PATH = process.env.DECIPHER_DB_PATH
  ? path.resolve(process.env.DECIPHER_DB_PATH)
  : path.join(__dirname, 'data', 'decipher.db');

function open() {
  // "File does not exist yet" is the normal first-boot case.
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const handle = new DatabaseSync(DB_PATH);
  // WAL keeps readers from blocking on writers and survives a hard kill; the
  // busy timeout makes two processes (API + a verification script) wait rather
  // than fail with SQLITE_BUSY.
  handle.exec('PRAGMA journal_mode = WAL');
  handle.exec('PRAGMA busy_timeout = 5000');
  handle.exec('PRAGMA foreign_keys = ON');
  handle.exec('PRAGMA synchronous = NORMAL');
  return handle;
}

export const db = open();

// Prepared statements are cached because most statements in this API are the same
// handful of shapes run over and over. The cache is capped so that dynamic SQL
// (the export route builds `IN (?, ?, …)` lists of varying length) cannot grow it
// without bound.
const CACHE_LIMIT = 200;
const statements = new Map();

function prepare(sql) {
  let statement = statements.get(sql);
  if (statement) return statement;
  statement = db.prepare(sql);
  if (statements.size >= CACHE_LIMIT) statements.clear();
  statements.set(sql, statement);
  return statement;
}

// node:sqlite accepts only null, number, bigint, string, Uint8Array. The old
// team-db layer stringified booleans and objects; keep accepting them so callers
// do not have to care, but never build SQL text out of them.
function bindable(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return value;
  return JSON.stringify(value);
}

/**
 * Run one statement and return its rows (an empty array for statements that
 * return none — INSERT/UPDATE/DELETE/DDL). Throws on any SQL error, as the old
 * layer did, so failures are never swallowed.
 *
 * @param {string} sql   single statement, `?` placeholders
 * @param {Array}  params values bound to those placeholders
 * @returns {Array<object>}
 */
export function query(sql, params = []) {
  const bound = (params || []).map(bindable);
  try {
    return prepare(sql).all(...bound);
  } catch (error) {
    console.error('Database error:', error.message);
    throw error;
  }
}

/** Convenience for statements where only the number of changed rows matters. */
export function execute(sql, params = []) {
  const bound = (params || []).map(bindable);
  try {
    return prepare(sql).run(...bound);
  } catch (error) {
    console.error('Database error:', error.message);
    throw error;
  }
}

/** Close the handle — used by short-lived scripts, not by the server. */
export function close() {
  statements.clear();
  db.close();
}
