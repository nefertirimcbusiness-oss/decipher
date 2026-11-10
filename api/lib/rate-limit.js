// Per-client abuse limits for the public API.
//
// The store is a Map in this process: the API runs as one process on one box, so
// a shared store would be a database for no benefit. It empties on restart, which
// is fine for request-rate abuse — a client cannot trigger a restart to reset its
// own budget.
//
// Everything here fails CLOSED. If a key cannot be derived, if the store is at
// capacity, or if this file has a bug, the request is answered 429 and the handler
// never runs. A limiter that fails open is worse than none: it advertises
// protection it is not giving.

// Hard ceiling on tracked keys. Reached only by an attacker spraying unique keys
// (unique emails on /login), and the answer then is to refuse new keys — 429 —
// rather than let the map grow until the process dies.
const MAX_KEYS = 20000;

const buckets = new Map(); // `${ruleName}:${key}` -> { count, resetAt }

function prune(now) {
  for (const [id, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(id);
  }
}

function hit(name, key, windowMs, now) {
  const id = `${name}:${key}`;
  let bucket = buckets.get(id);

  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && buckets.size >= MAX_KEYS) {
      prune(now);
      if (buckets.size >= MAX_KEYS) throw new Error('rate-limit store at capacity');
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(id, bucket);
  }

  bucket.count += 1;
  return { count: bucket.count, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

// The client address as the trusted proxy chain reports it.
//
// `index.js` sets `trust proxy` to loopback only, so the only proxy whose
// X-Forwarded-For is believed is the site's own proxy on this box. A caller
// cannot forge an address: the platform edge rewrites the header before the
// request ever reaches us, and a direct connection to the API is not trusted.
export function clientIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return typeof ip === 'string' && ip.length > 0 ? ip : null;
}

// The account a login attempt is aimed at. Attacker-controlled, but keying on it
// is the point: an attacker who rotates addresses still cannot put more than
// `max` attempts against one person's account.
export function emailKey(req) {
  const email = req.body?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

// The signed-in user. Reliable because `auth` runs before these routes.
export function userKey(req) {
  return typeof req.userId === 'string' && req.userId ? req.userId : null;
}

// `rules` is a list of { name, key, windowMs, max, message }. The first rule that
// is over its budget stops the request; every rule is counted, so a caller cannot
// spread load across rules to stay under all of them.
export function rateLimit(rules) {
  return function rateLimitMiddleware(req, res, next) {
    let tripped = null;

    try {
      const now = Date.now();
      for (const rule of rules) {
        const key = rule.key(req);
        if (!key) throw new Error(`no key for rule "${rule.name}"`);
        const result = hit(rule.name, key, rule.windowMs, now);
        if (result.count > rule.max) {
          tripped = { rule, retryAfter: result.retryAfter };
          break;
        }
      }
    } catch (error) {
      // Fail closed: an undecidable request is refused, never waved through.
      console.error(`[rate-limit] failing closed: ${error.message}`);
      res.set('Retry-After', '60');
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
        retry_after: 60
      });
    }

    if (tripped) {
      console.warn(`[rate-limit] ${tripped.rule.name} tripped from ${clientIp(req) || 'unknown'}`);
      res.set('Retry-After', String(tripped.retryAfter));
      return res.status(429).json({ error: tripped.rule.message, retry_after: tripped.retryAfter });
    }

    next();
  };
}

// Test/ops helper: drop all counters. Not wired to any route.
export function resetRateLimits() {
  buckets.clear();
}
