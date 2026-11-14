// Live proof of the signup gate, the consent record, the upload checks, how
// evidence is served, and that signing out really ends the session.
//
//   node test/verify-safety.mjs   (self-contained: starts its own API)
//
// Every check runs over HTTP against a real instance with its own throwaway
// database and uploads directory, so it proves what a caller meets. Exit code 0
// only if every check passes.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.DECIPHER_TEST_PORT) || 8124;
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'decipher-safety-'));
const DB_PATH = path.join(workdir, 'safety.db');
const UPLOADS_DIR = path.join(workdir, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const child = spawn(process.execPath, ['index.js'], {
  cwd: API_DIR,
  env: {
    ...process.env,
    DECIPHER_API_PORT: String(PORT),
    DECIPHER_DB_PATH: DB_PATH,
    UPLOADS_DIR,
    JWT_SECRET: 'safety-test-secret-0123456789abcdef',
    // No provider, no model call: this test is about uploads and sessions.
    SAVID_API_KEY: '',
    GROQ_API_KEY: '',
    GEMINI_API_KEY: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverLog = '';
child.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
child.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

function stopServer() {
  try { child.kill('SIGKILL'); } catch { /* already gone */ }
  try { fs.rmSync(workdir, { recursive: true, force: true }); } catch { /* best effort */ }
}

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function postJson(pathname, body, token) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function uploadFiles(token, files, fields = { title: 'a page', content: 'the words' }) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const f of files) form.append('evidence', f, f.name);
  const res = await fetch(`${BASE}/api/entries`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function uploadsNow() {
  try { return new Set(fs.readdirSync(UPLOADS_DIR)); } catch { return new Set(); }
}
function leftovers(before) {
  return [...uploadsNow()].filter((name) => !before.has(name));
}

// A real Windows executable: the DOS/PE header a machine recognises as code.
const EXE_BYTES = Buffer.concat([
  Buffer.from('MZ', 'latin1'),
  Buffer.from([0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]),
  Buffer.from('This program cannot be run in DOS mode.\r\n', 'latin1'),
  Buffer.alloc(64, 0x90)
]);

// A 1x1 PNG, byte for byte a real image.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const PW = 'CorrectHorseBattery9!';
const stamp = Date.now();

async function main() {
  if (!(await waitForHealth())) {
    console.error('API did not start. Log:\n' + serverLog);
    stopServer();
    process.exit(1);
  }

  // --- 2. the age gate -----------------------------------------------------
  const underAge = await postJson('/api/auth/signup', {
    email: `minor.${stamp}@example.com`,
    password: PW
  });
  record(
    'signup without affirming 18+ is refused',
    underAge.status === 403 && underAge.json.code === 'ADULT_CONFIRMATION_REQUIRED',
    `status=${underAge.status} code=${underAge.json.code}`
  );
  record(
    'the age gate shows the approved question',
    underAge.json.error === 'Decipher is a space for adults. Are you 18 or older?',
    JSON.stringify(underAge.json.error || '')
  );

  const noConsent = await postJson('/api/auth/signup', {
    email: `noconsent.${stamp}@example.com`,
    password: PW,
    isAdult: true
  });
  record(
    'signup without agreeing to the Terms is refused',
    noConsent.status === 403 && noConsent.json.code === 'TERMS_ACCEPTANCE_REQUIRED',
    `status=${noConsent.status} code=${noConsent.json.code}`
  );

  // Neither refusal may have created a row.
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const refusedRows = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE email LIKE ?")
    .get(`%.${stamp}@example.com`);
  record('no account exists for either refused signup', refusedRows.n === 0, `rows=${refusedRows.n}`);

  // --- 2 + 3. a real signup records the age and the consent ----------------
  const email = `safety.probe.${stamp}@example.com`;
  const signup = await postJson('/api/auth/signup', {
    email,
    password: PW,
    isAdult: true,
    acceptedTerms: true
  });
  record('signup with both confirmations succeeds', signup.status === 201, `status=${signup.status}`);
  const token = signup.json.token;

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  record('is_adult is stored on the user row', row && row.is_adult === 1, `is_adult=${row && row.is_adult}`);
  record('terms_version is stored as v1', row && row.terms_version === 'v1', `terms_version=${row && row.terms_version}`);
  const acceptedAt = row && row.terms_accepted_at;
  record(
    'terms_accepted_at is a UTC ISO timestamp from now',
    typeof acceptedAt === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(acceptedAt) &&
      Math.abs(Date.now() - Date.parse(acceptedAt)) < 5 * 60 * 1000,
    `terms_accepted_at=${acceptedAt}`
  );
  record(
    'accepted_ip is recorded',
    row && typeof row.accepted_ip === 'string' && row.accepted_ip.length > 0,
    `accepted_ip=${row && row.accepted_ip}`
  );

  // --- 4. the upload hole --------------------------------------------------
  let snapshot = uploadsNow();
  const exeAsOctet = await uploadFiles(token, [
    new File([EXE_BYTES], 'evidence.exe', { type: 'application/octet-stream' })
  ]);
  record(
    'a real .exe declared as octet-stream is refused with 415',
    exeAsOctet.status === 415,
    `status=${exeAsOctet.status} ${exeAsOctet.json.error || ''}`
  );
  record('the refused .exe left nothing on disk', leftovers(snapshot).length === 0, `new files=${JSON.stringify(leftovers(snapshot))}`);

  snapshot = uploadsNow();
  const exeRenamed = await uploadFiles(token, [
    new File([EXE_BYTES], 'holiday-photo.jpg', { type: 'image/jpeg' })
  ]);
  record(
    'an .exe renamed to .jpg and declared image/jpeg is refused with 415',
    exeRenamed.status === 415,
    `status=${exeRenamed.status} ${exeRenamed.json.error || ''}`
  );
  record('the renamed .exe left nothing on disk', leftovers(snapshot).length === 0, `new files=${JSON.stringify(leftovers(snapshot))}`);

  snapshot = uploadsNow();
  const htmlAsText = await uploadFiles(token, [
    new File([Buffer.from('<html><script>alert(document.cookie)</script></html>')], 'notes.txt', { type: 'text/plain' })
  ]);
  record(
    'an HTML page renamed to .txt is refused with 415',
    htmlAsText.status === 415,
    `status=${htmlAsText.status} ${htmlAsText.json.error || ''}`
  );
  record('the refused HTML left nothing on disk', leftovers(snapshot).length === 0, `new files=${JSON.stringify(leftovers(snapshot))}`);

  // An honest photo still gets through, and is stored as what it is.
  const goodUpload = await uploadFiles(token, [
    new File([PNG_BYTES], 'kitchen.png', { type: 'image/png' })
  ]);
  record('a real PNG is still accepted', goodUpload.status === 201, `status=${goodUpload.status} ${goodUpload.json.error || ''}`);

  // --- 5. how evidence is served ------------------------------------------
  const entryRes = await fetch(`${BASE}/api/entries/${goodUpload.json.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const entry = await entryRes.json().catch(() => ({}));
  const evidence = (entry.evidence || [])[0];
  record(
    'the stored type is the one we determined, not the one declared',
    evidence && evidence.file_type === 'image/png',
    `file_type=${evidence && evidence.file_type}`
  );

  const name = path.basename((evidence && evidence.file_path) || '');
  const fileRes = await fetch(`${BASE}/uploads/${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const servedBytes = Buffer.from(await fileRes.arrayBuffer());
  record('evidence is served to its owner', fileRes.status === 200, `status=${fileRes.status}`);
  record(
    'evidence is served as an attachment, never inline',
    (fileRes.headers.get('content-disposition') || '').startsWith('attachment'),
    `content-disposition=${fileRes.headers.get('content-disposition')}`
  );
  record(
    'evidence is served with nosniff',
    fileRes.headers.get('x-content-type-options') === 'nosniff',
    `x-content-type-options=${fileRes.headers.get('x-content-type-options')}`
  );
  record(
    'evidence is served with a fixed safe type',
    fileRes.headers.get('content-type') === 'image/png',
    `content-type=${fileRes.headers.get('content-type')}`
  );
  record(
    'a stored payload cannot run as a page (sandboxed, no scripts)',
    (fileRes.headers.get('content-security-policy') || '').includes("default-src 'none'"),
    `content-security-policy=${fileRes.headers.get('content-security-policy')}`
  );
  record('the file served is the file stored', servedBytes.equals(PNG_BYTES), `bytes=${servedBytes.length}`);

  // Someone else's file is not theirs to fetch.
  const strangerSignup = await postJson('/api/auth/signup', {
    email: `stranger.${stamp}@example.com`,
    password: PW,
    isAdult: true,
    acceptedTerms: true
  });
  const strangerRes = await fetch(`${BASE}/uploads/${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${strangerSignup.json.token}` }
  });
  record("another user cannot fetch someone else's evidence", strangerRes.status === 404, `status=${strangerRes.status}`);

  // --- 7. signing out ------------------------------------------------------
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  const ttlHours = (payload.exp - payload.iat) / 3600;
  record('the session token has a short lifetime', ttlHours <= 24, `ttl=${ttlHours}h`);

  // A second, independent session, to show signing out ends one and not all.
  const login = await postJson('/api/auth/login', { email, password: PW });
  const otherToken = login.json.token;
  record('a second session can be opened', login.status === 200 && !!otherToken, `status=${login.status}`);

  const beforeLogout = await fetch(`${BASE}/api/entries`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  record('the token works before signing out', beforeLogout.status === 200, `status=${beforeLogout.status}`);

  const logout = await postJson('/api/auth/logout', {}, token);
  record('signing out is accepted', logout.status === 200, `status=${logout.status}`);

  const afterLogout = await fetch(`${BASE}/api/entries`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  record(
    'the signed-out token is refused afterwards',
    afterLogout.status === 401,
    `status=${afterLogout.status} ${(await afterLogout.json().catch(() => ({}))).error || ''}`
  );

  const uploadAfterLogout = await uploadFiles(token, [
    new File([PNG_BYTES], 'after-logout.png', { type: 'image/png' })
  ]);
  record(
    'the signed-out token cannot write either',
    uploadAfterLogout.status === 401,
    `status=${uploadAfterLogout.status}`
  );

  const otherStillWorks = await fetch(`${BASE}/api/entries`, {
    headers: { Authorization: `Bearer ${otherToken}` }
  });
  record(
    'the other session is untouched by that sign-out',
    otherStillWorks.status === 200,
    `status=${otherStillWorks.status}`
  );

  db.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} safety checks passed`);
  stopServer();
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  stopServer();
  process.exit(1);
});
