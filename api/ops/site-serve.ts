// Production server for the built site. The TanStack Start build emits a portable
// fetch handler (dist/server/server.js) plus static client assets (dist/client);
// this wraps them in a Bun server on port 3000 — static files first, SSR for the
// rest. Run `bun run build` before starting. Restart it with `bun run publish`.
//
// Starting a new instance supersedes the old one: it frees the port no matter
// which user owns the current server (provisioning starts it as `engine`; a team
// member's `bun run publish` runs as their own user), so publish never collides
// with an already-running server. Every sandbox user has passwordless sudo, so
// the takeover works across user boundaries.
import handler from "./dist/server/server.js";
import { ensureBackend } from "./api-autostart";
import { handleApiIngress } from "./stripe-ingress";

// Pinned, NOT read from the environment. The published preview URL
// (<label>.<PUBLIC_SITE_DOMAIN>) is reverse-proxied to 0.0.0.0:3000 inside the
// sandbox, so the default site MUST bind there. Bun auto-loads .env files, so
// honouring process.env.PORT/HOST would let a stray env var or a .env in the site
// dir silently move the site off :3000 (or onto loopback) and break the public URL.
const PORT = 3000;
const HOST = "0.0.0.0";
const CLIENT_DIR = `${import.meta.dir}/dist/client`;

// ── Security headers ─────────────────────────────────────────────────────────
// Applied to every response this server produces: static assets, SSR pages and
// the /api proxy alike. They used to be absent entirely — a page on this origin
// could be framed by any site, and a browser was free to sniff a .txt upload as
// something executable.
//
// What the policy deliberately allows, and why (each one checked against the
// built site in a browser, not copied from a template):
//   script-src 'unsafe-inline'  TanStack Start inlines its hydration bootstrap
//     into every SSR page. With a bare `script-src 'self'` the browser refuses
//     to run it: the HTML paints but never hydrates, so every button and link on
//     the site is dead. Remote scripts are still restricted to our own origin,
//     which is the part that blocks an injected third-party script.
//   style-src 'unsafe-inline'   Tailwind/React emit inline <style> and style
//     attributes; blocking them breaks the layout.
//   img-src data: blob:         inline data-URI artwork and favicons.
//   connect-src 'self'          the only fetches this site makes are same-origin
//     (the /api proxy), so nothing external needs to be reachable.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
].join("; ");

const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Content-Security-Policy", CSP],
  // frame-ancestors above is the modern control; this is for older browsers.
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
];

// Build a new Response rather than mutating the existing one: the /api proxy
// passes the API's own Headers object straight through, and those are immutable.
function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [name, value] of SECURITY_HEADERS) headers.set(name, value);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

// Free PORT regardless of which user owns the current listener. lsof runs under
// sudo so it can see (and the kill can signal) a process owned by another user;
// the loop waits for the socket to actually release before we bind.
const freePort =
  `for _ in $(seq 1 25); do ` +
  `pids=$(lsof -t -iTCP:${String(PORT)} -sTCP:LISTEN 2>/dev/null || true); ` +
  `if [ -z "$pids" ]; then exit 0; fi; ` +
  `kill $pids 2>/dev/null || true; sleep 0.2; ` +
  `done`;

// Take over the port, re-freeing and retrying if another publish grabbed it in the
// gap between freeing and binding (last publish wins). Bun.serve throws EADDRINUSE
// synchronously, so without this a raced publish would die while the shell already
// reported success.
for (let attempt = 1; ; attempt++) {
  await Bun.$`sudo sh -c ${freePort}`.quiet().nothrow();
  try {
    Bun.serve({
      port: PORT,
      hostname: HOST,
      async fetch(req) {
        return withSecurityHeaders(await route(req));
      },
    });
    break;
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}

// The actual request routing, kept separate from Bun.serve so every exit path
// (including the API proxy and the 502) goes through withSecurityHeaders.
async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;

  // Redundant ingress for the Stripe webhook and /svc/*, which must keep
  // working even if the /api proxy below is ever misconfigured. See
  // stripe-ingress.ts.
  const ingress = await handleApiIngress(req);
  if (ingress) return ingress;

  // Proxy API requests to the Node API on this box. `/api/*` IS forwarded
  // by the platform edge (verified 2026-11-05); what used to 404 was this
  // proxy, when site/.env pointed BACKEND_URL at a retired host.
  if (pathname.startsWith("/api/")) {
    const host = req.headers.get("host") || "";
    // Loopback, always. The API is a process on this machine — there is no
    // remote backend, and the retired `...-dev.ctonew.app` host that used
    // to be the fallback here is exactly the landmine that took the app
    // down silently. Keep the host in the log line so a wrong BACKEND_URL
    // in site/.env is visible rather than mysterious.
    const backendBaseUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
    console.log(`[API Proxy] ${req.method} ${pathname} host=${host} -> ${backendBaseUrl}`);

    const backendUrl = `${backendBaseUrl}${pathname}${url.search}`;
    try {
      // Raw bytes, never `req.text()`. Decoding the body as UTF-8 and
      // re-encoding it replaces every byte that is not valid UTF-8 with
      // U+FFFD, which silently corrupts binary uploads (evidence files) on
      // their way to the API — the stored file is bigger than the original
      // and unusable. `stripe-ingress.ts` already forwards raw for exactly
      // this reason; this proxy must do the same.
      const backendRes = await fetch(backendUrl, {
        method: req.method,
        headers: req.headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined,
      });
      return new Response(backendRes.body, {
        status: backendRes.status,
        headers: backendRes.headers,
      });
    } catch (err: any) {
      // The target and the underlying error are for our logs only. Handing them
      // to the caller told anyone who could make the API unreachable the internal
      // address and port of the backend.
      console.error(`[API Proxy] ${req.method} ${pathname} failed: target=${backendUrl} ${err?.message ?? err}`);
      return new Response(JSON.stringify({ error: "Backend unavailable" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (pathname !== "/") {
    const file = Bun.file(CLIENT_DIR + pathname);
    if (await file.exists()) return new Response(file);
  }
  return (handler as { fetch: (r: Request) => Response | Promise<Response> }).fetch(req);
}

console.log(`team-site serving on http://${HOST}:${String(PORT)}`);
// Same durable autostart as the dev server: this process is what the platform
// brings back after a machine replacement, so it also brings the API back.
// Detached and non-blocking — the site never waits on the API.
void ensureBackend("serve-prod");
