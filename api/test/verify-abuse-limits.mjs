// Live proof of the abuse limits on the public API.
//
//   API_BASE=https://<host>/api node test/verify-abuse-limits.mjs
//   API_BASE=http://127.0.0.1:8000/api node test/verify-abuse-limits.mjs
//
// Everything runs over HTTP against a running API, so it proves the limits a real
// caller meets — not the limiter's internals. Exit code 0 only if every check
// passes. It creates one throwaway account, floods the three public routes until
// each answers 429, proves the three upload rejections, and deletes the account.
//
// The flood counts are above the configured maxima on purpose: the platform edge
// in front of the public hostname presents more than one address, so a per-address
// budget is shared between a couple of buckets.
import fs from 'node:fs';
import path from 'node:path';

const API = (process.env.API_BASE || 'http://127.0.0.1:8000/api').replace(/\/+$/, '');
const UPLOADS = process.env.UPLOADS_DIR
  || path.resolve(process.env.DECIPHER_API_DIR || '/home/team/shared/decipher-api', 'uploads');

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

const stamp = Date.now();
const EMAIL = `abuse.probe.${stamp}@example.com`;
const PW = 'CorrectHorseBattery9!';

async function post(pathname, body, token) {
  const res = await fetch(`${API}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// --- 1. signup flood -----------------------------------------------------
// Same address every time, so at most one account is created; the rest are
// "already exists" (400) and still count against the budget.
let signupToken = null;
let signupCreated = 0;
let signup429 = null;
for (let i = 1; i <= 45; i += 1) {
  const r = await post('/auth/signup', { email: EMAIL, password: PW, isAdult: true, acceptedTerms: true });
  if (r.status === 201) { signupCreated += 1; signupToken = r.json.token; }
  if (r.status === 429) { signup429 = { i, body: r.json }; break; }
}
record(
  'POST /auth/signup floods -> 429',
  !!signup429 && signup429.i <= 45,
  signup429 ? `429 on request ${signup429.i}: ${signup429.body.error}` : 'never returned 429'
);
record('signup flood created at most one account', signupCreated <= 1, `accounts created=${signupCreated}`);

// --- 2. login flood ------------------------------------------------------
// Keyed on the address being attempted, so this trips even when the caller's
// own address changes.
let login429 = null;
for (let i = 1; i <= 25; i += 1) {
  const r = await post('/auth/login', { email: `victim.${stamp}@example.com`, password: 'wrong-password' });
  if (r.status === 429) { login429 = { i, body: r.json }; break; }
}
record(
  'POST /auth/login floods -> 429',
  !!login429 && login429.i <= 25,
  login429 ? `429 on request ${login429.i}: ${login429.body.error}` : 'never returned 429'
);

if (!signupToken) {
  record('have a token for the upload + chat checks', false, 'signup never succeeded');
  process.exit(1);
}

// --- 3. Savid chat flood -------------------------------------------------
// A malformed body is refused with 400 by the handler but still costs a request
// against the budget — no AI call is made, which keeps the probe cheap.
let chat429 = null;
for (let i = 1; i <= 40; i += 1) {
  const r = await post('/savid/chat', {}, signupToken);
  if (r.status === 429) { chat429 = { i, body: r.json }; break; }
}
record(
  'POST /savid/chat floods -> 429',
  !!chat429 && chat429.i <= 40,
  chat429 ? `429 on request ${chat429.i}: ${chat429.body.error}` : 'never returned 429'
);

// --- 4. upload limits ----------------------------------------------------
async function upload(files) {
  const form = new FormData();
  form.append('title', 'abuse probe');
  form.append('content', 'probe');
  for (const f of files) form.append('evidence', f, f.name);
  const res = await fetch(`${API}/entries`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${signupToken}` },
    body: form,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function before() {
  try { return new Set(fs.readdirSync(UPLOADS)); } catch { return new Set(); }
}
function leftovers(beforeSet) {
  const now = before();
  return [...now].filter((f) => !beforeSet.has(f));
}

// A single file over the per-file cap: refused mid-stream, partial file removed.
const big = new File([Buffer.alloc(26 * 1024 * 1024, 7)], 'too-big.jpg', { type: 'image/jpeg' });
let snapshot = before();
const bigRes = await upload([big]);
record(
  'oversized file -> 413',
  bigRes.status === 413,
  `status=${bigRes.status} ${bigRes.json.error || ''}`
);
record('oversized file left nothing on disk', leftovers(snapshot).length === 0, `new files=${JSON.stringify(leftovers(snapshot))}`);

// More files than an entry may carry.
const many = Array.from({ length: 6 }, (_, i) => new File([Buffer.from('x')], `note-${i}.txt`, { type: 'text/plain' }));
snapshot = before();
const manyRes = await upload(many);
record(
  'too many files -> 413',
  manyRes.status === 413,
  `status=${manyRes.status} ${manyRes.json.error || ''}`
);
record('too many files left nothing on disk', leftovers(snapshot).length === 0, `new files=${JSON.stringify(leftovers(snapshot))}`);

// A type that is not evidence (and that a browser would execute).
const html = new File([Buffer.from('<script>alert(1)</script>')], 'payload.html', { type: 'text/html' });
snapshot = before();
const htmlRes = await upload([html]);
record(
  'unexpected file type -> 415',
  htmlRes.status === 415,
  `status=${htmlRes.status} ${htmlRes.json.error || ''}`
);
record('rejected type left nothing on disk', leftovers(snapshot).length === 0, `new files=${JSON.stringify(leftovers(snapshot))}`);

// --- cleanup -------------------------------------------------------------
const del = await fetch(`${API}/account`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${signupToken}` },
});
record('probe account deleted', del.status === 200, `status=${del.status}`);

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} abuse-limit checks passed`);
process.exit(passed === results.length ? 0 : 1);
