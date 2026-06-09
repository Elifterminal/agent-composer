#!/usr/bin/env bash
# launch-linux.sh — start AgentScore locally and open it in the browser.
# (ES modules need HTTP, so we serve the folder rather than open file://.)
set -euo pipefail
DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"   # repo root (parent of launchers/)

PORT=8910
is_free() { ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
while ! is_free "$PORT"; do PORT=$((PORT + 1)); done

cd "$DIR"
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/agentscore-serve.log 2>&1 &
else
  echo "AgentScore needs python3 to serve locally." >&2; exit 1
fi
echo $! > /tmp/agentscore.pid
sleep 1
URL="http://127.0.0.1:$PORT/"
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true; else echo "open $URL"; fi
echo "AgentScore running at $URL"
echo "stop with:  kill \$(cat /tmp/agentscore.pid)"
