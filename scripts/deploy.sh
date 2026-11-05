#!/usr/bin/env bash
# Decipher product app — one-command production deploy.
#
# Ships whatever is on origin/main to Vercel production, then verifies the
# result against the live URL. This exists because the Vercel project has NO
# Git integration, so merging a PR to main does NOT deploy anything by itself.
#
# Usage:
#   VERCEL_TOKEN=... bash scripts/deploy.sh          # deploy origin/main
#   VERCEL_TOKEN=... bash scripts/deploy.sh --sha <commit>   # deploy a specific commit
#   bash scripts/deploy.sh --verify-only             # only run the live checks
#
# Exit codes: 0 = deployed and verified, non-zero = something is wrong (the
# error is printed; the script does not retry blindly).
set -uo pipefail

PROJECT_ID="prj_ju65TMkqGNHGQuRt3iKvYPPN421X"
ORG_ID="team_xZANYaO9IGtpSMuOUiDCGiOJ"
PROD_URL="https://decipher-repo.vercel.app"
API_HEALTH_DEFAULT="https://eb044699c4cc4dada8cc7727a5002ea2-dev.ctonew.app/api/health"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VERCEL_API="https://api.vercel.com"

TARGET_REF="origin/main"
VERIFY_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --sha) TARGET_REF="$2"; shift 2 ;;
    --verify-only) VERIFY_ONLY=1; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
die()   { red "ERROR: $*"; exit 1; }

# --- helpers ---------------------------------------------------------------

api_get() { # api_get <path>
  curl -s -m 30 -H "Authorization: Bearer $VERCEL_TOKEN" "$VERCEL_API$1"
}

latest_prod_deployment() {
  api_get "/v6/deployments?projectId=$PROJECT_ID&teamId=$ORG_ID&target=production&limit=1"
}

# Pull the API base URL that the app is compiled to call, from source.
source_api_base() {
  grep -o 'https://[a-zA-Z0-9._-]*/api' "$REPO_ROOT/src/lib/api.ts" | head -1
}

# --- verification (runs against the live URL, never against CLI output) -----

verify_live() {
  local expected_sha="${1:-}"
  local failures=0

  bold "== Verifying $PROD_URL =="

  # 1. What commit is production actually serving?
  #    The deployments list can lag a fresh deploy by a few seconds, so poll.
  local dep sha attempt
  for attempt in $(seq 1 12); do
    dep="$(latest_prod_deployment)"
    sha="$(printf '%s' "$dep" | python3 -c \
      'import sys,json;d=json.load(sys.stdin);print((d.get("deployments") or [{}])[0].get("meta",{}).get("githubCommitSha",""))' 2>/dev/null)"
    if [ -n "$sha" ] && { [ -z "$expected_sha" ] || [ "$sha" = "$expected_sha" ]; }; then
      break
    fi
    sleep 5
  done
  if [ -n "$sha" ]; then
    echo "production deployment commit: $sha"
    if [ -n "$expected_sha" ] && [ "$sha" != "$expected_sha" ]; then
      red "  ✗ production is serving $sha, expected $expected_sha"
      failures=$((failures+1))
    else
      green "  ✓ production is serving the expected commit"
    fi
  else
    red "  ✗ could not read the deployed commit from the Vercel API"
    failures=$((failures+1))
  fi

  # 2. Pages must return 200.
  local p code
  for p in / /subscribe /success /cancel /signup /login /dashboard; do
    code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' "$PROD_URL$p")"
    if [ "$code" = "200" ]; then
      green "  ✓ $p -> 200"
    else
      red "  ✗ $p -> $code"
      failures=$((failures+1))
    fi
  done

  # 3. The served JS bundle must reference the reachable backend, and that
  #    backend must answer. This is the check that catches a stale build.
  local want_chunk_base tmp api_base
  want_chunk_base="$(source_api_base)"
  tmp="$(mktemp -d)"
  {
    for p in / /subscribe /success /cancel /signup /dashboard; do
      curl -s -m 30 "$PROD_URL$p"
    done | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u
  } > "$tmp/chunks.txt"
  if [ ! -s "$tmp/chunks.txt" ]; then
    red "  ✗ could not find any JS chunks in the served pages"
    failures=$((failures+1))
  else
    while read -r c; do
      curl -s -m 30 "$PROD_URL$c" -o "$tmp/$(basename "$c")"
    done < "$tmp/chunks.txt"
    api_base="$(grep -ho 'https://[a-zA-Z0-9._-]*\.\(ctonew\.app\|cto\.site\)/api' "$tmp"/*.js | sort -u | head -1)"
    if [ -z "$api_base" ]; then
      red "  ✗ no API base URL found in the served JS bundle"
      failures=$((failures+1))
    elif [ -n "$want_chunk_base" ] && [ "$api_base" != "$want_chunk_base" ]; then
      red "  ✗ served JS calls $api_base but src/lib/api.ts says $want_chunk_base (stale build)"
      failures=$((failures+1))
    else
      green "  ✓ served JS calls $api_base (matches source)"
    fi
    local health="${api_base%/}/health"
    code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' "$health")"
    if [ "$code" = "200" ]; then
      green "  ✓ backend $health -> 200"
    else
      red "  ✗ backend $health -> $code (app would load but every call would fail)"
      failures=$((failures+1))
    fi
    # CORS: the browser origin must be allowed by the backend.
    code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' -X OPTIONS "${api_base%/}/auth/login" \
      -H "Origin: $PROD_URL" -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type')"
    if [ "$code" = "204" ] || [ "$code" = "200" ]; then
      green "  ✓ backend allows CORS from $PROD_URL"
    else
      red "  ✗ backend CORS preflight from $PROD_URL -> $code"
      failures=$((failures+1))
    fi
  fi
  rm -rf "$tmp"

  echo
  if [ "$failures" -eq 0 ]; then
    green "VERIFIED: production is healthy and serving the expected commit."
    return 0
  fi
  red "VERIFICATION FAILED ($failures check(s))."
  return 1
}

# --- main ------------------------------------------------------------------

if [ "$VERIFY_ONLY" -eq 1 ]; then
  [ -n "${VERCEL_TOKEN:-}" ] || die "VERCEL_TOKEN is not set"
  verify_live "$(git -C "$REPO_ROOT" rev-parse origin/main 2>/dev/null || true)"
  exit $?
fi

[ -n "${VERCEL_TOKEN:-}" ] || die "VERCEL_TOKEN is not set (it is an environment variable on the team box)"
command -v git >/dev/null || die "git not found"
command -v curl >/dev/null || die "curl not found"

cd "$REPO_ROOT" || die "cannot cd to $REPO_ROOT"

bold "== Resolving $TARGET_REF =="
git fetch origin main --quiet || die "git fetch failed (check GitHub credentials)"
if [ "$TARGET_REF" = "origin/main" ]; then
  SHA="$(git rev-parse origin/main)"
else
  SHA="$(git rev-parse "$TARGET_REF^{commit}")" || die "cannot resolve $TARGET_REF"
fi
SUBJECT="$(git log -1 --format=%s "$SHA")"
echo "deploying $SHA — $SUBJECT"

# Build from a throwaway worktree so the shared working tree is never touched.
WORKTREE="$(mktemp -d)/src"
cleanup() { git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || rm -rf "$WORKTREE"; }
trap cleanup EXIT
git worktree add --detach "$WORKTREE" "$SHA" --quiet || die "could not create a worktree for $SHA"

# .vercel/project.json is gitignored, so recreate the project link.
mkdir -p "$WORKTREE/.vercel"
printf '{"projectId":"%s","orgId":"%s","projectName":"decipher-repo"}\n' "$PROJECT_ID" "$ORG_ID" \
  > "$WORKTREE/.vercel/project.json"

# --- vercel CLI: use it if present, otherwise install into a temp prefix -----
VCLI="$(command -v vercel || true)"
if [ -z "$VCLI" ]; then
  VCLI="${TMPDIR:-/tmp}/decipher-vcli/node_modules/.bin/vercel"
  if [ ! -x "$VCLI" ]; then
    bold "== Installing Vercel CLI into ${TMPDIR:-/tmp}/decipher-vcli =="
    mkdir -p "${TMPDIR:-/tmp}/decipher-vcli"
    ( cd "${TMPDIR:-/tmp}/decipher-vcli" && npm install vercel --no-save --no-audit --no-fund >/tmp/decipher-vcli-install.log 2>&1 ) \
      || die "npm install vercel failed, see /tmp/decipher-vcli-install.log"
  fi
fi

bold "== Deploying to production =="
# The commit metadata is set explicitly: we deploy from a worktree, and the CLI
# only auto-detects git metadata from a normal checkout. Without this the
# deployment would carry no record of which commit it came from, and the
# verification below could not tell a fresh build from a stale one.
( cd "$WORKTREE" && "$VCLI" deploy --prod --yes --token "$VERCEL_TOKEN" \
    --meta "githubCommitSha=$SHA" \
    --meta "githubCommitRef=main" \
    --meta "githubCommitOrg=nefertirimcbusiness-oss" \
    --meta "githubCommitRepo=decipher" \
    --meta "githubCommitMessage=$SUBJECT" 2>&1 ) | tee /tmp/decipher-deploy.log
DEPLOY_RC="${PIPESTATUS[0]}"
[ "$DEPLOY_RC" -eq 0 ] || die "vercel deploy failed (exit $DEPLOY_RC) — see /tmp/decipher-deploy.log"

# Aliasing is asynchronous; give the alias a moment to settle.
sleep 10

verify_live "$SHA"
