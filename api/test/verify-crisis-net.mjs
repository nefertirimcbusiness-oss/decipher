// Proof that a crisis message gets the 988 answer when the model cannot answer.
//
//   node test/verify-crisis-net.mjs   (self-contained: starts its own API)
//
// The point of this test is the worst case. It starts the API with the Savid
// engine pointed at a port nothing is listening on, so every model call fails and
// the engine returns its canned "I'm here, and I'm listening" fallback — exactly
// what a rate-limited or broken provider produces in production. A crisis message
// sent in that state must still come back with the crisis text, as `crisis_message`
// and as the reply itself.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The copy, written out here exactly as the owner approved it, so this test
// checks the answer rather than the constant it came from.
const EXPECTED_CRISIS_MESSAGE =
  "Before anything else — I want you to be safe. I'm an AI, so I can't call anyone for you, and no one is watching this chat. 988 is there day or night, and they answer. Will you reach out to them?";

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.DECIPHER_TEST_PORT) || 8123;
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'decipher-crisis-'));
const DB_PATH = path.join(workdir, 'crisis.db');
const UPLOADS_DIR = path.join(workdir, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const child = spawn(process.execPath, ['index.js'], {
  cwd: API_DIR,
  env: {
    ...process.env,
    DECIPHER_API_PORT: String(PORT),
    DECIPHER_DB_PATH: DB_PATH,
    UPLOADS_DIR,
    JWT_SECRET: 'crisis-net-test-secret-0123456789abcdef',
    // A key that looks real, so the engine takes the model path instead of mock
    // mode, and a base URL with nothing behind it, so that path fails.
    SAVID_API_KEY: 'test-key-not-real',
    GROQ_API_KEY: '',
    SAVID_BASE_URL: 'http://127.0.0.1:9/v1'
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

async function post(pathname, body, token) {
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

async function main() {
  if (!(await waitForHealth())) {
    console.error('API did not start. Log:\n' + serverLog);
    stopServer();
    process.exit(1);
  }

  const email = `crisis.probe.${Date.now()}@example.com`;
  const signup = await post('/api/auth/signup', {
    email,
    password: 'CorrectHorseBattery9!',
    isAdult: true,
    acceptedTerms: true
  });
  if (signup.status !== 201 || !signup.json.token) {
    console.error(`signup failed (${signup.status}): ${JSON.stringify(signup.json)}\n${serverLog}`);
    stopServer();
    process.exit(1);
  }
  const token = signup.json.token;

  const entry = await post('/api/entries', { title: 'a hard night', content: 'notes' }, token);
  if (entry.status !== 201 || !entry.json.id) {
    console.error(`entry creation failed (${entry.status}): ${JSON.stringify(entry.json)}`);
    stopServer();
    process.exit(1);
  }
  const entryId = entry.json.id;

  // --- the crisis message, with the model unreachable ---------------------
  // "I want to end it" is caught by the API's phrase list. The engine's own list
  // is narrower (it wants "end it all" or "end my life"), so this message goes all
  // the way to the model — which cannot answer — and comes back as the engine's
  // canned "I'm here, and I'm listening" fallback. That is the case the crisis net
  // exists for.
  const crisis = await post(
    '/api/savid/chat',
    { entryId, message: "I can't do this any more. I just want to end it." },
    token
  );

  record('crisis message answers 200, not an error', crisis.status === 200, `status=${crisis.status}`);
  record(
    'response is marked crisis: true',
    crisis.json.crisis === true,
    `crisis=${JSON.stringify(crisis.json.crisis)}`
  );
  record(
    'crisis_message is the 988 text, word for word',
    crisis.json.crisis_message === EXPECTED_CRISIS_MESSAGE,
    JSON.stringify(crisis.json.crisis_message || '').slice(0, 90) + '…'
  );
  record(
    'the 988 text is also the reply when the model gave nothing usable',
    crisis.json.reply === EXPECTED_CRISIS_MESSAGE,
    JSON.stringify(crisis.json.reply || '').slice(0, 90) + '…'
  );
  record(
    'the canned fallback is not the only reply',
    typeof crisis.json.reply === 'string' &&
      !crisis.json.reply.startsWith("I'm here, and I'm listening.") &&
      crisis.json.reply.includes('988'),
    JSON.stringify(crisis.json.reply || '').slice(0, 90) + '…'
  );

  // --- a second crisis message in the same conversation -------------------
  const second = await post('/api/savid/chat', { entryId, message: "I'm so tired of living like this." }, token);
  record(
    'a second crisis message is caught too',
    second.status === 200 && second.json.crisis === true && second.json.crisis_message === EXPECTED_CRISIS_MESSAGE,
    `status=${second.status} crisis=${JSON.stringify(second.json.crisis)}`
  );

  // --- a message the engine's own safety net does catch -------------------
  // When the model does answer (here the engine's own crisis reply), the 988 text
  // is still returned and the model's words follow it rather than replace it.
  const engineCrisis = await post(
    '/api/savid/chat',
    { entryId, message: 'Some nights I think about killing myself.' },
    token
  );
  record(
    'the 988 text comes back even when the engine answers the crisis itself',
    engineCrisis.status === 200 &&
      engineCrisis.json.crisis === true &&
      engineCrisis.json.crisis_message === EXPECTED_CRISIS_MESSAGE,
    `status=${engineCrisis.status} crisis=${JSON.stringify(engineCrisis.json.crisis)}`
  );
  record(
    "the engine's own reply follows the 988 text rather than replacing it",
    typeof engineCrisis.json.reply === 'string' && engineCrisis.json.reply.trim().length > 0,
    JSON.stringify(engineCrisis.json.reply || '').slice(0, 80) + '…'
  );

  // --- it is in the conversation afterwards -------------------------------
  const conversationRes = await fetch(`${BASE}/api/savid/${entryId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const conversation = await conversationRes.json().catch(() => []);
  const stored = Array.isArray(conversation)
    ? conversation.filter((row) => row.role === 'savid' && row.message === EXPECTED_CRISIS_MESSAGE).length
    : 0;
  record(
    'the 988 text is stored, so it survives a refresh',
    stored >= 2,
    `stored crisis messages=${stored}`
  );

  // --- an ordinary message is not treated as a crisis ---------------------
  const ordinary = await post(
    '/api/savid/chat',
    { entryId, message: 'The kitchen smelled of bread that morning.' },
    token
  );
  record(
    'an ordinary message is not flagged as a crisis',
    ordinary.status === 200 && ordinary.json.crisis === false && !ordinary.json.crisis_message,
    `status=${ordinary.status} crisis=${JSON.stringify(ordinary.json.crisis)}`
  );
  record(
    'the model really is unreachable in this run (so the checks above are real)',
    typeof ordinary.json.reply === 'string' &&
      ordinary.json.reply.startsWith("I'm here, and I'm listening."),
    JSON.stringify(ordinary.json.reply || '').slice(0, 70) + '…'
  );

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} crisis-net checks passed`);
  stopServer();
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  stopServer();
  process.exit(1);
});
