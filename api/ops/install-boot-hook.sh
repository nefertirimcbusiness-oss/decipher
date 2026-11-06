#!/usr/bin/env bash
# Installs the durable API autostart hook into the team site.
#
# WHY: `/` is an overlay filesystem and only /home survives a machine
# replacement, so anything written to /etc (like the old
# /etc/profile.d/zz-decipher-api.sh) is gone after a replacement and the API
# stays dead until a human notices. The one thing the platform brings back on
# its own is the team site server, which it boots from /home on every start
# (`cd /home/team/shared/site && bun install && bun run dev`). This hook hangs
# the API start off that boot, so the API comes back by itself.
#
# Idempotent: safe to run any number of times. Run it again after a site
# template reset or if the hook is ever missing.
set -euo pipefail

SITE_DIR="${SITE_DIR:-/home/team/shared/site}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ -d "$SITE_DIR" ] || { echo "no site dir at $SITE_DIR" >&2; exit 1; }
[ -f "$SITE_DIR/vite.config.ts" ] || { echo "no vite.config.ts in $SITE_DIR" >&2; exit 1; }

cp "$HERE/api-autostart.ts" "$SITE_DIR/api-autostart.ts"
echo "installed $SITE_DIR/api-autostart.ts"

# The API ingress (/stripe/webhook, /svc/*) lives in the site dir too, and the
# site dir is not a git repo — this repo is its only record. Copy it in.
cp "$HERE/site-stripe-ingress.ts" "$SITE_DIR/stripe-ingress.ts"
echo "installed $SITE_DIR/stripe-ingress.ts"

node - "$SITE_DIR" <<'NODE'
const fs = require("fs");
const path = require("path");
const site = process.argv[2];

function patch(file, marker, apply) {
  const p = path.join(site, file);
  const src = fs.readFileSync(p, "utf8");
  if (src.includes(marker)) {
    console.log(`already patched: ${file}`);
    return;
  }
  fs.writeFileSync(p, apply(src));
  console.log(`patched: ${file}`);
}

// vite.config.ts — run the hook when the dev server starts (this is the process
// the platform boots after a machine replacement).
patch("vite.config.ts", "api-autostart", (src) => {
  if (!/^import .*from "\.\/api-autostart";/m.test(src)) {
    const lines = src.split("\n");
    const lastImport = lines.reduce((acc, l, i) => (l.startsWith("import ") ? i : acc), -1);
    lines.splice(lastImport + 1, 0, 'import { ensureBackend } from "./api-autostart";');
    src = lines.join("\n");
  }
  if (!src.includes("decipher-api-autostart")) {
    src = src.replace(
      /(\n\s*)plugins:\s*\[/,
      `$1plugins: [$1  // Durable API autostart: the platform boots this dev server from /home on$1  // every machine replacement, so the API start hangs off that boot.$1  { name: "decipher-api-autostart", configureServer() { void ensureBackend("vite-dev"); } },`
    );
  }
  return src;
});

// serve.ts — same for the production server path (`bun run start`).
patch("serve.ts", "ensureBackend", (src) => {
  if (!/from "\.\/api-autostart"/.test(src)) {
    src = src.replace(
      /^(import handler from "\.\/dist\/server\/server\.js";)$/m,
      '$1\nimport { ensureBackend } from "./api-autostart";'
    );
  }
  if (!/void ensureBackend\(/.test(src)) {
    src += '\n// Durable API autostart — see api-autostart.ts.\nvoid ensureBackend("serve-prod");\n';
  }
  return src;
});

// serve.ts — the public API ingress (/stripe/webhook, /svc/*). Deliberately
// redundant with the /api proxy, and deliberately not dependent on BACKEND_URL:
// it is the path the Stripe dashboard endpoint is pointed at, so it must not be
// able to break because an env var in site/.env is wrong.
patch("serve.ts", "await handleApiIngress", (src) => {
  if (!/from "\.\/stripe-ingress"/.test(src)) {
    src = src.replace(
      /^(import handler from "\.\/dist\/server\/server\.js";)$/m,
      '$1\nimport { handleApiIngress } from "./stripe-ingress";'
    );
  }
  src = src.replace(
    /(async fetch\(req\)[^{]*\{)/,
    '$1\n        const ingress = await handleApiIngress(req);\n        if (ingress) return ingress;'
  );
  return src;
});

// vite.config.ts — the dev server (what the platform boots) must proxy the API
// routes to the Node API on loopback. Present in the template config today; this
// restores it if a site template reset ever drops it.
patch("vite.config.ts", "'/stripe/webhook'", (src) => {
  const entries = [
    "      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },",
    "      '/stripe/webhook': { target: 'http://127.0.0.1:8000', rewrite: () => '/api/webhooks/stripe', changeOrigin: true },",
    "      '/svc': { target: 'http://127.0.0.1:8000', rewrite: (p) => p.replace(/^\\/svc/, '/api'), changeOrigin: true },",
  ].join("\n");
  if (/\bproxy:\s*\{/.test(src)) {
    return src.replace(/\bproxy:\s*\{/, (m) => `${m}\n${entries}`);
  }
  return src.replace(/\bserver:\s*\{/, (m) => `${m}\n    proxy: {\n${entries}\n    },`);
});
NODE

echo
echo "Done. Verify with: $HERE/verify-durability.sh"
