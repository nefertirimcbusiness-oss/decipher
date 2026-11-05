#!/usr/bin/env node
// End-to-end proof that deletion actually deletes.
//
// Runs against a *running* API instance (point BASE_URL at it) and inspects the
// real uploads directory and the real team-db database, so every claim is checked
// against observable state rather than the API's own response body.
//
//   BASE_URL=http://127.0.0.1:8123 \
//   UPLOADS_DIR=/tmp/decipher-api-test/uploads \
//   STRIPE_TEST_KEY=sk_test_... \
//   node test/verify-deletion.mjs
//
// STRIPE_TEST_KEY is optional: without it the account-deletion test still runs but
// uses a subscription row with no Stripe id, and the Stripe cancellation path is
// reported as NOT exercised here (it is covered by test/stripe-cancel-branches.mjs).
//
// Every user and Stripe object it creates is removed at the end.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const UPLOADS = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');
const TEST_KEY = process.env.STRIPE_TEST_KEY || '';
const TAG = `${Date.now()}-${process.pid}`;
const PASSWORD = 'test-password-123';

let failures = 0;
const createdUserIds = [];
const stripeCleanup = [];

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`PASS  ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function sql(statement) {
  const out = execFileSync('team-db', [statement], { encoding: 'utf8' });
  const trimmed = (out || '').trim();
  return trimmed ? JSON.parse(trimmed) : [];
}
const v = (x) => (x === null || x === undefined ? 'NULL' : typeof x === 'number' ? String(x) : `'${String(x).replace(/'/g, "''")}'`);
const count = (statement) => Number(Object.values(sql(statement)[0] ?? { n: 0 })[0] ?? 0);

function lsUploads() {
  try {
    return fs.readdirSync(UPLOADS).sort();
  } catch {
    return [];
  }
}

async function api(method, route, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined)
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function signup(email) {
  const res = await api('POST', '/api/auth/signup', { body: { email, password: PASSWORD } });
  if (res.status !== 201) throw new Error(`signup failed for ${email}: ${res.status} ${JSON.stringify(res.json)}`);
  createdUserIds.push(res.json.userId);
  return res.json;
}

async function createEntryWithFile(token, label) {
  const form = new FormData();
  form.append('title', label);
  form.append('content', 'a memory with evidence');
  form.append('evidence', new Blob([Buffer.from(`evidence payload for ${label}`)], { type: 'text/plain' }), `${label}.txt`);
  const res = await api('POST', '/api/entries', { token, form });
  if (res.status !== 201) throw new Error(`entry create failed: ${res.status} ${JSON.stringify(res.json)}`);
  return res.json.id;
}

async function stripe(pathname, params, method) {
  const verb = method ?? (params ? 'POST' : 'GET');
  const res = await fetch(`https://api.stripe.com/v1/${pathname}`, {
    method: verb,
    headers: {
      Authorization: `Bearer ${TEST_KEY}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
    },
    body: params ? new URLSearchParams(params).toString() : undefined
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${pathname} ${res.status}: ${json.error?.message}`);
  return json;
}

// --- baseline -----------------------------------------------------------------
const baseline = {
  users: count('SELECT COUNT(*) AS n FROM users'),
  entries: count('SELECT COUNT(*) AS n FROM entries'),
  evidence_files: count('SELECT COUNT(*) AS n FROM evidence_files'),
  edits: count('SELECT COUNT(*) AS n FROM edits'),
  savid_conversations: count('SELECT COUNT(*) AS n FROM savid_conversations'),
  subscriptions: count('SELECT COUNT(*) AS n FROM subscriptions')
};
console.log('baseline row counts:', JSON.stringify(baseline));
console.log('uploads before any test:', JSON.stringify(lsUploads()));

const health = await api('GET', '/api/health');
check('API reachable', health.status === 200, `${BASE} -> ${health.status}`);

// =============================================================================
// TEST 1 — deleting an ENTRY removes its evidence file from disk
// =============================================================================
console.log('\n=== TEST 1: entry deletion removes the file on disk ===');
const userA = await signup(`deletion-test-a-${TAG}@example.invalid`);
const entryA = await createEntryWithFile(userA.token, 'a-entry');

const evidenceRowsA = sql(
  `SELECT file_path FROM evidence_files WHERE entry_id = ${v(entryA)}`
);
const storedPathA = evidenceRowsA[0]?.file_path;
const absoluteA = path.isAbsolute(storedPathA) ? storedPathA : path.resolve(process.cwd(), storedPathA);
console.log('evidence_files.file_path =', storedPathA);
console.log('resolved absolute path    =', absoluteA);
check('entry row exists', count(`SELECT COUNT(*) AS n FROM entries WHERE id = ${v(entryA)}`) === 1);
check('evidence row exists', evidenceRowsA.length === 1);
check('file exists on disk BEFORE delete', fs.existsSync(absoluteA), `ls uploads: ${JSON.stringify(lsUploads())}`);

const unauthDelete = await api('DELETE', `/api/entries/${entryA}`);
check('unauthenticated entry delete refused (401)', unauthDelete.status === 401, `status ${unauthDelete.status}`);

const delA = await api('DELETE', `/api/entries/${entryA}`, { token: userA.token });
check('DELETE /api/entries/:id returns 200', delA.status === 200, JSON.stringify(delA.json));
check('entry row gone', count(`SELECT COUNT(*) AS n FROM entries WHERE id = ${v(entryA)}`) === 0);
check('evidence row gone', count(`SELECT COUNT(*) AS n FROM evidence_files WHERE entry_id = ${v(entryA)}`) === 0);
check('file gone from disk AFTER delete', !fs.existsSync(absoluteA), `ls uploads: ${JSON.stringify(lsUploads())}`);

// 1b — a file that is already missing must not crash or 500
const entryA2 = await createEntryWithFile(userA.token, 'a-entry2');
const pathA2 = sql(`SELECT file_path FROM evidence_files WHERE entry_id = ${v(entryA2)}`)[0].file_path;
const absA2 = path.isAbsolute(pathA2) ? pathA2 : path.resolve(process.cwd(), pathA2);
fs.unlinkSync(absA2);
const delA2 = await api('DELETE', `/api/entries/${entryA2}`, { token: userA.token });
check('deleting an entry whose file is already gone returns 200 (no 500)', delA2.status === 200, JSON.stringify(delA2.json));
check('its rows are gone too', count(`SELECT COUNT(*) AS n FROM entries WHERE id = ${v(entryA2)}`) === 0);

// =============================================================================
// TEST 2 — ACCOUNT DELETION removes rows in every table + the file, cancels Stripe
// =============================================================================
console.log('\n=== TEST 2: account deletion ===');

// A Stripe TEST-MODE subscription (livemode false, no real money) so the
// cancellation path is really executed rather than assumed.
let testSubId = null;
if (TEST_KEY) {
  const customer = await stripe('customers', { email: `deletion-test-b-${TAG}@example.invalid` });
  stripeCleanup.push(async () => { await stripe(`customers/${customer.id}`, undefined, 'DELETE'); });
  const product = await stripe('products', { name: `decipher-deletion-test-${TAG}` });
  stripeCleanup.push(async () => { await stripe(`products/${product.id}`, { active: 'false' }); });
  const price = await stripe('prices', {
    product: product.id, currency: 'usd', unit_amount: '2499', 'recurring[interval]': 'month'
  });
  const sub = await stripe('subscriptions', {
    customer: customer.id, 'items[0][price]': price.id, trial_period_days: '7',
    payment_behavior: 'default_incomplete'
  });
  testSubId = sub.id;
  check('created Stripe TEST-MODE subscription', sub.livemode === false, `id ${sub.id}, livemode=${sub.livemode}, status ${sub.status}`);
}

const userB = await signup(`deletion-test-b-${TAG}@example.invalid`);
const entryB = await createEntryWithFile(userB.token, 'b-entry');
const pathB = sql(`SELECT file_path FROM evidence_files WHERE entry_id = ${v(entryB)}`)[0].file_path;
const absB = path.isAbsolute(pathB) ? pathB : path.resolve(process.cwd(), pathB);
sql(`INSERT INTO edits (id, entry_id, previous_content, edit_reason) VALUES (${v('edit-' + TAG)}, ${v(entryB)}, ${v('old text')}, ${v('fixing a typo')})`);
sql(`INSERT INTO savid_conversations (id, entry_id, role, message) VALUES (${v('msg-' + TAG)}, ${v(entryB)}, ${v('savid')}, ${v('what did that remind you of?')})`);
sql(`INSERT INTO subscriptions (id, user_id, stripe_subscription_id, status, plan_id, current_period_end) VALUES (${v('sub-' + TAG)}, ${v(userB.userId)}, ${v(testSubId ?? 'sub_placeholder_' + TAG)}, ${v(testSubId ? 'trialing' : 'trialing')}, ${v('price_test')}, ${v('2026-12-01 00:00:00')})`);

const userC = await signup(`deletion-test-c-${TAG}@example.invalid`);
const entryC = await createEntryWithFile(userC.token, 'c-entry');
const pathC = sql(`SELECT file_path FROM evidence_files WHERE entry_id = ${v(entryC)}`)[0].file_path;
const absC = path.isAbsolute(pathC) ? pathC : path.resolve(process.cwd(), pathC);

// --- auth isolation: C's token must delete only C, never B --------------------
const noToken = await api('DELETE', '/api/account');
check('DELETE /api/account without a token refused (401)', noToken.status === 401, `status ${noToken.status}`);

const deleteC = await api('DELETE', '/api/account', { token: userC.token });
check("C's own account delete returns 200", deleteC.status === 200, JSON.stringify(deleteC.json));
check('C is gone', count(`SELECT COUNT(*) AS n FROM users WHERE id = ${v(userC.userId)}`) === 0);
check("C's file is gone", !fs.existsSync(absC));
check('AUTH ISOLATION: B still exists after C deleted their own account',
  count(`SELECT COUNT(*) AS n FROM users WHERE id = ${v(userB.userId)}`) === 1);
check('AUTH ISOLATION: B\'s entry still exists', count(`SELECT COUNT(*) AS n FROM entries WHERE id = ${v(entryB)}`) === 1);
check("AUTH ISOLATION: B's file still on disk", fs.existsSync(absB));

// --- the real account deletion for B ----------------------------------------
console.log(`B before delete: entries=${count(`SELECT COUNT(*) AS n FROM entries WHERE user_id = ${v(userB.userId)}`)} `
  + `evidence=${count(`SELECT COUNT(*) AS n FROM evidence_files WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ${v(userB.userId)})`)} `
  + `edits=${count(`SELECT COUNT(*) AS n FROM edits WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ${v(userB.userId)})`)} `
  + `savid=${count(`SELECT COUNT(*) AS n FROM savid_conversations WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ${v(userB.userId)})`)} `
  + `subs=${count(`SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ${v(userB.userId)}`)} `
  + `file=${fs.existsSync(absB)}`);

const deleteB = await api('DELETE', '/api/account', { token: userB.token });
check('DELETE /api/account for B returns 200', deleteB.status === 200, JSON.stringify(deleteB.json));

check('users row gone', count(`SELECT COUNT(*) AS n FROM users WHERE id = ${v(userB.userId)}`) === 0);
check('entries gone', count(`SELECT COUNT(*) AS n FROM entries WHERE user_id = ${v(userB.userId)}`) === 0);
check('evidence_files gone', count(`SELECT COUNT(*) AS n FROM evidence_files WHERE entry_id = ${v(entryB)}`) === 0);
check('edits gone', count(`SELECT COUNT(*) AS n FROM edits WHERE entry_id = ${v(entryB)}`) === 0);
check('savid_conversations gone', count(`SELECT COUNT(*) AS n FROM savid_conversations WHERE entry_id = ${v(entryB)}`) === 0);
check('subscriptions row gone', count(`SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ${v(userB.userId)}`) === 0);
check("B's evidence file gone from disk", !fs.existsSync(absB), `ls uploads: ${JSON.stringify(lsUploads())}`);

if (TEST_KEY && testSubId) {
  const after = await stripe(`subscriptions/${testSubId}`);
  check('Stripe TEST-MODE subscription is canceled', after.status === 'canceled',
    `status=${after.status}, canceled_at=${after.canceled_at}, livemode=${after.livemode}`);
} else {
  console.log('SKIP  Stripe cancellation not exercised here (no STRIPE_TEST_KEY provided).');
}

// --- a deleted account's still-valid token cannot write new data ------------
const staleWrite = await api('POST', '/api/entries', { token: userB.token, form: (() => {
  const f = new FormData();
  f.append('title', 'after deletion');
  f.append('content', 'should never be stored');
  return f;
})() });
check("deleted user's stale token cannot create entries (401)", staleWrite.status === 401, `status ${staleWrite.status} ${JSON.stringify(staleWrite.json)}`);
check('no rows were created for the deleted user', count(`SELECT COUNT(*) AS n FROM entries WHERE user_id = ${v(userB.userId)}`) === 0);

// =============================================================================
// cleanup
// =============================================================================
console.log('\n=== cleanup ===');
for (const userId of createdUserIds) {
  const still = count(`SELECT COUNT(*) AS n FROM users WHERE id = ${v(userId)}`);
  if (still > 0) {
    // Remove through the endpoint when we still hold a token, otherwise by SQL.
    sql(`DELETE FROM savid_conversations WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ${v(userId)})`);
    sql(`DELETE FROM edits WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ${v(userId)})`);
    sql(`DELETE FROM evidence_files WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ${v(userId)})`);
    sql(`DELETE FROM entries WHERE user_id = ${v(userId)}`);
    sql(`DELETE FROM subscriptions WHERE user_id = ${v(userId)}`);
    sql(`DELETE FROM users WHERE id = ${v(userId)}`);
  }
}
for (const fn of stripeCleanup) {
  try { await fn(); } catch (e) { console.log('stripe cleanup note:', e.message); }
}

const final = {
  users: count('SELECT COUNT(*) AS n FROM users'),
  entries: count('SELECT COUNT(*) AS n FROM entries'),
  evidence_files: count('SELECT COUNT(*) AS n FROM evidence_files'),
  edits: count('SELECT COUNT(*) AS n FROM edits'),
  savid_conversations: count('SELECT COUNT(*) AS n FROM savid_conversations'),
  subscriptions: count('SELECT COUNT(*) AS n FROM subscriptions')
};
console.log('final row counts:   ', JSON.stringify(final));
console.log('uploads after cleanup:', JSON.stringify(lsUploads()));
check('database row counts back to baseline', JSON.stringify(final) === JSON.stringify(baseline), JSON.stringify(final));
check('no test users left behind',
  count(`SELECT COUNT(*) AS n FROM users WHERE email LIKE '%deletion-test-%'`) === 0);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
