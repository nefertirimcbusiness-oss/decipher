#!/usr/bin/env bash
# Proves the API comes back without any human action after the processes on this
# box are lost — the part of a machine replacement we can simulate here.
#
# It kills the API and its watchdog (what a replacement destroys), confirms the
# public URL is down, then restarts the site server the way the platform does on
# boot (touching vite.config.ts makes the running dev server restart itself —
# the same `configureServer` hook that fires on a real boot) and checks that the
# API and the public URL come back on their own.
#
# Usage: bash api/ops/verify-durability.sh [public-url]
set -uo pipefail

API_DIR="${API_DIR:-/home/team/shared/decipher-api}"
SITE_DIR="${SITE_DIR:-/home/team/shared/site}"
PUBLIC="${1:-https://eb044699c4cc4dada8cc7727a5002ea2-dev.cto.site}"

code() { curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$@"; }
say() { printf '%s\n' "$*"; }

say "1. state before:"
say "   api pid:      $(pgrep -f 'node inde[x].js' | tr '\n' ' ')"
say "   watchdog pid: $(pgrep -f 'supervise[.]sh watchdo[g]' | tr '\n' ' ')"
say "   public /api/health: $(code "$PUBLIC/api/health")"

say "2. killing the API and the watchdog (simulating a machine replacement):"
pkill -f 'supervise[.]sh watchdo[g]' 2>/dev/null
"$API_DIR/supervise.sh" stop >/dev/null 2>&1
sleep 2
say "   api pid:      $(pgrep -f 'node inde[x].js' | tr '\n' ' ')(empty = down)"
say "   local /api/health:  $(code "http://127.0.0.1:8000/api/health")"
say "   public /api/health: $(code "$PUBLIC/api/health")   <- the outage a customer would see"

say "3. restarting the site server the way the platform does on boot:"
touch "$SITE_DIR/vite.config.ts"
for _ in $(seq 1 30); do
  [ "$(code "http://127.0.0.1:8000/api/health")" = "200" ] && break
  sleep 1
done

say "4. state after (no human action taken):"
sleep 3 # `ensure-watchdog` runs just after `start` returns
say "   api pid:      $(pgrep -f 'node inde[x].js' | tr '\n' ' ')"
say "   watchdog pid: $(pgrep -f 'supervise[.]sh watchdo[g]' | tr '\n' ' ')"
say "   local /api/health:  $(code "http://127.0.0.1:8000/api/health")"
say "   public /api/health: $(code "$PUBLIC/api/health")"
say "   autostart log: $SITE_DIR/.run/api-autostart.log"
tail -3 "$SITE_DIR/.run/api-autostart.log" 2>/dev/null | sed 's/^/     /'
