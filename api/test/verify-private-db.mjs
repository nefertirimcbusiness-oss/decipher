// Regression check for the two critical audit findings:
//
//   1. the API must read and write its OWN database file, not the team's shared
//      coordination database (which also synced to a remote replica), and
//   2. a token signed with a published fallback secret must be refused — the
//      process must not accept any secret other than the one configured.
//
// It also walks the whole product path once (signup -> login -> entry with a file
// -> edit with a reason -> export -> delete account) against a running API.
//
//   node test/verify-private-db.mjs                       # http://127.0.0.1:8000
//   BASE_URL=http://127.0.0.1:8000 node test/verify-private-db.mjs
//
// Exit code 0 only if every check passes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const API = `${BASE}/api`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

async function api(pathname, { method = 'GET', token, body, raw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !raw) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${pathname}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, text, json };
}

// --- 1. the database is private -------------------------------------------
const { DB_PATH } = await import('../db.js');
record('API database is not the shared team database', !DB_PATH.includes('/.data/'), DB_PATH);
record('API database is under /home (survives a machine swap)', DB_PATH.startsWith('/home/'), DB_PATH);
record('API database file exists', fs.existsSync(DB_PATH), `${fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0} bytes`);

// --- 2. published fallback secrets are refused ----------------------------
const stamp = Date.now();
const email = `private-db.${stamp}@example.com`;
const password = 'correct-horse-battery-staple';

const signup = await api('/auth/signup', { method: 'POST', body: { email, password, isAdult: true, acceptedTerms: true } });
record('signup', signup.status === 201 && !!signup.json?.userId, `status=${signup.status} userId=${signup.json?.userId}`);
const userId = signup.json?.userId;

const login = await api('/auth/login', { method: 'POST', body: { email, password } });
record('login', login.status === 200 && !!login.json?.token, `status=${login.status}`);
const legitToken = login.json?.token;

const legit = await api('/entries', { token: legitToken });
record('legit token -> 200 on /api/entries', legit.status === 200, `status=${legit.status}`);

for (const published of ['your-secret-key', 'decipher-secret-2026']) {
  const forged = jwt.sign({ userId }, published, { expiresIn: '1h' });
  const res = await api('/entries', { token: forged });
  record(
    `token signed with "${published}" -> 401`,
    res.status === 401,
    `status=${res.status} body=${res.text.slice(0, 60)}`
  );
}

// --- 3. the product path end to end ---------------------------------------
const form = new FormData();
form.append('title', 'A morning at the lake');
form.append('content', 'I remember the cold of the dock. (verify run)');
form.append('evidence', new Blob([Buffer.from('evidence bytes for verify-private-db')], { type: 'text/plain' }), 'lake.txt');
const created = await api('/entries', { method: 'POST', token: legitToken, body: form, raw: true });
record('create entry with a file', created.status === 201 && !!created.json?.id, `status=${created.status} id=${created.json?.id}`);
const entryId = created.json?.id;

const detail = await api(`/entries/${entryId}`, { token: legitToken });
record('entry reads back with one evidence row', (detail.json?.evidence?.length ?? 0) === 1, `rows=${detail.json?.evidence?.length}`);

const edit = await api(`/entries/${entryId}`, {
  method: 'PUT',
  token: legitToken,
  body: { title: 'A morning at the lake', content: 'I remember the cold of the dock, and the heron.', reason: 'Added the heron I saw on the dock' },
});
record('edit with a reason', edit.status === 200, `status=${edit.status}`);

const exported = await api('/export', { token: legitToken });
const bundle = exported.json;
const reasons = JSON.stringify(bundle?.edit_log ?? bundle?.edits ?? []);
record('export contains the edit reason', exported.status === 200 && reasons.includes('Added the heron'), `status=${exported.status} bytes=${exported.text.length}`);

// --- 4. rows really are in the private file, and only there ---------------
const { DatabaseSync } = await import('node:sqlite');
const handle = new DatabaseSync(DB_PATH, { readOnly: true });
const count = (sql, params = []) => handle.prepare(sql).get(...params)?.n ?? 0;
record('private DB holds the new user row', count('SELECT COUNT(*) AS n FROM users WHERE id = ?', [userId]) === 1, `users rows for id=${userId}`);
record('private DB holds the new entry row', count('SELECT COUNT(*) AS n FROM entries WHERE id = ?', [entryId]) === 1, `entries rows for id=${entryId}`);
handle.close();

const del = await api('/account', { method: 'DELETE', token: legitToken });
record('delete account', del.status === 200, `status=${del.status} ${del.text.slice(0, 80)}`);

const afterDelete = await api('/auth/login', { method: 'POST', body: { email, password } });
record('account is gone after deletion', afterDelete.status === 400, `status=${afterDelete.status}`);

const handle2 = new DatabaseSync(DB_PATH, { readOnly: true });
const left = handle2.prepare('SELECT COUNT(*) AS n FROM users WHERE id = ?').get(userId)?.n ?? 0;
handle2.close();
record('no rows left behind for the deleted account', left === 0, `users rows=${left}`);

// --- summary ---------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log('FAILED: ' + failed.map((f) => f.name).join('; '));
  process.exit(1);
}
