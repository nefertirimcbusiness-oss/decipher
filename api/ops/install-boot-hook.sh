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

# Public webhook ingress. The platform edge 404s every /api/* path before it
# reaches the site server, so Stripe cannot POST to /api/webhooks/stripe from the
# internet. stripe-ingress.ts serves the webhook on /stripe/webhook instead and
# proxies the raw bytes to 127.0.0.1:8000. Installed here because a site template
# reset would otherwise silently drop the route and webhooks would fail again.
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

// serve.ts — route the public webhook path (and /svc/*) to the API before static
// files and SSR. Idempotent via the handleApiIngress marker.
patch("serve.ts", "handleApiIngress", (src) => {
  if (!/from "\.\/stripe-ingress"/.test(src)) {
    if (/^import \{ ensureBackend \} from "\.\/api-autostart";$/m.test(src)) {
      src = src.replace(
        /^(import \{ ensureBackend \} from "\.\/api-autostart";)$/m,
        '$1\nimport { handleApiIngress } from "./stripe-ingress";'
      );
    } else {
      src = src.replace(
        /^(import handler from "\.\/dist\/server\/server\.js";)$/m,
        '$1\nimport { handleApiIngress } from "./stripe-ingress";'
      );
    }
  }
  if (!/handleApiIngress\(req\)/.test(src)) {
    src = src.replace(
      /(async fetch\(req\) \{\n)/,
      '$1        // The edge blocks /api/* before it reaches us; see stripe-ingress.ts.\n        const ingress = await handleApiIngress(req);\n        if (ingress) return ingress;\n\n'
    );
  }
  return src;
});
NODE

echo
echo "Done. Verify with: $HERE/verify-durability.sh"
