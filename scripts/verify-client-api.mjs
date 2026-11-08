// End-to-end check of the PRODUCT APP's own client code (src/lib/api.ts) against a
// running API — the same code the browser runs, not a re-implementation with curl.
// Node strips the TypeScript types; the browser globals the client touches
// (window, localStorage, File, FormData, fetch) are shimmed or already present.
//
//   node scripts/verify-client-api.mjs                 # against http://127.0.0.1:8000
//   API_BASE=https://<host>/api FILE_BASE=https://<host> node scripts/verify-client-api.mjs
//
// It creates two throwaway accounts, proves cross-user reads are refused, proves an
// entry created with a real file keeps its evidence bytes, proves an edit with a
// reason is stored and appears in the export bundle, then deletes both accounts.
// Exit code 0 only if every check passes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API_BASE || 'http://127.0.0.1:8000/api';
// Evidence files are served from the API ROOT (/uploads), not under /api.
const FILE_BASE = process.env.FILE_BASE || 'http://127.0.0.1:8000';
process.env.NEXT_PUBLIC_API_URL = API;

// --- browser shims -------------------------------------------------------
const store = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = await import(path.join(REPO_ROOT, 'src/lib/api.ts'));
const { auth, entries, savid } = api;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

async function raw(p, opts = {}) {
  const res = await fetch(`${API}${p}`, opts);
  const text = await res.text();
  return { status: res.status, text, res };
}

const ts = Date.now();
const A_EMAIL = `client.a.${ts}@example.com`;
const B_EMAIL = `client.b.${ts}@example.com`;
const PW = 'TestPass123!';

// --- accounts ------------------------------------------------------------
const a = await auth.signup(A_EMAIL, PW, 'A');
const b = await auth.signup(B_EMAIL, PW, 'B');
record('signup A', !!a.token, `userId=${a.userId}`);
record('signup B', !!b.token, `userId=${b.userId}`);

// A is the "logged in" user for the client calls below.
auth.saveSession(a.token, a.userId, A_EMAIL);
record('saveSession token in localStorage', !!localStorage.getItem('decipher_token'), 'ok');

// --- 2. create an entry through the client with a REAL file --------------
const bytes = Buffer.from(`TRAUMA-SAMPLE-BYTES-${ts}-${'x'.repeat(64)}`);
const diskPath = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'decipher-verify-')), 'evidence-sample.bin');
fs.writeFileSync(diskPath, bytes);
const file = new File([fs.readFileSync(diskPath)], 'evidence-sample.bin', { type: 'application/octet-stream' });

const created = await entries.create({ title: 'A private entry', content: 'Original private content', files: [file] });
record('entries.create with a file -> no 500', !!created.id, `entryId=${created.id}`);

const entryId = created.id;
const got = await entries.get(entryId);
const evidenceRows = got.evidence || [];
record('entry has exactly one evidence row', evidenceRows.length === 1, `rows=${evidenceRows.length}`);
const filePath = evidenceRows[0]?.file_path || '';
const fileName = path.basename(filePath);
record('evidence row has a stored path', !!filePath, filePath);

// The bytes themselves: fetch through the API's evidence route as the owner.
const ownerRes = await fetch(`${FILE_BASE}/uploads/${encodeURIComponent(fileName)}`, {
  headers: { Authorization: `Bearer ${a.token}` },
});
const ownerBuf = Buffer.from(await ownerRes.arrayBuffer());
record('owner can read the bytes back', ownerRes.status === 200 && ownerBuf.equals(bytes), `status=${ownerRes.status} ${ownerBuf.length} bytes, identical=${ownerBuf.equals(bytes)}`);

// --- 3. edit through the client with a reason ---------------------------
const reason = `Corrected the date after finding the ticket stub (${ts})`;
let editOk = false;
let editDetail = '';
try {
  const upd = await entries.update(entryId, { title: 'A private entry (corrected)', content: 'Corrected private content', reason });
  editOk = true;
  editDetail = JSON.stringify(upd);
} catch (e) {
  editDetail = `ERROR ${e.message}`;
}
record('entries.update with a reason -> no 404', editOk, editDetail);

const afterEdit = await entries.get(entryId);
const editRows = afterEdit.edits || [];
const storedReason = editRows.map((r) => r.edit_reason);
record('edit reason stored on the entry', storedReason.includes(reason), JSON.stringify(storedReason));

// Export bundle (the privacy-policy "portable copy"), fetched with A's token.
const exp = await raw('/export', { headers: { Authorization: `Bearer ${a.token}` } });
let bundle = null;
try { bundle = JSON.parse(exp.text); } catch {}
const editLog = bundle?.edit_log || bundle?.edits || [];
const reasonsInLog = editLog.map((e) => e.edit_reason);
record('GET /api/export 200', exp.status === 200, `status=${exp.status}`);
record('edit reason appears in export edit log', reasonsInLog.includes(reason), `edit_log entries=${editLog.length} reasons=${JSON.stringify(reasonsInLog)}`);

// --- 1. cross-user Savid read -------------------------------------------
// Give A a real conversation (client path).
const chat = await savid.chat(entryId, 'I keep losing the thread of that day.');
record('savid.chat as owner -> 200', typeof chat.reply === 'string', `reply="${(chat.reply || '').slice(0, 40)}..."`);

const aSavid = await raw(`/savid/${entryId}`, { headers: { Authorization: `Bearer ${a.token}` } });
record('A GET /savid/<own entry> -> 200', aSavid.status === 200, `status=${aSavid.status} rows=${JSON.parse(aSavid.text || '[]').length}`);

const bSavid = await raw(`/savid/${entryId}`, { headers: { Authorization: `Bearer ${b.token}` } });
record('B GET /savid/<A entry> -> 404', bSavid.status === 404, `status=${bSavid.status} body=${bSavid.text.slice(0, 80)}`);

const anonSavid = await raw(`/savid/${entryId}`);
record('anonymous GET /savid/<A entry> -> 401', anonSavid.status === 401, `status=${anonSavid.status}`);

// B on A's entry through the rest of the API (regression sweep).
for (const [label, p, opts] of [
  ['B GET /entries/<A>', `/entries/${entryId}`, {}],
  ['B PUT /entries/<A>', `/entries/${entryId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'hijack', content: 'hijack', reason: 'hijack' }) }],
  ['B DELETE /entries/<A>', `/entries/${entryId}`, { method: 'DELETE' }],
  ['B POST /savid/chat <A>', '/savid/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryId, message: 'leak?' }) }],
]) {
  const r = await raw(p, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${b.token}` } });
  record(`${label} -> 404`, r.status === 404, `status=${r.status}`);
}

// --- evidence file scoping ----------------------------------------------
const bFile = await fetch(`${FILE_BASE}/uploads/${encodeURIComponent(fileName)}`, { headers: { Authorization: `Bearer ${b.token}` } }).then(async (r) => ({ status: r.status, text: await r.text() }));
record('B GET A evidence file -> 404', bFile.status === 404, `status=${bFile.status}`);
const anonFile = await fetch(`${FILE_BASE}/uploads/${encodeURIComponent(fileName)}`).then(async (r) => ({ status: r.status, text: await r.text() }));
record('anonymous GET A evidence file -> 401', anonFile.status === 401, `status=${anonFile.status}`);

// --- 4. cleanup ----------------------------------------------------------
const delA = await raw('/account', { method: 'DELETE', headers: { Authorization: `Bearer ${a.token}` } });
const delB = await raw('/account', { method: 'DELETE', headers: { Authorization: `Bearer ${b.token}` } });
record('DELETE account A -> 200', delA.status === 200, `status=${delA.status} ${delA.text.slice(0, 120)}`);
record('DELETE account B -> 200', delB.status === 200, `status=${delB.status} ${delB.text.slice(0, 120)}`);

const leftover = await raw('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: A_EMAIL, password: PW }),
});
record('A can no longer log in after deletion', leftover.status === 400, `status=${leftover.status}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`A_EMAIL=${A_EMAIL} B_EMAIL=${B_EMAIL} entryId=${entryId} file=${filePath}`);
process.exit(failed.length === 0 ? 0 : 1);
