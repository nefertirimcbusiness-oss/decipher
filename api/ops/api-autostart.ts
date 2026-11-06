// Keeps the Decipher product API (Express, :8000) alive across machine
// replacements.
//
// WHY THIS FILE EXISTS
// The API used to be started by /etc/profile.d/zz-decipher-api.sh, which the
// platform wipes: `/` is an overlay fs and only /home is a persistent volume,
// so every machine replacement rebuilds /etc. The API therefore stayed dead
// until a human noticed.
//
// The one process that DOES come back on its own after a replacement is this
// site server: the platform's provisioning runs `bun install && bun run dev`
// in /home/team/shared/site on every boot (see the boot-time `bash -lc` in
// `ps aux`). So the site server is the durable trigger: whenever it starts it
// makes sure the API is running. That covers
//   - machine replacement  -> platform boots the site -> this runs -> API up
//   - site server crash/restart -> this runs -> API already up -> no-op
// and it is idempotent: supervise.sh never starts a second listener.
//
// Nothing here blocks: the supervisor is spawned detached, so a slow or
// failing API start can never delay or crash the site server.

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const API_DIR = process.env.DECIPHER_API_DIR || "/home/team/shared/decipher-api";
const SUPERVISE = `${API_DIR}/supervise.sh`;
const HEALTH_URL = "http://127.0.0.1:8000/api/health";
const LOG_FILE = "/home/team/shared/site/.run/api-autostart.log";

function log(source: string, msg: string): void {
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, `${new Date().toISOString()} [${source}] ${msg}\n`);
  } catch {
    /* logging must never break the site */
  }
}

async function healthy(timeoutMs = 1500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The site server carries its own Stripe/env values (site/.env), and dotenv in
// the API does NOT override inherited variables — so a naive spawn would let the
// site's STRIPE_WEBHOOK_SECRET shadow decipher-api/.env and silently change which
// secret signatures are checked against. Strip every key the API reads from its
// own .env; the login shell we spawn through re-exports the platform ones
// (/etc/profile.d) and dotenv fills the rest, which is exactly how the API was
// started before this hook existed.
const SHADOWED_BY_SITE_ENV = [
  "PORT",
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID",
  "STRIPE_COUPON_ID",
  "FRONTEND_URL",
  "OPENAI_API_KEY",
  "SAVID_BASE_URL",
  "SAVID_MODEL",
  "SAVID_FALLBACK_MODELS",
  "GROQ_API_KEY",
];

function supervisorEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of SHADOWED_BY_SITE_ENV) delete env[key];
  return env;
}

/**
 * Ensure the product API is listening on :8000.
 * Returns true when /api/health answers 200. Never throws.
 */
export async function ensureBackend(source = "site"): Promise<boolean> {
  try {
    if (await healthy()) {
      log(source, "API already healthy on :8000 — nothing to do");
      return true;
    }

    log(source, "API not answering on :8000 — starting supervisor");

    // The publish/build sandbox is NOT the team box: it has no /bin/bash and no
    // API directory. Spawning there fails, and an unhandled 'error' event on a
    // ChildProcess crashes the whole site server (which is what broke
    // publish_site). Guard before spawning and always attach an error handler.
    if (!existsSync("/bin/bash") || !existsSync(SUPERVISE)) {
      log(source, `autostart skipped: missing /bin/bash or ${SUPERVISE} (not the team box)`);
      return false;
    }

    // `start` is idempotent and waits for health; `ensure-watchdog` starts the
    // 15s watchdog loop that restarts the API if it dies while the box is up.
    const child = spawn("/bin/bash", ["-lc", `"${SUPERVISE}" start; "${SUPERVISE}" ensure-watchdog`], {
      cwd: API_DIR,
      detached: true,
      stdio: "ignore",
      env: supervisorEnv(),
    });
    child.on("error", (err) => {
      log(source, `supervisor spawn failed: ${err?.message ?? String(err)}`);
    });
    child.unref();

    for (let i = 0; i < 45; i++) {
      if (await healthy(1000)) {
        log(source, `API healthy on :8000 after ~${i}s`);
        return true;
      }
      await sleep(1000);
    }
    log(source, "API did not become healthy within 45s — see decipher-api/supervisor.log");
    return false;
  } catch (err) {
    log(source, `ensureBackend failed: ${(err as Error)?.message ?? String(err)}`);
    return false;
  }
}
