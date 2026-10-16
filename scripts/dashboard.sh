#!/usr/bin/env bash
# Nibble heartbeat dashboard launcher.
#
# Thin client over the TARGET project's dashboard backend (Nibble card 8). It
# points the backend's static-file server at this project's Angular build via
# DASHBOARD_STATIC_DIR, so the UI and the API share one origin — the backend's
# Host / Origin / CSRF guards stay intact. All widget data is read from the
# target opencode project folder.
#
# Usage: ./scripts/dashboard.sh [project-dir]
#   project-dir   the opencode project to observe (default: the current dir)
# Env:  DASHBOARD_PORT      (default 4097)
#       OPENCODE_SERVE_URL  (default http://127.0.0.1:4096)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-$PWD}"

BACKEND="$TARGET/.opencode/plugin/lib/dashboard-server.ts"
if [ ! -f "$BACKEND" ]; then
  echo "nibble-dashboard: no dashboard backend at $BACKEND" >&2
  echo "usage: $0 [project-dir]   (run from the opencode project you want to observe)" >&2
  exit 1
fi

# Locate the built Angular UI. Build it first with: npm install && npm run build
UI=""
for cand in "$HERE/dist/browser" "$HERE/dist/dashboard/browser" "$HERE/dist"; do
  if [ -f "$cand/index.html" ]; then
    UI="$cand"
    break
  fi
done
if [ -z "$UI" ]; then
  echo "nibble-dashboard: UI not built — run 'npm install && npm run build' in $HERE" >&2
  exit 1
fi

PORT="${DASHBOARD_PORT:-4097}"
URL="http://127.0.0.1:$PORT"

echo "nibble-dashboard: target=$TARGET"
echo "                 ui=$UI"
echo "                 url=$URL"

# Open a browser shortly after the server starts (best-effort).
(
  sleep 1.2
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  fi
) &

export DASHBOARD_STATIC_DIR="$UI"
exec node "$BACKEND" "$TARGET"
