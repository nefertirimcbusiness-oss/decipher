// Public ingress for the product API, served by the team site server.
//
// WHY THIS FILE EXISTS
// The platform edge in front of this sandbox answers every `/api/*` path itself
// ("There is no site at this address", text/plain 404) and never forwards it to
// this server. That is why Stripe webhook deliveries to
// `https://<site-host>/api/webhooks/stripe` failed for days and why the live
// endpoint ended up DISABLED. Every other path IS forwarded, so the API needs a
// public path that does not start with `/api/`; this module provides it and
// proxies to the Node API on loopback.
//
// Two things here are load-bearing:
//   1. The target is 127.0.0.1:8000 explicitly. The older `/api/` proxy block in
//      serve.ts reads BACKEND_URL from site/.env, which points at a dead
//      ctonew.app host, so its `localhost:8000` fallback never runs. This ingress
//      must not depend on that value.
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

// Escape hatch for ordinary API calls, which the edge blocks at `/api/*` too.
// `/svc/<x>` -> `<API_ORIGIN>/api/<x>`, same raw-body rule. Nothing uses it yet:
// the frontend still calls `/api/*`, so those calls are still 404 at the edge.
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
    console.error(`[API ingress] ${req.method} ${target} failed: ${message}`);
    return new Response(
      JSON.stringify({ error: "Backend unavailable", message, target }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
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
