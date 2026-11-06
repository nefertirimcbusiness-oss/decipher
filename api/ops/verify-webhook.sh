#!/usr/bin/env bash
# Proves the Stripe webhook is reachable from the public internet and that the
# signature check still works through the site proxy.
#
# WHY THIS EXISTS
# The platform edge answers every `/api/*` path itself ("There is no site at this
# address", text/plain 404) and never forwards it into the sandbox. Stripe was
# pointed at `https://<site-host>/api/webhooks/stripe`, so every delivery failed
# and Stripe disabled the endpoint. The webhook is now served on `/stripe/webhook`
# (a path the edge DOES forward) by `stripe-ingress.ts`, which proxies the raw
# bytes to the Node API on 127.0.0.1:8000.
#
# This script sends three requests to the PUBLIC hostname:
#   1. unsigned                -> 400 (signature missing)
#   2. correctly signed        -> 200 {"received":true}
#   3. tampered payload        -> 400 (signature mismatch)
#
# All three use event type "ping", which the handler's switch does not match, so
# NO database row is written. It is safe to run against live data.
#
# Usage:
#   bash api/ops/verify-webhook.sh [site-host]
#   default host: the working site, <label>-dev.<site-domain>
set -uo pipefail

TARGET_HOST="${1:-${TARGET_HOST:-eb044699c4cc4dada8cc7727a5002ea2-dev.cto.site}}"
URL="https://${TARGET_HOST}/stripe/webhook"
ENV_FILE="${ENV_FILE:-/home/team/shared/decipher-api/.env}"

# NOTE: do not call this variable HOST. The sandbox exports HOST=0.0.0.0 globally
# and it would silently override any default (same trap as PORT).
[ -f "$ENV_FILE" ] || { echo "no env file at $ENV_FILE" >&2; exit 1; }
SECRET="$(grep '^STRIPE_WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r\n')"
[ -n "$SECRET" ] || { echo "STRIPE_WEBHOOK_SECRET not found in $ENV_FILE" >&2; exit 1; }

TS="$(date +%s)"
PAYLOAD="{\"id\":\"evt_smoke_${TS}\",\"object\":\"event\",\"api_version\":\"2026-07-29.dahlia\",\"created\":${TS},\"livemode\":true,\"type\":\"ping\",\"data\":{\"object\":{\"id\":\"sub_nonexistent_smoke\",\"object\":\"subscription\"}}}"
sign() { printf '%s' "${TS}.${1}" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1; }
SIG="t=${TS},v1=$(sign "$PAYLOAD")"
TAMPERED="${PAYLOAD/ping/pong}"

fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "  PASS  $1 -> $3"; else echo "  FAIL  $1 -> $3 (expected $2)"; fail=1; fi
}

echo "target:  $URL"
echo "payload: $PAYLOAD"
echo "secret:  ${SECRET:0:10}… (from $ENV_FILE)"
echo

echo "1) unsigned POST"
code="$(curl -s -m 25 -o /tmp/wh-1.txt -w '%{http_code}' -X POST \
  -H 'content-type: application/json' -d "$PAYLOAD" "$URL")"
check "unsigned" 400 "$code"

echo "2) correctly signed POST"
code="$(curl -s -m 25 -o /tmp/wh-2.txt -w '%{http_code}' -X POST \
  -H 'content-type: application/json' -H "stripe-signature: $SIG" -d "$PAYLOAD" "$URL")"
check "signed" 200 "$code"
echo "       body: $(head -c 60 /tmp/wh-2.txt)"

echo "3) tampered payload, original signature"
code="$(curl -s -m 25 -o /tmp/wh-3.txt -w '%{http_code}' -X POST \
  -H 'content-type: application/json' -H "stripe-signature: $SIG" -d "$TAMPERED" "$URL")"
check "tampered" 400 "$code"

echo
if [ "$fail" -eq 0 ]; then
  echo "RESULT: webhook ingress is healthy on the public hostname."
  echo "        Point the Stripe endpoint at: $URL"
else
  echo "RESULT: FAILED — see the codes above." >&2
  echo "        Is the API up (decipher-api/supervise.sh status) and the site server running?" >&2
fi
exit "$fail"
