// Public ingress for the product API, served by the team site server.
//
// WHY THIS FILE EXISTS
// Redundancy, not a workaround for a blocked path. `/api/*` IS forwarded by the
// platform edge to this server (verified 2026-11-05 — an earlier note in this
// file blamed the edge; that was wrong). What actually broke Stripe deliveries
// was this server's own `/api/` proxy in serve.ts, whose BACKEND_URL in site/.env
// pointed at a retired `...-dev.ctonew.app` host, so `/api/webhooks/stripe`
// answered 502/404 and the live endpoint ended up DISABLED.
//
// This ingress gives the webhook a public path that does not depend on that
// proxy, so a bad BACKEND_URL can never take payments down again.
//
// Two things here are load-bearing:
//   1. The target is 127.0.0.1:8000 explicitly, never BACKEND_URL. The API is a
//      process on this box; there is no remote backend to fall back to.
//   2. The body is forwarded as raw bytes (`arrayBuffer`), never via `req.text()`
//      plus a rebuilt body. Stripe signs the exact payload bytes, so any
//      decode/encode round-trip can invalidate the signature.
//
// Installed into the site dir by api/ops/install-boot-hook.sh, which also patches
// serve.ts to call it. The canonical copy lives in the repo at
// api/ops/site-stripe-ingress.ts — edit that one, not this copy.

const API_ORIGIN = "http://127.0.0.1:8000";

// Public path Stripe should be pointed at. Stable: it is what the Stripe
// dashboard endpoint URL must be set to.
export const STRIPE_WEBHOOK_PATH = "/stripe/webhook";

const STRIPE_WEBHOOK_TARGET = `${API_ORIGIN}/api/webhooks/stripe`;

// Escape hatch for ordinary API calls: `/svc/<x>` -> `<API_ORIGIN>/api/<x>`, same
// raw-body rule. Redundant with the `/api/` proxy in serve.ts — kept so there is
// always a public API path that does not depend on BACKEND_URL.
const API_ESCAPE_PREFIX = "/svc/";

// Hop-by-hop headers describe the connection we terminate, not the request.
// content-length must be recomputed for the body we actually send, and
// accept-encoding is dropped so the backend replies uncompressed.
const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
  "expect",
  "accept-encoding",
]);

// Forward a request to the API preserving method, headers (stripe-signature
// included, untouched) and the exact raw body bytes.
async function proxyRaw(req: Request, target: string): Promise<Response> {
  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  }

  const body =
    req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined;

  try {
    const res = await fetch(target, { method: req.method, headers, body });
    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    // Log the target and the cause here; return neither. Telling the caller the
    // internal address of the backend turns a transient outage into a map of
    // this box for anyone who can trigger it.
    console.error(`[API ingress] ${req.method} ${target} failed: ${message}`);
    return new Response(JSON.stringify({ error: "Backend unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Handle requests that must reach the API. Returns null for anything that is
 * not an ingress path, so serve.ts can carry on to static files and SSR.
 */
export async function handleApiIngress(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const { pathname } = url;

  if (pathname === STRIPE_WEBHOOK_PATH || pathname === `${STRIPE_WEBHOOK_PATH}/`) {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "POST", "Content-Type": "text/plain" },
      });
    }
    return proxyRaw(req, STRIPE_WEBHOOK_TARGET);
  }

  if (pathname.startsWith(API_ESCAPE_PREFIX)) {
    const rest = pathname.slice(API_ESCAPE_PREFIX.length);
    return proxyRaw(req, `${API_ORIGIN}/api/${rest}${url.search}`);
  }

  return null;
}
