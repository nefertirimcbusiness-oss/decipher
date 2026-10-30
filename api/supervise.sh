#!/usr/bin/env bash
# Decipher API supervisor — keeps `node index.js` alive on port 8000.
#
#   ./supervise.sh start             start if not already listening (idempotent)
#   ./supervise.sh stop              stop the API
#   ./supervise.sh restart           stop, then start
#   ./supervise.sh status            is it up? who is listening? last log lines
#   ./supervise.sh watchdog          foreground loop: restart the API whenever it dies
#   ./supervise.sh ensure-watchdog   start the watchdog in the background if it is not running
#   ./supervise.sh install-autostart install a login-shell hook so the watchdog comes back
#                                    after a machine replacement (needs root; /etc/profile.d)
#
# Nothing here duplicates a running server: every start path first checks whether
# something is already listening on the port.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# index.js hardcodes its listen port; the login shell may export an unrelated
# PORT (this box exports PORT=80), so never inherit it here.
PORT=8000
APP_LOG="$DIR/output.log"
SUP_LOG="$DIR/supervisor.log"
PIDFILE="$DIR/.api.pid"
WATCHDOG_PATTERN="supervise.sh watchdog"
AUTOSTART_FILE="/etc/profile.d/zz-decipher-api.sh"

# The server reads most config from ./.env (dotenv). TEAM_DB_* only exist as shell
# exports, so load the platform env files if this script was started from a bare shell.
[ -z "${TEAM_DB_URL:-}" ] && [ -r /etc/profile.d/team-env.sh ] && . /etc/profile.d/team-env.sh
[ -z "${STRIPE_SECRET_KEY:-}" ] && [ -r /etc/profile.d/cto-env-vars.sh ] && . /etc/profile.d/cto-env-vars.sh

ts() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
# Log every event to supervisor.log exactly once; also echo to the terminal when a
# human is watching (the watchdog's own stdout is redirected to the same file, so
# echoing unconditionally would double every line).
say() {
  local msg
  msg="$(ts) $*"
  printf '%s\n' "$msg" >> "$SUP_LOG"
  [ -t 1 ] && printf '%s\n' "$msg"
  return 0
}

listening() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; }
listener_pids() { lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | tr '\n' ' '; }
health() { curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; }

do_start() {
  if listening; then
    echo "API already listening on :$PORT (pid $(listener_pids)) — nothing to do."
    return 0
  fi
  cd "$DIR" || return 1
  nohup node index.js >> "$APP_LOG" 2>&1 &
  local pid=$!
  echo "$pid" > "$PIDFILE"
  say "started: node index.js pid=$pid (app log: $APP_LOG)"
  local waited=0
  while [ "$waited" -lt 30 ]; do
    if health; then
      say "health OK on :$PORT after ${waited}s (pid $pid)"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  say "ERROR: process started but /api/health did not answer within 30s — check $APP_LOG"
  return 1
}

do_stop() {
  local pids
  pids="$(listener_pids)"
  if [ -z "$pids" ]; then
    echo "API not listening on :$PORT — nothing to stop."
    rm -f "$PIDFILE"
    return 0
  fi
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null
  for _ in $(seq 1 15); do
    listening || { say "stopped (was pid $pids)"; rm -f "$PIDFILE"; return 0; }
    sleep 1
  done
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null
  sleep 1
  listening && { say "ERROR: could not stop pid $pids"; return 1; }
  say "force-stopped (pid $pids)"
  rm -f "$PIDFILE"
}

do_status() {
  echo "dir:        $DIR"
  echo "port:       $PORT"
  if listening; then
    echo "listening:  YES (pid $(listener_pids))"
  else
    echo "listening:  NO"
  fi
  if health; then echo "health:     OK  ($(curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/health"))"
  else echo "health:     FAILING"; fi
  if pgrep -f "$WATCHDOG_PATTERN" >/dev/null 2>&1; then
    echo "watchdog:   running (pid $(pgrep -f "$WATCHDOG_PATTERN" | tr '\n' ' '))"
  else
    echo "watchdog:   NOT running"
  fi
  echo "--- last 5 lines of $APP_LOG ---"
  tail -n 5 "$APP_LOG" 2>/dev/null
  return 0
}

do_watchdog() {
  say "watchdog started (pid $$), checking every 15s"
  while true; do
    if ! listening; then
      say "watchdog: :$PORT is not listening — restarting"
      do_start >/dev/null 2>&1 || say "watchdog: restart attempt failed"
    fi
    sleep 15
  done
}

do_ensure_watchdog() {
  if pgrep -f "$WATCHDOG_PATTERN" >/dev/null 2>&1; then
    echo "watchdog already running (pid $(pgrep -f "$WATCHDOG_PATTERN" | tr '\n' ' '))"
    return 0
  fi
  nohup "$DIR/supervise.sh" watchdog >> "$SUP_LOG" 2>&1 &
  disown 2>/dev/null || true
  echo "watchdog started in background (pid $!), log: $SUP_LOG"
}

do_install_autostart() {
  cat > "$AUTOSTART_FILE" <<EOF
# Decipher API autostart — installed by $DIR/supervise.sh install-autostart
# Every login shell (owner terminal, agent session) makes sure the supervisor is
# running; the supervisor itself is idempotent, so this never starts a second server.
if [ -x "$DIR/supervise.sh" ]; then
  "$DIR/supervise.sh" ensure-watchdog >/dev/null 2>&1 &
fi
EOF
  chmod +x "$AUTOSTART_FILE" 2>/dev/null
  echo "installed $AUTOSTART_FILE"
  cat "$AUTOSTART_FILE"
}

case "${1:-status}" in
  start)            do_start ;;
  stop)             do_stop ;;
  restart)          do_stop; do_start ;;
  status)           do_status ;;
  watchdog)         do_watchdog ;;
  ensure-watchdog)  do_ensure_watchdog ;;
  install-autostart) do_install_autostart ;;
  *) echo "usage: $0 {start|stop|restart|status|watchdog|ensure-watchdog|install-autostart}" >&2; exit 2 ;;
esac
